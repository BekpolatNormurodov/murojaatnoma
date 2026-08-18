import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SearchNormal1,
  Location,
  Calendar,
  ArrowRight,
  Timer1,
  Danger,
  Warning2,
  Clock,
  Sort,
  TickCircle,
  Add,
  CloseCircle,
  RotateRight,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { PageHeader } from '@/shared/ui/PageHeader';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { RequestDetail } from './RequestDetail';
import { AddRequestModal } from './RequestModals';
import { RequestToastStack } from './RequestToasts';
import { CATEGORY_META, STATUS_META } from '@/shared/data/mock';
import { useRequests } from '@/shared/store/requests';
import { useWorkers } from '@/features/workers/useWorkers';
import type { RequestStatus } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import { formatDate } from '@/shared/lib/format';
import { DatePicker } from '@/shared/ui/DatePicker';
import { getDeadline, isOpen, urgencyMeta, type Urgency } from './deadline';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

const STATUS_TABS: { key: RequestStatus | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'common.all' },
  { key: 'new', labelKey: 'common.new' },
  { key: 'in_progress', labelKey: 'common.inProgress' },
  { key: 'resolved', labelKey: 'common.resolved' },
  { key: 'rejected', labelKey: 'common.rejected' },
];

const PRIORITY_DOT: Record<string, { labelKey: string; color: string }> = {
  high: { labelKey: 'common.priorityHigh', color: '#ef4444' },
  medium: { labelKey: 'common.priorityMedium', color: '#f59e0b' },
  low: { labelKey: 'common.priorityLow', color: '#94a3b8' },
};

type DeadlineFilter = 'all' | 'open' | 'overdue' | 'critical' | 'soon';
type SortKey = 'urgency' | 'newest';
type DateRangeKey = 'all' | 'today' | '7d' | '30d' | 'custom';

const URGENCY_ORDER: Record<Urgency, number> = {
  overdue: 0,
  critical: 1,
  warning: 2,
  ok: 3,
  done: 4,
};

const DATE_RANGE_TABS: { key: DateRangeKey; labelKey: string }[] = [
  { key: 'all', labelKey: 'requests.dateRange.all' },
  { key: 'today', labelKey: 'requests.dateRange.today' },
  { key: '7d', labelKey: 'requests.dateRange.7d' },
  { key: '30d', labelKey: 'requests.dateRange.30d' },
  { key: 'custom', labelKey: 'requests.dateRange.custom' },
];

