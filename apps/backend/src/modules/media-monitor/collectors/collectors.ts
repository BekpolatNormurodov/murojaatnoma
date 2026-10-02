import { MediaSettings } from '../media-settings';
import { decodeEntities, meaningfulLine, parseFeedDate } from '../media-text.util';
import { ApiError, RawMediaItem, SourceRunResult, errorText, fetchJson, fetchText } from './collector.types';
import { parseFeed } from './feed.parser';
import { GovAuthority, parseGovUzNews } from './gov-uz.parser';
import { minPostId, parseTelegramPreview } from './telegram.parser';

/**
 * Every collector returns a SourceRunResult and never throws — one dead site
 * must not stop the other sources (Promise.allSettled is still used upstream
 * as a second fence).
 */

export async function collectRss(feed: MediaSettings['rssFeeds'][number], now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: `rss:${feed.key}`, name: feed.name, platform: 'web', items: [] };
  try {
    const xml = await fetchText(feed.url);
    base.items = parseFeed(xml).map(
      (e): RawMediaItem => ({
        source: base.key,
        sourceName: feed.name,
        platform: 'web',
        externalId: e.id || e.link,
        url: e.link || e.id,
        title: e.title,
        text: e.description,
        imageUrl: e.imageUrl,
        author: e.author,
        publishedAt: parseFeedDate(e.published, now),
        official: feed.official === true,
      }),
    );
  } catch (err) {
    base.error = errorText(err);
  }
  return base;
}

export interface TelegramDepth {
  /** Pages of channel history (20 posts each, newest first). Default 1. */
  pages?: number;
  /** In-channel searches (`t.me/s/<ch>?q=...`) — finds older posts about the district. */
  queries?: string[];
  /** District-local channel: keep every post, keyword or not. */
  local?: boolean;
}

/**
 * Public channel preview `t.me/s/<channel>` (no token). The page holds only the
 * newest ~20 posts, so deeper runs also page back with `?before=<id>` and run
 * Telegram's own in-channel search for each district spelling — that is what
 * actually surfaces the (rare) posts about the district.
 */
export async function collectTelegram(
  channel: string,
  now: Date,
  official = false,
  depth: TelegramDepth = {},
): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: `tg:${channel.toLowerCase()}`, name: `@${channel}`, platform: 'telegram', items: [] };
  const url = `https://t.me/s/${encodeURIComponent(channel)}`;
  const seen = new Map<string, RawMediaItem>();
  const add = (items: RawMediaItem[], backfill = false) => {
    for (const i of items) if (!seen.has(i.externalId)) seen.set(i.externalId, backfill ? { ...i, backfill: true } : i);
  };
  try {
    const html = await fetchText(url);
    const first = parseTelegramPreview(html, channel, now);
    add(first);
    if (!first.length && !html.includes('tgme_widget_message')) base.error = 'Kanal topilmadi yoki yopiq';
    let before = minPostId(html);
    for (let p = 1; p < (depth.pages ?? 1) && before; p++) {
      const olderHtml = await fetchText(`${url}?before=${before}`);
      const next = minPostId(olderHtml);
      if (!next || next >= before) break;
      add(parseTelegramPreview(olderHtml, channel, now), true);
      before = next;
    }
    for (const q of depth.queries ?? []) {
      try {
        add(parseTelegramPreview(await fetchText(`${url}?q=${encodeURIComponent(q)}`), channel, now), true);
      } catch {
        /* one failed search must not drop the channel */
      }
    }
  } catch (err) {
    base.error = errorText(err);
  }
  base.items = [...seen.values()].map((i) => ({ ...i, official, localChannel: depth.local === true }));
  if (base.items[0]) base.name = base.items[0].sourceName;
  return base;
}

