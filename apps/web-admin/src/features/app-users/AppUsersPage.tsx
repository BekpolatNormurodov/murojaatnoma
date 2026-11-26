import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowDown2, Mobile, SearchNormal1 } from 'iconsax-react';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import { Avatar } from '@/shared/ui/Avatar';
import { Card } from '@/shared/ui/Card';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import {
  isOnline,
  matches,
  sortPeople,
  type CitizenUser,
  type EmployeeUser,
  type Filter,
  type Kind,
  type Session,
  type SessionsOverview,
} from './sessions';

const FILTERS: { key: Filter; label: string; tone: string }[] = [
  { key: 'all', label: 'Jami', tone: 'text-ink' },
  { key: 'online', label: 'Hozir faol', tone: 'text-emerald-600' },
  { key: 'signedIn', label: 'Ilovaga kirgan', tone: 'text-primary-600' },
  { key: 'signedOut', label: 'Kirmagan', tone: 'text-red-600' },
];

/** "Bugun 14:05" yoki "25.11 18:34" — Toshkent vaqti. */
function when(iso: string | null): string {
  if (!iso) return 'hech qachon';
  const d = new Date(iso);
  const zone = { timeZone: 'Asia/Tashkent' } as const;
  const day = d.toLocaleDateString('ru-RU', zone);
  const time = d.toLocaleTimeString('ru-RU', { ...zone, hour: '2-digit', minute: '2-digit' });
  return day === new Date().toLocaleDateString('ru-RU', zone) ? `Bugun ${time}` : `${day.slice(0, 5)} ${time}`;
}

const phoneModel = (s: { device: string | null; appVersion: string | null }) =>
  s.device ?? (s.appVersion ? 'Telefon nomi yo‘q' : 'Ma’lumot yo‘q (eski ilova)');

