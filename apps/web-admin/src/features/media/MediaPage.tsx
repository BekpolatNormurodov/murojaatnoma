import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowDown2,
  Category,
  Chart21,
  CloseCircle,
  DocumentText,
  EmojiHappy,
  EmojiNormal,
  Eye,
  EyeSlash,
  FilterSearch,
  Flag,
  Global,
  Hashtag,
  Location,
  MagicStar,
  Notification,
  Radar,
  Refresh2,
  SearchNormal1,
  ShieldTick,
  Star1,
  TickSquare,
  Warning2,
} from 'iconsax-react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { usePermissions } from '@/shared/lib/permissions';
import {
  type MediaFilters,
  type MediaItem,
  type MediaOverview,
  type MediaPeriod,
  type MediaPlatform,
  type MediaSentiment,
  type MediaStatus,
  useMarkAllSeen,
  useMediaItems,
  useMediaLive,
  useMediaOverview,
  useRefreshMedia,
  useRegenerateDigest,
  useUpdateMediaItem,
} from './api';
import { MediaDigestCard } from './MediaDigestCard';
import { FilterMenu, FilterTag, LabeledSwitch, SegmentedFilter, type FilterOption } from './MediaFilters';
import { MediaHero } from './MediaHero';
import { MediaLeadCard } from './MediaLeadCard';
import { MediaItemCard } from './MediaItemCard';
import { MediaSettingsModal, type SettingsTab } from './MediaSettingsModal';
import { SourceLogo } from './MediaIcons';
import { PLATFORMS, PLATFORM_META, SENTIMENTS, SENTIMENT_META, clock, dayKey, dayLabel, shortTime } from './meta';
import { formatCompact } from '@/shared/lib/format';

/** Visible keyboard focus for every custom control on the page. */
const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