/** Google News search RSS — every outlet Google indexes, in one request. */
export async function collectGoogleNews(query: string, firstRun: boolean, now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: 'google', name: 'Google News', platform: 'web', items: [] };
  if (!query) return { ...base, skipped: "So'rov bo'sh" };
  try {
    // The UZ:uz edition redirects to RU:ru, so ask for the Uzbekistan/Russian
    // edition directly; Latin-Uzbek outlets are covered by their own RSS.
    const q = `${query} when:${firstRun ? '7d' : '2d'}`;
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ru&gl=UZ&ceid=UZ:ru`;
    const xml = await fetchText(url);
    base.items = parseFeed(xml).map((e): RawMediaItem => {
      const outlet = e.sourceName ?? 'Google News';
      const suffix = ` - ${outlet}`;
      const title = e.title.endsWith(suffix) ? e.title.slice(0, -suffix.length) : e.title;
      return {
        source: 'google',
        sourceName: outlet,
        platform: 'web',
        externalId: e.id || e.link,
        url: e.link,
        title,
        // Google's description is just the title + outlet again.
        text: '',
        publishedAt: parseFeedDate(e.published, now),
        viaSearch: true,
      };
    });
  } catch (err) {
    base.error = errorText(err);
  }
  return base;
}

/**
 * The same district query, restricted to official domains (gov.uz,
 * president.uz, tashkent.uz, parliament ...). Those portals publish no RSS,
 * but Google indexes them — this is how hokimlik / ministry pages get in.
 */
export async function collectGoogleNewsOfficial(
  query: string,
  sites: string[],
  firstRun: boolean,
  now: Date,
): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: 'google-official', name: 'Google News · davlat saytlari', platform: 'web', items: [] };
  if (!query || !sites.length) return { ...base, skipped: "Davlat saytlari ro'yxati bo'sh" };
  const siteExpr = sites.map((s) => `site:${s}`).join(' OR ');
  const r = await collectGoogleNews(`(${query}) (${siteExpr})`, firstRun, now);
  return {
    ...base,
    error: r.error,
    skipped: r.skipped,
    items: r.items
      // Portal chrome pages ("Kontaktlar", "Rahbariyat") are not news.
      .filter((i) => !isPortalPage(i.title))
      .map((i) => ({ ...i, source: 'google-official', official: true })),
  };
}

const STATIC_PAGE = /^(контакт|руководств|rahbariyat|aloqa|kontakt|biz haqimizda|о нас|haqida|tuzilma|структура|vakansiya|вакансии)/i;
const AGENCY_NAME = /(hokimligi|ҳокимлиги|хокимлиги|hokimiyati|хокимият|ҳокимият|администрац)/i;

/**
 * Portal chrome, not news: "Kontaktlar", "Rahbariyat", or a title that is only
 * the agency's own name ("Тошкент шаҳар Мирзо Улуғбек тумани ҳокимлиги").
 */
export function isPortalPage(title: string): boolean {
  const t = title.trim();
  if (STATIC_PAGE.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean).length;
  return words <= 8 && AGENCY_NAME.test(t) && !/[!?:«»"“”]/.test(t);
}

/** An agency's news list on the Government portal (gov.uz/oz/<slug>/news/news). */
export async function collectGovUz(authority: GovAuthority, now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: `gov:${authority.slug}`, name: authority.name, platform: 'web', items: [] };
  try {
    const html = await fetchText(`https://gov.uz/oz/${encodeURIComponent(authority.slug)}/news/news`);
    base.items = parseGovUzNews(html, authority, now);
    if (!base.items.length) base.error = "Sahifadan yangilik o'qilmadi (gov.uz tuzilishi o'zgargan bo'lishi mumkin)";
  } catch (err) {
    base.error = errorText(err);
  }
  return base;
}

interface YtRenderer {
  videoId?: string;
  title?: { runs?: { text?: string }[] };
  ownerText?: { runs?: { text?: string; navigationEndpoint?: { browseEndpoint?: { browseId?: string } } }[] };
  publishedTimeText?: { simpleText?: string };
  viewCountText?: { simpleText?: string };
  detailedMetadataSnippets?: { snippetText?: { runs?: { text?: string }[] } }[];
  descriptionSnippet?: { runs?: { text?: string }[] };
  thumbnail?: { thumbnails?: { url?: string }[] };
}

const runs = (r?: { runs?: { text?: string }[] }) => (r?.runs ?? []).map((x) => x.text ?? '').join('');

/** Property / sale listings that ride on the district's name — not news. */
export const LISTING = /(sotiladi|sotuvda|ijaraga|kvartira|xonali uy|продаж|продаю|продается|продаётся|квартир[аы]? в|аренд|for sale|for rent|apartment|cottages?|\bID\s?\d{3,}|\$\s?\d|\d[\d\s,.]*\s?\$|у\.е\.)/i;

