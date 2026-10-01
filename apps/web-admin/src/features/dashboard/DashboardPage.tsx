import { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageQuestion,
  TickCircle,
  Clock,
  ArrowRight,
  CalendarTick,
  Video,
  WalletMoney,
  Location,
  Speaker,
  CloseCircle,
  RotateRight,
  Warning2,
  Star1,
  Timer1,
  ShieldTick,
  UserRemove,
  Danger,
} from 'iconsax-react';
import { StatCard } from '@/shared/ui/StatCard';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Progress } from '@/shared/ui/Progress';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Skeleton, SkeletonRow } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { CATEGORY_META, NEWS_META, PRIORITY_META, STATUS_META } from '@/shared/data/mock';
import type { Priority } from '@/shared/data/types';
import { formatNumber, formatSomShort, timeAgo } from '@/shared/lib/format';
import { useNews } from '@/features/news/useNews';
import { useAnalyticsSummary } from './api/hooks';
import {
  formatDuration,
  periodDelta,
  useOverview,
  type Overview,
  type TrendPoint,
} from './api/overview';
import { DashboardMap } from './DashboardMap';

const PRIORITY_COLOR: Record<Priority, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#94a3b8',
};

interface TooltipItem {
  name: string;
  value: number;
  color?: string;
  fill?: string;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      <p className="mb-1 text-xs font-semibold text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{formatNumber(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

const pctText = (v: number | null) => (v == null ? '—' : `${v}%`);
const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });

export function DashboardPage() {
  const overviewQ = useOverview();
  const data = overviewQ.data;
  const [focusCode, setFocusCode] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Boshqaruv paneli"
        subtitle="Mirzo Ulug'bek tumani · jonli ma'lumotlar"
        action={
          <div className="flex items-center gap-2">
            {data && (
              <span className="hidden text-xs text-ink-muted sm:inline">
                Yangilandi: {clock(data.generatedAt)}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => overviewQ.refetch()}
              disabled={overviewQ.isFetching}
              aria-label="Yangilash"
            >
              <RotateRight size={15} className={cn(overviewQ.isFetching && 'animate-spin')} />
              <span className="hidden sm:inline">Yangilash</span>
            </Button>
          </div>
        }
      />

      {overviewQ.isError && !data ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <CloseCircle size={36} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ko'rsatkichlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {overviewQ.error instanceof Error ? overviewQ.error.message : "Noma'lum xatolik"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => overviewQ.refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          <KpiRow data={data} />

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <TrendCard data={data} className="xl:col-span-2" />
            <QualityCard data={data} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Tuman xaritasi"
                subtitle="Mahallalar ochiq murojaatlar bo'yicha bo'yalgan · nuqtalar — ochiq murojaatlar va xodimlar"
              />
              <div className="p-3">
                {data ? (
                  <DashboardMap
                    pins={data.pins}
                    mahallaLoads={data.mahallas}
                    focusCode={focusCode}
                    onFocus={setFocusCode}
                  />
                ) : (
                  <Skeleton className="h-[340px] sm:h-[420px]" />
                )}
              </div>
            </Card>
            <MahallaCard data={data} focusCode={focusCode} onFocus={setFocusCode} />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            <WorkforceCard data={data} />
            <TopEmployeesCard data={data} />
            <CategoryCard data={data} className="md:col-span-2 xl:col-span-1" />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <RecentCard data={data} className="xl:col-span-2" />
            <ModulesCard />
          </div>

          <NewsCard />
        </>
      )}
    </div>
  );
}

/* ───────────────────────────── KPI row ───────────────────────────── */

function KpiRow({ data }: { data: Overview | undefined }) {
  if (!data) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[150px] rounded-2xl" />
        ))}
      </div>
    );
  }
  const m = data.murojaat;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatCard
        icon={MessageQuestion}
        label="Jami murojaatlar"
        value={formatNumber(m.total)}
        delta={periodDelta(m.created30, m.createdPrev30)}
        deltaLabel="30 kun"
        hint={`So'nggi 30 kunda ${formatNumber(m.created30)} ta`}
        tint="#3b82f6"
        index={0}
        to="/requests"
      />
      <StatCard
        icon={Clock}
        label="Ochiq murojaatlar"
        value={formatNumber(m.open)}
        hint={
          m.unassigned > 0 ? (
            <span className="font-medium text-amber-600">{m.unassigned} tasi biriktirilmagan</span>
          ) : (
            `${m.new} yangi · ${m.inProgress} jarayonda`
          )
        }
        tint="#f59e0b"
        index={1}
        to="/requests"
      />
      <StatCard
        icon={Warning2}
        label="Muddati o'tgan"
        value={formatNumber(m.overdue)}
        hint={
          m.dueSoon > 0 ? `${m.dueSoon} tasining muddati 24 soatda` : 'Yaqin muddatlilar yo\'q'
        }
        tint={m.overdue > 0 ? '#ef4444' : '#10b981'}
        index={2}
        to="/requests"
      />
      <StatCard
        icon={TickCircle}
        label="Hal qilingan"
        value={formatNumber(m.resolved)}
        delta={periodDelta(m.resolved30, m.resolvedPrev30)}
        deltaLabel="30 kun"
        hint={`Hal qilish darajasi ${pctText(m.resolutionRate)}`}
        tint="#10b981"
        index={3}
        to="/requests"
      />
    </div>
  );
}

