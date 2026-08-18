import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Add,
  Crown1,
  Edit2,
  Lock1,
  Profile2User,
  RotateRight,
  SearchNormal1,
  ShieldTick,
  TickCircle,
  Trash,
  Unlock,
  CloseCircle,
  type Icon as IconType,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { useAuth, type AdminRole } from '@/shared/store/auth';
import { ADMIN_ROLE_META } from './adminsMeta';
import { useAdmins, type AdminUser } from './useAdmins';
import {
  useCreateAdmin,
  useDeleteAdmin,
  useUpdateAdmin,
  type AdminUpdateInput,
} from './useAdminMutations';
import { AdminFormModal } from './AdminFormModal';
import { AdminEditModal, type AdminEditLock } from './AdminEditModal';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

const ROLE_FILTER_ORDER: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'VIEWER'];

/** Ma'lum bir qator uchun bloklash sabablari: o'zi yoki oxirgi faol SUPER_ADMIN. */
function lockFor(admin: AdminUser, currentUserId: string | undefined, activeSuperAdminCount: number): AdminEditLock {
  return {
    isSelf: !!currentUserId && admin.id === currentUserId,
    isLastActiveSuperAdmin:
      admin.role === 'SUPER_ADMIN' && admin.isActive && activeSuperAdminCount <= 1,
  };
}

function reasonFor(lock: AdminEditLock, kind: 'deactivate' | 'delete'): string | undefined {
  if (lock.isSelf) {
    return kind === 'deactivate' ? "O'zingizni faolsizlantira olmaysiz" : "O'zingizni o'chira olmaysiz";
  }
  if (lock.isLastActiveSuperAdmin) {
    return kind === 'deactivate'
      ? "Oxirgi faol super adminni faolsizlantirib bo'lmaydi"
      : "Oxirgi faol super adminni o'chirib bo'lmaydi";
  }
  return undefined;
}

/** Nomga qarab (ish holatidan qat'iy nazar) tooltip + disabled qatorli amal tugmasi. */
function RowActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  disabledReason,
  danger,
}: {
  icon: IconType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  disabledReason?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={disabled ? disabledReason : label}
      aria-label={label}
      aria-disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (disabled) return;
        onClick();
      }}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
        disabled
          ? 'cursor-not-allowed text-ink-muted/50'
          : danger
            ? 'text-ink-soft hover:bg-danger-soft hover:text-red-600'
            : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
      )}
    >
      <Icon size={17} variant="Bulk" />
    </button>
  );
}

