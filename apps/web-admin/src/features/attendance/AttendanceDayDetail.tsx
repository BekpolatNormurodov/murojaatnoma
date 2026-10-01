import { Link } from 'react-router-dom';
import { LoginCurve, LogoutCurve, Location, ShieldCross, Warning2 } from 'iconsax-react';
import { Badge } from '@/shared/ui/Badge';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import type { EmployeeTodayEntry } from './api/types';
import {
  ATTENDANCE_STATUS_META,
  clockOf,
  distanceText,
  hoursText,
  humanizeScanReason,
  leaveText,
  minutesText,
} from './attendanceMeta';

/**
 * Bitta xodimning bir kunlik davomati: keldi/ketdi (vaqt, kechikish, yuz
 * moslik bali, ofisgacha masofa), rad etilgan urinishlar va jonli joylashuv.
 * Xodim drawer'ining yuqorisida ko'rsatiladi.
 */
export function AttendanceDayDetail({
  entry,
  dayLabel,
}: {
  entry: EmployeeTodayEntry;
  dayLabel: string;
}) {
  const meta = ATTENDANCE_STATUS_META[entry.status];
  const early = entry.earlyLeaveMinutes ?? 0;
  const failed = entry.failedScans ?? [];
  const schedule =
    entry.workStartTime && entry.workEndTime ? `${entry.workStartTime}–${entry.workEndTime}` : null;

  return (
    <section className="mt-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[14px] font-semibold text-ink">{dayLabel}</h4>
          {schedule && <p className="text-[12px] text-ink-muted">Ish vaqti {schedule}</p>}
        </div>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </div>

      {entry.leave && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-[12.5px] text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
          {leaveText(entry.leave)}
          {entry.excused && ' — kechikish/erta ketish hisoblanmaydi'}
        </p>
      )}

      <ol className="relative mt-4 space-y-4 border-l border-line pl-5">
        <TimelineItem
          icon={<LoginCurve size={14} />}
          tone={entry.checkIn ? (entry.checkIn.isLate ? 'warning' : 'success') : 'muted'}
          title="Keldi"
          time={entry.checkIn ? clockOf(entry.checkIn.time) : null}
        >
          {entry.checkIn ? (
            <>
              <span
                className={cn(
                  'font-medium',
                  entry.checkIn.isLate ? 'text-amber-600' : 'text-primary-600',
                )}
              >
                {entry.checkIn.isLate
                  ? `${minutesText(entry.checkIn.lateMinutes)} kechikdi`
                  : "O'z vaqtida"}
              </span>
              <ScanFacts
                faceScore={entry.checkIn.faceScore}
                distanceM={entry.checkIn.distanceM}
                inside={entry.checkIn.insideGeofence}
              />
            </>
          ) : (
            <span className="text-ink-muted">Ishga kelganini belgilamagan</span>
          )}
        </TimelineItem>

        <TimelineItem
          icon={<LogoutCurve size={14} />}
          tone={entry.checkOut ? (early > 0 ? 'danger' : 'info') : 'muted'}
          title="Ketdi"
          time={entry.checkOut ? clockOf(entry.checkOut.time) : null}
        >
          {entry.checkOut ? (
            <>
              <span className={cn('font-medium', early > 0 ? 'text-red-600' : 'text-ink-soft')}>
                {early > 0 ? `${minutesText(early)} erta ketdi` : 'Ish vaqti tugagach'}
                {entry.hoursWorked != null && ` · ${hoursText(entry.hoursWorked)} ishladi`}
              </span>
              <ScanFacts
                faceScore={entry.checkOut.faceScore}
                distanceM={entry.checkOut.distanceM}
                inside={entry.checkOut.insideGeofence}
              />
            </>
          ) : (
            <span className="text-ink-muted">{entry.checkIn ? 'Hali ishda' : '—'}</span>
          )}
        </TimelineItem>
      </ol>

      {failed.length > 0 && (
        <div className="mt-4 rounded-xl border border-red-200 bg-danger-soft p-3 dark:border-red-900/50">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-red-700 dark:text-red-400">
            <ShieldCross size={15} variant="Bulk" />
            Rad etilgan urinishlar · {failed.length}
          </p>
          <ul className="mt-2 space-y-1.5">
            {failed.map((f, i) => (
              <li key={i} className="flex gap-2 text-[12px] text-ink-soft">
                <span className="w-11 shrink-0 font-semibold tabular-nums text-ink">
                  {clockOf(f.time)}
                </span>
                <span className="min-w-0">
                  <span className="font-medium text-ink">
                    {f.type === 'CHECK_IN' ? 'Kelish' : 'Ketish'}:
                  </span>{' '}
                  {humanizeScanReason(f.reason)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entry.live && (
        <Link
          to={`/map?employee=${encodeURIComponent(entry.employeeId)}`}
          className="mt-4 flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2"
        >
          <span
            className={cn(
              'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
              entry.live.stale
                ? 'bg-surface-2 text-ink-muted'
                : entry.live.insideZone
                  ? 'bg-success-soft text-primary-600'
                  : 'bg-danger-soft text-red-600',
            )}
          >
            {entry.live.stale ? <Warning2 size={17} variant="Bulk" /> : <Location size={17} variant="Bulk" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">
              {entry.live.mahallaName ?? "Mahalla aniqlanmadi"}
            </span>
            <span className="block text-[12px] text-ink-muted">
              {entry.live.stale
                ? `Aloqa yo'q · oxirgi signal ${timeAgo(entry.live.at)}`
                : `${entry.live.insideZone ? 'Hududida' : 'Hududdan tashqarida'} · ${timeAgo(entry.live.at)}`}
            </span>
          </span>
          <span className="shrink-0 text-[12px] font-medium text-primary-600">Xaritada</span>
        </Link>
      )}
    </section>
  );
}

function TimelineItem({
  icon,
  tone,
  title,
  time,
  children,
}: {
  icon: React.ReactNode;
  tone: 'success' | 'warning' | 'danger' | 'info' | 'muted';
  title: string;
  time: string | null;
  children: React.ReactNode;
}) {
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[31px] top-0 grid h-[22px] w-[22px] place-items-center rounded-full ring-4 ring-surface',
          tone === 'success' && 'bg-primary-500 text-white',
          tone === 'warning' && 'bg-amber-500 text-white',
          tone === 'danger' && 'bg-red-500 text-white',
          tone === 'info' && 'bg-accent-500 text-white',
          tone === 'muted' && 'bg-surface-2 text-ink-muted',
        )}
      >
        {icon}
      </span>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="text-[15px] font-bold tabular-nums text-ink">{time ?? '—'}</span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">{children}</div>
    </li>
  );
}

function ScanFacts({
  faceScore,
  distanceM,
  inside,
}: {
  faceScore?: number;
  distanceM?: number;
  inside?: boolean;
}) {
  if (faceScore == null && distanceM == null) return null;
  return (
    <span className="flex flex-wrap gap-1.5">
      {faceScore != null && (
        <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-soft">
          Yuz {Math.round(faceScore * 100)}%
        </span>
      )}
      {distanceM != null && (
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[11px]',
            inside === false ? 'bg-danger-soft text-red-700' : 'bg-surface-2 text-ink-soft',
          )}
        >
          Ofisdan {distanceText(distanceM)}
        </span>
      )}
    </span>
  );
}