const AGO_UNITS: [RegExp, number][] = [
  [/^(mo|months?)$/i, 2.592e9],
  [/^(y|yrs?|years?)$/i, 3.1536e10],
  [/^(w|wks?|weeks?)$/i, 6.048e8],
  [/^(d|days?)$/i, 8.64e7],
  [/^(h|hrs?|hours?)$/i, 3.6e6],
  [/^(m|mins?|minutes?)$/i, 6e4],
  [/^(s|secs?|seconds?)$/i, 1e3],
];

/**
 * "10 hours ago" / "Streamed 2 days ago" / "3y ago" / "5mo ago" → Date
 * (approximate by design). Unknown format → null: an undated video is
 * dropped rather than shown as today's news.
 */
export function parseRelativeAgo(s: string | undefined, now: Date): Date | null {
  const m = /(\d+)\s*([a-z]+)\s+ago/i.exec(s ?? '');
  if (!m) return null;
  const unit = AGO_UNITS.find(([re]) => re.test(m[2]))?.[1];
  return unit ? new Date(now.getTime() - Number(m[1]) * unit) : null;
}

/** Video renderers out of a YouTube results page's `ytInitialData`. */
export function parseYoutubeResults(html: string): YtRenderer[] {
  const m = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html);
  if (!m) return [];
  let data: unknown;
  try {
    data = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out: YtRenderer[] = [];
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) o.forEach(walk);
    else if (o && typeof o === 'object') {
      const rec = o as Record<string, unknown>;
      if (rec.videoRenderer) out.push(rec.videoRenderer as YtRenderer);
      Object.values(rec).forEach(walk);
    }
  };
  walk(data);
  return out;
}

/**
 * Keyless YouTube search (the public results page, newest first) for each
 * district spelling — finds district videos from ANY channel, not only the
 * ones we follow. With YOUTUBE_API_KEY the Data API search runs as well.
 */
export async function collectYoutubeWebSearch(queries: string[], now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: 'youtube-web', name: 'YouTube qidiruv (kalitsiz)', platform: 'youtube', items: [] };
  if (!queries.length) return { ...base, skipped: "So'rovlar bo'sh" };
  const seen = new Map<string, RawMediaItem>();
  const errors: string[] = [];
  for (const q of queries) {
    try {
      const html = await fetchText(
        `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=CAI%253D&hl=en&gl=UZ`,
        20_000,
        { 'Accept-Language': 'en-US,en;q=0.9' },
      );
      for (const v of parseYoutubeResults(html)) {
        if (!v.videoId || seen.has(v.videoId)) continue;
        const title = runs(v.title);
        if (!title || LISTING.test(title)) continue;
        const owner = v.ownerText?.runs?.[0];
        const snippet = runs(v.detailedMetadataSnippets?.[0]?.snippetText) || runs(v.descriptionSnippet);
        const thumbs = v.thumbnail?.thumbnails ?? [];
        const publishedAt = parseRelativeAgo(v.publishedTimeText?.simpleText, now);
        if (!publishedAt) continue;
        seen.set(v.videoId, {
          source: 'youtube',
          sourceName: owner?.text || 'YouTube',
          platform: 'youtube',
          externalId: v.videoId,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          title,
          text: snippet,
          imageUrl: thumbs[thumbs.length - 1]?.url?.split('?')[0] || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
          author: owner?.text,
          views: parseCompactViews(v.viewCountText?.simpleText),
          publishedAt,
          viaSearch: true,
          backfill: true,
        });
      }
    } catch (err) {
      errors.push(`«${q}»: ${errorText(err)}`);
    }
  }
  base.items = [...seen.values()];
  if (errors.length === queries.length) base.error = errors[0];
  return base;
}

