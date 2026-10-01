import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { MediaItem, MediaSentiment, Prisma } from '@prisma/client';
import { AppConfig } from '../../common/config/configuration';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MediaPlatform, RawMediaItem, SourceRunResult } from './collectors/collector.types';
import {
  collectGoogleNews,
  collectGoogleNewsOfficial,
  collectGovUz,
  collectInstagram,
  collectYoutubeWebSearch,
  collectRss,
  collectTelegram,
  collectYoutubeChannel,
  collectYoutubeSearch,
} from './collectors/collectors';
import {
  ListMediaQueryDto,
  MarkSeenDto,
  MediaOverviewQueryDto,
  MediaPeriod,
  UpdateMediaItemDto,
  UpdateMediaSettingsDto,
} from './dto/media.dto';
import {
  ClaudeConfig,
  DigestInputItem,
  DigestResult,
  ItemAnalysis,
  analyzeByRules,
  ruleSentiment,
  ruleTopic,
  analyzeWithClaude,
  digestByRules,
  digestWithClaude,
} from './media-analyzer';
import { DEFAULT_MEDIA_SETTINGS, MediaSettings, SOURCES_VERSION, cleanHandle, mergeSettings, upgradeSources } from './media-settings';
import { fingerprintOf, meaningfulLine, truncate } from './media-text.util';
import { PlaceGazetteer, buildGazetteer, scoreRelevance } from './media-relevance';
import { AREA_FIELD, AREA_NAME, MediaArea, areaRelevance, scoreArea } from './media-area';
import { StoryCandidate, assignStories, STORY_WINDOW_MS } from './media-story';

/** Emitted after every run that stored something; RealtimeGateway pushes it to admins. */
export const MEDIA_UPDATED_EVENT = 'media.updated';
export interface MediaUpdatedEvent {
  /** District items (the toast counts these). */
  newItems: number;
  negativeNew: number;
  /** New items per area filter, so an open city/region view refreshes too. */
  areas: Record<MediaArea, number>;
  digestId: string | null;
  at: string;
}

export interface SourceHealth {
  key: string;
  name: string;
  platform: MediaPlatform;
  ok: boolean | null;
  error?: string;
  skipped?: string;
  fetched: number;
  matched: number;
  lastRunAt?: string;
  lastSuccessAt?: string;
}

interface RunSummary {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  newItems: number;
  negativeNew: number;
  digest: boolean;
  aiError?: string;
}

const PERIOD_HOURS: Record<Exclude<MediaPeriod, 'all'>, number> = { '24h': 24, '7d': 168, '30d': 720 };
const CRON_EVERY_15_MIN = '0 */15 * * * *';
const TASHKENT_OFFSET_MS = 5 * 3_600_000; // UTC+5, no DST
const MAX_ITEM_AGE_MS = 14 * 86_400_000;
const OWN_SOURCE_MAX_AGE_MS = 60 * 86_400_000;
const YT_SEARCH_EVERY_MS = 30 * 60_000;
const TG_DEEP_EVERY_MS = 3 * 3_600_000;
/** History found by search (Telegram ?q=, YouTube search) — older posts still matter. */
const BACKFILL_MAX_AGE_MS = 60 * 86_400_000;
/** District-local channel posts without a keyword: visible, but below keyword hits. */
const LOCAL_CHANNEL_RELEVANCE = 40;
/** City / region hokimligi pages: every post is about that area. */
const AREA_OWN_RELEVANCE = 90;
/** City / region channels without a place name in the post: shown, below named mentions. */
const AREA_CHANNEL_RELEVANCE = 55;
/** City / region-only items below this are not stored (bare "Toshkent" in a long text). */
const AREA_STORE_MIN = 45;
/** City / region-only items are many — kept 45 days instead of 120. */
const AREA_ONLY_KEEP_MS = 45 * 86_400_000;
const DIGEST_MAX_AGE_MS = 3 * 3_600_000;
const MANUAL_REFRESH_COOLDOWN_MS = 60_000;
const SETTINGS_KEY = 'config';
const IG_HASHTAGS_KEY = 'ig-hashtag-ids';

/**
 * OAV monitoringi: collects → filters by district keywords → de-duplicates →
 * scores (Claude or rules) → writes the xulosa, every 15 minutes and on
 * demand. Every source is isolated; a dead site only greys out its own row on
 * the "Manbalar" panel.
 */
