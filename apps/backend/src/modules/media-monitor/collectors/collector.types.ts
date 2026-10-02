export type MediaPlatform = 'web' | 'telegram' | 'youtube' | 'instagram';

/** One post/article as a collector found it, before keyword matching. */
export interface RawMediaItem {
  source: string;
  sourceName: string;
  platform: MediaPlatform;
  externalId: string;
  url: string;
  title: string;
  /** Plain text body/description (no HTML). */
  text: string;
  imageUrl?: string;
  author?: string;
  views?: number;
  publishedAt: Date;
  /**
   * True when the platform itself already searched for our query (Google
   * News, YouTube search, Instagram hashtag) — the text we get may be too short
   * to contain the keyword, so a non-match still counts a little.
   */
  viaSearch?: boolean;
  /** Published by a state body (gov.uz agency, President's press office, UzA, parliament, hokimlik). */
  official?: boolean;
  /** The district's own channel — relevant without a keyword match. */
  alwaysRelevant?: boolean;
  /** A district-local media channel (e.g. @mirzo_ulugbek): shown even without a keyword. */
  localChannel?: boolean;
  /** Found by a history search (Telegram ?q=, YouTube search) — may be older than a feed item. */
  backfill?: boolean;
}

/** One collector run's outcome, shown on the "Manbalar" panel. */
export interface SourceRunResult {
  key: string;
  name: string;
  platform: MediaPlatform;
  items: RawMediaItem[];
  error?: string;
  /** Collector skipped on purpose (missing token, rate window not reached). */
  skipped?: string;
}

/** fetch() with a hard timeout and a browser-like UA (some outlets 403 bots). */
export async function fetchText(url: string, timeoutMs = 15_000, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 MurojaatnomaMonitor/1.0',
      Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.9, */*;q=0.8',
      'Accept-Language': 'uz,ru;q=0.9,en;q=0.6',
      ...headers,
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** An API error with the provider's code (Graph API: 190 = token expired, 4/17/32/613/80002 = rate limit). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: number,
    readonly subcode?: number,
  ) {
    super(message);
  }
}

export async function fetchJson<T>(url: string, timeoutMs = 15_000): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  const body = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok || body?.error) {
    const e = body?.error;
    throw new ApiError(e?.message ?? `HTTP ${res.status}`, e?.code, e?.error_subcode);
  }
  return body;
}

export function errorText(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') return 'Javob kelmadi (timeout)';
    return err.message.slice(0, 300);
  }
  return String(err).slice(0, 300);
}
