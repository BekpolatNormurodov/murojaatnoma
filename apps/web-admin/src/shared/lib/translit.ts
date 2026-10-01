/**
 * Kirill ↔ lotin qidiruv moslashuvi. Xodimlar ismlari bazada KIRILL saqlanadi
 * (masalan "Исмоилов"), lekin admin lotincha ("Ismoilov") yozib qidirishi —
 * yoki aksincha — mumkin. Ikkala tomonni bitta KANONIK (soddalashtirilgan
 * lotin ASCII) shaklga keltirib solishtiramiz, shunda "Ismoilov" ↔ "Исмоилов",
 * "Ulug'bek" ↔ "Улуғбек" bir-birini topadi.
 *
 * Bu translit MUKAMMAL emas (faqat qidiruv uchun): apostroflar tashlanadi
 * (o'→o, g'→g), kirill harflar o'zbek lotin orfografiyasidagi eng yaqin
 * ASCII digraflarga o'giriladi. Substring mos kelishi uchun shu yetarli.
 */

/** O'zbek/rus kirill → soddalashtirilgan lotin (qidiruv kanoni uchun). */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'g', д: 'd', е: 'e', ё: 'yo',
  ж: 'j', з: 'z', и: 'i', й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm',
  н: 'n', о: 'o', ў: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'x', ҳ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ь: '', ы: 'i', э: 'e', ю: 'yu', я: 'ya',
};

/** Apostrof oilasidagi belgilar (o'/g' → o/g uchun tashlanadi). */
const APOSTROPHES = /['ʻʼ‘’`ʼ]/g;

/**
 * Matnni qidiruv uchun kanonik shaklga keltiradi: kichik harf → kirillni lotin
 * ASCII ga o'girish → apostroflarni tashlash. Kirill ham, lotin ham bir xil
 * natijaga keladi.
 */
export function foldSearch(text: string): string {
  if (!text) return '';
  const lower = text.toLowerCase().replace(APOSTROPHES, '');
  let out = '';
  for (const ch of lower) {
    out += ch in CYRILLIC_TO_LATIN ? CYRILLIC_TO_LATIN[ch] : ch;
  }
  return out;
}

/**
 * [needle] [haystack] ichida (kirill/lotin farqisiz) uchraydimi. Bo'sh needle
 * doim `true` (filtrsiz). Bir nechta maydonni tekshirish uchun
 * `matchesSearch(q, a, b, c)` ko'rinishida chaqiring.
 */
export function matchesSearch(needle: string, ...haystacks: Array<string | null | undefined>): boolean {
  const q = foldSearch(needle.trim());
  if (!q) return true;
  return haystacks.some((h) => (h ? foldSearch(h).includes(q) : false));
}
