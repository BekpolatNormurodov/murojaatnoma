import { useEffect, useState } from 'react';
import {
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import type { Layer } from 'leaflet';
import type { Feature } from 'geojson';
import { useQuery } from '@tanstack/react-query';
import { fetchZonesGeoJson, type ZoneProps } from '@/shared/api/zones';
import {
  fetchLiveLocations,
  fetchLocationAlerts,
  fetchLocationStats,
  fetchTrack,
  type LiveLocation,
} from '@/shared/api/locations';

// Mirzo Ulug'bek district centroid (WGS84) — [lat, lng] for Leaflet.
const DISTRICT_CENTER: [number, number] = [41.3354, 69.3737];

type Lang = 'uz' | 'ru';
const LABELS: Record<Lang, Record<string, string>> = {
  uz: {
    title: 'Xodimlar joylashuvi',
    live: 'Jonli',
    total: 'Jami',
    reporting: 'Faol',
    inOffice: 'Ish hududida',
    stale: "Aloqa yo'q",
    search: 'Xodim qidirish...',
    noLoc: "Joylashuv yo'q",
    office: 'Ish hududida',
    outDistrict: 'Tuman tashqarisida',
    inDistrict: 'Tuman ichida',
    lastSeen: 'Oxirgi aloqa',
    alerts: 'Ogohlantirishlar',
    mahallas: 'Mahallalar',
    minAgo: 'daq. oldin',
    never: 'hech qachon',
    empty: 'Hali hech kim joylashuv yubormagan',
  },
  ru: {
    title: 'Локация сотрудников',
    live: 'Онлайн',
    total: 'Всего',
    reporting: 'Активны',
    inOffice: 'На месте',
    stale: 'Нет связи',
    search: 'Поиск сотрудника...',
    noLoc: 'Нет локации',
    office: 'В рабочей зоне',
    outDistrict: 'Вне района',
    inDistrict: 'В районе',
    lastSeen: 'Последняя связь',
    alerts: 'Оповещения',
    mahallas: 'Махалли',
    minAgo: 'мин назад',
    never: 'никогда',
    empty: 'Пока никто не отправил локацию',
  },
};

function statusColor(loc: LiveLocation): string {
  if (!loc.hasLocation) return '#94a3b8';
  if (loc.isStale) return '#ef4444';
  if (loc.insideOffice) return '#10b981';
  if (loc.insideDistrict) return '#3b82f6';
  return '#f59e0b';
}

function markerIcon(loc: LiveLocation, selected: boolean): L.DivIcon {
  const color = statusColor(loc);
  const initial = (loc.fullName || '?').charAt(0).toUpperCase();
  const ring = selected ? 'box-shadow:0 0 0 4px rgba(16,185,129,0.35);' : '';
  return L.divIcon({
    className: 'emp-marker',
    html: `<div style="width:32px;height:32px;border-radius:50%;background:${color};color:#fff;
      display:flex;align-items:center;justify-content:center;font:600 13px system-ui;
      border:2px solid #fff;${ring}">${initial}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

/** Flies the map to a position when the selected employee changes. */
function FlyTo({ pos }: { pos: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (pos) map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: 0.8 });
  }, [pos, map]);
  return null;
}

function relTime(iso: string | null, t: Record<string, string>): string {
  if (!iso) return t.never;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return t.live;
  if (mins < 60) return `${mins} ${t.minAgo}`;
  const h = Math.floor(mins / 60);
  return `${h} soat`;
}

export function MapPage() {
  const lang: Lang =
    (localStorage.getItem('hkm-lang') as Lang) === 'ru' ? 'ru' : 'uz';
  const t = LABELS[lang];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [showMahallas, setShowMahallas] = useState(true);

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
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', 'latest'],
    queryFn: fetchLiveLocations,
    refetchInterval: 15_000,
  });
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
  const { data: track } = useQuery({
    queryKey: ['track', selectedId],
    queryFn: () => fetchTrack(selectedId as string, { limit: 200 }),
    enabled: !!selectedId,
  });

  const selected = locations.find((l) => l.employeeId === selectedId) ?? null;
  const selectedPos: [number, number] | null =
    selected && selected.latitude != null && selected.longitude != null
      ? [selected.latitude, selected.longitude]
      : null;

  const filtered = locations.filter((l) =>
    l.fullName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  const trackLine: [number, number][] =
    track?.points.map((p) => [p.latitude, p.longitude]) ?? [];

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[520px] gap-4">
      {/* Side panel */}
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="border-b border-line p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-ink">{t.title}</h2>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
              {t.live}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Stat label={t.total} value={stats?.totalActive ?? '—'} tone="ink" />
            <Stat label={t.reporting} value={stats?.reportingNow ?? '—'} tone="blue" />
            <Stat label={t.inOffice} value={stats?.insideOffice ?? '—'} tone="green" />
            <Stat label={t.stale} value={stats?.stale ?? '—'} tone="red" />
          </div>
        </div>

        <div className="p-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.search}
            className="h-9 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm outline-none focus:border-primary-500"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">{t.empty}</p>
          )}
          {filtered.map((loc) => (
            <button
              key={loc.employeeId}
              onClick={() => setSelectedId(loc.employeeId)}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                selectedId === loc.employeeId ? 'bg-primary-50' : 'hover:bg-surface-2'
              }`}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: statusColor(loc) }}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {loc.fullName}
                </span>
                <span className="block truncate text-xs text-ink-muted">
                  {loc.mahallaName ?? loc.position}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-ink-muted">
                {relTime(loc.lastLocationAt, t)}
              </span>
            </button>
          ))}
        </div>

        {alerts.length > 0 && (
          <div className="border-t border-line p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-danger">
              {t.alerts} · {alerts.length}
            </div>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {alerts.slice(0, 20).map((a) => (
                <div
                  key={a.employeeId}
                  className="flex items-center justify-between rounded-lg bg-danger-soft/60 px-2.5 py-1.5 text-xs"
                >
                  <span className="truncate font-medium text-danger">{a.fullName}</span>
                  <span className="shrink-0 text-danger/80">
                    {a.reason === 'never' ? t.never : relTime(a.lastLocationAt, t)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* Map */}
      <div className="relative min-w-0 flex-1 overflow-hidden rounded-2xl border border-line">
        <MapContainer
          center={DISTRICT_CENTER}
          zoom={12}
          scrollWheelZoom
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap, &copy; CARTO'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />

          {districtQ.data && (
            <GeoJSON
              data={districtQ.data}
              style={{ color: '#059669', weight: 2.5, fillColor: '#10b981', fillOpacity: 0.05 }}
            />
          )}

          {showMahallas && mahallaQ.data && (
            <GeoJSON
              key="mahallas"
              data={mahallaQ.data}
              style={{ color: '#64748b', weight: 1, fillOpacity: 0.02, fillColor: '#94a3b8' }}
              onEachFeature={(feature: Feature, layer: Layer) => {
                const p = feature.properties as ZoneProps | undefined;
                if (p) {
                  layer.bindTooltip(lang === 'ru' ? p.name_ru ?? p.name_uz_lt : p.name_uz_lt, {
                    sticky: true,
                  });
                }
              }}
            />
          )}

          {trackLine.length > 1 && (
            <Polyline positions={trackLine} pathOptions={{ color: '#6366f1', weight: 3, dashArray: '6 6' }} />
          )}

          {locations
            .filter((l) => l.hasLocation && l.latitude != null && l.longitude != null)
            .map((loc) => (
              <Marker
                key={loc.employeeId}
                position={[loc.latitude as number, loc.longitude as number]}
                icon={markerIcon(loc, loc.employeeId === selectedId)}
                eventHandlers={{ click: () => setSelectedId(loc.employeeId) }}
              >
                <Popup>
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">{loc.fullName}</div>
                    <div className="text-slate-500">{loc.position}</div>
                    <div className="mt-1 text-slate-700">
                      {loc.mahallaName ?? '—'}
                    </div>
                    <div className="mt-1">
                      <span
                        className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium text-white"
                        style={{ background: statusColor(loc) }}
                      >
                        {!loc.hasLocation
                          ? t.noLoc
                          : loc.insideOffice
                            ? t.office
                            : loc.insideDistrict
                              ? t.inDistrict
                              : t.outDistrict}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-slate-400">
                      {t.lastSeen}: {relTime(loc.lastLocationAt, t)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

          <FlyTo pos={selectedPos} />
        </MapContainer>

        {/* Mahalla toggle */}
        <button
          onClick={() => setShowMahallas((s) => !s)}
          className={`absolute right-3 top-3 z-[1000] rounded-lg border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors ${
            showMahallas
              ? 'border-primary-500 bg-primary-600 text-white'
              : 'border-line bg-surface text-ink-soft'
          }`}
        >
          {t.mahallas}
        </button>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] flex flex-wrap gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/90 px-3 py-2 text-[11px] text-ink-soft backdrop-blur">
          <Legend color="#10b981" label={t.office} />
          <Legend color="#3b82f6" label={t.inDistrict} />
          <Legend color="#f59e0b" label={t.outDistrict} />
          <Legend color="#ef4444" label={t.stale} />
        </div>
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
