import { useMemo, useState } from 'react';
import {
  Clock,
  CloseCircle,
  DocumentText1,
  Gallery,
  Location,
  Microphone2,
  RotateRight,
  Video,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import {
  clock,
  durationText,
  fileSizeText,
  mediaLength,
  useDailyReports,
  useZoneTime,
  type DailyReport,
  type ReportAttachment,
  type ZoneDay,
} from './useActivity';

const WEEKDAYS = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

/** "2026-11-25" → "25-noyabr, Seshanba". */
function dayTitle(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return date;
  return `${d.getDate()}-${MONTHS[d.getMonth()]}, ${WEEKDAYS[d.getDay()]}`;
}

function ErrorBox({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="flex flex-col items-center gap-3 p-10 text-center">
      <CloseCircle size={36} variant="Bulk" className="text-danger" />
      <p className="text-sm text-ink-muted">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        <RotateRight size={16} /> Qayta urinish
      </Button>
    </Card>
  );
}

/* ═══════════════════════ Hududda bo'lgan vaqt ═══════════════════════ */

/**
 * Oxirgi 7 (yoki 14) kun: har kuni hududda / tashqarida necha soat va aniq
 * vaqt oraliqlari ("09:12 – 11:40 · Hududda · Olmazor"). Lokatsiya kelmagan
 * vaqt hech kimga hisoblanmaydi — raqamlar faqat kuzatilgan vaqt.
 */
export function ZoneTimePanel({ employeeId, assignedCount }: { employeeId: string; assignedCount: number }) {
  const [days, setDays] = useState(7);
  const { data, isLoading, isError, error, refetch, isFetching } = useZoneTime(employeeId, days);
  const list = useMemo(() => data?.days ?? [], [data]);
  const total = useMemo(
    () => list.reduce((a, d) => ({ zone: a.zone + d.zoneMinutes, active: a.active + d.activeMinutes }), { zone: 0, active: 0 }),
    [list],
  );

  if (isError) {
    return <ErrorBox message={error instanceof Error ? error.message : "Ma'lumotni yuklab bo'lmadi"} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              <Location size={18} variant="Bulk" className="text-primary-600" /> Hududda bo'lgan vaqt
              {isFetching && <RotateRight size={14} className="animate-spin text-ink-muted" />}
            </h3>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              {assignedCount > 0 ? `${assignedCount} ta biriktirilgan mahalla` : 'Butun tuman hudud hisoblanadi'} · ofisda
              bo'lish ham hudud · {data?.gapMinutes ?? 15} daqiqadan uzun uzilish hisoblanmaydi
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Davr">
            {[7, 14].map((n) => (
              <button
                key={n}
                role="tab"
                aria-selected={days === n}
                onClick={() => setDays(n)}
                className={cn(
                  'rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  days === n ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {n} kun
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Stat label={`${days} kunda hududda`} value={isLoading ? '…' : durationText(total.zone)} tone="text-emerald-600" />
          <Stat label="Faol (lokatsiya kelgan)" value={isLoading ? '…' : durationText(total.active)} tone="text-ink" />
        </div>
      </Card>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((d) => (
            <ZoneDayCard key={d.date} d={d} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3.5 py-3">
      <div className={cn('text-lg font-bold tabular-nums leading-tight', tone)}>{value}</div>
      <div className="mt-0.5 truncate text-[12px] text-ink-muted">{label}</div>
    </div>
  );
}

function ZoneDayCard({ d }: { d: ZoneDay }) {
  const empty = d.activeMinutes === 0;
  const share = d.activeMinutes > 0 ? Math.round((d.zoneMinutes / d.activeMinutes) * 100) : 0;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 sm:px-5">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-ink">{dayTitle(d.date)}</div>
          <div className="text-[12px] text-ink-muted">
            {d.firstAt ? `Birinchi lokatsiya ${clock(d.firstAt)} · oxirgisi ${clock(d.lastAt)}` : "Lokatsiya kelmagan"}
          </div>
        </div>
        {!empty && (
          <div className="flex shrink-0 items-center gap-3 text-right">
            <div>
              <div className="text-[15px] font-bold tabular-nums text-emerald-600">{durationText(d.zoneMinutes)}</div>
              <div className="text-[11px] text-ink-muted">hududda</div>
            </div>
            <div>
              <div className="text-[15px] font-semibold tabular-nums text-red-500">{durationText(d.outsideMinutes)}</div>
              <div className="text-[11px] text-ink-muted">tashqarida</div>
            </div>
          </div>
        )}
      </div>

      {!empty && (
        <div className="mx-4 mt-3 h-2 overflow-hidden rounded-full bg-red-100 sm:mx-5" title={`${share}% vaqt hududda`}>
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${share}%` }} />
        </div>
      )}

      {!empty && (d.byMahalla?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5" aria-label="Mahallalar bo'yicha">
          {d.byMahalla!.slice(0, 8).map((m) => (
            <span
              key={`${m.inside ? 1 : 0}-${m.name ?? '-'}`}
              title={m.inside ? 'Biriktirilgan hudud' : 'Hududdan tashqari'}
              className={cn(
                'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px]',
                m.inside ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700',
              )}
            >
              <Location size={12} variant="Bulk" className="shrink-0" />
              <span className="truncate">{m.name ?? 'Tuman tashqarisi'}</span>
              <span className="shrink-0 font-semibold tabular-nums">{durationText(m.minutes)}</span>
            </span>
          ))}
        </div>
      )}

      <div className="px-4 pb-3.5 pt-2 sm:px-5">
        {empty ? (
          <p className="py-1 text-[12.5px] text-ink-muted">Bu kuni hududda bo'lgani qayd etilmagan.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {d.stretches.map((s, i) => (
              <li key={`${s.from}-${i}`} className="flex items-center gap-3 py-1.5 text-[13px]">
                <span className="w-[104px] shrink-0 font-medium tabular-nums text-ink">
                  {clock(s.from)} – {clock(s.to)}
                </span>
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium',
                    s.inside ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600',
                  )}
                >
                  <span className={cn('h-1.5 w-1.5 rounded-full', s.inside ? 'bg-emerald-500' : 'bg-red-500')} />
                  {s.inside ? 'Hududda' : 'Tashqarida'}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-muted">{s.mahallaName ?? ''}</span>
                <span className="shrink-0 tabular-nums text-ink-soft">{durationText(s.minutes)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ═══════════════════════ Kunlik hisobotlar ═══════════════════════ */

const KIND_META: Record<ReportAttachment['kind'], { label: string; icon: typeof Gallery }> = {
  image: { label: 'Rasm', icon: Gallery },
  voice: { label: 'Ovozli xabar', icon: Microphone2 },
  video: { label: 'Video', icon: Video },
  file: { label: 'Hujjat', icon: DocumentText1 },
};

/** Hisobotlar ro'yxati — kunlar bo'yicha guruhlangan, yangi birinchi. */
export function ReportList({
  from,
  to,
  employeeId,
  showEmployee,
  query = '',
  onOpenEmployee,
}: {
  from: string;
  to: string;
  employeeId?: string;
  showEmployee?: boolean;
  query?: string;
  onOpenEmployee?: (id: string) => void;
}) {
  const { data, isLoading, isError, error, refetch } = useDailyReports({ from, to, employeeId });
  const [zoom, setZoom] = useState<string | null>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = (Array.isArray(data) ? data : []).filter(
      (r) => !q || (r.employee?.fullName ?? '').toLowerCase().includes(q) || (r.text ?? '').toLowerCase().includes(q),
    );
    const map = new Map<string, DailyReport[]>();
    for (const r of rows) map.set(r.day, [...(map.get(r.day) ?? []), r]);
    return [...map.entries()];
  }, [data, query]);

  if (isError) {
    return <ErrorBox message={error instanceof Error ? error.message : "Hisobotlarni yuklab bo'lmadi"} onRetry={() => refetch()} />;
  }
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
    );
  }
  if (groups.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <DocumentText1 size={40} variant="Bulk" className="text-ink-muted" />
        <p className="font-semibold text-ink">Hisobot yo'q</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Xodimlar mobil ilovadagi «Kunlik hisobot» bo'limidan matn, ovoz, video yoki hujjat yuborganda shu yerda ko'rinadi.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([day, rows]) => (
        <section key={day}>
          <h4 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-soft">
            {dayTitle(day)}
            <span className="rounded-full bg-surface-2 px-2 text-[11px] tabular-nums text-ink-muted">{rows.length}</span>
          </h4>
          <div className="space-y-3">
            {rows.map((r) => (
              <ReportCard key={r.id} r={r} showEmployee={showEmployee} onZoom={setZoom} onOpenEmployee={onOpenEmployee} />
            ))}
          </div>
        </section>
      ))}

      {zoom && (
        <button
          type="button"
          onClick={() => setZoom(null)}
          aria-label="Yopish"
          className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4"
        >
          <img src={zoom} alt="" className="max-h-full max-w-full rounded-xl object-contain" />
        </button>
      )}
    </div>
  );
}

function ReportCard({
  r,
  showEmployee,
  onZoom,
  onOpenEmployee,
}: {
  r: DailyReport;
  showEmployee?: boolean;
  onZoom: (url: string) => void;
  onOpenEmployee?: (id: string) => void;
}) {
  const images = r.attachments.filter((a) => a.kind === 'image');
  const others = r.attachments.filter((a) => a.kind !== 'image');
  const sent = new Date(r.createdAt);
  const late = r.day !== `${sent.getFullYear()}-${String(sent.getMonth() + 1).padStart(2, '0')}-${String(sent.getDate()).padStart(2, '0')}`;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start gap-3">
        {showEmployee && r.employee && (
          <button type="button" onClick={() => onOpenEmployee?.(r.employeeId)} className="shrink-0" title="Profilni ochish">
            <Avatar name={r.employee.fullName} src={r.employee.avatarUrl ?? undefined} size={40} />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {showEmployee && r.employee ? (
              <button
                type="button"
                onClick={() => onOpenEmployee?.(r.employeeId)}
                className="min-w-0 truncate text-left text-[14px] font-semibold text-ink hover:text-primary-700"
              >
                {r.employee.fullName}
                <span className="ml-1.5 text-[12px] font-normal text-ink-muted">{r.employee.position}</span>
              </button>
            ) : (
              <span />
            )}
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-ink-muted">
              <Clock size={13} /> {clock(r.createdAt)}
              {late && <span className="ml-1 rounded bg-warning-soft px-1.5 text-[11px] text-amber-700">keyin yuborilgan</span>}
            </span>
          </div>

          {r.text && <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">{r.text}</p>}

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((a) => (
                <button
                  key={a.url}
                  type="button"
                  onClick={() => onZoom(a.url)}
                  className="aspect-square overflow-hidden rounded-xl border border-line bg-surface-2"
                >
                  <img src={a.url} alt={a.fileName ?? ''} loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          {others.length > 0 && (
            <div className="mt-3 space-y-2">
              {others.map((a) => (
                <AttachmentRow key={a.url} a={a} />
              ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function AttachmentRow({ a }: { a: ReportAttachment }) {
  const meta = KIND_META[a.kind];
  if (a.kind === 'voice') {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
        <Microphone2 size={18} variant="Bulk" className="shrink-0 text-primary-600" />
        <audio controls preload="none" src={a.url} className="h-9 min-w-0 flex-1" />
        {a.durationSec != null && <span className="text-[12px] tabular-nums text-ink-muted">{mediaLength(a.durationSec)}</span>}
      </div>
    );
  }
  if (a.kind === 'video') {
    return (
      <video controls preload="metadata" src={a.url} className="max-h-80 w-full rounded-xl border border-line bg-black" />
    );
  }
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noreferrer"
      download={a.fileName ?? undefined}
      className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:bg-primary-50"
    >
      <meta.icon size={20} variant="Bulk" className="shrink-0 text-primary-600" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">{a.fileName ?? meta.label}</span>
        <span className="text-[11.5px] text-ink-muted">
          {meta.label}
          {a.fileSize ? ` · ${fileSizeText(a.fileSize)}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-[12px] font-medium text-primary-600">Ochish</span>
    </a>
  );
}