export function AdminsPage() {
  const { data, isLoading, isError, error, refetch } = useAdmins();
  const admins = useMemo(() => data ?? [], [data]);
  const currentUserId = useAuth((s) => s.user?.id);

  const [roleFilter, setRoleFilter] = useState<AdminRole | 'all'>('all');
  const [query, setQuery] = useState('');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const createAdmin = useCreateAdmin();
  const updateAdmin = useUpdateAdmin();
  const deleteAdmin = useDeleteAdmin();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const activeSuperAdminCount = useMemo(
    () => admins.filter((a) => a.role === 'SUPER_ADMIN' && a.isActive).length,
    [admins],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return admins.filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (!q) return true;
      return (
        a.username.toLowerCase().includes(q) ||
        a.fullName.toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [admins, roleFilter, query]);

  const hasActiveFilters = roleFilter !== 'all' || query.trim() !== '';

  function resetFilters() {
    setRoleFilter('all');
    setQuery('');
  }

  const roleCounts = useMemo(() => {
    const m = new Map<AdminRole, number>();
    admins.forEach((a) => m.set(a.role, (m.get(a.role) ?? 0) + 1));
    return m;
  }, [admins]);

  const stats = useMemo(() => {
    const total = admins.length;
    const active = admins.filter((a) => a.isActive).length;
    const superAdmins = admins.filter((a) => a.role === 'SUPER_ADMIN').length;
    const inactive = total - active;
    return { total, active, superAdmins, inactive };
  }, [admins]);

  async function handleCreate(input: Parameters<typeof createAdmin.mutateAsync>[0]) {
    await createAdmin.mutateAsync(input);
    setToast({ tone: 'success', msg: "Yangi admin qo'shildi" });
  }

  async function handleUpdate(patch: AdminUpdateInput) {
    if (!editing) return;
    await updateAdmin.mutateAsync({ id: editing.id, ...patch });
    setToast({ tone: 'success', msg: 'Admin maʼlumotlari yangilandi' });
  }

  function requestToggleActive(a: AdminUser) {
    if (a.isActive) {
      setDeactivating(a);
    } else {
      // Faollashtirish backend tomonidan hech qachon bloklanmaydi — darhol bajariladi.
      updateAdmin.mutate(
        { id: a.id, isActive: true },
        {
          onSuccess: () => setToast({ tone: 'success', msg: `${a.fullName} faollashtirildi` }),
          onError: (err) =>
            setToast({
              tone: 'error',
              msg: err instanceof Error ? err.message : "Faollashtirib bo'lmadi",
            }),
        },
      );
    }
  }

  async function confirmDeactivate() {
    if (!deactivating) return;
    const a = deactivating;
    try {
      await updateAdmin.mutateAsync({ id: a.id, isActive: false });
      setDeactivating(null);
      setToast({ tone: 'success', msg: `${a.fullName} faolsizlantirildi` });
    } catch (err) {
      setDeactivating(null);
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "Faolsizlantirib bo'lmadi",
      });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const a = deleting;
    try {
      await deleteAdmin.mutateAsync(a.id);
      setDeleting(null);
      setToast({ tone: 'success', msg: `${a.fullName} o'chirildi` });
    } catch (err) {
      setDeleting(null);
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "Adminni o'chirib bo'lmadi",
      });
    }
  }

  return (
    <div>
      <PageHeader
        title="Adminlar"
        subtitle="Web-admin akkauntlari — rollar, kirish huquqlari va parollar"
        action={
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
          >
            <Add size={20} /> Admin qo'shish
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
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
            ) : (
              <>
                <StatCard icon={Profile2User} label="Jami adminlar" value={String(stats.total)} tint="#2563eb" index={0} />
                <StatCard icon={TickCircle} label="Faol" value={String(stats.active)} tint="#10b981" index={1} />
                <StatCard icon={Crown1} label="Super adminlar" value={String(stats.superAdmins)} tint="#7c3aed" index={2} />
                <StatCard icon={Lock1} label="Nofaol" value={String(stats.inactive)} tint="#94a3b8" index={3} />
              </>
            )}
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterPill
                active={roleFilter === 'all'}
                onClick={() => setRoleFilter('all')}
                label="Barchasi"
                count={admins.length}
              />
              {ROLE_FILTER_ORDER.map((r) => {
                const meta = ADMIN_ROLE_META[r];
                return (
                  <FilterPill
                    key={r}
                    active={roleFilter === r}
                    onClick={() => setRoleFilter(r)}
                    label={meta.label}
                    count={roleCounts.get(r) ?? 0}
                    color={meta.color}
                    icon={meta.icon}
                  />
                );
              })}
            </div>
            <div className="relative lg:w-72">
              <label htmlFor="admins-search" className="sr-only">
                Adminlarni qidirish
              </label>
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="admins-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Login, ism yoki email..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mb-4">
              <button
                onClick={resetFilters}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <RotateRight size={15} /> Filtrlarni tozalash
              </button>
            </div>
          )}

          {/* Table */}
          <Card className="overflow-hidden">
            <div className="hidden border-b border-line bg-surface-2 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted md:grid md:grid-cols-12 md:gap-4">
              <div className="col-span-4">Foydalanuvchi</div>
              <div className="col-span-2">Rol</div>
              <div className="col-span-2">Holat</div>
              <div className="col-span-2">Oxirgi kirish</div>
              <div className="col-span-2 text-right">Amallar</div>
            </div>

            {isLoading ? (
              <div className="divide-y divide-line">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="px-5 py-3.5">
                    <Skeleton className="h-10" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {filtered.map((a, i) => {
                  const meta = ADMIN_ROLE_META[a.role];
                  const lock = lockFor(a, currentUserId, activeSuperAdminCount);
                  const deactivateDisabled = a.isActive && (lock.isSelf || lock.isLastActiveSuperAdmin);
                  const deleteDisabled = lock.isSelf || lock.isLastActiveSuperAdmin;
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.02, 0.2) }}
                      className="grid w-full grid-cols-1 items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2 md:grid-cols-12 md:gap-4"
                    >
                      <div className="col-span-4 flex items-center gap-3">
                        <Avatar name={a.fullName} color={meta.color} size={40} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-ink">{a.fullName}</span>
                            {lock.isSelf && (
                              <span className="shrink-0 rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-semibold text-primary-700">
                                Siz
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[12px] text-ink-muted">
                            <span className="font-mono">{a.username}</span>
                            {a.email && <span> · {a.email}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-2">
                        <Badge tone={meta.tone}>
                          <meta.icon size={13} variant="Bulk" />
                          {meta.label}
                        </Badge>
                      </div>

                      <div className="col-span-2">
                        <Badge tone={a.isActive ? 'success' : 'neutral'} dot>
                          {a.isActive ? 'Faol' : 'Nofaol'}
                        </Badge>
                      </div>

                      <div className="col-span-2 text-[13px] text-ink-soft">
                        {a.lastLoginAt ? timeAgo(a.lastLoginAt) : 'Hech qachon'}
                      </div>

                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <RowActionButton
                          icon={Edit2}
                          label="Tahrirlash"
                          onClick={() => setEditing(a)}
                        />
                        <RowActionButton
                          icon={a.isActive ? Lock1 : Unlock}
                          label={a.isActive ? 'Faolsizlantirish' : 'Faollashtirish'}
                          onClick={() => requestToggleActive(a)}
                          disabled={deactivateDisabled}
                          disabledReason={reasonFor(lock, 'deactivate')}
                        />
                        <RowActionButton
                          icon={Trash}
                          label="O'chirish"
                          onClick={() => setDeleting(a)}
                          disabled={deleteDisabled}
                          disabledReason={reasonFor(lock, 'delete')}
                          danger
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <ShieldTick size={36} variant="Bulk" className="text-ink-muted" />
                {admins.length === 0 ? (
                  <>
                    <div>
                      <p className="font-semibold text-ink">Hali adminlar yo'q</p>
                      <p className="mt-1 text-sm text-ink-muted">Birinchi admin akkauntini qo'shib boshlang</p>
                    </div>
                    <Button onClick={() => setCreating(true)}>
                      <Add size={18} /> Admin qo'shish
                    </Button>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="font-semibold text-ink">Mos admin topilmadi</p>
                      <p className="mt-1 text-sm text-ink-muted">
                        Qidiruv yoki filtrlarga mos admin yo'q — boshqa so'z bilan urinib ko'ring
                      </p>
                    </div>
                    <Button variant="secondary" onClick={resetFilters}>
                      <RotateRight size={16} /> Filtrlarni tozalash
                    </Button>
                  </>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      <AdminFormModal open={creating} onClose={() => setCreating(false)} onSubmit={handleCreate} />

      <AdminEditModal
        open={!!editing}
        admin={editing}
        lock={editing ? lockFor(editing, currentUserId, activeSuperAdminCount) : { isSelf: false, isLastActiveSuperAdmin: false }}
        onClose={() => setEditing(null)}
        onSubmit={handleUpdate}
      />

      <ConfirmDialog
        open={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={confirmDeactivate}
        title="Adminni faolsizlantirish"
        message={
          <>
            <strong className="text-ink">{deactivating?.fullName}</strong> tizimga kira olmay
            qoladi. Rostdan ham faolsizlantirmoqchimisiz?
          </>
        }
        confirmLabel="Ha, faolsizlantirish"
        tone="warning"
        icon={Lock1}
        loading={updateAdmin.isPending}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Adminni o'chirish"
        message={
          <>
            <strong className="text-ink">{deleting?.fullName}</strong> hisobi butunlay o'chiriladi.
            Rostdan ham o'chirmoqchimisiz?
          </>
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleteAdmin.isPending}
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

function FilterPill({
  active,
  onClick,
  label,
  count,
  color,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
  icon?: IconType;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all',
        active
          ? 'border-primary-400 bg-primary-50 text-primary-700'
          : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
      )}
    >
      {Icon && (
        <Icon
          size={15}
          variant="Bulk"
          style={active && color ? { color } : undefined}
          className={active ? '' : 'text-ink-muted'}
        />
      )}
      {label}
      <span
        className={cn(
          'rounded-full px-1.5 text-[11px] font-semibold',
          active ? 'bg-primary-100 text-primary-700' : 'bg-surface-2 text-ink-muted',
        )}
      >
        {count}
      </span>
    </button>
  );
}