/** Xodim va fuqaro ilovalariga kim kirgan, qaysi telefondan va sessiyalari. */
export function AppUsersPage() {
  const [kind, setKind] = useState<Kind>('employees');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const data = useQuery({
    queryKey: ['app-users', 'sessions'],
    queryFn: () => api.get<SessionsOverview>('/app-users/sessions'),
    refetchInterval: 30_000,
  });

  const people: (EmployeeUser | CitizenUser)[] = data.data?.[kind] ?? [];
  const shown = sortPeople(people.filter((p) => matches(p, filter, query)));
  const count = (f: Filter) => (data.data ? people.filter((p) => matches(p, f, '')).length : '…');

  return (
    <div>
      <PageHeader title="Ilova foydalanuvchilari" subtitle="Mobil ilovalarga kirganlar, telefonlari va faol sessiyalari" />

      <div role="tablist" className="mb-4 inline-flex rounded-xl bg-surface-2 p-1">
        {(
          [
            ['employees', 'Xodimlar'],
            ['citizens', 'Fuqarolar'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={kind === key}
            onClick={() => {
              setKind(key);
              setFilter('all');
              setOpen(null);
            }}
            className={cn(
              'h-10 rounded-lg px-5 text-sm font-semibold transition-colors',
              kind === key ? 'bg-surface text-ink shadow-soft' : 'text-ink-muted hover:text-ink',
            )}
          >
            {label}
            {data.data && <span className="ml-2 tabular-nums text-ink-muted">{data.data[key].length}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'rounded-2xl border bg-surface p-4 text-left shadow-soft transition-colors',
              filter === f.key ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-line hover:bg-surface-2',
            )}
          >
            <div className={cn('text-2xl font-bold tabular-nums', f.tone)}>{count(f.key)}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{f.label}</div>
          </button>
        ))}
      </div>

      <label className="mb-3 flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3">
        <SearchNormal1 size={18} className="text-ink-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ism, telefon raqami yoki telefon rusumi"
          className="h-full flex-1 bg-transparent text-sm text-ink outline-none"
        />
      </label>

      <Card className="overflow-hidden p-0">
        {data.isPending ? (
          <Skeleton className="h-64 w-full" />
        ) : !data.data ? (
          <p role="alert" className="p-6 text-center text-sm text-danger">
            Ro‘yxatni yuklab bo‘lmadi.{' '}
            <button className="font-semibold underline" onClick={() => data.refetch()}>
              Qayta urinish
            </button>
          </p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-ink-muted">
            {kind === 'citizens' && people.length === 0
              ? 'Fuqaro ilovasiga hali hech kim kirmagan.'
              : 'Bu ro‘yxatda hech kim yo‘q.'}
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((p) => (
              <PersonRow key={p.id} person={p} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PersonRow({ person, open, onToggle }: { person: EmployeeUser | CitizenUser; open: boolean; onToggle: () => void }) {
  const navigate = useNavigate();
  const employee = 'position' in person ? person : null;
  const online = isOnline(person);
  const count = person.sessions.length;
  const name = person.name ?? 'Ismi ko‘rsatilmagan';

  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left hover:bg-surface-2"
      >
        <span className="flex min-w-[220px] flex-1 items-center gap-3">
          <Avatar name={person.name ?? '?'} src={employee?.avatarUrl ?? undefined} status={online ? 'online' : 'offline'} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{name}</span>
            <span className="block truncate text-xs tabular-nums text-ink-muted">
              {person.phone}
              {employee?.username ? ` · ${employee.username}` : ''}
              {!employee ? ` · ${(person as CitizenUser).applications} ta murojaat` : ''}
            </span>
          </span>
        </span>
        <span className="grid w-full grid-cols-2 gap-3 text-xs sm:w-auto sm:grid-cols-[240px_110px_110px_20px]">
          <span className="col-span-2 min-w-0 sm:col-span-1">
            <span className="flex items-center gap-1 text-ink-muted">
              <Mobile size={13} /> Telefon
            </span>
            <span className="block truncate font-semibold text-ink">{count || person.device ? phoneModel(person) : '—'}</span>
            <span className="block text-[11px] text-ink-muted">
              {person.appVersion ? `Ilova ${person.appVersion}` : ''}
              {employee?.battery != null ? ` · batareya ${employee.battery}%` : ''}
            </span>
          </span>
          <span>
            <span className="block text-ink-muted">Oxirgi faollik</span>
            <span className={cn('block font-semibold tabular-nums', online ? 'text-emerald-600' : 'text-ink')}>
              {when(person.lastSeenAt)}
            </span>
          </span>
          <span>
            <span className="block text-ink-muted">Sessiyalar</span>
            <span className={cn('block font-semibold', count ? 'text-ink' : 'text-red-600')}>
              {count ? `${count} ta faol` : 'Kirmagan'}
            </span>
          </span>
          <ArrowDown2 size={16} className={cn('self-center text-ink-muted transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 bg-surface-2/60 px-4 py-3">
          {count === 0 && <p className="text-xs text-ink-muted">Faol sessiya yo‘q: ilovaga kirilmagan yoki chiqilgan.</p>}
          {person.sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
          {employee && (
            <button
              type="button"
              onClick={() => navigate(`/oversight/${encodeURIComponent(employee.id)}`)}
              className="text-xs font-semibold text-primary-600 hover:underline"
            >
              Xodim sahifasini ochish
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function SessionRow({ session }: { session: Session }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs sm:grid-cols-[1fr_130px_130px_130px]">
      <span className="col-span-2 min-w-0 sm:col-span-1">
        <span className="block truncate font-semibold text-ink">{phoneModel(session)}</span>
        <span className="block text-ink-muted">
          {[session.platform, session.appVersion && `ilova ${session.appVersion}`].filter(Boolean).join(' · ') || '—'}
        </span>
      </span>
      {(
        [
          ['Kirgan', session.startedAt],
          ['Oxirgi faollik', session.lastSeenAt],
          ['Amal qiladi', session.expiresAt],
        ] as const
      ).map(([label, iso]) => (
        <span key={label}>
          <span className="block text-ink-muted">{label}</span>
          <span className="block font-medium tabular-nums text-ink">{when(iso)}</span>
        </span>
      ))}
    </div>
  );
}
