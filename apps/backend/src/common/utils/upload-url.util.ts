/**
 * Accepts a client-supplied media URL only when it points at a file WE
 * stored (`<publicBaseUrl>/uploads/<name>` or the bare `/uploads/<name>`).
 * Anything else — another host, a path escape, a data: URL — becomes null,
 * so a scan/murojaat can never be "proved" with someone else's picture.
 */
export function ownUploadUrl(url: string | null | undefined, publicBaseUrl: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const base = publicBaseUrl.replace(/\/+$/, '');
  const path = trimmed.startsWith(`${base}/`) ? trimmed.slice(base.length) : trimmed;
  return /^\/uploads\/[A-Za-z0-9._-]+$/.test(path) && !path.includes('..') ? trimmed : null;
}
