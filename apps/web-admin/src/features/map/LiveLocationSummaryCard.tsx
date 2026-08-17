import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Location, ArrowRight2 } from 'iconsax-react';
import { fetchLocationStats } from '@/shared/api/locations';

/**
 * Compact dashboard card summarizing live employee location (from the real
 * /locations/stats feed). Self-contained — the dashboard just imports and
 * places it; polls every 15s. Links through to the full live map.
 */
export function LiveLocationSummaryCard() {
  const lang = localStorage.getItem('hkm-lang') === 'ru' ? 'ru' : 'uz';
  const t = (uz: string, ru: string) => (lang === 'ru' ? ru : uz);

  const { data } = useQuery({
    queryKey: ['locations', 'stats'],
    queryFn: fetchLocationStats,
    refetchInterval: 15_000,
  });

  const items = [
    { label: t('Faol', 'Активны'), value: data?.reportingNow, tone: 'text-blue-600' },
    { label: t('Ish hududida', 'На месте'), value: data?.insideOffice, tone: 'text-emerald-600' },
    { label: t("Aloqa yo'q", 'Нет связи'), value: data?.stale, tone: 'text-red-600' },
  ];

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50">
            <Location size={20} variant="Bulk" className="text-primary-600" />
          </span>
          <div>
            <div className="text-sm font-semibold text-ink">
              {t('Xodimlar joylashuvi', 'Локация сотрудников')}
            </div>
            <div className="text-xs text-ink-muted">
              {t('Jonli', 'Онлайн')} · {data?.totalActive ?? '—'}{' '}
              {t('xodim', 'сотр.')}
            </div>
          </div>
        </div>
        <Link
          to="/map"
          className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
        >
          {t('Xaritada', 'На карте')}
          <ArrowRight2 size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {items.map((it) => (
          <div key={it.label} className="rounded-xl bg-surface-2 px-3 py-2.5 text-center">
            <div className={`text-xl font-bold ${it.tone}`}>{it.value ?? '—'}</div>
            <div className="mt-0.5 text-[11px] text-ink-muted">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
