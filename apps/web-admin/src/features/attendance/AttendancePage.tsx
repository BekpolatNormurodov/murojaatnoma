import { useMemo, useState } from 'react';
import { Pagination } from '@/shared/ui/Pagination';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { motion } from 'framer-motion';
import {
  LoginCurve,
  LogoutCurve,
  CloseCircle,
  ShieldCross,
  Timer1,
  Profile2User,
  Clock,
  RotateRight,
  SearchNormal1,
  Location,
  ArrowRight2,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { StatCard } from '@/shared/ui/StatCard';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { DateRangePicker } from '@/shared/ui/DatePicker';
import { Skeleton } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { EmployeeStatsDrawer } from '@/features/oversight/EmployeeStatsDrawer';
import { useAttendanceToday, todayIso } from './useAttendanceToday';
import { useAttendanceMonthlyReport } from './useAttendanceMonthlyReport';
import { AttendanceRangeView } from './AttendanceRangeView';
import {
  ATTENDANCE_STATUS_META,
  clockOf,
  hoursText,
  leaveText,
  minutesText,
} from './attendanceMeta';
import type { EmployeeTodayEntry } from './api/types';

interface TooltipEntry {
  name?: string;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      {label && <p className="mb-1 text-xs font-semibold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          {p.name}: <span className="font-semibold text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

type FilterKey = 'all' | 'working' | 'late' | 'absent' | 'left' | 'leave' | 'issues';

const early = (r: EmployeeTodayEntry) => r.earlyLeaveMinutes ?? 0;
const failedCount = (r: EmployeeTodayEntry) => r.failedScans?.length ?? 0;
const outOfZone = (r: EmployeeTodayEntry) =>
  !!r.checkIn && !r.checkOut && !!r.live && !r.live.stale && !r.live.insideZone;
const hasIssue = (r: EmployeeTodayEntry) => failedCount(r) > 0 || early(r) > 0 || outOfZone(r);

const FILTERS: { key: FilterKey; label: string; test: (r: EmployeeTodayEntry) => boolean }[] = [
  { key: 'all', label: 'Barchasi', test: () => true },
  { key: 'working', label: 'Ishda', test: (r) => !!r.checkIn && !r.checkOut },
  { key: 'late', label: 'Kechikdi', test: (r) => !!r.checkIn?.isLate },
  // Ta'tildagi / dam olish kunidagi xodim "kelmadi" emas.
  { key: 'absent', label: 'Kelmadi', test: (r) => r.status === 'absent' },
  { key: 'left', label: 'Ketdi', test: (r) => !!r.checkOut },
  { key: 'leave', label: "Ta'tilda", test: (r) => r.status === 'leave' },
  { key: 'issues', label: 'Muammoli', test: hasIssue },
];

/** Backend rasm/avatar rangi bermaydi — id bo'yicha barqaror rang tanlaymiz. */
const AVATAR_TINTS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (Number.isFinite(h) ? h : 9) * 60 + (Number.isFinite(m) ? m : 0);
}
const hhmmOf = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const BUCKET = 15;

/** Kelish vaqtlari 15 daqiqalik oraliqlarda (ish boshlanishidan 1 soat oldin → 2 soat keyin). */
function arrivalBuckets(roster: EmployeeTodayEntry[], workStart: string) {
  const start = minutesOfDay(workStart);
  const lo = start - 60;
  const hi = start + 120;
  const buckets: { label: string; onTime: number; late: number }[] = [
    { label: `${hhmmOf(lo)} gacha`, onTime: 0, late: 0 },
  ];
  for (let t = lo; t < hi; t += BUCKET) buckets.push({ label: hhmmOf(t), onTime: 0, late: 0 });
  buckets.push({ label: `${hhmmOf(hi)} dan keyin`, onTime: 0, late: 0 });

  for (const r of roster) {
    if (!r.checkIn) continue;
    const d = new Date(r.checkIn.time);
    const m = d.getHours() * 60 + d.getMinutes();
    const idx = m < lo ? 0 : m >= hi ? buckets.length - 1 : 1 + Math.floor((m - lo) / BUCKET);
    if (r.checkIn.isLate) buckets[idx].late += 1;
    else buckets[idx].onTime += 1;
  }
  return buckets;
}

function dayTitle(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function AttendancePage() {
  // Sana oraligʻi: from===to bo'lsa bitta kun (kunlik davomat taxtasi),
  // aks holda oraliq (AttendanceRangeView — jami koʻrsatkichlar).
  const [range, setRange] = useState({ from: todayIso(), to: todayIso() });
  const isSingleDay = range.from === range.to;
  const date = range.from;
  const isToday = date === todayIso();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<EmployeeTodayEntry | null>(null);

  const { data, isLoading, isFetching, isError, error, refetch, dataUpdatedAt } =
    useAttendanceToday(date);

  const [year, month] = useMemo(() => date.split('-').map(Number), [date]);
  const monthly = useAttendanceMonthlyReport(year, month);

  const roster = useMemo<EmployeeTodayEntry[]>(
    () => (Array.isArray(data?.roster) ? data.roster : []),
    [data],
  );
  const summary = data?.summary;
  const workStart = data?.workStartTime ?? '09:00';
  const workEnd = data?.workEndTime ?? '18:00';

  // Yangi backend summary'da hammasini beradi; eskisida roster'dan hisoblaymiz.
  const stats = useMemo(() => {
    const checkedIn = summary?.checkedIn ?? roster.filter((r) => r.checkIn).length;
    const lateRows = roster.filter((r) => r.checkIn?.isLate);
    const hasLive = roster.some((r) => r.live);
    const working = roster.filter((r) => r.checkIn && !r.checkOut);
    return {
      total: summary?.total ?? roster.length,
      checkedIn,
      workingNow: summary?.workingNow ?? working.length,
      lateTotal: summary?.lateTotal ?? lateRows.length,
      lateMinutes: lateRows.reduce((s, r) => s + (r.checkIn?.lateMinutes ?? 0), 0),
      onTime: summary?.onTime ?? checkedIn - lateRows.length,
      absent: summary?.absent ?? roster.filter((r) => r.status === 'absent').length,
      onLeave: summary?.onLeave ?? roster.filter((r) => r.status === 'leave').length,
      left: summary?.left ?? roster.filter((r) => r.checkOut).length,
      earlyLeave: summary?.earlyLeave ?? roster.filter((r) => early(r) > 0).length,
      withFailed: summary?.withFailedScans ?? roster.filter((r) => failedCount(r) > 0).length,
      insideNow: hasLive
        ? working.filter((r) => r.live && !r.live.stale && r.live.insideZone).length
        : null,
    };
  }, [roster, summary]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, roster.filter(f.test).length])),
    [roster],
  ) as Record<FilterKey, number>;

  const rows = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    return roster.filter(
      (r) =>
        test(r) &&
        // Kirill/lotin farqisiz qidiruv.
        matchesSearch(query, r.fullName, r.position, r.department),
    );
  }, [roster, filter, query]);

  const [rawPage, setPage] = useState(1);
  const PAGE_SIZE = 12;
  // Jonli yangilanishda ro'yxat qisqarsa — mavjud oxirgi sahifaga tushamiz.
  const page = Math.min(rawPage, Math.max(1, Math.ceil(rows.length / PAGE_SIZE)));
  const paged = useMemo(() => rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [rows, page]);
  const pickFilter = (key: FilterKey) => {
    setFilter(key);
    setPage(1);
  };
  const changeQuery = (q: string) => {
    setQuery(q);
    setPage(1);
  };
  const changeRange = (r: { from: string; to: string }) => {
    setRange(r);
    setPage(1);
  };

  const arrivals = useMemo(() => arrivalBuckets(roster, workStart), [roster, workStart]);

  const statusDonut = [
    { name: 'Ishda (o‘z vaqtida)', value: summary?.present ?? 0, fill: '#10b981' },
    { name: 'Ishda (kechikib)', value: summary?.late ?? 0, fill: '#f59e0b' },
    { name: 'Ketdi', value: summary?.left ?? 0, fill: '#6366f1' },
    { name: 'Kelmadi', value: summary?.absent ?? 0, fill: '#ef4444' },
    ...(stats.onLeave ? [{ name: "Ta'tilda", value: stats.onLeave, fill: '#0ea5e9' }] : []),
  ];
  // Kutilganlar = jami − ta'tildagilar (ta'tildagi xodim davomatni tushirmaydi).
  const expected = Math.max(stats.total - stats.onLeave, 0);
  const attendancePct = expected ? Math.min(100, Math.round((stats.checkedIn / expected) * 100)) : 0;
  const dayOff = data?.isWorkday === false;

  const monthLine = useMemo(() => {
    if (!monthly.data) return null;
    const lateIncidents = monthly.data.perEmployee.reduce((s, e) => s + e.lateCount, 0);
    return `Bu oy: ${lateIncidents} ta kechikish · ${monthly.data.absentees.length} xodim umuman kelmagan`;
  }, [monthly.data]);

  return (
    <div>
      <PageHeader
        title="Davomat"
        subtitle="Ishga kelish/ketish, kechikish va joylashuv nazorati"
        action={
          <div className="flex items-center gap-2">
            {isSingleDay && isToday && dataUpdatedAt > 0 && (
              <span className="hidden items-center gap-1.5 text-xs text-ink-muted sm:flex">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
                </span>
                {isFetching ? 'Yangilanmoqda…' : `Jonli · ${clockOf(new Date(dataUpdatedAt).toISOString())}`}
              </span>
            )}
            <DateRangePicker from={range.from} to={range.to} onChange={changeRange} />
          </div>
        }
      />

      {isError && !data ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : isSingleDay ? (
        <>
          {dayOff && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[13px] text-ink-soft">
              <Clock size={18} variant="Bulk" className="shrink-0 text-ink-muted" />
              {isToday ? 'Bugun' : 'Bu kun'} dam olish kuni — kelmaganlar "Kelmadi" deb hisoblanmaydi. Kelganlar
              odatdagidek ko‘rinadi.
            </div>
          )}

          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[132px]" />)
            ) : (
              <>
                <StatCard
                  icon={LoginCurve}
                  label="Ishga keldi"
                  value={`${stats.checkedIn}/${stats.total}`}
                  hint={`O'z vaqtida: ${stats.onTime}`}
                  tint="#10b981"
                  index={0}
                />
                <StatCard
                  icon={Profile2User}
                  label="Hozir ishda"
                  value={String(stats.workingNow)}
                  hint={stats.insideNow != null ? `Hududida: ${stats.insideNow}` : `Ish vaqti ${workStart}–${workEnd}`}
                  tint="#3b82f6"
                  index={1}
                />
                <StatCard
                  icon={Timer1}
                  label="Kechikdi"
                  value={String(stats.lateTotal)}
                  hint={stats.lateMinutes ? `Jami ${minutesText(stats.lateMinutes)}` : 'Kechikish yo‘q'}
                  tint="#f59e0b"
                  index={2}
                />
                <StatCard
                  icon={CloseCircle}
                  label="Kelmadi"
                  value={dayOff ? '—' : String(stats.absent)}
                  hint={
                    dayOff
                      ? 'Dam olish kuni'
                      : stats.onLeave
                        ? `Ta'tilda: ${stats.onLeave} · davomat ${attendancePct}%`
                        : stats.total
                          ? `Davomat ${attendancePct}%`
                          : undefined
                  }
                  tint="#ef4444"
                  index={3}
                />
                <StatCard
                  icon={LogoutCurve}
                  label="Ketdi"
                  value={String(stats.left)}
                  hint={stats.earlyLeave ? `Erta ketdi: ${stats.earlyLeave}` : 'Erta ketgan yo‘q'}
                  tint="#6366f1"
                  index={4}
                />
                <StatCard
                  icon={ShieldCross}
                  label="Rad etilgan urinish"
                  value={String(stats.withFailed)}
                  hint="Yuz yoki joy mos kelmagan"
                  tint="#e11d48"
                  index={5}
                />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Kelish vaqti"
                subtitle={
                  monthLine
                    ? `Ish boshlanishi ${workStart} · ${monthLine}`
                    : `Ish boshlanishi ${workStart} · 15 daqiqalik oraliqlarda`
                }
              />
              <div className="h-72 p-3">
                {isLoading ? (
                  <Skeleton className="h-full" />
                ) : stats.checkedIn === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                    {isToday ? 'Hali hech kim kelmadi' : "Bu kunda davomat yo'q"}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={arrivals} margin={{ top: 10, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line, #eaeef3)" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        minTickGap={8}
                      />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
                      <Bar dataKey="onTime" name="O'z vaqtida" stackId="a" fill="#10b981" maxBarSize={36} />
                      <Bar dataKey="late" name="Kechikib" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Holat taqsimoti" subtitle={isToday ? 'Hozirgi holat' : dayTitle(date)} />
              <div className="relative h-52 p-3">
                {isLoading ? (
                  <Skeleton className="h-full" />
                ) : stats.total === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                    Xodimlar yo'q
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusDonut} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                          {statusDonut.map((d) => (
                            <Cell key={d.name} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-ink">{attendancePct}%</span>
                      <span className="text-xs text-ink-muted">davomat</span>
                    </div>
                  </>
                )}
              </div>
              {!isLoading && stats.total > 0 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 pb-5 text-xs">
                  {statusDonut.map((d) => (
                    <span key={d.name} className="flex items-center justify-between gap-2 text-ink-soft">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.fill }} />
                        {d.name}
                      </span>
                      <span className="font-semibold tabular-nums text-ink">{d.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Kunlik jadval */}
          <Card className="mt-5 overflow-hidden">
            <CardHeader
              title="Davomat jadvali"
              subtitle={`${isToday ? "Bugungi kun bo'yicha" : `${dayTitle(date)} kuni bo'yicha`} · tafsilot uchun xodimni bosing`}
            />
            <div className="flex flex-col gap-2 px-5 pt-1 lg:flex-row lg:items-center lg:justify-between">
              <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => pickFilter(f.key)}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                      filter === f.key
                        ? 'bg-ink text-white dark:bg-primary-600'
                        : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                      f.key === 'issues' && counts.issues > 0 && filter !== 'issues' && 'border-red-200 text-red-600',
                    )}
                  >
                    {f.label}
                    {!isLoading && (
                      <span
                        className={cn(
                          'rounded-md px-1.5 text-[11px] tabular-nums',
                          filter === f.key ? 'bg-white/20' : 'bg-surface-2',
                        )}
                      >
                        {counts[f.key]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="relative">
                <SearchNormal1 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  value={query}
                  onChange={(e) => changeQuery(e.target.value)}
                  placeholder="Xodim qidirish..."
                  aria-label="Xodim qidirish"
                  className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 lg:w-56"
                />
              </div>
            </div>

            {/* Telefon: kartalar */}
            <div className="mt-3 divide-y divide-line/70 border-t border-line md:hidden">
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-12" />
                    </div>
                  ))
                : paged.map((r) => (
                    <button
                      key={r.employeeId}
                      onClick={() => setSelected(r)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                    >
                      <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} color={tintFor(r.employeeId)} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[13.5px] font-semibold text-ink">{r.fullName}</span>
                          {failedCount(r) > 0 && <ShieldCross size={14} variant="Bold" className="shrink-0 text-red-500" />}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                          <span className="tabular-nums">
                            {clockOf(r.checkIn?.time)} → {r.checkOut ? clockOf(r.checkOut.time) : r.checkIn ? 'ishda' : '—'}
                          </span>
                          {r.checkIn?.isLate && (
                            <span className="font-medium text-amber-600">+{minutesText(r.checkIn.lateMinutes)}</span>
                          )}
                          {early(r) > 0 && <span className="font-medium text-red-600">−{minutesText(early(r))}</span>}
                        </div>
                      </div>
                      <Badge tone={ATTENDANCE_STATUS_META[r.status].tone} className="shrink-0">
                        {ATTENDANCE_STATUS_META[r.status].label}
                      </Badge>
                    </button>
                  ))}
            </div>

            {/* Desktop: jadval */}
            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="px-5 py-3 font-semibold">Xodim</th>
                    <th className="px-3 py-3 font-semibold">Holat</th>
                    <th className="px-3 py-3 font-semibold">Keldi</th>
                    <th className="px-3 py-3 font-semibold">Ketdi</th>
                    <th className="px-3 py-3 font-semibold">Ishladi</th>
                    <th className="px-3 py-3 font-semibold">Joylashuv</th>
                    <th className="w-8 px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-line/70">
                          <td className="px-5 py-3.5" colSpan={7}>
                            <Skeleton className="h-8" />
                          </td>
                        </tr>
                      ))
                    : paged.map((r, i) => (
                        <motion.tr
                          key={r.employeeId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3) }}
                          onClick={() => setSelected(r)}
                          className="group cursor-pointer border-b border-line/70 transition-colors hover:bg-surface-2"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} color={tintFor(r.employeeId)} size={36} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 font-medium text-ink">
                                  {r.fullName}
                                  {failedCount(r) > 0 && (
                                    <span title={`${failedCount(r)} ta rad etilgan urinish`}>
                                      <ShieldCross size={14} variant="Bold" className="text-red-500" />
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-ink-muted">
                                  {[r.position, r.department].filter(Boolean).join(' · ')}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <Badge tone={ATTENDANCE_STATUS_META[r.status].tone} dot>
                              {ATTENDANCE_STATUS_META[r.status].label}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 font-medium tabular-nums text-ink">
                              <LoginCurve size={15} className="text-success" />
                              {clockOf(r.checkIn?.time)}
                            </span>
                            {r.checkIn?.isLate && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-600">
                                {minutesText(r.checkIn.lateMinutes)} kechikdi
                              </span>
                            )}
                            {r.excused && (
                              <span className="mt-0.5 block text-[11px] font-medium text-sky-600" title={r.leave ? leaveText(r.leave) : undefined}>
                                ruxsat bilan
                              </span>
                            )}
                            {!r.checkIn && r.leave && (
                              <span className="mt-0.5 block max-w-44 truncate text-[11px] text-ink-muted" title={leaveText(r.leave)}>
                                {leaveText(r.leave)}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 tabular-nums text-ink-soft">
                              <LogoutCurve size={15} className="text-danger" />
                              {r.checkOut ? clockOf(r.checkOut.time) : r.checkIn ? 'Ishda' : '—'}
                            </span>
                            {early(r) > 0 && (
                              <span className="mt-0.5 block text-[11px] font-medium text-red-600">
                                {minutesText(early(r))} erta
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 text-ink-soft">
                              <Clock size={14} className="text-ink-muted" />
                              {r.hoursWorked != null ? hoursText(r.hoursWorked) : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <LocationCell r={r} />
                          </td>
                          <td className="px-3 py-3 text-ink-muted">
                            <ArrowRight2 size={16} className="opacity-0 transition-opacity group-hover:opacity-100" />
                          </td>
                        </motion.tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!isLoading && rows.length === 0 && (
              <div className="py-16 text-center text-ink-muted">
                {query.trim()
                  ? `"${query}" bo'yicha xodim topilmadi`
                  : filter === 'issues'
                    ? "Muammo yo'q — hamma joyida"
                    : "Bu holatda xodim yo'q"}
              </div>
            )}
            {!isLoading && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onPage={setPage} className="border-t border-line" />
            )}
          </Card>
        </>
      ) : (
        <AttendanceRangeView from={range.from} to={range.to} query={query} onQuery={changeQuery} />
      )}

      <EmployeeStatsDrawer
        employeeId={selected?.employeeId ?? null}
        fullName={selected?.fullName}
        position={selected?.position}
        avatarUrl={selected?.avatarUrl}
        phone={selected?.phone}
        day={selected}
        dayLabel={isToday ? 'Bugun' : dayTitle(date)}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

/** Jonli joylashuv (yangi backend) yoki kelish paytidagi geofence (eski). */
function LocationCell({ r }: { r: EmployeeTodayEntry }) {
  if (r.live && r.checkIn && !r.checkOut) {
    const tone = r.live.stale ? 'text-ink-muted' : r.live.insideZone ? 'text-primary-600' : 'text-red-600';
    return (
      <span className={cn('flex items-center gap-1.5 text-[12px] font-medium', tone)}>
        <Location size={15} variant="Bulk" />
        <span className="max-w-40 truncate">
          {r.live.stale ? "Aloqa yo'q" : (r.live.mahallaName ?? (r.live.insideZone ? 'Hududida' : 'Tashqarida'))}
        </span>
      </span>
    );
  }
  if (!r.checkIn) return <span className="text-ink-muted">—</span>;
  return r.checkIn.insideGeofence ? (
    <span className="text-[12px] font-medium text-primary-600">Ofisda belgiladi</span>
  ) : (
    <span className="text-[12px] font-medium text-red-600">Ofisdan tashqarida</span>
  );
}
