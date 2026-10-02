import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { ArrowRight } from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Skeleton } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { formatNumber } from '@/shared/lib/format';
import type { Overview } from './api/overview';

const STATUS = [
  { key: 'new', label: 'Yangi', color: '#3b82f6' },
  { key: 'inProgress', label: 'Jarayonda', color: '#f59e0b' },
  { key: 'resolved', label: 'Hal qilingan', color: '#10b981' },
  { key: 'rejected', label: 'Rad etilgan', color: '#ef4444' },
] as const;

const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const WEEKDAYS_FULL = ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'];

function Tip({
  active,
  payload,
  label,
  suffix = '',
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; payload?: { fill?: string } }[];
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      {label && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-ink-soft">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color ?? p.payload?.fill }} />
          {p.name}: <b className="text-ink tabular-nums">{p.value}</b>
          {suffix}
        </p>
      ))}
    </div>
  );
}

/* ───────────────────────── Holat va tur ───────────────────────── */

/**
 * Murojaatlar holati (donut) + ariza/shikoyat ulushi — "hozir nima qayerda"
 * bir qarashda.
 */
export function StatusMixCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const m = data?.murojaat;
  const slices = m
    ? STATUS.map((s) => ({ ...s, value: m[s.key] })).filter((s) => s.value > 0)
    : [];
  const total = m?.total ?? 0;
  const kind = m?.byKind;

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader title="Holat va tur" subtitle="Barcha murojaatlar qayerda turibdi" />
      {!m ? (
        <div className="p-5">
          <Skeleton className="mx-auto h-44 w-44 rounded-full" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-4 px-5 pb-5">
          <div className="flex items-center gap-3">
            <div className="relative h-32 w-32 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={42}
                    outerRadius={60}
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    stroke="none"
                    isAnimationActive={false}
                  >
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<Tip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums text-ink">{formatNumber(total)}</span>
                <span className="text-[11px] text-ink-muted">jami</span>
              </div>
            </div>
            <ul className="min-w-0 flex-1 space-y-2">
              {STATUS.map((s) => {
                const v = m[s.key];
                return (
                  <li key={s.key} className="flex items-center gap-2 text-[13px]">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                    <span className="min-w-0 flex-1 truncate text-ink-soft">{s.label}</span>
                    <b className="tabular-nums text-ink">{v}</b>
                    <span className="w-8 text-right text-[11px] tabular-nums text-ink-muted">
                      {total ? `${Math.round((v / total) * 100)}%` : '—'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {kind && (
            <div className="mt-auto border-t border-line pt-4">
              <div className="mb-2 flex items-center justify-between text-[12.5px]">
                <span className="text-ink-soft">Ariza va shikoyat</span>
                <span className="text-ink-muted">ochiq</span>
              </div>
              {(
                [
                  ['Ariza', kind.ariza, '#3b82f6'],
                  ['Shikoyat', kind.shikoyat, '#ef4444'],
                ] as const
              ).map(([label, k, color]) => (
                <div key={label} className="mb-2 last:mb-0">
                  <div className="mb-1 flex items-center justify-between text-[12px]">
                    <span className="font-medium text-ink">{label}</span>
                    <span className="tabular-nums text-ink-soft">
                      <b className="text-ink">{k.total}</b> · {k.open} ochiq
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${total ? (k.total / total) * 100 : 0}%`, background: color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ───────────────────────── Davomat · 7 kun ───────────────────────── */

/** Oxirgi 7 kun: o'z vaqtida / kechikkan / kelmagan / ta'tilda — ustunli grafik. */
export function AttendanceWeekCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const week = data?.attendanceWeek;
  const stats = useMemo(() => {
    if (!week) return null;
    const work = week.filter((d) => d.isWorkday);
    const expected = work.reduce((s, d) => s + Math.max(0, d.total - d.onLeave), 0);
    const came = work.reduce((s, d) => s + d.onTime + d.late, 0);
    const late = work.reduce((s, d) => s + d.late, 0);
    return {
      rate: expected ? Math.round((came / expected) * 100) : null,
      late,
      absent: work.reduce((s, d) => s + d.absent, 0),
    };
  }, [week]);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title="Davomat · 7 kun"
        subtitle={
          stats
            ? `O'rtacha davomat ${stats.rate == null ? '—' : `${stats.rate}%`} · ${stats.late} kechikish · ${stats.absent} kelmagan`
            : 'Ish kunlari bo‘yicha'
        }
        action={
          <Link to="/attendance" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary-600 hover:underline">
            Davomat <ArrowRight size={14} />
          </Link>
        }
      />
      <div className="h-64 px-3 pb-3">
        {!week ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={week.map((d) => ({ ...d, label: d.isWorkday ? d.label : `${d.label}*` }))}
              margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
              barCategoryGap="22%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
              <Bar dataKey="onTime" name="O'z vaqtida" stackId="a" fill="#10b981" />
              <Bar dataKey="late" name="Kechikkan" stackId="a" fill="#f59e0b" />
              <Bar dataKey="onLeave" name="Ta'tilda" stackId="a" fill="#38bdf8" />
              <Bar dataKey="absent" name="Kelmagan" stackId="a" fill="#fca5a5" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-4 text-[11.5px] text-ink-soft">
        {(
          [
            ["O'z vaqtida", '#10b981'],
            ['Kechikkan', '#f59e0b'],
            ["Ta'tilda", '#38bdf8'],
            ['Kelmagan', '#fca5a5'],
          ] as const
        ).map(([l, c]) => (
          <span key={l} className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: c }} />
            {l}
          </span>
        ))}
        <span className="text-ink-muted">* dam olish kuni</span>
      </div>
    </Card>
  );
}

/* ───────────────────────── Faollik ───────────────────────── */

/** Fuqarolar qachon murojaat qiladi: soatlar va hafta kunlari (90 kun). */
export function ActivityCard({ data, className }: { data: Overview | undefined; className?: string }) {
  const a = data?.activity;
  const hours = useMemo(
    () => (a ? a.byHour.map((v, h) => ({ label: `${String(h).padStart(2, '0')}:00`, v })) : []),
    [a],
  );
  const total = a ? a.byHour.reduce((s, v) => s + v, 0) : 0;
  const peakHour = a ? a.byHour.indexOf(Math.max(...a.byHour)) : -1;
  const peakDay = a ? a.byWeekday.indexOf(Math.max(...a.byWeekday)) : -1;
  const maxDay = a ? Math.max(1, ...a.byWeekday) : 1;

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader
        title="Fuqarolar qachon yozadi"
        subtitle={
          !a
            ? 'Soatlar va hafta kunlari bo‘yicha'
            : total === 0
              ? 'Oxirgi 90 kunda murojaat yo‘q'
              : `Oxirgi 90 kun · eng faol: ${String(peakHour).padStart(2, '0')}:00–${String(peakHour + 1).padStart(2, '0')}:00, ${WEEKDAYS_FULL[peakDay]}`
        }
      />
      <div className="h-44 px-3">
        {!a ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={hours} margin={{ top: 8, right: 8, left: -22, bottom: 0 }} barCategoryGap="15%">
              <XAxis
                dataKey="label"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval={2}
              />
              <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<Tip suffix=" ta" />} cursor={{ fill: 'rgba(148,163,184,0.12)' }} />
              <Bar dataKey="v" name="Murojaat" radius={[4, 4, 0, 0]}>
                {hours.map((h, i) => (
                  <Cell key={h.label} fill={i === peakHour && total > 0 ? '#2563eb' : '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="mt-auto grid grid-cols-7 gap-1.5 px-5 pb-5 pt-2">
        {WEEKDAYS.map((d, i) => {
          const v = a?.byWeekday[i] ?? 0;
          return (
            <div key={d} className="flex flex-col items-center gap-1" title={`${WEEKDAYS_FULL[i]}: ${v} ta`}>
              <div className="flex h-12 w-full items-end overflow-hidden rounded-md bg-surface-2">
                <div
                  className="w-full rounded-md"
                  style={{
                    height: `${(v / maxDay) * 100}%`,
                    background: i === peakDay && v > 0 ? '#2563eb' : '#bfdbfe',
                  }}
                />
              </div>
              <span className="text-[10.5px] font-medium text-ink-muted">{d}</span>
              <span className="text-[11px] font-semibold tabular-nums text-ink">{v}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
