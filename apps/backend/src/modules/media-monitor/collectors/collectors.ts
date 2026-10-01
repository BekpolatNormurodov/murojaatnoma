import { MediaSettings } from '../media-settings';
import { decodeEntities, parseFeedDate } from '../media-text.util';
import { RawMediaItem, SourceRunResult, errorText, fetchJson, fetchText } from './collector.types';
import { parseFeed } from './feed.parser';
import { parseTelegramPreview } from './telegram.parser';

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
      }),
    );
  } catch (err) {
    base.error = errorText(err);
  }
  return base;
}

export async function collectTelegram(channel: string, now: Date): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: `tg:${channel.toLowerCase()}`, name: `@${channel}`, platform: 'telegram', items: [] };
  try {
    const html = await fetchText(`https://t.me/s/${encodeURIComponent(channel)}`);
    base.items = parseTelegramPreview(html, channel, now);
    if (base.items[0]) base.name = base.items[0].sourceName;
    else if (!html.includes('tgme_widget_message')) base.error = 'Kanal topilmadi yoki yopiq';
  } catch (err) {
    base.error = errorText(err);
  }
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

/** Public channel RSS (no key): https://www.youtube.com/feeds/videos.xml?channel_id=UC... */
export async function collectYoutubeChannel(channelId: string, now: Date): Promise<SourceRunResult> {
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

const IG_FIELDS = 'id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count';

function igItem(m: IgMedia, sourceName: string, viaSearch: boolean, now: Date): RawMediaItem | null {
  if (!m.permalink) return null;
  const caption = (m.caption ?? '').trim();
  const firstLine = caption.split('\n').find((l) => l.trim()) ?? '';
  return {
    source: 'instagram',
    sourceName,
    platform: 'instagram',
    externalId: m.id,
    url: m.permalink,
    title: firstLine.slice(0, 160) || 'Instagram post',
    text: caption,
    imageUrl: m.media_type === 'VIDEO' ? (m.thumbnail_url ?? undefined) : m.media_url,
    author: sourceName,
    publishedAt: parseFeedDate(m.timestamp, now),
    viaSearch,
  };
}

/**
 * Instagram Graph API (needs INSTAGRAM_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ID of
 * an IG Business/Creator account linked to a Facebook Page):
 *  - hashtags → ig_hashtag_search → /{hashtag}/recent_media (last 24h);
 *  - accounts → business_discovery (public business/creator profiles' recent posts).
 * Hashtag ids are cached: Instagram allows 30 unique hashtag lookups / 7 days.
 */
export async function collectInstagram(
  cfg: { token: string; businessId: string; version: string },
  settings: Pick<MediaSettings, 'instagramHashtags' | 'instagramAccounts'>,
  hashtagIds: Map<string, string>,
  now: Date,
): Promise<SourceRunResult> {
  const base: SourceRunResult = { key: 'instagram', name: 'Instagram', platform: 'instagram', items: [] };
  if (!cfg.token || !cfg.businessId) {
    return { ...base, skipped: 'INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_BUSINESS_ID kiritilmagan' };
  }
  const g = `https://graph.facebook.com/${cfg.version}`;
  const tok = encodeURIComponent(cfg.token);
  const uid = encodeURIComponent(cfg.businessId);
  const errors: string[] = [];
  for (const tagName of settings.instagramHashtags.slice(0, 10)) {
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
        const it = igItem(m, `#${tagName}`, true, now);
        if (it) base.items.push(it);
      }
    } catch (err) {
      errors.push(`#${tagName}: ${errorText(err)}`);
    }
  }
  for (const account of settings.instagramAccounts.slice(0, 15)) {
    try {
      const fields = `business_discovery.username(${account}){username,name,media.limit(25){${IG_FIELDS}}}`;
      const r = await fetchJson<{ business_discovery?: { username: string; name?: string; media?: { data?: IgMedia[] } } }>(
        `${g}/${uid}?fields=${encodeURIComponent(fields)}&access_token=${tok}`,
      );
      const bd = r.business_discovery;
      for (const m of bd?.media?.data ?? []) {
        const it = igItem(m, bd?.name || `@${bd?.username ?? account}`, false, now);
        if (it) base.items.push(it);
      }
    } catch (err) {
      errors.push(`@${account}: ${errorText(err)}`);
    }
  }
  if (errors.length) base.error = errors.slice(0, 3).join('; ');
  return base;
}
