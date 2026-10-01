import { isDigestTitle } from './media-analyzer';
import { normalizeText, stripHandles } from './media-text.util';

/**
 * Wider areas next to the district: Toshkent SHAHRI (the capital, our
 * district is one of its 12) and Toshkent VILOYATI (the region around it —
 * Chirchiq, Angren, Zangiota ...). Each item gets a 0..100 score for both, so
 * the page can switch Mirzo Ulug'bek ↔ Toshkent shahri ↔ Toshkent viloyati.
 *
 * "Toshkent" alone is the city — unless it is the region's name ("Toshkent
 * viloyati", "Toshkent tumani"), a dateline ("TOSHKENT, 1-oktabr") or the time
 * zone ("Toshkent vaqti bilan").
 */

export type MediaArea = 'district' | 'city' | 'region';
export const MEDIA_AREAS: readonly MediaArea[] = ['district', 'city', 'region'];

export interface AreaScore {
  city: number;
  region: number;
}

const L = '(?<!\\p{L})';
const re = (body: string) => new RegExp(`${L}(?:${body})`, 'u');
const reAll = (body: string) => new RegExp(`${L}(?:${body})`, 'gu');

/**
 * Region phrases that contain "Toshkent" — evidence for the region, removed
 * before the city check. "Toshkent tumani" (singular) is a district of the
 * region; "Toshkent tumanlari" (plural) are the capital's districts.
 */
const REGION_NAME = re(
  'toshkent viloyat|tashkent region|tashkent oblast|тошкент вилоят|ташкентск(?:ой|ая|ую) обл|' +
    'toshkent tumani|тошкент тумани|ташкентск(?:ий|ого|ом) район',
);
const REGION_NAME_ALL = reAll(
  'toshkent viloyat\\S*|tashkent region|tashkent oblast|тошкент вилоят\\S*|ташкентск(?:ой|ая|ую) обл\\S*|' +
    'toshkent tumani\\S*|тошкент тумани\\S*|ташкентск(?:ий|ого|ом) район\\S*',
);

/**
 * Towns and districts of the region. A street or bazaar named after one of
 * them is in the city ("Parkent bozori", "Qibray ko'chasi") — not counted.
 */
const REGION_PLACES =
  'chirchiq|angren|olmaliq|bekobod|ohangaron|oxangaron|yangiyol|parkent|piskent|bostonliq|zangiota|' +
  'qibray|chinoz|oqqorgon|chorvoq|amirsoy|' +
  // Nurafshon is also a girl's name — only the town.
  'nurafshon sha[hx]|нурафшон шах|г\\. ?нурафшан|нурафшан[еа]|' +
  'чирчик|ангрен|олмалик|алмалык|бекобод|бекабад|охангарон|ахангаран|янгийул|янгиюл|' +
  'паркент|пскент|пискент|бустонлик|бостанлык|бустанлык|зангиот|зангиат|кибрай|чиноз|чиназ|оккургон|аккурган|' +
  'чорвок|чарвак|амирсой|амирсай';
const NOT_A_TOWN = '(?!\\S*\\s+(?:bozor|kochas|kucha|massiv|daryo|рын|базар|улиц|кучас|масс|река|дарё))';
const REGION_PLACE = re(`(?:${REGION_PLACES})${NOT_A_TOWN}`);

/** "Toshkent shahri", "г. Ташкент", "столица Узбекистана" — surely the capital. */
const CITY_NAME = re(
  'toshkent sha[hx]|tashkent sha[hx]|тошкент шах|г\\. ?ташкент|город[ае]? ташкент|ташкентск(?:ий|ого|ому|ом) городск|' +
    'столиц[аеыу] узбекистан|tashkent city|toshkent shahar',
);
/** The other 11 districts of the capital (ours is scored separately). */
const CITY_DISTRICT = re(
  'yunusobod|chilonzor|yakkasaroy|mirobod|shayxontoxur|shayxontohur|olmazor|uchtepa|sergeli|bektemir|yashnobod|yangihayot|' +
    'юнусобод|юнусабад|чилонзор|чиланзар|яккасарой|яккасарай|миробод|мирабад|шайхонтохур|шайхантахур|шайхантаур|' +
    'олмазор|алмазар|учтепа|учтепин|сергели|бектемир|яшнобод|яшнабад|янгихает',
);
/** "Toshkentda", "poytaxtda", "в Ташкенте" — happening in the city. */
const CITY_IN = re(
  'toshkentda|toshkentdagi|toshkentga|toshkentlik|tashkentda|poytaxtda|poytaxtdagi|poytaxtimiz|poytaxt aholi|' +
    'poytaxt hokim|poytaxt kocha|poytaxt yol|тошкентда|тошкентдаги|тошкентга|тошкентлик|пойтахтда|пойтахтдаги|' +
    'пойтахтимиз|в ташкенте|ташкентц|in tashkent',
);
const CITY_BARE = re('toshkent|tashkent|тошкент|ташкент');

/** Not about the place: the time zone and agency datelines. */
const NOISE = reAll(
  '(?:toshkent|tashkent|тошкент) vaqt\\S*|(?:тошкент) вакт\\S*|(?:по )?ташкентск\\S* времен\\S*|по ташкенту|tashkent time',
);
const DATELINE = /^\s*(?:toshkent|tashkent|тошкент|ташкент)\s*,/u;

/**
 * The other regions, one entry each (spellings together). "Toshkent" next to
 * one of them is often a route or a comparison; a list of several is a
 * nation-wide round-up, not news about our area.
 */
