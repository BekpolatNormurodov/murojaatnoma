import { useMemo } from 'react';
import {
  Danger,
  RotateLeft,
  Star1,
  Timer1,
  UserRemove,
  Warning2,
} from 'iconsax-react';
import { Card, CardHeader } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { useRequests } from '@/shared/store/requests';
import type { CitizenRequest } from '@/shared/data/types';
import { getDeadline, isOpen, type DeadlineInfo } from './deadline';

type Lane = 'unassigned' | 'working' | 'overdue' | 'reopened' | 'rating';

const LANES: { key: Lane; title: string; hint: string; icon: typeof Timer1; color: string }[] = [
  { key: 'unassigned', title: 'Biriktirilmagan', hint: 'Mas’ul xodim kutmoqda', icon: UserRemove, color: '#6366f1' },
  { key: 'working', title: 'Jarayonda', hint: 'Muddat ichida', icon: Timer1, color: '#3b82f6' },
  { key: 'overdue', title: 'Muddati o‘tgan', hint: 'Rahbariyat nazoratida', icon: Danger, color: '#ef4444' },
  { key: 'reopened', title: 'Qayta ochilgan', hint: 'Fuqaro natijadan norozi', icon: RotateLeft, color: '#f59e0b' },
  { key: 'rating', title: 'Baho kutilmoqda', hint: 'Hal qilindi, fuqaro baholamagan', icon: Star1, color: '#10b981' },
];

/** One lane per murojaat, worst first: overdue > reopened > unassigned > working; resolved & unrated → rating. */
function laneOf(r: CitizenRequest, dl: DeadlineInfo): Lane | null {
  if (isOpen(r)) {
    if (dl.overdue) return 'overdue';
    if (r.reopenCount) return 'reopened';
    if (!r.assignedWorkerId) return 'unassigned';
    return 'working';
  }
  if (r.status === 'resolved' && r.source === 'citizen' && r.feedback == null) return 'rating';
  return null;
}

/**
 * Nazorat ko'rinishi — Murojaatlar sahifasi ichida ("Ro'yxat | Nazorat"),
 * alohida sahifa emas. Murojaat va shikoyat muddati: kimda, qancha qoldi,
 * qayerda to'xtab qoldi. Karta bosilsa sahifaning o'z tafsiloti ochiladi.
 */
