import { decodeEntities, htmlToText, parseFeedDate } from '../media-text.util';
import { RawMediaItem } from './collector.types';

/** One agency page on the Government portal (gov.uz/oz/<slug>). */
export interface GovAuthority {
  /** gov.uz path segment: "mirzoulugbek" → https://gov.uz/oz/mirzoulugbek */
  slug: string;
  name: string;
  /** The district's own hokimligi: every post is about the district (no keyword needed). */
  own: boolean;
}

interface GovUzNews {
  id?: number;
  date?: string;
  title?: string;
  anons?: string;
  views?: number;
  anons_image?: string;
}

/**
 * gov.uz is a Next.js (app router) site without RSS; the news list is
 * server-rendered into `self.__next_f.push([1,"…"])` React-Server-Component
 * chunks. Decode those string literals, find `"authority":"<slug>","data":{"data":[…]}`
 * and read the array. Dates are local Tashkent time ("2026-09-22 17:20:00").
 */
export function parseGovUzNews(html: string, authority: GovAuthority, now = new Date()): RawMediaItem[] {
  const chunks: string[] = [];
  const re = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      chunks.push(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      /* skip a malformed chunk */
    }
  }
  const blob = chunks.join('');
  const marker = `"authority":"${authority.slug}","data":`;
  const at = blob.indexOf(marker);
  if (at < 0) return [];
  const start = blob.indexOf('[', at + marker.length);
  const list = sliceBalanced(blob, start);
  if (!list) return [];
  let rows: GovUzNews[];
  try {
    rows = JSON.parse(list) as GovUzNews[];
  } catch {
    return [];
  }
  const out: RawMediaItem[] = [];
  for (const r of rows) {
    if (!r?.id || !r.title) continue;
    const local = r.date ? `${r.date.replace(' ', 'T')}+05:00` : undefined;
    out.push({
      source: `gov:${authority.slug}`,
      sourceName: authority.name,
      platform: 'web',
      externalId: String(r.id),
      url: `https://gov.uz/oz/${authority.slug}/news/view/${r.id}`,
      title: decodeEntities(r.title).trim(),
      text: r.anons ? htmlToText(r.anons) : '',
      imageUrl: r.anons_image || undefined,
      author: authority.name,
      views: typeof r.views === 'number' ? r.views : undefined,
      publishedAt: parseFeedDate(local, now),
      official: true,
      alwaysRelevant: authority.own,
    });
  }
  return out;
}

/** The JSON array starting at `start` ("[ … ]"), honouring strings and nesting. */
function sliceBalanced(s: string, start: number): string | null {
  if (start < 0 || s[start] !== '[') return null;
  let depth = 0;
  let inStr = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
