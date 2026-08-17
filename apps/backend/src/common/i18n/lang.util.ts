import type { Request } from 'express';

/** Languages the API can localize responses into. Uzbek is the app default. */
export type SupportedLang = 'uz' | 'ru';

export const DEFAULT_LANG: SupportedLang = 'uz';

/** Normalizes a raw header value/tag (e.g. `ru-RU`, `UZ`, `ru;q=0.9`) to a `SupportedLang`. */
function normalizeLang(value: string | undefined | null): SupportedLang | undefined {
  if (!value) {
    return undefined;
  }
  const tag = value.trim().toLowerCase();
  if (tag.startsWith('ru')) {
    return 'ru';
  }
  if (tag.startsWith('uz')) {
    return 'uz';
  }
  return undefined;
}

function firstHeaderValue(header: string | string[] | undefined): string | undefined {
  return Array.isArray(header) ? header[0] : header;
}

/**
 * Resolves the response language for a request.
 *
 * Priority:
 * 1. `X-Lang` header (explicit app-level override, e.g. `uz` | `ru`).
 * 2. `Accept-Language` header (standard browser/client negotiation, may
 *    list several weighted tags like `ru-RU,ru;q=0.9,en;q=0.8`).
 * 3. `uz` (app default).
 */
export function resolveLang(request: Request): SupportedLang {
  const xLang = normalizeLang(firstHeaderValue(request.headers['x-lang']));
  if (xLang) {
    return xLang;
  }

  const acceptLanguage = firstHeaderValue(request.headers['accept-language']);
  if (acceptLanguage) {
    const tags = acceptLanguage.split(',').map((tag) => tag.split(';')[0].trim());
    for (const tag of tags) {
      const lang = normalizeLang(tag);
      if (lang) {
        return lang;
      }
    }
  }

  return DEFAULT_LANG;
}
