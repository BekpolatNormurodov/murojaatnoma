import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDown2,
  Category,
  CloseCircle,
  DocumentText,
  EmojiHappy,
  Eye,
  FilterSearch,
  MagicStar,
  Notification,
  Radar,
  Refresh2,
  SearchNormal1,
  Setting2,
  ShieldTick,
  Star1,
  TickSquare,
  TrendDown,
  TrendUp,
  Warning2,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { usePermissions } from '@/shared/lib/permissions';
import {
  type MediaFilters,
  type MediaItem,
  type MediaOverview,
  type MediaPeriod,
  type MediaPlatform,
  type MediaSentiment,
  type MediaStatus,
  type MediaStatusInfo,
  useMarkAllSeen,
  useMediaItems,
  useMediaLive,
  useMediaOverview,
  useRefreshMedia,
  useRegenerateDigest,
  useUpdateMediaItem,
} from './api';
import { MediaDigestCard } from './MediaDigestCard';
import { MediaItemCard } from './MediaItemCard';
import { MediaSettingsModal, type SettingsTab } from './MediaSettingsModal';
import { SourceLogo } from './MediaIcons';
import { PLATFORMS, PLATFORM_META, SENTIMENTS, SENTIMENT_META, clock, dayKey, dayLabel, shortTime } from './meta';

const PERIODS: { key: Exclude<MediaPeriod, 'all'>; label: string }[] = [
  { key: '24h', label: '24 soat' },
  { key: '7d', label: '7 kun' },
  { key: '30d', label: '30 kun' },
];

const STATUS_OPTIONS: { key: MediaStatus | ''; label: string }[] = [
  { key: '', label: 'Barcha holatlar' },
  { key: 'new', label: "Ko'rilmagan" },
  { key: 'important', label: 'Muhim' },
  { key: 'seen', label: "Ko'rilgan" },
  { key: 'hidden', label: 'Yashirilgan' },
];

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'warn';
}

