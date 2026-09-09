import { useMemo, useState, useEffect } from 'react';
import {
  CloseCircle,
  DocumentDownload,
  Edit2,
  Moneys,
  Profile2User,
  RotateRight,
  TickCircle,
  Trash,
  Wallet3,
  WalletMoney,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { MonthPicker } from '@/shared/ui/MonthPicker';
import { Pagination } from '@/shared/ui/Pagination';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { formatSom, formatSomShort } from '@/shared/lib/format';
import { exportToExcel, type ExportColumn } from '@/shared/lib/export';
import { cn } from '@/shared/lib/cn';
import { usePermissions } from '@/shared/lib/permissions';
import { useSalaries, type SalaryRosterRow } from './useSalaries';
import { useUpsertSalary, useDeleteSalary, type UpsertSalaryInput } from './useSalaryMutations';
import { SalaryFormModal } from './SalaryFormModal';
import { SalaryHistoryDrawer } from './SalaryHistoryDrawer';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function SalariesPage() {
  const [monthValue, setMonthValue] = useState(currentMonthValue());
  const [y, m] = monthValue.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const month = m || new Date().getMonth() + 1;

  const { data, isLoading, isError, error, refetch } = useSalaries(year, month);
  // Salary is sensitive (like Finance): everyone operational can VIEW the roster,
  // but only SUPER_ADMIN may set/edit/delete — matches the backend SuperAdminGuard.
  const { isSuperAdmin } = usePermissions();

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'assigned' | 'unassigned'>('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;
  const [editing, setEditing] = useState<SalaryRosterRow | null>(null);
  const [deleting, setDeleting] = useState<SalaryRosterRow | null>(null);
  const [history, setHistory] = useState<SalaryRosterRow | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const upsert = useUpsertSalary();
  const remove = useDeleteSalary();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data!.rows : []), [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.fullName.toLowerCase().includes(q) && !r.position.toLowerCase().includes(q)) return false;
      if (statusFilter === 'assigned' && !r.salary) return false;
      if (statusFilter === 'unassigned' && r.salary) return false;
      return true;
    });
  }, [rows, query, statusFilter]);

  // Reset to page 1 whenever the result set changes.
  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, monthValue]);
  const paged = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);

  const stats = useMemo(() => {
    const total = rows.length;
    const assigned = rows.filter((r) => r.salary).length;
    const totalNet = data?.totalNet ?? 0;
    return { total, assigned, unassigned: total - assigned, totalNet };
  }, [rows, data]);

  async function handleSubmit(input: UpsertSalaryInput) {
    await upsert.mutateAsync(input);
    setToast({ tone: 'success', msg: 'Oylik saqlandi' });
  }

  const MONTH_NAMES = [
    'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
    'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
  ];

  function handleExport() {
    const sum = (pick: (r: SalaryRosterRow) => number) => (rs: SalaryRosterRow[]) =>
      formatSom(rs.reduce((acc, r) => acc + pick(r), 0));
    const cols: ExportColumn<SalaryRosterRow>[] = [
      { header: 'F.I.Sh.', value: (r) => r.fullName, total: () => 'JAMI' },
      { header: 'Lavozim', value: (r) => r.position },
      { header: "Asosiy (so'm)", value: (r) => r.salary?.amount ?? 0, align: 'right', total: sum((r) => r.salary?.amount ?? 0) },
      { header: 'Ustama', value: (r) => r.salary?.bonus ?? 0, align: 'right', total: sum((r) => r.salary?.bonus ?? 0) },
      { header: 'Ushlanma', value: (r) => r.salary?.penalty ?? 0, align: 'right', total: sum((r) => r.salary?.penalty ?? 0) },
      { header: "Sof to'lov", value: (r) => r.salary?.net ?? 0, align: 'right', total: sum((r) => r.salary?.net ?? 0) },
      { header: 'Holat', value: (r) => (r.salary ? 'Belgilangan' : 'Belgilanmagan') },
    ];
    exportToExcel(`oyliklar_${year}-${String(month).padStart(2, '0')}`, cols, filtered, {
      title: `Oyliklar — ${MONTH_NAMES[month - 1]} ${year}`,
      subtitle: "Mirzo Ulug'bek tumani hokimligi",
      sheet: 'Oyliklar',
    });
  }

  async function confirmDelete() {
    if (!deleting?.salary) return;
    const name = deleting.fullName;
    try {
      await remove.mutateAsync(deleting.salary.id);
      setDeleting(null);
      setToast({ tone: 'success', msg: `${name} oyligi o'chirildi` });
    } catch (err) {
      setToast({ tone: 'error', msg: err instanceof Error ? err.message : "O'chirib bo'lmadi" });
    }
  }

  return (
    <div>
      <PageHeader title="Oyliklar" subtitle="Xodimlarning oylik maoshi — har oy uchun belgilash va tahrirlash" />

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
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
            ) : (
              <>
                <StatCard icon={Profile2User} label="Jami xodim" value={String(stats.total)} tint="#3b82f6" index={0} />
                <StatCard icon={TickCircle} label="Oylik belgilangan" value={String(stats.assigned)} tint="#10b981" index={1} />
                <StatCard icon={CloseCircle} label="Belgilanmagan" value={String(stats.unassigned)} tint="#f59e0b" index={2} />
                <StatCard icon={Moneys} label="Jami fond (sof)" value={formatSomShort(stats.totalNet)} tint="#a855f7" index={3} />
              </>
            )}
          </div>

          {/* Status filter chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {([
              ['all', 'Barchasi', stats.total],
              ['assigned', 'Belgilangan', stats.assigned],
              ['unassigned', 'Belgilanmagan', stats.unassigned],
            ] as const).map(([key, label, count]) => {
              const active = statusFilter === key;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    active ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  {label}
                  <span className={cn('rounded-full px-1.5 text-[11px] tabular-nums', active ? 'bg-primary-100 text-primary-700' : 'bg-surface-2 text-ink-muted')}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Filters + month picker */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Profile2User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Xodim yoki lavozim bo'yicha qidirish..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
            <MonthPicker value={monthValue} onChange={setMonthValue} className="sm:w-52" />
            <Button
              variant="secondary"
              onClick={handleExport}
              disabled={isLoading || filtered.length === 0}
              title="Tanlangan oy jadvalini Excel'ga chiqarish"
            >
              <DocumentDownload size={17} /> Excel
            </Button>
          </div>

          <Card className="mt-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-[15px] font-semibold text-ink">Oylik jadvali</h3>
              <span className="text-xs text-ink-muted">{filtered.length} ta xodim</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-210 text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="px-5 py-3 font-semibold">Xodim</th>
                    <th className="px-3 py-3 font-semibold">Asosiy</th>
                    <th className="px-3 py-3 font-semibold">Ustama</th>
                    <th className="px-3 py-3 font-semibold">Ushlanma</th>
                    <th className="px-3 py-3 font-semibold">Sof to'lov</th>
                    <th className="px-3 py-3 font-semibold">Holat</th>
                    <th className="px-5 py-3 text-right font-semibold">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <tr key={i} className="border-b border-line/70">
                          <td className="px-5 py-3.5" colSpan={7}>
                            <Skeleton className="h-9" />
                          </td>
                        </tr>
                      ))
                    : paged.map((r) => (
                        <SalaryRow
                          key={r.employeeId}
                          row={r}
                          canWrite={isSuperAdmin}
                          onEdit={() => setEditing(r)}
                          onDelete={() => setDeleting(r)}
                          onHistory={() => setHistory(r)}
                        />
                      ))}
                </tbody>
                {!isLoading && filtered.length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-line bg-surface-2 text-[13px] font-bold">
                      <td className="px-5 py-3 text-ink">Jami ({filtered.length})</td>
                      <td className="px-3 py-3 tabular-nums text-ink">{formatSom(filtered.reduce((a, r) => a + (r.salary?.amount ?? 0), 0))}</td>
                      <td className="px-3 py-3 tabular-nums text-emerald-600">{formatSom(filtered.reduce((a, r) => a + (r.salary?.bonus ?? 0), 0))}</td>
                      <td className="px-3 py-3 tabular-nums text-red-500">{formatSom(filtered.reduce((a, r) => a + (r.salary?.penalty ?? 0), 0))}</td>
                      <td className="px-3 py-3 tabular-nums text-primary-600">{formatSom(filtered.reduce((a, r) => a + (r.salary?.net ?? 0), 0))}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <WalletMoney size={40} variant="Bulk" className="text-ink-muted" />
                  <p className="mt-3 text-sm text-ink-soft">Xodim topilmadi</p>
                </div>
              )}
            </div>
            {!isLoading && (
              <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} className="border-t border-line" />
            )}
          </Card>
        </>
      )}

      <SalaryFormModal
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={handleSubmit}
        row={editing}
        year={year}
        month={month}
      />

      <SalaryHistoryDrawer row={history} onClose={() => setHistory(null)} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Oylikni o'chirasizmi?"
        message={
          deleting && (
            <>
              <strong className="text-ink">{deleting.fullName}</strong> uchun ushbu oy oyligi o'chiriladi.
            </>
          )
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={remove.isPending}
      />

      {toast && (
        <div
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className="fixed inset-x-0 bottom-5 z-[60] flex justify-center px-4"
        >
          <div
            className={cn(
              'rounded-xl border px-4 py-3 text-sm font-medium shadow-pop',
              toast.tone === 'success'
                ? 'border-primary-200 bg-surface text-primary-700'
                : 'border-red-200 bg-danger-soft text-red-700',
            )}
          >
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

function SalaryRow({
  row,
  canWrite,
  onEdit,
  onDelete,
  onHistory,
}: {
  row: SalaryRosterRow;
  canWrite: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}) {
  const s = row.salary;
  return (
    <tr className="border-b border-line/70 transition-colors hover:bg-surface-2">
      <td className="px-5 py-3">
        <button
          onClick={onHistory}
          title="Oylik tarixini ko'rish"
          className="flex items-center gap-3 rounded-lg text-left transition-opacity hover:opacity-80"
        >
          <Avatar name={row.fullName} src={row.avatarUrl ?? undefined} size={36} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink underline decoration-line decoration-dotted underline-offset-2">
              {row.fullName}
            </div>
            <div className="truncate text-[12px] text-ink-muted">{row.position}</div>
          </div>
        </button>
      </td>
      <td className="px-3 py-3 tabular-nums text-ink-soft">{s ? formatSom(s.amount) : '—'}</td>
      <td className="px-3 py-3 tabular-nums text-emerald-600">{s && s.bonus ? `+${formatSom(s.bonus)}` : '—'}</td>
      <td className="px-3 py-3 tabular-nums text-red-500">{s && s.penalty ? `−${formatSom(s.penalty)}` : '—'}</td>
      <td className="px-3 py-3 font-semibold tabular-nums text-primary-600">{s ? formatSom(s.net) : '—'}</td>
      <td className="px-3 py-3">
        {s ? <Badge tone="success" dot>Belgilangan</Badge> : <Badge tone="warning" dot>Belgilanmagan</Badge>}
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end gap-1">
          {canWrite ? (
            <>
              <button
                onClick={onEdit}
                title={s ? 'Tahrirlash' : 'Belgilash'}
                className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
              >
                {s ? <Edit2 size={16} /> : <Wallet3 size={16} />} {s ? 'Tahrir' : 'Belgilash'}
              </button>
              {s && (
                <button
                  onClick={onDelete}
                  title="O'chirish"
                  aria-label={`${row.fullName} oyligini o'chirish`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-danger-soft hover:text-red-600"
                >
                  <Trash size={17} />
                </button>
              )}
            </>
          ) : (
            <span className="text-xs text-ink-muted">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}
