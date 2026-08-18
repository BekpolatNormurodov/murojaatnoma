import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import {
  SearchNormal1,
  Mobile,
  UserTick,
  Verify,
  MessageQuestion,
  Android,
  Apple,
  Star1,
  ArrowRight,
  Cup,
  Activity,
  Sort,
  CloseCircle,
  RotateRight,
  More,
  Slash,
  ShieldTick,
  TickCircle,
  InfoCircle,
  FilterRemove,
} from 'iconsax-react';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Select } from '@/shared/ui/Select';
import { Button } from '@/shared/ui/Button';
import { Dropdown } from '@/shared/ui/Dropdown';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { AppUserDetail } from './AppUserDetail';
import { useAppUsers, useUpdateAppUser, type UpdateAppUserInput } from './useAppUsers';
import { useAppUserStats } from './useAppUserStats';
import { useAppUserDau } from './useAppUserDau';
import { useAppUserGrowth } from './useAppUserGrowth';
import { APP_USER_STATUS_META } from '@/shared/data/mock';
import type { AppUser, AppUserDevice, AppUserStatus } from '@/shared/data/types';
import type { AppUserStats } from './api/types';
import { formatNumber, formatDate, timeAgo } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

type StatusFilter = AppUserStatus | 'all';
type DeviceFilter = AppUserDevice | 'all';
type SortKey = 'recent' | 'requests' | 'points';

const STATUS_OPTIONS_KEYS: { value: StatusFilter; labelKey: string; dot?: string }[] = [
  { value: 'all', labelKey: 'appUsers.filters.allStatuses' },
  { value: 'active', labelKey: 'common.active', dot: '#10b981' },
  { value: 'inactive', labelKey: 'common.inactive', dot: '#94a3b8' },
  { value: 'blocked', labelKey: 'appUsers.statusBlocked', dot: '#ef4444' },
];

const DEVICE_OPTIONS_KEYS: { value: DeviceFilter; labelKey: string; icon?: typeof Android }[] = [
  { value: 'all', labelKey: 'appUsers.filters.allDevices' },
  { value: 'android', labelKey: 'appUsers.deviceAndroid', icon: Android },
  { value: 'ios', labelKey: 'appUsers.deviceIos', icon: Apple },
];

const SORT_OPTIONS_KEYS: { value: SortKey; labelKey: string }[] = [
  { value: 'recent', labelKey: 'appUsers.sort.recent' },
  { value: 'requests', labelKey: 'appUsers.sort.requests' },
  { value: 'points', labelKey: 'appUsers.sort.points' },
];

/** Amal natijasi haqida qisqa xabar (aria-live orqali o'qib beriladi). */
interface ActionFeedback {
  id: number;
  tone: 'success' | 'error';
  message: string;
}