/* ───────────────────────────── Trend ───────────────────────────── */

function TrendCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const [range, setRange] = useState<'daily' | 'monthly'>('daily');
  const points: TrendPoint[] = useMemo(() => (data ? data.trend[range] : []), [data, range]);
  const empty = points.every((p) => p.created === 0 && p.resolved === 0);
  const totals = useMemo(
    () => points.reduce((a, p) => ({ c: a.c + p.created, r: a.r + p.resolved }), { c: 0, r: 0 }),
    [points],
  );

  return (
    <Card className={className}>
      <CardHeader
        title="Murojaatlar dinamikasi"
        subtitle={
          data
            ? `${range === 'daily' ? "So'nggi 30 kun" : "So'nggi 12 oy"}: ${formatNumber(totals.c)} kelgan · ${formatNumber(totals.r)} hal qilingan`
            : 'Kelgan va hal qilingan murojaatlar'
        }
        action={
          <div className="flex rounded-lg border border-line bg-surface-2 p-0.5 text-xs font-semibold">
            {(['daily', 'monthly'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  'rounded-md px-2.5 py-1.5 transition-colors',
                  range === r ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {r === 'daily' ? '30 kun' : '12 oy'}
              </button>
            ))}
          </div>
        }
      />
      <div className="h-72 p-3">
        {!data ? (
          <Skeleton className="h-full" />
        ) : empty ? (
          <div className="flex h-full items-center justify-center text-sm text-ink-muted">
            Bu davrda murojaat bo'lmagan
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={18}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="created"
                name="Kelgan"
                stroke="#3b82f6"
                strokeWidth={2.5}
                fill="url(#gCreated)"
              />
              <Area
                type="monotone"
                dataKey="resolved"
                name="Hal qilingan"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#gResolved)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Quality / SLA ───────────────────────────── */

function QualityCard({ data }: { data: Overview | undefined }) {
  const m = data?.murojaat;
  const slaColor =
    m?.slaRate == null ? '#94a3b8' : m.slaRate >= 85 ? '#10b981' : m.slaRate >= 60 ? '#f59e0b' : '#ef4444';
  const prioTotal = m ? m.openByPriority.high + m.openByPriority.medium + m.openByPriority.low : 0;

  return (
    <Card className="flex flex-col">
      <CardHeader title="Xizmat sifati" subtitle="SLA, tezlik va fuqarolar bahosi" />
      {!m ? (
        <div className="space-y-4 p-5">
          <Skeleton className="h-16" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
          <Skeleton className="h-10" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 p-5">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                <ShieldTick size={16} variant="Bulk" style={{ color: slaColor }} />
                Muddatida hal qilingan
              </span>
              <span className="text-xl font-bold tabular-nums" style={{ color: slaColor }}>
                {pctText(m.slaRate)}
              </span>
            </div>
            <Progress value={m.slaRate ?? 0} height={8} color={slaColor} />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              SLA: yuqori — 48 soat, o'rta — 5 kun, past — 10 kun
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Metric
              icon={<Timer1 size={15} variant="Bulk" className="text-accent-500" />}
              label="O'rtacha hal qilish"
              value={formatDuration(m.avgResolutionHours)}
            />
            <Metric
              icon={<Star1 size={15} variant="Bold" className="text-amber-500" />}
              label={`Baho · ${m.ratedCount} ta`}
              value={m.avgRating == null ? '—' : `${m.avgRating} / 5`}
            />
          </div>

          <div className="mt-auto">
            <div className="mb-1.5 flex items-center justify-between text-[13px]">
              <span className="text-ink-soft">Ochiqlar ustuvorligi</span>
              <span className="font-semibold text-ink tabular-nums">{prioTotal}</span>
            </div>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
              {(['high', 'medium', 'low'] as const).map((p) =>
                m.openByPriority[p] > 0 ? (
                  <div
                    key={p}
                    style={{
                      width: `${(m.openByPriority[p] / prioTotal) * 100}%`,
                      background: PRIORITY_COLOR[p],
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-soft">
              {(['high', 'medium', 'low'] as const).map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLOR[p] }} />
                  {PRIORITY_META[p].label}: <b className="text-ink">{m.openByPriority[p]}</b>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/60 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-lg font-bold text-ink tabular-nums">{value}</div>
    </div>
  );
}

/* ───────────────────────────── Mahallas ───────────────────────────── */

function MahallaCard({
  data,
  focusCode,
  onFocus,
}: {
  data: Overview | undefined;
  focusCode: string | null;
  onFocus: (code: string | null) => void;
}) {
  const rows = data?.mahallas.slice(0, 8) ?? [];
  const max = Math.max(1, ...rows.map((r) => r.open));
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Mahallalar yuklamasi"
        subtitle="Ochiq murojaatlar soni bo'yicha · bosing — xaritada"
      />
      <div className="flex-1 p-3">
        {!data ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : rows.length === 0 ? (
          <div className="flex h-full min-h-40 flex-col items-center justify-center gap-1 text-center text-sm text-ink-muted">
            <Location size={28} variant="Bulk" className="text-ink-muted/60" />
            Joylashuvi ko'rsatilgan murojaat hali yo'q
          </div>
        ) : (
          <ul className="space-y-1">
            {rows.map((r, i) => (
              <li key={r.code}>
                <button
                  type="button"
                  onClick={() => onFocus(focusCode === r.code ? null : r.code)}
                  className={cn(
                    'w-full rounded-xl px-2.5 py-2 text-left transition-colors',
                    focusCode === r.code ? 'bg-primary-50' : 'hover:bg-surface-2',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-4 shrink-0 text-xs font-semibold text-ink-muted tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                      {r.name}
                    </span>
                    {r.overdue > 0 && (
                      <span
                        title="Muddati o'tgan"
                        className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-red-700"
                      >
                        {r.overdue}
                      </span>
                    )}
                    <span className="w-6 text-right text-sm font-bold text-ink tabular-nums">
                      {r.open}
                    </span>
                  </div>
                  <div className="ml-6 mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(r.open / max) * 100}%`,
                        background: r.overdue > 0 ? '#ef4444' : '#f59e0b',
                      }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Workforce ───────────────────────────── */

function WorkforceCard({ data }: { data: Overview | undefined }) {
  const w = data?.workforce;
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-accent-600">
            <CalendarTick size={19} variant="Bulk" />
          </span>
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Xodimlar · bugun</h3>
            <p className="text-xs text-ink-muted">Davomat va joylashuv</p>
          </div>
        </div>
        <Link
          to="/attendance"
          aria-label="Davomat"
          className="rounded-lg p-1.5 text-primary-600 hover:bg-primary-50"
        >
          <ArrowRight size={18} />
        </Link>
      </div>
      {!w ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10" />
          <Skeleton className="h-2.5" />
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
          <Skeleton className="h-24" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <span className="text-3xl font-bold text-ink tabular-nums">{w.checkedIn}</span>
              <span className="text-sm text-ink-muted"> / {w.total} ishga keldi</span>
            </div>
            <span className="pb-1 text-xs font-semibold text-ink-soft">
              O'z vaqtida: {pctText(w.onTimeRate)}
            </span>
          </div>
          <Progress
            value={w.total ? (w.checkedIn / w.total) * 100 : 0}
            height={7}
            color="#0ea5e9"
            className="mt-2"
          />
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStat label="Kechikdi" value={w.lateToday} tone={w.lateToday ? 'amber' : 'ink'} />
            <MiniStat
              label="Kelmadi"
              value={w.notCheckedIn}
              tone={w.notCheckedIn ? 'red' : 'ink'}
            />
            <MiniStat label="Jami" value={w.total} tone="ink" />
          </div>

          <Link
            to="/map"
            className="mt-4 block rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
          >
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Location size={14} variant="Bulk" className="text-primary-600" /> Jonli joylashuv
              </span>
              <span className="text-ink-muted">{w.reportingNow} faol</span>
            </div>
            <div className="space-y-1.5 text-[13px]">
              <Row dot="#10b981" label="Hududida" value={w.insideZone} />
              <Row dot="#ef4444" label="Hududdan tashqarida" value={w.outsideZone} />
              <Row dot="#94a3b8" label={`Aloqa yo'q (${w.staleMinutes}+ daq)`} value={w.stale} />
              {w.neverReported > 0 && (
                <Row dot="#cbd5e1" label="Ilova ishga tushmagan" value={w.neverReported} />
              )}
            </div>
          </Link>
        </>
      )}
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'ink' | 'amber' | 'red';
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <div
        className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function Row({ dot, label, value }: { dot: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-ink-soft">
        <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
        {label}
      </span>
      <span className="font-semibold text-ink tabular-nums">{value}</span>
    </div>
  );
}

/* ───────────────────────────── Top employees ───────────────────────────── */

function TopEmployeesCard({ data }: { data: Overview | undefined }) {
  const rows = data?.topEmployees.slice(0, 6) ?? [];
  return (
    <Card className="flex flex-col">
      <CardHeader
        title="Xodimlar reytingi"
        subtitle="Hal qilgan murojaatlari va bahosi bo'yicha"
        action={
          <Link to="/oversight" className="text-[13px] font-medium text-primary-600 hover:underline">
            Nazorat
          </Link>
        }
      />
      <div className="flex-1 p-3">
        {!data ? (
          Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
        ) : rows.length === 0 ? (
          <div className="flex h-full min-h-40 items-center justify-center text-center text-sm text-ink-muted">
            Hali hech kimga murojaat biriktirilmagan
          </div>
        ) : (
          rows.map((e, i) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
              <span
                className={cn(
                  'w-5 shrink-0 text-center text-xs font-bold tabular-nums',
                  i === 0 ? 'text-amber-500' : 'text-ink-muted',
                )}
              >
                {i + 1}
              </span>
              <Avatar name={e.fullName} src={e.avatarUrl ?? undefined} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{e.fullName}</p>
                <p className="truncate text-[11px] text-ink-muted">
                  {e.open} ochiq
                  {e.overdue > 0 && <span className="text-red-600"> · {e.overdue} kechikkan</span>}
                  {e.position && ` · ${e.position}`}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-ink tabular-nums">{e.resolved}</p>
                <p className="flex items-center justify-end gap-0.5 text-[11px] text-ink-muted">
                  {e.avgRating != null ? (
                    <>
                      <Star1 size={11} variant="Bold" className="text-amber-500" />
                      {e.avgRating}
                    </>
                  ) : (
                    'hal qildi'
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Categories ───────────────────────────── */

function CategoryCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const rows = (data?.categories ?? []).slice().sort((a, b) => b.total - a.total);
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title="Yo'nalishlar" subtitle="Jami va ochiq murojaatlar" />
      <div className="flex-1 space-y-3 p-5">
        {!data
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)
          : rows.map((c) => {
              const meta = CATEGORY_META[c.category];
              return (
                <div key={c.category}>
                  <div className="mb-1 flex items-center justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-ink-soft">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.color }} />
                      {meta.label}
                    </span>
                    <span className="tabular-nums text-ink">
                      <b>{c.total}</b>
                      {c.open > 0 && <span className="text-ink-muted"> · {c.open} ochiq</span>}
                    </span>
                  </div>
                  <div className="relative h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full opacity-35"
                      style={{ width: `${(c.total / max) * 100}%`, background: meta.color }}
                    />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ width: `${(c.open / max) * 100}%`, background: meta.color }}
                    />
                  </div>
                </div>
              );
            })}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Recent ───────────────────────────── */

function RecentCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const navigate = useNavigate();
  return (
    <Card className={className}>
      <CardHeader
        title="So'nggi murojaatlar"
        subtitle="Eng yangi kelganlari · bosing — batafsil"
        action={
          <Link
            to="/requests"
            className="flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline"
          >
            Barchasi <ArrowRight size={15} />
          </Link>
        }
      />
      <div className="p-3">
        {!data ? (
          Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
        ) : data.recent.length === 0 ? (
          <div className="py-16 text-center text-sm text-ink-muted">Hali murojaat kelmagan</div>
        ) : (
          data.recent.map((r, i) => {
            const cat = CATEGORY_META[r.category];
            return (
              <motion.button
                key={r.id}
                type="button"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => navigate(`/requests?id=${encodeURIComponent(r.id)}`)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                  style={{ background: `${cat.color}1a`, color: cat.color }}
                >
                  {cat.label[0]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                    <span className="truncate">{r.title}</span>
                    {r.kind === 'shikoyat' && (
                      <span className="shrink-0 rounded bg-danger-soft px-1 text-[10px] font-semibold text-red-700">
                        Shikoyat
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-ink-muted">
                    {r.citizenName}
                    {r.address && ` · ${r.address}`} · {timeAgo(r.createdAt)}
                  </p>
                </div>
                {r.assignee && (
                  <span className="hidden sm:block" title={r.assignee.fullName}>
                    <Avatar
                      name={r.assignee.fullName}
                      src={r.assignee.avatarUrl ?? undefined}
                      size={28}
                    />
                  </span>
                )}
                {r.overdue && (
                  <span title="Muddati o'tgan" className="shrink-0 text-red-500">
                    <Danger size={16} variant="Bold" />
                  </span>
                )}
                {!r.assignee && r.status === 'new' && r.source === 'citizen' && (
                  <span title="Biriktirilmagan" className="hidden shrink-0 text-amber-500 sm:block">
                    <UserRemove size={16} variant="Bulk" />
                  </span>
                )}
                <Badge tone={STATUS_META[r.status].tone} dot>
                  {STATUS_META[r.status].label}
                </Badge>
              </motion.button>
            );
          })
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────────── Other modules ───────────────────────────── */

function ModulesCard() {
  const q = useAnalyticsSummary();
  const s = q.data;
  return (
    <Card className="flex flex-col p-5">
      <h3 className="text-[15px] font-semibold text-ink">Boshqa modullar</h3>
      <p className="mt-0.5 text-xs text-ink-muted">Video kuzatuv va kommunal to'lovlar</p>
      {q.isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : !s ? (
        <div className="mt-4 flex flex-1 flex-col items-center justify-center gap-2 text-sm text-ink-muted">
          Yuklab bo'lmadi
          <Button variant="secondary" size="sm" onClick={() => q.refetch()}>
            <RotateRight size={14} /> Qayta urinish
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <Link
            to="/cameras"
            className="block rounded-xl border border-line p-3.5 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <Video size={17} variant="Bulk" className="text-indigo-500" /> Kameralar
              </span>
              <span className="text-sm font-bold text-ink tabular-nums">
                {s.camerasOnline}/{s.camerasTotal}
              </span>
            </div>
            <Progress
              value={s.camerasTotal ? (s.camerasOnline / s.camerasTotal) * 100 : 0}
              height={6}
              color="#6366f1"
              className="mt-2"
            />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {s.camerasTotal - s.camerasOnline} ta o'chgan · 24 soatda{' '}
              {formatNumber(s.detections24h)} aniqlash
            </p>
          </Link>
          <Link
            to="/finance"
            className="block rounded-xl border border-line p-3.5 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                <WalletMoney size={17} variant="Bulk" className="text-primary-600" /> Kommunal
                yig'im
              </span>
              <span className="text-sm font-bold text-ink tabular-nums">{s.collectionRate}%</span>
            </div>
            <Progress value={s.collectionRate} height={6} color="#10b981" className="mt-2" />
            <p className="mt-1.5 text-[11px] text-ink-muted">
              {formatSomShort(s.utilityCollected)} yig'ildi · qarz {formatSomShort(s.utilityDebt)}
            </p>
          </Link>
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────────── News ───────────────────────────── */

function NewsCard() {
  const newsQ = useNews();
  const news = (Array.isArray(newsQ.data) ? newsQ.data : [])
    .filter((n) => n.status === 'published')
    .slice(0, 4);
  if (!newsQ.isLoading && news.length === 0) return null;
  return (
    <Card className="mt-5 p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Speaker size={18} variant="Bulk" className="text-primary-600" />
            So'nggi yangiliklar
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">Tuman hokimiyati rasmiy e'lonlari</p>
        </div>
        <Link
          to="/news"
          className="flex items-center gap-1 text-[13px] font-medium text-primary-600 hover:underline"
        >
          Barchasi <ArrowRight size={15} />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {newsQ.isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-line">
                <Skeleton className="h-28 rounded-none" />
                <div className="space-y-2 p-3">
                  <Skeleton className="h-3 rounded-md" />
                  <Skeleton className="h-3 w-2/3 rounded-md" />
                </div>
              </div>
            ))
          : news.map((n, i) => {
              const meta = NEWS_META[n.category];
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3) }}
                >
                  <Link
                    to="/news"
                    className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-all hover:-translate-y-0.5 hover:shadow-pop"
                  >
                    <div className="relative h-28 overflow-hidden bg-surface-2">
                      <img
                        src={n.cover}
                        alt=""
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <span
                        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: meta.color }}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex flex-1 flex-col p-3">
                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-ink transition-colors group-hover:text-primary-600">
                        {n.title}
                      </p>
                      <span className="mt-auto pt-2 text-[11px] text-ink-muted">
                        {timeAgo(n.publishedAt)}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
      </div>
    </Card>
  );
}
