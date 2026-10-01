import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Layer } from 'leaflet';
import type { Feature } from 'geojson';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  Buildings2,
  CloseCircle,
  Filter,
  Gps,
  RotateRight,
  SearchNormal1,
  Warning2,
} from 'iconsax-react';
import { fetchZonesGeoJson, type ZoneCollection, type ZoneProps } from '@/shared/api/zones';
import { fetchLiveLocations, fetchTrack, type LiveLocation, type TrackPoint } from '@/shared/api/locations';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { Skeleton, SkeletonRow } from '@/shared/ui/Skeleton';
import { useAttendanceToday } from '@/features/attendance/useAttendanceToday';
import type { EmployeeTodayEntry } from '@/features/attendance/api/types';
import { EmployeeDetailDrawer } from './EmployeeDetailDrawer';
import {
  agoShort,
  DISTRICT_CENTER,
  FILTER_ORDER,
  initials,
  isOnline,
  LABELS,
  OFFLINE_COLOR,
  ONLINE_COLOR,
  PROBLEM_KEYS,
  relTime,
  statusColor,
  STATUS_COLORS,
  statusKey,
  statusLabel,
  summarizeTrack,
  trackRange,
  trackSegments,
  type FilterKey,
  type Labels,
  type Lang,
  type StatusKey,
  type TrackWindow,
  YANDEX_TILE_URL,
} from './mapShared';

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

