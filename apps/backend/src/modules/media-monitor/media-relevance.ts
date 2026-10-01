import { matchKeywords, normalizeText, stripHandles } from './media-text.util';

/**
 * Relevance rules v2 — how sure we are that a text is about Mirzo Ulug'bek
 * TUMANI (0..100). Evidence, strongest first:
 *  1. a strong keyword ("Mirzo Ulug'bek tumani", "Мирзо-Улугбекский район");
 *  2. one of the district's 70 mahallas or a known district place (TTZ,
 *     Qorasuv ...) — unless the text is plainly about another district/region;
 *  3. the bare name "Mirzo Ulug'bek" — upgraded by district context
 *     (tuman, mahalla, hokim, ko'cha, Toshkent), dropped in astronomer /
 *     university / metro context;
 *  4. a platform search hit with nothing above (Google, YouTube search).
 */

export interface PlaceGazetteer {
  /** Normalised mahalla stems ("shahriobod", "шахриобод") — matched before "mahalla"/"махалл". */
  mahallas: string[];
  /** Normalised district places matched on their own ("ttz", "qorasuv"). */
  places: string[];
}

export interface RelevanceInput {
  title: string;
  body: string;
  keywords: readonly string[];
  weakKeywords: readonly string[];
  excludes: readonly string[];
  gazetteer: PlaceGazetteer;
  viaSearch?: boolean;
}

export interface RelevanceResult {
  relevance: number;
  /** What matched — shown on the card and used by the UI highlighter. */
  keywords: string[];
  /** Why (debug / tooltip): strong | place | weak+context | search | none. */
  reason: 'strong' | 'place' | 'weak' | 'search' | 'none';
}

/** Other Tashkent districts and the regions — text about them is not about us. */
const ELSEWHERE = [
  'yunusobod', 'chilonzor', 'yakkasaroy', 'mirobod', 'shayxontoxur', 'shayxontohur', 'olmazor', 'uchtepa',
  'sergeli', 'bektemir', 'yashnobod', 'yangihayot', 'юнусобод', 'юнусабад', 'чилонзор', 'чиланзар',
  'яккасарой', 'яккасарай', 'миробод', 'мирабад', 'шайхонтохур', 'шайхантахур', 'олмазор', 'алмазар',
  'учтепа', 'сергели', 'бектемир', 'яшнобод', 'яшнабад', 'янгихаёт',
  'samarqand', 'buxoro', 'xorazm', 'andijon', 'namangan', 'fargona', 'qashqadaryo', 'surxondaryo',
  'jizzax', 'sirdaryo', 'qoraqalpogiston', 'toshkent viloyat', 'navoiy viloyat',
  'самарканд', 'самарканд', 'бухар', 'хорезм', 'андижан', 'андижон', 'наманган', 'фергана', 'фаргона',
  'кашкадар', 'кашкадарё', 'сурхандар', 'сурхондарё', 'джизак', 'жиззах', 'сырдар', 'сирдарё',
  'каракалпак', 'коракалпогистон', 'ташкентской област', 'тошкент вилоят', 'навоийской област',
];

/** Context that makes a bare "Mirzo Ulug'bek" the district. */
const DISTRICT_CONTEXT = [
  'tuman', 'mahalla', 'hokim', 'kochasi', 'massiv', 'район', 'туман', 'махалл', 'хоким', 'кучаси', 'улиц',
  'массив', 'district',
];
/** Only says "in the city" — weaker than district context. */
const CITY_CONTEXT = ['toshkent', 'ташкент', 'тошкент', 'tashkent'];

/** Context of the astronomer / the university / the metro station — not the district. */
const NOT_DISTRICT_CONTEXT = [
  'astronom', 'rasadxona', 'temuriy', 'madrasa', 'olim ', 'olimning', 'yulduz', 'zij', 'nomidagi', 'universitet',
  'metro bekat', 'amir temur', 'астроном', 'обсерватор', 'темурид', 'медресе', 'учен', 'имени', 'университет',
  'станци', 'амир темур', '1394', '1449',
];

const has = (text: string, stems: readonly string[]) => stems.some((s) => text.includes(s));