const MS_DAY = 86_400_000;

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
function endOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.getTime();
}
/** "yyyy-mm-dd" -> mahalliy Date (UTC siljishisiz). */
function parseYmd(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function RequestsPage() {
  const { t } = useI18n();
  const requests = useRequests((s) => s.requests);
  const loading = useRequests((s) => s.loading);
  const error = useRequests((s) => s.error);
  const hydrate = useRequests((s) => s.hydrate);

  // Sahifa ochilganda (login'dan keyin) ro'yxatni yuklaymiz. Do'kon endi
  // modul import vaqtida emas — shu yerda, mount bo'lganda hydrate qiladi
  // (admin-data endpointlari autentifikatsiya talab qiladi). StrictMode'da
  // effekt ikki marta chaqirilishi mumkin bo'lgani uchun faqat ro'yxat
  // hali bo'sh va yuklanmayotgan bo'lsa so'rov yuboramiz.
  useEffect(() => {
    if (useRequests.getState().requests.length === 0 && !useRequests.getState().loading) {
      void hydrate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: workersData } = useWorkers();
  const workers = workersData ?? [];
  const [tab, setTab] = useState<RequestStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('urgency');
  const [dateRange, setDateRange] = useState<DateRangeKey>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = requests.find((r) => r.id === selectedId) ?? null;
  const addRequest = useRequests((s) => s.add);
  const [addOpen, setAddOpen] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Tanlangan sana oralig'ining chegaralari (ms). null = filtrlanmaydi.
  const dateBounds = useMemo<{ from: number; to: number } | null>(() => {
    const now = new Date();
    if (dateRange === 'all') return null;
    if (dateRange === 'today') return { from: startOfDay(now), to: endOfDay(now) };
    if (dateRange === '7d')
      return { from: startOfDay(new Date(now.getTime() - 6 * MS_DAY)), to: endOfDay(now) };
    if (dateRange === '30d')
      return { from: startOfDay(new Date(now.getTime() - 29 * MS_DAY)), to: endOfDay(now) };
    // custom — biror chegara bo'sh bo'lsa cheksiz deb olinadi
    const f = parseYmd(customFrom);
    const toDate = parseYmd(customTo);
    if (!f && !toDate) return null;
    return {
      from: f ? startOfDay(f) : -Infinity,
      to: toDate ? endOfDay(toDate) : Infinity,
    };
  }, [dateRange, customFrom, customTo]);

  // Har bir murojaat uchun muddatni hisoblaymiz
  const items = useMemo(() => {
    const now = Date.now();
    return requests.map((r) => ({ r, dl: getDeadline(r, t, now) }));
  }, [requests, t]);

  // Muddat bo'yicha statistika (faqat ochiq murojaatlar)
  const stats = useMemo(() => {
    let open = 0;
    let overdue = 0;
    let critical = 0;
    let soon = 0;
    let resolved = 0;
    for (const { r, dl } of items) {
      if (r.status === 'resolved') resolved += 1;
      if (!isOpen(r)) continue;
      open += 1;
      if (dl.urgency === 'overdue') overdue += 1;
      else if (dl.urgency === 'critical') critical += 1;
      else if (dl.urgency === 'warning') soon += 1;
    }
    return { open, overdue, critical, soon, resolved };
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const list = items.filter(({ r, dl }) => {
      const matchesTab = tab === 'all' || r.status === tab;
      const matchesQuery =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.region.toLowerCase().includes(q) ||
        r.citizenName.toLowerCase().includes(q);

      let matchesDeadline = true;
      if (deadlineFilter === 'open') matchesDeadline = isOpen(r);
      else if (deadlineFilter === 'overdue') matchesDeadline = isOpen(r) && dl.urgency === 'overdue';
      else if (deadlineFilter === 'critical') matchesDeadline = isOpen(r) && dl.urgency === 'critical';
      else if (deadlineFilter === 'soon') matchesDeadline = isOpen(r) && dl.urgency === 'warning';

      let matchesDate = true;
      if (dateBounds) {
        const created = new Date(r.createdAt).getTime();
        matchesDate = created >= dateBounds.from && created <= dateBounds.to;
      }

      return matchesTab && matchesQuery && matchesDeadline && matchesDate;
    });

    list.sort((a, b) => {
      if (sortKey === 'urgency') {
        const d = URGENCY_ORDER[a.dl.urgency] - URGENCY_ORDER[b.dl.urgency];
        if (d !== 0) return d;
        // bir xil darajada — kamroq kun qolgani birinchi
        if (a.dl.daysLeft !== b.dl.daysLeft) return a.dl.daysLeft - b.dl.daysLeft;
      }
      return new Date(b.r.createdAt).getTime() - new Date(a.r.createdAt).getTime();
    });

    return list;
  }, [items, tab, query, deadlineFilter, sortKey, dateBounds]);

  const counts = useMemo(() => {
    return STATUS_TABS.reduce<Record<string, number>>((acc, tab) => {
      acc[tab.key] =
        tab.key === 'all' ? requests.length : requests.filter((r) => r.status === tab.key).length;
      return acc;
    }, {});
  }, [requests]);

  const kpis: {
    key: DeadlineFilter;
    label: string;
    value: number;
    icon: typeof Timer1;
    color: string;
    glow?: boolean;
  }[] = [
    { key: 'open', label: t('requests.kpi.open'), value: stats.open, icon: Timer1, color: '#3b82f6' },
    {
      key: 'overdue',
      label: t('common.deadline.overdueStatus'),
      value: stats.overdue,
      icon: Danger,
      color: '#ef4444',
      glow: stats.overdue > 0,
    },
    { key: 'critical', label: t('requests.kpi.critical'), value: stats.critical, icon: Warning2, color: '#f97316' },
    { key: 'soon', label: t('requests.kpi.soon'), value: stats.soon, icon: Clock, color: '#f59e0b' },
  ];

  return (
    <div>
      <PageHeader
        title={t('nav.requests')}
        subtitle={t('requests.subtitle')}
        action={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSortKey((s) => (s === 'urgency' ? 'newest' : 'urgency'))}
              className="flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink-soft transition-colors hover:border-primary-200"
            >
              <Sort size={18} />
              {sortKey === 'urgency' ? t('requests.sort.byDeadline') : t('requests.sort.byDate')}
            </button>
            <button
              onClick={() => setAddOpen(true)}
              className="flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
            >
              <Add size={18} /> {t('requests.addButton')}
            </button>
          </div>
        }
      />

      {error ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">{t('common.loadError')}</p>
            <p className="mt-1 text-sm text-ink-muted">{error}</p>
          </div>
          <Button variant="secondary" onClick={() => hydrate()}>
            <RotateRight size={16} /> {t('common.retry')}
          </Button>
        </Card>
      ) : loading && requests.length === 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* KPI — muddat holati (bosib filtrlanadi) */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => {
          const active = deadlineFilter === k.key;
          return (
            <motion.button
              key={k.key}
              initial={reducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reducedMotion
                  ? { duration: 0 }
                  : { delay: i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }
              }
              onClick={() => setDeadlineFilter((f) => (f === k.key ? 'all' : k.key))}
              className={cn(
                'rounded-2xl border bg-surface p-4 text-left shadow-card transition-all',
                active ? 'border-transparent ring-2' : 'border-line hover:border-primary-200',
                k.glow && !active && !reducedMotion && 'animate-pulse-danger',
              )}
              style={active ? { boxShadow: `0 0 0 2px ${k.color}` } : undefined}
            >
              <div className="flex items-center justify-between">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: `${k.color}1a`, color: k.color }}
                >
                  <k.icon size={20} variant="Bulk" />
                </div>
                <span className="text-2xl font-bold" style={{ color: k.color }}>
                  {k.value}
                </span>
              </div>
              <p className="mt-2.5 text-[13px] font-medium text-ink-soft">{k.label}</p>
            </motion.button>
          );
        })}
      </div>

      {/* Tabs + search */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((st) => (
            <button
              key={st.key}
              onClick={() => setTab(st.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
                tab === st.key
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {t(st.labelKey)}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px]',
                  tab === st.key ? 'bg-white/20' : 'bg-surface-2 text-ink-muted',
                )}
              >
                {counts[st.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <SearchNormal1
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('common.searchPlaceholder')}
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
          />
        </div>
      </div>

      {/* Sana bo'yicha filtr (murojaat yaratilgan vaqtga qarab) */}
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
            <Calendar size={17} variant="Bulk" />
          </span>
          {t('requests.dateFilterHeading')}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {DATE_RANGE_TABS.map((d) => (
            <button
              key={d.key}
              onClick={() => setDateRange(d.key)}
              className={cn(
                'rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                dateRange === d.key
                  ? 'bg-primary-600 text-white shadow-glow'
                  : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {t(d.labelKey)}
            </button>
          ))}
          {dateRange === 'custom' && (
            <div className="flex items-center gap-2 pl-1">
              <div className="w-40">
                <DatePicker value={customFrom} onChange={setCustomFrom} placeholder={t('requests.dateRange.from')} block />
              </div>
              <span className="text-ink-muted">—</span>
              <div className="w-40">
                <DatePicker value={customTo} onChange={setCustomTo} placeholder={t('requests.dateRange.to')} block />
              </div>
            </div>
          )}
        </div>
      </div>

      {(deadlineFilter !== 'all' || dateBounds) && (
        <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
          <span>{t('requests.activeFilterLabel')}</span>
          {deadlineFilter !== 'all' && (
            <button
              onClick={() => setDeadlineFilter('all')}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-medium text-ink transition-opacity hover:opacity-80"
            >
              {kpis.find((k) => k.key === deadlineFilter)?.label ?? t('requests.openFallback')}
              <span className="text-ink-muted">✕</span>
            </button>
          )}
          {dateBounds && (
            <button
              onClick={() => {
                setDateRange('all');
                setCustomFrom('');
                setCustomTo('');
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 font-medium text-ink transition-opacity hover:opacity-80"
            >
              {(() => {
                const dr = DATE_RANGE_TABS.find((d) => d.key === dateRange);
                return dr ? t(dr.labelKey) : null;
              })()}
              {dateRange === 'custom' && (customFrom || customTo) && (
                <span className="text-ink-muted">
                  ({customFrom ? formatDate(customFrom) : '…'} – {customTo ? formatDate(customTo) : '…'})
                </span>
              )}
              <span className="text-ink-muted">✕</span>
            </button>
          )}
          <span className="text-ink-muted">· {filtered.length} {t('requests.resultsCountSuffix')}</span>
        </div>
      )}

      {/* List */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map(({ r, dl }, i) => {
          const worker = workers.find((w) => w.id === r.assignedWorkerId);
          const cat = CATEGORY_META[r.category];
          const meta = urgencyMeta(dl.urgency, t);
          const glowing = !dl.done && meta.glow;
          const lateDone = dl.done && dl.overdue;
          const prio = PRIORITY_DOT[r.priority];
          return (
            <motion.div
              key={r.id}
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={reducedMotion ? { duration: 0 } : { delay: Math.min(i * 0.03, 0.3) }}
            >
              <Card
                onClick={() => setSelectedId(r.id)}
                className={cn(
                  'group h-full cursor-pointer p-4 transition-shadow hover:shadow-pop',
                  glowing && !reducedMotion && 'animate-pulse-danger',
                  glowing && meta.border,
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                    style={{ background: `${cat.color}1a`, color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <span
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                      lateDone ? 'bg-danger-soft text-red-700' : cn(meta.soft, meta.text),
                    )}
                  >
                    {dl.done ? <TickCircle size={12} variant="Bold" /> : <Timer1 size={12} variant="Bold" />}
                    {dl.label}
                  </span>
                </div>

                <h3 className="mt-3 line-clamp-1 text-[15px] font-semibold text-ink">{r.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
                  <span>#{r.id}</span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: prio.color }} />
                    {t(prio.labelKey)}
                  </span>
                </div>

                <div className="mt-3 space-y-1.5 text-[13px] text-ink-soft">
                  <div className="flex items-center gap-2">
                    <Location size={15} className="text-ink-muted" />
                    {r.region}
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-ink-muted" />
                    {formatDate(r.createdAt)} → {formatDate(dl.dueAt.toISOString())}
                  </div>
                </div>

                {/* Muddat progressi */}
                <div className="mt-3">
                  <div className="mb-1.5 flex items-center justify-between text-[11px]">
                    <span className="font-semibold" style={{ color: dl.done ? undefined : meta.color }}>
                      {dl.done ? meta.label : dl.label}
                    </span>
                    <span className="text-ink-muted">{dl.slaDays} {t('requests.card.slaDaysSuffix')}</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round(dl.progress * 100)}%`,
                        background: lateDone ? '#ef4444' : meta.color,
                      }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
                  {worker ? (
                    <div className="flex items-center gap-2">
                      <Avatar name={worker.name} color={worker.avatarColor} size={26} />
                      <span className="text-xs font-medium text-ink-soft">{worker.name}</span>
                    </div>
                  ) : (
                    <button className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline">
                      {t('requests.assignButton')} <ArrowRight size={14} />
                    </button>
                  )}
                  <Badge tone={STATUS_META[r.status].tone} dot>
                    {STATUS_META[r.status].label}
                  </Badge>
                </div>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-500">
            {requests.length === 0 ? (
              <Add size={28} variant="Bulk" />
            ) : (
              <SearchNormal1 size={26} variant="Bulk" />
            )}
          </span>
          <div>
            <p className="font-semibold text-ink">
              {requests.length === 0 ? t('requests.empty.none') : t('requests.empty.noMatch')}
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {requests.length === 0
                ? t('requests.empty.noneHint')
                : t('requests.empty.noMatchHint')}
            </p>
          </div>
          {requests.length === 0 ? (
            <Button onClick={() => setAddOpen(true)}>
              <Add size={18} /> {t('requests.addButton')}
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setTab('all');
                setQuery('');
                setDeadlineFilter('all');
                setDateRange('all');
                setCustomFrom('');
                setCustomTo('');
              }}
            >
              <RotateRight size={16} /> {t('common.clearFilters')}
            </Button>
          )}
        </Card>
      )}
        </>
      )}

      <RequestDetail request={selected} onClose={() => setSelectedId(null)} />
      <AddRequestModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addRequest} />
      <RequestToastStack />
    </div>
  );
}
