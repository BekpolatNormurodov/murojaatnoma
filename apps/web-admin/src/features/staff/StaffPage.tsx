import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Profile2User,
  UserTick,
  ShieldTick,
  Add,
  Trash,
  SearchNormal1,
  Crown1,
  Clock,
  CloseCircle,
  RotateRight,
  type Icon as IconType,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Select } from '@/shared/ui/Select';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import { usePermissions } from '@/shared/lib/permissions';
import { timeAgo } from '@/shared/lib/format';
import { ROLE_META, WEEKDAYS } from '@/shared/data/mock';
import type { StaffMember, StaffRole, StaffStatus } from '@/shared/data/types';
import { StaffDetail } from './StaffDetail';
import { StaffFormModal } from './StaffFormModal';
import { useStaff } from './useStaff';
import { useCreateStaff, useDeleteStaff, useUpdateStaff } from './useStaffMutations';
import { ROLE_ICON, roleMeta, staffStatusMeta } from './staffMeta';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

const ROLE_ORDER = (Object.keys(ROLE_META) as StaffRole[]).sort(
  (a, b) => ROLE_META[a].rank - ROLE_META[b].rank,
);

const STATUS_FILTER_OPTIONS: { value: StaffStatus | 'all'; label: string; dot?: string }[] = [
  { value: 'all', label: 'Barcha holatlar' },
  { value: 'active', label: 'Faol', dot: '#10b981' },
  { value: 'inactive', label: 'Nofaol', dot: '#94a3b8' },
  { value: 'suspended', label: "To'xtatilgan", dot: '#ef4444' },
];

/**
 * POST /employees E.164 talab qiladi (masalan +998901234567, bo'shliqsiz),
 * lekin StaffFormModal'dagi telefon input "+998 90 123 45 67" kabi bo'shliqli
 * formatga ruxsat beradi (isPhone) — shu sababli faqat shu yerda, provisioning
 * chaqiruvidan oldin tozalanadi. Xodimning o'z `phone` maydoni o'zgarmaydi.
 */
function toE164Phone(raw: string): string {
  const digits = raw.trim().replace(/[\s()-]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('998')) return `+${digits}`;
  return `+998${digits}`;
}

