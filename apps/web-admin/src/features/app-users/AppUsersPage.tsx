import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
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
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Select } from '@/shared/ui/Select';
import { AppUserDetail } from './AppUserDetail';
import {
  APP_USERS,
  APP_USER_STATS,
  APP_USER_STATUS_META,
  APP_USER_DAU,
  APP_USER_GROWTH,
} from '@/shared/data/mock';
import type { AppUser, AppUserStatus } from '@/shared/data/types';
import { formatNumber, formatDate, timeAgo } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

type StatusFilter = AppUserStatus | 'all';
type SortKey = 'recent' | 'requests' | 'points';

const STATUS_OPTIONS: { value: StatusFilter; label: string; dot?: string }[] = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'active', label: 'Faol', dot: '#10b981' },
  { value: 'inactive', label: 'Nofaol', dot: '#94a3b8' },
  { value: 'blocked', label: 'Bloklangan', dot: '#ef4444' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recent', label: 'Oxirgi faollik' },
  { value: 'requests', label: 'Murojaatlar soni' },
  { value: 'points', label: 'Faollik balli' },
];

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

const dauData = APP_USER_DAU.map((d) => ({
  kun: formatDate(d.date).split(' ').slice(0, 2).join(' '),
  faol: d.faol,
}));

export function AppUsersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('recent');
  const [selected, setSelected] = useState<AppUser | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const list = APP_USERS.filter((u) => {
      const matchesStatus = status === 'all' || u.status === status;
      const matchesQuery =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        u.region.toLowerCase().includes(q);
      return matchesStatus && matchesQuery;
    });
    list.sort((a, b) => {
      if (sortKey === 'requests') return b.requestsCount - a.requestsCount;
      if (sortKey === 'points') return b.points - a.points;
      return +new Date(b.lastActiveAt) - +new Date(a.lastActiveAt);
    });
    return list;
  }, [query, status, sortKey]);

  const topUsers = useMemo(
    () => [...APP_USERS].sort((a, b) => b.points - a.points).slice(0, 5),
    [],
  );

  const deviceTotal = APP_USER_STATS.android + APP_USER_STATS.ios;
  const androidPct = Math.round((APP_USER_STATS.android / deviceTotal) * 100);

  return (
    <div>
      <PageHeader
        title="Ilova foydalanuvchilari"
        subtitle="Mobil ilovadan foydalanayotgan Mirzo Ulug'bek fuqarolari va ular bo'yicha hisobot"
        action={
          <span className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft">
            <Mobile size={18} variant="Bulk" className="text-primary-500" />
            {formatNumber(APP_USER_STATS.total)} foydalanuvchi
          </span>
        }
      />

      {/* KPI hisobot */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Mobile}
          label="Jami foydalanuvchilar"
          value={formatNumber(APP_USER_STATS.total)}
          delta={12}
          tint="#3b82f6"
          index={0}
        />
        <StatCard
          icon={UserTick}
          label="Faol foydalanuvchilar"
          value={formatNumber(APP_USER_STATS.active)}
          delta={8}
          tint="#10b981"
          index={1}
        />
        <StatCard
          icon={Verify}
          label="Tasdiqlangan"
          value={formatNumber(APP_USER_STATS.verified)}
          delta={5}
          tint="#a855f7"
          index={2}
        />
        <StatCard
          icon={MessageQuestion}
          label="Jami murojaatlar"
          value={formatNumber(APP_USER_STATS.totalRequests)}
          delta={17}
          tint="#f59e0b"
          index={3}
        />
      </div>

      {/* Hisobot — grafiklar */}
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* DAU */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Kunlik faol foydalanuvchilar"
            subtitle="So'nggi 14 kun"
            action={
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-primary-600">
                <Activity size={16} variant="Bulk" /> DAU
              </span>
            }
          />
          <div className="h-64 p-4 pt-2">
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
                  name="Faol"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#dauFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Device split + statuses */}
        <Card className="flex flex-col">
          <CardHeader title="Qurilma va holat" subtitle="Taqsimot" />
          <div className="flex-1 space-y-4 p-5 pt-3">
            <div>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Android size={15} variant="Bulk" className="text-primary-500" /> Android
                </span>
                <span className="font-semibold text-ink">
                  {formatNumber(APP_USER_STATS.android)} · {androidPct}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary-500" style={{ width: `${androidPct}%` }} />
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-medium text-ink">
                  <Apple size={15} variant="Bulk" className="text-ink-soft" /> iOS
                </span>
                <span className="font-semibold text-ink">
                  {formatNumber(APP_USER_STATS.ios)} · {100 - androidPct}%
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
                    {formatNumber(APP_USER_STATS[s])}
                  </div>
                  <div className="text-[11px] text-ink-muted">{APP_USER_STATUS_META[s].label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Growth + Top users */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Ro'yxatdan o'tish o'sishi" subtitle="So'nggi 8 oy · yangi va jami" />
          <div className="h-56 p-4 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={APP_USER_GROWTH} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
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
                <Bar dataKey="yangi" name="Yangi" fill="#3b82f6" radius={[6, 6, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader
            title="Eng faol foydalanuvchilar"
            action={<Cup size={18} variant="Bulk" className="text-amber-500" />}
          />
          <div className="space-y-1 p-3">
            {topUsers.map((u, i) => (
              <button
                key={u.id}
                onClick={() => setSelected(u)}
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
            placeholder="Ism, telefon yoki mahalla bo'yicha qidirish..."
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} />
          <Select value={sortKey} onChange={setSortKey} options={SORT_OPTIONS} icon={Sort} />
        </div>
      </div>

      {/* User list */}
      <Card className="overflow-hidden">
        <div className="hidden border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted md:grid md:grid-cols-12 md:gap-4">
          <div className="col-span-4">Foydalanuvchi</div>
          <div className="col-span-2">Mahalla</div>
          <div className="col-span-2 text-center">Murojaat</div>
          <div className="col-span-2 text-center">Oxirgi faollik</div>
          <div className="col-span-2 text-right">Holat</div>
        </div>
        <div className="divide-y divide-line">
          {filtered.map((u, i) => {
            const st = APP_USER_STATUS_META[u.status];
            return (
              <motion.button
                key={u.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.015, 0.25) }}
                onClick={() => setSelected(u)}
                className="grid w-full grid-cols-1 items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-surface-2 md:grid-cols-12 md:gap-4"
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
                <div className="col-span-2 flex items-center justify-between md:justify-end">
                  <Badge tone={st.tone} dot>
                    {st.label}
                  </Badge>
                  <ArrowRight size={16} className="ml-2 hidden text-ink-muted md:block" />
                </div>
              </motion.button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-ink-muted">
            <CloseCircle size={32} variant="Bulk" />
            Foydalanuvchi topilmadi
          </div>
        )}
      </Card>

      <AppUserDetail user={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