const EMPTY_STATS: AppUserStats = {
  total: 0,
  active: 0,
  inactive: 0,
  blocked: 0,
  verified: 0,
  android: 0,
  ios: 0,
  totalRequests: 0,
  newThisMonth: 0,
  avgRating: 0,
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      {label && <p className="mb-1 text-xs font-semibold text-ink">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

const DEFAULT_APP_USER_STATUS_META = {
  label: "Noma'lum",
  tone: 'neutral' as const,
  color: '#94a3b8',
};

/** APP_USER_STATUS_META'da yo'q (kutilmagan) holat uchun neytral fallback. */
function appUserStatusMeta(status: AppUserStatus) {
  return APP_USER_STATUS_META[status] ?? DEFAULT_APP_USER_STATUS_META;
}

export function AppUsersPage() {
  const { t } = useI18n();
  const STATUS_OPTIONS = useMemo(
    () => STATUS_OPTIONS_KEYS.map((o) => ({ ...o, label: t(o.labelKey) })),
    [t],
  );
  const DEVICE_OPTIONS = useMemo(
    () => DEVICE_OPTIONS_KEYS.map((o) => ({ ...o, label: t(o.labelKey) })),
    [t],
  );
  const SORT_OPTIONS = useMemo(
    () => SORT_OPTIONS_KEYS.map((o) => ({ ...o, label: t(o.labelKey) })),
    [t],
  );
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [device, setDevice] = useState<DeviceFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<AppUser | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedback | null>(null);
  const reduceMotion = useReducedMotion();

  const usersQuery = useAppUsers();
  const statsQuery = useAppUserStats();
  const dauQuery = useAppUserDau();
  const growthQuery = useAppUserGrowth();
  const updateMutation = useUpdateAppUser();

  const users = usersQuery.data?.data ?? [];
  const stats = statsQuery.data ?? EMPTY_STATS;
  const selected = useMemo(
    () => users.find((u) => u.id === selectedId) ?? null,
    [users, selectedId],
  );

  // Toast xabari bir necha soniyadan so'ng o'zi yopiladi.
  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3200);
    return () => clearTimeout(t);
  }, [feedback]);

  const notify = useCallback((tone: ActionFeedback['tone'], message: string) => {
    setFeedback({ id: Date.now(), tone, message });
  }, []);

  /** PATCH /app-users/:id — muvaffaqiyat/xato haqida darhol xabar beradi. */
  const runUpdate = useCallback(
    (user: AppUser, patch: UpdateAppUserInput, successMessage: string) => {
      updateMutation.mutate(
        { id: user.id, ...patch },
        {
          onSuccess: () => notify('success', successMessage),
          onError: (err) =>
            notify('error', err instanceof Error ? err.message : t('appUsers.actionFailed')),
        },
      );
    },
    [updateMutation, notify, t],
  );

  /** Faol/nofaol foydalanuvchini bloklashdan oldin tasdiq so'raladi; blokdan chiqarish darhol bajariladi. */
  const requestToggleBlock = useCallback(
    (user: AppUser) => {
      if (user.status === 'blocked') {
        runUpdate(user, { status: 'active' }, t('appUsers.toast.activated').replace('{name}', user.name));
      } else {
        setConfirmTarget(user);
      }
    },
    [runUpdate, t],
  );

  const confirmBlock = useCallback(() => {
    if (!confirmTarget) return;
    const user = confirmTarget;
    setConfirmTarget(null);
    runUpdate(user, { status: 'blocked' }, t('appUsers.toast.blocked').replace('{name}', user.name));
  }, [confirmTarget, runUpdate, t]);

  const toggleVerify = useCallback(
    (user: AppUser) => {
      runUpdate(
        user,
        { verified: !user.verified },
        user.verified
          ? t('appUsers.toast.unverified').replace('{name}', user.name)
          : t('appUsers.toast.verified').replace('{name}', user.name),
      );
    },
    [runUpdate, t],
  );

  const dauData = useMemo(
    () =>
      (dauQuery.data ?? []).map((d) => ({
        kun: formatDate(d.date).split(' ').slice(0, 2).join(' '),
        faol: d.faol,
      })),
    [dauQuery.data],
  );

  const hasActiveFilters =
    query.trim() !== '' || status !== 'all' || device !== 'all';

  const clearFilters = useCallback(() => {
    setQuery('');
    setStatus('all');
    setDevice('all');
  }, []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const list = users.filter((u) => {
      const matchesStatus = status === 'all' || u.status === status;
      const matchesDevice = device === 'all' || u.device === device;
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.region.toLowerCase().includes(q);
      return matchesStatus && matchesDevice && matchesQuery;
    });
    list.sort((a, b) => {
      if (sortKey === 'requests') return b.requestsCount - a.requestsCount;
      if (sortKey === 'points') return b.points - a.points;
      return +new Date(b.lastActiveAt) - +new Date(a.lastActiveAt);
    });
    return list;
  }, [users, query, status, device, sortKey]);

  const topUsers = useMemo(
    () => [...users].sort((a, b) => b.points - a.points).slice(0, 5),
    [users],
  );

  const deviceTotal = stats.android + stats.ios;
  const androidPct = deviceTotal > 0 ? Math.round((stats.android / deviceTotal) * 100) : 0;

  const pendingUserId = updateMutation.isPending ? updateMutation.variables?.id : undefined;

  return (
    <div>
      <PageHeader
        title={t('nav.appUsers')}
        subtitle={t('appUsers.subtitle')}
        action={
          <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft">
            <Mobile size={18} variant="Bulk" className="text-primary-500" />
            {statsQuery.isLoading ? '…' : formatNumber(stats.total)} {t('appUsers.userCountSuffix')}
          </span>
        }
      />

      {usersQuery.isError ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">{t('common.loadError')}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {usersQuery.error instanceof Error
                ? usersQuery.error.message
                : t('common.unknownError')}
            </p>
          </div>
          <Button variant="secondary" onClick={() => usersQuery.refetch()}>
            <RotateRight size={16} /> {t('common.retry')}
          </Button>
        </Card>
      ) : (
        <>
          {/* KPI hisobot */}
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {statsQuery.isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
            ) : (
              <>
                <StatCard
                  icon={Mobile}
                  label={t('appUsers.kpi.total')}
                  value={formatNumber(stats.total)}
                  delta={12}
                  tint="#3b82f6"
                  index={0}
                />
                <StatCard
                  icon={UserTick}
                  label={t('appUsers.kpi.active')}
                  value={formatNumber(stats.active)}
                  delta={8}
                  tint="#10b981"
                  index={1}
                />
                <StatCard
                  icon={Verify}
                  label={t('appUsers.verifiedLabel')}
                  value={formatNumber(stats.verified)}
                  delta={5}
                  tint="#a855f7"
                  index={2}
                />
                <StatCard
                  icon={MessageQuestion}
                  label={t('appUsers.kpi.totalRequests')}
                  value={formatNumber(stats.totalRequests)}
                  delta={17}
                  tint="#f59e0b"
                  index={3}
                />
              </>
            )}
          </div>

          {/* Hisobot — grafiklar */}
          <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* DAU */}
            <Card className="lg:col-span-2">
              <CardHeader
                title={t('appUsers.chart.dauTitle')}
                subtitle={t('appUsers.chart.last14Days')}
                action={
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary-600">
                    <Activity size={16} variant="Bulk" /> {t('appUsers.chart.dauAcronym')}
                  </span>
                }
              />
              <div className="h-64 p-4 pt-2">
                {dauQuery.isLoading ? (
                  <Skeleton className="h-full" />
                ) : dauQuery.isError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
                    <span>{t('appUsers.chart.dauUnavailable')}</span>
                    <Button variant="secondary" size="sm" onClick={() => dauQuery.refetch()}>
                      <RotateRight size={14} /> {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dauData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="dauFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                      <XAxis
                        dataKey="kun"
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        interval={1}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="faol"
                        name={t('common.active')}
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="url(#dauFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Device split + statuses */}
            <Card className="flex flex-col">
              <CardHeader title={t('appUsers.chart.deviceStatusTitle')} subtitle={t('appUsers.chart.distribution')} />
              <div className="flex-1 space-y-4 p-5 pt-3">
                {statsQuery.isLoading ? (
                  <Skeleton className="h-full min-h-[220px]" />
                ) : (
                  <>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          <Android size={15} variant="Bulk" className="text-primary-500" /> {t('appUsers.deviceAndroid')}
                        </span>
                        <span className="font-semibold text-ink">
                          {formatNumber(stats.android)} · {androidPct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-primary-500"
                          style={{ width: `${androidPct}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-[13px]">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          <Apple size={15} variant="Bulk" className="text-ink-soft" /> {t('appUsers.deviceIos')}
                        </span>
                        <span className="font-semibold text-ink">
                          {formatNumber(stats.ios)} · {100 - androidPct}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <div
                          className="h-full rounded-full bg-ink-soft"
                          style={{ width: `${100 - androidPct}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-line pt-4">
                      {(['active', 'inactive', 'blocked'] as const).map((s) => (
                        <div key={s} className="rounded-xl bg-surface-2 py-2.5 text-center">
                          <div
                            className="text-base font-bold"
                            style={{ color: APP_USER_STATUS_META[s].color }}
                          >
                            {formatNumber(stats[s])}
                          </div>
                          <div className="text-[11px] text-ink-muted">
                            {APP_USER_STATUS_META[s].label}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Growth + Top users */}
          <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title={t('appUsers.chart.growthTitle')} subtitle={t('appUsers.chart.growthSubtitle')} />
              <div className="h-56 p-4 pt-2">
                {growthQuery.isLoading ? (
                  <Skeleton className="h-full" />
                ) : growthQuery.isError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
                    <span>{t('appUsers.chart.growthUnavailable')}</span>
                    <Button variant="secondary" size="sm" onClick={() => growthQuery.refetch()}>
                      <RotateRight size={14} /> {t('common.retry')}
                    </Button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={growthQuery.data ?? []}
                      margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: 'var(--color-ink-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-surface-2)' }} />
                      <Bar dataKey="yangi" name={t('common.new')} fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={34} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            {/* Leaderboard */}
            <Card>
              <CardHeader
                title={t('appUsers.leaderboard.title')}
                action={<Cup size={18} variant="Bulk" className="text-amber-500" />}
              />
              <div className="space-y-1 p-3">
                {usersQuery.isLoading
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex w-full items-center gap-3 p-2">
                        <Skeleton className="h-6 w-6 shrink-0 rounded-full" />
                        <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                        <Skeleton className="h-4 flex-1 rounded-md" />
                      </div>
                    ))
                  : topUsers.map((u, i) => (
                      <button
                        key={u.id}
                        onClick={() => setSelectedId(u.id)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-surface-2"
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                            i === 0
                              ? 'bg-amber-100 text-amber-700'
                              : i === 1
                                ? 'bg-surface-2 text-ink-soft'
                                : i === 2
                                  ? 'bg-orange-100 text-orange-600'
                                  : 'bg-surface-2 text-ink-muted',
                          )}
                        >
                          {i + 1}
                        </span>
                        <Avatar src={u.photo} name={u.name} color={u.avatarColor} size={32} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-medium text-ink">{u.name}</div>
                          <div className="text-[11px] text-ink-muted">{u.region}</div>
                        </div>
                        <span className="flex items-center gap-1 text-[13px] font-semibold text-amber-600">
                          <Cup size={13} variant="Bold" /> {formatNumber(u.points)}
                        </span>
                      </button>
                    ))}
              </div>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:w-80">
              <SearchNormal1
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('appUsers.search.placeholder')}
                aria-label={t('appUsers.search.ariaLabel')}
                className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
              <Select value={device} onChange={setDevice} options={DEVICE_OPTIONS} />
              <Select value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} icon={Sort} />
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
                >
                  <FilterRemove size={16} variant="Bulk" /> {t('common.clear')}
                </button>
              )}
            </div>
          </div>

          {/* User list */}
          <Card className="overflow-hidden">
            <div className="hidden border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted md:grid md:grid-cols-12 md:gap-4">
              <div className="col-span-4">{t('appUsers.table.user')}</div>
              <div className="col-span-2">{t('appUsers.regionLabel')}</div>
              <div className="col-span-2 text-center">{t('appUsers.requestsLabel')}</div>
              <div className="col-span-2 text-center">{t('appUsers.lastActiveLabel')}</div>
              <div className="col-span-2 text-right">{t('appUsers.table.status')}</div>
            </div>
            <div className="divide-y divide-line">
              {usersQuery.isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <Skeleton className="h-10" />
                    </div>
                  ))
                : filtered.map((u, i) => {
                    const st = appUserStatusMeta(u.status);
                    const isBlocked = u.status === 'blocked';
                    const rowPending = pendingUserId === u.id;
                    return (
                      <motion.div
                        key={u.id}
                        role="button"
                        tabIndex={0}
                        aria-label={t('appUsers.openProfileAria').replace('{name}', u.name)}
                        initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: reduceMotion ? 0 : Math.min(i * 0.015, 0.25) }}
                        onClick={() => setSelectedId(u.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedId(u.id);
                          }
                        }}
                        className="grid w-full cursor-pointer grid-cols-1 items-center gap-3 px-5 py-3.5 text-left outline-none transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300 md:grid-cols-12 md:gap-4"
                      >
                        <div className="col-span-4 flex items-center gap-3">
                          <Avatar src={u.photo} name={u.name} color={u.avatarColor} size={40} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-semibold text-ink">{u.name}</span>
                              {u.verified && (
                                <Verify size={14} variant="Bold" className="shrink-0 text-accent-500" />
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                              {u.device === 'android' ? (
                                <Android size={12} variant="Bulk" className="text-primary-500" />
                              ) : (
                                <Apple size={12} variant="Bulk" />
                              )}
                              {u.phone}
                            </div>
                          </div>
                        </div>
                        <div className="col-span-2 text-[13px] text-ink-soft">{u.region}</div>
                        <div className="col-span-2 flex items-center gap-1.5 md:justify-center">
                          <MessageQuestion size={15} variant="Bulk" className="text-ink-muted md:hidden" />
                          <span className="text-sm font-semibold text-ink">{u.requestsCount}</span>
                          {u.avgRating > 0 && (
                            <span className="flex items-center gap-0.5 text-[12px] text-amber-500">
                              <Star1 size={11} variant="Bold" /> {u.avgRating.toFixed(1)}
                            </span>
                          )}
                        </div>
                        <div className="col-span-2 text-[12px] text-ink-muted md:text-center">
                          {timeAgo(u.lastActiveAt)}
                        </div>
                        <div className="col-span-2 flex items-center justify-between gap-1.5 md:justify-end">
                          <Badge tone={st.tone} dot>
                            {st.label}
                          </Badge>
                          <ArrowRight size={16} className="hidden text-ink-muted md:block" />
                          <div
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <Dropdown
                              align="end"
                              width={220}
                              trigger={
                                <button
                                  type="button"
                                  aria-label={t('appUsers.actionsForAria').replace('{name}', u.name)}
                                  disabled={rowPending}
                                  className="flex h-11 w-11 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                                >
                                  <More size={18} />
                                </button>
                              }
                              items={[
                                {
                                  label: isBlocked ? t('appUsers.actions.activate') : t('appUsers.actions.block'),
                                  icon: Slash,
                                  danger: !isBlocked,
                                  disabled: rowPending,
                                  onClick: () => requestToggleBlock(u),
                                },
                                {
                                  label: u.verified ? t('appUsers.actions.unverify') : t('appUsers.actions.verify'),
                                  icon: ShieldTick,
                                  disabled: rowPending,
                                  onClick: () => toggleVerify(u),
                                },
                              ]}
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
            </div>

            {!usersQuery.isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <CloseCircle size={32} variant="Bulk" className="text-ink-muted" />
                <div>
                  <p className="font-medium text-ink">{t('appUsers.empty.title')}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {hasActiveFilters
                      ? t('appUsers.empty.hasFilters')
                      : t('appUsers.empty.noUsers')}
                  </p>
                </div>
                {hasActiveFilters && (
                  <Button variant="secondary" size="sm" onClick={clearFilters}>
                    <FilterRemove size={14} /> {t('common.clearFilters')}
                  </Button>
                )}
              </div>
            )}
          </Card>

          <AppUserDetail
            user={selected}
            onClose={() => setSelectedId(null)}
            onToggleBlock={requestToggleBlock}
            onToggleVerify={toggleVerify}
            pending={!!selected && pendingUserId === selected.id}
          />

          <ConfirmDialog
            open={!!confirmTarget}
            onClose={() => setConfirmTarget(null)}
            onConfirm={confirmBlock}
            title={t('appUsers.confirmBlock.title')}
            message={
              <>
                <strong className="text-ink">{confirmTarget?.name}</strong> {t('appUsers.confirmBlock.message')}
              </>
            }
            confirmLabel={t('appUsers.confirmBlock.confirmLabel')}
            tone="danger"
            icon={Slash}
            loading={!!confirmTarget && pendingUserId === confirmTarget.id}
          />

          {/* Amal natijasi — screen reader uchun aria-live, ko'zga esa qisqa toast sifatida */}
          <div
            aria-live={feedback?.tone === 'error' ? 'assertive' : 'polite'}
            role={feedback?.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-none fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4"
          >
            <AnimatePresence>
              {feedback && (
                <motion.div
                  initial={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: 12, scale: 0.98 }}
                  transition={{ duration: reduceMotion ? 0 : 0.2 }}
                  className={cn(
                    'pointer-events-auto flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium shadow-pop',
                    feedback.tone === 'success'
                      ? 'border-primary-200 bg-surface text-primary-700'
                      : 'border-red-200 bg-surface text-red-700',
                  )}
                >
                  {feedback.tone === 'success' ? (
                    <TickCircle size={18} variant="Bulk" className="shrink-0" />
                  ) : (
                    <InfoCircle size={18} variant="Bulk" className="shrink-0" />
                  )}
                  {feedback.message}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </div>
  );
}
