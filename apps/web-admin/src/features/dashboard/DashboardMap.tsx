import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Layer, PathOptions } from 'leaflet';
import type { Feature } from 'geojson';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Maximize4, Gps } from 'iconsax-react';
import { fetchZonesGeoJson, type ZoneCollection, type ZoneProps } from '@/shared/api/zones';
import { fetchLiveLocations, type LiveLocation } from '@/shared/api/locations';
import { cn } from '@/shared/lib/cn';
import { STATUS_META } from '@/shared/data/mock';
import { Skeleton } from '@/shared/ui/Skeleton';
import { DISTRICT_CENTER, escapeHtml, isOnline, YANDEX_TILE_URL } from '@/features/map/mapShared';
import type { MahallaLoad, MurojaatPin } from './api/overview';

type LayerKey = 'load' | 'pins' | 'staff';

const LAYERS: { key: LayerKey; label: string }[] = [
  { key: 'load', label: 'Yuklama' },
  { key: 'pins', label: 'Murojaatlar' },
  { key: 'staff', label: 'Xodimlar' },
];

/** Open-murojaat count → mahalla fill (none → amber → orange → red). */
function loadStyle(open: number, overdue: number, focused: boolean): PathOptions {
  const fill =
    open === 0 ? '#94a3b8' : overdue >= 2 || open >= 4 ? '#ef4444' : open >= 2 ? '#f97316' : '#f59e0b';
  return {
    color: focused ? '#4f46e5' : open ? fill : '#94a3b8',
    weight: focused ? 3 : open ? 1.4 : 0.8,
    fillColor: focused ? '#6366f1' : fill,
    fillOpacity: focused ? 0.3 : open ? Math.min(0.24 + open * 0.08, 0.55) : 0.04,
  };
}

const PIN_COLOR: Record<string, string> = { new: '#3b82f6', in_progress: '#f59e0b' };

function staffColor(l: LiveLocation): string {
  if (!isOnline(l) || l.isStale) return '#94a3b8';
  return l.insideOffice || l.insideDistrict ? '#10b981' : '#ef4444';
}

/**
 * Frames the populated part of the tuman once boundaries load. Uses the
 * mahalla layer when available: the district polygon also carries a small
 * exclave far to the north-east, and framing that left the real district a
 * thumbnail in the corner.
 */
function homeBounds(mahallas?: ZoneCollection, district?: ZoneCollection): L.LatLngBounds | null {
  const src = mahallas?.features.length ? mahallas : district;
  if (!src) return null;
  const b = L.geoJSON(src).getBounds();
  return b.isValid() ? b : null;
}

function FitDistrict({
  district,
  mahallas,
}: {
  district: ZoneCollection | undefined;
  mahallas: ZoneCollection | undefined;
}) {
  const map = useMap();
  const fittedWith = useRef<'none' | 'district' | 'mahallas'>('none');
  useEffect(() => {
    const level = mahallas?.features.length ? 'mahallas' : district ? 'district' : 'none';
    if (level === 'none' || level === fittedWith.current || fittedWith.current === 'mahallas') return;
    const b = homeBounds(mahallas, district);
    if (b) {
      map.fitBounds(b, { padding: [8, 8] });
      fittedWith.current = level;
    }
  }, [district, mahallas, map]);
  return null;
}

/** Flies to the focused mahalla (or back to the district when cleared). */
function FocusMahalla({
  code,
  mahallas,
  district,
}: {
  code: string | null;
  mahallas: ZoneCollection | undefined;
  district: ZoneCollection | undefined;
}) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      if (!code) return;
    }
    const target = code
      ? mahallas?.features.find((f) => f.properties.code === code)
      : undefined;
    const b = target ? L.geoJSON(target).getBounds() : homeBounds(mahallas, district);
    if (b?.isValid()) map.flyToBounds(b, { padding: [24, 24], duration: 0.6, maxZoom: 16 });
  }, [code, mahallas, district, map]);
  return null;
}

/**
 * Boshqaruv panelidagi jonli xarita: tuman chegarasi, mahallalar ochiq
 * murojaatlar soni bo'yicha bo'yalgan (yuklama), ochiq murojaat nuqtalari va
 * xodimlarning so'nggi joylashuvi. Yandex (EPSG:3395) — /map bilan bir xil.
 */