@Injectable()
export class MediaMonitorService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(MediaMonitorService.name);
  private readonly health = new Map<string, SourceHealth>();
  private current: Promise<RunSummary> | null = null;
  private lastRun: RunSummary | null = null;
  private lastYtSearchAt = 0;
  private lastYtWebAt = 0;
  private lastTgDeepAt = 0;
  private rescoredOnce = false;
  private gazetteer: { at: number; key: string; value: PlaceGazetteer } | null = null;
  private lastCleanupAt = 0;
  private aiError: string | null = null;
  /** Last-read "AI tahlil" switch (for the sync status() view). */
  private aiSwitch = false;
  private bootTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly events: EventEmitter2,
  ) {}

  private get cfg(): AppConfig['media'] {
    return this.config.get('media', { infer: true });
  }

  /**
   * Claude runs only when BOTH the key is configured and the "AI tahlil"
   * switch is on (off by default) — so a key can be added ahead of time and
   * the hokimiyat turns AI on from Sozlamalar when ready.
   */
  private claudeFor(s: MediaSettings): ClaudeConfig | null {
    const c = this.cfg;
    return c.anthropicApiKey && s.aiEnabled ? { apiKey: c.anthropicApiKey, model: c.aiModel } : null;
  }

  onApplicationBootstrap(): void {
    if (!this.cfg.enabled || process.env.NODE_ENV === 'test') return;
    // First pass shortly after boot, so a fresh deploy has data before the next quarter-hour.
    this.bootTimer = setTimeout(() => void this.runOnce('boot'), 20_000);
    this.bootTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.bootTimer) clearTimeout(this.bootTimer);
  }

  @Cron(CRON_EVERY_15_MIN, { name: 'media-monitor' })
  async scheduled(): Promise<void> {
    if (!this.cfg.enabled) return;
    await this.runOnce('cron');
  }

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async getSettings(): Promise<MediaSettings> {
    const row = await this.prisma.mediaSetting.findUnique({ where: { key: SETTINGS_KEY } });
    let s = mergeSettings((row?.value as Partial<MediaSettings> | undefined) ?? null);
    if (!row) s = { ...s, sourcesVersion: SOURCES_VERSION };
    const upgraded = row ? upgradeSources(s) : null;
    if (upgraded) {
      s = upgraded;
      await this.prisma.mediaSetting.update({
        where: { key: SETTINGS_KEY },
        data: { value: s as unknown as Prisma.InputJsonValue },
      });
      this.logger.log(`media settings: added new default sources (v${SOURCES_VERSION})`);
    }
    this.aiSwitch = s.aiEnabled;
    return s;
  }

  async settingsView() {
    const c = this.cfg;
    return {
      settings: await this.getSettings(),
      defaults: DEFAULT_MEDIA_SETTINGS,
      integrations: {
        ai: !!c.anthropicApiKey,
        aiModel: c.anthropicApiKey ? c.aiModel : null,
        youtube: !!c.youtubeApiKey,
        instagram: !!c.instagramAccessToken,
      },
    };
  }

  async updateSettings(dto: UpdateMediaSettingsDto) {
    const current = await this.getSettings();
    if (dto.rssFeeds) {
      for (const f of dto.rssFeeds) assertPublicUrl(f.url);
      const keys = new Set<string>();
      for (const f of dto.rssFeeds) {
        if (keys.has(f.key)) throw new BadRequestException(`RSS kaliti takrorlangan: ${f.key}`);
        keys.add(f.key);
      }
    }
    for (const list of [
      dto.telegramChannels,
      dto.officialTelegramChannels,
      dto.localTelegramChannels,
      dto.cityTelegramChannels,
      dto.regionTelegramChannels,
    ]) {
      if (!list) continue;
      for (const ch of list.map(cleanHandle)) {
        if (!/^[A-Za-z0-9_]{4,64}$/.test(ch)) throw new BadRequestException(`Telegram kanal nomi noto'g'ri: ${ch}`);
      }
    }
    if (dto.instagramAccounts) {
      for (const a of dto.instagramAccounts.map(cleanHandle)) {
        if (!/^[A-Za-z0-9._]{1,30}$/.test(a)) throw new BadRequestException(`Instagram akkaunt nomi noto'g'ri: ${a}`);
      }
    }
    // Saved from a form that showed the current defaults → nothing left to upgrade.
    const next = { ...mergeSettings({ ...current, ...stripUndefined(dto) }), sourcesVersion: SOURCES_VERSION };
    if (next.keywords.length === 0) throw new BadRequestException("Kamida bitta asosiy kalit so'z kerak");
    await this.prisma.mediaSetting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: next as unknown as Prisma.InputJsonValue },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });
    // New keywords / channel roles apply to what is already stored, not only to the next run.
    void this.rescoreStored(next).catch((err: unknown) => this.logger.warn(`rescore failed: ${String(err)}`));
    return this.settingsView();
  }

  /**
   * Re-applies the keyword rules to stored rule-scored items of the last 60
   * days (e.g. after the matcher stopped counting @handles, or the hokimiyat
   * changed keywords). AI-scored items keep their AI relevance.
   */
  async rescoreStored(s: MediaSettings): Promise<number> {
    const since = new Date(Date.now() - BACKFILL_MAX_AGE_MS);
    const gaz = await this.loadGazetteer(s);
    const rows = await this.prisma.mediaItem.findMany({
      where: { publishedAt: { gte: since } },
      select: {
        id: true, source: true, platform: true, title: true, excerpt: true, relevance: true, keywords: true,
        sentiment: true, topic: true, analyzedBy: true, official: true, cityRelevance: true, regionRelevance: true,
      },
    });
    const roles = sourceRoles(s);
    const updates: Prisma.PrismaPromise<unknown>[] = [];
    for (const r of rows) {
      // AI-scored items keep the AI's district relevance, mood and topic; only the areas are re-read.
      const ai = r.analyzedBy === 'ai';
      // Own YouTube channel videos share the "youtube" source key — recognise them by their score.
      const ownVideo = r.platform === 'youtube' && r.official && r.relevance >= 95;
      const sc = scoreItem(
        { source: r.source, title: r.title, body: r.excerpt ?? '', viaSearch: r.source.startsWith('google') || r.platform === 'youtube', own: ownVideo },
        s, gaz, roles, ai ? r.relevance : undefined,
      );
      // An admin's manual mood correction ("manual") is never overwritten.
      const sentiment = ai || r.analyzedBy === 'manual' ? r.sentiment : ruleSentiment(r.title, r.excerpt ?? '');
      const topic = ai ? r.topic : ruleTopic(r.title, r.excerpt ?? '');
      const keywords = ai ? r.keywords : sc.keywords;
      // Telegram headlines that were only emoji / hashtags → first real line of the text.
      const title = meaningfulLine(r.title) ? r.title : (meaningfulLine(r.excerpt ?? '')?.slice(0, 300) ?? r.title);
      if (
        title !== r.title ||
        sc.relevance !== r.relevance ||
        sc.cityRelevance !== r.cityRelevance ||
        sc.regionRelevance !== r.regionRelevance ||
        keywords.join('|') !== r.keywords.join('|') ||
        sentiment !== r.sentiment ||
        topic !== r.topic
      ) {
        updates.push(
          this.prisma.mediaItem.update({
            where: { id: r.id },
            data: {
              title, relevance: sc.relevance, cityRelevance: sc.cityRelevance, regionRelevance: sc.regionRelevance,
              keywords, sentiment, topic,
            },
          }),
        );
      }
    }
    for (let i = 0; i < updates.length; i += 200) await this.prisma.$transaction(updates.slice(i, i + 200));
    if (updates.length) this.logger.log(`media rescore: ${updates.length}/${rows.length} items re-scored`);
    await this.groupStories(since);
    return updates.length;
  }

  /**
   * District mahallas (zones table, 3 spellings) + configured places, cached
   * for 6 h — the gazetteer behind "Zakovat mahallasida ..." matches.
   */
  private async loadGazetteer(s: MediaSettings): Promise<PlaceGazetteer> {
    const key = s.placeKeywords.join('|');
    if (this.gazetteer && this.gazetteer.key === key && Date.now() - this.gazetteer.at < 6 * 3_600_000) {
      return this.gazetteer.value;
    }
    const zones = await this.prisma.zone.findMany({
      where: { kind: 'MAHALLA' },
      select: { nameUzLat: true, nameUzCyr: true, nameRu: true },
    });
    const value = buildGazetteer(zones, s.placeKeywords);
    this.gazetteer = { at: Date.now(), key, value };
    return value;
  }

  /** Groups not-yet-grouped items (since `since`) into stories across outlets. */
  private async groupStories(since: Date, onlyIds?: string[]): Promise<number> {
    const freshRows = await this.prisma.mediaItem.findMany({
      where: onlyIds ? { id: { in: onlyIds } } : { publishedAt: { gte: since }, storyId: null },
      select: { id: true, title: true, publishedAt: true, storyId: true, relevance: true, official: true },
      orderBy: { publishedAt: 'asc' },
    });
    if (!freshRows.length) return 0;
    const from = new Date(freshRows[0].publishedAt.getTime() - STORY_WINDOW_MS);
    const known = await this.prisma.mediaItem.findMany({
      where: { publishedAt: { gte: from }, storyId: { not: null }, id: { notIn: freshRows.map((r) => r.id) } },
      select: { id: true, title: true, publishedAt: true, storyId: true, relevance: true, official: true },
    });
    const assignments = assignStories(freshRows as StoryCandidate[], known as StoryCandidate[]);
    const ops = assignments.map((a) =>
      this.prisma.mediaItem.update({ where: { id: a.id }, data: { storyId: a.storyId, isStoryLead: a.isStoryLead } }),
    );
    for (let i = 0; i < ops.length; i += 200) await this.prisma.$transaction(ops.slice(i, i + 200));
    const merged = assignments.filter((a) => !a.isStoryLead).length;
    if (merged) this.logger.log(`media stories: ${merged} item(s) joined an existing story`);
    return merged;
  }

  // ---------------------------------------------------------------------------
  // Run
  // ---------------------------------------------------------------------------

  /** Manual "Yangilash" — starts a run in the background; the UI polls /overview. */
  refresh(): { started: boolean; running: boolean; retryAfterSec?: number } {
    if (this.current) return { started: false, running: true };
    const since = this.lastRun ? Date.now() - new Date(this.lastRun.finishedAt).getTime() : Infinity;
    if (since < MANUAL_REFRESH_COOLDOWN_MS) {
      return { started: false, running: false, retryAfterSec: Math.ceil((MANUAL_REFRESH_COOLDOWN_MS - since) / 1000) };
    }
    void this.runOnce('manual');
    return { started: true, running: true };
  }

  /** Single-flight: a cron tick during a manual run joins it instead of doubling the load. */
  runOnce(reason: string): Promise<RunSummary> {
    if (this.current) return this.current;
    this.current = this.run(reason)
      .catch((err: unknown) => {
        this.logger.error(`media run failed: ${err instanceof Error ? err.stack : String(err)}`);
        const now = new Date().toISOString();
        return { startedAt: now, finishedAt: now, durationMs: 0, newItems: 0, negativeNew: 0, digest: false } as RunSummary;
      })
      .then((summary) => {
        this.lastRun = summary;
        return summary;
      })
      .finally(() => {
        this.current = null;
      });
    return this.current;
  }

  private async run(reason: string): Promise<RunSummary> {
    const started = Date.now();
    const now = new Date(started);
    const settings = await this.getSettings();
    if (!this.rescoredOnce) {
      this.rescoredOnce = true;
      await this.rescoreStored(settings);
    }
    const firstRun = (await this.prisma.mediaItem.count()) === 0;
    this.aiError = null;

    const results = await this.collectAll(settings, firstRun, now);
    const gazetteer = await this.loadGazetteer(settings);
    const created = await this.ingest(results, settings, now, gazetteer);
    const analyzed = await this.analyze(created, settings);
    if (created.length) await this.groupStories(now, created.map((c) => c.id));
    const relevantNew = analyzed.filter((i) => i.relevance >= settings.minRelevance);
    const negativeNew = relevantNew.filter((i) => i.sentiment === 'negative').length;
    const areas: Record<MediaArea, number> = {
      district: relevantNew.length,
      city: analyzed.filter((i) => i.cityRelevance >= settings.minRelevance).length,
      region: analyzed.filter((i) => i.regionRelevance >= settings.minRelevance).length,
    };

    const digest = await this.maybeDigest(settings, relevantNew.length > 0, now);
    await this.cleanup(now);

    const summary: RunSummary = {
      startedAt: now.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      newItems: relevantNew.length,
      negativeNew,
      digest: !!digest,
      aiError: this.aiError ?? undefined,
    };
    this.logger.log(
      `media run (${reason}): ${results.reduce((n, r) => n + r.items.length, 0)} fetched, ${created.length} stored, ` +
        `${relevantNew.length} relevant (${negativeNew} negative), city ${areas.city}, region ${areas.region}` +
        `${digest ? ', digest updated' : ''} in ${summary.durationMs} ms`,
    );
    if (relevantNew.length > 0 || areas.city > 0 || areas.region > 0 || digest) {
      const e: MediaUpdatedEvent = {
        newItems: relevantNew.length, negativeNew, areas, digestId: digest?.id ?? null, at: summary.finishedAt,
      };
      this.events.emit(MEDIA_UPDATED_EVENT, e);
    }
    return summary;
  }

  private async collectAll(s: MediaSettings, firstRun: boolean, now: Date): Promise<SourceRunResult[]> {
    const c = this.cfg;
    // Deep Telegram pass (3 pages of history + in-channel search for every
    // district spelling) on the first run and every 3 h; otherwise the newest page only.
    const deepTg = now.getTime() - this.lastTgDeepAt >= TG_DEEP_EVERY_MS - 30_000;
    if (deepTg) this.lastTgDeepAt = now.getTime();
    const tasks: (() => Promise<SourceRunResult>)[] = [
      ...s.rssFeeds.filter((f) => f.enabled).map((f) => () => collectRss(f, now)),
      // Every channel once: official > local > media, so a handle listed twice is read once.
      ...uniqueChannels(s).map(({ ch, official, local }) => () =>
        collectTelegram(ch, now, official, deepTg ? { pages: 3, queries: s.telegramSearchQueries, local } : { local }),
      ),
      ...s.govAuthorities.map((a) => () => collectGovUz(a, now)),
      () => collectGoogleNewsOfficial(s.googleNewsQuery, s.googleNewsSites, firstRun, now),
      ...uniqueYoutube(s).map(({ id, official, own }) => () => collectYoutubeChannel(id, now, { official, own })),
      () => collectGoogleNews(s.googleNewsQuery, firstRun, now),
    ];
    // Keyless YouTube search — district videos from any channel, every 30 min.
    if (now.getTime() - this.lastYtWebAt >= YT_SEARCH_EVERY_MS - 30_000) {
      this.lastYtWebAt = now.getTime();
      tasks.push(() => collectYoutubeWebSearch(s.youtubeSearchQueries, now));
    }
    // YouTube search burns 100 quota units per call — at most every 30 min.
    if (c.youtubeApiKey && now.getTime() - this.lastYtSearchAt >= YT_SEARCH_EVERY_MS - 30_000) {
      this.lastYtSearchAt = now.getTime();
      tasks.push(() => collectYoutubeSearch(c.youtubeApiKey, s.youtubeQuery, firstRun, now));
    } else if (!c.youtubeApiKey) {
      this.recordHealth({ key: 'youtube-search', name: 'YouTube qidiruv', platform: 'youtube', items: [], skipped: 'YOUTUBE_API_KEY kiritilmagan — faqat kanallar RSS' }, 0, now);
    }
    tasks.push(async () => {
      const ids = await this.loadHashtagIds();
      const before = ids.size;
      const r = await collectInstagram(
        { token: c.instagramAccessToken, businessId: c.instagramBusinessId, version: c.instagramGraphVersion },
        s,
        ids,
        now,
      );
      if (ids.size !== before) await this.saveHashtagIds(ids);
      return r;
    });

    const results = await mapLimit(tasks, 8);
    // Forget sources that were removed from the settings.
    const live = new Set(results.map((r) => r.key).concat('youtube-search', 'youtube-web'));
    for (const k of [...this.health.keys()]) if (!live.has(k)) this.health.delete(k);
    return results;
  }

  /** Keyword filter + de-duplication + insert. Returns only rows that are new. */
  private async ingest(
    results: SourceRunResult[],
    s: MediaSettings,
    now: Date,
    gazetteer: PlaceGazetteer,
  ): Promise<(MediaItem & { _text: string })[]> {
    const minDate = now.getTime() - MAX_ITEM_AGE_MS;
    const roles = sourceRoles(s);
    type Candidate = Prisma.MediaItemCreateManyInput & { _text: string };
    const candidates: Candidate[] = [];
    for (const r of results) {
      let matched = 0;
      for (const raw of r.items) {
        const c = toCandidate(raw, s, minDate, gazetteer, roles);
        if (!c) continue;
        matched++;
        candidates.push(c);
      }
      this.recordHealth(r, matched, now);
    }
    if (!candidates.length) return [];

    // Prefer an outlet's own feed over its Google News echo of the same story.
    candidates.sort((a, b) => Number(a.source === 'google') - Number(b.source === 'google'));
    const seenKey = new Set<string>();
    const seenFp = new Set<string>();
    const unique = candidates.filter((c) => {
      const k = `${c.source}|${c.externalId}`;
      if (seenKey.has(k) || (c.fingerprint && seenFp.has(c.fingerprint))) return false;
      seenKey.add(k);
      if (c.fingerprint) seenFp.add(c.fingerprint);
      return true;
    });

    const [existingKeys, existingFps] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { OR: unique.map((c) => ({ source: c.source, externalId: c.externalId })) },
        select: { source: true, externalId: true },
      }),
      this.prisma.mediaItem.findMany({
        where: {
          fingerprint: { in: unique.map((c) => c.fingerprint).filter(Boolean) },
          publishedAt: { gte: new Date(now.getTime() - 7 * 86_400_000) },
        },
        select: { fingerprint: true },
      }),
    ]);
    const known = new Set(existingKeys.map((e) => `${e.source}|${e.externalId}`));
    const knownFp = new Set(existingFps.map((e) => e.fingerprint));
    const fresh = unique.filter(
      (c) => !known.has(`${c.source}|${c.externalId}`) && !(c.fingerprint && knownFp.has(c.fingerprint)),
    );
    if (!fresh.length) return [];

    const texts = new Map(fresh.map((c) => [`${c.source}|${c.externalId}`, c._text]));
    const rows = await this.prisma.mediaItem.createManyAndReturn({
      data: fresh.map(({ _text, ...data }) => data),
      skipDuplicates: true,
    });
    return rows.map((r) => ({ ...r, _text: texts.get(`${r.source}|${r.externalId}`) ?? r.excerpt ?? '' }));
  }

  private async analyze(
    rows: (MediaItem & { _text: string })[],
    s: MediaSettings,
  ): Promise<{ id: string; relevance: number; cityRelevance: number; regionRelevance: number; sentiment: MediaSentiment }[]> {
    if (!rows.length) return [];
    const claude = this.claudeFor(s);
    const results = new Map<string, ItemAnalysis>();
    const inputs = rows.map((r) => ({ id: r.id, sourceName: r.sourceName, title: r.title, text: r._text, relevance: r.relevance }));
    const byId = new Map(rows.map((r) => [r.id, r]));
    if (claude) {
      // Claude reads district candidates only; city / region items are many and scored by rules.
      const forAi = inputs.filter((x) => x.relevance > 0);
      for (let i = 0; i < forAi.length; i += 20) {
        const chunk = forAi.slice(i, i + 20);
        try {
          const out = await analyzeWithClaude(claude, chunk);
          out.forEach((v, k) => results.set(k, v));
        } catch (err) {
          this.aiError = err instanceof Error ? err.message : String(err);
          this.logger.warn(`AI scoring failed, using rules: ${this.aiError}`);
        }
      }
    }
    for (const inp of inputs) if (!results.has(inp.id)) results.set(inp.id, analyzeByRules(inp));

    const out = inputs.map((inp) => {
      const a = results.get(inp.id)!;
      const row = byId.get(inp.id)!;
      // AI may lower relevance (the astronomer, a street) but not bury an
      // item whose TITLE carries a strong district keyword.
      const relevance = inp.relevance >= 90 ? Math.max(a.relevance, 60) : a.relevance;
      // The city view includes the district: follow the AI's district verdict.
      const cityRelevance =
        a.analyzedBy === 'ai' ? Math.max(scoreArea(row.title, row._text).city, relevance) : row.cityRelevance;
      return { id: inp.id, a, relevance, cityRelevance, regionRelevance: row.regionRelevance, sentiment: a.sentiment };
    });
    await this.prisma.$transaction(
      out.map(({ id, a, relevance, cityRelevance }) =>
        this.prisma.mediaItem.update({
          where: { id },
          data: {
            relevance,
            cityRelevance,
            sentiment: a.sentiment,
            topic: a.topic,
            aiSummary: a.analyzedBy === 'ai' ? a.summary : null,
            analyzedBy: a.analyzedBy,
          },
        }),
      ),
    );
    return out.map(({ a: _a, ...rest }) => rest);
  }

  private async maybeDigest(s: MediaSettings, hasNew: boolean, now: Date, force = false) {
    const last = await this.prisma.mediaDigest.findFirst({ orderBy: { createdAt: 'desc' } });
    const stale = !last || now.getTime() - last.createdAt.getTime() > DIGEST_MAX_AGE_MS;
    if (!force && !hasNew && !stale) return null;

    let hours = 24;
    let items = await this.digestItems(s, now, hours);
    if (items.length < 3) {
      hours = 72;
      items = await this.digestItems(s, now, hours);
    }
    let result: DigestResult;
    const claude = this.claudeFor(s);
    if (claude && items.length > 0) {
      try {
        result = await digestWithClaude(claude, items, hours);
      } catch (err) {
        this.aiError = err instanceof Error ? err.message : String(err);
        this.logger.warn(`AI digest failed, using rules: ${this.aiError}`);
        result = digestByRules(items, hours);
      }
    } else {
      result = digestByRules(items, hours);
    }
    const n = (x: MediaSentiment) => items.filter((i) => i.sentiment === x).length;
    return this.prisma.mediaDigest.create({
      data: {
        periodFrom: new Date(now.getTime() - hours * 3_600_000),
        periodTo: now,
        itemCount: items.length,
        positive: n('positive'),
        neutral: n('neutral'),
        negative: n('negative'),
        headline: result.headline,
        summary: result.summary,
        topics: result.topics as unknown as Prisma.InputJsonValue,
        risks: result.risks as unknown as Prisma.InputJsonValue,
        recommendations: result.recommendations as unknown as Prisma.InputJsonValue,
        model: result.model,
      },
    });
  }

  private async digestItems(s: MediaSettings, now: Date, hours: number, area: MediaArea = 'district'): Promise<DigestInputItem[]> {
    const rows = await this.prisma.mediaItem.findMany({
      where: {
        publishedAt: { gte: new Date(now.getTime() - hours * 3_600_000) },
        [AREA_FIELD[area]]: { gte: s.minRelevance },
        status: { not: 'hidden' },
        // One line per story in the xulosa.
        ...(area === 'district' ? {} : { isStoryLead: true }),
      },
      orderBy: [{ publishedAt: 'desc' }],
      take: 80,
    });
    return rows.map((r) => ({
      id: r.id,
      sourceName: r.sourceName,
      platform: r.platform,
      publishedAt: r.publishedAt,
      title: r.title,
      summary: r.aiSummary ?? (r.excerpt ? truncate(r.excerpt, 220) : null),
      sentiment: r.sentiment,
      topic: r.topic,
      relevance: areaRelevance(r, area),
    }));
  }

  /**
   * The city / region xulosa: written by the rules on request (not stored —
   * the stored, possibly AI-written digest is the district's).
   */
  private async areaDigest(s: MediaSettings, area: MediaArea, now: Date) {
    let hours = 24;
    let items = await this.digestItems(s, now, hours, area);
    if (items.length < 3) {
      hours = 72;
      items = await this.digestItems(s, now, hours, area);
    }
    const r = digestByRules(items, hours, AREA_NAME[area]);
    const n = (x: MediaSentiment) => items.filter((i) => i.sentiment === x).length;
    return {
      id: `area-${area}`,
      createdAt: now,
      periodFrom: new Date(now.getTime() - hours * 3_600_000),
      periodTo: now,
      itemCount: items.length,
      positive: n('positive'),
      neutral: n('neutral'),
      negative: n('negative'),
      headline: r.headline,
      summary: r.summary,
      topics: r.topics,
      risks: r.risks,
      recommendations: r.recommendations,
      model: r.model,
    };
  }

  private async cleanup(now: Date): Promise<void> {
    if (now.getTime() - this.lastCleanupAt < 86_400_000) return;
    this.lastCleanupAt = now.getTime();
    await this.prisma.mediaItem.deleteMany({
      where: { publishedAt: { lt: new Date(now.getTime() - 120 * 86_400_000) }, status: { not: 'important' } },
    });
    await this.prisma.mediaItem.deleteMany({
      where: {
        publishedAt: { lt: new Date(now.getTime() - AREA_ONLY_KEEP_MS) },
        relevance: { lt: 30 },
        status: { not: 'important' },
      },
    });
    await this.prisma.mediaDigest.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - 30 * 86_400_000) } } });
  }

  private recordHealth(r: SourceRunResult, matched: number, now: Date): void {
    const prev = this.health.get(r.key);
    const ok = r.skipped ? null : !r.error;
    this.health.set(r.key, {
      key: r.key,
      name: r.name,
      platform: r.platform,
      ok,
      error: r.error,
      skipped: r.skipped,
      fetched: r.items.length,
      matched,
      lastRunAt: now.toISOString(),
      lastSuccessAt: ok ? now.toISOString() : prev?.lastSuccessAt,
    });
  }

  private async loadHashtagIds(): Promise<Map<string, string>> {
    const row = await this.prisma.mediaSetting.findUnique({ where: { key: IG_HASHTAGS_KEY } });
    return new Map(Object.entries((row?.value as Record<string, string> | undefined) ?? {}));
  }

  private async saveHashtagIds(ids: Map<string, string>): Promise<void> {
    const value = Object.fromEntries(ids) as Prisma.InputJsonValue;
    await this.prisma.mediaSetting.upsert({
      where: { key: IG_HASHTAGS_KEY },
      create: { key: IG_HASHTAGS_KEY, value },
      update: { value },
    });
  }

  // ---------------------------------------------------------------------------
  // Read API
  // ---------------------------------------------------------------------------

  status() {
    const c = this.cfg;
    return {
      enabled: c.enabled,
      running: !!this.current,
      lastRun: this.lastRun,
      nextRunAt: c.enabled ? nextQuarterHour(new Date()).toISOString() : null,
      ai: {
        // Actually in use: key present AND switch on.
        enabled: !!c.anthropicApiKey && this.aiSwitch,
        keyConfigured: !!c.anthropicApiKey,
        switchOn: this.aiSwitch,
        model: c.anthropicApiKey && this.aiSwitch ? c.aiModel : null,
        lastError: this.lastRun?.aiError ?? null,
      },
      integrations: { youtube: !!c.youtubeApiKey, instagram: !!c.instagramAccessToken },
      sources: [...this.health.values()].sort(
        (a, b) => platformOrder(a.platform) - platformOrder(b.platform) || a.name.localeCompare(b.name),
      ),
    };
  }

  async overview(q: MediaOverviewQueryDto) {
    const s = await this.getSettings();
    const period = q.period ?? '24h';
    const area: MediaArea = q.area ?? 'district';
    const min = q.minRelevance ?? s.minRelevance;
    const now = new Date();
    const hours = period === 'all' ? 720 : PERIOD_HOURS[period];
    const from = new Date(now.getTime() - hours * 3_600_000);
    const prevFrom = new Date(from.getTime() - hours * 3_600_000);
    // ≥ 1 even for "everything": a stored item with 0 for this area belongs to another one.
    const base: Prisma.MediaItemWhereInput = { [AREA_FIELD[area]]: { gte: Math.max(1, min) }, status: { not: 'hidden' } };

    const [rows, prevTotal, digest, alerts, latest, topViewed] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { ...base, publishedAt: { gte: from } },
        select: {
          sourceName: true, source: true, platform: true, sentiment: true, topic: true, publishedAt: true, status: true,
          official: true, storyId: true, id: true,
        },
      }),
      this.prisma.mediaItem.count({ where: { ...base, publishedAt: { gte: prevFrom, lt: from } } }),
      area === 'district' ? this.prisma.mediaDigest.findFirst({ orderBy: { createdAt: 'desc' } }) : this.areaDigest(s, area, now),
      this.prisma.mediaItem.findMany({
        where: { ...base, publishedAt: { gte: from }, isStoryLead: true, OR: [{ sentiment: 'negative' }, { status: 'important' }] },
        orderBy: [{ publishedAt: 'desc' }],
        take: 40,
      }),
      this.prisma.mediaItem.findMany({ where: { ...base, publishedAt: { gte: from } }, orderBy: { publishedAt: 'desc' }, take: 6 }),
      this.prisma.mediaItem.findMany({
        where: { ...base, publishedAt: { gte: from }, views: { gt: 0 } },
        orderBy: [{ views: 'desc' }],
        take: 6,
      }),
    ]);

    // Links behind the xulosa's "Xavflar" so each risk opens its original posts.
    const riskIds = digest
      ? [...new Set(((digest.risks as { itemIds?: string[] }[] | null) ?? []).flatMap((r) => r.itemIds ?? []))].slice(0, 40)
      : [];
    const digestRefs = riskIds.length
      ? await this.prisma.mediaItem.findMany({
          where: { id: { in: riskIds } },
          select: { id: true, url: true, title: true, sourceName: true, platform: true, publishedAt: true },
        })
      : [];

    const storySize = new Map<string, number>();
    for (const r of rows) storySize.set(r.storyId ?? r.id, (storySize.get(r.storyId ?? r.id) ?? 0) + 1);
    const totals = {
      all: rows.length,
      stories: storySize.size,
      positive: 0,
      neutral: 0,
      negative: 0,
      important: 0,
      unseen: 0,
      official: 0,
      previous: prevTotal,
    };
    const platforms: Record<string, number> = { web: 0, telegram: 0, youtube: 0, instagram: 0 };
    const sources = new Map<string, { source: string; sourceName: string; platform: string; count: number; negative: number }>();
    const topics = new Map<string, { topic: string; count: number; negative: number; positive: number }>();
    for (const r of rows) {
      totals[r.sentiment]++;
      if (r.official) totals.official++;
      if (r.status === 'important') totals.important++;
      if (r.status === 'new') totals.unseen++;
      platforms[r.platform] = (platforms[r.platform] ?? 0) + 1;
      const sk = r.sourceName;
      const se = sources.get(sk) ?? { source: r.source, sourceName: r.sourceName, platform: r.platform, count: 0, negative: 0 };
      se.count++;
      if (r.sentiment === 'negative') se.negative++;
      sources.set(sk, se);
      const tk = r.topic ?? 'Boshqa';
      const te = topics.get(tk) ?? { topic: tk, count: 0, negative: 0, positive: 0 };
      te.count++;
      if (r.sentiment === 'negative') te.negative++;
      if (r.sentiment === 'positive') te.positive++;
      topics.set(tk, te);
    }

    return {
      period,
      area,
      minRelevance: min,
      totals,
      platforms,
      sources: [...sources.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      topics: [...topics.values()].sort((a, b) => b.count - a.count),
      timeline: buildTimeline(rows, from, now, hours <= 48 ? 'hour' : 'day'),
      digest,
      digestRefs,
      // "Diqqat talab qiladi", most important first (see attentionScore).
      alerts: [...alerts]
        .map((a) => ({ ...a, storySize: storySize.get(a.storyId ?? a.id) ?? 1 }))
        .sort(
          (x, y) =>
            attentionScore({ ...y, relevance: areaRelevance(y, area) }, now) -
            attentionScore({ ...x, relevance: areaRelevance(x, area) }, now),
        )
        .slice(0, 6),
      latest,
      topViewed,
      status: this.status(),
    };
  }

  async list(q: ListMediaQueryDto) {
    const s = await this.getSettings();
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const period = q.period ?? '7d';
    const area: MediaArea = q.area ?? 'district';
    const where: Prisma.MediaItemWhereInput = {
      [AREA_FIELD[area]]: { gte: Math.max(1, q.minRelevance ?? s.minRelevance) },
      status: q.status ? q.status : { not: 'hidden' },
    };
    if (period !== 'all') where.publishedAt = { gte: new Date(Date.now() - PERIOD_HOURS[period] * 3_600_000) };
    if (q.platform) where.platform = q.platform;
    if (q.sentiment) where.sentiment = q.sentiment;
    if (q.topic) where.topic = q.topic;
    if (q.source) where.source = q.source;
    if (q.kind) where.official = q.kind === 'official';
    const term = q.q?.trim();
    if (term) {
      where.OR = [
        { title: { contains: term, mode: 'insensitive' } },
        { excerpt: { contains: term, mode: 'insensitive' } },
        { aiSummary: { contains: term, mode: 'insensitive' } },
        { sourceName: { contains: term, mode: 'insensitive' } },
        { keywords: { has: term } },
      ];
    }
    // One card per story — unless the user narrows the feed (then every match counts).
    const narrowed = !!(q.platform || q.sentiment || q.topic || q.source || q.kind || term || q.status);
    const grouped = (q.group ?? 'story') === 'story' && !narrowed;
    if (grouped) where.isStoryLead = true;
    const [items, total] = await Promise.all([
      this.prisma.mediaItem.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.mediaItem.count({ where }),
    ]);
    const storyIds = items.map((i) => i.storyId).filter((x): x is string => !!x);
    const members = storyIds.length
      ? await this.prisma.mediaItem.findMany({
          where: { storyId: { in: storyIds }, id: { notIn: items.map((i) => i.id) }, status: { not: 'hidden' } },
          select: { id: true, storyId: true, sourceName: true, url: true, platform: true, official: true, publishedAt: true },
          orderBy: { publishedAt: 'asc' },
        })
      : [];
    const byStory = new Map<string, typeof members>();
    for (const m of members) byStory.set(m.storyId!, [...(byStory.get(m.storyId!) ?? []), m]);
    return {
      items: items.map((i) => {
        const also = i.storyId ? (byStory.get(i.storyId) ?? []) : [];
        return { ...i, alsoIn: also.slice(0, 8), storySize: 1 + also.length };
      }),
      total,
      page,
      limit,
      grouped,
    };
  }

  async digests(limit = 12) {
    return this.prisma.mediaDigest.findMany({ orderBy: { createdAt: 'desc' }, take: Math.min(48, Math.max(1, limit)) });
  }

  async updateItem(id: string, dto: UpdateMediaItemDto) {
    const exists = await this.prisma.mediaItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Xabar topilmadi');
    return this.prisma.mediaItem.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.sentiment ? { sentiment: dto.sentiment, analyzedBy: 'manual' } : {}),
      },
    });
  }

  async markSeen(dto: MarkSeenDto) {
    const r = await this.prisma.mediaItem.updateMany({
      where: { status: 'new', ...(dto.ids?.length ? { id: { in: dto.ids } } : {}) },
      data: { status: 'seen' },
    });
    return { updated: r.count };
  }

  /** Re-writes the xulosa now (e.g. after hiding wrong items). */
  async regenerateDigest() {
    const s = await this.getSettings();
    return this.maybeDigest(s, true, new Date(), true);
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Source-level evidence: the district's own page (95), its local channels
 * (40), city / region hokimliklar (90) and city / region channels (55).
 */
interface SourceRoles {
  own: Set<string>;
  local: Set<string>;
  city: Map<string, number>;
  region: Map<string, number>;
}

function sourceRoles(s: MediaSettings): SourceRoles {
  const tg = (c: string) => `tg:${c.toLowerCase()}`;
  const city = new Map<string, number>();
  const region = new Map<string, number>();
  const raise = (m: Map<string, number>, k: string, v: number) => m.set(k, Math.max(m.get(k) ?? 0, v));
  for (const a of s.govAuthorities) {
    if (a.area === 'city') raise(city, `gov:${a.slug}`, AREA_OWN_RELEVANCE);
    if (a.area === 'region') raise(region, `gov:${a.slug}`, AREA_OWN_RELEVANCE);
  }
  s.cityTelegramChannels.forEach((c) => raise(city, tg(c), AREA_CHANNEL_RELEVANCE));
  s.regionTelegramChannels.forEach((c) => raise(region, tg(c), AREA_CHANNEL_RELEVANCE));
  return {
    own: new Set(s.govAuthorities.filter((a) => a.own).map((a) => `gov:${a.slug}`)),
    local: new Set(s.localTelegramChannels.map(tg)),
    city,
    region,
  };
}

/**
 * All three scores of one text. The city includes the district, so a
 * district item is a city item at least as strongly. `keepRelevance` keeps an
 * AI-given district score.
 */
function scoreItem(
  x: { source: string; title: string; body: string; viaSearch?: boolean; own?: boolean; local?: boolean },
  s: MediaSettings,
  gazetteer: PlaceGazetteer,
  roles: SourceRoles,
  keepRelevance?: number,
): { relevance: number; keywords: string[]; cityRelevance: number; regionRelevance: number } {
  const res = scoreRelevance({
    title: x.title, body: x.body, keywords: s.keywords, weakKeywords: s.weakKeywords,
    excludes: s.excludes, gazetteer, viaSearch: x.viaSearch,
  });
  // The district's own hokimligi page is about the district by definition; a
  // district-local channel's posts are what its residents read.
  const relevance =
    keepRelevance ??
    (x.own || roles.own.has(x.source)
      ? Math.max(95, res.relevance)
      : x.local || roles.local.has(x.source)
        ? Math.max(LOCAL_CHANNEL_RELEVANCE, res.relevance)
        : res.relevance);
  const area = scoreArea(x.title, x.body);
  return {
    relevance,
    keywords: res.keywords,
    cityRelevance: Math.max(area.city, relevance, roles.city.get(x.source) ?? 0),
    regionRelevance: Math.max(area.region, roles.region.get(x.source) ?? 0),
  };
}

function toCandidate(
  raw: RawMediaItem,
  s: MediaSettings,
  minDate: number,
  gazetteer: PlaceGazetteer,
  roles: SourceRoles,
): (Prisma.MediaItemCreateManyInput & { _text: string }) | null {
  if (!raw.title || !raw.url || !raw.externalId) return null;
  // The district's own page posts rarely and searches reach back — keep two months of those.
  const oldest =
    raw.alwaysRelevant ? minDate - (OWN_SOURCE_MAX_AGE_MS - MAX_ITEM_AGE_MS)
    : raw.backfill ? minDate - (BACKFILL_MAX_AGE_MS - MAX_ITEM_AGE_MS)
    : minDate;
  if (raw.publishedAt.getTime() < oldest) return null;
  const sc = scoreItem(
    { source: raw.source, title: raw.title, body: raw.text, viaSearch: raw.viaSearch, own: raw.alwaysRelevant, local: raw.localChannel },
    s, gazetteer, roles,
  );
  const { relevance } = sc;
  // City / region history found by district searches is not needed; nor are faint mentions.
  const areaOnly = relevance === 0;
  if (areaOnly && (raw.backfill || Math.max(sc.cityRelevance, sc.regionRelevance) < AREA_STORE_MIN)) return null;
  return {
    source: raw.source,
    sourceName: truncate(raw.sourceName, 80),
    platform: raw.platform,
    externalId: raw.externalId.slice(0, 300),
    url: raw.url.slice(0, 1000),
    title: truncate(raw.title, 300),
    excerpt: raw.text ? truncate(raw.text, 1200) : null,
    imageUrl: raw.imageUrl?.startsWith('http') ? raw.imageUrl.slice(0, 1000) : null,
    author: raw.author ? truncate(raw.author, 120) : null,
    views: raw.views ?? null,
    publishedAt: raw.publishedAt,
    fingerprint: fingerprintOf(raw.title),
    keywords: sc.keywords,
    relevance,
    cityRelevance: sc.cityRelevance,
    regionRelevance: sc.regionRelevance,
    official: raw.official === true,
    _text: raw.text,
  };
}

/**
 * How urgently the hokimiyat should look at an item: bad news and items an
 * admin starred first, then the wider the echo (outlets, views) and the
 * fresher, the higher.
 */
function attentionScore(
  i: { sentiment: MediaSentiment; status: string; official: boolean; views: number | null; relevance: number; publishedAt: Date; storySize: number },
  now: Date,
): number {
  let s = 0;
  if (i.sentiment === 'negative') s += 40;
  if (i.status === 'important') s += 30;
  if (i.official) s += 10;
  s += Math.min(20, Math.log10((i.views ?? 0) + 1) * 4);
  s += Math.min(20, (i.storySize - 1) * 8);
  s += i.relevance / 10;
  const ageH = (now.getTime() - i.publishedAt.getTime()) / 3_600_000;
  s += ageH < 24 ? 10 : ageH < 72 ? 5 : 0;
  return s;
}

async function mapLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      out[i] = await tasks[i]();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
  return out;
}

