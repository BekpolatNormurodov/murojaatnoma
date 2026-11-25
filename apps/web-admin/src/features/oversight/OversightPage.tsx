import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Add,
  CloseCircle,
  DocumentDownload,
  Edit2,
  Eye,
  Judge,
  Location,
  Profile2User,
  RotateRight,
  ScanBarcode,
  ShieldTick,
  TickCircle,
  Timer1,
  Trash,
  UserRemove,
  ArchiveBook,
  Refresh2,
  DocumentText1,
  Building,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { MonthPicker } from '@/shared/ui/MonthPicker';
import { Pagination } from '@/shared/ui/Pagination';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { formatSom, formatSomShort } from '@/shared/lib/format';
import { TERRITORY_LABEL, territoryOf } from '@/shared/lib/territory';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { usePermissions } from '@/shared/lib/permissions';
import { useOversight, type OversightRow } from './useOversight';
import { AssignZonesModal } from './AssignZonesModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { ArchiveEmployeeDialog } from './ArchiveEmployeeDialog';
import { usePurgeEmployee, useRestoreEmployee } from './useEmployeeMutations';
import { useArchivedEmployees, type ArchivedEmployee } from './useEmployeeProfile';
import {
  durationText,
  localDay,
  useActivity,
  useAttendanceSettings,
  useUpdateAttendanceSettings,
  type ActivityRow,
} from './useActivity';
import { attMeta } from './oversightMeta';
import { exportActivityWorkbook } from './exportActivity';
import { ExportPeriodModal } from './ExportPeriodModal';
import type { Range } from './period';
import { Switch } from '@/shared/ui/Switch';

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** ISO -> "08:42" (bo'sh bo'lsa —). */
function hhmm(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type FlagFilter = 'all' | 'absent' | 'late' | 'outside' | 'noface';

/** Does a row match the active quick-filter (problem categories for oversight)? */
function matchesFlag(r: OversightRow, f: FlagFilter): boolean {
  switch (f) {
    case 'absent':
      return r.attendance.status === 'absent';
    case 'late':
      return r.attendance.status === 'late';
    case 'outside':
      // Ofisdagi xodim "hududdan tashqari" muammosi emas.
      return (
        r.location.hasLocation &&
        territoryOf(r.location.insideAssignedZone, r.location.insideOffice) === 'outside'
      );
    case 'noface':
      return !r.hasFace;
    default:
      return true;
  }
}

const FLAGS: { key: FlagFilter; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'absent', label: 'Kelmagan' },
  { key: 'late', label: 'Kechikkan' },
  { key: 'outside', label: 'Hududdan tashqari' },
  { key: 'noface', label: 'Yuzsiz' },
];

/**
 * Grid spans for the 5 KPI tiles: phone 2+2+1(wide), tablet and laptop 3+2,
 * wide desktop 5 in a row (at 1024–1279px five tiles cut their labels off).
 * Without the face tile the 4 that remain need no spans.
 */
const KPI_SPANS = [
  'sm:col-span-2 xl:col-span-1',
  'sm:col-span-2 xl:col-span-1',
  'sm:col-span-2 xl:col-span-1',
  'sm:col-span-3 xl:col-span-1',
  'col-span-2 sm:col-span-3 xl:col-span-1',
];

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

