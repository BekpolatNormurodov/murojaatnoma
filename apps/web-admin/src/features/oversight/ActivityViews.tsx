import { useMemo, useState } from 'react';
import {
  Clock,
  CloseCircle,
  DocumentDownload,
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
import { PhotoLightbox, SmartImage } from '@/shared/ui/SmartImage';
import { cn } from '@/shared/lib/cn';
import { sameOriginUploadUrl } from '@/shared/lib/media';
import { TERRITORY_LABEL, territoryOf, type Territory } from '@/shared/lib/territory';
import { matchesSearch } from '@/shared/lib/translit';
import { mergeReportPages } from './reportPages';
import { dmy, stretchEnd } from './period';
import {
  clock,
  durationText,
  fileSizeText,
  localDay,
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

const TERRITORY_STYLE: Record<Territory, { badge: string; dot: string; chip: string; hint: string }> = {
  zone: {
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    chip: 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300',
    hint: 'Biriktirilgan hudud',
  },
  office: {
    badge: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300',
    dot: 'bg-sky-500',
    chip: 'border-sky-200 bg-sky-50 text-sky-800 dark:bg-sky-500/10 dark:text-sky-300',
    hint: 'Ofisda (hududdan tashqarida)',
  },
  outside: {
    badge: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    dot: 'bg-red-500',
    chip: 'border-red-200 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400',
    hint: 'Hududdan tashqari',
  },
  none: {
    badge: 'bg-surface-2 text-ink-muted',
    dot: 'bg-slate-400',
    chip: 'border-line bg-surface-2 text-ink-soft',
    hint: 'Hudud biriktirilmagan',
  },
};

/**
 * Oxirgi 8 (bugun + 7) yoki 14 kun: har kuni hududda / ofisda / tashqarida
 * necha soat va aniq vaqt oraliqlari ("09:12 – 11:40 · Hududda · Olmazor").
 * Ish vaqtidagi raqamlar 24 soatlikdan alohida. Lokatsiya kelmagan vaqt hech
 * kimga hisoblanmaydi — raqamlar faqat kuzatilgan vaqt.
 */
export function ZoneTimePanel({ employeeId, assignedCount }: { employeeId: string; assignedCount: number }) {
  const [days, setDays] = useState(8);
  const { data, isLoading, isError, error, refetch, isFetching } = useZoneTime(employeeId, days);
  const list = useMemo(() => data?.days ?? [], [data]);
  const total = useMemo(
    () =>
      list.reduce(
        (a, d) => ({
          zone: a.zone + d.zoneMinutes,
          office: a.office + (d.officeMinutes ?? 0),
          outside: a.outside + d.outsideMinutes,
          unassigned: a.unassigned + (d.unassignedMinutes ?? 0),
          active: a.active + d.activeMinutes,
          workZone: a.workZone + (d.workZoneMinutes ?? 0),
          workActive: a.workActive + (d.workActiveMinutes ?? 0),
        }),
        { zone: 0, office: 0, outside: 0, unassigned: 0, active: 0, workZone: 0, workActive: 0 },
      ),
    [list],
  );
  // Eski backend bu maydonlarni bermaydi — "0" deb ko'rsatmaymiz.
  const hasOffice = list.some((d) => d.officeMinutes != null);
  const hasWork = list.some((d) => d.workActiveMinutes != null);
  const schedule =
    data?.workStartTime && data?.workEndTime ? `${data.workStartTime}–${data.workEndTime}` : null;
  const shown = (minutes: number) => (isLoading ? '…' : durationText(minutes));
  // Yangi davr yuklanguncha eski ma'lumot turadi — sarlavha ham o'shaniki bo'lsin.
  const shownDays = list.length || days;

  // Fon yangilanishi yiqilsa, yuklangan kunlar ekranda qoladi.
  if (isError && !data) {
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
              {assignedCount > 0 ? `${assignedCount} ta biriktirilgan mahalla` : 'Mahalla biriktirilmagan — hududdagi vaqt hisoblanmaydi'} ·{' '}
              {data?.gapMinutes ?? 15} daqiqadan uzun uzilish hisoblanmaydi
            </p>
          </div>
          <div className="inline-flex rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Davr">
            {[8, 14].map((n) => (
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
        {hasWork && (
          <>
            <p className="mt-4 text-[12px] font-semibold text-ink-soft">
              {shownDays} kunda ish vaqtida{schedule ? ` (${schedule})` : ''}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Stat label="Hududda" value={shown(total.workZone)} tone="text-emerald-600" />
              <Stat label="Faol (lokatsiya kelgan)" value={shown(total.workActive)} tone="text-ink" />
            </div>
          </>
        )}
        <p className="mt-4 text-[12px] font-semibold text-ink-soft">{shownDays} kunda, kun bo'yi (24 soat)</p>
        <div className={cn('mt-2 grid grid-cols-2 gap-3', hasOffice ? 'sm:grid-cols-4' : 'sm:grid-cols-3')}>
          <Stat label="Hududda" value={shown(total.zone)} tone="text-emerald-600" />
          {hasOffice && <Stat label="Ofisda" value={shown(total.office)} tone="text-sky-600" />}
          <Stat label="Tashqarida" value={shown(total.outside)} tone="text-red-500" />
          {total.unassigned > 0 && (
            <Stat label="Hududsiz" value={shown(total.unassigned)} tone="text-ink-muted" />
          )}
          <Stat label="Faol (lokatsiya kelgan)" value={shown(total.active)} tone="text-ink" />
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
      <div className="mt-0.5 text-[12px] leading-tight text-ink-muted">{label}</div>
    </div>
  );
}

function ZoneDayCard({ d }: { d: ZoneDay }) {
  const empty = d.activeMinutes === 0;
  const percent = (minutes: number) => (d.activeMinutes > 0 ? Math.round((minutes / d.activeMinutes) * 100) : 0);
  const share = percent(d.zoneMinutes);
  const officeShare = percent(d.officeMinutes ?? 0);
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
          // Telefonda alohida qatorda, teng ustunlarda — uzun davomiylik sig'adi.
          <div className="grid w-full auto-cols-fr grid-flow-col gap-3 sm:flex sm:w-auto sm:shrink-0 sm:items-start sm:text-right">
            <div>
              <div className="text-[15px] font-bold tabular-nums text-emerald-600">{durationText(d.zoneMinutes)}</div>
              <div className="text-[11px] text-ink-muted">hududda</div>
            </div>
            {(d.officeMinutes ?? 0) > 0 && (
              <div>
                <div className="text-[15px] font-semibold tabular-nums text-sky-600">{durationText(d.officeMinutes!)}</div>
                <div className="text-[11px] text-ink-muted">ofisda</div>
              </div>
            )}
            <div>
              <div className="text-[15px] font-semibold tabular-nums text-red-500">{durationText(d.outsideMinutes)}</div>
              <div className="text-[11px] text-ink-muted">tashqarida</div>
            </div>
          </div>
        )}
      </div>

      {!empty && (
        <div
          className="mx-4 mt-3 flex h-2 overflow-hidden rounded-full bg-red-100 dark:bg-red-500/25 sm:mx-5"
          title={`${share}% vaqt hududda${officeShare ? `, ${officeShare}% ofisda` : ''}`}
        >
          <div className="h-full bg-emerald-500" style={{ width: `${share}%` }} />
          <div className="h-full bg-sky-400" style={{ width: `${officeShare}%` }} />
          <div className="h-full bg-slate-300 dark:bg-slate-600" style={{ width: `${percent(d.unassignedMinutes ?? 0)}%` }} />
        </div>
      )}

      {!empty && d.workActiveMinutes != null && (
        <p className="px-4 pt-2 text-[12px] text-ink-soft sm:px-5">
          Ish vaqtida: hududda{' '}
          <span className="font-semibold tabular-nums text-ink">{durationText(d.workZoneMinutes ?? 0)}</span> · faol{' '}
          <span className="font-semibold tabular-nums text-ink">{durationText(d.workActiveMinutes)}</span>
          <span className="text-ink-muted"> · yuqoridagi raqamlar kun bo'yi (24 soat)</span>
        </p>
      )}

      {!empty && (d.byMahalla?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 pt-3 sm:px-5" aria-label="Mahallalar bo'yicha">
          {d.byMahalla!.slice(0, 8).map((m) => {
            const at = territoryOf(m.inside, m.office, m.assigned);
            return (
              <span
                key={`${at}-${m.name ?? '-'}`}
                title={TERRITORY_STYLE[at].hint}
                className={cn(
                  'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-2 py-1 text-[12px]',
                  TERRITORY_STYLE[at].chip,
                )}
              >
                <Location size={12} variant="Bulk" className="shrink-0" />
                <span className="truncate">{m.name ?? (at === 'office' ? 'Ofis' : 'Tuman tashqarisi')}</span>
                {at === 'office' && m.name && <span className="shrink-0 text-[10.5px] font-semibold uppercase">ofis</span>}
                <span className="shrink-0 font-semibold tabular-nums">{durationText(m.minutes)}</span>
              </span>
            );
          })}
        </div>
      )}

      <div className="px-4 pb-3.5 pt-2 sm:px-5">
        {empty ? (
          <p className="py-1 text-[12.5px] text-ink-muted">Bu kuni faol vaqt qayd etilmagan.</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {d.stretches.map((s, i) => {
              const at = territoryOf(s.inside, s.office, s.assigned);
              return (
                <li
                  key={`${s.from}-${i}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5 text-[13px] sm:flex-nowrap"
                >
                  <span className="w-[104px] shrink-0 whitespace-nowrap font-medium tabular-nums text-ink">
                    {clock(s.from)} – {stretchEnd(s.from, s.to)}
                  </span>
                  <span
                    className={cn(
                      'order-3 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium sm:order-none',
                      TERRITORY_STYLE[at].badge,
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', TERRITORY_STYLE[at].dot)} />
                    {TERRITORY_LABEL[at]}
                  </span>
                  <span className="order-4 min-w-0 flex-1 truncate text-ink-muted sm:order-none">{s.mahallaName ?? ''}</span>
                  <span className="order-2 ml-auto shrink-0 whitespace-nowrap tabular-nums text-ink-soft sm:order-none sm:ml-0">
                    {durationText(s.minutes)}
                  </span>
                  {/* Telefonda qatorni bo'ladi: holat va mahalla pastga tushadi. */}
                  <span className="order-2 h-0 w-full sm:hidden" aria-hidden />
                </li>
              );
            })}
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
  const { data, isLoading, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isFetchNextPageError } =
    useDailyReports({ from, to, employeeId });
  const [zoom, setZoom] = useState<{ photos: string[]; index: number } | null>(null);

  const loaded = useMemo(() => mergeReportPages(data?.pages ?? []), [data]);
  const groups = useMemo(() => {
    // Kirill/lotin farqisiz qidiruv.
    const rows = loaded.filter((r) => matchesSearch(query, r.employee?.fullName, r.text));
    const map = new Map<string, DailyReport[]>();
    for (const r of rows) map.set(r.day, [...(map.get(r.day) ?? []), r]);
    return [...map.entries()];
  }, [loaded, query]);

  const more = hasNextPage && (
    <div className="flex flex-col items-center gap-2">
      {isFetchNextPageError && (
        <p role="alert" className="text-[12.5px] font-medium text-red-600">
          Keyingi hisobotlarni yuklab bo'lmadi
        </p>
      )}
      <Button variant="secondary" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
        {isFetchingNextPage && <RotateRight size={16} className="animate-spin" />}
        {isFetchingNextPage ? 'Yuklanmoqda...' : 'Yana yuklash'}
      </Button>
    </div>
  );

  // Fon yangilanishi yiqilsa, yuklangan hisobotlar ekranda qoladi.
  if (isError && !data) {
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
  if (groups.length === 0 && loaded.length > 0 && query.trim()) {
    return (
      <div className="space-y-4">
        <Card className="flex flex-col items-center gap-2 p-12 text-center">
          <DocumentText1 size={40} variant="Bulk" className="text-ink-muted" />
          <p className="font-semibold text-ink">«{query.trim()}» bo'yicha hisobot topilmadi</p>
          <p className="max-w-sm text-sm text-ink-muted">
            {hasNextPage
              ? `Faqat yuklangan ${loaded.length} ta hisobot ichidan qidirildi — davomini yuklab ko'ring.`
              : "Boshqa ism yoki so'z bilan qidiring yoki davrni o'zgartiring."}
          </p>
        </Card>
        {more}
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
      {more}

      <PhotoLightbox
        photos={zoom?.photos ?? []}
        index={zoom?.index ?? null}
        onClose={() => setZoom(null)}
        onIndex={(index) => setZoom((z) => (z ? { ...z, index } : z))}
      />
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
  onZoom: (zoom: { photos: string[]; index: number }) => void;
  onOpenEmployee?: (id: string) => void;
}) {
  const files = r.attachments.map((a) => ({ ...a, url: sameOriginUploadUrl(a.url, window.location.hostname) }));
  const images = files.filter((a) => a.kind === 'image');
  const others = files.filter((a) => a.kind !== 'image');
  const sent = new Date(r.createdAt);
  const late = r.day !== localDay(0, sent);
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
                className="min-w-0 max-w-full text-left text-[14px] font-semibold text-ink hover:text-primary-700"
              >
                <span className="break-words">{r.employee.fullName}</span>
                <span className="block text-[12px] font-normal text-ink-muted sm:ml-1.5 sm:inline">{r.employee.position}</span>
              </button>
            ) : (
              <span />
            )}
            <span className="flex shrink-0 items-center gap-1 text-[12px] text-ink-muted">
              {/* Kechikib yuborilgan bo'lsa — qaysi kuni ekani ham ko'rinadi. */}
              <Clock size={13} /> {late ? `${dmy(localDay(0, sent))} ` : ''}
              {clock(r.createdAt)}
              {late && <span className="ml-1 rounded bg-warning-soft px-1.5 text-[11px] text-amber-700">keyin yuborilgan</span>}
            </span>
          </div>

          {r.text && <p className="mt-1.5 whitespace-pre-wrap break-words text-[13.5px] leading-relaxed text-ink">{r.text}</p>}

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
              {images.map((a, index) => (
                <SmartImage
                  key={a.url}
                  src={a.url}
                  alt={a.fileName ?? 'Hisobot rasmi'}
                  onClick={() => onZoom({ photos: images.map((i) => i.url), index })}
                  className="aspect-square rounded-xl border border-line bg-surface-2"
                />
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

/** Pleyer ostidagi qator: fayl nomi, hajmi, davomiyligi va yuklab olish. */
function MediaFooter({ a, durationSec }: { a: ReportAttachment; durationSec: number | null }) {
  const facts = [fileSizeText(a.fileSize), mediaLength(durationSec)].filter(Boolean).join(' · ');
  return (
    <div className="flex items-center gap-3 text-[12px]">
      <span className="min-w-0 flex-1 truncate text-ink-muted">
        <span className="font-medium text-ink-soft">{a.fileName ?? KIND_META[a.kind].label}</span>
        {facts && <span className="tabular-nums"> · {facts}</span>}
      </span>
      <a
        href={a.url}
        download={a.fileName ?? ''}
        target="_blank"
        rel="noreferrer"
        className="inline-flex shrink-0 items-center gap-1 font-medium text-primary-600 hover:underline"
      >
        <DocumentDownload size={14} /> Yuklab olish
      </a>
    </div>
  );
}

function PlaybackError({ text }: { text: string }) {
  return (
    <p role="alert" className="rounded-lg bg-warning-soft px-2.5 py-1.5 text-[12px] text-amber-700">
      {text}
    </p>
  );
}

function AttachmentRow({ a }: { a: ReportAttachment }) {
  const meta = KIND_META[a.kind];
  const [broken, setBroken] = useState(false);
  // Ilova davomiylikni yubormagan bo'lsa — videoning o'zidan.
  const [measured, setMeasured] = useState<number | null>(null);
  if (a.kind === 'voice') {
    return (
      <div className="space-y-2 rounded-xl border border-line bg-surface-2 px-3 py-2">
        <div className="flex items-center gap-2">
          <Microphone2 size={18} variant="Bulk" className="shrink-0 text-primary-600" />
          <audio controls preload="none" src={a.url} onError={() => setBroken(true)} className="h-9 min-w-0 flex-1" />
        </div>
        {broken && <PlaybackError text="Brauzer bu ovozli xabarni o'ynata olmadi — faylni yuklab oching." />}
        <MediaFooter a={a} durationSec={a.durationSec} />
      </div>
    );
  }
  if (a.kind === 'video') {
    return (
      <div className="space-y-2">
        <video
          controls
          preload="metadata"
          src={a.url}
          onError={() => setBroken(true)}
          // HEVC: ba'zi brauzerlar faqat ovozni ochadi — tasvir eni 0 bo'lib qoladi.
          onLoadedMetadata={(e) => {
            const { videoWidth, duration } = e.currentTarget;
            setBroken(videoWidth === 0);
            if (Number.isFinite(duration)) setMeasured(Math.round(duration));
          }}
          className="max-h-80 w-full rounded-xl border border-line bg-black"
        />
        {broken && (
          <PlaybackError text="Brauzer bu videoni o'ynata olmadi (masalan, iPhone'dagi HEVC .mov) — faylni yuklab oching." />
        )}
        <MediaFooter a={a} durationSec={a.durationSec ?? measured} />
      </div>
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
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary-600">
        <DocumentDownload size={14} /> Yuklab olish
      </span>
    </a>
  );
}
