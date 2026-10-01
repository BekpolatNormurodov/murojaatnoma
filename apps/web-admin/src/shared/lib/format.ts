/**
 * "5000000" -> "5 000 000". Deterministic, locale-free: `Intl` with "uz-UZ"
 * silently falls back to English ("5,000,000") in browsers whose ICU lacks the
 * uz locale, so the same amount rendered differently across pages/devices.
 */
function groupThousands(value: number): string {
  const sign = value < 0 ? "-" : "";
  const [int, frac] = Math.abs(value).toString().split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return sign + grouped + (frac ? `,${frac}` : "");
}

/** Pul birligini formatlash (so'm): "5 000 000 so'm". */
export function formatSom(value: number): string {
  return `${groupThousands(Math.round(value))} so'm`;
}

/** Katta summalarni qisqartirish: 1.2 mlrd / 850 mln / 12 ming so'm */
export function formatSomShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000)
    return `${(value / 1_000_000_000).toFixed(1)} mlrd so'm`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mln so'm`;
  if (abs >= 1_000) return `${Math.round(value / 1_000)} ming so'm`;
  return `${value} so'm`;
}

/** Faqat qisqa son (birliksiz): 1.2 mlrd / 850 mln */
export function formatShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} mlrd`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} mln`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)} ming`;
  return `${value}`;
}

// Intl uz-UZ oy nomlari ba'zi muhitlarda "M06" ko'rinishida buziladi,
// shuning uchun qisqa oy nomlarini qo'lda beramiz.
const UZ_MONTHS_SHORT = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

/** Sana: 12 Iyn 2026 */
export function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${UZ_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** Nisbiy vaqt: "3 kun oldin" */
export function timeAgo(iso: string): string {
  const at = new Date(iso).getTime();
  if (!iso || Number.isNaN(at)) return "—";
  const diff = Date.now() - at;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hozirgina";
  if (mins < 60) return `${mins} daqiqa oldin`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} soat oldin`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} kun oldin`;
  const months = Math.floor(days / 30);
  return `${months} oy oldin`;
}

/** Qisqa son: 1 200 -> 1.2k, 1 500 000 -> 1.5M */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

/** Oddiy son (ming ajratuvchi bilan). */
export function formatNumber(value: number): string {
  return groupThousands(value);
}

/** Foiz ko'rsatkichi: +12.4% */
export function formatDelta(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}