function parseCompactViews(s?: string): number | undefined {
  const n = parseInt((s ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Public channel RSS (no key): https://www.youtube.com/feeds/videos.xml?channel_id=UC... */
export async function collectYoutubeChannel(
  channelId: string,
  now: Date,
  role: { official?: boolean; own?: boolean } = {},
): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: `yt:${channelId}`, name: 'YouTube kanal', platform: 'youtube', items: [] };
  try {
    const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channelId)}`);
    const channelName = /<feed[\s\S]*?<title>([^<]*)<\/title>/.exec(xml)?.[1];
    if (channelName) base.name = `YouTube · ${decodeEntities(channelName)}`;
    base.items = parseFeed(xml).map(
      (e): RawMediaItem => ({
        source: 'youtube',
        sourceName: e.author ?? channelName ?? 'YouTube',
        platform: 'youtube',
        externalId: e.videoId ?? e.id,
        url: e.link || `https://www.youtube.com/watch?v=${e.videoId}`,
        title: e.title,
        text: e.description,
        imageUrl: e.imageUrl ?? (e.videoId ? `https://i.ytimg.com/vi/${e.videoId}/hqdefault.jpg` : undefined),
        author: e.author,
        views: e.views,
        publishedAt: parseFeedDate(e.published, now),
        official: role.official === true || role.own === true,
        alwaysRelevant: role.own === true,
      }),
    );
  } catch (err) {
    base.error = errorText(err);
  }
  return base;
}

interface YtSearchResponse {
  items?: {
    id?: { videoId?: string };
    snippet?: {
      publishedAt?: string;
      title?: string;
      description?: string;
      channelTitle?: string;
      thumbnails?: Record<string, { url?: string }>;
    };
  }[];
}
interface YtVideosResponse {
  items?: { id: string; statistics?: { viewCount?: string } }[];
}

/**
 * YouTube Data API v3 keyword search (needs YOUTUBE_API_KEY). search.list
 * costs 100 quota units of the free 10 000/day, so the caller runs it at most
 * every 30 min (48 × 100 + view counts ≈ 5 000 units/day).
 */
export async function collectYoutubeSearch(apiKey: string, query: string, firstRun: boolean, now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: 'youtube-search', name: 'YouTube qidiruv', platform: 'youtube', items: [] };
  if (!apiKey) return { ...base, skipped: 'YOUTUBE_API_KEY kiritilmagan — faqat kanallar RSS' };
  if (!query) return { ...base, skipped: "So'rov bo'sh" };
  try {
    const after = new Date(now.getTime() - (firstRun ? 7 : 2) * 86_400_000).toISOString();
    const qs = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      order: 'date',
      maxResults: '25',
      q: query,
      publishedAfter: after,
      regionCode: 'UZ',
      key: apiKey,
    });
    const res = await fetchJson<YtSearchResponse>(`https://www.googleapis.com/youtube/v3/search?${qs}`);
    const vids = (res.items ?? []).filter((i) => i.id?.videoId && i.snippet);
    const views = new Map<string, number>();
    if (vids.length) {
      const vq = new URLSearchParams({ part: 'statistics', id: vids.map((v) => v.id!.videoId!).join(','), key: apiKey });
      const stats = await fetchJson<YtVideosResponse>(`https://www.googleapis.com/youtube/v3/videos?${vq}`).catch(() => ({ items: [] }) as YtVideosResponse);
      for (const s of stats.items ?? []) {
        const n = parseInt(s.statistics?.viewCount ?? '', 10);
        if (Number.isFinite(n)) views.set(s.id, n);
      }
    }
    base.items = vids.map((v): RawMediaItem => {
      const id = v.id!.videoId!;
      const sn = v.snippet!;
      const thumb = sn.thumbnails?.high?.url ?? sn.thumbnails?.medium?.url ?? sn.thumbnails?.default?.url;
      return {
        source: 'youtube',
        sourceName: decodeEntities(sn.channelTitle ?? 'YouTube'),
        platform: 'youtube',
        externalId: id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title: decodeEntities(sn.title ?? ''),
        text: decodeEntities(sn.description ?? ''),
        imageUrl: thumb,
        author: sn.channelTitle,
        views: views.get(id),
        publishedAt: parseFeedDate(sn.publishedAt, now),
        viaSearch: true,
      };
    });
  } catch (err) {
    const msg = errorText(err);
    base.error = /quota/i.test(msg) ? 'YouTube kunlik kvotasi tugadi (ertaga tiklanadi)' : msg;
  }
  return base;
}

interface IgMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

const discoveredIgIds = new Map<string, string>();