export function MediaPage() {
  const { canWrite, isSuperAdmin } = usePermissions();
  const [period, setPeriod] = useState<Exclude<MediaPeriod, 'all'>>('7d');
  const [platform, setPlatform] = useState<MediaPlatform | undefined>();
  const [sentiment, setSentiment] = useState<MediaSentiment | undefined>();
  const [status, setStatus] = useState<MediaStatus | ''>('');
  const [topic, setTopic] = useState<string | undefined>();
  const [source, setSource] = useState<{ key: string; name: string } | undefined>();
  const [lowRelevance, setLowRelevance] = useState(false);
  const [kind, setKind] = useState<'official' | 'media' | undefined>();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState<false | SettingsTab>(false);
  const now = useNow(60_000);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Debounced search; "/" focuses the box from anywhere on the page.
  useEffect(() => {
    const h = window.setTimeout(() => setSearch(searchText.trim()), 350);
    return () => window.clearTimeout(h);
  }, [searchText]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/input|textarea|select/i.test(el.tagName) && !el.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useMediaLive(
    useCallback(
      (e: { newItems: number; negativeNew: number }) => {
        if (e.newItems > 0) {
          toast(
            e.negativeNew > 0
              ? `${e.newItems} ta yangi xabar, ${e.negativeNew} tasi salbiy`
              : `${e.newItems} ta yangi xabar topildi`,
            e.negativeNew > 0 ? 'warn' : 'ok',
          );
        }
      },
      [toast],
    ),
  );

  const overviewQ = useMediaOverview(period);
  const ov = overviewQ.data;
  const filters: MediaFilters = {
    period,
    platform,
    sentiment,
    status: status || undefined,
    topic,
    source: source?.key,
    q: search || undefined,
    minRelevance: lowRelevance ? 0 : undefined,
    kind,
  };
  const itemsQ = useMediaItems(filters);
  const items = useMemo(() => itemsQ.data?.pages.flatMap((p) => p.items) ?? [], [itemsQ.data]);
  const total = itemsQ.data?.pages[0]?.total ?? 0;

  const refresh = useRefreshMedia();
  const regenerate = useRegenerateDigest();
  const update = useUpdateMediaItem();
  const markAll = useMarkAllSeen();

  const running = !!ov?.status.running || refresh.isPending;
  const failedSources = ov?.status.sources.filter((x) => x.ok === false).length ?? 0;
  // Newest first, split by local day ("Bugun", "Kecha", "29-sentabr ...").
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: MediaItem[] }[] = [];
    for (const it of items) {
      const k = dayKey(it.publishedAt);
      const last = out[out.length - 1];
      if (last && last.key === k) last.items.push(it);
      else out.push({ key: k, label: dayLabel(it.publishedAt, new Date(now)), items: [it] });
    }
    return out;
  }, [items, now]);
  const activeFilters =
    (kind ? 1 : 0) + (platform ? 1 : 0) + (sentiment ? 1 : 0) + (status ? 1 : 0) + (topic ? 1 : 0) + (source ? 1 : 0) + (lowRelevance ? 1 : 0) + (search ? 1 : 0);

  function clearFilters() {
    setPlatform(undefined);
    setSentiment(undefined);
    setStatus('');
    setTopic(undefined);
    setSource(undefined);
    setLowRelevance(false);
    setKind(undefined);
    setSearchText('');
    setSearch('');
  }

  function scrollToFeed() {
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function onRefresh() {
    try {
      const r = await refresh.mutateAsync();
      if (r.started) toast("Yangilash boshlandi — manbalar o'qilmoqda");
      else if (r.running) toast('Yangilash allaqachon ketmoqda');
      else toast(`Hozirgina yangilandi. ${r.retryAfterSec ?? 60} soniyadan keyin qayta urinib ko'ring`, 'warn');
    } catch (e) {
      toast(e instanceof Error ? e.message : "Yangilab bo'lmadi", 'warn');
    }
  }

  const onStatus = useCallback(
    (id: string, s: MediaStatus) =>
      update.mutate(
        { id, status: s },
        {
          onSuccess: () =>
            toast(s === 'important' ? "Muhimlar ro'yxatiga qo'shildi" : s === 'hidden' ? 'Yashirildi — xulosaga kirmaydi' : 'Saqlandi'),
          onError: (e) => toast(e instanceof Error ? e.message : 'Xatolik', 'warn'),
        },
      ),
    [update, toast],
  );
  const onSentiment = useCallback(
    (id: string, s: MediaSentiment) =>
      update.mutate(
        { id, sentiment: s },
        {
          onSuccess: () => toast(`Baholash o'zgartirildi: ${SENTIMENT_META[s].label}`),
          onError: (e) => toast(e instanceof Error ? e.message : 'Xatolik', 'warn'),
        },
      ),
    [update, toast],
  );
  const onOpen = useCallback(
    (item: MediaItem) => {
      if (canWrite && item.status === 'new') update.mutate({ id: item.id, status: 'seen' });
    },
    [canWrite, update],
  );
  const onTopic = useCallback((t: string) => {
    setTopic(t);
    scrollToFeed();
  }, []);

  return (
    <div className="isolate">
      <PageHeader
        title="OAV monitoringi"
        subtitle="Saytlar, Telegram, YouTube va Instagram'da tuman haqidagi xabarlar — har 15 daqiqada avtomatik yig'iladi"
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <LiveStatus status={ov?.status} running={running} />
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => setSettingsOpen(failedSources > 0 ? 'status' : 'keywords')}
                aria-label={failedSources > 0 ? `Sozlamalar — ${failedSources} ta manbada xato` : 'Sozlamalar'}
                title={failedSources > 0 ? `${failedSources} ta manbada xato — «Holat» bo'limida` : 'Kalit so\'zlar, manbalar, holat va integratsiyalar'}
                className="relative"
              >
                <Setting2 size={17} /> <span className="hidden sm:inline">Sozlamalar</span>
                {failedSources > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-surface">
                    {failedSources}
                  </span>
                )}
              </Button>
              <Button onClick={onRefresh} disabled={running} className="flex-1 sm:flex-none">
                <Refresh2 size={17} className={running ? 'animate-spin' : undefined} />
                {running ? 'Yangilanmoqda…' : 'Yangilash'}
              </Button>
            </div>
          </div>
        }
      />

      {/* Period */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Davr" className="inline-flex rounded-xl border border-line bg-surface p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => setPeriod(p.key)}
              className={cn(
                'h-8 rounded-lg px-3.5 text-[13px] font-medium transition-colors',
                period === p.key ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-soft hover:text-ink',
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {ov?.status.ai.lastError && (
          <button
            type="button"
            onClick={() => setSettingsOpen('keys')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
            title={ov.status.ai.lastError}
          >
            <Warning2 size={15} /> AI ishlamadi — avtomatik tahlil ishlatildi
          </button>
        )}
      </div>

      <HowItWorks sourceCount={ov?.status.sources.length} />

      {overviewQ.isError && !ov ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Warning2 size={36} variant="Bulk" className="text-danger" />
          <p className="font-semibold text-ink">Monitoring ma'lumotlarini yuklab bo'lmadi</p>
          <p className="text-sm text-ink-muted">{overviewQ.error instanceof Error ? overviewQ.error.message : ''}</p>
          <Button variant="secondary" onClick={() => overviewQ.refetch()}>
            <Refresh2 size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <Kpi
              label="Jami xabarlar"
              value={ov?.totals.all}
              icon={<DocumentText size={20} variant="Bulk" />}
              tint="bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"
              delta={ov ? deltaPct(ov.totals.all, ov.totals.previous) : undefined}
              hint={ov && ov.totals.official > 0 ? `${ov.totals.official} tasi rasmiy manbadan` : 'oldingi davrga nisbatan'}
              onClick={() => {
                clearFilters();
                scrollToFeed();
              }}
            />
            <Kpi
              label="Salbiy"
              value={ov?.totals.negative}
              icon={<SENTIMENT_META.negative.Icon size={20} variant="Bulk" />}
              tint="bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"
              share={ov ? share(ov.totals.negative, ov.totals.all) : undefined}
              active={sentiment === 'negative'}
              onClick={() => {
                setSentiment(sentiment === 'negative' ? undefined : 'negative');
                scrollToFeed();
              }}
            />
            <Kpi
              label="Ijobiy"
              value={ov?.totals.positive}
              icon={<SENTIMENT_META.positive.Icon size={20} variant="Bulk" />}
              tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
              share={ov ? share(ov.totals.positive, ov.totals.all) : undefined}
              active={sentiment === 'positive'}
              onClick={() => {
                setSentiment(sentiment === 'positive' ? undefined : 'positive');
                scrollToFeed();
              }}
            />
            <Kpi
              label="Ko'rilmagan"
              value={ov?.totals.unseen}
              icon={<Notification size={20} variant="Bulk" />}
              tint="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
              hint={ov?.totals.important ? `${ov.totals.important} ta muhim` : undefined}
              active={status === 'new'}
              onClick={() => {
                setStatus(status === 'new' ? '' : 'new');
                scrollToFeed();
              }}
            />
          </div>

          {/* Digest + platforms */}
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <MediaDigestCard
                digest={ov?.digest ?? null}
                refs={ov?.digestRefs ?? []}
                loading={overviewQ.isLoading}
                canWrite={canWrite}
                regenerating={regenerate.isPending}
                onRegenerate={() =>
                  regenerate.mutate(undefined, {
                    onSuccess: () => toast('Xulosa yangilandi'),
                    onError: (e) => toast(e instanceof Error ? e.message : 'Xatolik', 'warn'),
                  })
                }
              />
            </div>
            <PlatformCard
              ov={ov}
              active={platform}
              onPick={(p) => {
                setPlatform(platform === p ? undefined : p);
                scrollToFeed();
              }}
            />
          </div>
        </>
      )}

      {/* Feed */}
      <div ref={feedRef} className="mt-5 grid scroll-mt-20 grid-cols-1 gap-5 xl:grid-cols-3">
        <section className="min-w-0 xl:col-span-2" aria-label="Xabarlar lentasi">
          <Card className="p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-[17px] font-bold tracking-tight text-ink">Eng yangi xabarlar</h2>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Eng so'nggisi tepada · vaqt Toshkent bo'yicha
                  {ov?.status.lastRun && <> · {clock(ov.status.lastRun.finishedAt)} da yangilandi</>}
                </p>
              </div>
            </div>

            {/* Who is speaking: state bodies vs the press */}
            <div role="tablist" aria-label="Manba turi" className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-surface-2 p-1">
              {(
                [
                  { key: undefined, label: 'Hammasi', short: 'Hammasi', icon: <Category size={16} />, n: ov?.totals.all },
                  { key: 'official', label: 'Rasmiy manbalar', short: 'Rasmiy', icon: <ShieldTick size={16} variant="Bold" />, n: ov?.totals.official },
                  { key: 'media', label: 'OAV va tarmoqlar', short: 'OAV', icon: <DocumentText size={16} />, n: ov ? ov.totals.all - ov.totals.official : undefined },
                ] as const
              ).map((t) => (
                <button
                  key={t.label}
                  role="tab"
                  aria-selected={kind === t.key}
                  onClick={() => setKind(t.key)}
                  className={cn(
                    'flex h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-medium transition-colors',
                    kind === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
                    t.key === 'official' && kind === t.key && 'text-accent-700 dark:text-accent-300',
                  )}
                >
                  {t.icon}
                  <span className="truncate sm:hidden">{t.short}</span>
                  <span className="hidden truncate sm:inline">{t.label}</span>
                  <Count n={t.n} />
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <SearchNormal1 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                ref={searchRef}
                type="search"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Sarlavha, matn, manba yoki kalit so'z bo'yicha qidirish…"
                aria-label="Xabarlarni qidirish"
                className="h-11 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-20 text-sm text-ink outline-none transition placeholder:text-ink-muted focus:border-primary-400 focus:bg-surface focus:ring-2 focus:ring-primary-100 dark:focus:ring-primary-500/20 [&::-webkit-search-cancel-button]:hidden"
              />
              <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                {searchText ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchText('');
                      setSearch('');
                      searchRef.current?.focus();
                    }}
                    aria-label="Qidiruvni tozalash"
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-line hover:text-ink"
                  >
                    <CloseCircle size={18} />
                  </button>
                ) : (
                  <kbd className="hidden rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] font-medium text-ink-muted sm:block">/</kbd>
                )}
              </div>
            </div>

            {/* Platform chips */}
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Platforma">
              <Chip active={!platform} onClick={() => setPlatform(undefined)} icon={<Category size={15} variant={!platform ? 'Bold' : 'Linear'} />}>
                Hammasi
                <Count n={ov?.totals.all} />
              </Chip>
              {PLATFORMS.map((p) => {
                const m = PLATFORM_META[p];
                return (
                  <Chip
                    key={p}
                    active={platform === p}
                    onClick={() => setPlatform(platform === p ? undefined : p)}
                    icon={
                      <span style={{ color: platform === p ? undefined : m.color }}>
                        <m.Icon size={15} />
                      </span>
                    }
                  >
                    {m.label}
                    <Count n={ov?.platforms[p]} />
                  </Chip>
                );
              })}
            </div>

            {/* Sentiment + advanced */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {SENTIMENTS.map((s) => {
                const m = SENTIMENT_META[s];
                const on = sentiment === s;
                return (
                  <Chip
                    key={s}
                    active={on}
                    tone={s}
                    onClick={() => setSentiment(on ? undefined : s)}
                    icon={<m.Icon size={15} variant="Bold" color={on ? 'currentColor' : m.color} />}
                  >
                    {m.label}
                    <Count n={ov?.totals[s]} />
                  </Chip>
                );
              })}
              <Select
                value={status}
                onChange={(v) => setStatus(v as MediaStatus | '')}
                options={STATUS_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                label="Holat"
              />
              <label
                className="inline-flex h-9 cursor-pointer select-none items-center gap-2 rounded-xl px-2.5 text-[13px] text-ink-soft hover:bg-surface-2"
                title="Tumanga tegishliligi aniq bo'lmagan xabarlarni ham ko'rsatish (masalan, faqat «Mirzo Ulug'bek» deb yozilgan — olim, ko'cha yoki metro bo'lishi mumkin)"
              >
                <input
                  type="checkbox"
                  checked={lowRelevance}
                  onChange={(e) => setLowRelevance(e.target.checked)}
                  className="h-4 w-4 rounded accent-primary-600"
                />
                Aniq bo'lmaganlar ham
              </label>
            </div>

            {/* Active filters summary */}
            {(topic || source || activeFilters > 0) && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-3">
                <FilterSearch size={16} className="text-ink-muted" />
                {topic && <ActiveTag onClear={() => setTopic(undefined)}>Mavzu: {topic}</ActiveTag>}
                {source && <ActiveTag onClear={() => setSource(undefined)}>Manba: {source.name}</ActiveTag>}
                {search && (
                  <ActiveTag
                    onClear={() => {
                      setSearchText('');
                      setSearch('');
                    }}
                  >
                    «{search}»
                  </ActiveTag>
                )}
                {activeFilters > 0 && (
                  <button type="button" onClick={clearFilters} className="ml-auto text-[13px] font-medium text-primary-700 hover:underline dark:text-primary-300">
                    Filtrlarni tozalash
                  </button>
                )}
              </div>
            )}

            {/* Result header */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="text-[13px] text-ink-soft" aria-live="polite">
                {itemsQ.isLoading ? 'Yuklanmoqda…' : <><b className="font-semibold text-ink tabular-nums">{total}</b> ta xabar</>}
                {itemsQ.isFetching && !itemsQ.isLoading && <span className="ml-2 text-ink-muted">yangilanmoqda…</span>}
              </p>
              {canWrite && (ov?.totals.unseen ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => markAll.mutate(undefined, { onSuccess: (r) => toast(`${r.updated} ta xabar ko'rildi deb belgilandi`) })}
                  disabled={markAll.isPending}
                  className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-60"
                >
                  <TickSquare size={16} /> Hammasini ko'rildi
                </button>
              )}
            </div>

            {/* List */}
            <div className="mt-3 space-y-3">
              {itemsQ.isLoading ? (
                Array.from({ length: 4 }).map((_, i) => <FeedSkeleton key={i} />)
              ) : items.length === 0 ? (
                <EmptyFeed
                  filtered={activeFilters > 0}
                  period={period}
                  onClear={clearFilters}
                  onWiden={() => setPeriod('30d')}
                  onLow={() => setLowRelevance(true)}
                  lowRelevance={lowRelevance}
                />
              ) : (
                groups.map((g) => (
                  <Fragment key={g.key}>
                    <div className="flex items-center gap-3 pt-1 first:pt-0">
                      <span className={cn('text-xs font-bold uppercase tracking-wide', g.label === 'Bugun' ? 'text-primary-700 dark:text-primary-300' : 'text-ink-muted')}>
                        {g.label}
                      </span>
                      <span className="h-px flex-1 bg-line" />
                      <span className="text-[11px] tabular-nums text-ink-muted">{g.items.length} ta</span>
                    </div>
                    {g.items.map((it) => (
                      <motion.div key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                        <MediaItemCard
                          item={it}
                          search={search}
                          canWrite={canWrite}
                          onStatus={onStatus}
                          onSentiment={onSentiment}
                          onOpen={onOpen}
                          onTopic={onTopic}
                          now={now}
                        />
                      </motion.div>
                    ))}
                  </Fragment>
                ))
              )}
            </div>

            {itemsQ.hasNextPage && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => itemsQ.fetchNextPage()} disabled={itemsQ.isFetchingNextPage}>
                  <ArrowDown2 size={16} />
                  {itemsQ.isFetchingNextPage ? 'Yuklanmoqda…' : `Yana ko'rsatish (${total - items.length})`}
                </Button>
              </div>
            )}
          </Card>
        </section>

        {/* Side: analytics only (configuration lives in Sozlamalar) */}
        <aside className="min-w-0 space-y-5">
          <TimelineCard ov={ov} loading={overviewQ.isLoading} />
          <TopicsCard
            ov={ov}
            active={topic}
            onPick={(t) => {
              setTopic(topic === t ? undefined : t);
              scrollToFeed();
            }}
          />
          <TopSourcesCard
            ov={ov}
            active={source?.key}
            onPick={(s) => {
              setSource(source?.key === s.key ? undefined : s);
              scrollToFeed();
            }}
          />
        </aside>
      </div>

      <MediaSettingsModal
        open={!!settingsOpen}
        initialTab={settingsOpen || 'keywords'}
        onClose={() => setSettingsOpen(false)}
        canEdit={isSuperAdmin}
      />

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              className={cn(
                'pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-[13px] font-medium shadow-pop',
                t.tone === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-200'
                  : 'border-line bg-surface text-ink',
              )}
            >
              {t.tone === 'warn' ? <Warning2 size={18} className="shrink-0 text-amber-500" /> : <Eye size={18} className="shrink-0 text-primary-600" />}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Current time, re-read every `ms` (relative times stay true). */
function useNow(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const h = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(h);
  }, [ms]);
  return now;
}

