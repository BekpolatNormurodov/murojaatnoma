import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CircleMarker, GeoJSON, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import { ArrowLeft2, ArrowRight2, Routing, RotateRight } from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { DatePicker } from '@/shared/ui/DatePicker';
import { cn } from '@/shared/lib/cn';
import { fetchTrack, type TrackPoint } from '@/shared/api/locations';
import { fetchZonesGeoJson, type ZoneProps } from '@/shared/api/zones';
import {
  DISTRICT_CENTER,
  fmtDistance,
  LABELS,
  lastTrackDay,
  summarizeTrack,
  trackRange,
  trackSegments,
  YANDEX_TILE_URL,
  type TrackWindow,
} from '@/features/map/mapShared';
import { routeStops, type RouteStop } from '@/features/map/routeStops';
import { OnlineCard } from './OnlineCard';
import { durationText } from './useActivity';
import { addDays, dmy, localDay } from './period';

/** The most points one request may return — a full working day stays unthinned. */
const POINT_LIMIT = 5000;

const clock = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const minutesBetween = (from: string, to: string) => (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
const latLng = (p: TrackPoint): [number, number] => [p.latitude, p.longitude];

/** Frames the route once per `fitKey` — live refreshes leave the admin's view alone. */
function FitRoute({ points, fitKey, focus }: { points: TrackPoint[]; fitKey: string; focus: { stop: RouteStop | null; nonce: number } }) {
  const map = useMap();
  const fitted = useRef('');
  useEffect(() => {
    if (!points.length || fitted.current === fitKey) return;
    const fit = () => {
      map.invalidateSize();
      const size = map.getSize();
      // A map that has no size yet (cached data, tab still laying out) can't be framed.
      if (!size.x || !size.y) return false;
      map.fitBounds(L.latLngBounds(points.map(latLng)), { padding: [32, 32], maxZoom: 17, animate: false });
      fitted.current = fitKey;
      return true;
    };
    let timer = 0;
    map.whenReady(() => {
      timer = window.setTimeout(fit, 250);
    });
    return () => window.clearTimeout(timer);
  }, [points, fitKey, map]);
  // Only a new click moves the map; new points must not replay the last one.
  const seen = useRef(0);
  useEffect(() => {
    if (focus.nonce === seen.current) return;
    seen.current = focus.nonce;
    const part = focus.stop ? points.slice(focus.stop.startIdx, focus.stop.endIdx + 1) : points;
    if (part.length) map.fitBounds(L.latLngBounds(part.map(latLng)), { padding: [40, 40], maxZoom: 17 });
  }, [focus, points, map]);
  return null;
}

/**
 * Xodimning bir kunlik yurgan yo'li: xaritadagi chiziq, kun ko'rsatkichlari va
 * qaysi mahallada qachondan qachongacha bo'lgani. Nuqtalar bazada saqlanadi,
 * istalgan o'tgan kunni tanlash mumkin.
 */
export function RouteTab({
  employeeId,
  assignedCodes,
  lastAt,
}: {
  employeeId: string;
  assignedCodes: string[];
  /** Time of the newest stored fix, if any. */
  lastAt: string | null;
}) {
  const today = localDay();
  // Nothing today (location off) → open on the last day they did walk.
  const lastDay = lastTrackDay(lastAt);
  const [picked, setDay] = useState<string | null>(null);
  const day = picked ?? lastDay ?? today;
  const [focus, setFocus] = useState<{ stop: RouteStop | null; nonce: number }>({ stop: null, nonce: 0 });
  const isToday = day === today;
  const t = LABELS.uz;

  const trackQ = useQuery({
    queryKey: ['track', employeeId, 'day', day],
    queryFn: () => fetchTrack(employeeId, { ...trackRange(day as TrackWindow), limit: POINT_LIMIT }),
    refetchInterval: isToday ? 30_000 : false,
  });
  const mahallaQ = useQuery({
    queryKey: ['zones', 'mahalla'],
    queryFn: () => fetchZonesGeoJson('mahalla'),
    staleTime: Infinity,
    enabled: assignedCodes.length > 0,
  });

  const points = useMemo(() => trackQ.data?.points ?? [], [trackQ.data]);
  const segments = useMemo(() => trackSegments(points), [points]);
  const summary = useMemo(() => summarizeTrack(points), [points]);
  const stops = useMemo(() => routeStops(points), [points]);
  const assignedGeo = useMemo(() => {
    if (!mahallaQ.data || assignedCodes.length === 0) return null;
    return {
      ...mahallaQ.data,
      features: mahallaQ.data.features.filter((f) => assignedCodes.includes((f.properties as ZoneProps).code)),
    };
  }, [mahallaQ.data, assignedCodes]);

  const pick = (next: string) => {
    if (!next || next > today) return;
    setDay(next);
    setFocus({ stop: null, nonce: 0 });
  };

  const first = points[0];
  const last = points[points.length - 1];
  const total = trackQ.data?.total ?? points.length;
  const stats: { label: string; value: string }[] = [
    { label: "Bosib o'tgan yo'l", value: points.length ? fmtDistance(summary.distanceM, t) : '—' },
    { label: 'Birinchi – oxirgi nuqta', value: points.length ? `${clock(summary.firstAt)} – ${clock(summary.lastAt)}` : '—' },
    {
      label: 'Hududida',
      value: assignedCodes.length === 0 || summary.inZonePct == null ? '—' : `${summary.inZonePct}%`,
    },
    {
      label: 'Uzilishlar',
      value: points.length ? (summary.gaps ? `${summary.gaps} · ${durationText(summary.gapMs / 60_000)}` : "Yo'q") : '—',
    },
  ];

  const stepButton =
    'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-40';

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Routing size={18} variant="Bulk" className="text-primary-600" /> Yurgan yo'li · {dmy(day)}
            {trackQ.isFetching && <RotateRight size={14} className="animate-spin text-ink-muted" />}
          </h3>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <button className={stepButton} onClick={() => pick(addDays(day, -1))} aria-label="Oldingi kun">
              <ArrowLeft2 size={16} />
            </button>
            <DatePicker value={day} max={today} onChange={pick} className="min-w-0 flex-1 sm:w-52 sm:flex-none" />
            <button className={stepButton} onClick={() => pick(addDays(day, 1))} disabled={isToday} aria-label="Keyingi kun">
              <ArrowRight2 size={16} />
            </button>
            <button
              onClick={() => pick(today)}
              disabled={isToday}
              className="hidden h-11 shrink-0 rounded-xl border border-line px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-40 sm:block"
            >
              Bugun
            </button>
          </div>
        </div>
        {!picked && lastDay && (
          <p role="status" className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">
            {t.lastRoute}: <b className="tabular-nums">{dmy(lastDay)}</b>
          </p>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
              <dt className="text-[11.5px] text-ink-muted">{s.label}</dt>
              <dd className="text-[15px] font-semibold tabular-nums text-ink">{trackQ.isLoading ? '…' : s.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <OnlineCard key={day} employeeId={employeeId} date={day} live={isToday} />

      {trackQ.isError && !trackQ.data ? (
        <Card className="p-5 text-[13px] text-ink-soft">
          Yo'lni yuklab bo'lmadi.{' '}
          <button className="font-medium text-primary-600 hover:underline" onClick={() => trackQ.refetch()}>
            Qayta urinish
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="relative isolate h-[420px] overflow-hidden rounded-2xl border border-line lg:h-[560px]">
            <MapContainer
              center={DISTRICT_CENTER}
              zoom={12}
              maxZoom={19}
              // The map sits inside a scrolling page — the wheel must scroll the page.
              scrollWheelZoom={false}
              crs={L.CRS.EPSG3395}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer attribution="&copy; Yandex" url={YANDEX_TILE_URL} maxZoom={19} />
              {assignedGeo && (
                <GeoJSON
                  key={assignedCodes.join(',')}
                  data={assignedGeo}
                  interactive={false}
                  style={{ color: '#6366f1', weight: 2, dashArray: '6 5', fillColor: '#6366f1', fillOpacity: 0.08 }}
                />
              )}
              {segments.gaps.map((g, i) => (
                <Polyline key={`gap-${i}`} positions={g} pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '3 7' }} />
              ))}
              {segments.runs.map((run, i) =>
                run.length > 1 ? (
                  <Polyline key={`run-${i}`} positions={run} pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.85 }} />
                ) : null,
              )}
              {focus.stop && (
                <Polyline
                  positions={points.slice(focus.stop.startIdx, focus.stop.endIdx + 1).map(latLng)}
                  pathOptions={{ color: '#db2777', weight: 6, opacity: 0.9 }}
                />
              )}
              {first && (
                <CircleMarker center={latLng(first)} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#059669', fillOpacity: 1 }}>
                  <Tooltip direction="top">Boshlanish · {clock(first.recordedAt)}</Tooltip>
                </CircleMarker>
              )}
              {last && last !== first && (
                <CircleMarker center={latLng(last)} radius={7} pathOptions={{ color: '#fff', weight: 2, fillColor: '#dc2626', fillOpacity: 1 }}>
                  <Tooltip direction="top">
                    {isToday ? 'Oxirgi nuqta' : 'Tugash'} · {clock(last.recordedAt)}
                  </Tooltip>
                </CircleMarker>
              )}
              <FitRoute points={points} fitKey={`${employeeId}:${day}`} focus={focus} />
            </MapContainer>
          </div>

          <Card className="flex flex-col p-4 lg:h-[560px]">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[15px] font-semibold text-ink">Qayerda bo'lgan</h3>
              <span className="text-[12px] tabular-nums text-ink-muted">{total} nuqta</span>
            </div>
            {trackQ.isLoading ? (
              <p className="mt-3 text-[13px] text-ink-muted">Yuklanmoqda…</p>
            ) : stops.length === 0 ? (
              <p className="mt-3 text-[13px] text-ink-soft">Bu kunda joylashuv yozilmagan.</p>
            ) : (
              <ol className="mt-3 max-h-[420px] space-y-1 overflow-y-auto lg:max-h-none lg:flex-1">
                {stops.map((s) => (
                  <li key={s.startIdx}>
                    {s.afterGap && <p className="px-2.5 py-1 text-[11.5px] text-amber-600">Aloqa uzilgan</p>}
                    <button
                      onClick={() => setFocus({ stop: s, nonce: focus.nonce + 1 })}
                      aria-pressed={focus.stop?.startIdx === s.startIdx}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-2',
                        focus.stop?.startIdx === s.startIdx && 'bg-primary-50 dark:bg-primary-500/10',
                      )}
                    >
                      <span className="w-[86px] shrink-0 text-[12px] font-medium tabular-nums text-ink-soft">
                        {clock(s.from)}–{clock(s.to)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.mahallaName ?? 'Tumandan tashqarida'}</span>
                      <span className="shrink-0 text-[11.5px] tabular-nums text-ink-muted">
                        {durationText(minutesBetween(s.from, s.to))}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
