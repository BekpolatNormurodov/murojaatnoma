import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CloseCircle, DocumentDownload, DocumentText1, RotateRight, SearchNormal1, TickCircle } from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { ReportList } from './ActivityViews';
import { PeriodBar } from './PeriodBar';
import { daysInclusive, rangeText, resolvePeriod, type PeriodSelection } from './period';
import { exportActivityWorkbook } from './exportActivity';
import { useActivity, type ActivityRow } from './useActivity';

/**
 * Kunlik hisobotlar — xodimlar mobil ilovadan yuborgan matn, ovoz, video,
 * rasm va hujjatlar. Yonida: tanlangan davrda kim necha kun hisobot berdi.
 */
export function ReportsPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodSelection>({ preset: 'week' });
  const [query, setQuery] = useState('');
  // Telefon/planshetda ro'yxatlar yig'ilgan holda — hisobotlar pastga surilib ketmasin.
  const [showPeople, setShowPeople] = useState(false);
  const { from, to } = resolvePeriod(period);
  const activity = useActivity(from, to);
  const rows = useMemo(() => activity.data?.rows ?? [], [activity.data]);
  // "N / M kun": M ko'rsatilayotgan ma'lumot davridan (yangisi yuklanguncha eskisi turadi).
  const totalDays = daysInclusive(activity.data?.from ?? from, activity.data?.to ?? to);
  // Ishdan bo'shaganlar "bermagan" hisoblanmaydi; bergan bo'lsa ro'yxatda qoladi.
  const missing = rows.filter((r) => r.reportDays === 0 && !r.archived);
  const reported = rows
    .filter((r) => r.reportDays > 0)
    .sort((a, b) => a.reportDays - b.reportDays || a.fullName.localeCompare(b.fullName));
  const failed = activity.isError && !activity.data;
  const count = (n: number) => (activity.isLoading ? '…' : failed ? '—' : n);
  const open = (id: string) => navigate(`/oversight/${encodeURIComponent(id)}?tab=reports`);

  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<{ text: string; error: boolean } | null>(null);
  async function handleExport() {
    setExporting(true);
    setExportNote(null);
    try {
      const result = await exportActivityWorkbook({
        range: { from, to },
        note: query.trim() ? `Barcha xodimlar (sahifadagi «${query.trim()}» qidiruvi qo'llanmagan)` : undefined,
      });
      setExportNote({
        text: result.dailyMissing ? `Excel tayyor — kunlik varaqlarsiz: ${result.dailyMissing}` : 'Excel tayyor',
        error: false,
      });
    } catch (err) {
      setExportNote({ text: err instanceof Error ? err.message : "Excel'ni tayyorlab bo'lmadi", error: true });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Kunlik hisobotlar"
        subtitle="Xodimlar mobil ilovadan yuborgan matn, ovoz, video, rasm va hujjatlar"
        action={
          <Button
            variant="secondary"
            onClick={() => void handleExport()}
            disabled={exporting}
            title={`Excel: ${rangeText({ from, to })} davri uchun barcha xodimlar`}
          >
            {exporting ? <RotateRight size={17} className="animate-spin" /> : <DocumentDownload size={17} />} Excel
          </Button>
        }
      />

      {exportNote && (
        <p
          role="status"
          className={
            exportNote.error
              ? 'mb-3 rounded-xl bg-danger-soft px-3.5 py-2.5 text-[13px] font-medium text-red-700'
              : 'mb-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] text-ink-soft'
          }
        >
          {exportNote.text}
        </p>
      )}

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <PeriodBar
          value={period}
          onChange={(next) => {
            setPeriod(next);
            setExportNote(null);
          }}
        />
        <div className="relative xl:flex-1">
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
        <div className="order-2 min-w-0 lg:order-1">
          <ReportList from={from} to={to} showEmployee query={query} onOpenEmployee={open} />
        </div>

        <aside className="order-1 min-w-0 lg:order-2">
          {/* top-20: yopishqoq Topbar (h-16) ostida qolmasin. */}
          <Card className="p-4 lg:sticky lg:top-20">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <DocumentText1 size={17} variant="Bulk" className="text-primary-600" /> Davr yakuni
              {activity.isFetching && <RotateRight size={13} className="animate-spin text-ink-muted" />}
            </h3>
            <p className="mt-0.5 text-[12px] tabular-nums text-ink-muted">
              {rangeText({ from, to })} · {daysInclusive(from, to)} kun
            </p>
            {activity.isError && (
              <div role="alert" className="mt-3 flex flex-col items-start gap-2 rounded-xl bg-danger-soft px-3 py-2.5">
                <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-red-700">
                  <CloseCircle size={15} variant="Bulk" className="mt-0.5 shrink-0" />
                  {activity.error instanceof Error ? activity.error.message : "Davr yakunini yuklab bo'lmadi"}
                </p>
                <Button variant="secondary" onClick={() => void activity.refetch()} disabled={activity.isFetching}>
                  <RotateRight size={15} /> Qayta urinish
                </Button>
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-success-soft px-3 py-2.5">
                <div className="text-lg font-bold tabular-nums text-primary-700">{count(reported.length)}</div>
                <div className="text-[11.5px] text-primary-700">hisobot bergan</div>
              </div>
              <div className="rounded-xl bg-danger-soft px-3 py-2.5">
                <div className="text-lg font-bold tabular-nums text-red-700">{count(missing.length)}</div>
                <div className="text-[11.5px] text-red-700">bermagan</div>
              </div>
            </div>
            {activity.isLoading && (
              <div className="mt-4 hidden space-y-2 lg:block">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
                ))}
              </div>
            )}
            {rows.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPeople((v) => !v)}
                aria-expanded={showPeople}
                className="mt-3 w-full rounded-xl border border-line py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2 lg:hidden"
              >
                {showPeople ? "Ro'yxatni yashirish" : "Xodimlar ro'yxatini ko'rsatish"}
              </button>
            )}
            <div
              className={cn(
                'max-h-[480px] overflow-y-auto lg:block lg:max-h-[max(10rem,min(480px,calc(100dvh-22rem)))]',
                showPeople ? 'block' : 'hidden',
              )}
            >
              <PeopleList title="Hisobot bermaganlar" rows={missing} totalDays={totalDays} onOpen={open} />
              {!activity.isLoading && rows.length > 0 && missing.length === 0 && (
                <p className="mt-4 flex items-center gap-1.5 text-[13px] text-primary-700">
                  <TickCircle size={16} variant="Bulk" /> Hamma hisobot bergan
                </p>
              )}
              <PeopleList title="Hisobot berganlar" rows={reported} totalDays={totalDays} onOpen={open} />
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function PeopleList({
  title,
  rows,
  totalDays,
  onOpen,
}: {
  title: string;
  rows: ActivityRow[];
  totalDays: number;
  onOpen: (id: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <p className="mt-4 text-[12px] font-medium uppercase tracking-wide text-ink-muted">{title}</p>
      <ul className="mt-2 space-y-1">
        {rows.map((r) => (
          <li key={r.employeeId}>
            <button
              type="button"
              onClick={() => onOpen(r.employeeId)}
              className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-surface-2"
            >
              <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} size={30} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{r.fullName}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">
                  {r.archived ? 'Arxivda · ' : ''}
                  {r.position}
                </span>
              </span>
              <span
                className={
                  r.reportDays === 0
                    ? 'shrink-0 text-[12px] font-semibold tabular-nums text-red-600'
                    : 'shrink-0 text-[12px] font-semibold tabular-nums text-ink'
                }
                title="Hisobot berilgan kunlar"
              >
                {r.reportDays} / {totalDays} kun
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