/**
 * INSTAGRAM_BUSINESS_ID is optional: the IG business account is the one
 * linked to the token's Facebook Page. A user token lists its Pages
 * (/me/accounts); a Page token — the one that never expires — is the Page (/me).
 */
async function discoverIgBusinessId(graph: string, token: string): Promise<string | undefined> {
  const cached = discoveredIgIds.get(token);
  if (cached) return cached;
  const tok = encodeURIComponent(token);
  let id: string | undefined;
  try {
    const r = await fetchJson<{ data?: { instagram_business_account?: { id?: string } }[] }>(
      `${graph}/me/accounts?fields=instagram_business_account&limit=50&access_token=${tok}`,
    );
    id = r.data?.find((p) => p.instagram_business_account?.id)?.instagram_business_account?.id;
  } catch (err) {
    // A Page token has no /me/accounts — fall through to /me.
    if (err instanceof ApiError && err.code === 190) throw err;
  }
  if (!id) {
    const page = await fetchJson<{ instagram_business_account?: { id?: string } }>(
      `${graph}/me?fields=instagram_business_account&access_token=${tok}`,
    ).catch(() => undefined);
    id = page?.instagram_business_account?.id;
  }
  if (id) discoveredIgIds.set(token, id);
  return id;
}

const IG_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count';

/** One Instagram account to read, with its strongest role. */
export interface IgAccount {
  handle: string;
  /** State body — «Rasmiy» badge. */
  official: boolean;
  /** The district hokimligi — every post counts. */
  own: boolean;
}

/** Graph API rate-limit codes (app, user, page, custom, Instagram business-use-case). */
const IG_RATE_CODES = new Set([4, 17, 32, 613, 80002]);

function igItem(m: IgMedia, source: string, sourceName: string, now: Date, role: Partial<IgAccount> = {}): RawMediaItem | null {
  if (!m.permalink) return null;
  const caption = (m.caption ?? '').trim();
  // Captions often open with emoji or a hashtag block — take the first real line.
  const firstLine = meaningfulLine(caption) ?? caption.split('\n').find((l) => l.trim()) ?? '';
  return {
    source,
    sourceName,
    platform: 'instagram',
    externalId: m.id,
    url: m.permalink,
    title: firstLine.slice(0, 160) || 'Instagram post',
    text: caption,
    imageUrl: m.media_type === 'VIDEO' ? (m.thumbnail_url ?? undefined) : m.media_url,
    author: sourceName,
    publishedAt: parseFeedDate(m.timestamp, now),
    viaSearch: source === 'ig-hashtags',
    official: role.official === true || role.own === true,
    alwaysRelevant: role.own === true,
  };
}

/** What the hokimiyat should do about a Graph API error, in plain words. */
function igErrorText(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 190) return 'Instagram tokeni eskirgan yoki bekor qilingan — yangi token kerak';
    if (IG_RATE_CODES.has(err.code ?? -1)) return "Instagram so'rovlar limiti — 1 soatdan keyin davom etadi";
    if (err.code === 10 || err.code === 200) return `Ruxsat yetarli emas: ${err.message}`;
    if (err.code === 110 || err.code === 100 || /cannot find|not found|invalid user|business/i.test(err.message)) {
      return "Akkaunt topilmadi yoki professional emas (shaxsiy akkauntlar o'qilmaydi)";
    }
  }
  return errorText(err);
}

export interface InstagramRun {
  /** One row per account (+ hashtags) for the «Holat» panel. */
  results: SourceRunResult[];
  /** Rate limit or dead token — the caller pauses Instagram for a while. */
  pause: boolean;
}

/**
 * Instagram Graph API (needs INSTAGRAM_ACCESS_TOKEN of ANY professional IG
 * account linked to a Facebook Page — not the hokimiyat's; INSTAGRAM_BUSINESS_ID
 * is found from it when not set):
 *  - accounts → business_discovery: the newest posts of public business/creator
 *    profiles (state bodies, hokimliklar, news outlets) — one call each;
 *  - hashtags → ig_hashtag_search → /{hashtag}/recent_media (needs Meta's
 *    "Instagram Public Content Access"). Hashtag ids are cached (30 lookups / 7 days).
 * A rate limit or a dead token stops the run at once instead of burning calls.
 */