function markerIcon(loc: LiveLocation, selected: boolean, ariaLabel: string): L.DivIcon {
  const color = statusColor(loc);
  const initial = initials(loc.fullName).charAt(0);
  // Marker body = xodim RASMI (bo'lsa), aks holda birinchi harf. Holat rangi
  // rasm atrofidagi HALQA sifatida — ham foto, ham holat ko'rinadi.
  const body = loc.avatarUrl
    ? `<img src="${escapeAttr(loc.avatarUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;
        color:#fff;font:600 13px system-ui;background:${color};">${initial}</div>`;
  const statusRing = `0 0 0 2.5px ${color}`;
  const selRing = selected ? ',0 0 0 7px rgba(99,102,241,0.35)' : '';
  // Freshness dot (green online / grey offline) is a separate axis from the
  // status ring; the aria-label spells both out, so color is never the only cue.
  const dotColor = isOnline(loc) ? ONLINE_COLOR : OFFLINE_COLOR;
  const size = selected ? 38 : 32;
  return L.divIcon({
    className: 'emp-marker',
    html: `<div role="img" aria-label="${escapeAttr(ariaLabel)}"
      style="position:relative;width:${size}px;height:${size}px;">
      <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;background:${color};
        border:2px solid #fff;box-shadow:${statusRing}${selRing};">${body}</div>
      <span style="position:absolute;top:-1px;right:-1px;width:10px;height:10px;
        border-radius:50%;background:${dotColor};border:2px solid #fff;z-index:1;"></span>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

/**
 * Flies to the selected employee ONCE per selection (keyed on the id, not the
 * live position — otherwise every 15 s poll would re-center and fight the
 * admin's manual pan).
 */
function FlyTo({ pos, flyKey }: { pos: [number, number] | null; flyKey: string | null }) {
  const map = useMap();
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (!flyKey) {
      lastKey.current = null;
      return;
    }
    if (pos && flyKey !== lastKey.current) {
      lastKey.current = flyKey;
      map.flyTo(pos, Math.max(map.getZoom(), 15), { duration: 0.8 });
    }
  }, [pos, flyKey, map]);
  return null;
}

/**
 * "Kuzatib borish": while on, every new live position of the selected employee
 * pans the map to it. Dragging the map hands control back to the admin.
 */
function Follow({
  pos,
  on,
  onStop,
}: {
  pos: [number, number] | null;
  on: boolean;
  onStop: () => void;
}) {
  const map = useMap();
  useMapEvents({ dragstart: () => on && onStop() });
  useEffect(() => {
    if (on && pos) map.panTo(pos, { animate: true, duration: 0.6 });
  }, [on, pos, map]);
  return null;
}

/** Frames the district's mahallas once they load (the district polygon has a far exclave). */
function FitHome({ mahallas }: { mahallas: ZoneCollection | undefined }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !mahallas?.features.length) return;
    const b = L.geoJSON(mahallas).getBounds();
    if (b.isValid()) {
      map.fitBounds(b, { padding: [16, 16] });
      done.current = true;
    }
  }, [mahallas, map]);
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

/** Markers closer than this on screen are fanned out so each stays clickable. */
const OVERLAP_PX = 28;

/**
 * Employee markers. Several people at the same spot (the office, one
 * building) used to sit exactly on top of each other — only one was
 * clickable. Overlapping markers are fanned out in a small ring around their
 * shared point, recomputed per zoom level; the real spot keeps a tiny dot.
 */
function EmployeeMarkers({
  locs,
  selectedId,
  dimmed,
  onSelect,
  lang,
  t,
}: {
  locs: LiveLocation[];
  selectedId: string | null;
  dimmed: Set<string>;
  onSelect: (id: string) => void;
  lang: Lang;
  t: Labels;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });

  const placed = useMemo(() => {
    const pts = locs.map((l) => ({
      loc: l,
      true: [l.latitude as number, l.longitude as number] as [number, number],
      px: map.project([l.latitude as number, l.longitude as number], zoom),
    }));
    const groups: { members: typeof pts; c: L.Point }[] = [];
    for (const p of pts) {
      const g = groups.find((gr) => gr.c.distanceTo(p.px) < OVERLAP_PX);
      if (g) {
        g.members.push(p);
        const n = g.members.length;
        g.c = L.point(g.c.x + (p.px.x - g.c.x) / n, g.c.y + (p.px.y - g.c.y) / n);
      } else {
        groups.push({ members: [p], c: p.px });
      }
    }
    return groups.flatMap((g) => {
      if (g.members.length === 1) {
        return [{ ...g.members[0], shown: g.members[0].true, fanned: false }];
      }
      const r = 20 + g.members.length * 3;
      return g.members.map((m, i) => {
        const a = (2 * Math.PI * i) / g.members.length - Math.PI / 2;
        const ll = map.unproject(L.point(g.c.x + r * Math.cos(a), g.c.y + r * Math.sin(a)), zoom);
        return { ...m, shown: [ll.lat, ll.lng] as [number, number], fanned: true };
      });
    });
  }, [locs, zoom, map]);

  return (
    <>
      {placed.map(({ loc, shown, fanned, true: real }) => {
        const label = `${loc.fullName} — ${statusLabel(loc, lang)} · ${isOnline(loc) ? t.online : t.offline}`;
        const selected = loc.employeeId === selectedId;
        return (
          <Fragment key={loc.employeeId}>
            {fanned && (
              <>
                <Polyline positions={[real, shown]} pathOptions={{ color: '#64748b', weight: 1, opacity: 0.6 }} />
                <CircleMarker
                  center={real}
                  radius={2.5}
                  pathOptions={{ color: '#475569', weight: 1, fillColor: '#475569', fillOpacity: 1 }}
                />
              </>
            )}
            <Marker
              position={shown}
              icon={markerIcon(loc, selected, label)}
              opacity={dimmed.has(loc.employeeId) && !selected ? 0.5 : 1}
              zIndexOffset={selected ? 1000 : 0}
              title={label}
              alt={label}
              keyboard
              eventHandlers={{ click: () => onSelect(loc.employeeId) }}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                {label}
              </Tooltip>
            </Marker>
          </Fragment>
        );
      })}
    </>
  );
}

/** Problem order in the list/alerts: farthest from where they should be first. */
const SEVERITY: Record<StatusKey, number> = {
  outside: 0,
  offzone: 1,
  stale: 2,
  zone: 3,
  office: 3,
  noloc: 4,
};

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date().toDateString();
}

export function MapPage() {
  const lang: Lang = (localStorage.getItem('hkm-lang') as Lang) === 'ru' ? 'ru' : 'uz';
  const t = LABELS[lang];

  // `?employee=<id>` — davomat/dashboard'dan to'g'ridan-to'g'ri shu xodimga.
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedIdState] = useState<string | null>(() => searchParams.get('employee'));
  const [follow, setFollow] = useState(false);
  const urlEmployee = searchParams.get('employee');
  const [seenUrl, setSeenUrl] = useState(urlEmployee);
  if (urlEmployee !== seenUrl) {
    setSeenUrl(urlEmployee);
    if (urlEmployee) setSelectedIdState(urlEmployee);
  }
  const setSelectedId = (id: string | null) => {
    setSelectedIdState(id);
    setFollow(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('employee', id);
        else next.delete('employee');
        return next;
      },
      { replace: true },
    );
  };

  const [query, setQuery] = useState('');
  const [showMahallas, setShowMahallas] = useState(true);
  const [statusFilter, setStatusFilter] = useState<FilterKey>('all');
  const [mahallaFilter, setMahallaFilter] = useState<MahallaFilter | null>(null);
  const [trackWindow, setTrackWindow] = useState<TrackWindow>('today');
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile overlay
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);

  // NOTE: the "updated Xs ago" pill owns its own 1s ticker (see <UpdatedAgo/>)
  // so the map subtree is NOT re-rendered every second.

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

  // Bugungi davomat — kim ishda, kim ketgan: ishdan ketgan xodimning joyi
  // "muammo" emas. Dashboard/davomat bilan bir xil kesh.
  const attendanceQ = useAttendanceToday();
  const attendanceById = useMemo(() => {
    const m = new Map<string, EmployeeTodayEntry>();
    for (const r of attendanceQ.data?.roster ?? []) m.set(r.employeeId, r);
    return m;
  }, [attendanceQ.data]);
  const hasAttendance = attendanceById.size > 0;
  /** On duty right now: checked in and not out (everyone, if davomat is unavailable). */
  const onDuty = (id: string) => {
    if (!hasAttendance) return true;
    const a = attendanceById.get(id);
    return !!a?.checkIn && !a.checkOut;
  };

  const trackQ = useQuery({
    queryKey: ['track', selectedId, trackWindow],
    queryFn: () => {
      const { from, to } = trackRange(trackWindow);
      return fetchTrack(selectedId as string, { from, to, limit: 1500 });
    },
    enabled: !!selectedId,
    // The window always ends "now" — keep the route growing while it's open.
    refetchInterval: 30_000,
  });
  const track = trackQ.data;

  const mahallaNames = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of mahallaQ.data?.features ?? []) {
      const p = f.properties as ZoneProps;
      m.set(p.code, lang === 'ru' ? (p.name_ru ?? p.name_uz_lt) : p.name_uz_lt);
    }
    return m;
  }, [mahallaQ.data, lang]);

  const selected = locations.find((l) => l.employeeId === selectedId) ?? null;
  const selLat = selected?.latitude ?? null;
  const selLng = selected?.longitude ?? null;
  const selectedPos = useMemo<[number, number] | null>(
    () => (selLat != null && selLng != null ? [selLat, selLng] : null),
    [selLat, selLng],
  );

  // Problem = off their zone / out of the district / went silent today —
  // only while on duty (after check-out or before check-in it's nobody's concern).
  const isProblem = (l: LiveLocation) => {
    const k = statusKey(l);
    if (!PROBLEM_KEYS.includes(k) || !onDuty(l.employeeId)) return false;
    return k !== 'stale' || isToday(l.lastLocationAt);
  };

  // Search + mahalla filters (but NOT the status chip), so each chip can show its count.
  const base = useMemo(
    () =>
      locations.filter(
        (l) =>
          matchesSearch(query, l.fullName, l.position, l.mahallaName) &&
          (!mahallaFilter || l.mahallaCode === mahallaFilter.code),
      ),
    [locations, query, mahallaFilter],
  );

  const counts = useMemo(() => {
    const c = Object.fromEntries(FILTER_ORDER.map((k) => [k, 0])) as Record<FilterKey, number>;
    c.all = base.length;
    for (const l of base) c[statusKey(l)]++;
    return c;
  }, [base]);

  const filtered = useMemo(() => {
    const rows = statusFilter === 'all' ? base : base.filter((l) => statusKey(l) === statusFilter);
    // Problems first (most severe), then everyone else alphabetically.
    return [...rows].sort((a, b) => {
      const pa = isProblem(a) ? SEVERITY[statusKey(a)] : 9;
      const pb = isProblem(b) ? SEVERITY[statusKey(b)] : 9;
      return pa - pb || a.fullName.localeCompare(b.fullName);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, statusFilter, attendanceById]);

  const headline = useMemo(() => {
    let online = 0;
    let inZone = 0;
    let problems = 0;
    for (const l of locations) {
      const k = statusKey(l);
      if (isOnline(l)) online++;
      if (k === 'office' || k === 'zone') inZone++;
      if (isProblem(l)) problems++;
    }
    return { total: locations.length, online, inZone, problems };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locations, attendanceById]);

  const alerts = useMemo(
    () =>
      locations
        .filter(isProblem)
        .sort((a, b) => SEVERITY[statusKey(a)] - SEVERITY[statusKey(b)]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locations, attendanceById],
  );

  const markerLocs = useMemo(
    () => filtered.filter((l) => l.hasLocation && l.latitude != null && l.longitude != null),
    [filtered],
  );
  // Faded: no signal, or already off duty (left / not in today).
  const dimmed = useMemo(
    () =>
      new Set(
        markerLocs
          .filter((l) => l.isStale || (hasAttendance && !onDuty(l.employeeId)))
          .map((l) => l.employeeId),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markerLocs, attendanceById],
  );

  // Per-mahalla headcount of FRESH positions only (a position from yesterday
  // says nothing about who is there now) → polygon tint.
  const occupancy = useMemo(() => {
    const c = new Map<string, number>();
    for (const l of locations) {
      if (l.mahallaCode && l.hasLocation && !l.isStale) {
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
        .join(',') + `|f:${mahallaFilter?.code ?? ''}|${lang}`,
    [occupancy, mahallaFilter, lang],
  );

  // The selected employee's assigned mahallas, outlined on the map.
  const assignedCodes = useMemo(() => selected?.assignedMahallaCodes ?? [], [selected?.assignedMahallaCodes]);
  const assignedGeo = useMemo<ZoneCollection | null>(() => {
    if (!mahallaQ.data || assignedCodes.length === 0) return null;
    return {
      ...mahallaQ.data,
      features: mahallaQ.data.features.filter((f) =>
        assignedCodes.includes((f.properties as ZoneProps).code),
      ),
    };
  }, [mahallaQ.data, assignedCodes]);

  const segments = useMemo(() => trackSegments(track?.points ?? []), [track]);
  const summary = useMemo(() => summarizeTrack(track?.points ?? []), [track]);
  const trackStart = track?.points[0];

  function focusPoint(p: TrackPoint) {
    setFlyTarget({ pos: [p.latitude, p.longitude], nonce: performance.now() });
  }

  const chipLabels: Record<FilterKey, string> = {
    all: t.fAll,
    office: t.fOffice,
    zone: t.fZone,
    offzone: t.fOffzone,
    outside: t.fOutside,
    stale: t.fStale,
    noloc: t.fNoloc,
  };

  return (
    // `isolate` = own stacking context, so Leaflet's z-indexes (400–1000) and
    // this page's overlays never paint over the app shell.
    <div className="relative isolate flex h-[calc(100dvh-5.5rem)] min-h-[520px] gap-4">
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
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/10">
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
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {locationsQ.data ? (
              <>
                <Stat label={t.total} value={headline.total} tone="ink" />
                <Stat label={t.reporting} value={headline.online} tone="blue" />
                <Stat label={t.inOffice} value={headline.inZone} tone="green" />
                <Stat label={t.problems} value={headline.problems} tone={headline.problems ? 'red' : 'ink'} />
              </>
            ) : (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[52px]" />)
            )}
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
              aria-label={t.search}
              className="h-11 w-full rounded-lg border border-line bg-surface-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-primary-500"
            />
          </div>
        </div>

        {/* Status filter chips */}
        <div className="flex flex-wrap gap-1.5 px-3 pt-3">
          {FILTER_ORDER.map((key) => {
            const active = statusFilter === key;
            const color = key === 'all' ? '#0f172a' : STATUS_COLORS[key as StatusKey];
            if (key !== 'all' && counts[key] === 0 && !active) return null;
            return (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  active ? 'text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                )}
                style={active ? { background: color } : undefined}
              >
                {key !== 'all' && (
                  <span className="h-2 w-2 rounded-full" style={{ background: active ? '#fff' : color }} />
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
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-primary-50 py-1 pl-2.5 pr-1.5 text-[11px] font-semibold text-primary-700 dark:bg-primary-500/10">
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
          {locationsQ.isLoading && Array.from({ length: 7 }).map((_, i) => <SkeletonRow key={i} />)}
          {!locationsQ.isLoading &&
            filtered.length === 0 &&
            (locationsQ.isError && locations.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                <p className="text-sm font-medium text-danger">{t.loadError}</p>
                <button
                  onClick={() => locationsQ.refetch()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink-soft hover:bg-surface-2"
                >
                  <RotateRight size={13} /> {t.retry}
                </button>
              </div>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-ink-muted">
                {locations.length === 0 ? t.empty : t.noneMatch}
              </p>
            ))}
          {filtered.map((loc) => {
            const att = attendanceById.get(loc.employeeId);
            const problem = isProblem(loc);
            return (
              <button
                key={loc.employeeId}
                onClick={() => {
                  setSelectedId(loc.employeeId);
                  setSidebarOpen(false);
                }}
                className={cn(
                  'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors',
                  selectedId === loc.employeeId ? 'bg-primary-50 dark:bg-primary-500/10' : 'hover:bg-surface-2',
                )}
              >
                <span
                  role="img"
                  aria-label={statusLabel(loc, lang)}
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface"
                  style={{ background: statusColor(loc) }}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 truncate text-sm font-medium text-ink">
                    <span className="truncate">{loc.fullName}</span>
                    {problem && <Warning2 size={13} variant="Bold" className="shrink-0 text-amber-500" />}
                  </span>
                  <span className={cn('block truncate text-xs', problem ? 'text-amber-600' : 'text-ink-muted')}>
                    {problem ? statusLabel(loc, lang) : (loc.mahallaName ?? loc.position)}
                    {hasAttendance && att?.checkOut && ` · ${t.leftAt.toLowerCase()}`}
                    {hasAttendance && att && !att.checkIn && ` · ${t.notCame.toLowerCase()}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5 text-[11px] text-ink-muted">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: isOnline(loc) ? ONLINE_COLOR : OFFLINE_COLOR }}
                    aria-label={isOnline(loc) ? t.online : t.offline}
                  />
                  {loc.hasLocation ? relTime(loc.lastLocationAt, t) : t.never}
                </span>
              </button>
            );
          })}
        </div>

        {/* Alerts — only people on duty, worst first */}
        {alerts.length > 0 && (
          <div className="border-t border-line p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-danger">
              <Warning2 size={14} variant="Bold" />
              {t.alerts} · {alerts.length}
            </div>
            <div className="max-h-36 space-y-1 overflow-y-auto">
              {alerts.slice(0, 20).map((a) => {
                const k = statusKey(a);
                return (
                  <button
                    key={a.employeeId}
                    onClick={() => {
                      setSelectedId(a.employeeId);
                      setSidebarOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-1.5 text-left text-xs hover:brightness-95"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: STATUS_COLORS[k] }} />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{a.fullName}</span>
                    <span className="shrink-0 text-red-700 dark:text-red-400">
                      {k === 'stale'
                        ? `${t.stale} · ${relTime(a.lastLocationAt, t)}`
                        : k === 'outside'
                          ? t.alertOut
                          : (a.mahallaName ?? t.alertOff)}
                    </span>
                  </button>
                );
              })}
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
      <div className="relative isolate min-w-0 flex-1 overflow-hidden rounded-2xl border border-line">
        <MapContainer
          center={DISTRICT_CENTER}
          zoom={12}
          maxZoom={19}
          scrollWheelZoom
          // Yandex raster tiles are EPSG:3395; with the default 3857 every
          // overlay would be drawn ~20 km off at Tashkent's latitude.
          crs={L.CRS.EPSG3395}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer attribution="&copy; Yandex" url={YANDEX_TILE_URL} maxZoom={19} />

          {districtQ.data && (
            <GeoJSON
              data={districtQ.data}
              style={{ color: '#059669', weight: 2.5, fillColor: '#10b981', fillOpacity: 0.05 }}
            />
          )}

          {showMahallas && mahallaQ.data && (
            <GeoJSON
              key={`mahallas-${mahallaLayerKey}`}
              data={mahallaQ.data}
              style={(feature) => {
                const code = (feature?.properties as ZoneProps | undefined)?.code;
                const isActive = !!code && code === mahallaFilter?.code;
                const count = code ? (occupancy.get(code) ?? 0) : 0;
                if (isActive) {
                  return { color: '#4f46e5', weight: 2.5, fillColor: '#6366f1', fillOpacity: 0.25 };
                }
                if (count > 0) {
                  return {
                    color: '#059669',
                    weight: 1.5,
                    fillColor: '#10b981',
                    fillOpacity: Math.min(0.14 + count * 0.1, 0.5),
                  };
                }
                return { color: '#94a3b8', weight: 1, fillColor: '#94a3b8', fillOpacity: 0.02 };
              }}
              onEachFeature={(feature: Feature, layer: Layer) => {
                const p = feature.properties as ZoneProps | undefined;
                if (!p) return;
                const count = occupancy.get(p.code) ?? 0;
                const name = lang === 'ru' ? (p.name_ru ?? p.name_uz_lt) : p.name_uz_lt;
                layer.bindTooltip(count > 0 ? `${name} — ${count} xodim` : name, { sticky: true });
                layer.on('click', () => {
                  setMahallaFilter((prev) => (prev?.code === p.code ? null : { code: p.code, name }));
                });
              }}
            />
          )}

          {/* Selected employee's assigned zone */}
          {assignedGeo && (
            <GeoJSON
              key={`assigned-${selectedId}-${assignedCodes.join(',')}`}
              data={assignedGeo}
              interactive={false}
              style={{ color: '#6366f1', weight: 2.5, dashArray: '6 5', fillColor: '#6366f1', fillOpacity: 0.08 }}
            />
          )}

          {/* Route: solid runs, dashed hops across signal breaks */}
          {segments.gaps.map((g, i) => (
            <Polyline
              key={`gap-${i}`}
              positions={g}
              pathOptions={{ color: '#f59e0b', weight: 2, dashArray: '3 7', opacity: 0.9 }}
            />
          ))}
          {segments.runs.map((run, i) =>
            run.length > 1 ? (
              <Polyline key={`run-${i}`} positions={run} pathOptions={{ color: '#6366f1', weight: 3.5, opacity: 0.85 }} />
            ) : null,
          )}
          {trackStart && (
            <CircleMarker
              center={[trackStart.latitude, trackStart.longitude]}
              radius={5}
              pathOptions={{ color: '#fff', weight: 2, fillColor: '#6366f1', fillOpacity: 1 }}
            >
              <Tooltip direction="top">Boshlanish</Tooltip>
            </CircleMarker>
          )}

          <EmployeeMarkers
            locs={markerLocs}
            selectedId={selectedId}
            dimmed={dimmed}
            onSelect={setSelectedId}
            lang={lang}
            t={t}
          />

          <FitHome mahallas={mahallaQ.data} />
          <FlyTo pos={selectedPos} flyKey={selectedId} />
          <Follow pos={selectedPos} on={follow} onStop={() => setFollow(false)} />
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
            {headline.problems > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {headline.problems}
              </span>
            )}
          </button>
          <UpdatedAgo isFetching={locationsQ.isFetching} updatedAt={locationsQ.dataUpdatedAt} t={t} />
        </div>

        {/* Top-right: follow (when someone is selected) + mahalla toggle */}
        <div className="absolute right-3 top-3 z-[1000] flex items-center gap-2">
          {selectedPos && (
            <button
              onClick={() => setFollow((f) => !f)}
              aria-pressed={follow}
              className={cn(
                'inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium shadow-sm transition-colors',
                follow ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-line bg-surface text-ink-soft',
              )}
            >
              <Gps size={15} variant={follow ? 'Bold' : 'Linear'} />
              <span className="hidden sm:inline">{follow ? t.following : t.follow}</span>
            </button>
          )}
          <button
            onClick={() => setShowMahallas((s) => !s)}
            className={cn(
              'inline-flex h-11 items-center rounded-lg border px-3 text-xs font-medium shadow-sm transition-colors',
              showMahallas ? 'border-primary-500 bg-primary-600 text-white' : 'border-line bg-surface text-ink-soft',
            )}
          >
            {t.mahallas}
          </button>
        </div>

        {/* Legend */}
        <div className="absolute bottom-3 left-3 z-[1000] flex max-w-[calc(100%-1.5rem)] flex-wrap gap-x-3 gap-y-1 rounded-lg border border-line bg-surface/90 px-3 py-2 text-[11px] text-ink-soft backdrop-blur">
          <Legend color={STATUS_COLORS.office} label={t.office} />
          <Legend color={STATUS_COLORS.zone} label={t.zone} />
          <Legend color={STATUS_COLORS.offzone} label={t.offzone} />
          <Legend color={STATUS_COLORS.outside} label={t.outDistrict} />
          <Legend color={STATUS_COLORS.stale} label={t.stale} />
        </div>

        {/* Detail drawer */}
        {selected && (
          <EmployeeDetailDrawer
            loc={selected}
            track={track}
            trackLoading={trackQ.isLoading}
            trackWindow={trackWindow}
            onTrackWindow={setTrackWindow}
            summary={summary}
            attendance={attendanceById.get(selected.employeeId) ?? null}
            assignedNames={assignedCodes.map((c) => mahallaNames.get(c) ?? c)}
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
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <div className={`text-lg font-bold tabular-nums ${toneClass}`}>{value}</div>
      <div className="truncate text-[10.5px] text-ink-muted">{label}</div>
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

/**
 * The "updated Xs ago" pill. Owns a private 1-second ticker so the relative
 * time counts up WITHOUT re-rendering the map.
 */
function UpdatedAgo({ isFetching, updatedAt, t }: { isFetching: boolean; updatedAt: number; t: Labels }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface/90 px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm backdrop-blur">
      {isFetching ? (
        <RotateRight size={13} className="animate-spin text-primary-600" />
      ) : (
        <span className="h-2 w-2 rounded-full bg-primary-500" />
      )}
      {t.updated}: {updatedAt ? agoShort(updatedAt, now, t) : '—'}
    </span>
  );
}
