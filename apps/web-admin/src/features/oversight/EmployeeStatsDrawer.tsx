import { useState } from 'react';
import { Clock, CloseCircle, DocumentDownload, RotateRight, TickCircle, Timer1 } from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { exportToExcel, type ExportColumn } from '@/shared/lib/export';
import { useEmployeeStats, periodRange, type StatsPeriod, type DayStat } from './useEmployeeStats';

const PERIODS: { key: StatsPeriod; label: string }[] = [
  { key: 'thisMonth', label: 'Bu oy' },
  { key: 'lastMonth', label: "O'tgan oy" },
  { key: 'last7', label: 'Oxirgi 7 kun' },
];

function hhmm(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dmy(date: string): string {
  const [y, m, d] = date.split('-');
  return `${d}.${m}.${y}`;
}

/**
 * Xodim detali — davr bo'yicha (bu oy / o'tgan oy / oraliq) ishlagan soat,
 * kelgan kunlar, kechikishlar + kunlik jadval + Excel. "Ustiga bosilganda"
 * o'ng tarafdan ochiladi.
 */
export function EmployeeStatsDrawer({
  employeeId,
  fullName,
  position,
  avatarUrl,
  onClose,
}: {
  employeeId: string | null;
  fullName?: string;
  position?: string;
  avatarUrl?: string | null;
  onClose: () => void;
}) {
  const [period, setPeriod] = useState<StatsPeriod>('thisMonth');
  const { data, isLoading, isError, refetch } = useEmployeeStats(employeeId, period);

  function handleExport() {
    if (!data) return;
    const cols: ExportColumn<DayStat>[] = [
      { header: 'Sana', value: (d) => dmy(d.date) },
      { header: 'Keldi', value: (d) => hhmm(d.checkIn) },
      { header: 'Ketdi', value: (d) => hhmm(d.checkOut) },
      { header: 'Soat', value: (d) => d.hours, align: 'right', total: (rs) => rs.reduce((a, r) => a + r.hours, 0).toFixed(1) },
      { header: 'Kechikish (daq)', value: (d) => d.lateMinutes, align: 'right', total: (rs) => String(rs.reduce((a, r) => a + r.lateMinutes, 0)) },
    ];
    const { label } = periodRange(period);
    exportToExcel(`${fullName ?? 'xodim'}_${period}`, cols, data.days, {
      title: `${fullName ?? ''} — davomat (${label})`,
      subtitle: "Mirzo Ulug'bek tumani hokimligi",
      sheet: 'Davomat',
    });
  }

  return (
    <Drawer open={!!employeeId} onClose={onClose} title="Xodim tafsiloti" subtitle={fullName} width={520}>
      {employeeId && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={fullName ?? ''} src={avatarUrl ?? undefined} size={46} />
            <div className="min-w-0">
              <div className="truncate font-semibold text-ink">{fullName}</div>
              <div className="truncate text-[12.5px] text-ink-muted">{position}</div>
            </div>
          </div>

          {/* Davr tanlagich */}
          <div className="mt-4 flex flex-wrap gap-2">
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
            <Button variant="secondary" onClick={handleExport} disabled={!data || data.days.length === 0} className="ml-auto">
              <DocumentDownload size={16} /> Excel
            </Button>
          </div>

          {isLoading ? (
            <div className="mt-4 space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />
              ))}
            </div>
          ) : isError ? (
            <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
              <CloseCircle size={30} variant="Bulk" className="text-danger" />
              <p className="text-sm text-ink-muted">Statistikani yuklab bo'lmadi</p>
              <button onClick={() => refetch()} className="mt-1 flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-soft hover:bg-surface">
                <RotateRight size={15} /> Qayta urinish
              </button>
            </div>
          ) : data ? (
            <>
              {/* Stat kartalari */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <StatBox icon={Clock} tint="#3b82f6" label="Jami soat" value={`${data.totalHours} s`} />
                <StatBox icon={TickCircle} tint="#10b981" label="Kelgan kunlar" value={String(data.daysPresent)} />
                <StatBox icon={Timer1} tint="#f59e0b" label="Kechikkan kunlar" value={String(data.daysLate)} />
                <StatBox icon={Timer1} tint="#ef4444" label="Jami kechikish" value={`${data.totalLateMinutes} daq`} />
              </div>

              {/* Kunlik jadval */}
              <div className="mt-4 overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-line bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-semibold">Sana</th>
                      <th className="px-3 py-2 font-semibold">Keldi</th>
                      <th className="px-3 py-2 font-semibold">Ketdi</th>
                      <th className="px-3 py-2 text-right font-semibold">Soat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.days.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-8 text-center text-ink-muted">Bu davrda davomat yo'q</td>
                      </tr>
                    ) : (
                      data.days.map((d) => (
                        <tr key={d.date} className="border-b border-line/60">
                          <td className="px-3 py-2 text-ink-soft">{dmy(d.date)}</td>
                          <td className={cn('px-3 py-2 tabular-nums', d.late ? 'font-semibold text-amber-600' : 'text-ink-soft')}>
                            {hhmm(d.checkIn)}
                            {d.late && <span className="ml-1 text-[10.5px]">(+{d.lateMinutes}′)</span>}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-ink-soft">{hhmm(d.checkOut)}</td>
                          <td className="px-3 py-2 text-right font-medium tabular-nums text-ink">{d.hours ? `${d.hours}` : '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </div>
      )}
    </Drawer>
  );
}

function StatBox({ icon: Icon, tint, label, value }: { icon: typeof Clock; tint: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${tint}1a`, color: tint }}>
        <Icon size={17} variant="Bulk" />
      </span>
      <p className="mt-2 text-[17px] font-bold tabular-nums text-ink">{value}</p>
      <p className="text-[12px] text-ink-muted">{label}</p>
    </div>
  );
}