const STATUS_OPTIONS: FilterOption<MediaStatus>[] = [
  { value: 'new', label: "Ko'rilmagan", icon: <Notification size={16} className="text-primary-600" /> },
  { value: 'important', label: 'Muhim', icon: <Star1 size={16} variant="Bold" className="text-amber-500" /> },
  { value: 'seen', label: "Ko'rilgan", icon: <TickSquare size={16} className="text-emerald-600" /> },
  { value: 'hidden', label: 'Yashirilgan', icon: <EyeSlash size={16} className="text-ink-soft" /> },
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
  const reduceMotion = useReducedMotion();
  const [searchText, setSearchText] = useState('');
  const [search, setSearch] = useState('');
  const [settingsOpen, setSettingsOpen] = useState<false | SettingsTab>(false);
  const now = useNow(60_000);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const feedRef = useRef<HTMLElement>(null);
  const [params, setParams] = useSearchParams();
  const tab: ViewTab = params.get('tab') === 'stats' ? 'stats' : 'news';
  const setTab = useCallback(
    (t: ViewTab) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (t === 'stats') next.set('tab', 'stats');
          else next.delete('tab');
          return next;
        },
        { replace: true },
      ),
    [setParams],
  );

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
  const lead = items[0];
  const groups = useMemo(() => {
    const out: { key: string; label: string; items: MediaItem[] }[] = [];
    for (const it of items.slice(1)) {
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

  /** Filters always land on the news view (stats cards and hero tiles call this). */
  const scrollToFeed = useCallback(() => {
    setTab('news');
    window.setTimeout(() => feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }, [setTab]);

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
  const onTopic = useCallback(
    (t: string) => {
      setTopic(t);
      scrollToFeed();
    },
    [scrollToFeed],
  );

  return (
    <div className="isolate">
      <MediaHero
        ov={ov}
        period={period}
        onPeriod={setPeriod}
        running={running}
        onRefresh={onRefresh}
        onSettings={() => setSettingsOpen(failedSources > 0 ? 'status' : 'keywords')}
        failedSources={failedSources}
        active={kind === 'official' ? 'official' : sentiment === 'negative' ? 'negative' : sentiment === 'positive' ? 'positive' : null}
        onFilter={(f) => {
          if (f === 'all') clearFilters();
          else if (f === 'official') setKind(kind === 'official' ? undefined : 'official');
          else setSentiment(sentiment === f ? undefined : f);
          scrollToFeed();
        }}
      />

      {ov?.status.ai.lastError && (
        <button
          type="button"
          onClick={() => setSettingsOpen('keys')}
          className="mb-5 inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30"
          title={ov.status.ai.lastError}
        >
          <Warning2 size={15} /> AI ishlamadi — avtomatik tahlil ishlatildi
        </button>
      )}

      {/* News and statistics are separate views (?tab=stats keeps the link). */}
      <ViewTabs tab={tab} onTab={setTab} newsCount={ov?.totals.all} unseen={ov?.totals.unseen} />

      {tab === 'news' ? (
        <>
          <HowItWorks sourceCount={ov?.status.sources.length} />
          <section ref={feedRef} className="min-w-0 scroll-mt-20" aria-label="Xabarlar lentasi">
              <Card className="p-4 sm:p-5">
                {/* Header: what this feed is + who is speaking */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-ink">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-70 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
                      </span>
                      Yangiliklar
                    </h2>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                      <span
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30"
                        title="Faqat «Mirzo Ulug'bek tumani» tilga olingan xabarlar. Aniq bo'lmaganlarini pastdagi «Aniq bo'lmaganlar ham» yoqadi."
                      >
                        <Location size={13} variant="Bold" /> Mirzo Ulug'bek tumani haqida
                      </span>
                      <span>Eng so'nggisi tepada · Toshkent vaqti</span>
                      {ov?.status.lastRun && <span>· {clock(ov.status.lastRun.finishedAt)} da yangilandi</span>}
                    </p>
                  </div>
                  <SegmentedFilter
                    label="Manba turi"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: undefined, label: 'Hammasi', short: 'Hammasi', icon: <Category size={16} />, count: ov?.totals.all },
                      { value: 'official', label: 'Rasmiy manbalar', short: 'Rasmiy', icon: <ShieldTick size={16} variant="Bold" />, count: ov?.totals.official },
                      { value: 'media', label: 'OAV va tarmoqlar', short: 'OAV', icon: <DocumentText size={16} />, count: ov ? ov.totals.all - ov.totals.official : undefined },
                    ]}
                  />
                </div>

                {/* Toolbar: search + filter dropdowns */}
                <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-line bg-surface-2/70 p-2 xl:flex-row xl:items-center dark:bg-white/[0.03]">
                  <div className="relative min-w-0 flex-1">
                    <SearchNormal1 size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
                    <input
                      ref={searchRef}
                      type="search"
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      placeholder="Sarlavha, matn, manba yoki kalit so'z…"
                      aria-label="Xabarlarni qidirish"
                      className="h-10 w-full rounded-xl border border-line bg-surface pl-10 pr-12 text-sm text-ink outline-none transition placeholder:text-ink-muted hover:border-ink-muted/40 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 dark:focus:ring-primary-500/20 [&::-webkit-search-cancel-button]:hidden"
                    />
                    <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
                      {searchText ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchText('');
                            setSearch('');
                            searchRef.current?.focus();
                          }}
                          aria-label="Qidiruvni tozalash"
                          className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink', FOCUS)}
                        >
                          <CloseCircle size={18} />
                        </button>
                      ) : (
                        <kbd className="mr-1 hidden rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-ink-soft sm:block" title="Qidiruvga o'tish">
                          /
                        </kbd>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center" role="group" aria-label="Filtrlar">
                    <FilterMenu
                      label="Platforma"
                      icon={<Global size={16} />}
                      value={platform}
                      onChange={setPlatform}
                      allCount={ov?.totals.all}
                      options={PLATFORMS.map((p) => {
                        const m = PLATFORM_META[p];
                        return { value: p, label: m.label, count: ov?.platforms[p], icon: <span style={{ color: m.color }}><m.Icon size={16} /></span> };
                      })}
                    />
                    <FilterMenu
                      label="Baho"
                      icon={<EmojiNormal size={16} />}
                      value={sentiment}
                      onChange={setSentiment}
                      allLabel="Barcha baholar"
                      allCount={ov?.totals.all}
                      options={SENTIMENTS.map((s) => {
                        const m = SENTIMENT_META[s];
                        return { value: s, label: m.label, count: ov?.totals[s], icon: <m.Icon size={16} variant="Bold" color={m.color} /> };
                      })}
                    />
                    <FilterMenu
                      label="Mavzu"
                      icon={<Hashtag size={16} />}
                      value={topic}
                      onChange={setTopic}
                      allLabel="Barcha mavzular"
                      allCount={ov?.totals.all}
                      empty="Bu davrda mavzular yo'q"
                      width={340}
                      options={(ov?.topics ?? []).map((t) => ({ value: t.topic, label: t.topic, count: t.count, negative: t.negative }))}
                    />
                    <FilterMenu
                      label="Holat"
                      icon={<Flag size={16} />}
                      value={status || undefined}
                      onChange={(v) => setStatus(v ?? '')}
                      allLabel="Barcha holatlar"
                      options={STATUS_OPTIONS}
                    />
                  </div>
                </div>

                {/* Applied filters — each removable */}
                {activeFilters > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Qo'llangan filtrlar">
                    {kind && (
                      <FilterTag icon={kind === 'official' ? <ShieldTick size={14} variant="Bold" /> : <DocumentText size={14} />} onClear={() => setKind(undefined)}>
                        {kind === 'official' ? 'Rasmiy manbalar' : 'OAV va tarmoqlar'}
                      </FilterTag>
                    )}
                    {platform && <FilterTag onClear={() => setPlatform(undefined)}>{PLATFORM_META[platform].label}</FilterTag>}
                    {sentiment && <FilterTag onClear={() => setSentiment(undefined)}>{SENTIMENT_META[sentiment].label}</FilterTag>}
                    {topic && <FilterTag onClear={() => setTopic(undefined)}>Mavzu: {topic}</FilterTag>}
                    {status && <FilterTag onClear={() => setStatus('')}>{STATUS_OPTIONS.find((o) => o.value === status)?.label}</FilterTag>}
                    {source && <FilterTag onClear={() => setSource(undefined)}>Manba: {source.name}</FilterTag>}
                    {search && (
                      <FilterTag
                        icon={<SearchNormal1 size={13} />}
                        onClear={() => {
                          setSearchText('');
                          setSearch('');
                        }}
                      >
                        «{search}»
                      </FilterTag>
                    )}
                    {lowRelevance && <FilterTag onClear={() => setLowRelevance(false)}>Aniq bo'lmaganlar ham</FilterTag>}
                    <button
                      type="button"
                      onClick={clearFilters}
                      className={cn('ml-1 inline-flex h-8 items-center rounded-lg px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10', FOCUS)}
                    >
                      Hammasini tozalash
                    </button>
                  </div>
                )}

                {/* Result header */}
                <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3">
                  <p className="text-[13px] text-ink-soft" aria-live="polite">
                    {itemsQ.isLoading ? (
                      'Yuklanmoqda…'
                    ) : itemsQ.data?.pages[0]?.grouped ? (
                      <>
                        <b className="font-semibold text-ink tabular-nums">{total}</b> ta voqea
                        <span className="ml-1 text-ink-soft" title="Bir voqea bir nechta manbada chiqsa — bitta kartada, «Yana N manbada» bilan">
                          (bir xil xabarlar birlashtirildi)
                        </span>
                      </>
                    ) : (
                      <>
                        <b className="font-semibold text-ink tabular-nums">{total}</b> ta xabar
                      </>
                    )}
                    {itemsQ.isFetching && !itemsQ.isLoading && <span className="ml-2 text-ink-soft">yangilanmoqda…</span>}
                  </p>
                  <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
                    <LabeledSwitch
                      checked={lowRelevance}
                      onChange={setLowRelevance}
                      hint="Tumanga tegishliligi aniq bo'lmagan xabarlarni ham ko'rsatish (masalan, faqat «Mirzo Ulug'bek» deb yozilgan — olim, ko'cha yoki metro bo'lishi mumkin)"
                    >
                      Aniq bo'lmaganlar ham
                    </LabeledSwitch>
                    {canWrite && (ov?.totals.unseen ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => markAll.mutate(undefined, { onSuccess: (r) => toast(`${r.updated} ta xabar ko'rildi deb belgilandi`) })}
                        disabled={markAll.isPending}
                        className={cn('inline-flex h-9 items-center gap-1.5 rounded-xl border border-line px-3 text-[13px] font-medium text-ink-soft hover:bg-surface-2 hover:text-ink disabled:opacity-60', FOCUS)}
                      >
                        <TickSquare size={16} /> Hammasini ko'rildi
                      </button>
                    )}
                  </div>
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
                    <>
                      {lead && <MediaLeadCard item={lead} search={search} now={now} onOpen={onOpen} />}
                      {/* Phones/tablets: day separators. Desktop: one continuous 2-column grid
                          (groups become display:contents), the day shown on each card. */}
                      <div className="space-y-3 xl:grid xl:grid-cols-2 xl:gap-3 xl:space-y-0 min-[1400px]:grid-cols-3">
                      {groups.map((g) => (
                        <Fragment key={g.key}>
                          <div className="flex items-center gap-3 pt-2 xl:hidden">
                            <span className={cn('text-xs font-bold uppercase tracking-wide', g.label === 'Bugun' ? 'text-primary-700 dark:text-primary-300' : 'text-ink-soft')}>
                              {g.label}
                            </span>
                            <span className="h-px flex-1 bg-line" />
                            <span className="text-[11px] tabular-nums text-ink-soft">{g.items.length} ta</span>
                          </div>
                          <div className="grid gap-3 xl:contents">
                            {g.items.map((it, i) => (
                              <motion.div
                                key={it.id}
                                className="h-full"
                                initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3, delay: Math.min(i, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}
                              >
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
                          </div>
                        </Fragment>
                      ))}
                      </div>
                    </>
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
        </>
      ) : overviewQ.isError && !ov ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <Warning2 size={36} variant="Bulk" className="text-danger" />
          <p className="font-semibold text-ink">Monitoring ma'lumotlarini yuklab bo'lmadi</p>
          <p className="text-sm text-ink-soft">{overviewQ.error instanceof Error ? overviewQ.error.message : ''}</p>
          <Button variant="secondary" onClick={() => overviewQ.refetch()}>
            <Refresh2 size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* Digest + platforms */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
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
          {/* Trend + topics */}
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <TimelineCard ov={ov} loading={overviewQ.isLoading} tall />
            </div>
            <TopicsCard
              ov={ov}
              active={topic}
              onPick={(t) => {
                setTopic(topic === t ? undefined : t);
                scrollToFeed();
              }}
            />
          </div>
          {/* Who writes, what is read most, official vs press */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <TopSourcesCard
              ov={ov}
              active={source?.key}
              onPick={(s) => {
                setSource(source?.key === s.key ? undefined : s);
                scrollToFeed();
              }}
            />
            <TopViewedCard ov={ov} />
            <KindCard
              ov={ov}
              onPick={(k) => {
                setKind(k);
                scrollToFeed();
              }}
            />
          </div>
        </div>
      )}

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
    { icon: <Radar size={18} variant="Bulk" />, title: `${sourceCount || 150}+ manba`, text: "Davlat saytlari, OAV, Telegram, YouTube har 15 daqiqada o'qiladi" },
    { icon: <FilterSearch size={18} variant="Bulk" />, title: 'Tumanga oidi ajratiladi', text: "«Mirzo Ulug'bek tumani» haqidagilar qoladi, boshqalari tashlanadi" },
    { icon: <EmojiHappy size={18} variant="Bulk" />, title: 'Baholanadi', text: 'Har bir xabar: ijobiy, neytral yoki salbiy va mavzusi' },
    { icon: <MagicStar size={18} variant="Bulk" />, title: 'Xulosa yoziladi', text: "Asosiysi, xavflar va tavsiyalar — bir qarashda" },
  ];
  return (
    <section aria-label="Qanday ishlaydi" className="relative mb-5 rounded-2xl border border-line bg-surface p-3.5 shadow-card sm:p-4">
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
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft hover:bg-surface-2 hover:text-ink"
      >
        <CloseCircle size={18} />
      </button>
      <p className="mb-3 pr-8 text-[13px] font-semibold text-ink">Qanday ishlaydi?</p>
      <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
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
              <p className="hidden text-xs leading-relaxed text-ink-soft sm:block">{st.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
                FOCUS,
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

function TimelineCard({ ov, loading, tall = false }: { ov?: MediaOverview; loading: boolean; tall?: boolean }) {
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
      <div className={cn('px-2 pb-3 pt-3', tall ? 'h-72 sm:h-80' : 'h-56')}>
        {loading && !ov ? (
          <div className="mx-3 h-full animate-pulse rounded-xl bg-surface-2" />
        ) : peak === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-soft">
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
          <p className="py-8 text-center text-sm text-ink-soft">Hali mavzu yo'q</p>
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
                FOCUS,
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

type ViewTab = 'news' | 'stats';

/** "Yangiliklar | Statistika" — two views of the same monitoring, URL-addressable. */
function ViewTabs({
  tab,
  onTab,
  newsCount,
  unseen,
}: {
  tab: ViewTab;
  onTab: (t: ViewTab) => void;
  newsCount?: number;
  unseen?: number;
}) {
  const items = [
    { key: 'news' as const, label: 'Yangiliklar', icon: <DocumentText size={18} variant={tab === 'news' ? 'Bold' : 'Linear'} />, badge: newsCount },
    { key: 'stats' as const, label: 'Statistika', icon: <Chart21 size={18} variant={tab === 'stats' ? 'Bold' : 'Linear'} />, badge: undefined },
  ];
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <div role="tablist" aria-label="Ko'rinish" className="inline-flex rounded-2xl border border-line bg-surface p-1 shadow-card">
        {items.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => onTab(t.key)}
            className={cn(
              'relative inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors sm:px-5',
              FOCUS,
              tab === t.key ? 'text-white' : 'text-ink-soft hover:text-ink',
            )}
          >
            {tab === t.key && (
              <motion.span layoutId="media-view-pill" className="absolute inset-0 rounded-xl bg-primary-600 shadow" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />
            )}
            <span className="relative inline-flex items-center gap-2">
              {t.icon}
              {t.label}
              {t.badge !== undefined && (
                <span className={cn('rounded-md px-1.5 text-[11px] font-bold tabular-nums', tab === t.key ? 'bg-white/20' : 'bg-surface-2 text-ink')}>{t.badge}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      {tab === 'news' && unseen ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800 ring-1 ring-primary-200 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/30">
          <span className="h-1.5 w-1.5 rounded-full bg-primary-500" /> {unseen} ta ko'rilmagan
        </span>
      ) : null}
    </div>
  );
}

/** What people actually watched / read (views from Telegram & YouTube). */
function TopViewedCard({ ov }: { ov?: MediaOverview }) {
  const list = ov?.topViewed ?? [];
  return (
    <Card>
      <CardHeader title="Eng ko'p ko'rilgan" subtitle="Telegram va YouTube ko'rishlari bo'yicha" />
      <ol className="p-3 sm:p-4">
        {!ov ? (
          Array.from({ length: 4 }).map((_, i) => <li key={i} className="mb-1 h-12 animate-pulse rounded-xl bg-surface-2" />)
        ) : list.length === 0 ? (
          <li className="py-6 text-center text-sm text-ink-soft">Bu davrda ko'rishlar soni yo'q</li>
        ) : (
          list.map((it, i) => (
            <li key={it.id}>
              <a
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('flex items-start gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-2', FOCUS)}
              >
                <span className="mt-0.5 w-5 shrink-0 text-center text-sm font-bold tabular-nums text-ink-soft">{i + 1}</span>
                <SourceLogo item={it} size={22} className="mt-0.5" />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink">{it.title}</span>
                  <span className="mt-0.5 block text-xs text-ink-soft">
                    {it.sourceName} · {shortTime(it.publishedAt)}
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold tabular-nums text-ink">
                  <Eye size={13} /> {formatCompact(it.views ?? 0)}
                </span>
              </a>
            </li>
          ))
        )}
      </ol>
    </Card>
  );
}

/** State bodies vs the press — how much of the talk is official. */
function KindCard({ ov, onPick }: { ov?: MediaOverview; onPick: (k: 'official' | 'media') => void }) {
  const official = ov?.totals.official ?? 0;
  const media = ov ? ov.totals.all - official : 0;
  const total = Math.max(1, official + media);
  const rows = [
    { key: 'official' as const, label: 'Rasmiy manbalar', hint: "hokimlik, vazirliklar, UzA, parlament", n: official, color: 'bg-accent-500', icon: <ShieldTick size={18} variant="Bold" /> },
    { key: 'media' as const, label: 'OAV va tarmoqlar', hint: 'saytlar, Telegram, YouTube', n: media, color: 'bg-primary-500', icon: <DocumentText size={18} variant="Bold" /> },
  ];
  return (
    <Card>
      <CardHeader title="Kim gapirmoqda" subtitle="Rasmiy manbalar va OAV ulushi" />
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={`Rasmiy ${official}, OAV ${media}`}>
          <span className="h-full bg-accent-500 transition-[width] duration-500" style={{ width: `${(official / total) * 100}%` }} />
          <span className="h-full bg-primary-500 transition-[width] duration-500" style={{ width: `${(media / total) * 100}%` }} />
        </div>
        {rows.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => onPick(r.key)}
            className={cn('flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-surface-2', FOCUS)}
          >
            <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl text-white', r.color)}>{r.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{r.label}</span>
              <span className="block truncate text-xs text-ink-soft">{r.hint}</span>
            </span>
            <span className="text-right">
              <span className="block text-xl font-bold tabular-nums text-ink">{ov ? r.n : '—'}</span>
              <span className="block text-xs text-ink-soft">{Math.round((r.n / total) * 100)}%</span>
            </span>
          </button>
        ))}
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
          <li className="py-6 text-center text-sm text-ink-soft">Bu davrda manba yo'q</li>
        ) : (
          list.map((s) => (
            <li key={s.sourceName}>
              <button
                type="button"
                onClick={() => onPick({ key: s.source, name: s.sourceName })}
                aria-pressed={active === s.source}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-2',
                FOCUS,
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
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-ink-soft">
        <SearchNormal1 size={26} />
      </span>
      <p className="mt-4 font-semibold text-ink">{filtered ? "Bu filtrlar bo'yicha xabar topilmadi" : "Bu davrda tuman haqida xabar yo'q"}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">
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