const OTHER_REGIONS = [
  'samarqand|самарканд',
  'buxoro|бухар',
  'xorazm|хорезм',
  'andijon|андижан|андижон',
  'namangan|наманган',
  'fargona|фергана|фаргона',
  'qashqadaryo|кашкадар',
  'surxondaryo|сурхандар|сурхондар',
  'jizzax|джизак|жиззах',
  'sirdaryo|сырдар|сирдар',
  'qoraqalpog|каракалпак|коракалпог',
  // Not bare "Navoiy": that is mostly the poet.
  'navoiy viloyat|навоийск|навоий вилоят',
].map(re);
const otherRegions = (text: string) => OTHER_REGIONS.filter((r) => r.test(text)).length;

/** A phone number or "tel:" — job posts, shop and course ads carry an address. */
const AD_HINT = /\+?998\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|(?<!\d)\d{2}\s\d{3}\s\d{2}\s\d{2}(?!\d)|(?<!\p{L})(?:tel|тел)\.?\s?:/u;

function clean(text: string, dateline: boolean): string {
  const n = normalizeText(stripHandles(text));
  return (dateline ? n.replace(DATELINE, ' ') : n).replace(NOISE, ' ');
}

export function scoreArea(title: string, body: string): AreaScore {
  // "Toshkent, Samarqand va Buxoroda ..." as a headline is not a dateline.
  const t = ` ${clean(title, false)} `;
  const b = ` ${clean(body, true)} `;
  const ctx: Context = {
    titleElsewhere: otherRegions(t),
    elsewhere: otherRegions(`${t} ${b}`),
    ad: AD_HINT.test(b),
    // "Бугун 29-сентябр, сешанба:" — a dated list of the day's news.
    roundUp: isDigestTitle(title) || /^\P{L}*(?:bugun|бугун|сегодня)\s+\d{1,2}[\s-]/iu.test(title),
  };
  return { city: scoreCity(t, b, ctx), region: scoreRegion(t, b, ctx) };
}

interface Context {
  /** Other regions named in the title / anywhere. */
  titleElsewhere: number;
  elsewhere: number;
  /** Looks like an ad (phone number). */
  ad: boolean;
  /** "Kun dayjesti", "Главное за день" — the text is many stories. */
  roundUp: boolean;
}

/**
 * The headline is what an item is about; a mention deep in the text often is
 * a list, an address or a by-the-way. Title evidence scores high; text-only
 * evidence lower, and lower still in a nation-wide list or an ad.
 */
function finish(score: number, inTitle: boolean, c: Context): number {
  // Three or more other regions: a nation-wide list ("Toshkent shahri: ...,
  // Sirdaryo viloyati: ..., Jizzax viloyati: ...") — even when ours comes first.
  if (c.elsewhere >= 3) return Math.min(score, 40);
  if (inTitle) {
    // "Samarqand — Toshkent poyezdi", "Toshkent va Farg'onada ...".
    if (c.titleElsewhere) score -= 20;
  } else {
    if (c.roundUp) return 0;
    if (c.titleElsewhere) score -= 30;
    else if (c.elsewhere >= 2) score -= 25;
    else if (c.elsewhere === 1) score -= 10;
    if (c.ad) score -= 30;
  }
  return Math.max(0, Math.min(100, score));
}

function scoreRegion(t: string, b: string, c: Context): number {
  const all = `${t} ${b}`;
  const named = REGION_NAME.test(all);
  const place = REGION_PLACE.test(all);
  if (!named && !place) return 0;
  const inTitle = REGION_NAME.test(t) || REGION_PLACE.test(t);
  const both = named && place ? 5 : 0;
  if (inTitle) return finish((REGION_NAME.test(t) ? 90 : 80) + both, true, c);
  // Text only: "Olmaliq davlat texnika instituti vakillari ham ..." is not regional news.
  return finish((named ? 55 : 45) + both, false, c);
}

function scoreCity(t: string, b: string, c: Context): number {
  // The region's own name contains "Toshkent" — take it out first.
  const tc = t.replace(REGION_NAME_ALL, ' ');
  const bc = b.replace(REGION_NAME_ALL, ' ');
  // Strongest evidence first: [pattern, score in the title, score in the text only].
  const levels: [RegExp, number, number][] = [
    [CITY_NAME, 95, 70],
    [CITY_DISTRICT, 90, 65],
    [CITY_IN, 80, 45],
    [CITY_BARE, 65, 30],
  ];
  let best = 0;
  for (const [r, inTitle, inText] of levels) {
    if (r.test(tc)) best = Math.max(best, finish(inTitle, true, c));
    else if (r.test(bc)) best = Math.max(best, finish(inText, false, c));
  }
  return best;
}

/** Prisma column behind each area (district = the classic `relevance`). */
export const AREA_FIELD = { district: 'relevance', city: 'cityRelevance', region: 'regionRelevance' } as const;

/** Item's score for an area. */
export function areaRelevance(
  i: { relevance: number; cityRelevance: number; regionRelevance: number },
  area: MediaArea,
): number {
  return area === 'city' ? i.cityRelevance : area === 'region' ? i.regionRelevance : i.relevance;
}

/** How the digest and empty states name the area ("Toshkent shahri haqida ..."). */
export const AREA_NAME: Record<MediaArea, string> = {
  district: 'tuman',
  city: 'Toshkent shahri',
  region: 'Toshkent viloyati',
};
