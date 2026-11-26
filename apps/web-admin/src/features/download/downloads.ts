/* `/downloads/manifest.json` — deploy paytida yoziladigan APK ro'yxati. */

export interface Release {
  key: string;
  version: string;
  build: number;
  file: string;
  size: number;
  publishedAt: string;
}

export const APPS: Record<string, { title: string; hint: string }> = {
  worker: { title: 'Xodim ilovasi', hint: 'Hokimlik xodimlari uchun: davomat, joylashuv, topshiriqlar.' },
  user: { title: 'Fuqaro ilovasi', hint: 'Fuqarolar uchun: murojaat va shikoyat yuborish.' },
};

const ORDER = Object.keys(APPS);

/** Yaroqsiz yoki noma'lum yozuvlar tashlab ketiladi. */
export function parseManifest(data: unknown): Release[] {
  const apps = (data as { apps?: Record<string, Partial<Release>> } | null)?.apps;
  if (!apps || typeof apps !== 'object') return [];
  return ORDER.flatMap((key) => {
    const r = apps[key];
    // Fayl nomi faqat shu papkadagi APK — yo'l yoki tashqi manzil emas.
    return r && typeof r.version === 'string' && typeof r.file === 'string' && /^[\w.+-]+\.apk$/.test(r.file)
      ? [{ key, version: r.version, build: Number(r.build) || 0, file: r.file, size: Number(r.size) || 0, publishedAt: r.publishedAt ?? '' }]
      : [];
  });
}

export const downloadUrl = (file: string) => `/downloads/${encodeURIComponent(file)}`;

export const megabytes = (bytes: number) => `${Math.round(bytes / 1_048_576)} MB`;
