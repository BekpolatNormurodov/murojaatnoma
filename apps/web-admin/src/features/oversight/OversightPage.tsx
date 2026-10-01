import { useEffect, useMemo, useState } from 'react';
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
import { exportWorkbook, type ExportColumn } from '@/shared/lib/export';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { usePermissions } from '@/shared/lib/permissions';
import { useOversight, type OversightRow } from './useOversight';
import { AssignZonesModal } from './AssignZonesModal';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeStatsDrawer } from './EmployeeStatsDrawer';
import { useDeleteEmployee } from './useEmployeeMutations';

const MONTH_NAMES = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

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

const ATT_META: Record<OversightRow['attendance']['status'], { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  present: { label: 'Ish joyida', tone: 'success' },
  late: { label: 'Kechikkan', tone: 'warning' },
  left: { label: 'Chiqib ketgan', tone: 'neutral' },
  absent: { label: 'Kelmagan', tone: 'danger' },
};

type FlagFilter = 'all' | 'absent' | 'late' | 'outside' | 'noface';

/** Does a row match the active quick-filter (problem categories for oversight)? */
function matchesFlag(r: OversightRow, f: FlagFilter): boolean {
  switch (f) {
    case 'absent':
      return r.attendance.status === 'absent';
    case 'late':
      return r.attendance.status === 'late';
    case 'outside':
      return r.location.hasLocation && !r.location.insideAssignedZone;
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

/** Grid spans for the 5 KPI tiles: phone 2+2+1(wide), tablet 3+2, desktop 5. */
const KPI_SPANS = [
  'sm:col-span-2 lg:col-span-1',
  'sm:col-span-2 lg:col-span-1',
  'sm:col-span-2 lg:col-span-1',
  'sm:col-span-3 lg:col-span-1',
  'col-span-2 sm:col-span-3 lg:col-span-1',
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
  const [detail, setDetail] = useState<OversightRow | null>(null);
  const [deleting, setDeleting] = useState<OversightRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { isSuperAdmin } = usePermissions();
  const del = useDeleteEmployee();

  async function confirmDelete() {
    if (!deleting) return;
    const name = deleting.fullName;
    try {
      await del.mutateAsync(deleting.employeeId);
      setToast(`${name} o'chirildi`);
      setDeleting(null);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "O'chirib bo'lmadi");
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data!.rows : []), [data]);
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      // Kirill/lotin farqisiz qidiruv ("Ismoilov" ↔ "Исмоилов").
      if (!matchesSearch(query, r.fullName, r.position)) return false;
      return matchesFlag(r, flag);
    });
  }, [rows, query, flag]);

  useEffect(() => {
    setPage(1);
  }, [query, flag, monthValue]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const s = data?.summary;
  // Distinct positions — suggestions for the Lavozim field in the form.
  const positions = useMemo(
    () => [...new Set(rows.map((r) => r.position).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  function handleExport() {
    const cols: ExportColumn<OversightRow>[] = [
      { header: 'F.I.Sh.', value: (r) => r.fullName },
      { header: 'Lavozim', value: (r) => r.position },
      { header: 'Yuz', value: (r) => (r.hasFace ? "Ro'yxatdan o'tgan" : "Yo'q") },
      { header: 'Holat', value: (r) => ATT_META[r.attendance.status].label },
      { header: 'Keldi', value: (r) => hhmm(r.attendance.checkInAt) },
      { header: 'Ketdi', value: (r) => hhmm(r.attendance.checkOutAt) },
      { header: 'Bugun (soat)', value: (r) => (r.attendance.hoursWorked != null ? r.attendance.hoursWorked.toFixed(1) : '—'), align: 'right' },
      { header: 'Bu oy (soat)', value: (r) => r.attendance.monthHours.toFixed(1), align: 'right' },
      {
        header: 'Hudud',
        value: (r) => (!r.location.hasLocation ? "Ma'lumot yo'q" : r.location.insideAssignedZone ? 'Hududda' : 'Tashqarida'),
      },
      { header: 'Mahalla', value: (r) => r.location.mahallaName ?? '—' },
      { header: "Oylik (sof, so'm)", value: (r) => r.salaryNet ?? 0, align: 'right', total: (rs) => formatSom(rs.reduce((a, r) => a + (r.salaryNet ?? 0), 0)) },
      { header: "Premya (so'm)", value: (r) => r.premyaThisMonth, align: 'right', total: (rs) => formatSom(rs.reduce((a, r) => a + r.premyaThisMonth, 0)) },
    ];
    const summaryRows = s
      ? [
          { k: 'Jami xodim', v: s.total },
          { k: "Yuz ro'yxatdan o'tgan", v: `${s.faceEnrolled}/${s.total}` },
          { k: 'Hozir ish joyida', v: s.presentNow },
          { k: 'Kechikkan', v: s.lateNow },
          { k: 'Hududdan tashqarida', v: s.outsideZone },
          { k: "Jami oylik fondi (sof, so'm)", v: s.salaryTotalNet },
        ]
      : [];
    const sumCols: ExportColumn<{ k: string; v: string | number }>[] = [
      { header: "Ko'rsatkich", value: (r) => r.k },
      { header: 'Qiymat', value: (r) => r.v, align: 'right' },
    ];
    const label = `${MONTH_NAMES[month - 1]} ${year}`;
    exportWorkbook(`xodimlar_boshqaruvi_${year}-${String(month).padStart(2, '0')}`, [
      {
        name: 'Umumiy',
        columns: sumCols,
        rows: summaryRows,
        opts: { title: `Xodimlar boshqaruvi — ${label}`, subtitle: "Mirzo Ulug'bek tumani hokimligi" },
      },
      {
        name: 'Xodimlar',
        columns: cols,
        rows: filtered,
        opts: { title: `Xodimlar ro'yxati — ${label}`, subtitle: `${filtered.length} ta xodim` },
      },
    ]);
  }

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Har bir xodim: yuz, keldi-ketdi, ish hududi, oylik va premya — nazorat va boshqaruv"
        action={
          isSuperAdmin ? (
            <Button onClick={() => setEmpModal({ open: true, row: null })} className="w-full sm:w-auto">
              <Add size={18} /> Xodim qo'shish
            </Button>
          ) : undefined
        }
      />

      {isError ? (
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 lg:grid-cols-5">
            {isLoading || !s ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className={cn('h-[72px]', KPI_SPANS[i])} />
              ))
            ) : (
              <>
                <KpiTile icon={Profile2User} label="Jami xodim" value={String(s.total)} tint="#3b82f6" className={KPI_SPANS[0]} />
                <KpiTile icon={ScanBarcode} label="Yuz ro'yxatda" value={`${s.faceEnrolled}/${s.total}`} tint="#8b5cf6" className={KPI_SPANS[1]} />
                <KpiTile icon={TickCircle} label="Ish joyida" value={String(s.presentNow)} tint="#10b981" className={KPI_SPANS[2]} />
                <KpiTile icon={Timer1} label="Kechikkan" value={String(s.lateNow)} tint="#f59e0b" className={KPI_SPANS[3]} />
                <KpiTile icon={Location} label="Hududdan tashqari" value={String(s.outsideZone)} tint="#ef4444" className={KPI_SPANS[4]} />
              </>
            )}
          </div>

          {/* Quick filters — one swipeable row on phones, wrapping on wider screens. */}
          <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0 [&::-webkit-scrollbar]:hidden">
            {FLAGS.map((f) => {
              const count = f.key === 'all' ? rows.length : rows.filter((r) => matchesFlag(r, f.key)).length;
              const active = flag === f.key;
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
            <Button variant="secondary" onClick={handleExport} disabled={isLoading || filtered.length === 0} title="Excel'ga chiqarish">
              <DocumentDownload size={17} /> Excel
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
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[142px]" />)}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Judge size={40} variant="Bulk" className="text-ink-muted" />
                  <p className="mt-3 text-sm text-ink-soft">Xodim topilmadi</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {paged.map((r) => (
                    <OversightCard
                      key={r.employeeId}
                      row={r}
                      onAssign={() => setAssigning(r)}
                      onDetail={() => setDetail(r)}
                      onEdit={isSuperAdmin ? () => setEmpModal({ open: true, row: r }) : undefined}
                      onDelete={isSuperAdmin ? () => setDeleting(r) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
            {!isLoading && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} className="border-t border-line" />
            )}
          </Card>

          {s && (
            <p className="mt-3 text-center text-xs text-ink-muted">
              Jami oylik fondi (sof): <span className="font-semibold text-ink-soft">{formatSomShort(s.salaryTotalNet)}</span>
            </p>
          )}
        </>
      )}

      <AssignZonesModal row={assigning} onClose={() => setAssigning(null)} />
      <EmployeeFormModal
        open={empModal.open}
        row={empModal.row}
        positions={positions}
        year={year}
        month={month}
        onClose={() => setEmpModal({ open: false, row: null })}
        onDone={(msg) => setToast(msg)}
      />
      <EmployeeStatsDrawer
        employeeId={detail?.employeeId ?? null}
        fullName={detail?.fullName}
        position={detail?.position}
        avatarUrl={detail?.avatarUrl}
        onClose={() => setDetail(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        onClose={() => (del.isPending ? undefined : setDeleting(null))}
        onConfirm={confirmDelete}
        tone="danger"
        icon={Trash}
        title="Xodimni o'chirish"
        message={
          <>
            <span className="font-semibold text-ink">{deleting?.fullName}</span> butunlay o'chiriladi —
            davomat, lokatsiya va oylik tarixi bilan birga. Bu amalni ortga qaytarib bo'lmaydi.
          </>
        }
        confirmLabel="O'chirish"
        loading={del.isPending}
      />
      {toast && (
        // z-[70]: above modals (z-50) — a toast fired while a modal is still
        // closing used to render underneath its backdrop.
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

function OversightCard({
  row,
  onAssign,
  onDetail,
  onEdit,
  onDelete,
}: {
  row: OversightRow;
  onAssign: () => void;
  onDetail: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const att = ATT_META[row.attendance.status];
  const loc = row.location;
  const assignedCount = (row.assignedMahallaCodes ?? []).length;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-3.5 transition-shadow hover:shadow-card sm:p-4">
      {/* Avatar + ism (bosilsa — o'ng drawer) + amallar */}
      <div className="flex items-start gap-3">
        <button
          onClick={onDetail}
          title="Batafsil — davr bo'yicha soat, kechikish va statistika"
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
            {onDelete && <RowAction icon={Trash} label="O'chirish" onClick={onDelete} danger />}
          </div>
        )}
      </div>

      {/* Yuz + davomat holati */}
      <div className="flex flex-wrap items-center gap-2">
        {row.hasFace ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11.5px] font-medium text-emerald-600">
            <ScanBarcode size={13} variant="Bulk" /> Yuz bor
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-2 py-1 text-[11.5px] text-ink-muted">
            <CloseCircle size={13} variant="Bulk" /> Yuzsiz
          </span>
        )}
        <Badge tone={att.tone} dot>
          {att.label}
          {row.attendance.checkInAt ? ` · ${hhmm(row.attendance.checkInAt)}` : ''}
        </Badge>
      </div>

      {/* Hudud (biriktirish) + oylik/premya */}
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-3">
        <button
          onClick={onAssign}
          title={`Hudud biriktirish${assignedCount ? ` (${assignedCount} ta mahalla)` : ' (hozircha butun tuman)'}`}
          className="group flex min-w-0 items-center gap-1.5 rounded-lg py-1 text-left"
        >
          {!loc.hasLocation ? (
            <span
              className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12.5px] text-ink-muted group-hover:text-primary-600"
              title="Mobil ilova o'rnatilmagan yoki lokatsiya hali yuborilmagan"
            >
              <Location size={14} variant="Outline" className="shrink-0" /> Lokatsiya yo'q
            </span>
          ) : loc.insideAssignedZone ? (
            <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-emerald-600" title={loc.mahallaName ?? undefined}>
              <Location size={14} variant="Bulk" className="shrink-0" /> Hududda{loc.isStale ? ' (eski)' : ''}
            </span>
          ) : (
            <span className="inline-flex min-w-0 items-center gap-1 whitespace-nowrap text-[12.5px] font-medium text-red-500" title={loc.mahallaName ?? undefined}>
              <Location size={14} variant="Bulk" className="shrink-0" /> Tashqarida
            </span>
          )}
          <span className="shrink-0 whitespace-nowrap rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] tabular-nums text-ink-muted transition-colors group-hover:bg-primary-50 group-hover:text-primary-600">
            {assignedCount ? `${assignedCount} mahalla` : 'butun tuman'}
          </span>
        </button>
        <div className="shrink-0 text-right tabular-nums">
          <div className="whitespace-nowrap text-[13.5px] font-semibold text-primary-600">
            {row.salaryNet != null ? formatSom(row.salaryNet) : <span className="font-normal text-ink-muted">Oylik yo'q</span>}
          </div>
          {row.premyaThisMonth > 0 && (
            <div className="whitespace-nowrap text-[11px] font-medium text-emerald-600">+{formatSom(row.premyaThisMonth)} premya</div>
          )}
        </div>
      </div>
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
        <div className="truncate text-[12px] text-ink-muted">{label}</div>
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
