import { useEffect, useMemo, useState } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Layer } from 'leaflet';
import type { Feature } from 'geojson';
import { useQuery } from '@tanstack/react-query';
import {
  Buildings2,
  CloseCircle,
  Filter,
  RotateRight,
  SearchNormal1,
} from 'iconsax-react';
import { fetchZonesGeoJson, type ZoneProps } from '@/shared/api/zones';
import {
  fetchLiveLocations,
  fetchLocationAlerts,
  fetchLocationStats,
  fetchTrack,
  type LiveLocation,
  type TrackPoint,
} from '@/shared/api/locations';
import { cn } from '@/shared/lib/cn';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import {
  agoShort,
  FILTER_ORDER,
  initials,
  isOnline,
  LABELS,
  OFFLINE_COLOR,
  ONLINE_COLOR,
  relTime,
  statusColor,
  STATUS_COLORS,
  statusKey,
  statusLabel,
  trackRange,
  type FilterKey,
  type Lang,
  type StatusKey,
  type TrackWindow,
} from './mapShared';

// Mirzo Ulug'bek district centroid (WGS84) — [lat, lng] for Leaflet.
const DISTRICT_CENTER: [number, number] = [41.3354, 69.3737];

type MahallaFilter = { code: string; name: string };
type FlyTarget = { pos: [number, number]; nonce: number };

