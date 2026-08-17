import { useEffect, useMemo, useState } from 'react';
import {
  Buildings2,
  CloseCircle,
  Gps,
  LocationTick,
  Routing2,
  Timer1,
} from 'iconsax-react';
import type { LiveLocation, TrackPoint, TrackResult } from '@/shared/api/locations';
import { cn } from '@/shared/lib/cn';
import {
  absTime,
  clockTime,
  fmtDistance,
  haversineM,
  initials,
  OFFICE_CENTER,
  relTime,
  statusColor,
  type Labels,
  type TrackWindow,
} from './mapShared';

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
  t,
  onClose,
  onFocusPoint,
}: Props) {
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
  const distanceM = pos ? haversineM(pos, OFFICE_CENTER) : null;

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

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5 px-4 pt-3">
          <Badge active={loc.insideOffice} color="#10b981" label={t.inOfficeBadge} />
          <Badge active={loc.insideDistrict} color="#3b82f6" label={t.inDistrictBadge} />
          {loc.hasLocation && !loc.insideDistrict && !loc.isStale && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
              style={{ background: '#f59e0b' }}
            >
              {t.outsideBadge}
            </span>
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
        </div>

        {/* Track window selector */}
        <div className="flex items-center justify-between border-t border-line px-4 pb-2 pt-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            <Routing2 size={14} variant="Bulk" className="text-primary-600" />
            {t.track}
            {track && (
              <span className="font-normal normal-case text-ink-muted">
                · {track.count} {t.points}
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
            points.map((p, i) => (
              <button
                key={`${p.recordedAt}-${i}`}
                onClick={() => onFocusPoint(p)}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="w-11 shrink-0 font-mono text-[11px] font-semibold text-ink-soft">
                  {clockTime(p.recordedAt)}
                </span>
                <LocationTick
                  size={13}
                  variant="Bulk"
                  className={p.insideOffice ? 'text-emerald-600' : 'text-ink-muted'}
                />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">
                  {p.mahallaName ?? '—'}
                </span>
                {i === 0 && (
                  <span className="shrink-0 rounded-full bg-primary-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-primary-700">
                    {t.live}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}

function Badge({
  active,
  color,
  label,
}: {
  active: boolean;
  color: string;
  label: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        active ? 'text-white' : 'border border-line bg-surface-2 text-ink-muted',
      )}
      style={active ? { background: color } : undefined}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: active ? '#fff' : '#cbd5e1' }}
      />
      {label}
    </span>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1 text-[11px] text-ink-muted">
        <span className="text-primary-600">{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold text-ink">{value}</div>
    </div>
  );
}
