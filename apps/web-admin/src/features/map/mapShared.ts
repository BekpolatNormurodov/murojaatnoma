import type { LiveLocation } from '@/shared/api/locations';

/** UI language, mirrored from the `hkm-lang` localStorage key. */
export type Lang = 'uz' | 'ru';

/** Status buckets for an employee (mirrors {@link statusColor} priority). */
export type StatusKey = 'office' | 'district' | 'outside' | 'stale' | 'noloc';
/** A status filter chip — every bucket plus the "all" pseudo-bucket. */
export type FilterKey = 'all' | StatusKey;

/** Track time-window presets exposed in the detail drawer. */
export type TrackWindow = 'today' | '1h' | '3h';

/**
 * Office centroid + geofence radius, mirrored from the backend config
 * (`DEFAULT_OFFICE_LATITUDE/LONGITUDE`, `DEFAULT_GEOFENCE_RADIUS_M`). Used
 * only for a client-side distance-to-office readout — `insideOffice` itself
 * is still computed server-side. Leaflet order: [lat, lng].
 */
export const OFFICE_CENTER: [number, number] = [41.3111, 69.3402];

/** Status → marker/legend color. */
export const STATUS_COLORS: Record<StatusKey, string> = {
  office: '#10b981',
  district: '#3b82f6',
  outside: '#f59e0b',
  stale: '#ef4444',
  noloc: '#94a3b8',
};

/**
 * Freshness (online/offline) is a *separate* axis from the geofence status
 * color above: an employee can be "online" (reporting) yet "outside", or
 * "offline" yet last-seen "in office". Fixes newer than this many minutes
 * count as online. See {@link isOnline}.
 */
export const ONLINE_THRESHOLD_MIN = 5;

/** Green (online) / grey (offline) dot color — the freshness indicator. */
export const ONLINE_COLOR = '#22c55e';
export const OFFLINE_COLOR = '#94a3b8';

/**
 * True when the employee's last location fix is within
 * {@link ONLINE_THRESHOLD_MIN} minutes of now. Prefers the server-supplied
 * `ageMinutes`; otherwise derives the age from `lastLocationAt`. No timestamp
 * at all ⇒ offline.
 */
export function isOnline(loc: LiveLocation): boolean {
  const age =
    loc.ageMinutes != null
      ? loc.ageMinutes
      : loc.lastLocationAt != null
        ? (Date.now() - new Date(loc.lastLocationAt).getTime()) / 60_000
        : null;
  return age != null && age <= ONLINE_THRESHOLD_MIN;
}

export const FILTER_ORDER: FilterKey[] = [
  'all',
  'office',
  'district',
  'outside',
  'stale',
  'noloc',
];

/** Bucket an employee, matching the exact priority used for the marker color. */
export function statusKey(loc: LiveLocation): StatusKey {
  if (!loc.hasLocation) return 'noloc';
  if (loc.isStale) return 'stale';
  if (loc.insideOffice) return 'office';
  if (loc.insideDistrict) return 'district';
  return 'outside';
}

export function statusColor(loc: LiveLocation): string {
  return STATUS_COLORS[statusKey(loc)];
}