function scheduleLabel(s: StaffMember['schedule']) {
  const days = s.days.map((d) => WEEKDAYS[d - 1]).join(', ');
  return `${s.start}–${s.end} · ${days}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

export function StaffPage() {
  const { data, isLoading, isError, error, refetch } = useStaff();
  // Ro'yxat to'g'ridan-to'g'ri React Query keshidan o'qiladi. Rol/ruxsat
  // tahriri va o'chirish backendga PATCH/DELETE yuboradi va keshni optimistik
  // yangilaydi — mahalliy nusxa (setStaff) yo'q, shu sababli "soxta" (faqat
  // UI'da qoladigan, serverga bormaydigan) o'zgarishlar bo'lmaydi.
  const staff = useMemo(() => data ?? [], [data]);

  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StaffStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { canWrite } = usePermissions();

  // CRUD holati: yaratish oynasi / o'chirishni tasdiqlash / qisqa toast.
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.login.toLowerCase().includes(q)
      );
    });
  }, [staff, roleFilter, statusFilter, query]);

  const hasActiveFilters = roleFilter !== 'all' || statusFilter !== 'all' || query.trim() !== '';

  function resetFilters() {
    setRoleFilter('all');
    setStatusFilter('all');
    setQuery('');
  }

  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter((s) => s.status === 'active').length;
    const leadership = staff.filter(
      (s) => s.role === 'hokim' || s.role === 'hokim_yordamchisi',
    ).length;
    const twoFa = staff.filter((s) => s.twoFactor).length;
    return { total, active, leadership, twoFa };
  }, [staff]);

  const roleCounts = useMemo(() => {
    const m = new Map<StaffRole, number>();
    staff.forEach((s) => m.set(s.role, (m.get(s.role) ?? 0) + 1));
    return m;
  }, [staff]);

  // Drawer'dagi tahrir — endi haqiqiy PATCH /staff/:id. Xato bo'lsa
  // (throw) StaffDetail buni ushlab, drawer ichida ko'rsatadi.
  async function handleSave(updated: StaffMember) {
    await updateStaff.mutateAsync({
      id: updated.id,
      role: updated.role,
      status: updated.status,
      login: updated.login,
      permissions: updated.permissions,
      schedule: updated.schedule,
      twoFactor: updated.twoFactor,
    });
    setToast({ tone: 'success', msg: 'Xodim maʼlumotlari yangilandi' });
  }

  async function handleCreate(
    input: Parameters<typeof createStaff.mutateAsync>[0],
    createLogin: boolean,
  ) {
    // Xodim yozuvi (staff) — asosiy yaratish. Bu muvaffaqiyatsiz bo'lsa,
    // xato StaffFormModal'ga tashlanadi (modal ochiq qoladi) — pastdagi
    // /employees provisioning'ga umuman yetib bormaymiz.
    await createStaff.mutateAsync(input);

    if (!createLogin) {
      setToast({ tone: 'success', msg: "Yangi xodim qo'shildi" });
      return;
    }

    // "Login yaratish (telefon orqali)" belgilangan — worker-app'da shu
    // telefon raqami bilan OTP-login qila olishi uchun /employees'ga
    // ALOHIDA yozuv yaratamiz. Staff yaratish allaqachon muvaffaqiyatli
    // bo'lgani uchun bu yerdagi xato staff yaratishni bekor qilmaydi —
    // faqat mustaqil tarzda ushlanadi va alohida xabar bilan ko'rsatiladi.
    try {
      await api.post('/employees', {
        fullName: input.name,
        phone: toE164Phone(input.phone),
        position: input.position,
        region: 'Toshkent shahri',
        district: "Mirzo Ulug'bek",
      });
      setToast({ tone: 'success', msg: "Xodim qo'shildi va worker-app login yaratildi" });
    } catch (err) {
      setToast({
        tone: 'error',
        msg: `Xodim qo'shildi, lekin worker-app login yaratilmadi: ${
          err instanceof Error ? err.message : "noma'lum xatolik"
        }`,
      });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const name = deleting.name;
    try {
      await deleteStaff.mutateAsync(deleting.id);
      setDeleting(null);
      setSelectedId(null);
      setToast({ tone: 'success', msg: `${name} o'chirildi` });
    } catch (err) {
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "Xodimni o'chirib bo'lmadi",
      });
    }
  }

  const selected = staff.find((s) => s.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Hokim apparati xodimlari, rollar, ruxsatlar va kirish ma'lumotlari"
        action={
          canWrite && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
            >
              <Add size={20} /> Xodim qo'shish
            </button>
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
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[124px]" />)
            ) : (
              <>
                <StatCard icon={Profile2User} label="Jami xodimlar" value={String(stats.total)} tint="#2563eb" index={0} />
                <StatCard icon={UserTick} label="Faol" value={String(stats.active)} tint="#10b981" index={1} />
                <StatCard icon={Crown1} label="Rahbariyat" value={String(stats.leadership)} tint="#7c3aed" index={2} />
                <StatCard icon={ShieldTick} label="2FA yoqilgan" value={String(stats.twoFa)} tint="#0891b2" index={3} />
              </>
            )}
          </div>

          {/* Filters */}
          <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterPill
                active={roleFilter === 'all'}
                onClick={() => setRoleFilter('all')}
                label="Barchasi"
                count={staff.length}
              />
              {ROLE_ORDER.map((r) => (
                <FilterPill
                  key={r}
                  active={roleFilter === r}
                  onClick={() => setRoleFilter(r)}
                  label={ROLE_META[r].label}
                  count={roleCounts.get(r) ?? 0}
                  color={ROLE_META[r].color}
                  icon={ROLE_ICON[r]}
                />
              ))}
            </div>
            <div className="relative lg:w-72">
              <label htmlFor="staff-search" className="sr-only">
                Xodimlarni qidirish
              </label>
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                id="staff-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, lavozim yoki login..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-full sm:w-56">
              <Select value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} block />
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

          {/* Staff grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[262px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((s, i) => {
                const Icon = ROLE_ICON[s.role] ?? Profile2User;
                const meta = roleMeta(s.role);
                return (
                  <motion.button
                    key={s.id}
                    initial={reducedMotion ? false : { opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : { delay: Math.min(i * 0.04, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }
                    }
                    onClick={() => setSelectedId(s.id)}
                    className="group text-left"
                  >
                    <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-pop">
                      <div className="flex items-start gap-3">
                        <Avatar name={s.name} src={s.photo} color={s.avatarColor} size={52} ring />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-semibold text-ink">{s.name}</h3>
                          </div>
                          <p className="truncate text-[13px] text-ink-muted">{s.position}</p>
                        </div>
                        <Badge tone={staffStatusMeta(s.status).tone} dot>
                          {staffStatusMeta(s.status).label}
                        </Badge>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold"
                          style={{ background: `${meta.color}1a`, color: meta.color }}
                        >
                          <Icon size={14} variant="Bulk" />
                          {meta.label}
                        </span>
                        <span className="truncate text-xs text-ink-muted">{s.department}</span>
                      </div>

                      <div className="mt-4 space-y-2 border-t border-line pt-3 text-[13px]">
                        <Row label="Login" value={s.login} mono />
                        <Row label="Ruxsatlar" value={`${s.permissions.length} modul`} />
                        <div className="flex items-center gap-1.5 text-ink-muted">
                          <Clock size={14} />
                          <span className="truncate">{scheduleLabel(s.schedule)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-ink-muted">Oxirgi kirish</span>
                          <span className="font-medium text-ink-soft">
                            {s.lastLogin ? timeAgo(s.lastLogin) : '—'}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </motion.button>
                );
              })}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
              <Profile2User size={36} variant="Bulk" className="text-ink-muted" />
              {staff.length === 0 ? (
                <>
                  <div>
                    <p className="font-semibold text-ink">Hali xodimlar yo'q</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Hokim apparati xodimini qo'shib boshlang
                    </p>
                  </div>
                  {canWrite && (
                    <Button onClick={() => setCreating(true)}>
                      <Add size={18} /> Xodim qo'shish
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-ink">Mos xodim topilmadi</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Qidiruv yoki filtrlarga mos xodim yo'q — boshqa so'z bilan urinib ko'ring
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

      <StaffDetail
        member={selected}
        onClose={() => setSelectedId(null)}
        onSave={handleSave}
        onDelete={(m) => setDeleting(m)}
      />

      <StaffFormModal open={creating} onClose={() => setCreating(false)} onSubmit={handleCreate} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Xodimni o'chirish"
        message={
          <>
            <strong className="text-ink">{deleting?.name}</strong> hisobi va ruxsatlari butunlay
            o'chiriladi. Rostdan ham o'chirmoqchimisiz?
          </>
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleteStaff.isPending}
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

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={cn('font-medium text-ink-soft', mono && 'font-mono text-xs')}>{value}</span>
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