export function OversightPage() {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [y, m] = monthValue.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const month = m || new Date().getMonth() + 1;

  const { data, isLoading, isError, error, refetch, isFetching } = useOversight(year, month);
  const [query, setQuery] = useState('');
  const [flag, setFlag] = useState<FlagFilter>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [assigning, setAssigning] = useState<OversightRow | null>(null);
  const [empModal, setEmpModal] = useState<{ open: boolean; row: OversightRow | null }>({ open: false, row: null });
  const [archiving, setArchiving] = useState<{ id: string; fullName: string } | null>(null);
  const [purging, setPurging] = useState<ArchivedEmployee | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { isSuperAdmin, canWrite } = usePermissions();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Faol xodimlar yoki arxiv (ishdan bo'shatilganlar) — ?view=archive.
  const view: 'active' | 'archive' = searchParams.get('view') === 'archive' ? 'archive' : 'active';
  const archivedQuery = useArchivedEmployees();
  const archivedRows = archivedQuery.data ?? [];
  const purge = usePurgeEmployee();
  const restore = useRestoreEmployee();
  const openProfile = (id: string, tab?: 'zone' | 'reports') =>
    navigate(`/oversight/${encodeURIComponent(id)}${tab ? `?tab=${tab}` : ''}`);

  async function confirmPurge() {
    if (!purging) return;
    const name = purging.fullName;
    try {
      await purge.mutateAsync(purging.employeeId);
      setToast(`${name} butunlay o'chirildi`);
      setPurging(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    }
  }

  async function doRestore(a: ArchivedEmployee) {
    try {
      await restore.mutateAsync(a.employeeId);
      setToast(`${a.fullName} qayta ishga tiklandi`);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Tiklab bo'lmadi");
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data!.rows : []), [data]);
  // Yuz skaneri o'chirilgan bo'lsa "Yuzsiz" muammo emas — filtri ham yashirinadi.
  const faceRequired = useAttendanceSettings().data?.faceRequired ?? true;
  const flags = faceRequired ? FLAGS : FLAGS.filter((f) => f.key !== 'noface');
  const kpiSpan = (i: number) => (faceRequired ? KPI_SPANS[i] : undefined);
  const kpiGrid = faceRequired ? 'grid-cols-2 sm:grid-cols-6 xl:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4';
  const activeFlag: FlagFilter = flags.some((f) => f.key === flag) ? flag : 'all';
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Kirill/lotin farqisiz qidiruv ("Ismoilov" ↔ "Исмоилов").
      if (!matchesSearch(query, r.fullName, r.position)) return false;
      return matchesFlag(r, activeFlag);
    });
  }, [rows, query, activeFlag]);

  useEffect(() => {
    setPage(1);
  }, [query, flag, monthValue]);
  // Hudud o'zgarsa yoki ro'yxat yangilansa filtr natijasi qisqaradi — bo'sh sahifada qolmaymiz.
  const shownPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const paged = useMemo(
    () => filtered.slice((shownPage - 1) * PAGE_SIZE, shownPage * PAGE_SIZE),
    [filtered, shownPage],
  );

  const s = data?.summary;
  // Bugungi faollik (hududda vaqt + hisobot) — kartalarda ko'rsatiladi.
  const today = localDay();
  const todayActivity = useActivity(today, today, view === 'active');
  const todayMap = useMemo(
    () => new Map((todayActivity.data?.rows ?? []).map((r) => [r.employeeId, r])),
    [todayActivity.data],
  );
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  // Distinct positions — suggestions for the Lavozim field in the form.
  const positions = useMemo(
    () => [...new Set(rows.map((r) => r.position).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  /** Excel: tanlangan davr; sahifadagi filtr va qidiruv ham qo'llanadi. */
  async function handleExport(range: Range) {
    setExporting(true);
    try {
      const picked = flags.find((f) => f.key === activeFlag);
      const result = await exportActivityWorkbook({
        range,
        filter: {
          query,
          flag:
            picked && picked.key !== 'all'
              ? { label: picked.label, test: (r) => matchesFlag(r, picked.key) }
              : undefined,
        },
      });
      setExportOpen(false);
      setToast(
        result.dailyMissing ? `Excel tayyor — kunlik varaqlarsiz: ${result.dailyMissing}` : 'Excel tayyor',
      );
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Excel'ni tayyorlab bo'lmadi");
    } finally {
      setExporting(false);
    }
  }
  const filterNote = [
    activeFlag !== 'all' ? `filtr «${flags.find((f) => f.key === activeFlag)?.label}»` : '',
    query.trim() ? `qidiruv «${query.trim()}»` : '',
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Har bir xodim: yuz, keldi-ketdi, ish hududi, oylik va premya — nazorat va boshqaruv"
        action={
          canWrite ? (
            <Button onClick={() => setEmpModal({ open: true, row: null })} className="w-full sm:w-auto">
              <Add size={18} /> Xodim qo'shish
            </Button>
          ) : undefined
        }
      />

      {/* Faol | Arxiv */}
      <div className="mb-5 inline-flex rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Xodimlar">
        {(
          [
            ['active', 'Faol xodimlar', data?.summary?.total],
            ['archive', 'Arxiv', archivedQuery.data?.length],
          ] as const
        ).map(([v, label, count]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() =>
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev);
                  if (v === 'archive') next.set('view', 'archive');
                  else next.delete('view');
                  return next;
                },
                { replace: true },
              )
            }
            className={cn(
              'flex items-center gap-2 rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors',
              view === v ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {v === 'archive' ? <ArchiveBook size={16} variant={view === v ? 'Bulk' : 'Linear'} /> : <Profile2User size={16} variant={view === v ? 'Bulk' : 'Linear'} />}
            {label}
            {count != null && (
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-ink-muted">{count}</span>
            )}
          </button>
        ))}
      </div>

      {view === 'archive' ? (
        <ArchiveList
          rows={archivedRows}
          loading={archivedQuery.isLoading}
          failed={archivedQuery.isError && !archivedQuery.data}
          retrying={archivedQuery.isFetching}
          onRetry={() => void archivedQuery.refetch()}
          canWrite={canWrite}
          canPurge={isSuperAdmin}
          restoringId={restore.isPending ? restore.variables : undefined}
          onOpen={(a) => openProfile(a.employeeId)}
          onRestore={doRestore}
          onPurge={setPurging}
        />
      ) : null}

      {/* Fon yangilanishi yiqilsa, yuklangan ro'yxat ekranda qoladi. */}
      {view === 'archive' ? null : isError && !data ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">{error instanceof Error ? error.message : "Noma'lum xatolik"}</p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          {/* KPI — compact tiles: 2 per row on phones (the 5th spans both),
              3 on tablets, 5 on desktop. No more 150px-tall cards on mobile. */}
          {/* 6-col track on tablets: 3 tiles of 2 + 2 tiles of 3 = two full rows. */}
          <FaceScanSetting canWrite={canWrite} onDone={setToast} />

          <div className={cn('grid gap-3', kpiGrid)}>
            {isLoading || !s ? (
              Array.from({ length: faceRequired ? 5 : 4 }).map((_, i) => (
                <Skeleton key={i} className={cn('h-[72px]', kpiSpan(i))} />
              ))
            ) : (
              <>
                <KpiTile icon={Profile2User} label="Jami xodim" value={String(s.total)} tint="#3b82f6" className={kpiSpan(0)} />
                {faceRequired && (
                  <KpiTile icon={ScanBarcode} label="Yuz ro'yxatda" value={`${s.faceEnrolled}/${s.total}`} tint="#8b5cf6" className={kpiSpan(1)} />
                )}
                <KpiTile icon={TickCircle} label="Ish joyida" value={String(s.presentNow)} tint="#10b981" className={kpiSpan(2)} />
                <KpiTile icon={Timer1} label="Kechikkan" value={String(s.lateNow)} tint="#f59e0b" className={kpiSpan(3)} />
                <KpiTile icon={Location} label="Hududdan tashqari" value={String(s.outsideZone)} tint="#ef4444" className={kpiSpan(4)} />
              </>
            )}
          </div>

          {/* Quick filters — one swipeable row on phones, wrapping on wider screens. */}
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {flags.map((f) => {
              const count = f.key === 'all' ? rows.length : rows.filter((r) => matchesFlag(r, f.key)).length;
              const active = activeFlag === f.key;
              const danger = f.key !== 'all' && count > 0;
              return (
                <button
                  key={f.key}
                  onClick={() => setFlag(f.key)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      'rounded-full px-1.5 text-[11px] tabular-nums',
                      active ? 'bg-primary-100 text-primary-700' : danger ? 'bg-danger-soft text-red-600' : 'bg-surface-2 text-ink-muted',
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 sm:flex sm:items-center">
            <div className="relative col-span-2 sm:flex-1">
              <Profile2User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Xodim yoki lavozim bo'yicha qidirish..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
            <MonthPicker value={monthValue} onChange={setMonthValue} className="min-w-0 sm:w-52" />
            <Button variant="secondary" onClick={() => setExportOpen(true)} disabled={isLoading || exporting} title="Excel: faollik, hisobotlar, hudud va ish vaqti">
              {exporting ? <RotateRight size={17} className="animate-spin" /> : <DocumentDownload size={17} />} Excel hisobot
            </Button>
          </div>

          <Card className="mt-5 overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-4 sm:px-5 sm:pt-5">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <ShieldTick size={18} variant="Bulk" className="text-primary-600" /> Xodimlar ro'yxati
                {isFetching && <RotateRight size={14} className="animate-spin text-ink-muted" />}
              </h3>
              <span className="text-xs text-ink-muted">{filtered.length} ta</span>
            </div>
            <div className="mt-3 px-3 pb-2 sm:px-4">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[230px]" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Judge size={40} variant="Bulk" className="text-ink-muted" />
                  {rows.length === 0 ? (
                    <>
                      <p className="mt-3 text-sm font-semibold text-ink">Hali xodim qo'shilmagan</p>
                      {canWrite && (
                        <p className="mt-1 text-[13px] text-ink-muted">«Xodim qo'shish» tugmasi orqali birinchi xodimni kiriting.</p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-3 text-sm text-ink-soft">Filtr yoki qidiruv bo'yicha xodim topilmadi</p>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        onClick={() => {
                          setQuery('');
                          setFlag('all');
                        }}
                      >
                        Filtrni tozalash
                      </Button>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {paged.map((r) => (
                    <OversightCard
                      key={r.employeeId}
                      row={r}
                      today={todayMap.get(r.employeeId)}
                      faceRequired={faceRequired}
                      onAssign={canWrite ? () => setAssigning(r) : undefined}
                      onDetail={() => openProfile(r.employeeId)}
                      onHours={() => openProfile(r.employeeId, 'zone')}
                      onReports={() => openProfile(r.employeeId, 'reports')}
                      onEdit={canWrite ? () => setEmpModal({ open: true, row: r }) : undefined}
                      onDelete={canWrite ? () => setArchiving({ id: r.employeeId, fullName: r.fullName }) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
            {!isLoading && (
              <Pagination page={shownPage} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} className="border-t border-line" />
            )}
          </Card>

          {s && (
            <p className="mt-3 text-center text-xs text-ink-muted">
              Jami oylik fondi (sof): <span className="font-semibold text-ink-soft">{formatSomShort(s.salaryTotalNet)}</span>
            </p>
          )}
        </>
      )}

      <AssignZonesModal row={assigning} onClose={() => setAssigning(null)} onDone={setToast} />
      <ExportPeriodModal
        open={exportOpen}
        pageMonth={`${year}-${String(month).padStart(2, '0')}`}
        filterNote={filterNote ? `Excel'ga qo'llanadi: ${filterNote}.` : undefined}
        busy={exporting}
        onClose={() => (exporting ? undefined : setExportOpen(false))}
        onExport={(range) => void handleExport(range)}
      />
      <EmployeeFormModal
        open={empModal.open}
        row={empModal.row}
        positions={positions}
        year={year}
        month={month}
        onClose={() => setEmpModal({ open: false, row: null })}
        onDone={(msg) => setToast(msg)}
      />
      <ArchiveEmployeeDialog
        employee={archiving}
        onClose={() => setArchiving(null)}
        onDone={(msg) => setToast(msg)}
      />
      <ConfirmDialog
        open={!!purging}
        onClose={() => (purge.isPending ? undefined : setPurging(null))}
        onConfirm={confirmPurge}
        tone="danger"
        icon={Trash}
        title="Butunlay o'chirish"
        message={
          <>
            <span className="font-semibold text-ink">{purging?.fullName}</span> davomat, lokatsiya va yuz
            ma'lumotlari bilan birga o'chiriladi. Murojaatlari qoladi (mas'ulsiz). Bu amalni ortga qaytarib bo'lmaydi.
          </>
        }
        confirmLabel="Butunlay o'chirish"
        loading={purge.isPending}
      />
      {toast && (
        // z-[70]: above modals (z-50) — a toast fired while a modal is still
        // closing used to render underneath its backdrop.
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-surface shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function OversightCard({
  row,
  today,
  faceRequired,
  onAssign,
  onDetail,
  onHours,
  onReports,
  onEdit,
  onDelete,
}: {
  row: OversightRow;
  /** Bugungi faollik (yuklanmagan bo'lsa undefined). */
  today?: ActivityRow;
  faceRequired: boolean;
  /** Berilmasa (VIEWER) hudud faqat ko'rsatiladi. */
  onAssign?: () => void;
  onDetail: () => void;
  /** Profilning "Hudud vaqti" bo'limi. */
  onHours: () => void;
  /** Profilning "Hisobotlar" bo'limi. */
  onReports: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const att = attMeta(row.attendance.status);
  const loc = row.location;
  const assignedCount = (row.assignedMahallaCodes ?? []).length;
  const territory = territoryOf(loc.insideAssignedZone, loc.insideOffice);
  const zoneChip = (
    <>
      {!loc.hasLocation ? (
        <span
          className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12.5px] text-ink-muted"
          title="Mobil ilova o'rnatilmagan yoki lokatsiya hali yuborilmagan"
        >
          <Location size={14} variant="Outline" className="shrink-0" /> Lokatsiya yo'q
        </span>
      ) : (
        <span
          className={cn(
            'inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium',
            territory === 'zone' ? 'text-emerald-600' : territory === 'office' ? 'text-sky-600' : 'text-red-500',
          )}
          title={loc.mahallaName ?? undefined}
        >
          <Location size={14} variant="Bulk" className="shrink-0" /> {TERRITORY_LABEL[territory]}
          {territory !== 'outside' && loc.isStale ? ' (eski)' : ''}
        </span>
      )}
      <span
        className="shrink-0 whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-muted"
      >
        {assignedCount ? `${assignedCount} mahalla` : 'butun tuman'}
      </span>
    </>
  );
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-shadow hover:shadow-card sm:p-4">
      {/* Avatar + ism (bosilsa — o'ng drawer) + amallar */}
      <div className="flex items-start gap-3">
        <button
          onClick={onDetail}
          title="Profil — davomat, murojaatlar, oylik"
          className="group flex min-w-0 flex-1 items-start gap-3 text-left"
        >
          <Avatar name={row.fullName} src={row.avatarUrl ?? undefined} size={44} />
          <div className="min-w-0 pt-0.5">
            {/* Full name on up to 2 lines — never "Akmal Kari…" */}
            <div className="line-clamp-2 break-words text-[14.5px] font-semibold leading-snug text-ink group-hover:text-primary-700">
              {row.fullName}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-ink-muted">
              {row.position}
              {row.username && <span className="text-ink-muted/80"> · @{row.username}</span>}
            </div>
          </div>
        </button>
        {(onEdit || onDelete) && (
          <div className="-mr-1 -mt-1 flex shrink-0 items-center">
            {onEdit && <RowAction icon={Edit2} label="Tahrirlash" onClick={onEdit} />}
            {onDelete && <RowAction icon={UserRemove} label="Ishdan bo'shatish" onClick={onDelete} danger />}
          </div>
        )}
      </div>

      {/* Yuz + davomat holati */}
      <div className="flex flex-wrap items-center gap-2">
        {row.hasFace ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11.5px] font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
            <ScanBarcode size={13} variant="Bulk" /> Yuz bor
          </span>
        ) : faceRequired ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11.5px] text-ink-muted">
            <CloseCircle size={13} variant="Bulk" /> Yuzsiz
          </span>
        ) : null}
        <Badge tone={att.tone} dot className="tabular-nums">
          {att.label}
          {row.attendance.checkInAt
            ? ` · ${hhmm(row.attendance.checkInAt)}${row.attendance.checkOutAt ? ` – ${hhmm(row.attendance.checkOutAt)}` : ''}`
            : ''}
        </Badge>
      </div>

      {/* Bugun: hududda qancha vaqt + hisobot topshirdimi */}
      {today && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft">
          <span className="inline-flex items-center gap-1" title="Bugun biriktirilgan hududda bo'lgan vaqt (lokatsiya bo'yicha)">
            <Timer1 size={13} className="text-emerald-600" />
            Bugun hududda: <span className="font-semibold tabular-nums text-ink">{durationText(today.zoneMinutes)}</span>
          </span>
          {(today.officeMinutes ?? 0) > 0 && (
            <span className="inline-flex items-center gap-1" title="Bugun hududdan tashqarida, lekin ofisda bo'lgan vaqt">
              <Building size={13} className="text-sky-600" />
              Ofisda: <span className="font-semibold tabular-nums text-ink">{durationText(today.officeMinutes!)}</span>
            </span>
          )}
          <span
            className={cn('inline-flex items-center gap-1', today.reportCount > 0 ? 'text-emerald-600' : 'text-ink-muted')}
            title="Bugungi kunlik hisobot"
          >
            <DocumentText1 size={13} variant={today.reportCount > 0 ? 'Bulk' : 'Linear'} />
            {today.reportCount > 0 ? `Hisobot: ${today.reportCount} ta` : "Hisobot yo'q"}
          </span>
        </div>
      )}

      {/* Hudud (biriktirish) + oylik/premya */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 py-1">{zoneChip}</div>
        <div className="shrink-0 text-right tabular-nums">
          <div className="whitespace-nowrap text-[13.5px] font-semibold text-primary-600">
            {row.salaryNet != null ? formatSom(row.salaryNet) : <span className="font-normal text-ink-muted">Oylik yo'q</span>}
          </div>
          {row.premyaThisMonth > 0 && (
            <div className="whitespace-nowrap text-[11px] font-medium text-emerald-600">+{formatSom(row.premyaThisMonth)} premya</div>
          )}
        </div>
      </div>

      {/* Asosiy amallar — yozuvli tugmalar, qidirib topish shart emas. */}
      <div className="flex flex-col gap-2">
        {onAssign && (
          <Button size="sm" onClick={onAssign} className="w-full">
            <Location size={15} /> {assignedCount ? "Mahallalarni o'zgartirish" : 'Mahalla biriktirish'}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={onHours}>
            <Timer1 size={15} /> Hudud vaqti
          </Button>
          <Button variant="secondary" size="sm" onClick={onReports}>
            <DocumentText1 size={15} /> Hisobotlar
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Yuz skaneri (Face ID) — butun tizim uchun bitta kalit. O'chirilsa keldi/ketdi
 * faqat joy bo'yicha (ofis radiusi yoki biriktirilgan mahalla) qabul qilinadi,
 * mobil ilova kamerani ochmaydi. VIEWER faqat ko'radi.
 */
function FaceScanSetting({ canWrite, onDone }: { canWrite: boolean; onDone: (msg: string) => void }) {
  const { data, isLoading, isError, refetch, isFetching } = useAttendanceSettings();
  const update = useUpdateAttendanceSettings();
  const on = data?.faceRequired ?? true;

  async function toggle(next: boolean) {
    try {
      await update.mutateAsync({ faceRequired: next });
      onDone(next ? 'Yuz skaneri yoqildi' : "Yuz skaneri o'chirildi — davomat faqat joy bo'yicha");
    } catch (err) {
      onDone(err instanceof Error ? err.message : "O'zgartirib bo'lmadi");
    }
  }

  if (isError && !data) {
    return (
      <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-200 bg-danger-soft p-3.5 sm:p-4">
        <CloseCircle size={20} variant="Bulk" className="shrink-0 text-danger" />
        <p className="min-w-0 flex-1 text-[13px] font-medium text-red-700">
          Yuz skaneri sozlamasini yuklab bo'lmadi
        </p>
        <Button variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
          <RotateRight size={16} className={cn(isFetching && 'animate-spin')} /> Qayta urinish
        </Button>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'mb-4 flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4',
        on ? 'border-line bg-surface' : 'border-amber-200 bg-warning-soft',
      )}
    >
      <span
        className={cn(
          'grid h-10 w-10 shrink-0 place-items-center rounded-xl',
          on
            ? 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20',
        )}
      >
        <ScanBarcode size={20} variant="Bulk" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-ink">
          Yuz skaneri (Face ID): {isLoading ? '…' : on ? 'majburiy' : "o'chirilgan"}
        </div>
        <div className="text-[12px] leading-snug text-ink-muted">
          {on
            ? 'Keldi/ketdi uchun yuz mos kelishi va joy to‘g‘ri bo‘lishi shart.'
            : 'Keldi/ketdi faqat joylashuv bo‘yicha qabul qilinadi — ilova kamerani ochmaydi.'}
        </div>
      </div>
      {update.isPending && <RotateRight size={16} className="shrink-0 animate-spin text-ink-muted" />}
      <span className="flex shrink-0" title={canWrite ? undefined : "O'zgartirish huquqi yo'q"}>
        <Switch
          label="Yuz skaneri (Face ID) majburiy"
          checked={on}
          onChange={(v) => void toggle(v)}
          disabled={!canWrite || isLoading || update.isPending}
        />
      </span>
    </div>
  );
}

/** Compact KPI tile: icon + value + label in one row (~72px tall). */
function KpiTile({
  icon: Icon,
  label,
  value,
  tint,
  className,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  tint: string;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card sm:p-4', className)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${tint}1a`, color: tint }}>
        <Icon size={20} variant="Bulk" color={tint} />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-bold leading-tight tabular-nums text-ink">{value}</div>
        <div className="text-[12px] leading-tight text-ink-muted">{label}</div>
      </div>
    </div>
  );
}

/** Kichik doira-tugma — Xodimlar boshqaruvi jadvalidagi amallar uchun. */
function RowAction({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Eye;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        'grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition-colors',
        danger ? 'hover:bg-danger-soft hover:text-danger' : 'hover:bg-primary-50 hover:text-primary-600',
      )}
    >
      <Icon size={17} variant="Linear" />
    </button>
  );
}

/** Ishdan bo'shatilganlar: kim, qachon, nega — tiklash yoki butunlay o'chirish. */
function ArchiveList({
  rows,
  loading,
  failed,
  retrying,
  onRetry,
  canWrite,
  canPurge,
  restoringId,
  onOpen,
  onRestore,
  onPurge,
}: {
  rows: ArchivedEmployee[];
  loading: boolean;
  failed: boolean;
  retrying: boolean;
  onRetry: () => void;
  canWrite: boolean;
  canPurge: boolean;
  restoringId?: string;
  onOpen: (a: ArchivedEmployee) => void;
  onRestore: (a: ArchivedEmployee) => void;
  onPurge: (a: ArchivedEmployee) => void;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px]" />
        ))}
      </div>
    );
  }
  if (failed) {
    return (
      <Card className="flex flex-col items-center gap-3 p-14 text-center">
        <CloseCircle size={40} variant="Bulk" className="text-danger" />
        <p className="font-semibold text-ink">Arxivni yuklab bo'lmadi</p>
        <Button variant="secondary" onClick={onRetry} disabled={retrying}>
          <RotateRight size={16} className={cn(retrying && 'animate-spin')} /> Qayta urinish
        </Button>
      </Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-14 text-center">
        <ArchiveBook size={40} variant="Bulk" className="text-ink-muted" />
        <p className="font-semibold text-ink">Arxiv bo'sh</p>
        <p className="max-w-sm text-sm text-ink-muted">
          Ishdan bo'shatilgan xodimlar shu yerda saqlanadi — tarixi o'chmaydi, istalgan vaqtda qayta tiklash mumkin.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((a) => (
        <div key={a.employeeId} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
          <button onClick={() => onOpen(a)} className="group flex min-w-0 items-start gap-3 text-left">
            <span className="grayscale">
              <Avatar name={a.fullName} src={a.avatarUrl ?? undefined} size={44} />
            </span>
            <span className="min-w-0">
              <span className="line-clamp-2 text-[14.5px] font-semibold text-ink group-hover:text-primary-700">{a.fullName}</span>
              <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                {a.position}
                {a.department ? ` · ${a.department}` : ''}
              </span>
            </span>
          </button>
          <div className="rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-ink-soft">
            <span className="font-medium text-ink">{new Date(a.archivedAt).toLocaleDateString('uz-UZ')}</span> da ishdan
            bo'shatilgan
            {a.archiveReason && <span className="mt-0.5 block text-ink-muted">Sabab: {a.archiveReason}</span>}
          </div>
          {(canWrite || canPurge) && (
            <div className="mt-auto flex gap-2">
              {canWrite && (
                <Button variant="secondary" className="flex-1" onClick={() => onRestore(a)} disabled={restoringId === a.employeeId}>
                  {restoringId === a.employeeId ? <RotateRight size={16} className="animate-spin" /> : <Refresh2 size={16} />}
                  Tiklash
                </Button>
              )}
              {canPurge && (
                <Button variant="ghost" onClick={() => onPurge(a)} aria-label={`${a.fullName} — butunlay o'chirish`} title="Butunlay o'chirish">
                  <Trash size={16} className="text-danger" />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
