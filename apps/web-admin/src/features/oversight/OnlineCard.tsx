import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import { Skeleton } from '@/shared/ui/Skeleton';
import { clock, duration, history, timeline, type OnlineDay } from './online';

function useOnlineDay(employeeId: string, date: string, live: boolean) {
  return useQuery({
    queryKey: ['locations', 'online', employeeId, date],
    queryFn: () => api.get<OnlineDay>(`/locations/${encodeURIComponent(employeeId)}/online?date=${date}`),
    refetchInterval: live ? 30_000 : false,
  });
}

/** Kun vaqt chizig'i: kulrang — ish vaqti, yashil — joylashuv kelgan paytlar. */
export function OnlineBar({ day, labels = false }: { day: OnlineDay; labels?: boolean }) {
  const line = timeline(day);
  return (
    <span className="block">
      <span className="relative block h-3 overflow-hidden rounded-full bg-surface-2">
        <span
          className="absolute inset-y-0 bg-slate-300/60 dark:bg-slate-500/30"
          style={{ left: `${line.work.left}%`, width: `${line.work.width}%` }}
        />
        {line.online.map((o) => (
          <span
            key={o.span.from}
            title={`Onlayn ${clock(o.span.from)}–${clock(o.span.to)} · ${duration(o.span.minutes)}`}
            className="absolute inset-y-0 min-w-[2px] bg-emerald-500"
            style={{ left: `${o.left}%`, width: `${o.width}%` }}
          />
        ))}
      </span>
      {labels && (
        <span className="relative mt-1 block h-4 text-[10px] tabular-nums text-ink-muted">
          {line.hours.map((m) => {
            const left = ((m - line.start) / (line.end - line.start)) * 100;
            return (
              <span
                key={m}
                className="absolute top-0"
                style={{ left: `${left}%`, transform: `translateX(${left < 5 ? 0 : left > 95 ? -100 : -50}%)` }}
              >
                {String(m / 60).padStart(2, '0')}
              </span>
            );
          })}
        </span>
      )}
    </span>
  );
}

/** Bir xodimning bir kuni: qancha onlayn bo'lgan, qachondan qachongacha. */
export function OnlineCard({ employeeId, date, live }: { employeeId: string; date: string; live: boolean }) {
  const query = useOnlineDay(employeeId, date, live);
  const [all, setAll] = useState(false);
  const day = query.data;

  if (query.isPending) return <Skeleton className="h-36 w-full rounded-2xl" />;
  if (!day) {
    return (
      <p role="alert" className="rounded-2xl bg-danger-soft px-3 py-2 text-xs text-danger">
        Onlayn vaqtni yuklab bo‘lmadi.
      </p>
    );
  }
  const percent = day.windowMinutes ? Math.min(100, Math.round((day.coveredMinutes / day.windowMinutes) * 100)) : null;
  const rows = history(day);
  const shown = all ? rows : rows.slice(0, 5);

  return (
    <section className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
          Onlayn vaqt · {date.split('-').reverse().join('.')}
        </h3>
        {live && (
          <span className={cn('text-[11px] font-semibold', day.onlineSince ? 'text-emerald-600' : 'text-red-600')}>
            {day.onlineSince
              ? `Hozir onlayn · ${clock(day.onlineSince)} dan beri`
              : day.lastAt
                ? `Oflayn · ${clock(day.lastAt)} dan beri`
                : 'Bugun ulanmagan'}
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-ink">{duration(day.onlineMinutes)}</div>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[12px]">
        <Fact label={`Ish vaqtida (${day.workStartTime}–${day.workEndTime})`}>
          {percent === null ? '—' : `${duration(day.coveredMinutes)} · ${percent}%`}
        </Fact>
        <Fact label="Birinchi – oxirgi">
          {day.firstAt && day.lastAt ? `${clock(day.firstAt)} – ${clock(day.lastAt)}` : '—'}
        </Fact>
      </dl>
      <div className="mt-3">
        <OnlineBar day={day} labels />
      </div>
      {rows.length > 0 && (
        <ul className="mt-2 space-y-1">
          {shown.map((r) => (
            <li key={`${r.online}-${r.from}`} className="flex items-center gap-2 text-[12px]">
              <span className={cn('h-2 w-2 shrink-0 rounded-full', r.online ? 'bg-emerald-500' : 'bg-red-500')} />
              <span className="w-[86px] shrink-0 font-mono tabular-nums text-ink">
                {clock(r.from)}–{clock(r.to)}
              </span>
              <span className={r.online ? 'text-ink-soft' : 'text-red-600'}>
                {r.online ? 'Onlayn' : 'Uzilish'} · {duration(r.minutes)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 5 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-semibold text-primary-600">
          {all ? 'Qisqartirish' : `Hammasi (${rows.length})`}
        </button>
      )}
      <p className="mt-2 text-[10.5px] leading-snug text-ink-muted">
        {day.gapMinutes} daqiqadan uzun sukunat uzilish hisoblanadi. Internet yo‘q paytda yozilgan nuqtalar keyin
        kelsa, vaqtiga qo‘yiladi.
      </p>
    </section>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold tabular-nums text-ink">{children}</dd>
    </div>
  );
}