export function ControlBoard({
  kind,
  now,
  onOpen,
}: {
  kind: 'all' | 'ariza' | 'shikoyat';
  now: number;
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const all = useRequests((s) => s.requests);
  const loading = useRequests((s) => s.loading);

  const rows = useMemo(
    () =>
      all
        .filter((r) => r.source === 'citizen' && (kind === 'all' || (r.kind ?? 'ariza') === kind))
        .map((r) => ({ r, dl: getDeadline(r, t, now) })),
    [all, kind, t, now],
  );

  const lanes = useMemo(() => {
    const m: Record<Lane, typeof rows> = { unassigned: [], working: [], overdue: [], reopened: [], rating: [] };
    for (const row of rows) {
      const lane = laneOf(row.r, row.dl);
      if (lane) m[lane].push(row);
    }
    for (const key of Object.keys(m) as Lane[]) {
      m[key].sort((a, b) =>
        key === 'rating'
          ? new Date(b.r.resolvedAt ?? 0).getTime() - new Date(a.r.resolvedAt ?? 0).getTime()
          : a.dl.dueAt.getTime() - b.dl.dueAt.getTime(),
      );
    }
    return m;
  }, [rows]);

  // Mas'ullar kesimi: kimda nechta ochiq / kechikkan / hal qilingan, o'rtacha baho.
  const byOwner = useMemo(() => {
    const m = new Map<
      string,
      { name: string; avatar: string | null; open: number; overdue: number; resolved: number; ratingSum: number; rated: number }
    >();
    for (const { r, dl } of rows) {
      if (!r.assignedWorkerId) continue;
      const e = m.get(r.assignedWorkerId) ?? {
        name: r.assignedEmployee?.fullName ?? 'Xodim',
        avatar: r.assignedEmployee?.avatarUrl ?? null,
        open: 0,
        overdue: 0,
        resolved: 0,
        ratingSum: 0,
        rated: 0,
      };
      if (isOpen(r)) {
        e.open += 1;
        if (dl.overdue) e.overdue += 1;
      } else if (r.status === 'resolved') {
        e.resolved += 1;
        if (r.feedback != null) {
          e.ratingSum += r.feedback;
          e.rated += 1;
        }
      }
      m.set(r.assignedWorkerId, e);
    }
    return [...m.entries()]
      .map(([id, e]) => ({ id, ...e, rating: e.rated ? Math.round((e.ratingSum / e.rated) * 10) / 10 : null }))
      .sort((a, b) => b.overdue - a.overdue || b.open - a.open);
  }, [rows]);

  const openTotal = rows.filter(({ r }) => isOpen(r)).length;

  return (
    <div>
      {/* Summary strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Summary label="Ochiq" value={openTotal} color="#0f172a" />
        {LANES.map((l) => (
          <Summary key={l.key} label={l.title} value={lanes[l.key].length} color={l.color} loading={loading && all.length === 0} />
        ))}
      </div>

      {/* Board */}
      <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[1100px] grid-cols-5 gap-3 xl:min-w-0">
          {LANES.map((l) => (
            <section key={l.key} className="flex min-h-[420px] flex-col rounded-2xl border border-line bg-surface-2/60 dark:bg-surface-2/30">
              <header className="flex items-center justify-between gap-2 px-3 pb-2 pt-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${l.color}1a`, color: l.color }}>
                    <l.icon size={15} variant="Bulk" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">{l.title}</p>
                    <p className="truncate text-[11px] text-ink-muted">{l.hint}</p>
                  </div>
                </div>
                <span className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-bold tabular-nums text-ink">
                  {lanes[l.key].length}
                </span>
              </header>
              <div className="flex-1 space-y-2 overflow-y-auto px-2 pb-2" style={{ maxHeight: 560 }}>
                {loading && all.length === 0
                  ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28" />)
                  : lanes[l.key].length === 0
                    ? (
                        <p className="px-2 py-10 text-center text-[12.5px] text-ink-muted">Bo‘sh — hammasi joyida</p>
                      )
                    : lanes[l.key].map(({ r, dl }) => (
                        <BoardCard key={r.id} r={r} dl={dl} lane={l.key} onOpen={() => onOpen(r.id)} />
                      ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {/* Owners */}
      <Card className="mt-5 overflow-hidden">
        <CardHeader title="Mas’ullar kesimi" subtitle="Kimda nechta ochiq, kechikkan va hal qilingan murojaat bor" />
        {byOwner.length === 0 ? (
          <p className="px-5 pb-6 text-sm text-ink-muted">Hali hech kimga biriktirilmagan</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
                  <th className="px-5 py-2.5 font-semibold">Xodim</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Ochiq</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Kechikkan</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Hal qilgan</th>
                  <th className="px-5 py-2.5 text-right font-semibold">Baho</th>
                </tr>
              </thead>
              <tbody>
                {byOwner.map((o) => (
                  <tr key={o.id} className="border-b border-line/60">
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <Avatar name={o.name} src={o.avatar ?? undefined} size={30} />
                        <span className="truncate font-medium text-ink">{o.name}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink">{o.open}</td>
                    <td className={cn('px-3 py-2.5 text-right font-semibold tabular-nums', o.overdue ? 'text-red-600' : 'text-ink-muted')}>
                      {o.overdue}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-ink-soft">{o.resolved}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">
                      {o.rating != null ? (
                        <span className="inline-flex items-center gap-1">
                          <Star1 size={13} variant="Bold" className="text-amber-500" /> {o.rating}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Summary({ label, value, color, loading }: { label: string; value: number; color: string; loading?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      {loading ? <Skeleton className="h-7 w-10" /> : (
        <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
      )}
      <p className="mt-0.5 truncate text-[12px] text-ink-muted">{label}</p>
    </div>
  );
}

function BoardCard({ r, dl, lane, onOpen }: { r: CitizenRequest; dl: DeadlineInfo; lane: Lane; onOpen: () => void }) {
  const late = lane === 'overdue';
  return (
    <button
      onClick={onOpen}
      className={cn(
        'block w-full rounded-xl border bg-surface p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-primary-500',
        late ? 'border-red-200 dark:border-red-900/60' : 'border-line',
      )}
    >
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
            r.kind === 'shikoyat' ? 'bg-danger-soft text-red-700' : 'bg-primary-50 text-primary-700 dark:bg-primary-500/10',
          )}
        >
          {r.kind === 'shikoyat' ? 'Shikoyat' : 'Ariza'}
        </span>
        {r.escalated && isOpen(r) && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-red-600 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">
            <Warning2 size={11} variant="Bold" /> Rahbariyatda
          </span>
        )}
        {!!r.reopenCount && <span className="text-[10.5px] font-semibold text-amber-600">×{r.reopenCount}</span>}
      </div>
      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold text-ink">{r.title}</p>
      <p className="mt-0.5 truncate text-[11.5px] text-ink-muted">
        {r.citizenName}
        {r.address ? ` · ${r.address}` : ''}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-soft">
          {r.assignedEmployee ? (
            <>
              <Avatar name={r.assignedEmployee.fullName} src={r.assignedEmployee.avatarUrl ?? undefined} size={20} />
              <span className="truncate">{r.assignedEmployee.fullName}</span>
            </>
          ) : (
            <span className="text-indigo-600">Biriktirilmagan</span>
          )}
        </span>
        {lane === 'rating' ? (
          <span className="shrink-0 text-[11px] font-medium text-primary-600">Hal qilindi</span>
        ) : (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold',
              late ? 'bg-red-600 text-white' : dl.urgency === 'critical' ? 'bg-warning-soft text-amber-700' : 'bg-surface-2 text-ink-soft',
            )}
          >
            {dl.label}
          </span>
        )}
      </div>
      {lane !== 'rating' && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.min(100, Math.round(dl.progress * 100))}%`, background: late ? '#ef4444' : dl.urgency === 'critical' ? '#f59e0b' : '#3b82f6' }}
          />
        </div>
      )}
    </button>
  );
}
