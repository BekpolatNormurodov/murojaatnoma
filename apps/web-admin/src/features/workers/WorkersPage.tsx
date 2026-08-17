import { useMemo, useState } from 'react';
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
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Progress } from '@/shared/ui/Progress';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import type { Worker, WorkerStatus } from '@/shared/data/types';
import { formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { WorkerDetail } from './WorkerDetail';
import { useWorkers } from './useWorkers';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

const STATUS_LABEL: Record<
  WorkerStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'info' }
> = {
  online: { label: 'Onlayn', tone: 'success' },
  on_task: { label: 'Vazifada', tone: 'warning' },
  break: { label: 'Tanaffus', tone: 'info' },
  offline: { label: 'Oflayn', tone: 'neutral' },
};

type Filter = 'all' | 'inside' | 'outside' | 'unconfirmed';

export function WorkersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Worker | null>(null);

  const { data, isLoading, isError, error, refetch } = useWorkers();
  const workers = useMemo(() => data ?? [], [data]);

  const totalPoints = workers.reduce((s, w) => s + w.points, 0);
  const avgRating = workers.length
    ? (workers.reduce((s, w) => s + w.rating, 0) / workers.length).toFixed(1)
    : '0.0';
  const checkedIn = workers.filter((w) => w.checkInTime).length;
  const confirmed = workers.filter((w) => w.todayConfirmed).length;
  const insideCount = workers.filter((w) => w.insideRegion).length;

  const filtered = useMemo(() => {
    return workers.filter((w) => {
      const q =
        !query ||
        w.name.toLowerCase().includes(query.toLowerCase()) ||
        w.region.toLowerCase().includes(query.toLowerCase()) ||
        w.position.toLowerCase().includes(query.toLowerCase());
      const f =
        filter === 'all' ||
        (filter === 'inside' && w.insideRegion) ||
        (filter === 'outside' && !w.insideRegion) ||
        (filter === 'unconfirmed' && !w.todayConfirmed);
      return q && f;
    });
  }, [workers, query, filter]);

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
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
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
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
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
              <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ism, lavozim yoki hudud..."
                className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
              />
            </div>
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
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
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
                    <Badge tone={STATUS_LABEL[w.status].tone} dot>
                      {STATUS_LABEL[w.status].label}
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
            <div className="py-20 text-center text-ink-muted">Hech narsa topilmadi</div>
          )}
        </>
      )}

      <WorkerDetail worker={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