/** Up to two initials from a full name. */
export function initials(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

/** Great-circle distance in metres between two [lat, lng] points. */
export function haversineM(a: [number, number], b: [number, number]): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type Labels = Record<string, string>;

export const LABELS: Record<Lang, Labels> = {
  uz: {
    title: 'Xodimlar joylashuvi',
    live: 'Jonli',
    total: 'Jami',
    reporting: 'Faol',
    inOffice: 'Ish hududida',
    stale: "Aloqa yo'q",
    search: 'Xodim qidirish...',
    noLoc: "Joylashuv yo'q",
    // online/offline freshness (separate from geofence status)
    online: 'Onlayn',
    offline: 'Oflayn',
    lastUpdate: 'Oxirgi yangilanish',
    message: 'Xabar yozish',
    office: 'Ish hududida',
    outDistrict: 'Tuman tashqarisida',
    inDistrict: 'Tuman ichida',
    lastSeen: 'Oxirgi aloqa',
    alerts: 'Ogohlantirishlar',
    mahallas: 'Mahallalar',
    minAgo: 'daq. oldin',
    hoursAgo: 'soat oldin',
    secAgo: 's oldin',
    never: 'hech qachon',
    empty: 'Hali hech kim joylashuv yubormagan',
    noneMatch: 'Filtrga mos xodim topilmadi',
    // Bo'sh holatdan ajratish uchun — yuklash xatosi (aloqa/server muammosi)
    loadError: "Joylashuvlarni yuklab bo'lmadi",
    retry: 'Qayta urinish',
    // filter chips
    fAll: 'Hammasi',
    fOffice: 'Ish hududida',
    fDistrict: 'Tumanda',
    fOutside: 'Tashqarida',
    fStale: "Aloqa yo'q",
    fNoloc: 'Joylashuvsiz',
    // auto-refresh
    updated: 'Yangilandi',
    // list toggle (mobile)
    list: "Ro'yxat",
    // mahalla filter chip
    mahallaChip: 'Mahalla',
    clear: 'Tozalash',
    // drawer
    position: 'Lavozim',
    curMahalla: 'Joriy mahalla',
    distance: 'Ofisgacha',
    accuracy: 'Aniqlik',
    inOfficeBadge: 'Ish hududida',
    inDistrictBadge: 'Tuman ichida',
    outsideBadge: 'Tashqarida',
    track: 'Marshrut',
    today: 'Bugun',
    lastHour: "So'nggi 1 soat",
    last3h: "So'nggi 3 soat",
    points: 'nuqta',
    noTrack: "Bu oraliqda marshrut ma'lumoti yo'q",
    loadingTrack: 'Marshrut yuklanmoqda...',
    close: 'Yopish',
    m: 'm',
    km: 'km',
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
    // online/offline freshness (separate from geofence status)
    online: 'В сети',
    offline: 'Не в сети',
    lastUpdate: 'Последнее обновление',
    message: 'Написать',
    office: 'В рабочей зоне',
    outDistrict: 'Вне района',
    inDistrict: 'В районе',
    lastSeen: 'Последняя связь',
    alerts: 'Оповещения',
    mahallas: 'Махалли',
    minAgo: 'мин назад',
    hoursAgo: 'ч назад',
    secAgo: 'с назад',
    never: 'никогда',
    empty: 'Пока никто не отправил локацию',
    noneMatch: 'Нет сотрудников по фильтру',
    // Отличить от пустого состояния — ошибка загрузки (связь/сервер)
    loadError: 'Не удалось загрузить локации',
    retry: 'Повторить',
    // filter chips
    fAll: 'Все',
    fOffice: 'В зоне',
    fDistrict: 'В районе',
    fOutside: 'Вне зоны',
    fStale: 'Нет связи',
    fNoloc: 'Без локации',
    // auto-refresh
    updated: 'Обновлено',
    // list toggle (mobile)
    list: 'Список',
    // mahalla filter chip
    mahallaChip: 'Махалля',
    clear: 'Сбросить',
    // drawer
    position: 'Должность',
    curMahalla: 'Текущая махалля',
    distance: 'До офиса',
    accuracy: 'Точность',
    inOfficeBadge: 'В рабочей зоне',
    inDistrictBadge: 'В районе',
    outsideBadge: 'Вне зоны',
    track: 'Маршрут',
    today: 'Сегодня',
    lastHour: 'Последний час',
    last3h: 'Последние 3 часа',
    points: 'точек',
    noTrack: 'Нет данных о маршруте за период',
    loadingTrack: 'Загрузка маршрута...',
    close: 'Закрыть',
    m: 'м',
    km: 'км',
  },
};

/**
 * Localized human-readable status for an employee — the non-color status cue
 * surfaced in the marker tooltip / aria-label so status isn't conveyed by
 * color alone. Mirrors {@link statusKey}.
 */
export function statusLabel(loc: LiveLocation, lang: Lang): string {
  const t = LABELS[lang];
  const byKey: Record<StatusKey, string> = {
    office: t.office,
    district: t.inDistrict,
    outside: t.outDistrict,
    stale: t.stale,
    noloc: t.noLoc,
  };
  return byKey[statusKey(loc)];
}

/** Relative "N ago" text for the given ISO timestamp. */
export function relTime(iso: string | null, t: Labels): string {
  if (!iso) return t.never;
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return t.live;
  if (mins < 60) return `${mins} ${t.minAgo}`;
  const h = Math.floor(mins / 60);
  return `${h} ${t.hoursAgo}`;
}

/** Short "N ago" for the auto-refresh pill (seconds → minutes). */
export function agoShort(fromMs: number, nowMs: number, t: Labels): string {
  const s = Math.max(0, Math.round((nowMs - fromMs) / 1000));
  if (s < 60) return `${s} ${t.secAgo}`;
  return `${Math.floor(s / 60)} ${t.minAgo}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `HH:mm` local time. */
export function clockTime(iso: string | null): string {
  if (!iso) return '--:--';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `DD.MM HH:mm` local absolute time (deterministic, locale-independent). */
export function absTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

/** Human distance: `540 m` / `1.2 km`. */
export function fmtDistance(m: number | null, t: Labels): string {
  if (m == null || !Number.isFinite(m)) return '—';
  if (m < 950) return `${Math.round(m)} ${t.m}`;
  return `${(m / 1000).toFixed(m < 9500 ? 1 : 0)} ${t.km}`;
}

/** from/to ISO range for a track window preset. */
export function trackRange(w: TrackWindow): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString();
  let from: Date;
  if (w === 'today') {
    from = new Date(now);
    from.setHours(0, 0, 0, 0);
  } else if (w === '1h') {
    from = new Date(now.getTime() - 3_600_000);
  } else {
    from = new Date(now.getTime() - 3 * 3_600_000);
  }
  return { from: from.toISOString(), to };
}
