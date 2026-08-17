import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Marker,
  Polygon,
  Popup,
  Tooltip,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import {
  TickCircle,
  CloseCircle,
  Routing,
  Buildings2,
  Profile2User,
  MessageQuestion,
  Video,
  People,
  Home2,
  Star1,
  Gps,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import {
  CAMERAS,
  CATEGORY_META,
  DISTRICT_LOADS,
  DISTRICTS,
  HOME_DISTRICT,
  HOME_DISTRICT_ID,
  LOAD_COLOR,
  LOAD_LABEL,
  REQUESTS,
  TASHKENT_CENTER,
  WORKERS,
} from '@/shared/data/mock';
import type { Camera, Worker } from '@/shared/data/types';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

/** "Bizning hudud" — uy hududi uchun ajratilgan brend rangi */
const HOME_COLOR = '#059669';
const HOME_FILL = '#10b981';

/* ---- Custom map markers ---- */
function workerIcon(w: Worker, selected: boolean) {
  const ring = w.insideRegion ? '#10b981' : '#ef4444';
  const size = selected ? 46 : 38;
  return L.divIcon({
    className: 'worker-pin',
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;border:3px solid ${ring};box-shadow:0 6px 16px rgba(15,23,42,.3);overflow:hidden;background:#fff;">
      <img src="${w.photo}" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover" onerror="this.replaceWith(Object.assign(document.createElement('div'),{innerHTML:'',style:'width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${w.avatarColor};color:#fff;font-weight:700;font-size:13px',innerText:'${w.name
        .split(' ')
        .map((p) => p[0])
        .slice(0, 2)
        .join('')}'}))" />
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function cameraIcon(c: Camera) {
  const color =
    c.status === 'online' ? '#3b82f6' : c.status === 'maintenance' ? '#f59e0b' : '#94a3b8';
  return L.divIcon({
    className: 'cam-pin',
    html: `<div style="width:24px;height:24px;border-radius:7px;background:${color};display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(15,23,42,.3);">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function homeMarkerIcon() {
  return L.divIcon({
    className: 'home-marker',
    html: `<div style="display:flex;align-items:center;gap:7px;padding:6px 12px 6px 6px;border-radius:9999px;background:linear-gradient(135deg,${HOME_FILL},${HOME_COLOR});box-shadow:0 10px 26px rgba(5,150,105,.5);border:2px solid #fff;white-space:nowrap;">
      <span style="display:flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:9999px;background:rgba(255,255,255,.22);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>
      </span>
      <span style="line-height:1.1;">
        <span style="display:block;color:#fff;font-weight:800;font-size:12.5px;">Mirzo Ulug‘bek</span>
        <span style="display:block;color:rgba(255,255,255,.92);font-weight:600;font-size:10px;">★ Bizning hudud</span>
      </span>
    </div>`,
    iconSize: [168, 46],
    iconAnchor: [84, 23],
  });
}

function FlyTo({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 14, { duration: 0.8 });
  }, [target, map]);
  return null;
}

type LayerKey = 'boundaries' | 'workers' | 'requests' | 'cameras';

function DistrictPopup({ dl }: { dl: (typeof DISTRICT_LOADS)[number] }) {
  const home = dl.district.id === HOME_DISTRICT_ID;
  return (
    <div className="py-1">
      <div className="flex items-center gap-1.5 text-sm font-bold">
        {dl.district.name}
        {home && (
          <span
            className="rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white"
            style={{ background: HOME_COLOR }}
          >
            Bizning hudud
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-slate-500">
        Aholi: {formatNumber(dl.district.population)} · {dl.district.areaKm2} km²
      </div>
      <div className="mt-1 text-xs">
        Murojaat: <b>{dl.requests}</b> · Hal: <b>{dl.resolved}</b>
      </div>
      <div className="mt-1 text-xs">
        Ishchilar: <b>{dl.workers}</b> · Kamera: <b>{dl.cameras}</b>
      </div>
    </div>
  );
}

export function MapPage() {
  const [selectedWorker, setSelectedWorker] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    boundaries: true,
    workers: true,
    requests: false,
    cameras: false,
  });

  const inside = WORKERS.filter((w) => w.insideRegion).length;
  const outside = WORKERS.length - inside;
  const camsOnline = CAMERAS.filter((c) => c.status === 'online').length;
  const openReq = REQUESTS.filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;

  const districtDetail = useMemo(
    () => DISTRICT_LOADS.find((d) => d.district.id === selectedDistrict),
    [selectedDistrict],
  );

  const toggle = (k: LayerKey) => setLayers((s) => ({ ...s, [k]: !s[k] }));

  const LAYER_DEF: { key: LayerKey; label: string; icon: typeof Buildings2; color: string }[] = [
    { key: 'boundaries', label: 'Hududlar', icon: Buildings2, color: '#10b981' },
    { key: 'workers', label: 'Ishchilar', icon: Profile2User, color: '#3b82f6' },
    { key: 'requests', label: 'Murojaatlar', icon: MessageQuestion, color: '#f59e0b' },
    { key: 'cameras', label: 'Kameralar', icon: Video, color: '#a855f7' },
  ];

  return (
    <div>
      <PageHeader
        title="Jonli xarita"
        subtitle="Toshkent shahar — tuman chegaralari, ishchilar, kameralar va murojaatlar real vaqtda"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDistrict(HOME_DISTRICT_ID);
                setFlyTarget(HOME_DISTRICT.center);
              }}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
            >
              <Home2 size={17} variant="Bulk" /> Bizning hududga
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px]">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
              </span>
              <span className="font-medium text-ink-soft">Jonli efir</span>
            </div>
          </div>
        }
      />

      {/* Layer toggles */}
      <div className="mb-4 flex flex-wrap gap-2">
        {LAYER_DEF.map((l) => (
          <button
            key={l.key}
            onClick={() => toggle(l.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-all',
              layers[l.key]
                ? 'border-transparent text-white shadow-sm'
                : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
            )}
            style={layers[l.key] ? { background: l.color } : undefined}
          >
            <l.icon size={17} variant="Bulk" />
            {l.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-4">
        {/* Map */}
        <Card className="overflow-hidden p-0 xl:col-span-3">
          <div className="h-160 w-full">
            <MapContainer
              center={TASHKENT_CENTER}
              zoom={11}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap, &copy; CARTO"
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
              />
              <FlyTo target={flyTarget} />

              {/* District boundaries — har bir tuman o'z rangida, qat'iy ajratilgan */}
              {layers.boundaries &&
                DISTRICT_LOADS.filter((dl) => dl.district.id !== HOME_DISTRICT_ID).map((dl) => {
                  const active = selectedDistrict === dl.district.id;
                  const color = dl.district.color;
                  return (
                    <Polygon
                      key={dl.district.id}
                      positions={dl.district.polygon}
                      pathOptions={{
                        color,
                        weight: active ? 2.5 : 1.5,
                        opacity: 0.85,
                        fillColor: color,
                        fillOpacity: active ? 0.24 : 0.1,
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedDistrict(dl.district.id);
                          setFlyTarget(dl.district.center);
                        },
                      }}
                    >
                      <Tooltip direction="center" permanent className="district-label">
                        {dl.district.name}
                      </Tooltip>
                      <Popup>
                        <DistrictPopup dl={dl} />
                      </Popup>
                    </Polygon>
                  );
                })}

              {/* "Bizning hudud" — Mirzo Ulug'bek kuchli ajratib, eng ustida ko'rsatiladi */}
              {layers.boundaries &&
                (() => {
                  const dl = DISTRICT_LOADS.find((d) => d.district.id === HOME_DISTRICT_ID);
                  if (!dl) return null;
                  const active = selectedDistrict === HOME_DISTRICT_ID;
                  return (
                    <Polygon
                      positions={dl.district.polygon}
                      pathOptions={{
                        color: HOME_COLOR,
                        weight: active ? 5 : 4,
                        fillColor: HOME_FILL,
                        fillOpacity: active ? 0.4 : 0.32,
                        className: 'home-zone',
                      }}
                      eventHandlers={{
                        click: () => {
                          setSelectedDistrict(HOME_DISTRICT_ID);
                          setFlyTarget(dl.district.center);
                        },
                      }}
                    >
                      <Popup>
                        <DistrictPopup dl={dl} />
                      </Popup>
                    </Polygon>
                  );
                })()}

              {/* Home marker — belgilangan "Bizning hudud" nishoni */}
              {layers.boundaries && (
                <Marker
                  position={HOME_DISTRICT.center}
                  icon={homeMarkerIcon()}
                  zIndexOffset={1000}
                  eventHandlers={{
                    click: () => {
                      setSelectedDistrict(HOME_DISTRICT_ID);
                      setFlyTarget(HOME_DISTRICT.center);
                    },
                  }}
                />
              )}

              {/* Requests */}
              {layers.requests &&
                REQUESTS.map((r) => (
                  <CircleMarker
                    key={r.id}
                    center={[r.lat, r.lng]}
                    radius={5}
                    pathOptions={{
                      color: '#fff',
                      weight: 1.5,
                      fillColor: CATEGORY_META[r.category].color,
                      fillOpacity: 0.9,
                    }}
                  >
                    <Popup>
                      <div className="py-1">
                        <div className="text-sm font-semibold">{r.title}</div>
                        <div className="text-xs text-slate-500">
                          {r.region} · {CATEGORY_META[r.category].label}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

              {/* Cameras */}
              {layers.cameras &&
                CAMERAS.map((c) => (
                  <Marker key={c.id} position={[c.lat, c.lng]} icon={cameraIcon(c)}>
                    <Popup>
                      <div className="py-1">
                        <div className="text-sm font-semibold">{c.name}</div>
                        <div className="text-xs text-slate-500">
                          {c.resolution} · {c.type.toUpperCase()}
                        </div>
                        <div className="text-xs">
                          Holat:{' '}
                          <b
                            style={{
                              color:
                                c.status === 'online'
                                  ? '#10b981'
                                  : c.status === 'maintenance'
                                    ? '#f59e0b'
                                    : '#ef4444',
                            }}
                          >
                            {c.status === 'online'
                              ? 'Onlayn'
                              : c.status === 'maintenance'
                                ? 'Texnik xizmat'
                                : 'Oflayn'}
                          </b>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

              {/* Workers (photo pins) */}
              {layers.workers &&
                WORKERS.map((w) => (
                  <Marker
                    key={w.id}
                    position={[w.lat, w.lng]}
                    icon={workerIcon(w, selectedWorker === w.id)}
                    eventHandlers={{ click: () => setSelectedWorker(w.id) }}
                  >
                    <Popup>
                      <div className="flex items-center gap-2 py-1">
                        <Avatar name={w.name} src={w.photo} color={w.avatarColor} size={36} />
                        <div>
                          <div className="text-sm font-semibold">{w.name}</div>
                          <div className="text-xs text-slate-500">{w.position}</div>
                          <div
                            className="mt-0.5 text-xs font-medium"
                            style={{ color: w.insideRegion ? '#10b981' : '#ef4444' }}
                          >
                            {w.insideRegion ? '✓ O‘z hududida' : '✕ Hudud tashqarisida'}
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          </div>
        </Card>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Bizning hudud — featured */}
          <Card className="relative overflow-hidden p-4">
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full"
              style={{ background: HOME_FILL, opacity: 0.14 }}
            />
            <div
              className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider"
              style={{ color: HOME_COLOR }}
            >
              <Star1 size={14} variant="Bold" /> Bizning hudud
            </div>
            <div className="mt-2 flex items-center gap-2.5">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-glow"
                style={{ background: `linear-gradient(135deg, ${HOME_FILL}, ${HOME_COLOR})` }}
              >
                <Home2 size={22} variant="Bulk" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-bold text-ink">{HOME_DISTRICT.name}</div>
                <div className="text-[12px] text-ink-muted">
                  Toshkent shahar · {HOME_DISTRICT.areaKm2} km²
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedDistrict(HOME_DISTRICT_ID);
                setFlyTarget(HOME_DISTRICT.center);
              }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: HOME_COLOR }}
            >
              <Gps size={16} variant="Bulk" /> Xaritada ko‘rsatish
            </button>
          </Card>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-3.5">
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <TickCircle size={15} variant="Bulk" className="text-success" /> Hududda
              </div>
              <div className="mt-1 text-xl font-bold text-ink">{inside}</div>
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <CloseCircle size={15} variant="Bulk" className="text-danger" /> Tashqarida
              </div>
              <div className="mt-1 text-xl font-bold text-ink">{outside}</div>
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <Video size={15} variant="Bulk" className="text-accent-500" /> Kamera onlayn
              </div>
              <div className="mt-1 text-xl font-bold text-ink">
                {camsOnline}/{CAMERAS.length}
              </div>
            </Card>
            <Card className="p-3.5">
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <MessageQuestion size={15} variant="Bulk" className="text-warning" /> Ochiq
              </div>
              <div className="mt-1 text-xl font-bold text-ink">{openReq}</div>
            </Card>
          </div>

          {/* Selected district detail */}
          {districtDetail && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Buildings2 size={18} variant="Bulk" className="text-primary-600" />
                    {districtDetail.district.name}
                  </h3>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: LOAD_COLOR[districtDetail.load] }}
                  >
                    {LOAD_LABEL[districtDetail.load]}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-[13px]">
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="text-ink-muted">Aholi</div>
                    <div className="font-semibold text-ink">
                      {formatNumber(districtDetail.district.population)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="text-ink-muted">Maydon</div>
                    <div className="font-semibold text-ink">
                      {districtDetail.district.areaKm2} km²
                    </div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="text-ink-muted">Murojaat</div>
                    <div className="font-semibold text-ink">{districtDetail.requests}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="text-ink-muted">Hal qilingan</div>
                    <div className="font-semibold text-primary-600">{districtDetail.resolved}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="flex items-center gap-1 text-ink-muted">
                      <People size={13} /> Ishchilar
                    </div>
                    <div className="font-semibold text-ink">{districtDetail.workers}</div>
                  </div>
                  <div className="rounded-lg bg-surface-2 p-2.5">
                    <div className="flex items-center gap-1 text-ink-muted">
                      <Video size={13} /> Kameralar
                    </div>
                    <div className="font-semibold text-ink">{districtDetail.cameras}</div>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedDistrict(null)}
                  className="mt-3 w-full rounded-lg border border-line py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2"
                >
                  Tozalash
                </button>
              </Card>
            </motion.div>
          )}

          {/* District list with load */}
          <Card className="p-2">
            <div className="px-2 py-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Tumanlar ({DISTRICTS.length})
            </div>
            <div className="max-h-70 space-y-0.5 overflow-y-auto">
              {[...DISTRICT_LOADS]
                .sort((a, b) =>
                  a.district.id === HOME_DISTRICT_ID
                    ? -1
                    : b.district.id === HOME_DISTRICT_ID
                      ? 1
                      : 0,
                )
                .map((dl) => {
                  const home = dl.district.id === HOME_DISTRICT_ID;
                  const selected = selectedDistrict === dl.district.id;
                  return (
                    <button
                      key={dl.district.id}
                      onClick={() => {
                        setSelectedDistrict(dl.district.id);
                        setFlyTarget(dl.district.center);
                      }}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        selected ? 'bg-primary-50' : home ? 'bg-primary-50/40' : 'hover:bg-surface-2',
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: home ? HOME_FILL : LOAD_COLOR[dl.load] }}
                      />
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[13px] font-medium text-ink">
                        {dl.district.name}
                        {home && (
                          <span
                            className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
                            style={{ background: HOME_COLOR }}
                          >
                            <Star1 size={9} variant="Bold" /> Bizning
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-ink-muted">{dl.requests} murojaat</span>
                    </button>
                  );
                })}
            </div>
          </Card>

          {/* Legend — belgilar */}
          <Card className="p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Belgilar
            </div>
            <div className="space-y-2.5 text-[13px]">
              <div className="flex items-center gap-2.5">
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-[5px] border-2"
                  style={{ background: `${HOME_FILL}55`, borderColor: HOME_COLOR }}
                />
                <span className="text-ink-soft">
                  Bizning hudud — <span className="font-medium text-ink">Mirzo Ulug‘bek</span>
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                <span className="flex shrink-0 gap-0.5">
                  <span className="h-3.5 w-1.5 rounded-sm" style={{ background: '#3b82f6' }} />
                  <span className="h-3.5 w-1.5 rounded-sm" style={{ background: '#ec4899' }} />
                  <span className="h-3.5 w-1.5 rounded-sm" style={{ background: '#f59e0b' }} />
                </span>
                <span className="text-ink-soft">Boshqa tumanlar (o‘z rangida)</span>
              </div>
              <div className="my-2 h-px bg-line" />
              {(['normal', 'busy', 'critical'] as const).map((l) => (
                <div key={l} className="flex items-center gap-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: LOAD_COLOR[l] }}
                  />
                  <span className="text-ink-soft">{LOAD_LABEL[l]}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-600">
              <Routing size={20} variant="Bulk" />
            </div>
            <div className="text-[13px] text-ink-soft">
              GPS yangilanish: <span className="font-semibold text-ink">har 30 soniya</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
