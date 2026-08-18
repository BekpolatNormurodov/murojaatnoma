import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Star1,
  Call,
  Location,
  Profile2User,
  TickCircle,
  Medal,
  LoginCurve,
  LogoutCurve,
  SearchNormal1,
  ShieldTick,
  ShieldCross,
  Clock,
  CloseCircle,
  RotateRight,
  Add,
  Trash,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Progress } from '@/shared/ui/Progress';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Select } from '@/shared/ui/Select';
import { DISTRICTS } from '@/shared/data/mock';
import type { Worker, WorkerStatus } from '@/shared/data/types';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { WorkerDetail } from './WorkerDetail';
import { WorkerFormModal } from './WorkerFormModal';
import { useWorkers } from './useWorkers';
import { useCreateWorker, useDeleteWorker, useUpdateWorker } from './useWorkerMutations';
import { workerStatusMeta } from './workerMeta';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

type Filter = 'all' | 'inside' | 'outside' | 'unconfirmed';

const STATUS_OPTIONS: { value: WorkerStatus | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'online', label: 'Onlayn', dot: '#10b981' },
  { value: 'on_task', label: 'Vazifada', dot: '#f59e0b' },
  { value: 'break', label: 'Tanaffus', dot: '#06b6d4' },
  { value: 'offline', label: 'Oflayn', dot: '#94a3b8' },
];

const DISTRICT_FILTER_OPTIONS: { value: string; label: string; dot?: string }[] = [
  { value: 'all', label: 'Barcha tumanlar' },
  ...DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color })),
];

