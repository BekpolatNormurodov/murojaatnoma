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
  TickCircle,
  CloseCircle,
  ShieldTick,
  ShieldCross,
  Timer1,
  Profile2User,
  Clock,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { StatCard } from '@/shared/ui/StatCard';
import { PageHeader } from '@/shared/ui/PageHeader';
import { ATTENDANCE_META, WORKERS } from '@/shared/data/mock';
import type { AttendanceStatus } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-pop">
      <p className="mb-1 text-xs font-semibold text-ink">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} className="flex items-center gap-2 text-xs text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color || p.fill }} />
          {p.name}: <span className="font-semibold text-ink">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

type TodayRow = {
  id: string;
  name: string;
  photo: string;
  color: string;
  position: string;
  region: string;
  status: AttendanceStatus;
  checkIn: string | null;
  checkOut: string | null;
  hours: number;
  confirmed: boolean;
  confirmedAt: string | null;
  inside: boolean;
};

export function AttendancePage() {
  const [filter, setFilter] = useState<AttendanceStatus | 'all'>('all');

  const today: TodayRow[] = useMemo(
    () =>
      WORKERS.map((w) => {
        const t = w.attendance[0];
        return {
          id: w.id,
          name: w.name,
          photo: w.photo,
          color: w.avatarColor,
          position: w.position,
          region: w.region,
          status: t.status,
          checkIn: t.checkIn,
          checkOut: t.checkOut,
          hours: t.hours,
          confirmed: t.selfConfirmed,
          confirmedAt: t.confirmedAt,
          inside: t.insideGeofence,
        };
      }),
    [],
  );

  const present = today.filter((t) => t.status === 'present').length;
  const late = today.filter((t) => t.status === 'late').length;
  const absent = today.filter((t) => t.status === 'absent').length;
  const confirmed = today.filter((t) => t.confirmed).length;
  const inside = today.filter((t) => t.inside).length;
  const checkedIn = today.filter((t) => t.checkIn).length;

  const trend = useMemo(() => {
    const days = 14;
    return Array.from({ length: days }).map((_, i) => {
      const off = days - 1 - i;
      let p = 0;
      let l = 0;
      let a = 0;
      let dateLabel = '';
      WORKERS.forEach((w) => {
        const d = w.attendance[off];
        if (!d) return;
        dateLabel = d.date;
        if (d.status === 'present') p++;
        else if (d.status === 'late') l++;
        else if (d.status === 'absent') a++;
      });
      const dt = dateLabel ? new Date(dateLabel) : new Date();
      return {
        label: new Intl.DateTimeFormat('uz-UZ', { day: '2-digit', month: '2-digit' }).format(dt),
        Keldi: p,
        Kechikdi: l,
        Kelmadi: a,
      };
    });
  }, []);

  const confirmDonut = [
    { name: 'Tasdiqladi', value: confirmed, fill: '#10b981' },
    { name: 'Tasdiqlamadi', value: WORKERS.length - confirmed, fill: '#e2e8f0' },
  ];

  const rows = today.filter((t) => filter === 'all' || t.status === filter);

  const FILTERS: { key: AttendanceStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Barchasi' },
    { key: 'present', label: 'Keldi' },
    { key: 'late', label: 'Kechikdi' },
    { key: 'absent', label: 'Kelmadi' },
  ];

  return (
    <div>
      <PageHeader
        title="Davomat"
        subtitle="Ishga kelish/ketish vaqti, kunlik o'z-o'zini tasdiqlash va geofence nazorati"
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard icon={LoginCurve} label="Ishga keldi" value={`${checkedIn}/${WORKERS.length}`} tint="#10b981" index={0} />
        <StatCard icon={TickCircle} label="O'zini tasdiqladi" value={`${confirmed}/${WORKERS.length}`} tint="#3b82f6" index={1} />
        <StatCard icon={ShieldTick} label="Hududda" value={`${inside}/${WORKERS.length}`} tint="#22c55e" index={2} />
        <StatCard icon={Timer1} label="Kechikdi" value={String(late)} tint="#f59e0b" index={3} />
        <StatCard icon={CloseCircle} label="Kelmadi" value={String(absent)} tint="#ef4444" index={4} />
        <StatCard icon={Profile2User} label="Hozir faol" value={String(present + late)} tint="#a855f7" index={5} />
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="2 haftalik davomat" subtitle="Kunlik kelgan / kechikkan / kelmagan xodimlar" />
          <div className="h-72 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 10, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eaeef3" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f6f8fb' }} />
                <Bar dataKey="Keldi" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={26} />
                <Bar dataKey="Kechikdi" stackId="a" fill="#f59e0b" maxBarSize={26} />
                <Bar dataKey="Kelmadi" stackId="a" fill="#ef4444" radius={[5, 5, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Bugungi tasdiq" subtitle="O'zini kunlik tasdiqlash" />
          <div className="relative h-52 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={confirmDonut} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">
                  {confirmDonut.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-ink">
                {Math.round((confirmed / WORKERS.length) * 100)}%
              </span>
              <span className="text-xs text-ink-muted">tasdiqladi</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-4 pb-5 text-xs">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-primary-500" /> Tasdiqladi ({confirmed})
            </span>
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-200" /> Yo'q ({WORKERS.length - confirmed})
            </span>
          </div>
        </Card>
      </div>

      {/* Today table */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Bugungi davomat jadvali"
          subtitle="Har bir xodimning ishga kelish va ketish vaqti"
          action={
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
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-190 text-left text-sm">
            <thead>
              <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Xodim</th>
                <th className="px-3 py-3 font-semibold">Hudud</th>
                <th className="px-3 py-3 font-semibold">Holat</th>
                <th className="px-3 py-3 font-semibold">Keldi</th>
                <th className="px-3 py-3 font-semibold">Ketdi</th>
                <th className="px-3 py-3 font-semibold">Soat</th>
                <th className="px-3 py-3 font-semibold">Geofence</th>
                <th className="px-5 py-3 font-semibold">Tasdiq</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t, i) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  className="border-b border-line/70 transition-colors hover:bg-surface-2"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={t.name} src={t.photo} color={t.color} size={36} />
                      <div>
                        <div className="font-medium text-ink">{t.name}</div>
                        <div className="text-[11px] text-ink-muted">{t.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-ink-soft">{t.region}</td>
                  <td className="px-3 py-3">
                    <Badge tone={ATTENDANCE_META[t.status].tone} dot>
                      {ATTENDANCE_META[t.status].label}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 font-medium text-ink">
                      <LoginCurve size={15} className="text-success" />
                      {t.checkIn ?? '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <LogoutCurve size={15} className="text-danger" />
                      {t.checkOut ?? (t.checkIn ? 'Ishda' : '—')}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <Clock size={14} className="text-ink-muted" />
                      {t.hours > 0 ? `${t.hours}h` : '—'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {t.checkIn ? (
                      t.inside ? (
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
                  <td className="px-5 py-3">
                    {t.confirmed ? (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-600">
                        <TickCircle size={15} variant="Bulk" /> {t.confirmedAt}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-muted">
                        <CloseCircle size={15} variant="Bulk" /> Yo'q
                      </span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="py-16 text-center text-ink-muted">Bu holatda xodim yo'q</div>
        )}
      </Card>
    </div>
  );
}
