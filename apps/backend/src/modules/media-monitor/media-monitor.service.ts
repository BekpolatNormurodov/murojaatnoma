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
  analyzeWithClaude,
  digestByRules,
  digestWithClaude,
} from './media-analyzer';
import { DEFAULT_MEDIA_SETTINGS, MediaSettings, SOURCES_VERSION, cleanHandle, mergeSettings, upgradeSources } from './media-settings';
import { fingerprintOf, matchKeywords, relevanceFromMatch, truncate } from './media-text.util';

/** Emitted after every run that stored something; RealtimeGateway pushes it to admins. */
export const MEDIA_UPDATED_EVENT = 'media.updated';
export interface MediaUpdatedEvent {
  newItems: number;
  negativeNew: number;
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
    for (const list of [dto.telegramChannels, dto.officialTelegramChannels]) {
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
    return this.settingsView();
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
    const firstRun = (await this.prisma.mediaItem.count()) === 0;
    this.aiError = null;

    const results = await this.collectAll(settings, firstRun, now);
    const created = await this.ingest(results, settings, now);
    const analyzed = await this.analyze(created, settings);
    const relevantNew = analyzed.filter((i) => i.relevance >= settings.minRelevance);
    const negativeNew = relevantNew.filter((i) => i.sentiment === 'negative').length;

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
        `${relevantNew.length} relevant (${negativeNew} negative)${digest ? ', digest updated' : ''} in ${summary.durationMs} ms`,
    );
    if (relevantNew.length > 0 || digest) {
      const e: MediaUpdatedEvent = { newItems: relevantNew.length, negativeNew, digestId: digest?.id ?? null, at: summary.finishedAt };
      this.events.emit(MEDIA_UPDATED_EVENT, e);
    }
    return summary;
  }

  private async collectAll(s: MediaSettings, firstRun: boolean, now: Date): Promise<SourceRunResult[]> {
    const c = this.cfg;
    const tasks: (() => Promise<SourceRunResult>)[] = [
      ...s.rssFeeds.filter((f) => f.enabled).map((f) => () => collectRss(f, now)),
      ...s.telegramChannels
        .filter((ch) => !s.officialTelegramChannels.some((o) => o.toLowerCase() === ch.toLowerCase()))
        .map((ch) => () => collectTelegram(ch, now)),
      ...s.officialTelegramChannels.map((ch) => () => collectTelegram(ch, now, true)),
      ...s.govAuthorities.map((a) => () => collectGovUz(a, now)),
      () => collectGoogleNewsOfficial(s.googleNewsQuery, s.googleNewsSites, firstRun, now),
      ...s.youtubeChannels.map((id) => () => collectYoutubeChannel(id, now)),
      () => collectGoogleNews(s.googleNewsQuery, firstRun, now),
    ];
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
    const live = new Set(results.map((r) => r.key).concat('youtube-search'));
    for (const k of [...this.health.keys()]) if (!live.has(k)) this.health.delete(k);
    return results;
  }

  /** Keyword filter + de-duplication + insert. Returns only rows that are new. */
  private async ingest(results: SourceRunResult[], s: MediaSettings, now: Date): Promise<(MediaItem & { _text: string })[]> {
    const minDate = now.getTime() - MAX_ITEM_AGE_MS;
    type Candidate = Prisma.MediaItemCreateManyInput & { _text: string };
    const candidates: Candidate[] = [];
    for (const r of results) {
      let matched = 0;
      for (const raw of r.items) {
        const c = toCandidate(raw, s, minDate);
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
  ): Promise<{ id: string; relevance: number; sentiment: MediaSentiment }[]> {
    if (!rows.length) return [];
    const claude = this.claudeFor(s);
    const results = new Map<string, ItemAnalysis>();
    const inputs = rows.map((r) => ({ id: r.id, sourceName: r.sourceName, title: r.title, text: r._text, relevance: r.relevance }));
    if (claude) {
      for (let i = 0; i < inputs.length; i += 20) {
        const chunk = inputs.slice(i, i + 20);
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

    await this.prisma.$transaction(
      inputs.map((inp) => {
        const a = results.get(inp.id)!;
        return this.prisma.mediaItem.update({
          where: { id: inp.id },
          data: {
            // AI may lower relevance (the astronomer, a street) but not bury an
            // item whose TITLE carries a strong district keyword.
            relevance: inp.relevance >= 90 ? Math.max(a.relevance, 60) : a.relevance,
            sentiment: a.sentiment,
            topic: a.topic,
            aiSummary: a.analyzedBy === 'ai' ? a.summary : null,
            analyzedBy: a.analyzedBy,
          },
        });
      }),
    );
    return inputs.map((inp) => {
      const a = results.get(inp.id)!;
      return { id: inp.id, relevance: inp.relevance >= 90 ? Math.max(a.relevance, 60) : a.relevance, sentiment: a.sentiment };
    });
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

  private async digestItems(s: MediaSettings, now: Date, hours: number): Promise<DigestInputItem[]> {
    const rows = await this.prisma.mediaItem.findMany({
      where: {
        publishedAt: { gte: new Date(now.getTime() - hours * 3_600_000) },
        relevance: { gte: s.minRelevance },
        status: { not: 'hidden' },
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
      relevance: r.relevance,
    }));
  }

  private async cleanup(now: Date): Promise<void> {
    if (now.getTime() - this.lastCleanupAt < 86_400_000) return;
    this.lastCleanupAt = now.getTime();
    await this.prisma.mediaItem.deleteMany({
      where: { publishedAt: { lt: new Date(now.getTime() - 120 * 86_400_000) }, status: { not: 'important' } },
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
    const min = q.minRelevance ?? s.minRelevance;
    const now = new Date();
    const hours = period === 'all' ? 720 : PERIOD_HOURS[period];
    const from = new Date(now.getTime() - hours * 3_600_000);
    const prevFrom = new Date(from.getTime() - hours * 3_600_000);
    const base: Prisma.MediaItemWhereInput = { relevance: { gte: min }, status: { not: 'hidden' } };

    const [rows, prevTotal, digest, alerts, latest] = await Promise.all([
      this.prisma.mediaItem.findMany({
        where: { ...base, publishedAt: { gte: from } },
        select: { sourceName: true, source: true, platform: true, sentiment: true, topic: true, publishedAt: true, status: true, official: true },
      }),
      this.prisma.mediaItem.count({ where: { ...base, publishedAt: { gte: prevFrom, lt: from } } }),
      this.prisma.mediaDigest.findFirst({ orderBy: { createdAt: 'desc' } }),
      this.prisma.mediaItem.findMany({
        where: { ...base, publishedAt: { gte: from }, OR: [{ sentiment: 'negative' }, { status: 'important' }] },
        orderBy: [{ publishedAt: 'desc' }],
        take: 6,
      }),
      this.prisma.mediaItem.findMany({ where: { ...base, publishedAt: { gte: from } }, orderBy: { publishedAt: 'desc' }, take: 6 }),
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

    const totals = { all: rows.length, positive: 0, neutral: 0, negative: 0, important: 0, unseen: 0, official: 0, previous: prevTotal };
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
      minRelevance: min,
      totals,
      platforms,
      sources: [...sources.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      topics: [...topics.values()].sort((a, b) => b.count - a.count),
      timeline: buildTimeline(rows, from, now, hours <= 48 ? 'hour' : 'day'),
      digest,
      digestRefs,
      alerts,
      latest,
      status: this.status(),
    };
  }

  async list(q: ListMediaQueryDto) {
    const s = await this.getSettings();
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const period = q.period ?? '7d';
    const where: Prisma.MediaItemWhereInput = {
      relevance: { gte: q.minRelevance ?? s.minRelevance },
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
    const [items, total] = await Promise.all([
      this.prisma.mediaItem.findMany({ where, orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit }),
      this.prisma.mediaItem.count({ where }),
    ]);
    return { items, total, page, limit };
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
        ...(dto.sentiment ? { sentiment: dto.sentiment } : {}),
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

function toCandidate(
  raw: RawMediaItem,
  s: MediaSettings,
  minDate: number,
): (Prisma.MediaItemCreateManyInput & { _text: string }) | null {
  if (!raw.title || !raw.url || !raw.externalId) return null;
  // The district's own page posts rarely — keep two months of it for context.
  const oldest = raw.alwaysRelevant ? minDate - (OWN_SOURCE_MAX_AGE_MS - MAX_ITEM_AGE_MS) : minDate;
  if (raw.publishedAt.getTime() < oldest) return null;
  const m = matchKeywords(raw.title, raw.text, s.keywords, s.weakKeywords, s.excludes);
  // The district's own hokimligi page is about the district by definition.
  const relevance = raw.alwaysRelevant ? Math.max(95, relevanceFromMatch(m, false)) : relevanceFromMatch(m, !!raw.viaSearch);
  if (relevance === 0) return null;
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
    keywords: [...m.strong, ...m.weak],
    relevance,
    official: raw.official === true,
    _text: raw.text,
  };
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
