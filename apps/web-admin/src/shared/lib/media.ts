/**
 * O'zimizning yuklangan fayl manzilini shu saytning `/uploads/...` yo'liga
 * o'tkazadi. Server to'liq manzil qaytaradi (`https://domen/uploads/x`); panel
 * `www.` da ochilsa u "boshqa sayt" bo'lib qoladi va brauzer `download` ni
 * e'tiborsiz qoldiradi. Begona host (jumladan lokal dev) o'zgarmaydi.
 */
export function sameOriginUploadUrl(url: string, pageHostname: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url; // nisbiy manzil — allaqachon shu saytda
  }
  if (!/^\/uploads\/[A-Za-z0-9._-]+$/.test(parsed.pathname)) return url;
  const bare = (host: string) => host.toLowerCase().replace(/^www\./, '');
  if (bare(parsed.hostname) !== bare(pageHostname)) return url;
  return `${parsed.pathname}${parsed.search}`;
}