/** Each YouTube channel once, with its strongest role (own > official > media). */
function uniqueYoutube(s: MediaSettings): { id: string; official: boolean; own: boolean }[] {
  const out = new Map<string, { id: string; official: boolean; own: boolean }>();
  const put = (id: string, official: boolean, own: boolean) => {
    const prev = out.get(id);
    out.set(id, { id, official: official || !!prev?.official, own: own || !!prev?.own });
  };
  s.youtubeChannels.forEach((c) => put(c, false, false));
  s.officialYoutubeChannels.forEach((c) => put(c, true, false));
  s.ownYoutubeChannels.forEach((c) => put(c, true, true));
  return [...out.values()];
}

/** Each Telegram handle once, with its strongest role (official > local > media). */
function uniqueChannels(s: MediaSettings): { ch: string; official: boolean; local: boolean }[] {
  const out = new Map<string, { ch: string; official: boolean; local: boolean }>();
  const put = (ch: string, official: boolean, local: boolean) => {
    const k = ch.toLowerCase();
    const prev = out.get(k);
    out.set(k, { ch, official: official || !!prev?.official, local: local || !!prev?.local });
  };
  s.telegramChannels.forEach((c) => put(c, false, false));
  s.cityTelegramChannels.forEach((c) => put(c, false, false));
  s.regionTelegramChannels.forEach((c) => put(c, false, false));
  s.localTelegramChannels.forEach((c) => put(c, false, true));
  s.officialTelegramChannels.forEach((c) => put(c, true, false));
  return [...out.values()];
}