/** Escape a string for safe interpolation into an HTML attribute value. */
function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function markerIcon(
  loc: LiveLocation,
  selected: boolean,
  ariaLabel: string,
): L.DivIcon {
  const color = statusColor(loc);
  const initial = initials(loc.fullName).charAt(0);
  const ring = selected ? 'box-shadow:0 0 0 4px rgba(16,185,129,0.35);' : '';
  // Freshness dot in the top-right corner — GREEN online / GREY offline — a
  // separate axis from the status-color body. The aria-label (built by the
  // caller) already spells out online/offline, so this dot is not the sole cue.
  const dotColor = isOnline(loc) ? ONLINE_COLOR : OFFLINE_COLOR;
  // role="img" + aria-label carry the "name — status · online/offline" cue so
  // neither status nor freshness is conveyed by color alone (a11y for
  // color-blind / screen-reader use).
  return L.divIcon({
    className: 'emp-marker',
    html: `<div role="img" aria-label="${escapeAttr(ariaLabel)}"
      style="position:relative;width:32px;height:32px;">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};color:#fff;
        display:flex;align-items:center;justify-content:center;font:600 13px system-ui;
        border:2px solid #fff;${ring}">${initial}</div>
      <span style="position:absolute;top:-1px;right:-1px;width:10px;height:10px;
        border-radius:50%;background:${dotColor};border:2px solid #fff;"></span>
    </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/** Flies to a position when the selected employee changes. */
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [pos, map]);
  return null;
}

/** Flies to an explicit target (e.g. a clicked track point); re-fires per nonce. */
function FlyToTarget({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.pos, Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [target, map]);
  return null;
}

export function MapPage() {
  const lang: Lang =
    (localStorage.getItem('hkm-lang') as Lang) === 'ru' ? 'ru' : 'uz';
  const t = LABELS[lang];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showMahallas, setShowMahallas] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [mahallaFilter, setMahallaFilter] = useState<MahallaFilter | null>(null);
  const [trackWindow, setTrackWindow] = useState<TrackWindow>('today');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  // 1s tick so the auto-refresh pill counts up between polls.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const districtQ = useQuery({
    queryKey: ['zones', 'district'],
    queryFn: () => fetchZonesGeoJson('district'),
    staleTime: Infinity,
  });
  const mahallaQ = useQuery({
    queryKey: ['zones', 'mahalla'],
    queryFn: () => fetchZonesGeoJson('mahalla'),
    staleTime: Infinity,
  });
  const locationsQ = useQuery({
    queryKey: ['locations', 'latest'],
    queryFn: fetchLiveLocations,
    refetchInterval: 15_000,
  });
  const locations = useMemo(() => locationsQ.data ?? [], [locationsQ.data]);

  const { data: stats } = useQuery({
    queryKey: ['locations', 'stats'],
    queryFn: fetchLocationStats,
    refetchInterval: 15_000,
  });
  const { data: alerts = [] } = useQuery({
    queryKey: ['locations', 'alerts'],
    queryFn: fetchLocationAlerts,
    refetchInterval: 30_000,
  });
  const trackQ = useQuery({
    queryKey: ['track', selectedId, trackWindow],
    queryFn: () => {
      const { from, to } = trackRange(trackWindow);
      return fetchTrack(selectedId as string, { from, to, limit: 500 });
    },
    enabled: !!selectedId,
  });
  const track = trackQ.data;

  const selected = locations.find((l) => l.employeeId === selectedId) ?? null;
  const selectedPos: [number, number] | null =
    selected && selected.latitude != null && selected.longitude != null
      ? [selected.latitude, selected.longitude]
      : null;

  // Employees passing the search + mahalla filters (but NOT the status chip),
  // so each chip can advertise how many rows it would show.
  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return locations.filter((l) => {
      if (q) {
        const hay = `${l.fullName} ${l.position ?? ''} ${l.mahallaName ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (mahallaFilter && l.mahallaCode !== mahallaFilter.code) return false;
      return true;
    });
  }, [locations, query, mahallaFilter]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: base.length,
      office: 0,
      district: 0,
      outside: 0,
      stale: 0,
      noloc: 0,
    };
    for (const l of base) c[statusKey(l)]++;
    return c;
  }, [base]);

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? base
        : base.filter((l) => statusKey(l) === statusFilter),
    [base, statusFilter],
  );

  // Markers = filtered rows that actually have coordinates. Memoized so the
  // 15s poll doesn't rebuild the marker layer unless the visible set changes.
  const markerLocs = useMemo(
    () =>
      filtered.filter(
        (l) => l.hasLocation && l.latitude != null && l.longitude != null,
      ),
    [filtered],
  );
  const markers = useMemo(
    () =>
      markerLocs.map((loc) => {
        // "Name — Status · Online/Offline": a text cue that mirrors both the
        // marker's body color and its freshness corner dot.
        const label = `${loc.fullName} — ${statusLabel(loc, lang)} · ${
          isOnline(loc) ? t.online : t.offline
        }`;
        return (
          <Marker
            key={loc.employeeId}
            position={[loc.latitude as number, loc.longitude as number]}
            icon={markerIcon(loc, loc.employeeId === selectedId, label)}
            title={label}
            alt={label}
            keyboard
            eventHandlers={{ click: () => setSelectedId(loc.employeeId) }}
          >
            <Tooltip direction="top" offset={[0, -14]}>
              {label}
            </Tooltip>
          </Marker>
        );
      }),
    [markerLocs, selectedId, lang, t],
  );

  // Live per-mahalla headcount → polygon tint. Keyed so the GeoJSON restyles
  // only when the distribution (or active mahalla filter) actually changes,
  // never merely because the 15s poll returned a fresh array.
  const occupancy = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of locations) {
      if (l.mahallaCode && l.hasLocation) {
        c.set(l.mahallaCode, (c.get(l.mahallaCode) ?? 0) + 1);
      }
    }
    return c;
  }, [locations]);
  const mahallaLayerKey = useMemo(
    () =>
      [...occupancy.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((e) => `${e[0]}:${e[1]}`)
        .join(',') +
      `|f:${mahallaFilter?.code ?? ''}|${lang}`,
    [occupancy, mahallaFilter, lang],
  );

  const trackLine: [number, number][] =
    track?.points.map((p) => [p.latitude, p.longitude]) ?? [];
  const trackStart = track?.points[0];

  function focusPoint(p: TrackPoint) {
    setFlyTarget({ pos: [p.latitude, p.longitude], nonce: performance.now() });
  }

  const chipLabels: Record<FilterKey, string> = {
    all: t.fAll,
    office: t.fOffice,
    district: t.fDistrict,
    outside: t.fOutside,
    stale: t.fStale,
    noloc: t.fNoloc,
  };

  return (
    <div className="relative flex h-[calc(100dvh-5.5rem)] min-h-[520px] gap-4">
      {/* ── Sidebar (static ≥lg, slide-over overlay below lg) ── */}
      <aside
        className={cn(
          'absolute inset-y-0 left-0 z-[1200] flex w-80 max-w-[86%] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop transition-transform duration-300',
          'lg:static lg:z-auto lg:max-w-none lg:translate-x-0 lg:shadow-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-[112%] lg:translate-x-0',
        )}
      >
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">{t.title}</h2>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
                </span>
                {t.live}
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label={t.close}
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink lg:hidden"
              >
                <CloseCircle size={20} variant="Bold" />
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label={t.total} value={stats?.totalActive ?? '—'} tone="ink" />
            <Stat label={t.reporting} value={stats?.reportingNow ?? '—'} tone="blue" />
            <Stat label={t.inOffice} value={stats?.insideOffice ?? '—'} tone="green" />
            <Stat label={t.stale} value={stats?.stale ?? '—'} tone="red" />
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3">
          <div className="relative">
            <SearchNormal1
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.search}
              className="h-11 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {FILTER_ORDER.map((key) => {
            const active = statusFilter === key;
            const color = key === 'all' ? '#0f172a' : STATUS_COLORS[key as StatusKey];
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  active
                    ? 'text-white'
                    : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                )}
                style={active ? { background: color } : undefined}
              >
                {key !== 'all' && (
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: active ? '#fff' : color }}
                  />
                )}
                {chipLabels[key]}
                <span className={cn('font-bold', active ? 'text-white' : 'text-ink-muted')}>
                  {counts[key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active mahalla filter chip */}
        {mahallaFilter && (
          <div className="px-3 pt-3">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-primary-700">
              <Buildings2 size={13} variant="Bulk" />
              <span className="truncate">
                {t.mahallaChip}: {mahallaFilter.name}
              </span>
              <button
                onClick={() => setMahallaFilter(null)}
                aria-label={t.clear}
                className="shrink-0 rounded-full p-0.5 hover:bg-primary-100"
              >
                <CloseCircle size={14} variant="Bold" />
              </button>
            </span>
          </div>
        )}

        {/* Employee list */}
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">
              {locations.length === 0 ? t.empty : t.noneMatch}
            </p>
          )}
          {filtered.map((loc) => (
            <button
              key={loc.employeeId}
              onClick={() => setSelectedId(loc.employeeId)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                selectedId === loc.employeeId ? 'bg-primary-50' : 'hover:bg-surface-2',
              )}
            >
              <span
                role="img"
                aria-label={isOnline(loc) ? t.online : t.offline}
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                style={{
                  background: isOnline(loc) ? ONLINE_COLOR : OFFLINE_COLOR,
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {loc.fullName}
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {loc.mahallaName ?? loc.position}
                </span>
              </span>
              <span className="shrink-0 text-right text-[11px] text-ink-muted">
                {relTime(loc.lastLocationAt, t)}
              </span>
            </button>
          ))}
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="border-t border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">
              {t.alerts} · {alerts.length}
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {alerts.slice(0, 20).map((a) => (
                <button
                  key={a.employeeId}
                  onClick={() => setSelectedId(a.employeeId)}
                  className="flex w-full items-center justify-between rounded-lg bg-danger-soft/60 px-2.5 py-1.5 text-left text-xs hover:bg-danger-soft"
                >
                  <span className="truncate font-medium text-danger">{a.fullName}</span>
                  <span className="shrink-0 text-danger/80">
                    {a.reason === 'never' ? t.never : relTime(a.lastLocationAt, t)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Mobile backdrop when the sidebar is open */}
      {sidebarOpen && (
        <button
          aria-label={t.close}
          onClick={() => setSidebarOpen(false)}
          className="absolute inset-0 z-[1150] cursor-default bg-black/30 lg:hidden"
        />
      )}

      {/* ── Map ── */}
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line">
        <MapContainer
          center={DISTRICT_CENTER}
          zoom={12}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap, &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {districtQ.data && (
            <GeoJSON
              data={districtQ.data}
              style={{
                color: '#059669',
                weight: 2.5,
                fillColor: '#10b981',
                fillOpacity: 0.05,
              }}
            />
          )}

          {showMahallas && mahallaQ.data && (
            <GeoJSON
              key={`mahallas-${mahallaLayerKey}`}
              data={mahallaQ.data}
              style={(feature) => {
                const code = (feature?.properties as ZoneProps | undefined)?.code;
                const isActive = !!code && code === mahallaFilter?.code;
                const count = code ? occupancy.get(code) ?? 0 : 0;
                if (isActive) {
                  return {
                    color: '#4f46e5',
                    weight: 2.5,
                    fillColor: '#6366f1',
                    fillOpacity: 0.25,
                  };
                }
                if (count > 0) {
                  return {
                    color: '#059669',
                    weight: 1.5,
                    fillColor: '#10b981',
                    fillOpacity: Math.min(0.18 + count * 0.12, 0.6),
                  };
                }
                return {
                  color: '#94a3b8',
                  weight: 1,
                  fillColor: '#94a3b8',
                  fillOpacity: 0.02,
                };
              }}
              onEachFeature={(feature: Feature, layer: Layer) => {
                const p = feature.properties as ZoneProps | undefined;
                if (!p) return;
                const count = occupancy.get(p.code) ?? 0;
                const name = lang === 'ru' ? p.name_ru ?? p.name_uz_lt : p.name_uz_lt;
                layer.bindTooltip(count > 0 ? `${name} — ${count} xodim` : name, {
                  sticky: true,
                });
                layer.on('click', () => {
                  setMahallaFilter((prev) =>
                    prev?.code === p.code ? null : { code: p.code, name },
                  );
                });
              }}
            />
          )}

          {trackLine.length > 1 && (
            <Polyline
              positions={trackLine}
              pathOptions={{ color: '#6366f1', weight: 3, dashArray: '6 6' }}
            />
          )}
          {trackStart && (
            <CircleMarker
              center={[trackStart.latitude, trackStart.longitude]}
              radius={5}
              pathOptions={{
                color: '#fff',
                weight: 2,
                fillColor: '#6366f1',
                fillOpacity: 1,
              }}
            />
          )}

          {markers}

          <FlyTo pos={selectedPos} />
          <FlyToTarget target={flyTarget} />
        </MapContainer>

        {/* Top-left cluster: mobile list toggle + auto-refresh pill */}
        <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink-soft shadow-sm lg:hidden"
          >
            <Filter size={15} variant="Bulk" />
            {t.list}
          </button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur">
            {locationsQ.isFetching ? (
              <RotateRight size={13} className="animate-spin text-primary-600" />
            ) : (
              <span className="h-2 w-2 rounded-full bg-primary-500" />
            )}
            {t.updated}:{' '}
            {locationsQ.dataUpdatedAt
              ? agoShort(locationsQ.dataUpdatedAt, now, t)
              : '—'}
          </span>
        </div>

        {/* Mahalla toggle */}
        <button
          onClick={() => setShowMahallas((s) => !s)}
          className={cn(
            'absolute right-3 top-3 z-[1000] inline-flex h-11 items-center rounded-lg border px-3 text-xs font-medium shadow-sm transition-colors',
            showMahallas
              ? 'border-primary-500 bg-primary-600 text-white'
              : 'border-line bg-surface text-ink-soft',
          )}
        >
          {t.mahallas}
        </button>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/90 px-3 py-2 text-[11px] text-ink-soft backdrop-blur">
          <Legend color={STATUS_COLORS.office} label={t.office} />
          <Legend color={STATUS_COLORS.district} label={t.inDistrict} />
          <Legend color={STATUS_COLORS.outside} label={t.outDistrict} />
          <Legend color={STATUS_COLORS.stale} label={t.stale} />
        </div>

        {/* Detail drawer */}
        {selected && (
          <EmployeeDetailDrawer
            loc={selected}
            track={track}
            trackLoading={trackQ.isFetching}
            trackWindow={trackWindow}
            onTrackWindow={setTrackWindow}
            t={t}
            onClose={() => setSelectedId(null)}
            onFocusPoint={focusPoint}
          />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: 'ink' | 'blue' | 'green' | 'red';
}) {
  const toneClass = {
    ink: 'text-ink',
    blue: 'text-blue-600',
    green: 'text-emerald-600',
    red: 'text-red-600',
  }[tone];
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2">
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
