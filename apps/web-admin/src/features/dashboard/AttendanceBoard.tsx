import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarTick,
  LoginCurve,
  LogoutCurve,
  RotateRight,
  ShieldCross,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Skeleton, SkeletonRow } from '@/shared/ui/Skeleton';
import { cn } from '@/shared/lib/cn';
import { useAttendanceToday, todayIso } from '@/features/attendance/useAttendanceToday';
import {
  attendanceEvents,
  clockOf,
  minutesText,
  type AttendanceEvent,
} from '@/features/attendance/attendanceMeta';
import type { EmployeeTodayEntry } from '@/features/attendance/api/types';
import { EmployeeStatsDrawer } from '@/features/oversight/EmployeeStatsDrawer';

type Tab = 'late' | 'absent' | 'issues';

/**
 * Dashboard'dagi jonli davomat taxtasi: bugun kim keldi/ketdi, kim kechikdi,
 * kim kelmadi, rad etilgan urinishlar. /attendance/today dan mustaqil
 * o'qiydi (analytics/overview ishlamasa ham ko'rinadi), 30 soniyada yangilanadi.
 * Xodimni bosganda — o'sha kunning to'liq tafsiloti (drawer).
 */
export function AttendanceBoard() {
  const { data, isLoading, isError, refetch } = useAttendanceToday(todayIso());
  const [tab, setTab] = useState<Tab>('late');
  const [selected, setSelected] = useState<EmployeeTodayEntry | null>(null);

  const roster = useMemo(() => (Array.isArray(data?.roster) ? data.roster : []), [data]);
  const events = useMemo(() => attendanceEvents(roster).slice(0, 7), [roster]);

  const s = useMemo(() => {
    const checkedIn = roster.filter((r) => r.checkIn);
    const late = checkedIn.filter((r) => r.checkIn!.isLate);
    const onLeave = roster.filter((r) => r.status === 'leave').length;
    return {
      total: roster.length,
      onLeave,
      checkedIn: checkedIn.length,
      onTime: checkedIn.length - late.length,
      late: late.length,
      // Ta'tildagi / dam olish kunidagi xodim "kelmagan" emas.
      absent: roster.filter((r) => r.status === 'absent').length,
      working: checkedIn.filter((r) => !r.checkOut).length,
      left: checkedIn.filter((r) => r.checkOut).length,
      early: roster.filter((r) => (r.earlyLeaveMinutes ?? 0) > 0).length,
      lists: {
        late: [...late].sort((a, b) => b.checkIn!.lateMinutes - a.checkIn!.lateMinutes),
        absent: roster.filter((r) => r.status === 'absent'),
        issues: roster.filter(
          (r) =>
            (r.failedScans?.length ?? 0) > 0 ||
            (r.earlyLeaveMinutes ?? 0) > 0 ||
            (!!r.checkIn && !r.checkOut && !!r.live && !r.live.stale && !r.live.insideZone),
        ),
      } satisfies Record<Tab, EmployeeTodayEntry[]>,
    };
  }, [roster]);

  const pct = (n: number) => (s.total ? (n / s.total) * 100 : 0);
  const schedule =
    data?.workStartTime && data?.workEndTime ? `${data.workStartTime}–${data.workEndTime}` : null;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-info-soft text-accent-600">
            <CalendarTick size={19} variant="Bulk" />
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
              Xodimlar davomati · bugun
              <span className="relative flex h-2 w-2" aria-label="Jonli">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-500" />
              </span>
            </h3>
            <p className="text-xs text-ink-muted">
              {data?.isWorkday === false
                ? 'Bugun dam olish kuni — kelmaganlar hisoblanmaydi'
                : `${schedule ? `Ish vaqti ${schedule} · ` : ''}kelish/ketish yuz va joy bilan tasdiqlanadi`}
            </p>
          </div>
        </div>
        <Link
          to="/attendance"
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-500/10"
        >
          <span className="hidden sm:inline">Davomat</span>
          <ArrowRight size={16} />
        </Link>
      </div>

      {isError && !data ? (
        <div className="mt-5 flex flex-col items-center gap-2 py-8 text-center text-sm text-ink-muted">
          Davomatni yuklab bo'lmadi
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] text-ink-soft hover:text-ink"
          >
            <RotateRight size={15} /> Qayta urinish
          </button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Umumiy holat */}
          <div className="lg:col-span-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-40" />
                <Skeleton className="h-3" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14" />
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <span className="text-3xl font-bold tabular-nums text-ink">{s.checkedIn}</span>
                    <span className="text-sm text-ink-muted"> / {s.total} ishga keldi</span>
                  </div>
                  <span className="pb-1 text-sm font-semibold tabular-nums text-ink-soft">
                    {Math.round(pct(s.checkedIn))}%
                  </span>
                </div>
                <div
                  className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-surface-2"
                  role="img"
                  aria-label={`O'z vaqtida ${s.onTime}, kechikib ${s.late}, kelmagan ${s.absent}`}
                >
                  <div className="bg-primary-500" style={{ width: `${pct(s.onTime)}%` }} />
                  <div className="bg-amber-500" style={{ width: `${pct(s.late)}%` }} />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
                  <Legend color="bg-primary-500" label={`O'z vaqtida ${s.onTime}`} />
                  <Legend color="bg-amber-500" label={`Kechikib ${s.late}`} />
                  <Legend color="bg-surface-2 ring-1 ring-line" label={`Kelmagan ${s.absent}`} />
                  {s.onLeave > 0 && <Legend color="bg-sky-500" label={`Ta'tilda ${s.onLeave}`} />}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Mini label="Ishda" value={s.working} />
                  <Mini label="Kechikdi" value={s.late} tone={s.late ? 'amber' : undefined} />
                  <Mini label="Kelmadi" value={s.absent} tone={s.absent ? 'red' : undefined} />
                  <Mini label="Ketdi" value={s.left} />
                  <Mini label="Erta ketdi" value={s.early} tone={s.early ? 'red' : undefined} />
                  <Mini
                    label="Rad etildi"
                    value={roster.filter((r) => (r.failedScans?.length ?? 0) > 0).length}
                    tone={roster.some((r) => (r.failedScans?.length ?? 0) > 0) ? 'red' : undefined}
                  />
                </div>
              </>
            )}
          </div>

          {/* Jonli lenta */}
          <div className="min-w-0 lg:col-span-4 lg:border-l lg:border-line lg:pl-5">
            <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              So'nggi harakatlar
            </p>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} className="px-0" />)
            ) : events.length === 0 ? (
              <div className="flex min-h-40 items-center justify-center text-center text-sm text-ink-muted">
                Bugun hali hech kim belgilanmagan
              </div>
            ) : (
              <ul className="space-y-0.5">
                {events.map((ev) => (
                  <EventRow key={ev.key} ev={ev} onOpen={() => setSelected(ev.entry)} />
                ))}
              </ul>
            )}
          </div>

          {/* E'tibor talab qiladi */}
          <div className="min-w-0 lg:col-span-4 lg:border-l lg:border-line lg:pl-5">
            <div className="mb-2 flex gap-1 rounded-lg bg-surface-2 p-0.5" role="tablist">
              {(
                [
                  ['late', 'Kechikkan'],
                  ['absent', 'Kelmagan'],
                  ['issues', 'Muammo'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-medium transition-colors',
                    tab === key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {label}
                  {!isLoading && (
                    <span className="tabular-nums text-ink-muted">{s.lists[key].length}</span>
                  )}
                </button>
              ))}
            </div>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} className="px-0" />)
            ) : s.lists[tab].length === 0 ? (
              <div className="flex min-h-40 items-center justify-center text-center text-sm text-ink-muted">
                {tab === 'late'
                  ? 'Bugun hech kim kechikmadi'
                  : tab === 'absent'
                    ? 'Hamma ishga keldi'
                    : "Muammo yo'q"}
              </div>
            ) : (
              <ul className="max-h-[296px] space-y-0.5 overflow-y-auto pr-1">
                {s.lists[tab].map((r) => (
                  <li key={r.employeeId}>
                    <button
                      onClick={() => setSelected(r)}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
                    >
                      <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">
                          {r.fullName}
                        </span>
                        <span className="block truncate text-[11.5px] text-ink-muted">{r.position}</span>
                      </span>
                      <span className="shrink-0 text-right text-[12px]">
                        <IssueText r={r} tab={tab} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <EmployeeStatsDrawer
        employeeId={selected?.employeeId ?? null}
        fullName={selected?.fullName}
        position={selected?.position}
        avatarUrl={selected?.avatarUrl}
        phone={selected?.phone}
        day={selected}
        dayLabel="Bugun"
        onClose={() => setSelected(null)}
      />
    </Card>
  );
}

function IssueText({ r, tab }: { r: EmployeeTodayEntry; tab: Tab }) {
  if (tab === 'late' && r.checkIn) {
    return (
      <>
        <span className="block font-semibold tabular-nums text-ink">{clockOf(r.checkIn.time)}</span>
        <span className="text-amber-600">+{minutesText(r.checkIn.lateMinutes)}</span>
      </>
    );
  }
  if (tab === 'absent') {
    // Qo'ng'iroq tugmasi drawer'da (button ichida havola bo'lmasligi kerak).
    return (
      <span className="text-red-600">{absentLabel(r.workStartTime)}</span>
    );
  }
  const failed = r.failedScans?.length ?? 0;
  const early = r.earlyLeaveMinutes ?? 0;
  return (
    <span className="flex flex-col items-end text-red-600">
      {failed > 0 && <span>{failed} rad etilgan</span>}
      {early > 0 && <span>{minutesText(early)} erta</span>}
      {r.live && !r.live.stale && !r.live.insideZone && !r.checkOut && <span>Hududdan tashqarida</span>}
    </span>
  );
}

/** Ish boshlanmagan bo'lsa "hali kelmagan", boshlangan bo'lsa "09:00 dan beri yo'q". */
function absentLabel(workStart: string | undefined): string {
  if (!workStart) return 'Kelmadi';
  const [h, m] = workStart.split(':').map(Number);
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes() < h * 60 + (m || 0)
    ? 'Hali kelmagan'
    : `${workStart} dan beri yo'q`;
}

function EventRow({ ev, onOpen }: { ev: AttendanceEvent; onOpen: () => void }) {
  const Icon = ev.kind === 'in' ? LoginCurve : ev.kind === 'out' ? LogoutCurve : ShieldCross;
  return (
    <li>
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-surface-2"
      >
        <span className="relative shrink-0">
          <Avatar name={ev.entry.fullName} src={ev.entry.avatarUrl ?? undefined} size={32} />
          <span
            className={cn(
              'absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full text-white ring-2 ring-surface',
              ev.kind === 'in' && (ev.tone === 'warning' ? 'bg-amber-500' : 'bg-primary-500'),
              ev.kind === 'out' && 'bg-indigo-500',
              ev.kind === 'failed' && 'bg-red-500',
            )}
          >
            <Icon size={10} />
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-ink">{ev.entry.fullName}</span>
          <span
            className={cn(
              'block truncate text-[11.5px]',
              ev.tone === 'warning' && 'text-amber-600',
              ev.tone === 'danger' && 'text-red-600',
              (ev.tone === 'success' || ev.tone === 'info') && 'text-ink-muted',
            )}
          >
            {ev.kind === 'in' ? 'Keldi' : ev.kind === 'out' ? 'Ketdi' : 'Rad etildi'} · {ev.note}
          </span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">{clockOf(ev.time)}</span>
      </button>
    </li>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: 'amber' | 'red' }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2 text-center">
      <div
        className={cn(
          'text-lg font-bold tabular-nums',
          tone === 'amber' ? 'text-amber-600' : tone === 'red' ? 'text-red-600' : 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="truncate text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('h-2 w-2 rounded-full', color)} />
      {label}
    </span>
  );
}
