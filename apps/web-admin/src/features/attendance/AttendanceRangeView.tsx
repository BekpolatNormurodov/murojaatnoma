import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  CloseCircle,
  LoginCurve,
  MedalStar,
  Profile2User,
  RotateRight,
  SearchNormal1,
  ShieldCross,
  Timer1,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { useAttendanceRangeReport } from './useAttendanceRangeReport';

const AVATAR_TINTS = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ef4444', '#06b6d4', '#ec4899', '#84cc16'];
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

/** Daqiqa -> "2s 15d" yoki "45d". */
function fmtMinutes(m: number): string {
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}s ${min}d` : `${min}d`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

interface RangeRow {
  employeeId: string;
  fullName: string;
  position: string;
  validScans: number;
  lateCount: number;
  lateMinutes: number;
  present: boolean;
}

/**
 * Oraliq (interval) ko'rinishi — tanlangan sana oraligʻi bo'yicha har bir
 * xodimning jami davomat koʻrsatkichlari (skanlar, kechikishlar) + oraliq
 * davomida umuman kelmagan xodimlar. `GET /attendance/report/range`.
 */
export function AttendanceRangeView({
  from,
  to,
  query,
  onQuery,
}: {
  from: string;
  to: string;
  query: string;
  onQuery: (v: string) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useAttendanceRangeReport(from, to);

  const rows = useMemo<RangeRow[]>(() => {
    const present: RangeRow[] = (data?.perEmployee ?? []).map((e) => ({
      employeeId: e.employeeId,
      fullName: e.fullName,
      position: e.position,
      validScans: e.validScans,
      lateCount: e.lateCount,
      lateMinutes: e.lateMinutes,
      present: true,
    }));
    const absent: RangeRow[] = (data?.absentees ?? []).map((a) => ({
      employeeId: a.employeeId,
      fullName: a.fullName,
      position: a.position,
      validScans: 0,
      lateCount: 0,
      lateMinutes: 0,
      present: false,
    }));
    return [...present, ...absent];
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.fullName.toLowerCase().includes(q) || r.position.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    const present = rows.filter((r) => r.present).length;
    const absent = rows.length - present;
    const lateIncidents = rows.reduce((s, r) => s + r.lateCount, 0);
    const lateMinutes = rows.reduce((s, r) => s + r.lateMinutes, 0);
    return { present, absent, lateIncidents, lateMinutes };
  }, [rows]);

  if (isError) {
    return (
      <Card className="mt-5 flex flex-col items-center gap-3 p-14 text-center">
        <CloseCircle size={40} variant="Bulk" className="text-danger" />
        <p className="mt-1 text-sm text-ink-muted">
          {error instanceof Error ? error.message : "Oraliq hisobotini yuklab bo'lmadi"}
        </p>
        <Button variant="secondary" onClick={() => refetch()}>
          <RotateRight size={16} /> Qayta urinish
        </Button>
      </Card>
    );
  }

  return (
    <>
      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
        ) : (
          <>
            <StatCard icon={Profile2User} label="Kelgan xodimlar" value={`${stats.present}/${stats.present + stats.absent}`} tint="#10b981" index={0} />
            <StatCard icon={Timer1} label="Kechikish holatlari" value={String(stats.lateIncidents)} tint="#f59e0b" index={1} />
            <StatCard icon={MedalStar} label="Jami kechikish" value={fmtMinutes(stats.lateMinutes)} tint="#3b82f6" index={2} />
            <StatCard icon={ShieldCross} label="Umuman kelmagan" value={String(stats.absent)} tint="#ef4444" index={3} />
          </>
        )}
      </div>

      {/* Jadval */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader
          title="Oraliq bo'yicha davomat"
          subtitle={`${from} — ${to}`}
          action={
            <div className="relative">
              <SearchNormal1 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Xodim qidirish..."
                aria-label="Xodim qidirish"
                className="h-9 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-[13px] text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 sm:w-52"
              />
            </div>
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-160 text-left text-sm">
            <thead>
              <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                <th className="px-5 py-3 font-semibold">Xodim</th>
                <th className="px-3 py-3 font-semibold">Holat</th>
                <th className="px-3 py-3 font-semibold">Skanlar</th>
                <th className="px-3 py-3 font-semibold">Kechikishlar</th>
                <th className="px-3 py-3 font-semibold">Jami kechikish</th>
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-line/70">
                      <td className="px-5 py-3.5" colSpan={5}>
                        <Skeleton className="h-8" />
                      </td>
                    </tr>
                  ))
                : filtered.map((r, i) => (
                    <motion.tr
                      key={r.employeeId}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.02, 0.3) }}
                      className="border-b border-line/70 transition-colors hover:bg-surface-2"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={r.fullName} color={tintFor(r.employeeId)} size={36} />
                          <div className="min-w-0">
                            <div className="truncate font-medium text-ink">{r.fullName || '—'}</div>
                            <div className="text-[11px] text-ink-muted">{r.position || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {r.present ? (
                          <Badge tone={r.lateCount > 0 ? 'warning' : 'success'} dot>
                            {r.lateCount > 0 ? 'Kechikkan' : 'Keldi'}
                          </Badge>
                        ) : (
                          <Badge tone="danger" dot>
                            Kelmadi
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 font-medium text-ink">
                          <LoginCurve size={15} className="text-success" />
                          {r.validScans || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{r.lateCount || '—'}</td>
                      <td className="px-3 py-3 text-ink-soft">{fmtMinutes(r.lateMinutes)}</td>
                    </motion.tr>
                  ))}
            </tbody>
          </table>
          {!isLoading && filtered.length === 0 && (
            <div className="py-16 text-center text-ink-muted">
              {query.trim() ? `"${query}" bo'yicha xodim topilmadi` : "Bu oraliqda ma'lumot yo'q"}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}