function nextQuarterHour(d: Date): Date {
  const q = 15 * 60_000;
  return new Date(Math.floor(d.getTime() / q) * q + q);
}

function platformOrder(p: string): number {
  return ['web', 'telegram', 'youtube', 'instagram'].indexOf(p);
}

/** Hourly (≤48h) or daily (Tashkent midnight) buckets, zero-filled. */
function buildTimeline(
  rows: { publishedAt: Date; sentiment: MediaSentiment }[],
  from: Date,
  to: Date,
  unit: 'hour' | 'day',
) {
  const step = unit === 'hour' ? 3_600_000 : 86_400_000;
  const align = (t: number) => Math.floor((t + TASHKENT_OFFSET_MS) / step) * step - TASHKENT_OFFSET_MS;
  const buckets = new Map<number, { t: string; positive: number; neutral: number; negative: number }>();
  for (let t = align(from.getTime()); t <= to.getTime(); t += step) {
    buckets.set(t, { t: new Date(t).toISOString(), positive: 0, neutral: 0, negative: 0 });
  }
  for (const r of rows) {
    const b = buckets.get(align(r.publishedAt.getTime()));
    if (b) b[r.sentiment]++;
  }
  return { unit, points: [...buckets.values()] };
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** The server fetches these URLs — refuse loopback / private / link-local hosts. */
function assertPublicUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new BadRequestException(`Noto'g'ri manzil: ${raw}`);
  }
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const privateHost =
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    /^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h) ||
    h === '::1' ||
    /^f[cd][0-9a-f]{2}:/.test(h) ||
    /^fe80:/.test(h) ||
    !h.includes('.');
  if (privateHost || !/^https?:$/.test(u.protocol)) {
    throw new BadRequestException(`Ichki tarmoq manzillariga ruxsat yo'q: ${raw}`);
  }
}
