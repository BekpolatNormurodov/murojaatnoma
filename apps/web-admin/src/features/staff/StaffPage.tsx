import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Profile2User,
  UserTick,
  ShieldTick,
  Add,
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
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { ROLE_META, STAFF_STATUS_META, WEEKDAYS } from '@/shared/data/mock';
import type { StaffMember, StaffRole } from '@/shared/data/types';
import { ROLE_ICON, StaffDetail } from './StaffDetail';
import { useStaff } from './useStaff';

const ROLE_ORDER = (Object.keys(ROLE_META) as StaffRole[]).sort(
  (a, b) => ROLE_META[a].rank - ROLE_META[b].rank,
);

function scheduleLabel(s: StaffMember['schedule']) {
  const days = s.days.map((d) => WEEKDAYS[d - 1]).join(', ');
  return `${s.start}–${s.end} · ${days}`;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

export function StaffPage() {
  const { data, isLoading, isError, error, refetch } = useStaff();
  // Xodimlar ro'yxati lokal state'da saqlanadi (rol/ruxsat tahriri drawer'da
  // shu yerda amalga oshadi) — dastlab server javobidan bir marta to'ldiriladi.
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (data && !seeded) {
      setStaff(data.map((s) => ({ ...s })));
      setSeeded(true);
    }
  }, [data, seeded]);

  const [roleFilter, setRoleFilter] = useState<StaffRole | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return staff.filter((s) => {
      if (roleFilter !== 'all' && s.role !== roleFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q) ||
        s.department.toLowerCase().includes(q) ||
        s.login.toLowerCase().includes(q)
      );
    });
  }, [staff, roleFilter, query]);

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

  function handleSave(updated: StaffMember) {
    setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  const selected = staff.find((s) => s.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Xodimlar boshqaruvi"
        subtitle="Hokim apparati xodimlari, rollar, ruxsatlar va kirish ma'lumotlari"
        action={
          <button className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700">
            <Add size={20} /> Xodim qo'shish
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
                <StatCard icon={Profile2User} label="Jami xodimlar" value={String(stats.total)} tint="#2563eb" index={0} />
                <StatCard icon={UserTick} label="Faol" value={String(stats.active)} tint="#10b981" index={1} />
                <StatCard icon={Crown1} label="Rahbariyat" value={String(stats.leadership)} tint="#7c3aed" index={2} />
                <StatCard icon={ShieldTick} label="2FA yoqilgan" value={String(stats.twoFa)} tint="#0891b2" index={3} />
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
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, lavozim yoki login..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-11 pr-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
              />
            </div>
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
                const Icon = ROLE_ICON[s.role];
                const meta = ROLE_META[s.role];
                return (
                  <motion.button
                    key={s.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
                        <Badge tone={STAFF_STATUS_META[s.status].tone} dot>
                          {STAFF_STATUS_META[s.status].label}
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
            <div className="rounded-2xl border border-dashed border-line py-16 text-center text-ink-muted">
              Mos xodim topilmadi
            </div>
          )}
        </>
      )}

      <StaffDetail member={selected} onClose={() => setSelectedId(null)} onSave={handleSave} />
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
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all',
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
