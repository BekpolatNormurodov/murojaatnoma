import { Buildings2, EmojiHappy, EmojiNormal, EmojiSad, Location, Map1, type Icon } from 'iconsax-react';
import type { MediaArea, MediaItem, MediaPlatform, MediaSentiment } from './api';
import { InstagramIcon, TelegramIcon, WebIcon, YoutubeIcon } from './MediaIcons';

interface PlatformMeta {
  label: string;
  /** Brand colour — icon tint and chart colour. */
  color: string;
  /** Soft tile background (light + dark). */
  tile: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
}

export const PLATFORM_META: Record<MediaPlatform, PlatformMeta> = {
  web: { label: 'Saytlar', color: '#2563eb', tile: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300', Icon: WebIcon },
  telegram: { label: 'Telegram', color: '#229ED9', tile: 'bg-sky-50 text-[#229ED9] dark:bg-sky-500/15', Icon: TelegramIcon },
  youtube: { label: 'YouTube', color: '#FF0033', tile: 'bg-red-50 text-[#FF0033] dark:bg-red-500/15', Icon: YoutubeIcon },
  instagram: { label: 'Instagram', color: '#E1306C', tile: 'bg-pink-50 text-[#E1306C] dark:bg-pink-500/15', Icon: InstagramIcon },
};

export const PLATFORMS: MediaPlatform[] = ['web', 'telegram', 'youtube', 'instagram'];

export const SENTIMENT_META: Record<
  MediaSentiment,
  { label: string; color: string; pill: string; Icon: Icon }
> = {
  negative: {
    label: 'Salbiy',
    color: '#ef4444',
    pill: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30',
    Icon: EmojiSad,
  },
  neutral: {
    label: 'Neytral',
    color: '#94a3b8',
    pill: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30',
    Icon: EmojiNormal,
  },
  positive: {
    label: 'Ijobiy',
    color: '#10b981',
    pill: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    Icon: EmojiHappy,
  },
};

export const SENTIMENTS: MediaSentiment[] = ['negative', 'neutral', 'positive'];

/** Outlets whose display name has no domain in it. */
const KNOWN_DOMAINS: Record<string, string> = {
  daryo: 'daryo.uz',
  'daryo (ru)': 'daryo.uz',
  uza: 'uza.uz',
  'uza (ru)': 'uza.uz',
  uznews: 'uznews.uz',
  'gazeta.uz (ru)': 'gazeta.uz',
};

/** Best-effort outlet domain for the favicon (Google News links point at news.google.com). */
export function outletDomain(item: Pick<MediaItem, 'url' | 'sourceName' | 'platform'>): string | null {
  if (item.platform !== 'web') return null;
  const name = item.sourceName.trim().toLowerCase();
  if (KNOWN_DOMAINS[name]) return KNOWN_DOMAINS[name];
  try {
    const host = new URL(item.url).hostname.replace(/^www\./, '');
    if (host && host !== 'news.google.com') return host;
  } catch {
    /* fall through */
  }
  const m = /([a-z0-9-]+\.(uz|ru|com|org|net|info|io|news))\b/i.exec(name);
  return m ? m[1].toLowerCase() : null;
}

const pad = (n: number) => String(n).padStart(2, '0');
const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

/** "14:05" today, "kecha 14:05", otherwise "29-sen 14:05". */
export function shortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, now)) return hm;
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (sameDay(d, y)) return `kecha ${hm}`;
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]} ${hm}`;
}

const UZ_MONTHS_FULL = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const UZ_WEEKDAYS = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];

/** "14:05" */
export function clock(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar day, for grouping the feed. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Bugun" / "Kecha" / "29-sentabr, seshanba" (+ year when not this year). */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, now)) return 'Bugun';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (same(d, y)) return 'Kecha';
  const year = d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : '';
  return `${d.getDate()}-${UZ_MONTHS_FULL[d.getMonth()]}${year}, ${UZ_WEEKDAYS[d.getDay()]}`;
}

/** "Bugun" / "Kecha" / "29-sentabr" — compact day for a card's time line. */
export function dayShort(iso: string, now = new Date()): string {
  const full = dayLabel(iso, now);
  return full.split(',')[0];
}

/** "hozirgina" / "12 daqiqa oldin" / "3 soat oldin" — only for the last 24 h, else null. */
export function freshAgo(iso: string, now = Date.now()): string | null {
  const diff = now - new Date(iso).getTime();
  if (!(diff >= 0) || diff > 24 * 3_600_000) return null;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'hozirgina';
  if (mins < 60) return `${mins} daqiqa oldin`;
  return `${Math.floor(mins / 60)} soat oldin`;
}

export function fullTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()}-${UZ_MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function aiModelLabel(model: string | null | undefined): string {
  if (!model || model === 'rules') return 'Avtomatik tahlil';
  if (model.includes('opus')) return 'Claude Opus';
  if (model.includes('sonnet')) return 'Claude Sonnet';
  if (model.includes('haiku')) return 'Claude Haiku';
  return model;
}

/** The three area filters (hero switch, feed header, empty state). */
export const AREAS: MediaArea[] = ['district', 'city', 'region'];
export const AREA_META: Record<
  MediaArea,
  { label: string; short: string; about: string; empty: string; lowHint: string; Icon: Icon }
> = {
  district: {
    label: "Mirzo Ulug'bek tumani",
    short: "Mirzo Ulug'bek",
    about: "Mirzo Ulug'bek tumani haqida",
    empty: "Bu davrda tuman haqida xabar yo'q",
    lowHint:
      "Tumanga tegishliligi aniq bo'lmagan xabarlarni ham ko'rsatish (masalan, faqat «Mirzo Ulug'bek» deb yozilgan — olim, ko'cha yoki metro bo'lishi mumkin)",
    Icon: Location,
  },
  city: {
    label: 'Toshkent shahri',
    short: 'Toshkent shahri',
    about: 'Toshkent shahri haqida',
    empty: "Bu davrda Toshkent shahri haqida xabar yo'q",
    lowHint: "«Toshkent» so'zi faqat o'tib ketgan xabarlarni ham ko'rsatish (masalan, poyezd yo'nalishi yoki taqqoslash)",
    Icon: Buildings2,
  },
  region: {
    label: 'Toshkent viloyati',
    short: 'Toshkent viloyati',
    about: 'Toshkent viloyati haqida',
    empty: "Bu davrda Toshkent viloyati haqida xabar yo'q",
    lowHint: "Viloyatga tegishliligi aniq bo'lmagan xabarlarni ham ko'rsatish",
    Icon: Map1,
  },
};
