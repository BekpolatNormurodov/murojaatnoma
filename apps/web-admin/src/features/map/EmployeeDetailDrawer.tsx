import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BatteryCharging,
  Buildings2,
  Call,
  CalendarTick,
  CloseCircle,
  Gps,
  LocationTick,
  Map1,
  Messages,
  Routing2,
  Timer1,
} from 'iconsax-react';
import type { LiveLocation, TrackPoint, TrackResult } from '@/shared/api/locations';
import type { EmployeeTodayEntry } from '@/features/attendance/api/types';
import { cn } from '@/shared/lib/cn';
import {
  absTime,
  clockTime,
  fixInZone,
  fmtDistance,
  haversineM,
  initials,
  isOnline,
  MAX_DRAW_ACCURACY_M,
  OFFICE_CENTER,
  OFFLINE_COLOR,
  ONLINE_COLOR,
  relTime,
  statusColor,
  statusKey,
  STATUS_COLORS,
  type Labels,
  type TrackSummary,
  type TrackWindow,
} from './mapShared';

/**
 * Auto-generated phones for employees added without one (`+99800…`, and the
 * older `+99890000NNNN` scheme). They are not real numbers — never offer a
 * call button for them.
 */
function isPlaceholderPhone(phone: string): boolean {
  return /^\+99800\d{7}$/.test(phone) || /^\+99890000\d{4}$/.test(phone);
}

// Track gaps ≥ this long are flagged as a "lokatsiya uzilgan" break in the route
// list (GPS off / no signal / app closed) — monitoring cue between two points.
const GAP_MIN_MS = 15 * 60 * 1000;

/** Human duration for a track gap: "45 daqiqa" / "4 soat 32 daqiqa". */
function fmtGap(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} daqiqa`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} soat ${m} daqiqa` : `${h} soat`;
}

const WINDOWS: { key: TrackWindow; label: (t: Labels) => string }[] = [
  { key: 'today', label: (t) => t.today },
  { key: '1h', label: (t) => t.lastHour },
  { key: '3h', label: (t) => t.last3h },
];

interface Props {
  loc: LiveLocation;
  track: TrackResult | undefined;
  trackLoading: boolean;
  trackWindow: TrackWindow;
  onTrackWindow: (w: TrackWindow) => void;
  summary: TrackSummary;
  /** Today's davomat entry (null when unavailable). */
  attendance: EmployeeTodayEntry | null;
  /** Names of the employee's assigned mahallas (empty = whole district). */
  assignedNames: string[];
  t: Labels;
  onClose: () => void;
  /** Fly the map to a track point when its row is clicked. */
  onFocusPoint: (p: TrackPoint) => void;
}

/**
 * Slide-in employee detail panel (right rail on ≥sm, bottom sheet on phones).
 * Renders identity, live status, distance/accuracy metrics and the selected
 * track window as a scrollable point list — the map draws the same track as a
 * polyline. Dismissible via the close button, the backdrop, or Escape.
 */
