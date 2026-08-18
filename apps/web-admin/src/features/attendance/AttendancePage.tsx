import { useMemo, useState } from 'react';
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
  ShieldTick,
  ShieldCross,
  Timer1,
  Profile2User,
  Clock,
  RotateRight,
  SearchNormal1,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { StatCard } from '@/shared/ui/StatCard';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { DateRangePicker } from '@/shared/ui/DatePicker';
import { cn } from '@/shared/lib/cn';
import { useAttendanceToday, todayIso } from './useAttendanceToday';
import { useAttendanceMonthlyReport } from './useAttendanceMonthlyReport';
import { AttendanceRangeView } from './AttendanceRangeView';
import type { EmployeeTodayEntry, TodayAttendanceStatus } from './api/types';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      {label && <p className="mb-1 text-xs font-semibold text-ink">{label}</p>}
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Har bir davomat holati uchun o'zbekcha yorliq va Badge rangi. */
const STATUS_META: Record<
  TodayAttendanceStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }
> = {
  present: { label: 'Keldi', tone: 'success' },
  late: { label: 'Kechikdi', tone: 'warning' },
  absent: { label: 'Kelmadi', tone: 'danger' },
  left: { label: 'Ketdi', tone: 'info' },
};

const FILTERS: { key: TodayAttendanceStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'present', label: 'Keldi' },
  { key: 'late', label: 'Kechikdi' },
  { key: 'absent', label: 'Kelmadi' },
  { key: 'left', label: 'Ketdi' },
];

/** Backend rasm/avatar rangi bermaydi — id bo'yicha barqaror rang tanlaymiz. */
const AVATAR_TINTS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