export async function collectInstagram(
  cfg: { token: string; businessId: string; version: string },
  settings: Pick<MediaSettings, 'instagramHashtags'>,
  accounts: IgAccount[],
  hashtagIds: Map<string, string>,
  now: Date,
): Promise<InstagramRun> {
  const row = (key: string, name: string): SourceRunResult => ({ key, name, platform: 'instagram', items: [] });
  if (!cfg.token) return { results: [{ ...row('instagram', 'Instagram'), skipped: 'INSTAGRAM_ACCESS_TOKEN kiritilmagan' }], pause: false };
  const g = `https://graph.facebook.com/${cfg.version}`;
  const tok = encodeURIComponent(cfg.token);
  let businessId: string | undefined = cfg.businessId;
  if (!businessId) {
    try {
      businessId = await discoverIgBusinessId(g, cfg.token);
    } catch (err) {
      return { results: [{ ...row('instagram', 'Instagram'), error: `Instagram biznes akkaunti aniqlanmadi: ${igErrorText(err)}` }], pause: true };
    }
    if (!businessId) {
      return {
        results: [{
          ...row('instagram', 'Instagram'),
          error: "Tokenga Instagram biznes akkaunt ulangan Facebook sahifa topilmadi — INSTAGRAM_BUSINESS_ID ni qo'lda kiriting",
        }],
        pause: false,
      };
    }
  }
  const uid = encodeURIComponent(businessId);
  let stop: string | undefined;
  const fatal = (err: unknown) => {
    if (err instanceof ApiError && (err.code === 190 || IG_RATE_CODES.has(err.code ?? -1))) stop = igErrorText(err);
  };
  const results: SourceRunResult[] = [];

  if (settings.instagramHashtags.length) {
    const tags = row('ig-hashtags', 'Instagram heshteglar');
    const errors: string[] = [];
    for (const tagName of settings.instagramHashtags.slice(0, 10)) {
      if (stop) break;
      try {
        let hid = hashtagIds.get(tagName);
        if (!hid) {
          const r = await fetchJson<{ data?: { id: string }[] }>(
            `${g}/ig_hashtag_search?user_id=${uid}&q=${encodeURIComponent(tagName)}&access_token=${tok}`,
          );
          hid = r.data?.[0]?.id;
          if (!hid) continue;
          hashtagIds.set(tagName, hid);
        }
        const media = await fetchJson<{ data?: IgMedia[] }>(
          `${g}/${hid}/recent_media?user_id=${uid}&fields=${IG_FIELDS}&limit=50&access_token=${tok}`,
        );
        for (const m of media.data ?? []) {
          const it = igItem(m, 'ig-hashtags', `#${tagName}`, now);
          if (it) tags.items.push(it);
        }
      } catch (err) {
        fatal(err);
        errors.push(`#${tagName}: ${igErrorText(err)}`);
      }
    }
    if (errors.length) tags.error = errors.slice(0, 2).join('; ');
    results.push(tags);
  }

  // A few at a time: ~30 accounts in seconds, without bursting the Graph API.
  const list = accounts.slice(0, 40);
  let next = 0;
  const worker = async () => {
    while (next < list.length) {
      const a = list[next++];
      const key = `ig:${a.handle.toLowerCase()}`;
      const r = row(key, `@${a.handle}`);
      results.push(r);
      if (stop) {
        r.skipped = stop;
        continue;
      }
      try {
        const fields = `business_discovery.username(${a.handle}){username,name,media.limit(12){${IG_FIELDS}}}`;
        const res = await fetchJson<{ business_discovery?: { username: string; name?: string; media?: { data?: IgMedia[] } } }>(
          `${g}/${uid}?fields=${encodeURIComponent(fields)}&access_token=${tok}`,
        );
        const bd = res.business_discovery;
        r.name = bd?.name ? `${bd.name} (@${bd.username ?? a.handle})` : `@${bd?.username ?? a.handle}`;
        for (const m of bd?.media?.data ?? []) {
          const it = igItem(m, key, bd?.name || `@${bd?.username ?? a.handle}`, now, a);
          if (it) r.items.push(it);
        }
      } catch (err) {
        fatal(err);
        r.error = igErrorText(err);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, list.length) }, worker));
  return { results, pause: !!stop };
}