export function EmployeeDetailDrawer({
  loc,
  track,
  trackLoading,
  trackWindow,
  onTrackWindow,
  summary,
  attendance,
  assignedNames,
  t,
  onClose,
  onFocusPoint,
}: Props) {
  const navigate = useNavigate();
  const online = isOnline(loc);

  // Enter transition: mount off-screen, then slide in on the next frame.
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const color = statusColor(loc);
  const pos: [number, number] | null =
    loc.hasLocation && loc.latitude != null && loc.longitude != null
      ? [loc.latitude, loc.longitude]
      : null;
  // Prefer the server's per-employee office distance from the latest fix.
  const lastFix = track?.points[track.points.length - 1];
  const distanceM =
    lastFix?.distanceToOfficeM != null ? lastFix.distanceToOfficeM : pos ? haversineM(pos, OFFICE_CENTER) : null;
  const key = statusKey(loc);
  const statusText: Record<string, string> = {
    office: t.office,
    zone: t.zone,
    offzone: t.offzone,
    outside: t.outDistrict,
    stale: t.stale,
    noloc: t.noLocShort,
  };

  // Newest points first for the scroll list.
  const points = useMemo(
    () => (track?.points ? [...track.points].reverse() : []),
    [track],
  );

  return (
    <div className="absolute inset-0 z-[1300]">
      {/* Backdrop */}
      <button
        aria-label={t.close}
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-black/25"
      />

      {/* Panel: bottom sheet on phones, right rail on ≥sm */}
      <aside
        className={cn(
          'pointer-events-auto absolute flex flex-col overflow-hidden border-line bg-surface shadow-pop transition-transform duration-300 ease-out',
          'inset-x-0 bottom-0 max-h-[82%] rounded-t-2xl border-t',
          'sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:max-h-none sm:w-[360px] sm:rounded-t-none sm:rounded-l-2xl sm:border-l sm:border-t-0',
          shown
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-line p-4">
          {loc.avatarUrl ? (
            <img
              src={loc.avatarUrl}
              alt=""
              className="h-12 w-12 shrink-0 rounded-full object-cover ring-2 ring-white"
              style={{ boxShadow: `0 0 0 2px ${color}` }}
            />
          ) : (
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-base font-bold text-white ring-2 ring-white"
              style={{ background: color }}
            >
              {initials(loc.fullName)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-bold text-ink">
              {loc.fullName}
            </div>
            <div className="truncate text-xs text-ink-muted">
              {loc.position || '—'}
            </div>
            <div className="mt-1.5 text-[11px] text-ink-soft">
              {t.lastSeen}: {relTime(loc.lastLocationAt, t)}
              <span className="text-ink-muted"> · {absTime(loc.lastLocationAt)}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t.close}
            className="shrink-0 rounded-lg p-1 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <CloseCircle size={22} variant="Bold" />
          </button>
        </div>

        {/* Freshness (online/offline) + prominent last-update + message CTA.
            This is a separate axis from the geofence status badges below. */}
        <div className="border-b border-line px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold',
                online ? 'bg-emerald-50 text-emerald-700' : 'bg-surface-2 text-ink-muted',
              )}
            >
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: online ? ONLINE_COLOR : OFFLINE_COLOR }}
              />
              {online ? t.online : t.offline}
            </span>
            <span className="text-[11px] text-ink-soft">
              {t.lastUpdate}:{' '}
              <span className="font-semibold text-ink">
                {relTime(loc.lastLocationAt, t)}
              </span>
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => navigate(`/chat?to=${loc.employeeId}`)}
              aria-label={`${t.message} — ${loc.fullName}`}
              className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <Messages size={18} variant="Bold" />
              {t.message}
            </button>
            {loc.phone && !isPlaceholderPhone(loc.phone) && (
              <a
                href={`tel:${loc.phone}`}
                aria-label={`Qo'ng'iroq — ${loc.fullName} (${loc.phone})`}
                title={loc.phone}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-primary-200 bg-primary-50 px-4 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-100"
              >
                <Call size={18} variant="Bold" />
                {loc.phone}
              </a>
            )}
          </div>
        </div>

        {/* Status + assigned zone + today's davomat */}
        <div className="space-y-2 px-4 pt-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white"
              style={{ background: STATUS_COLORS[key] }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              {statusText[key]}
            </span>
            <span
              className="inline-flex min-w-0 items-center gap-1 rounded-full border border-dashed border-indigo-300 px-2.5 py-1 text-[11px] font-medium text-indigo-700 dark:border-indigo-500/50 dark:text-indigo-300"
              title={assignedNames.join(', ')}
            >
              <Map1 size={12} variant="Bulk" className="shrink-0" />
              <span className="truncate">
                {t.assignedZone}:{' '}
                {assignedNames.length === 0
                  ? t.wholeDistrict
                  : assignedNames.length <= 2
                    ? assignedNames.join(', ')
                    : `${assignedNames.length} ${t.mahallaUnit}`}
              </span>
            </span>
          </div>
          {attendance && (
            <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px]">
              <CalendarTick size={15} variant="Bulk" className="shrink-0 text-primary-600" />
              <span className="text-ink-muted">{t.attendance}:</span>
              {attendance.checkIn ? (
                <span className="min-w-0 truncate font-medium text-ink">
                  {t.cameAt} {clockTime(attendance.checkIn.time)}
                  {attendance.checkIn.isLate && (
                    <span className="text-amber-600"> (+{attendance.checkIn.lateMinutes}′)</span>
                  )}
                  {' · '}
                  {attendance.checkOut ? `${t.leftAt} ${clockTime(attendance.checkOut.time)}` : t.stillWorking}
                </span>
              ) : (
                <span className="font-medium text-red-600">{t.notCame}</span>
              )}
            </div>
          )}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-2 p-4">
          <Metric
            icon={<Buildings2 size={15} variant="Bulk" />}
            label={t.curMahalla}
            value={loc.mahallaName ?? '—'}
          />
          <Metric
            icon={<Routing2 size={15} variant="Bulk" />}
            label={t.distance}
            value={fmtDistance(distanceM, t)}
          />
          <Metric
            icon={<Gps size={15} variant="Bulk" />}
            label={t.accuracy}
            value={loc.accuracy != null ? `±${Math.round(loc.accuracy)} ${t.m}` : '—'}
          />
          <Metric
            icon={<Timer1 size={15} variant="Bulk" />}
            label={t.lastSeen}
            value={relTime(loc.lastLocationAt, t)}
          />
          {summary.firstAt && (
            <>
              <Metric
                icon={<Routing2 size={15} variant="Bulk" />}
                label={t.traveled}
                value={fmtDistance(summary.distanceM, t)}
              />
              <Metric
                icon={<LocationTick size={15} variant="Bulk" />}
                label={t.inZoneShare}
                value={summary.inZonePct != null ? `${summary.inZonePct}%` : '—'}
                tone={summary.inZonePct != null && summary.inZonePct < 70 ? 'warn' : undefined}
              />
              <Metric
                icon={<Timer1 size={15} variant="Bulk" />}
                label={t.gaps}
                value={summary.gaps ? `${summary.gaps} · ${fmtGap(summary.gapMs)}` : '0'}
                tone={summary.gaps ? 'warn' : undefined}
              />
              <Metric
                icon={<BatteryCharging size={15} variant="Bulk" />}
                label={t.battery}
                value={summary.battery != null ? `${summary.battery}%` : '—'}
                tone={summary.battery != null && summary.battery <= 15 ? 'warn' : undefined}
              />
            </>
          )}
        </div>

        {/* Track window selector */}
        <div className="flex items-center justify-between border-t border-line px-4 pb-2 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Routing2 size={14} variant="Bulk" className="text-primary-600" />
            {t.track}
            {track && (
              <span className="font-normal normal-case text-ink-muted">
                · {track.total ?? track.count} {t.points}
                {summary.firstAt && ` · ${clockTime(summary.firstAt)}–${clockTime(summary.lastAt)}`}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-1 px-4">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => onTrackWindow(w.key)}
              className={cn(
                'flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors',
                trackWindow === w.key
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {w.label(t)}
            </button>
          ))}
        </div>

        {/* Track point list */}
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 pb-3 sm:min-h-[120px]">
          {trackLoading ? (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">
              {t.loadingTrack}
            </p>
          ) : points.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-ink-muted">{t.noTrack}</p>
          ) : (
            points.map((p, i) => {
              const older = points[i + 1];
              const gapMs = older
                ? new Date(p.recordedAt).getTime() - new Date(older.recordedAt).getTime()
                : 0;
              const coarse = p.accuracy != null && p.accuracy > MAX_DRAW_ACCURACY_M;
              const inZone = fixInZone(p);
              // "Jonli" only when the newest fix really is current (not hours old).
              const isLive = i === 0 && online;
              return (
                <Fragment key={`${p.recordedAt}-${i}`}>
                  <button
                    onClick={() => onFocusPoint(p)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <span className="w-11 shrink-0 font-mono text-[11px] font-semibold text-ink-soft">
                      {clockTime(p.recordedAt)}
                    </span>
                    <LocationTick
                      size={13}
                      variant="Bulk"
                      className={
                        p.insideOffice ? 'text-emerald-600' : inZone ? 'text-blue-600' : 'text-amber-500'
                      }
                    />
                    <span
                      className={cn(
                        'min-w-0 flex-1 truncate text-xs',
                        coarse ? 'text-ink-muted' : inZone ? 'text-ink' : 'text-amber-700',
                      )}
                    >
                      {p.mahallaName ?? '—'}
                      {coarse && ` · ${t.lowAccuracy}`}
                    </span>
                    {isLive && (
                      <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary-700">
                        {t.live}
                      </span>
                    )}
                  </button>
                  {older && gapMs >= GAP_MIN_MS && (
                    <div className="my-0.5 flex items-center gap-2 px-3 py-1" aria-label={`${fmtGap(gapMs)} lokatsiya uzilgan`}>
                      <span className="h-px flex-1 bg-amber-200" />
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        <Timer1 size={11} variant="Bulk" /> {fmtGap(gapMs)} uzilgan
                      </span>
                      <span className="h-px flex-1 bg-amber-200" />
                    </div>
                  )}
                </Fragment>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'warn';
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-ink-muted">
        <span className={tone === 'warn' ? 'text-amber-500' : 'text-primary-600'}>{icon}</span>
        {label}
      </div>
      <div className={cn('mt-0.5 truncate text-sm font-semibold', tone === 'warn' ? 'text-amber-600' : 'text-ink')}>
        {value}
      </div>
    </div>
  );
}
