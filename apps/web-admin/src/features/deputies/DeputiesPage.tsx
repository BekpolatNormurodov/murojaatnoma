import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Crown1,
  Hierarchy,
  CallCalling,
  Sms,
  Buildings2,
  Calendar,
  MessageQuestion,
  Danger,
  Star1,
  CloseCircle,
  RotateRight,
  Add,
  Edit2,
  Trash,
  SearchNormal1,
  Profile2User,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';
import { usePermissions } from '@/shared/lib/permissions';
import { CATEGORY_META, COMPLAINTS, REQUESTS } from '@/shared/data/mock';
import type { Deputy, RequestCategory } from '@/shared/data/types';
import { useDeputies } from './useDeputies';
import { DeputyFormModal } from './DeputyFormModal';
import { DeputyDetail } from './DeputyDetail';
import { useCreateDeputy, useDeleteDeputy, useUpdateDeputy } from './useDeputyMutations';
import { useStaff } from '../staff/useStaff';
import { categoryMeta, deputyStats } from './deputyMeta';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

const CATEGORY_KEYS = Object.keys(CATEGORY_META) as RequestCategory[];

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof MessageQuestion;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-2.5">
      <Icon size={17} variant="Bulk" style={{ color }} />
      <span className="mt-1 text-base font-bold text-ink">{value}</span>
      <span className="text-[10.5px] leading-tight text-ink-muted">{label}</span>
    </div>
  );
}