function formatClock(iso: string): string {
  return new Intl.DateTimeFormat('uz-UZ', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function AttendancePage() {
  // Sana oraligʻi: from===to bo'lsa bitta kun (kunlik davomat taxtasi),
  // aks holda oraliq (AttendanceRangeView — jami koʻrsatkichlar).
  const [range, setRange] = useState({ from: todayIso(), to: todayIso() });
  const isSingleDay = range.from === range.to;
  const date = range.from;
  const isToday = date === todayIso();
  const [filter, setFilter] = useState<TodayAttendanceStatus | 'all'>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading, isFetching, isError, error, refetch } = useAttendanceToday(date);

  const [year, month] = useMemo(() => date.split('-').map(Number), [date]);
  const monthly = useAttendanceMonthlyReport(year, month);

  const roster: EmployeeTodayEntry[] = data?.roster ?? [];
  const summary = data?.summary;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter(
      (r) =>
        (filter === 'all' || r.status === filter) &&
        (!q ||
          r.fullName.toLowerCase().includes(q) ||
          (r.position ?? '').toLowerCase().includes(q) ||
          (r.department ?? '').toLowerCase().includes(q)),
    );
  }, [roster, filter, query]);

  const checkedIn = summary ? summary.total - summary.absent : 0;
  const workingNow = roster.filter((r) => r.checkIn && !r.checkOut).length;
  const insideCount = roster.filter((r) => r.checkIn?.insideGeofence).length;
  const outsideCount = Math.max(checkedIn - insideCount, 0);

  const geofenceDonut = [
    { name: 'Ichkarida', value: insideCount, fill: '#10b981' },
    { name: 'Tashqarida', value: outsideCount, fill: '#ef4444' },
  ];

  const monthlyBars = useMemo(() => {
    if (!monthly.data) return [];
    const lateIncidents = monthly.data.perEmployee.reduce((s, e) => s + e.lateCount, 0);
    return [
      { label: 'Kechikish holatlari', value: lateIncidents, fill: '#f59e0b' },
      { label: 'Kelmagan xodimlar', value: monthly.data.absentees.length, fill: '#ef4444' },
    ];
  }, [monthly.data]);

  return (
    <div>
      <PageHeader
        title="Davomat"
        subtitle="Ishga kelish/ketish vaqti va geofence nazorati"
        action={
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && isSingleDay && (
              <span className="text-xs text-ink-muted">Yangilanmoqda...</span>
            )}
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
          </div>
        }
      />

      {isError ? (
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
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
            ) : (
              <>
                <StatCard
                  icon={LoginCurve}
                  label="Ishga keldi"
                  value={`${checkedIn}/${summary?.total ?? 0}`}
                  tint="#10b981"
                  index={0}
                />
                <StatCard icon={Profile2User} label="Hozir ishda" value={String(workingNow)} tint="#3b82f6" index={1} />
                <StatCard
                  icon={ShieldTick}
                  label="Hududda"
                  value={`${insideCount}/${checkedIn}`}
                  tint="#22c55e"
                  index={2}
                />
                <StatCard icon={Timer1} label="Kechikdi" value={String(summary?.late ?? 0)} tint="#f59e0b" index={3} />
                <StatCard icon={CloseCircle} label="Kelmadi" value={String(summary?.absent ?? 0)} tint="#ef4444" index={4} />
                <StatCard icon={LogoutCurve} label="Ketdi" value={String(summary?.left ?? 0)} tint="#a855f7" index={5} />
              </>
            )}
          </div>

          {/* Charts */}
          <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Oylik ko'rsatkichlar"
                subtitle={`${String(month).padStart(2, '0')}.${year} — kechikish va kelmaslik holatlari`}
              />
              <div className="h-72 p-3">
                {monthly.isLoading ? (
                  <Skeleton className="h-full" />
                ) : monthly.isError ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-ink-muted">
                    <span>Oylik statistika mavjud emas</span>
                    <Button variant="secondary" size="sm" onClick={() => monthly.refetch()}>
                      <RotateRight size={14} /> Qayta urinish
                    </Button>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyBars} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                      <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f6f8fb' }} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={64}>
                        {monthlyBars.map((b) => (
                          <Cell key={b.label} fill={b.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Geofence taqsimoti" subtitle="Ishga kelganlar orasida" />
              <div className="relative h-52 p-3">
                {isLoading ? (
                  <Skeleton className="h-full" />
                ) : checkedIn === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-ink-muted">
                    Hali hech kim kelmadi
                  </div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={geofenceDonut} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                          {geofenceDonut.map((d) => (
                            <Cell key={d.name} fill={d.fill} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-ink">
                        {checkedIn > 0 ? Math.round((insideCount / checkedIn) * 100) : 0}%
                      </span>
                      <span className="text-xs text-ink-muted">ichkarida</span>
                    </div>
                  </>
                )}
              </div>
              {!isLoading && checkedIn > 0 && (
                <div className="flex items-center justify-center gap-4 pb-5 text-xs">
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary-500" /> Ichkarida ({insideCount})
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Tashqarida ({outsideCount})
                  </span>
                </div>
              )}
            </Card>
          </div>

          {/* Kunlik jadval */}
          <Card className="mt-5 overflow-hidden">
            <CardHeader
              title="Davomat jadvali"
              subtitle={isToday ? "Bugungi kun bo'yicha" : `${date} kuni bo'yicha`}
              action={
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative">
                    <SearchNormal1
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
                    />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Xodim qidirish..."
                      aria-label="Xodim qidirish"
                      className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 sm:w-52"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {FILTERS.map((f) => (
                      <button
                        key={f.key}
                        onClick={() => setFilter(f.key)}
                        className={cn(
                          'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
                          filter === f.key
                            ? 'bg-ink text-white'
                            : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
              }
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="px-5 py-3 font-semibold">Xodim</th>
                    <th className="px-3 py-3 font-semibold">Bo'lim</th>
                    <th className="px-3 py-3 font-semibold">Holat</th>
                    <th className="px-3 py-3 font-semibold">Keldi</th>
                    <th className="px-3 py-3 font-semibold">Ketdi</th>
                    <th className="px-3 py-3 font-semibold">Soat</th>
                    <th className="px-3 py-3 font-semibold">Geofence</th>
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
                    : rows.map((r, i) => (
                        <motion.tr
                          key={r.employeeId}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: Math.min(i * 0.03, 0.3) }}
                          className="border-b border-line/70 transition-colors hover:bg-surface-2"
                        >
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.fullName} color={tintFor(r.employeeId)} size={36} />
                              <div>
                                <div className="font-medium text-ink">{r.fullName}</div>
                                <div className="text-[11px] text-ink-muted">{r.position}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-ink-soft">{r.department ?? '—'}</td>
                          <td className="px-3 py-3">
                            <Badge tone={STATUS_META[r.status].tone} dot>
                              {STATUS_META[r.status].label}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 font-medium text-ink">
                              <LoginCurve size={15} className="text-success" />
                              {r.checkIn ? formatClock(r.checkIn.time) : '—'}
                            </span>
                            {r.checkIn?.isLate && (
                              <span className="mt-0.5 block text-[11px] font-medium text-amber-600">
                                kechikdi {r.checkIn.lateMinutes} daqiqa
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 text-ink-soft">
                              <LogoutCurve size={15} className="text-danger" />
                              {r.checkOut ? formatClock(r.checkOut.time) : r.checkIn ? 'Ishda' : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className="flex items-center gap-1.5 text-ink-soft">
                              <Clock size={14} className="text-ink-muted" />
                              {r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            {r.checkIn ? (
                              r.checkIn.insideGeofence ? (
                                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-600">
                                  <ShieldTick size={15} variant="Bulk" /> Ichkarida
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[12px] font-medium text-red-600">
                                  <ShieldCross size={15} variant="Bulk" /> Tashqarida
                                </span>
                              )
                            ) : (
                              <span className="text-ink-muted">—</span>
                            )}
                          </td>
                        </motion.tr>
                      ))}
                </tbody>
              </table>
            </div>
            {!isLoading && rows.length === 0 && (
              <div className="py-16 text-center text-ink-muted">
                {query.trim() ? `"${query}" bo'yicha xodim topilmadi` : "Bu holatda xodim yo'q"}
              </div>
            )}
          </Card>
        </>
      ) : (
        <AttendanceRangeView from={range.from} to={range.to} query={query} onQuery={setQuery} />
      )}
    </div>
  );
}
