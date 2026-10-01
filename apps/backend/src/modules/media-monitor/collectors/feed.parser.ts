import { decodeEntities, htmlToText } from '../media-text.util';

/** One RSS <item> or Atom <entry>, fields as plain strings. */
export interface FeedEntry {
  id: string;
  title: string;
  link: string;
  /** Plain text (HTML stripped). */
  description: string;
  published?: string;
  imageUrl?: string;
  author?: string;
  /** Google News: the original outlet ("Kun.uz"). */
  sourceName?: string;
  /** YouTube: media:statistics views. */
  views?: number;
  /** YouTube: yt:videoId. */
  videoId?: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\:]/g, '\\$&');

function unwrap(s: string): string {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

/** Inner text of the first `<name ...>...</name>` in `block`. */
function tag(block: string, name: string): string | undefined {
  const m = new RegExp(`<${esc(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${esc(name)}>`, 'i').exec(block);
  return m ? unwrap(m[1]) : undefined;
}

/** Attribute of the first `<name ...>` whose attributes satisfy `where`. */
function attr(block: string, name: string, attribute: string, where?: (attrs: string) => boolean): string | undefined {
  const re = new RegExp(`<${esc(name)}\\s([^>]*?)\\/?>`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) {
    const attrs = m[1];
    if (where && !where(attrs)) continue;
    const v = new RegExp(`(?:^|\\s)${esc(attribute)}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i').exec(attrs);
    if (v) return decodeEntities(v[2] ?? v[3] ?? '');
  }
  return undefined;
}

const isImage = (attrs: string) =>
  /medium\s*=\s*["']image/i.test(attrs) ||
  /type\s*=\s*["']image\//i.test(attrs) ||
  /url\s*=\s*["'][^"']+\.(jpe?g|png|webp|gif)(\?[^"']*)?["']/i.test(attrs);

/**
 * Tolerant RSS 2.0 / Atom parser (regex-based: the feeds we read are
 * machine-generated and well-formed, and this keeps the backend free of an
 * XML dependency). Unknown shapes just yield fewer fields, never a throw.
 */
export function parseFeed(xml: string): FeedEntry[] {
  const out: FeedEntry[] = [];
  const blockRe = /<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml))) {
    const b = m[2];
    const rawTitle = tag(b, 'title') ?? tag(b, 'media:title') ?? '';
    const title = htmlToText(rawTitle);
    const link =
      (tag(b, 'link') && !/^\s*$/.test(tag(b, 'link')!) ? decodeEntities(tag(b, 'link')!) : undefined) ??
      attr(b, 'link', 'href', (a) => !/rel\s*=\s*["'](?!alternate)/i.test(a)) ??
      '';
    const rawDesc =
      tag(b, 'description') ??
      tag(b, 'content:encoded') ??
      tag(b, 'media:description') ??
      tag(b, 'summary') ??
      tag(b, 'content') ??
      '';
    const imgInDesc = /<img[^>]+src=["']([^"']+)["']/i.exec(decodeEntities(rawDesc))?.[1];
    const imageUrl =
      attr(b, 'media:thumbnail', 'url') ??
      attr(b, 'media:content', 'url', isImage) ??
      attr(b, 'enclosure', 'url', isImage) ??
      imgInDesc;
    const views = attr(b, 'media:statistics', 'views');
    const authorBlock = tag(b, 'author');
    const author =
      tag(b, 'dc:creator') ?? (authorBlock ? (tag(authorBlock, 'name') ?? authorBlock) : undefined);
    const videoId = tag(b, 'yt:videoId');
    const id = tag(b, 'guid') ?? tag(b, 'id') ?? link;
    if (!title || !(link || id)) continue;
    out.push({
      id: decodeEntities(id || link).trim(),
      title,
      link: link.trim(),
      description: htmlToText(rawDesc),
      published: tag(b, 'pubDate') ?? tag(b, 'published') ?? tag(b, 'dc:date') ?? tag(b, 'updated'),
      imageUrl: imageUrl?.trim() || undefined,
      author: author ? htmlToText(author) : undefined,
      sourceName: tag(b, 'source') ? htmlToText(tag(b, 'source')!) : undefined,
      views: views ? parseInt(views, 10) || undefined : undefined,
      videoId,
    });
  }
  return out;
}