function DeputyCard({
  d,
  index,
  reducedMotion,
  onSelect,
  onEdit,
  onDelete,
}: {
  d: Deputy;
  index: number;
  reducedMotion: boolean;
  onSelect: (d: Deputy) => void;
  onEdit: (d: Deputy) => void;
  onDelete: (d: Deputy) => void;
}) {
  const s = deputyStats(d);
  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : { delay: Math.min(index * 0.06, 0.4), duration: 0.4, ease: [0.22, 1, 0.36, 1] }
      }
      role="button"
      tabIndex={0}
      onClick={() => onSelect(d)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(d);
        }
      }}
      className="relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-pop focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: d.color }} />
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
        style={{ background: d.color, opacity: 0.1 }}
      />

      {/* Edit / delete controls */}
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(d);
          }}
          aria-label="Tahrirlash"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-surface/90 text-ink-soft backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <Edit2 size={16} variant="Bulk" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(d);
          }}
          aria-label="O'chirish"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-danger/30 bg-danger-soft/90 text-red-700 backdrop-blur-sm transition-colors hover:bg-danger/15"
        >
          <Trash size={16} variant="Bulk" />
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 pr-28">
        <Avatar src={d.photo} name={d.name} color={d.color} size={56} ring />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-bold text-ink">{d.name}</h3>
          <p className="text-[12.5px] text-ink-muted">{d.position}</p>
        </div>
      </div>

      {/* Direction */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: d.color }}
        >
          <Hierarchy size={15} variant="Bulk" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Yo'nalish
          </div>
          <div className="text-[13px] font-medium text-ink">{d.direction}</div>
        </div>
      </div>

      {/* Categories handled */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Javob beradigan murojaatlar
        </div>
        {d.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {d.categories.map((cat) => {
              const meta = categoryMeta(cat);
              return (
                <span
                  key={cat}
                  className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                  style={{
                    background: `${meta.color}1a`,
                    color: meta.color,
                  }}
                >
                  {meta.label}
                </span>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.topics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mini stats */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat icon={MessageQuestion} label="Murojaat" value={s.requests} color="#f59e0b" />
        <MiniStat icon={Danger} label="Shikoyat" value={s.complaints} color="#ef4444" />
        <MiniStat icon={Calendar} label="Yig'ilish" value={s.meetings} color="#2563eb" />
      </div>

      {/* Contact */}
      <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12.5px]">
        <a
          href={`tel:${d.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-ink-soft hover:text-accent-600"
        >
          <CallCalling size={15} variant="Bulk" className="text-ink-muted" /> {d.phone}
        </a>
        <a
          href={`mailto:${d.email}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-ink-soft hover:text-accent-600"
        >
          <Sms size={15} variant="Bulk" className="text-ink-muted" /> {d.email}
        </a>
        <div className="flex items-center gap-2 text-ink-soft">
          <Buildings2 size={15} variant="Bulk" className="text-ink-muted" /> {d.office}
        </div>
        <div className="flex items-center gap-2 text-ink-soft">
          <Calendar size={15} variant="Bulk" className="text-ink-muted" /> Qabul: {d.receptionDay}
        </div>
      </div>
    </motion.div>
  );
}

export function DeputiesPage() {
  const { data, isLoading, isError, error, refetch } = useDeputies();
  const { data: staffData } = useStaff();
  const deputies = useMemo(() => data ?? [], [data]);

  const hokim = useMemo(() => staffData?.find((s) => s.role === 'hokim'), [staffData]);

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | 'all'>('all');
  const [selected, setSelected] = useState<Deputy | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { canWrite } = usePermissions();

  // CRUD holati: yaratish / tahrirlash / o'chirish oynalari + qisqa toast.
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Deputy | null>(null);
  const [deleting, setDeleting] = useState<Deputy | null>(null);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; msg: string } | null>(null);

  const createDeputy = useCreateDeputy();
  const updateDeputy = useUpdateDeputy();
  const deleteDeputy = useDeleteDeputy();

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deputies.filter((d) => {
      const matchesQuery =
        !q ||
        d.name.toLowerCase().includes(q) ||
        d.direction.toLowerCase().includes(q) ||
        d.shortDirection.toLowerCase().includes(q) ||
        d.office.toLowerCase().includes(q) ||
        d.topics.some((t) => t.toLowerCase().includes(q));
      const matchesCategory = categoryFilter === 'all' || d.categories.includes(categoryFilter);
      return matchesQuery && matchesCategory;
    });
  }, [deputies, query, categoryFilter]);

  const hasActiveFilters = query.trim() !== '' || categoryFilter !== 'all';

  function resetFilters() {
    setQuery('');
    setCategoryFilter('all');
  }

  async function handleSubmit(input: Parameters<typeof createDeputy.mutateAsync>[0]) {
    if (editing) {
      await updateDeputy.mutateAsync({ id: editing.id, ...input });
      setToast({ tone: 'success', msg: 'Oʼrinbosar maʼlumotlari yangilandi' });
    } else {
      await createDeputy.mutateAsync(input);
      setToast({ tone: 'success', msg: "Yangi o'rinbosar qo'shildi" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    const name = deleting.name;
    try {
      await deleteDeputy.mutateAsync(deleting.id);
      setDeleting(null);
      setSelected(null);
      setToast({ tone: 'success', msg: `${name} o'chirildi` });
    } catch (err) {
      setToast({
        tone: 'error',
        msg: err instanceof Error ? err.message : "O'rinbosarni o'chirib bo'lmadi",
      });
    }
  }

  const totals = useMemo(() => {
    const routed = REQUESTS.filter((r) =>
      deputies.some((d) => d.categories.includes(r.category)),
    ).length;
    const directions = deputies.length;
    const complaints = COMPLAINTS.length;
    return { deputies: deputies.length, directions, routed, complaints };
  }, [deputies]);

  return (
    <div>
      <PageHeader
        title="Hokim o'rinbosarlari"
        subtitle="Hokimiyat rahbariyati — yo'nalishlar bo'yicha mas'ul o'rinbosarlar. Murojaatlar yo'nalishga qarab avtomatik biriktiriladi."
        action={
          canWrite && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
            >
              <Add size={20} /> O'rinbosar qo'shish
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
                <StatCard icon={Hierarchy} label="O'rinbosarlar" value={String(totals.deputies)} tint="#7c3aed" index={0} />
                <StatCard icon={Star1} label="Yo'nalishlar" value={String(totals.directions)} tint="#2563eb" index={1} />
                <StatCard icon={MessageQuestion} label="Biriktirilgan murojaat" value={String(totals.routed)} tint="#f59e0b" index={2} />
                <StatCard icon={Danger} label="Shikoyatlar nazorat" value={String(totals.complaints)} tint="#ef4444" index={3} />
              </>
            )}
          </div>

          {/* Filters + search */}
          {!isLoading && deputies.length > 0 && (
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setCategoryFilter('all')}
                    aria-pressed={categoryFilter === 'all'}
                    className={cn(
                      'min-h-11 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
                      categoryFilter === 'all'
                        ? 'bg-ink text-white'
                        : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    Barchasi
                  </button>
                  {CATEGORY_KEYS.map((c) => {
                    const meta = categoryMeta(c);
                    const active = categoryFilter === c;
                    return (
                      <button
                        key={c}
                        onClick={() => setCategoryFilter(c)}
                        aria-pressed={active}
                        className={cn(
                          'min-h-11 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors',
                          active
                            ? 'border-transparent text-white'
                            : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                        )}
                        style={active ? { background: meta.color } : undefined}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
                <div className="relative w-full lg:w-72">
                  <label htmlFor="deputies-search" className="sr-only">
                    O'rinbosarlarni qidirish
                  </label>
                  <SearchNormal1
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
                  />
                  <input
                    id="deputies-search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ism, yo'nalish yoki kabinet..."
                    className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="inline-flex min-h-11 w-fit items-center gap-1.5 rounded-xl px-1 text-[13px] font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  <RotateRight size={15} /> Filtrlarni tozalash
                </button>
              )}
            </div>
          )}

          {/* Hokim banner */}
          {hokim && (
            <Card className="mb-6 flex flex-col gap-4 overflow-hidden bg-linear-to-br from-primary-700 to-primary-600 p-5 text-white sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <Avatar src={hokim.photo} name={hokim.name} color={hokim.avatarColor} size={64} ring />
                <div>
                  <div className="flex items-center gap-2">
                    <Crown1 size={18} variant="Bulk" className="text-amber-300" />
                    <span className="text-[12px] font-semibold uppercase tracking-wider text-white/80">
                      Tuman hokimi
                    </span>
                  </div>
                  <h2 className="mt-0.5 text-xl font-bold">{hokim.name}</h2>
                  <p className="text-[13px] text-white/80">{hokim.position}</p>
                </div>
              </div>
              <div className="sm:ml-auto">
                <div className="rounded-xl bg-white/15 px-4 py-2.5 text-[13px] backdrop-blur-sm">
                  Quyida {deputies.length} ta hokim o'rinbosari o'z yo'nalishi bo'yicha
                  <br className="hidden sm:block" /> fuqaro murojaatlari va shikoyatlariga javob beradi.
                </div>
              </div>
            </Card>
          )}

          {/* Deputies grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[360px]" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((d, i) => (
                <DeputyCard
                  key={d.id}
                  d={d}
                  index={i}
                  reducedMotion={reducedMotion}
                  onSelect={setSelected}
                  onEdit={(dep) => {
                    setSelected(null);
                    setEditing(dep);
                  }}
                  onDelete={setDeleting}
                />
              ))}
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-center">
              <Profile2User size={36} variant="Bulk" className="text-ink-muted" />
              {deputies.length === 0 ? (
                <>
                  <div>
                    <p className="font-semibold text-ink">Hali o'rinbosarlar yo'q</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Birinchi hokim o'rinbosarini qo'shib boshlang
                    </p>
                  </div>
                  {canWrite && (
                    <Button onClick={() => setCreating(true)}>
                      <Add size={18} /> O'rinbosar qo'shish
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-ink">Hech narsa topilmadi</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      Qidiruv yoki filtrlarga mos o'rinbosar yo'q — boshqa so'z bilan urinib ko'ring
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

      <DeputyDetail
        deputy={selected}
        onClose={() => setSelected(null)}
        onEdit={(d) => {
          setSelected(null);
          setEditing(d);
        }}
        onDelete={(d) => setDeleting(d)}
      />

      <DeputyFormModal
        open={formOpen}
        deputy={editing}
        onClose={closeForm}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="O'rinbosarni o'chirish"
        message={
          <>
            <strong className="text-ink">{deleting?.name}</strong> profili butunlay o'chiriladi.
            Rostdan ham o'chirmoqchimisiz?
          </>
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleteDeputy.isPending}
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
