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

/** Region phrases that contain "Toshkent" — evidence for the region, removed before the city check. */
const REGION_NAME = re(
  'toshkent viloyat|tashkent region|tashkent oblast|тошкент вилоят|ташкентск(?:ой|ая|ую) обл|' +
    'toshkent tuman|тошкент туман|ташкентск(?:ий|ого|ом) район',
);
const REGION_NAME_ALL = reAll(
  'toshkent viloyat\\S*|tashkent region|tashkent oblast|тошкент вилоят\\S*|ташкентск(?:ой|ая|ую) обл\\S*|' +
    'toshkent tuman\\S*|тошкент туман\\S*|ташкентск(?:ий|ого|ом) район\\S*',
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

/** Other regions — "Toshkent" next to them is often a route or a comparison. */
const OTHER_REGIONS = re(
  'samarqand|buxoro|xorazm|andijon|namangan|fargona|qashqadaryo|surxondaryo|jizzax|sirdaryo|qoraqalpog|navoiy viloyat|' +
    'самарканд|бухар|хорезм|андижан|андижон|наманган|фергана|фаргона|кашкадар|сурхандар|сурхондар|джизак|жиззах|' +
    // Not bare "Navoiy": that is mostly the poet.
    'сырдар|сирдар|каракалпак|коракалпог|навоийск|навоий вилоят',
);

function clean(text: string, dateline: boolean): string {
  const n = normalizeText(stripHandles(text));
  return (dateline ? n.replace(DATELINE, ' ') : n).replace(NOISE, ' ');
}

export function scoreArea(title: string, body: string): AreaScore {
  // "Toshkent, Samarqand va Buxoroda ..." as a headline is not a dateline.
  const t = ` ${clean(title, false)} `;
  const b = ` ${clean(body, true)} `;
  return { city: scoreCity(t, b), region: scoreRegion(t, b) };
}

function scoreRegion(t: string, b: string): number {
  const all = `${t} ${b}`;
  const named = REGION_NAME.test(all);
  const place = REGION_PLACE.test(all);
  if (!named && !place) return 0;
  let score = named ? 85 : 70;
  if (REGION_NAME.test(t) || REGION_PLACE.test(t)) score += 10;
  if (named && place) score += 5;
  return Math.min(100, score);
}

function scoreCity(t: string, b: string): number {
  // The region's own name contains "Toshkent" — take it out first.
  const tc = t.replace(REGION_NAME_ALL, ' ');
  const bc = b.replace(REGION_NAME_ALL, ' ');
  const all = `${tc} ${bc}`;
  const inTitle = (r: RegExp) => r.test(tc);
  if (CITY_NAME.test(all)) return Math.min(100, 85 + (inTitle(CITY_NAME) ? 10 : 0));
  if (CITY_DISTRICT.test(all)) return Math.min(100, 75 + (inTitle(CITY_DISTRICT) ? 10 : 0));
  // Weaker evidence: a route or a comparison with another region says little.
  const elsewhere = OTHER_REGIONS.test(all) ? 15 : 0;
  if (CITY_IN.test(all)) return 60 + (inTitle(CITY_IN) ? 10 : 0) - elsewhere;
  if (CITY_BARE.test(all)) return (inTitle(CITY_BARE) ? 50 : 35) - elsewhere;
  return 0;
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
