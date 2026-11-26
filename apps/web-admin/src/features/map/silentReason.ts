/* Xodimdan joylashuv nega kelmayotganini telefonning o'z hisobotidan aniqlash. */

export interface DeviceStatus {
  gpsEnabled: boolean;
  permission: 'always' | 'whileInUse' | 'denied';
  batteryExempt: boolean;
  tracking: boolean;
  battery?: number;
  appVersion?: string;
  device?: string;
}

export interface SilentInput {
  lastLocationAt: string | null;
  deviceStatus?: DeviceStatus | null;
  deviceStatusAt?: string | null;
}

/** Fon xizmati har 30 soniyada, holatni kamida 5 daqiqada bir yuboradi. */
export const SILENT_AFTER_MIN = 10;

const TEXT = {
  uz: {
    neverApp: 'Ilovaga kirmagan yoki yangi ilova o‘rnatilmagan',
    oldApp: 'Yangi ilova o‘rnatilmagan — sabab ko‘rinmaydi',
    gps: 'GPS o‘chiq',
    denied: 'Joylashuvga ruxsat yo‘q',
    whileInUse: '«Doim» ruxsati berilmagan',
    battery: 'Batareya cheklovi yoqiq',
    stopped: 'Kuzatuv to‘xtagan',
    offline: 'Telefon o‘chiq, internet yo‘q yoki ilova to‘xtatilgan',
    low: (n: number) => `batareya ${n}%`,
  },
  ru: {
    neverApp: 'Не входил в приложение или не установил новую версию',
    oldApp: 'Новая версия не установлена — причина не видна',
    gps: 'GPS выключен',
    denied: 'Нет доступа к геолокации',
    whileInUse: 'Не разрешено «Всегда»',
    battery: 'Включено ограничение батареи',
    stopped: 'Отслеживание остановлено',
    offline: 'Телефон выключен, нет интернета или приложение остановлено',
    low: (n: number) => `батарея ${n}%`,
  },
};

const olderThan = (iso: string | null | undefined, now: Date, minutes: number) =>
  !iso || now.getTime() - new Date(iso).getTime() > minutes * 60_000;

/**
 * Diqqat talab qiladigan sabab; hammasi joyida bo'lsa `null`. Telefon hozir
 * aloqada bo'lsa sozlamadagi muammo, aloqada bo'lmasa oxirgi ma'lum sabab
 * aytiladi.
 */
export function silentReason(loc: SilentInput, lang: 'uz' | 'ru', now = new Date()): string | null {
  const t = TEXT[lang];
  const s = loc.deviceStatus;
  const quiet = olderThan(loc.lastLocationAt, now, SILENT_AFTER_MIN);
  if (!s) {
    if (!loc.lastLocationAt) return t.neverApp;
    return quiet ? t.oldApp : null;
  }
  const setting = !s.gpsEnabled
    ? t.gps
    : s.permission === 'denied'
      ? t.denied
      : s.permission === 'whileInUse'
        ? t.whileInUse
        : !s.batteryExempt
          ? t.battery
          : null;
  if (setting) return setting;
  if (olderThan(loc.deviceStatusAt, now, SILENT_AFTER_MIN)) {
    return s.battery != null && s.battery <= 15 ? `${t.offline} (${t.low(s.battery)})` : t.offline;
  }
  return !s.tracking && quiet ? t.stopped : null;
}
