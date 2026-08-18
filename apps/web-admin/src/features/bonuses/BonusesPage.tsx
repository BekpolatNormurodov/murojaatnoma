import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Add,
  Calculator,
  CloseCircle,
  MedalStar,
  Moneys,
  Profile2User,
  RotateRight,
  SearchNormal1,
  Trash,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { formatDate, formatSom, formatSomShort } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { usePermissions } from '@/shared/lib/permissions';
import { useBonuses, type Bonus } from './useBonuses';
import { useCreateBonus, useDeleteBonus, type CreateBonusInput } from './useBonusMutations';
import { bonusSource, formatMonthLabel, SOURCE_META } from './meta';
import { BonusFormModal } from './BonusFormModal';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

export function BonusesPage() {
  const [monthFilter, setMonthFilter] = useState('');
  const { data, isLoading, isError, error, refetch } = useBonuses(monthFilter || undefined);
  const bonuses = useMemo(() => data ?? [], [data]);
  const reducedMotion = usePrefersReducedMotion();
  const { canWrite } = usePermissions();

  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Bonus | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const createBonus = useCreateBonus();
  const deleteBonus = useDeleteBonus();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bonuses;
    return bonuses.filter(
      (b) => b.recipientName.toLowerCase().includes(q) || b.reason.toLowerCase().includes(q),
    );
  }, [bonuses, query]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const sum = filtered.reduce((s, b) => s + b.amount, 0);
    const avg = total > 0 ? Math.round(sum / total) : 0;
    const recipients = new Set(filtered.map((b) => b.employeeId ?? b.workerId ?? b.recipientName)).size;
    return { total, sum, avg, recipients };
  }, [filtered]);

  async function handleCreate(input: CreateBonusInput) {
    await createBonus.mutateAsync(input);
    setToast({ tone: 'success', msg: `${input.recipientName} uchun premya yozildi` });
  }

  async function confirmDelete() {
    if (!deleting) return;
    const name = deleting.recipientName;
    try {
      await deleteBonus.mutateAsync(deleting.id);
      setDeleting(null);
      setToast({ tone: 'success', msg: `${name} premyasi o'chirildi` });
    } catch (err) {
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "Premyani o'chirib bo'lmadi",
      });
    }
  }

  const hasAnyData = bonuses.length > 0;

  return (
    <div>
      <PageHeader
        title="Premyalar"
        subtitle="Xodim va ishchilarga berilgan premyalar (bonuslar) tarixi"
        action={
          canWrite && (
            <Button onClick={() => setFormOpen(true)}>
              <Add size={20} /> Premya yozish
            </Button>
          )
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[118px]" />)
            ) : (
              <>
                <StatCard icon={MedalStar} label="Jami premyalar" value={String(stats.total)} tint="#f59e0b" index={0} />
                <StatCard icon={Moneys} label="Jami summa" value={formatSomShort(stats.sum)} tint="#10b981" index={1} />
                <StatCard icon={Calculator} label="O'rtacha premya" value={formatSomShort(stats.avg)} tint="#3b82f6" index={2} />
                <StatCard icon={Profile2User} label="Qabul qiluvchilar" value={String(stats.recipients)} tint="#a855f7" index={3} />
              </>
            )}
          </div>

          {/* Filters */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Qabul qiluvchi yoki sabab bo'yicha qidirish..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                aria-label="Oy bo'yicha filtr"
                className="h-11 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium text-ink outline-none focus:border-primary-300"
              />
              {monthFilter && (
                <button
                  onClick={() => setMonthFilter('')}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2"
                >
                  <CloseCircle size={15} /> Barchasi
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <Card className="mt-5 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5">
              <h3 className="text-[15px] font-semibold text-ink">Premyalar ro'yxati</h3>
              <span className="text-xs text-ink-muted">{filtered.length} ta topildi</span>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-190 text-left text-sm">
                <thead>
                  <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                    <th className="px-5 py-3 font-semibold">Qabul qiluvchi</th>
                    <th className="px-3 py-3 font-semibold">Summa</th>
                    <th className="px-3 py-3 font-semibold">Sabab</th>
                    <th className="px-3 py-3 font-semibold">Oy</th>
                    <th className="px-3 py-3 font-semibold">Sana</th>
                    <th className="px-5 py-3 text-right font-semibold">Amal</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-line/70">
                          <td className="px-5 py-3.5" colSpan={6}>
                            <Skeleton className="h-9" />
                          </td>
                        </tr>
                      ))
                    : filtered.map((b, i) => (
                        <BonusRow
                          key={b.id}
                          bonus={b}
                          index={i}
                          reducedMotion={reducedMotion}
                          onDelete={() => setDeleting(b)}
                        />
                      ))}
                </tbody>
              </table>
              {!isLoading && filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <MedalStar size={40} variant="Bulk" className="text-ink-muted" />
                  <p className="mt-3 text-sm text-ink-soft">
                    {hasAnyData ? 'Mos premya topilmadi' : 'Hozircha premyalar yoʻq'}
                  </p>
                  {canWrite && (
                    <Button className="mt-4" onClick={() => setFormOpen(true)}>
                      <Add size={18} /> Premya yozish
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <BonusFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Premyani o'chirasizmi?"
        message={
          deleting && (
            <>
              <strong className="text-ink">{deleting.recipientName}</strong> uchun{' '}
              <strong className="text-ink">{formatSom(deleting.amount)}</strong> miqdoridagi premya
              butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
            </>
          )
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleteBonus.isPending}
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

function BonusRow({
  bonus,
  index,
  reducedMotion,
  onDelete,
}: {
  bonus: Bonus;
  index: number;
  reducedMotion: boolean;
  onDelete: () => void;
}) {
  const src = bonusSource(bonus);
  const meta = SOURCE_META[src];
  const { canWrite } = usePermissions();
  return (
    <motion.tr
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={reducedMotion ? { duration: 0.12 } : { delay: Math.min(index * 0.025, 0.3) }}
      className="border-b border-line/70 transition-colors hover:bg-surface-2"
    >
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={bonus.recipientName} size={36} />
          <div className="min-w-0">
            <div className="truncate font-medium text-ink">{bonus.recipientName}</div>
            <Badge tone={meta.tone} dot className="mt-0.5">
              {meta.label}
            </Badge>
          </div>
        </div>
      </td>
      <td className="px-3 py-3 font-semibold text-primary-600">{formatSom(bonus.amount)}</td>
      <td className="max-w-70 px-3 py-3 text-ink-soft">
        <span className="line-clamp-2">{bonus.reason}</span>
      </td>
      <td className="px-3 py-3 text-ink-soft">{formatMonthLabel(bonus.month)}</td>
      <td className="px-3 py-3 text-ink-muted">{formatDate(bonus.createdAt)}</td>
      <td className="px-5 py-3">
        <div className="flex items-center justify-end">
          {canWrite && (
            <button
              onClick={onDelete}
              title="O'chirish"
              aria-label={`${bonus.recipientName} premyasini o'chirish`}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-danger-soft hover:text-red-600"
            >
              <Trash size={17} />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}
