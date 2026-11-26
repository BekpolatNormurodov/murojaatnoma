import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ArrowLeft, DocumentDownload, Mobile, ShieldTick } from 'iconsax-react';
import { Skeleton } from '@/shared/ui/Skeleton';
import { APPS, downloadUrl, megabytes, parseManifest } from './downloads';

async function fetchReleases() {
  const res = await fetch('/downloads/manifest.json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseManifest(await res.json());
}

const date = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
};

const STEPS = [
  'Telefonda shu sahifani oching va «Yuklab olish»ni bosing.',
  'Fayl yuklangach uni oching. So‘ralsa, brauzerga «Noma’lum ilovalarni o‘rnatish»ga ruxsat bering.',
  '«O‘rnatish»ni bosing. Yangilashda eski ilovani o‘chirmang — ustidan o‘rnatiladi.',
  'Xodim ilovasida joylashuvga «Doim ruxsat» bering va batareya cheklovini olib tashlang.',
];

/** Ochiq sahifa: Android ilovalarining oxirgi versiyasini yuklab olish. */
export function DownloadPage() {
  const query = useQuery({ queryKey: ['apk-manifest'], queryFn: fetchReleases, retry: 1 });

  return (
    <div className="min-h-dvh bg-surface-2 px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-5">
        <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">
          <ArrowLeft size={16} /> Boshqaruv paneliga kirish
        </Link>
        <header>
          <h1 className="text-2xl font-bold text-ink">Mobil ilovalar</h1>
          <p className="mt-1 text-sm text-ink-muted">Murojaatnoma · Android uchun oxirgi versiyalar</p>
        </header>

        {query.isPending && <Skeleton className="h-40 w-full rounded-2xl" />}
        {(query.isError || query.data?.length === 0) && (
          <p role="status" className="rounded-2xl border border-line bg-surface p-5 text-sm text-ink-muted">
            Hozircha yuklab olish uchun fayl yo‘q. Birozdan keyin qayta urinib ko‘ring.
          </p>
        )}
        {query.data?.map((r) => (
          <section key={r.key} className="rounded-2xl border border-line bg-surface p-5 shadow-soft">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10">
                <Mobile size={24} variant="Bulk" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-semibold text-ink">{APPS[r.key].title}</h2>
                <p className="text-sm text-ink-muted">{APPS[r.key].hint}</p>
                <p className="mt-1 text-xs tabular-nums text-ink-muted">
                  {[`Versiya ${r.version} (${r.build})`, r.size ? megabytes(r.size) : '', date(r.publishedAt)]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <a
              href={downloadUrl(r.file)}
              download={r.file}
              className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <DocumentDownload size={18} variant="Bold" /> Yuklab olish
            </a>
          </section>
        ))}

        <section className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <ShieldTick size={18} variant="Bulk" className="text-primary-600" /> O‘rnatish tartibi
          </h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-soft">
            {STEPS.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
