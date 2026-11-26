import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { SearchNormal1 } from 'iconsax-react';
import { useAttendanceToday, todayIso } from '@/features/attendance/useAttendanceToday';
import { clock, duration } from '@/features/oversight/online';
import { OnlineBar } from '@/features/oversight/OnlineCard';
import { useActivity } from '@/features/oversight/useActivity';
import { api } from '@/shared/api/client';
import { fetchLiveLocations } from '@/shared/api/locations';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { buildRows, matches, type Coverage, type Filter, type Row } from './monitoring';

const CARDS: { key: Filter; label: string; tone: string }[] = [
  { key: 'all', label: 'Jami xodim', tone: 'text-ink' },
  { key: 'silent', label: 'Joylashuv kelmayapti', tone: 'text-red-600' },
  { key: 'settings', label: 'Telefon sozlamasi xato', tone: 'text-amber-600' },
  { key: 'absent', label: 'Ishga kelmagan', tone: 'text-red-600' },
  { key: 'noreport', label: 'Hisobot yubormagan', tone: 'text-amber-600' },
];

const time = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tashkent' })
    : '—';

/** Oxirgi aloqa bugun bo'lmasa sanasi ham ko'rsatiladi. */
function lastSeen(iso: string | null): string {
  if (!iso) return 'hech qachon';
  const day = new Date(iso).toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
  const today = new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' });
  return day === today ? time(iso) : `${day.slice(0, 5)} ${time(iso)}`;
}

/** Bugungi kun: kim joylashuv yubormayapti va nega, kim kelmagan, kim hisobot bermagan. */
export function MonitoringPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const today = todayIso();

  const live = useQuery({ queryKey: ['locations', 'latest'], queryFn: fetchLiveLocations, refetchInterval: 30_000 });
  const coverage = useQuery({
    queryKey: ['locations', 'coverage'],
    queryFn: () => api.get<Coverage[]>('/locations/coverage'),
    refetchInterval: 60_000,
  });
  const attendance = useAttendanceToday();
  const activity = useActivity(today, today);

  const rows = useMemo(
    () =>
      buildRows({
        people: live.data ?? [],
        coverage: coverage.data,
        attendance: attendance.data?.roster,
        reports: activity.data?.rows,
      }),
    [live.data, coverage.data, attendance.data, activity.data],
  );
  const q = query.trim().toLowerCase();
  const shown = rows.filter((r) => matches(r, filter) && (!q || r.fullName.toLowerCase().includes(q)));
  const partial = coverage.isError || attendance.isError || activity.isError;

  return (
    <div>
      <PageHeader title="Kunlik monitoring" subtitle="Bugungi holat — har 30 soniyada yangilanadi" />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={filter === c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              'rounded-2xl border bg-surface p-4 text-left shadow-soft transition-colors',
              filter === c.key ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-line hover:bg-surface-2',
            )}
          >
            <div className={cn('text-2xl font-bold tabular-nums', c.tone)}>
              {live.isPending ? '…' : rows.filter((r) => matches(r, c.key)).length}
            </div>
            <div className="mt-0.5 text-xs text-ink-muted">{c.label}</div>
          </button>
        ))}
      </div>

      {(partial || live.isError) && (
        <p role="alert" className="mb-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          Ma’lumotning bir qismi yuklanmadi — ko‘rsatkichlar to‘liq bo‘lmasligi mumkin.
        </p>
      )}

      <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3">
        <SearchNormal1 size={18} className="text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Xodimni qidirish"
          className="h-full flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </label>

      <Card className="overflow-hidden p-0">
        {live.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">Bu ro‘yxatda hech kim yo‘q.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((r) => (
              <li key={r.employeeId}>
                <button
                  type="button"
                  onClick={() => navigate(`/oversight/${encodeURIComponent(r.employeeId)}`)}
                  className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <Person row={r} />
                  <Facts row={r} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Person({ row }: { row: Row }) {
  return (
    <span className="flex min-w-[220px] flex-1 items-center gap-3">
      <Avatar name={row.fullName} src={row.avatarUrl ?? undefined} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{row.fullName}</span>
        <span
          className={cn(
            'block text-xs',
            row.off ? 'text-ink-muted' : !row.sending ? 'text-red-600' : row.problem ? 'text-amber-600' : 'text-emerald-600',
          )}
        >
          {row.off ? 'Ta’til yoki dam olish kuni' : (row.problem ?? 'Joylashuv kelyapti')}
        </span>
      </span>
    </span>
  );
}

function Facts({ row }: { row: Row }) {
  const pct = row.coverage;
  const day = row.day;
  return (
    <span className="grid w-full grid-cols-2 gap-3 text-xs sm:w-auto sm:grid-cols-[230px_100px_70px_80px]">
      <span className="col-span-2 sm:col-span-1">
        <span className="block text-ink-muted">Bugun onlayn</span>
        <span className="block font-semibold tabular-nums text-ink">
          {day ? duration(day.onlineMinutes) : '—'}
          {pct !== null && (
            <span className={cn('ml-1', pct >= 80 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600')}>
              · ish vaqtining {pct}%
            </span>
          )}
        </span>
        {day && (
          <span className="mt-1 block">
            <OnlineBar day={day} />
          </span>
        )}
        <span className="mt-0.5 block text-[11px] tabular-nums text-ink-muted">
          {day?.onlineSince
            ? `${clock(day.onlineSince)} dan beri onlayn`
            : day?.lastAt
              ? `${clock(day.lastAt)} dan beri oflayn`
              : 'bugun ulanmagan'}
        </span>
      </span>
      <span>
        <span className="block text-ink-muted">Oxirgi aloqa</span>
        <span className="font-semibold tabular-nums text-ink">{lastSeen(row.lastLocationAt)}</span>
      </span>
      <span>
        <span className="block text-ink-muted">Keldi</span>
        <span className={cn('font-semibold tabular-nums', row.lateMinutes > 0 ? 'text-amber-600' : 'text-ink')}>
          {time(row.checkInAt)}
        </span>
      </span>
      <span>
        <span className="block text-ink-muted">Hisobot</span>
        <span className={cn('font-semibold', row.reportSent ? 'text-emerald-600' : 'text-ink')}>
          {row.reportSent === null ? '…' : row.reportSent ? 'Yuborgan' : 'Yo‘q'}
        </span>
      </span>
    </span>
  );
}