const HOWTO_KEY = 'media-howto-hidden';

/** One-line explainer of the pipeline; dismissible (remembered per browser). */
function HowItWorks({ sourceCount }: { sourceCount?: number }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(HOWTO_KEY) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;
  const steps = [
    { icon: <Radar size={18} variant="Bulk" />, title: `${sourceCount ?? '40'}+ manba`, text: "Davlat saytlari, OAV, Telegram, YouTube har 15 daqiqada o'qiladi" },
    { icon: <FilterSearch size={18} variant="Bulk" />, title: 'Tumanga oidi ajratiladi', text: "«Mirzo Ulug'bek tumani» haqidagilar qoladi, boshqalari tashlanadi" },
    { icon: <EmojiHappy size={18} variant="Bulk" />, title: 'Baholanadi', text: 'Har bir xabar: ijobiy, neytral yoki salbiy va mavzusi' },
    { icon: <MagicStar size={18} variant="Bulk" />, title: 'Xulosa yoziladi', text: "Asosiysi, xavflar va tavsiyalar — bir qarashda" },
  ];
  return (
    <section aria-label="Qanday ishlaydi" className="relative mb-5 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          try {
            localStorage.setItem(HOWTO_KEY, '1');
          } catch {
            /* private mode */
          }
        }}
        aria-label="Yopish"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
      >
        <CloseCircle size={18} />
      </button>
      <p className="mb-3 pr-8 text-[13px] font-semibold text-ink">Qanday ishlaydi?</p>
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((st, i) => (
          <li key={st.title} className="flex items-start gap-3">
            <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              {st.icon}
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] font-bold text-white">
                {i + 1}
              </span>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">{st.title}</p>
              <p className="text-xs leading-relaxed text-ink-muted">{st.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function deltaPct(cur: number, prev: number): number | undefined {
  if (prev === 0) return cur > 0 ? 100 : undefined;
  return Math.round(((cur - prev) / prev) * 100);
}
function share(n: number, total: number): number | undefined {
  return total > 0 ? Math.round((n / total) * 100) : undefined;
}

function LiveStatus({ status, running }: { status?: MediaStatusInfo; running: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const h = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(h);
  }, []);
  const last = status?.lastRun?.finishedAt;
  return (
    <div className="flex h-10 min-w-0 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-ink-soft">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        {(running || status?.enabled) && (
          <span className={cn('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60', running ? 'bg-amber-400' : 'bg-emerald-400')} />
        )}
        <span className={cn('relative inline-flex h-2.5 w-2.5 rounded-full', running ? 'bg-amber-500' : status?.enabled ? 'bg-emerald-500' : 'bg-slate-400')} />
      </span>
      {running ? (
        <span className="font-medium text-ink">Manbalar o'qilmoqda…</span>
      ) : (
        <span className="truncate">
          <span className="font-medium text-ink">{status?.enabled === false ? "O'chirilgan" : 'Jonli'}</span>
          {last && <> · {timeAgo(last)}</>}
          {status?.nextRunAt && <span className="hidden md:inline"> · keyingisi {shortTime(status.nextRunAt)}</span>}
        </span>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tint,
  delta,
  share: sharePct,
  hint,
  active,
  onClick,
}: {
  label: string;
  value?: number;
  icon: React.ReactNode;
  tint: string;
  delta?: number;
  share?: number;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group rounded-2xl border bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-200 focus-visible:ring-2 focus-visible:ring-primary-300 sm:p-5',
        active ? 'border-primary-400 ring-2 ring-primary-100 dark:ring-primary-500/20' : 'border-line',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', tint)}>{icon}</span>
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
              delta >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' : 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
            )}
          >
            {delta >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        {sharePct !== undefined && <span className="text-xs font-semibold tabular-nums text-ink-muted">{sharePct}%</span>}
      </div>
      <p className="mt-3 text-[26px] font-bold leading-none tracking-tight text-ink tabular-nums sm:text-[28px]">
        {value === undefined ? <span className="inline-block h-7 w-12 animate-pulse rounded-lg bg-surface-2 align-middle" /> : value}
      </p>
      <p className="mt-1.5 truncate text-[13px] text-ink-soft">
        {label}
        {hint && <span className="text-ink-muted"> · {hint}</span>}
      </p>
    </button>
  );
}

function PlatformCard({ ov, active, onPick }: { ov?: MediaOverview; active?: MediaPlatform; onPick: (p: MediaPlatform) => void }) {
  const total = ov ? Math.max(1, ov.totals.all) : 1;
  return (
    <Card>
      <CardHeader title="Platformalar" subtitle="Xabarlar qayerda chiqmoqda" />
      <div className="space-y-1 p-3 sm:p-4">
        {PLATFORMS.map((p) => {
          const m = PLATFORM_META[p];
          const n = ov?.platforms[p] ?? 0;
          const pct = Math.round((n / total) * 100);
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPick(p)}
              aria-pressed={active === p}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-2',
                active === p && 'bg-surface-2 ring-1 ring-primary-300',
              )}
            >
              <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', m.tile)}>
                <m.Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{m.label}</span>
                  <span className="text-[13px] font-bold tabular-nums text-ink">{ov ? n : '—'}</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: m.color }} />
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function TimelineCard({ ov, loading }: { ov?: MediaOverview; loading: boolean }) {
  const points = ov?.timeline.points ?? [];
  const hourly = ov?.timeline.unit === 'hour';
  const data = points.map((p) => {
    const d = new Date(p.t);
    return {
      ...p,
      label: hourly ? `${String(d.getHours()).padStart(2, '0')}:00` : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`,
    };
  });
  const peak = data.reduce((m, p) => Math.max(m, p.positive + p.neutral + p.negative), 0);
  return (
    <Card>
      <CardHeader
        title="Dinamika"
        subtitle={hourly ? "Soatlar bo'yicha, kayfiyat kesimida" : "Kunlar bo'yicha, kayfiyat kesimida"}
      />
      <div className="flex flex-wrap items-center gap-3 px-5 pt-3 text-xs">
        {SENTIMENTS.map((s) => (
          <span key={s} className="flex items-center gap-1.5 text-ink-soft">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: SENTIMENT_META[s].color }} />
            {SENTIMENT_META[s].label}
          </span>
        ))}
      </div>
      <div className="h-56 px-2 pb-3 pt-3">
        {loading && !ov ? (
          <div className="mx-3 h-full animate-pulse rounded-xl bg-surface-2" />
        ) : peak === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
            <DocumentText size={30} variant="Bulk" />
            Bu davrda xabar yo'q
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 4, right: 12, left: -18, bottom: 0 }} barCategoryGap="22%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={<TimelineTooltip />} cursor={{ fill: 'var(--color-surface-2)' }} />
              {/* Stacked bottom→top: salbiy, neytral, ijobiy — each segment is its exact count. */}
              {(['negative', 'neutral', 'positive'] as const).map((s, i, arr) => (
                <Bar
                  key={s}
                  dataKey={s}
                  name={SENTIMENT_META[s].label}
                  stackId="1"
                  fill={SENTIMENT_META[s].color}
                  maxBarSize={28}
                  radius={i === arr.length - 1 ? [5, 5, 0, 0] : 0}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {ov && (
        <p className="sr-only">
          Davr bo'yicha: {ov.totals.negative} salbiy, {ov.totals.neutral} neytral, {ov.totals.positive} ijobiy xabar.
        </p>
      )}
    </Card>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TimelineTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const sum = payload.reduce((n: number, p: { value: number }) => n + (p.value ?? 0), 0);
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="mb-1 font-semibold text-ink">
        {label} · {sum} ta
      </p>
      {[...payload].reverse().map((p: { dataKey: MediaSentiment; value: number }) => (
        <p key={p.dataKey} className="flex items-center gap-1.5 text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: SENTIMENT_META[p.dataKey].color }} />
          {SENTIMENT_META[p.dataKey].label}: <b className="text-ink">{p.value}</b>
        </p>
      ))}
    </div>
  );
}

function TopicsCard({ ov, active, onPick }: { ov?: MediaOverview; active?: string; onPick: (t: string) => void }) {
  const topics = ov?.topics.slice(0, 8) ?? [];
  const max = Math.max(1, ...topics.map((t) => t.count));
  return (
    <Card>
      <CardHeader title="Mavzular" subtitle="Nima haqida yozishmoqda" />
      <div className="space-y-1 p-3 sm:p-4">
        {!ov ? (
          Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-xl bg-surface-2" />)
        ) : topics.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Hali mavzu yo'q</p>
        ) : (
          topics.map((t) => {
            const neutral = t.count - t.negative - t.positive;
            return (
              <button
                key={t.topic}
                type="button"
                onClick={() => onPick(t.topic)}
                aria-pressed={active === t.topic}
                className={cn(
                  'w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2',
                  active === t.topic && 'bg-surface-2 ring-1 ring-primary-300',
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink">{t.topic}</span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-soft">
                    {t.negative > 0 && <span className="mr-1.5 font-semibold text-red-600 dark:text-red-400">{t.negative} salbiy</span>}
                    <b className="text-ink">{t.count}</b>
                  </span>
                </div>
                <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2" style={{ width: `${Math.max(8, (t.count / max) * 100)}%` }}>
                  <span style={{ width: `${(t.negative / t.count) * 100}%`, background: SENTIMENT_META.negative.color }} />
                  <span style={{ width: `${(neutral / t.count) * 100}%`, background: SENTIMENT_META.neutral.color }} />
                  <span style={{ width: `${(t.positive / t.count) * 100}%`, background: SENTIMENT_META.positive.color }} />
                </div>
              </button>
            );
          })
        )}
      </div>
    </Card>
  );
}

function TopSourcesCard({
  ov,
  active,
  onPick,
}: {
  ov?: MediaOverview;
  active?: string;
  onPick: (s: { key: string; name: string }) => void;
}) {
  const list = ov?.sources ?? [];
  return (
    <Card>
      <CardHeader title="Faol manbalar" subtitle="Eng ko'p yozayotganlar" />
      <ul className="p-3 sm:p-4">
        {!ov ? (
          Array.from({ length: 4 }).map((_, i) => <li key={i} className="mb-1 h-11 animate-pulse rounded-xl bg-surface-2" />)
        ) : list.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-muted">Bu davrda manba yo'q</li>
        ) : (
          list.map((s) => (
            <li key={s.sourceName}>
              <button
                type="button"
                onClick={() => onPick({ key: s.source, name: s.sourceName })}
                aria-pressed={active === s.source}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2',
                  active === s.source && 'bg-surface-2 ring-1 ring-primary-300',
                )}
              >
                <SourceLogo item={{ url: '', sourceName: s.sourceName, platform: s.platform }} size={28} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{s.sourceName}</span>
                {s.negative > 0 && (
                  <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-500/15 dark:text-red-300">
                    {s.negative}
                  </span>
                )}
                <span className="w-6 text-right text-[13px] font-bold tabular-nums text-ink">{s.count}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

function Chip({
  active,
  onClick,
  icon,
  tone,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  tone?: MediaSentiment;
  children: React.ReactNode;
}) {
  const activeCls =
    tone === 'negative'
      ? 'bg-red-600 text-white border-red-600'
      : tone === 'positive'
        ? 'bg-emerald-600 text-white border-emerald-600'
        : tone === 'neutral'
          ? 'bg-slate-600 text-white border-slate-600'
          : 'bg-ink text-surface border-ink dark:bg-primary-600 dark:text-white dark:border-primary-600';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition-colors',
        active ? activeCls : 'border-line bg-surface text-ink-soft hover:border-primary-300 hover:text-ink',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

function Count({ n }: { n?: number }) {
  if (n === undefined) return null;
  return <span className="rounded-md bg-black/5 px-1.5 text-[11px] font-semibold tabular-nums dark:bg-white/10">{n}</span>;
}

function Select({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={cn(
          'h-9 appearance-none rounded-xl border bg-surface pl-3 pr-8 text-[13px] font-medium outline-none transition-colors focus:border-primary-400',
          value ? 'border-primary-400 text-ink' : 'border-line text-ink-soft',
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ArrowDown2 size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

function ActiveTag({ children, onClear }: { children: React.ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-lg bg-primary-50 py-1 pl-2.5 pr-1 text-xs font-medium text-primary-800 dark:bg-primary-500/10 dark:text-primary-300">
      <span className="truncate">{children}</span>
      <button type="button" onClick={onClear} aria-label="Filtrni olib tashlash" className="rounded p-0.5 opacity-70 hover:opacity-100">
        <CloseCircle size={14} />
      </button>
    </span>
  );
}

function FeedSkeleton() {
  return (
    <div className="flex gap-4 rounded-2xl border border-line p-4">
      <div className="h-[72px] w-[92px] shrink-0 animate-pulse rounded-xl bg-surface-2 sm:h-24 sm:w-36" />
      <div className="flex-1 space-y-2.5">
        <div className="h-3 w-1/3 animate-pulse rounded bg-surface-2" />
        <div className="h-4 w-11/12 animate-pulse rounded bg-surface-2" />
        <div className="h-3 w-4/5 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

function EmptyFeed({
  filtered,
  period,
  lowRelevance,
  onClear,
  onWiden,
  onLow,
}: {
  filtered: boolean;
  period: MediaPeriod;
  lowRelevance: boolean;
  onClear: () => void;
  onWiden: () => void;
  onLow: () => void;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
        <SearchNormal1 size={26} />
      </span>
      <p className="mt-4 font-semibold text-ink">{filtered ? "Bu filtrlar bo'yicha xabar topilmadi" : "Bu davrda tuman haqida xabar yo'q"}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">
        Monitoring har 15 daqiqada davom etadi. Qidiruvni kengaytirib ko'ring:
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {filtered && (
          <Button variant="secondary" size="sm" onClick={onClear}>
            <CloseCircle size={15} /> Filtrlarni tozalash
          </Button>
        )}
        {period !== '30d' && (
          <Button variant="secondary" size="sm" onClick={onWiden}>
            30 kunlik davr
          </Button>
        )}
        {!lowRelevance && (
          <Button variant="secondary" size="sm" onClick={onLow}>
            <Star1 size={15} /> Past moslikni ham ko'rsatish
          </Button>
        )}
      </div>
    </div>
  );
}