const PLACE_RE = new Map<string, RegExp>();
/** A place word with Uzbek / Russian case endings: "Qorasuvda", "TTZdagi", "Карасу,". */
function placeRe(p: string): RegExp {
  let re = PLACE_RE.get(p);
  if (!re) {
    const esc = p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    re = new RegExp(` ${esc}(da|dagi|ga|dan|ning|ni|lik|liklar|даги|да|га|дан|нинг|ни|е|а|ом)?[ ,.!?:;)]`);
    PLACE_RE.set(p, re);
  }
  return re;
}

/** Mahalla names of the zones table → gazetteer stems ("Shahriobod mahallasi" → "shahriobod"). */
export function buildGazetteer(
  zones: { nameUzLat: string; nameUzCyr?: string | null; nameRu?: string | null }[],
  places: readonly string[],
): PlaceGazetteer {
  const strip = (s: string) =>
    normalizeText(s)
      .replace(/\b(mahallasi|mahalla)\b/g, '')
      .replace(/(махалласи|махалля|махалла)/g, '')
      .trim();
  const mahallas = new Set<string>();
  for (const z of zones) {
    for (const n of [z.nameUzLat, z.nameUzCyr, z.nameRu]) {
      const s = n ? strip(n) : '';
      // Three-letter names ("Nur", "Bo'z") collide with ordinary words — skip them.
      if (s.length >= 4) mahallas.add(s);
    }
  }
  return { mahallas: [...mahallas], places: places.map((p) => normalizeText(p)).filter((p) => p.length >= 3) };
}

export function scoreRelevance(input: RelevanceInput): RelevanceResult {
  const m = matchKeywords(input.title, input.body, input.keywords, input.weakKeywords, input.excludes);
  const t = ` ${normalizeText(stripHandles(input.title))} `;
  const all = ` ${t} ${normalizeText(stripHandles(input.body))} `;

  // 1. strong keyword
  if (m.strong.length) {
    let score = 80;
    if (m.inTitle) score += 10;
    if (m.strong.length > 1) score += 5;
    return { relevance: Math.min(100, score), keywords: [...m.strong, ...m.weak], reason: 'strong' };
  }

  // 2. a district mahalla / place, not drowned out by another district or region
  const placeHits = [
    ...input.gazetteer.mahallas.filter((n) => all.includes(` ${n} mahalla`) || all.includes(` ${n} махалл`)),
    ...input.gazetteer.places.filter((p) => placeRe(p).test(all)),
  ];
  const elsewhere = has(all, ELSEWHERE);
  if (placeHits.length && (!elsewhere || m.weak.length)) {
    // Mahalla names repeat across Tashkent's 12 districts: a bare mahalla is
    // "likely ours" (50 with Toshkent, else hidden 45); with the name, sure.
    let score = 45;
    if (has(all, CITY_CONTEXT)) score += 5;
    if (placeHits.some((p) => t.includes(p))) score += 5;
    if (placeHits.length > 1) score += 5;
    if (m.weak.length) score += 15;
    return { relevance: Math.min(100, score), keywords: [...m.weak, ...placeHits.slice(0, 3)], reason: 'place' };
  }

  // 3. bare name — context decides
  if (m.weak.length) {
    const districtCtx = has(all, DISTRICT_CONTEXT);
    const cityCtx = has(all, CITY_CONTEXT);
    const notDistrictCtx = has(all, NOT_DISTRICT_CONTEXT);
    if (notDistrictCtx && !districtCtx) return { relevance: 0, keywords: [], reason: 'none' };
    // Another region + astronomer context: Samarqand's Ulug'bek, not our tuman.
    if (notDistrictCtx && elsewhere && !cityCtx) return { relevance: 0, keywords: [], reason: 'none' };
    let score = districtCtx ? 60 : cityCtx ? 50 : 40;
    if (m.inTitle) score += 10;
    // Samarqand / Buxoro ... have a "Mirzo Ulug'bek ko'chasi" too: without Toshkent it is not ours.
    if (elsewhere && !cityCtx) score -= 25;
    else if (elsewhere && !districtCtx) score -= 15;
    return { relevance: Math.max(0, Math.min(100, score)), keywords: m.weak, reason: 'weak' };
  }

  // 4. the platform searched for us, but the snippet is too short to show it
  if (input.viaSearch) return { relevance: 35, keywords: [], reason: 'search' };
  return { relevance: 0, keywords: [], reason: 'none' };
}
