import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentText1, SearchNormal1, TickCircle } from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { cn } from '@/shared/lib/cn';
import { ReportList } from './ActivityViews';
import { localDay, useActivity } from './useActivity';

const PRESETS = [
  { key: 'today', label: 'Bugun', from: 0 },
  { key: 'week', label: '7 kun', from: -6 },
  { key: 'month', label: '30 kun', from: -29 },
] as const;

/**
 * Kunlik hisobotlar — xodimlar mobil ilovadan yuborgan matn, ovoz, video,
 * rasm va hujjatlar. Yuqorida: tanlangan davrda kim hisobot berdi / bermadi.
 */
export function ReportsPage() {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['key']>('week');
  const [query, setQuery] = useState('');
  const p = PRESETS.find((x) => x.key === preset) ?? PRESETS[1];
  const from = localDay(p.from);
  const to = localDay();
  const activity = useActivity(from, to);
  const rows = useMemo(() => activity.data?.rows ?? [], [activity.data]);
  const missing = rows.filter((r) => r.reportCount === 0);
  const reported = rows.length - missing.length;
  const open = (id: string) => navigate(`/oversight/${encodeURIComponent(id)}?tab=reports`);

  return (
    <div>
      <PageHeader title="Kunlik hisobotlar" subtitle="Xodimlar mobil ilovadan yuborgan matn, ovoz, video, rasm va hujjatlar" />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="inline-flex w-fit rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Davr">
          {PRESETS.map((x) => (
            <button
              key={x.key}
              role="tab"
              aria-selected={preset === x.key}
              onClick={() => setPreset(x.key)}
              className={cn(
                'rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors',
                preset === x.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="relative sm:flex-1">
          <SearchNormal1 size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Xodim yoki matn bo'yicha qidirish..."
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 lg:order-1">
          <ReportList from={from} to={to} showEmployee query={query} onOpenEmployee={open} />
        </div>

        <aside className="lg:order-2">
          <Card className="p-4 lg:sticky lg:top-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <DocumentText1 size={17} variant="Bulk" className="text-primary-600" /> Davr yakuni
              </h3>
              <span className="text-[12px] text-ink-muted">{p.label}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-emerald-50 px-3 py-2.5">
                <div className="text-lg font-bold tabular-nums text-emerald-700">{activity.isLoading ? '…' : reported}</div>
                <div className="text-[11.5px] text-emerald-700/80">hisobot bergan</div>
              </div>
              <div className="rounded-xl bg-danger-soft px-3 py-2.5">
                <div className="text-lg font-bold tabular-nums text-red-700">{activity.isLoading ? '…' : missing.length}</div>
                <div className="text-[11.5px] text-red-700/80">bermagan</div>
              </div>
            </div>
            {missing.length > 0 && (
              <>
                <p className="mt-4 text-[12px] font-medium uppercase tracking-wide text-ink-muted">Hisobot bermaganlar</p>
                <ul className="mt-2 max-h-[420px] space-y-1 overflow-y-auto">
                  {missing.map((r) => (
                    <li key={r.employeeId}>
                      <button
                        type="button"
                        onClick={() => open(r.employeeId)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-2"
                      >
                        <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} size={30} />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-ink">{r.fullName}</span>
                          <span className="block truncate text-[11.5px] text-ink-muted">{r.position}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!activity.isLoading && rows.length > 0 && missing.length === 0 && (
              <p className="mt-4 flex items-center gap-1.5 text-[13px] text-emerald-700">
                <TickCircle size={16} variant="Bulk" /> Hamma hisobot bergan
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