export function DashboardMap({
  pins,
  mahallaLoads,
  focusCode,
  onFocus,
}: {
  pins: MurojaatPin[];
  mahallaLoads: MahallaLoad[];
  focusCode: string | null;
  onFocus: (code: string | null) => void;
}) {
  const navigate = useNavigate();
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    load: true,
    pins: true,
    staff: true,
  });

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
  const staffQ = useQuery({
    queryKey: ['locations', 'latest'],
    queryFn: fetchLiveLocations,
    refetchInterval: 30_000,
    enabled: layers.staff,
  });

  const loadByCode = useMemo(() => new Map(mahallaLoads.map((m) => [m.code, m])), [mahallaLoads]);
  // Restyle the mahalla layer only when the numbers/focus actually change.
  const mahallaKey = useMemo(
    () =>
      mahallaLoads.map((m) => `${m.code}:${m.open}:${m.overdue}`).join(',') +
      `|${focusCode ?? ''}|${layers.load}`,
    [mahallaLoads, focusCode, layers.load],
  );
  const staff = useMemo(
    () => (staffQ.data ?? []).filter((l) => l.hasLocation && l.latitude != null && l.longitude != null),
    [staffQ.data],
  );

  const loading = districtQ.isLoading;

  return (
    <div className="relative isolate h-[340px] overflow-hidden rounded-xl border border-line sm:h-[420px]">
      {loading && <Skeleton className="absolute inset-0 z-[1001] rounded-none" />}
      <MapContainer
        center={DISTRICT_CENTER}
        zoom={12}
        maxZoom={18}
        crs={L.CRS.EPSG3395}
        scrollWheelZoom={false}
        dragging={!L.Browser.mobile}
        zoomControl={false}
        attributionControl={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer url={YANDEX_TILE_URL} maxZoom={18} />
        <FitDistrict district={districtQ.data} mahallas={mahallaQ.data} />
        <FocusMahalla code={focusCode} mahallas={mahallaQ.data} district={districtQ.data} />

        {districtQ.data && (
          <GeoJSON
            data={districtQ.data}
            interactive={false}
            style={{ color: '#059669', weight: 2.5, fillOpacity: 0 }}
          />
        )}

        {mahallaQ.data && (
          <GeoJSON
            key={mahallaKey}
            data={mahallaQ.data}
            style={(f) => {
              const code = (f?.properties as ZoneProps | undefined)?.code ?? '';
              const m = loadByCode.get(code);
              if (!layers.load && code !== focusCode)
                return { color: '#94a3b8', weight: 0.8, fillOpacity: 0.02 };
              return loadStyle(m?.open ?? 0, m?.overdue ?? 0, code === focusCode);
            }}
            onEachFeature={(f: Feature, layer: Layer) => {
              const p = f.properties as ZoneProps | undefined;
              if (!p) return;
              const m = loadByCode.get(p.code);
              const name = escapeHtml(p.name_uz_lt);
              const tip = m
                ? `<b>${name}</b><br/>${m.open} ochiq · ${m.overdue} muddati o'tgan · jami ${m.total}`
                : `<b>${name}</b><br/>Ochiq murojaat yo'q`;
              layer.bindTooltip(tip, { sticky: true });
              layer.on('click', () => onFocus(focusCode === p.code ? null : p.code));
            }}
          />
        )}

        {layers.staff &&
          staff.map((l) => (
            <CircleMarker
              key={`s-${l.employeeId}`}
              center={[l.latitude as number, l.longitude as number]}
              radius={6}
              pathOptions={{ color: '#fff', weight: 2, fillColor: staffColor(l), fillOpacity: 1 }}
              eventHandlers={{ click: () => navigate('/map') }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <b>{l.fullName}</b>
                <br />
                {l.mahallaName ?? l.position} · {isOnline(l) ? 'onlayn' : 'oflayn'}
              </Tooltip>
            </CircleMarker>
          ))}

        {layers.pins &&
          pins.map((p) => (
            <CircleMarker
              key={`p-${p.id}`}
              center={[p.lat, p.lng]}
              radius={p.priority === 'high' ? 8 : 6.5}
              pathOptions={{
                color: p.overdue ? '#dc2626' : '#fff',
                weight: p.overdue ? 3 : 2,
                fillColor: PIN_COLOR[p.status] ?? '#64748b',
                fillOpacity: 0.95,
              }}
              eventHandlers={{ click: () => navigate(`/requests?id=${encodeURIComponent(p.id)}`) }}
            >
              <Tooltip direction="top" offset={[0, -6]}>
                <b>{p.title}</b>
                <br />
                {STATUS_META[p.status].label}
                {p.overdue ? " · muddati o'tgan" : ''}
              </Tooltip>
            </CircleMarker>
          ))}
      </MapContainer>

      {/* Layer chips */}
      <div className="absolute left-2.5 top-2.5 z-[1000] flex flex-wrap gap-1.5">
        {LAYERS.map((l) => (
          <button
            key={l.key}
            type="button"
            aria-pressed={layers[l.key]}
            onClick={() => setLayers((s) => ({ ...s, [l.key]: !s[l.key] }))}
            className={cn(
              'h-8 rounded-full border px-3 text-xs font-semibold shadow-sm backdrop-blur transition-colors',
              layers[l.key]
                ? 'border-primary-600 bg-primary-600 text-white'
                : 'border-line bg-surface/90 text-ink-soft hover:bg-surface',
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="absolute right-2.5 top-2.5 z-[1000] flex gap-1.5">
        {focusCode && (
          <button
            type="button"
            onClick={() => onFocus(null)}
            title="Butun tuman"
            aria-label="Butun tumanni ko'rsatish"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface/90 text-ink-soft shadow-sm backdrop-blur hover:bg-surface"
          >
            <Gps size={16} />
          </button>
        )}
        <Link
          to="/map"
          title="To'liq xarita"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface/90 px-2.5 text-xs font-semibold text-ink-soft shadow-sm backdrop-blur hover:bg-surface"
        >
          <Maximize4 size={14} /> <span className="hidden sm:inline">To'liq xarita</span>
        </Link>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2.5 left-2.5 z-[1000] flex max-w-[calc(100%-1.25rem)] flex-wrap gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/90 px-2.5 py-1.5 text-[11px] text-ink-soft backdrop-blur">
        <LegendDot color="#3b82f6" label="Yangi" />
        <LegendDot color="#f59e0b" label="Jarayonda" />
        <LegendDot color="#3b82f6" ring="#dc2626" label="Muddati o'tgan" />
        <LegendDot color="#10b981" label="Xodim (hududda)" />
        <LegendDot color="#ef4444" label="Xodim (tashqarida)" />
      </div>
    </div>
  );
}

function LegendDot({ color, ring, label }: { color: string; ring?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: ring ? `0 0 0 2px ${ring}` : undefined }}
      />
      {label}
    </span>
  );
}