export function WorkersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [districtFilter, setDistrictFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<WorkerStatus | 'all'>('all');
  const [selected, setSelected] = useState<Worker | null>(null);
  const reducedMotion = usePrefersReducedMotion();

  // CRUD holati: yaratish / tahrirlash / o'chirish oynalari + qisqa toast.
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Worker | null>(null);
  const [deleting, setDeleting] = useState<Worker | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const { data, isLoading, isError, error, refetch } = useWorkers();
  const workers = useMemo(() => data ?? [], [data]);

  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker();
  const deleteWorker = useDeleteWorker();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const formOpen = creating || !!editing;
  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  async function handleSubmit(input: Parameters<typeof createWorker.mutateAsync>[0]) {
    if (editing) {
      await updateWorker.mutateAsync({ id: editing.id, ...input });
      setToast({ tone: 'success', msg: 'Ishchi maʼlumotlari yangilandi' });
    } else {
      await createWorker.mutateAsync(input);
      setToast({ tone: 'success', msg: "Yangi ishchi qo'shildi" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const name = deleting.name;
    try {
      await deleteWorker.mutateAsync(deleting.id);
      setDeleting(null);
      setSelected(null);
      setToast({ tone: 'success', msg: `${name} o'chirildi` });
    } catch (err) {
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "Ishchini o'chirib bo'lmadi",
      });
    }
  }

  const totalPoints = workers.reduce((s, w) => s + w.points, 0);
  const avgRating = workers.length
    ? (workers.reduce((s, w) => s + w.rating, 0) / workers.length).toFixed(1)
    : '0.0';
  const checkedIn = workers.filter((w) => w.checkInTime).length;
  const confirmed = workers.filter((w) => w.todayConfirmed).length;
  const insideCount = workers.filter((w) => w.insideRegion).length;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return workers.filter((w) => {
      const matchesQuery =
        !q ||
        w.name.toLowerCase().includes(q) ||
        w.region.toLowerCase().includes(q) ||
        w.position.toLowerCase().includes(q) ||
        w.phone.toLowerCase().includes(q);
      const matchesQuickFilter =
        filter === 'all' ||
        (filter === 'inside' && w.insideRegion) ||
        (filter === 'outside' && !w.insideRegion) ||
        (filter === 'unconfirmed' && !w.todayConfirmed);
      const matchesDistrict = districtFilter === 'all' || w.districtId === districtFilter;
      const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchesQuery && matchesQuickFilter && matchesDistrict && matchesStatus;
    });
  }, [workers, query, filter, districtFilter, statusFilter]);

  const hasActiveFilters =
    query.trim() !== '' || filter !== 'all' || districtFilter !== 'all' || statusFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setFilter('all');
    setDistrictFilter('all');
    setStatusFilter('all');
  }

  const FILTERS: { key: Filter; label: string }[] = [
    { key: 'all', label: 'Barchasi' },
    { key: 'inside', label: 'Hududda' },
    { key: 'outside', label: 'Tashqarida' },
    { key: 'unconfirmed', label: 'Tasdiqlanmagan' },
  ];

  return (
    <div>
      <PageHeader
        title="Ishchilar"
        subtitle="Dala ishchilarini boshqaring — davomat, geofence, reyting va hujjatlar"
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
          >
            <Add size={20} /> Ishchi qo'shish
          </button>
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
          {/* Summary */}
          <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4 xl:grid-cols-7">
            {isLoading
              ? Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
              : [
                  { icon: Profile2User, label: 'Jami', value: formatNumber(workers.length), tint: '#3b82f6' },
                  { icon: TickCircle, label: 'Faol', value: formatNumber(workers.filter((w) => w.status !== 'offline').length), tint: '#10b981' },
                  { icon: LoginCurve, label: 'Ishga keldi', value: `${checkedIn}/${workers.length}`, tint: '#06b6d4' },
                  { icon: ShieldTick, label: 'Hududda', value: `${insideCount}/${workers.length}`, tint: '#22c55e' },
                  { icon: TickCircle, label: 'Tasdiqladi', value: `${confirmed}/${workers.length}`, tint: '#a855f7' },
                  { icon: Star1, label: 'Reyting', value: avgRating, tint: '#f59e0b' },
                  { icon: Medal, label: 'Ballar', value: formatNumber(totalPoints), tint: '#ec4899' },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={reducedMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: reducedMotion ? 0 : i * 0.05 }}
                  >
                    <Card className="p-4">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg"
                        style={{ background: `${s.tint}1a`, color: s.tint }}
                      >
                        <s.icon size={18} variant="Bulk" />
                      </div>
                      <div className="mt-3 truncate text-xl font-bold leading-tight text-ink">{s.value}</div>
                      <div className="mt-0.5 truncate text-[12px] text-ink-muted">{s.label}</div>
                    </Card>
                  </motion.div>
                ))}
          </div>

          {/* Filters + search */}
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  aria-pressed={filter === f.key}
                  className={cn(
                    'min-h-11 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
                    filter === f.key
                      ? 'bg-ink text-white'
                      : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="relative w-full lg:w-72">
              <label htmlFor="workers-search" className="sr-only">
                Ishchilarni qidirish
              </label>
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="workers-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, lavozim, hudud yoki telefon..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
              />
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <Select
                value={districtFilter}
                onChange={setDistrictFilter}
                options={DISTRICT_FILTER_OPTIONS}
                block
              />
            </div>
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} block />
            </div>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <RotateRight size={15} /> Filtrlarni tozalash
              </button>
            )}
          </div>

          {/* Worker cards */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[398px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((w, i) => (
                <motion.button
                  key={w.id}
                initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0 }
                    : { delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }
                }
                onClick={() => setSelected(w)}
                className="text-left"
              >
                <Card className="h-full p-5 transition-shadow hover:shadow-pop">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={w.name} src={w.photo} color={w.avatarColor} size={52} status={w.status} />
                      <div>
                        <h3 className="text-[15px] font-semibold text-ink">{w.name}</h3>
                        <p className="text-[12px] text-ink-muted">{w.position}</p>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          <Location size={12} /> {w.region}
                        </div>
                      </div>
                    </div>
                    <Badge tone={workerStatusMeta(w.status).tone} dot>
                      {workerStatusMeta(w.status).label}
                    </Badge>
                  </div>

                  {/* Geofence + confirm row */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-medium',
                        w.insideRegion ? 'bg-success-soft text-primary-700' : 'bg-danger-soft text-red-700',
                      )}
                    >
                      {w.insideRegion ? <ShieldTick size={15} variant="Bulk" /> : <ShieldCross size={15} variant="Bulk" />}
                      {w.insideRegion ? 'Hududda' : 'Tashqarida'}
                    </div>
                    <div
                      className={cn(
                        'flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-[12px] font-medium',
                        w.todayConfirmed ? 'bg-info-soft text-accent-700' : 'bg-surface-2 text-ink-muted',
                      )}
                    >
                      <TickCircle size={15} variant="Bulk" />
                      {w.todayConfirmed ? 'Tasdiqladi' : 'Tasdiqlanmagan'}
                    </div>
                  </div>

                  {/* Check in/out */}
                  <div className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2 text-[12px]">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <LoginCurve size={14} className="text-success" />
                      {w.checkInTime ?? '—'}
                    </span>
                    <span className="text-ink-muted">→</span>
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <LogoutCurve size={14} className="text-danger" />
                      {w.checkOutTime ?? (w.checkInTime ? 'Ishda' : '—')}
                    </span>
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      <Clock size={14} className="text-ink-muted" />
                      {w.monthlyHours}h
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-surface-2 py-2">
                      <div className="flex items-center justify-center gap-1 text-sm font-bold text-ink">
                        <Star1 size={13} variant="Bold" className="text-warning" />
                        {w.rating}
                      </div>
                      <div className="text-[10px] text-ink-muted">Reyting</div>
                    </div>
                    <div className="rounded-xl bg-surface-2 py-2">
                      <div className="text-sm font-bold text-ink">{w.completedTasks}</div>
                      <div className="text-[10px] text-ink-muted">Bajargan</div>
                    </div>
                    <div className="rounded-xl bg-surface-2 py-2">
                      <div className="text-sm font-bold text-primary-600">{formatNumber(w.points)}</div>
                      <div className="text-[10px] text-ink-muted">Ball</div>
                    </div>
                  </div>

                  {/* Attendance bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted">
                      <span>Davomat</span>
                      <span className="font-medium text-ink-soft">{w.attendanceRate}%</span>
                    </div>
                    <Progress value={w.attendanceRate} height={6} color={w.avatarColor} />
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                    <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <Call size={14} className="text-ink-muted" />
                      {w.phone}
                    </span>
                    {w.activeTasks > 0 && (
                      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                        {w.activeTasks} vazifa
                      </span>
                    )}
                  </div>
                </Card>
                </motion.button>
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
              <Profile2User size={36} variant="Bulk" className="text-ink-muted" />
              {workers.length === 0 ? (
                <>
                  <div>
                    <p className="font-semibold text-ink">Hali ishchilar yo'q</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Birinchi dala ishchisini qo'shib boshlang
                    </p>
                  </div>
                  <Button onClick={() => setCreating(true)}>
                    <Add size={18} /> Ishchi qo'shish
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-ink">Hech narsa topilmadi</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Qidiruv yoki filtrlarga mos ishchi yo'q — boshqa so'z bilan urinib ko'ring
                    </p>
                  </div>
                  <Button variant="secondary" onClick={resetFilters}>
                    <RotateRight size={16} /> Filtrlarni tozalash
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}

      <WorkerDetail
        worker={selected}
        onClose={() => setSelected(null)}
        onEdit={(w) => {
          setSelected(null);
          setEditing(w);
        }}
        onDelete={(w) => setDeleting(w)}
      />

      <WorkerFormModal
        open={formOpen}
        worker={editing}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Ishchini o'chirish"
        message={
          <>
            <strong className="text-ink">{deleting?.name}</strong> profili butunlay o'chiriladi.
            Rostdan ham o'chirmoqchimisiz?
          </>
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleteWorker.isPending}
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
