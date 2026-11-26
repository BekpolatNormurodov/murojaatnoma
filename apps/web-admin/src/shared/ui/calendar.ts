/* Kalendar va drop-down uchun toza funksiyalar. Kun — "yyyy-mm-dd". */

const pad = (n: number) => String(n).padStart(2, '0');

export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "yyyy-mm-dd" → mahalliy sana; noto'g'ri yoki mavjud bo'lmagan kun — null. */
export function fromDay(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return toDay(d) === v ? d : null;
}

/** `min` / `max` (ikkalasi ham kiradi) ichidami. "yyyy-mm" uchun ham ishlaydi. */
export const isAllowed = (v: string, min?: string, max?: string) => (!min || v >= min) && (!max || v <= max);

export const clampDay = (v: string, min?: string, max?: string) =>
  min && v < min ? min : max && v > max ? max : v;

/** Oy katakchalari: dushanbadan boshlab doim 6 hafta, balandlik o'zgarmaydi. */
export function monthGrid(year: number, month: number): { day: string; inMonth: boolean }[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(year, month, 1 - lead + i);
    return { day: toDay(d), inMonth: d.getMonth() === new Date(year, month, 1).getMonth() };
  });
}

/** Klaviatura tugmasi bosilganda kursor qaysi kunga o'tadi; boshqa tugma — null. */
export function moveDay(day: string, key: string): string | null {
  const d = fromDay(day);
  if (!d) return null;
  const y = d.getFullYear();
  const m = d.getMonth();
  const n = d.getDate();
  const weekday = (d.getDay() + 6) % 7;
  const shift: Record<string, number> = {
    ArrowLeft: -1,
    ArrowRight: 1,
    ArrowUp: -7,
    ArrowDown: 7,
    Home: -weekday,
    End: 6 - weekday,
  };
  if (key in shift) return toDay(new Date(y, m, n + shift[key]));
  if (key === 'PageUp' || key === 'PageDown') {
    const target = m + (key === 'PageUp' ? -1 : 1);
    // 31-yanvar → 28-fevral (3-martga sakramaydi).
    return toDay(new Date(y, target, Math.min(n, new Date(y, target + 1, 0).getDate())));
  }
  return null;
}

/**
 * Drop-down'ning ekrandagi o'rni (`position: fixed`): tugma ostida chap chetdan;
 * pastda joy yetmasa tepada; o'ngda yetmasa o'ng chetga tekislanadi; hech qachon
 * ekrandan chiqmaydi.
 */
export function placePopover(
  anchor: { top: number; bottom: number; left: number; right: number },
  size: { width: number; height: number },
  screen: { width: number; height: number },
  gap = 8,
): { top: number; left: number; above: boolean } {
  const below = screen.height - anchor.bottom - gap;
  const over = anchor.top - gap;
  const above = size.height + gap > below && over > below;
  const wanted = above ? anchor.top - gap - size.height : anchor.bottom + gap;
  const preferred = anchor.left + size.width <= screen.width - gap ? anchor.left : anchor.right - size.width;
  return {
    above,
    top: Math.max(gap, Math.min(wanted, screen.height - gap - size.height)),
    left: Math.max(gap, Math.min(preferred, screen.width - gap - size.width)),
  };
}
