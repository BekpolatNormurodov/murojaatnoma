import { useMemo, useState } from 'react';
import {
  CloseCircle,
  DocumentDownload,
  Profile2User,
  RotateRight,
  SearchNormal1,
  TickCircle,
  Timer1,
  Clock,
  CalendarRemove,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { MonthPicker } from '@/shared/ui/MonthPicker';
import { DateRangePicker } from '@/shared/ui/DatePicker';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';
import { exportWorkbook, type ExportColumn } from '@/shared/lib/export';
import { useTimesheet, type TimesheetCell, type TimesheetRow } from './useTimesheet';
import { useAttendanceToday } from './useAttendanceToday';
import { AttendanceDayDetail } from './AttendanceDayDetail';

const WD = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function monthRange(value: string) {
  const [y, m] = value.split('-').map(Number);
  return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
}

const fmtMin = (m: number) => (m <= 0 ? '—' : m >= 60 ? `${Math.floor(m / 60)} s ${m % 60} d` : `${m} d`);
const fmtHours = (h: number) => (Number.isInteger(h) ? String(h) : h.toFixed(1));

type Mode = 'hours' | 'times';

/** Katak ko'rinishi: rang, asosiy matn va izoh (tooltip). */
function cellLook(c: TimesheetCell, mode: Mode) {
  const late = c.lateMinutes > 0;
  switch (c.status) {
    case 'future':
      return { cls: '', text: '', title: '' };
    case 'dayoff':
      return c.in
        ? { cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300', text: mode === 'hours' && c.hours != null ? fmtHours(c.hours) : c.in, title: `Dam olish kuni, lekin keldi ${c.in}` }
        : { cls: 'bg-surface-2/70 text-ink-muted/60', text: '', title: 'Dam olish kuni' };
    case 'leave':
      return { cls: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300', text: 'T', title: `Ta'tilda${c.leave ? ` — ${c.leave}` : ''}` };
    case 'absent':
      return { cls: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400', text: 'Y', title: 'Kelmagan' };
    default: {
      const tone = late
        ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300';
      const text =
        mode === 'times' ? c.in ?? '' : c.hours != null ? fmtHours(c.hours) : c.in ? `${c.in}` : '';
      const title = [
        `Keldi ${c.in ?? '—'}${late ? ` (${c.lateMinutes} daq kechikdi)` : ''}`,
        `Ketdi ${c.out ?? '— (hali ishda yoki belgilamagan)'}${c.earlyMinutes ? ` (${c.earlyMinutes} daq erta)` : ''}`,
        c.hours != null ? `${fmtHours(c.hours)} soat ishladi` : '',
        c.excused ? 'Soatlik ruxsat bilan' : '',
      ]
        .filter(Boolean)
        .join('\n');
      return { cls: tone, text, title };
    }
  }
}

/**
 * Tabel — barcha xodimlar × oyning (yoki tanlangan oraliqning) har kuni:
 * soat yoki keldi vaqti, kechikish (sariq), kelmagan (Y), ta'til (T), dam
 * olish (kulrang); o'ngda jami va norma, pastda kunlik "keldi/kerak".
 * Katak bosilsa — o'sha kunning tafsiloti (yuz kadrlari bilan).
 */
export function AttendanceTimesheet() {
  const now = new Date();
  const [period, setPeriod] = useState<'month' | 'range'>('month');
  const [month, setMonth] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}`);
  const [range, setRange] = useState(() => ({ from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) }));
  const [mode, setMode] = useState<Mode>('hours');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState('all');
  const [open, setOpen] = useState<{ row: TimesheetRow; date: string } | null>(null);

  const { from, to } = period === 'month' ? monthRange(month) : range;
  const { data, isLoading, isError, error, refetch, isFetching } = useTimesheet(from, to);

  const departments = useMemo(
    () => [...new Set((data?.rows ?? []).map((r) => r.department).filter((d): d is string => !!d))].sort(),
    [data],
  );
  const rows = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r) =>
          matchesSearch(query, r.fullName, r.position, r.department) &&
          (dept === 'all' || (dept === 'none' ? !r.department : r.department === dept)),
      ),
    [data, query, dept],
  );

  const summary = useMemo(() => {
    const t = rows.reduce(
      (a, r) => ({
        workdays: a.workdays + r.totals.workdays,
        came: a.came + r.cells.filter((c) => c.in && c.status !== 'dayoff').length,
        late: a.late + r.totals.late,
        lateMinutes: a.lateMinutes + r.totals.lateMinutes,
        absent: a.absent + r.totals.absent,
        leave: a.leave + r.totals.leave,
        hours: a.hours + r.totals.hours,
        norm: a.norm + r.totals.normHours,
      }),
      { workdays: 0, came: 0, late: 0, lateMinutes: 0, absent: 0, leave: 0, hours: 0, norm: 0 },
    );
    return { ...t, rate: t.workdays ? Math.round((t.came / t.workdays) * 100) : null };
  }, [rows]);

  const periodLabel =
    period === 'month'
      ? `${MONTHS[Number(month.split('-')[1]) - 1]} ${month.split('-')[0]}`
      : `${from.split('-').reverse().join('.')} — ${to.split('-').reverse().join('.')}`;

  function exportExcel() {
    if (!data) return;
    const dayCols: ExportColumn<TimesheetRow>[] = data.days.map((d, i) => ({
      header: `${d.date.slice(8)} ${WD[d.weekday]}`,
      align: 'center',
      value: (r) => {
        const c = r.cells[i];
        if (c.status === 'future') return '';
        if (c.status === 'absent') return 'Y';
        if (c.status === 'leave') return 'T';
        if (c.status === 'dayoff' && !c.in) return 'D';
        return mode === 'times' ? `${c.in ?? ''}-${c.out ?? ''}` : c.hours != null ? Number(c.hours.toFixed(1)) : c.in ?? '';
      },
    }));
    const cols: ExportColumn<TimesheetRow>[] = [
      { header: 'F.I.Sh.', value: (r) => r.fullName },
      { header: 'Lavozim', value: (r) => r.position },
      { header: "Bo'lim", value: (r) => r.department ?? '' },
      ...dayCols,
      { header: 'Ish kuni', value: (r) => r.totals.workdays, align: 'right' },
      { header: 'Keldi', value: (r) => r.totals.came, align: 'right' },
      { header: 'Kechikish', value: (r) => r.totals.late, align: 'right' },
      { header: 'Kechikish (daq)', value: (r) => r.totals.lateMinutes, align: 'right' },
      { header: 'Erta ketish', value: (r) => r.totals.earlyLeaves, align: 'right' },
      { header: 'Kelmagan', value: (r) => r.totals.absent, align: 'right' },
      { header: "Ta'til", value: (r) => r.totals.leave, align: 'right' },
      { header: 'Soat', value: (r) => r.totals.hours, align: 'right', total: (rs) => Math.round(rs.reduce((s, r) => s + r.totals.hours, 0) * 10) / 10 },
      { header: 'Norma (soat)', value: (r) => r.totals.normHours, align: 'right' },
    ];
    exportWorkbook(`tabel_${from}_${to}`, [
      {
        name: 'Tabel',
        columns: cols,
        rows,
        opts: {
          title: `Davomat tabeli — ${periodLabel}`,
          subtitle: "Mirzo Ulug'bek tumani hokimligi · Y — kelmagan, T — ta'til, D — dam olish",
        },
      },
    ]);
  }

  return (
    <div className="space-y-4">
      {/* Boshqaruv */}
      <Card className="flex flex-col gap-3 p-3 sm:p-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-11 rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Davr">
            {(
              [
                ['month', 'Oy'],
                ['range', 'Oraliq'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={period === k}
                onClick={() => setPeriod(k)}
                className={cn(
                  'rounded-[10px] px-3.5 text-[13px] font-medium transition-colors',
                  period === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {l}
              </button>
            ))}
          </div>
          {period === 'month' ? (
            <MonthPicker value={month} onChange={setMonth} className="w-48" />
          ) : (
            <DateRangePicker from={range.from} to={range.to} onChange={setRange} />
          )}
          <div className="flex h-11 rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Katakda">
            {(
              [
                ['hours', 'Soatlar'],
                ['times', 'Keldi vaqti'],
              ] as const
            ).map(([k, l]) => (
              <button
                key={k}
                role="tab"
                aria-selected={mode === k}
                onClick={() => setMode(k)}
                className={cn(
                  'rounded-[10px] px-3 text-[13px] font-medium transition-colors',
                  mode === k ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <SearchNormal1 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Xodimni qidirish…"
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300"
            />
          </div>
          {departments.length > 0 && (
            <Select
              value={dept}
              onChange={setDept}
              options={[
                { value: 'all', label: "Barcha bo'limlar" },
                ...departments.map((d) => ({ value: d, label: d })),
                { value: 'none', label: "Bo'limsiz" },
              ]}
              className="w-52"
            />
          )}
          <Button variant="secondary" onClick={exportExcel} disabled={!data || rows.length === 0}>
            <DocumentDownload size={17} /> Excel
          </Button>
        </div>
      </Card>

      {/* Xulosa */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Summary icon={Profile2User} color="#3b82f6" label="Xodimlar" value={String(rows.length)} hint={periodLabel} />
        <Summary
          icon={TickCircle}
          color="#10b981"
          label="Davomat"
          value={summary.rate == null ? '—' : `${summary.rate}%`}
          hint={`${summary.came} / ${summary.workdays} ish kuni`}
        />
        <Summary icon={Timer1} color="#f59e0b" label="Kechikishlar" value={String(summary.late)} hint={fmtMin(summary.lateMinutes)} />
        <Summary icon={CloseCircle} color="#ef4444" label="Kelmagan (kun)" value={String(summary.absent)} />
        <Summary icon={CalendarRemove} color="#0ea5e9" label="Ta'tilda (kun)" value={String(summary.leave)} />
        <Summary
          icon={Clock}
          color="#8b5cf6"
          label="Ishlangan soat"
          value={fmtHours(Math.round(summary.hours * 10) / 10)}
          hint={summary.norm ? `norma ${fmtHours(Math.round(summary.norm))} · ${Math.round((summary.hours / summary.norm) * 100)}%` : undefined}
        />
      </div>

      {/* Jadval */}
      <Card className="overflow-hidden">
        {isError && !data ? (
          <div className="flex flex-col items-center gap-3 p-14 text-center">
            <CloseCircle size={40} variant="Bulk" className="text-danger" />
            <p className="text-sm text-ink-muted">{error instanceof Error ? error.message : "Yuklab bo'lmadi"}</p>
            <Button variant="secondary" onClick={() => refetch()}>
              <RotateRight size={16} /> Qayta urinish
            </Button>
          </div>
        ) : isLoading || !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-surface-2" />
            ))}
          </div>
        ) : (
          <div className={cn('max-h-[72vh] overflow-auto', isFetching && 'opacity-70')}>
            <table className="border-separate border-spacing-0 text-[12px]">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 min-w-[230px] border-b border-r border-line bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                    Xodim
                  </th>
                  {data.days.map((d) => (
                    <th
                      key={d.date}
                      className={cn(
                        'sticky top-0 z-20 min-w-[44px] border-b border-line px-0.5 py-1.5 text-center font-semibold',
                        d.isToday ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15' : d.isWorkday ? 'bg-surface text-ink' : 'bg-surface-2 text-ink-muted',
                      )}
                    >
                      <div className="text-[13px] tabular-nums">{Number(d.date.slice(8))}</div>
                      <div className="text-[10px] font-medium opacity-70">{WD[d.weekday]}</div>
                    </th>
                  ))}
                  {['Keldi', 'Kech.', 'Yo‘q', 'T', 'Soat'].map((h, i) => (
                    <th
                      key={h}
                      className={cn(
                        'sticky top-0 z-20 min-w-[58px] border-b border-line bg-surface px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-muted',
                        i === 0 && 'border-l-2',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={data.days.length + 6} className="px-4 py-14 text-center text-sm text-ink-muted">
                      Xodim topilmadi
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.employeeId} className="group">
                    <td className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-1.5 group-hover:bg-surface-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.fullName} src={r.avatarUrl ?? undefined} size={30} />
                        <div className="min-w-0">
                          <div className="max-w-[170px] truncate text-[13px] font-semibold text-ink" title={r.fullName}>
                            {r.fullName}
                          </div>
                          <div className="max-w-[170px] truncate text-[11px] text-ink-muted">
                            {r.position} · {r.workStartTime}–{r.workEndTime}
                          </div>
                        </div>
                      </div>
                    </td>
                    {r.cells.map((c) => {
                      const look = cellLook(c, mode);
                      const clickable = c.status !== 'future' && c.status !== 'dayoff';
                      return (
                        <td key={c.date} className="border-b border-line/70 p-0.5">
                          <button
                            type="button"
                            disabled={!clickable && !c.in}
                            title={look.title}
                            onClick={() => setOpen({ row: r, date: c.date })}
                            className={cn(
                              'relative flex h-9 w-full items-center justify-center rounded-md text-[11.5px] font-semibold tabular-nums transition-[filter] hover:brightness-95 disabled:cursor-default',
                              look.cls,
                            )}
                          >
                            {look.text}
                            {c.earlyMinutes > 0 && (
                              <span className="absolute inset-x-1.5 bottom-0.5 h-0.5 rounded-full bg-red-400" aria-hidden />
                            )}
                            {c.lateMinutes > 0 && (
                              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                            )}
                          </button>
                        </td>
                      );
                    })}
                    <td className="border-b border-l-2 border-line px-2 text-center font-semibold tabular-nums text-ink">
                      {r.totals.came}
                      <span className="font-normal text-ink-muted">/{r.totals.workdays}</span>
                    </td>
                    <td className="border-b border-line px-2 text-center tabular-nums" title={fmtMin(r.totals.lateMinutes)}>
                      <span className={cn(r.totals.late ? 'font-semibold text-amber-600' : 'text-ink-muted')}>{r.totals.late}</span>
                    </td>
                    <td className="border-b border-line px-2 text-center tabular-nums">
                      <span className={cn(r.totals.absent ? 'font-semibold text-red-600' : 'text-ink-muted')}>{r.totals.absent}</span>
                    </td>
                    <td className="border-b border-line px-2 text-center tabular-nums text-sky-600">{r.totals.leave || '—'}</td>
                    <td className="border-b border-line px-2 text-center tabular-nums" title={`Norma: ${fmtHours(r.totals.normHours)} soat`}>
                      <div className="font-semibold text-ink">{fmtHours(r.totals.hours)}</div>
                      {r.totals.normHours > 0 && (
                        <div className="mx-auto mt-0.5 h-1 w-10 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className={cn('h-full rounded-full', r.totals.hours >= r.totals.normHours * 0.9 ? 'bg-emerald-500' : 'bg-amber-500')}
                            style={{ width: `${Math.min(100, (r.totals.hours / r.totals.normHours) * 100)}%` }}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="sticky bottom-0 left-0 z-30 border-r border-t border-line bg-surface-2 px-3 py-2 text-[11.5px] font-semibold text-ink-soft">
                    Keldi / kerak edi
                  </td>
                  {data.daily.map((d, i) => {
                    const day = data.days[i];
                    const low = d.expected > 0 && d.came / d.expected < 0.7;
                    return (
                      <td
                        key={d.date}
                        className={cn(
                          'sticky bottom-0 z-20 border-t border-line bg-surface-2 px-0.5 py-1.5 text-center text-[11px] tabular-nums',
                          low ? 'font-semibold text-red-600' : 'text-ink-soft',
                        )}
                      >
                        {day.isFuture ? '' : d.expected ? `${d.came}/${d.expected}` : d.came || ''}
                      </td>
                    );
                  })}
                  <td colSpan={5} className="sticky bottom-0 z-20 border-t border-line bg-surface-2" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-[11.5px] text-ink-soft">
          <Legend cls="bg-emerald-100 dark:bg-emerald-500/20" label={mode === 'hours' ? "O'z vaqtida (soat)" : "O'z vaqtida (keldi)"} />
          <Legend cls="bg-amber-100 dark:bg-amber-500/20" label="Kechikkan" dot="bg-amber-500" />
          <Legend cls="bg-red-100 dark:bg-red-500/20" label="Y — kelmagan" />
          <Legend cls="bg-sky-100 dark:bg-sky-500/20" label="T — ta'til" />
          <Legend cls="bg-surface-2" label="Dam olish" />
          <span className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded-full bg-red-400" /> Erta ketgan
          </span>
          <span className="ml-auto text-ink-muted">Katakni bosing — o'sha kun tafsiloti va yuz kadrlari</span>
        </div>
      </Card>

      <DayModal target={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function Summary({
  icon: Icon,
  color,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  color: string;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${color}1a`, color }}>
          <Icon size={16} variant="Bulk" />
        </span>
        <span className="text-xl font-bold tabular-nums text-ink">{value}</span>
      </div>
      <p className="mt-1.5 truncate text-[12px] text-ink-soft">{label}</p>
      {hint && <p className="truncate text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

function Legend({ cls, label, dot }: { cls: string; label: string; dot?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn('relative h-3.5 w-5 rounded', cls)}>
        {dot && <span className={cn('absolute right-0.5 top-0.5 h-1 w-1 rounded-full', dot)} />}
      </span>
      {label}
    </span>
  );
}

/** Katak tafsiloti: o'sha kunning davomat taxtasidagi yozuvi (yuz kadrlari bilan). */
function DayModal({ target, onClose }: { target: { row: TimesheetRow; date: string } | null; onClose: () => void }) {
  const day = useAttendanceToday(target?.date ?? '', { enabled: !!target });
  const entry = target ? day.data?.roster.find((r) => r.employeeId === target.row.employeeId) : undefined;
  const [y, m, d] = (target?.date ?? '--').split('-');
  return (
    <Modal open={!!target} onClose={onClose} title={target?.row.fullName} subtitle={target ? `${d}.${m}.${y}` : undefined} width={520}>
      {day.isLoading || (target && !day.data) ? (
        <div className="h-48 animate-pulse rounded-2xl bg-surface-2" />
      ) : entry ? (
        <div className="-mt-4">
          <AttendanceDayDetail entry={entry} dayLabel={`${d}.${m}.${y}`} />
        </div>
      ) : (
        <p className="py-8 text-center text-sm text-ink-muted">Bu kun uchun ma'lumot yo'q</p>
      )}
    </Modal>
  );
}
