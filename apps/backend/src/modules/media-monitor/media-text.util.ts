/**
 * Text helpers for the media monitor: one normalisation shared by keyword
 * matching, de-duplication and the offline (rule-based) scorer, so that
 * "Mirzo Ulugʻbek", "Mirzo Ulug'bek", "Mirzo Ulugbek", "Мирзо Улуғбек" and
 * "Мирзо-Улугбекский" all compare equal where they should.
 */

/** Every apostrophe look-alike used in Uzbek Latin (ʻ ʼ ‘ ’ ` ´ ′ ...). */
const APOSTROPHES = /['‘’ʻʼʹʿ`´′]/g;

/**
 * Lower-cases, drops apostrophes, folds Uzbek-Cyrillic letters onto their
 * Russian neighbours (ғ→г, қ→к, ў→у, ҳ→х, ё→е) and turns dashes/slashes and
 * runs of whitespace into a single space.
 */
export function normalizeText(input: string): string {
  return input
    .normalize('NFC')
    .toLowerCase()
    .replace(APOSTROPHES, '')
    .replace(/ғ/g, 'г')
    .replace(/қ/g, 'к')
    .replace(/ў/g, 'у')
    .replace(/ҳ/g, 'х')
    .replace(/ё/g, 'е')
    .replace(/[-‐‑–—_/|«»"“”„()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface KeywordMatch {
  /** Configured strong keywords found (the district itself). */
  strong: string[];
  /** Ambiguous keywords found (could be the astronomer, a street, the metro...). */
  weak: string[];
  /** Whether any match was in the title (weighs more). */
  inTitle: boolean;
}

/**
 * Finds configured keywords in `title` + `body`. Exclude phrases are cut out
 * first, so "Mirzo Ulug'bek nomidagi universitet" does not count as the
 * district while "Mirzo Ulug'bek tumanida" still does.
 */
export function matchKeywords(
  title: string,
  body: string,
  strong: readonly string[],
  weak: readonly string[],
  excludes: readonly string[],
): KeywordMatch {
  const strip = (s: string) => {
    let out = ` ${normalizeText(s)} `;
    for (const ex of excludes) {
      const n = normalizeText(ex);
      if (n) out = out.split(n).join(' ');
    }
    return out;
  };
  const t = strip(title);
  const all = `${t} ${strip(body)}`;
  const found = (list: readonly string[]) =>
    list.filter((k) => {
      const n = normalizeText(k);
      return n.length > 0 && all.includes(n);
    });
  const s = found(strong);
  const w = found(weak).filter((k) => !s.includes(k));
  const inTitle = [...s, ...w].some((k) => t.includes(normalizeText(k)));
  return { strong: s, weak: w, inTitle };
}

/** 0..100 relevance from keyword evidence (the AI pass may overwrite it). */
export function relevanceFromMatch(m: KeywordMatch, viaSearch: boolean): number {
  let score: number;
  if (m.strong.length > 0) score = 80;
  else if (m.weak.length > 0) score = 45;
  else score = viaSearch ? 35 : 0;
  if (m.inTitle) score += 10;
  if (m.strong.length > 1) score += 5;
  return Math.min(100, score);
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** HTML → plain text (keeps line breaks from <br>/<p>). */
export function htmlToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h\d)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cuts at a word boundary and adds an ellipsis. */
export function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).trimEnd()}…`;
}

/**
 * Story identity across outlets: the normalised title without the
 * " - Kun.uz" suffix Google News appends, letters/digits only, 90 chars.
 */
export function fingerprintOf(title: string): string {
  return normalizeText(title.replace(/\s+[-–—|]\s+[^-–—|]{2,40}$/, ''))
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .slice(0, 90);
}

/** "12.3K" / "1,2M" / "845" → number (Telegram view counters). */
export function parseCompactNumber(s: string | undefined | null): number | undefined {
  if (!s) return undefined;
  const m = /([\d.,]+)\s*([kmкм])?/i.exec(s.trim());
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(',', '.'));
  if (!Number.isFinite(n)) return undefined;
  const mul = m[2] ? (/[kк]/i.test(m[2]) ? 1_000 : 1_000_000) : 1;
  return Math.round(n * mul);
}

/** Safe Date from feed strings; future or garbage dates collapse to `fallback`. */
export function parseFeedDate(s: string | undefined | null, fallback: Date): Date {
  if (!s) return fallback;
  const d = new Date(s.trim());
  if (Number.isNaN(d.getTime())) return fallback;
  // Some feeds stamp items a few minutes ahead (clock skew) — clamp to now.
  return d.getTime() > fallback.getTime() + 60_000 ? fallback : d;
}
