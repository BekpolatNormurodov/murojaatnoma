import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, ArrowDown2, ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { clampDay, fromDay, isAllowed, monthGrid, moveDay, toDay } from './calendar';
import { Popover } from './Popover';

const MONTHS_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];
// Dushanbadan boshlanadi
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

const pad2 = (n: number) => String(n).padStart(2, '0');

/** "yyyy-mm-dd" -> Date (mahalliy vaqt, UTC siljishisiz). */
function parseDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

const toValue = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Tashqariga bosilganda yopish hook'i. */
function useClickOutside<T extends HTMLElement>(onOut: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOut();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onOut]);
  return ref;
}

/**
 * Drop-down'ning tugmaga nisbatan gorizontal o'rni (`left`, px): odatda tugma
 * chap chetidan, o'ng chekkada joy yetmasa — tugma o'ng chetiga tekislanadi,
 * va hech qachon ekrandan chiqmaydi (telefonda ham). `popoverWidth` —
 * drop-down eni (px, taxminan); `narrowWidth` — 640px'dan tor ekrandagi eni.
 */
function useAutoAlign<T extends HTMLElement>(open: boolean, popoverWidth = 288, narrowWidth = popoverWidth) {
  const btnRef = useRef<T>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const screen = document.documentElement.clientWidth;
    const width = screen < 640 ? narrowWidth : popoverWidth;
    const preferred = r.left + width <= screen - 8 ? 0 : r.width - width;
    setLeft(Math.max(8 - r.left, Math.min(preferred, screen - 8 - width - r.left)));
  }, [open, popoverWidth, narrowWidth]);
  return [btnRef, left] as const;
}

const dayLabel = (d: Date) => `${d.getDate()}-${MONTHS_FULL[d.getMonth()]}, ${d.getFullYear()}`;

const navButton =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-soft outline-none transition-colors hover:bg-surface-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-primary-300 disabled:pointer-events-none disabled:opacity-30';

/** Ochiq kalendar: kunlar to'ri, sarlavha bosilsa — oy va yil tanlash. */
function CalendarPanel({
  value,
  min,
  max,
  onPick,
}: {
  value: string;
  min?: string;
  max?: string;
  onPick: (day: string) => void;
}) {
  const today = toDay(new Date());
  // Klaviatura kursori; ko'rsatilayotgan oy ham shundan olinadi.
  const [cursor, setCursor] = useState(() => clampDay(fromDay(value) ? value : today, min, max));
  const [mode, setMode] = useState<'days' | 'months'>('days');
  const gridRef = useRef<HTMLDivElement>(null);
  const wantFocus = useRef(true);

  const shown = fromDay(cursor) ?? new Date();
  const year = shown.getFullYear();
  const month = shown.getMonth();
  const monthKey = (y: number, m: number) => toDay(new Date(y, m, 1)).slice(0, 7);
  const monthAllowed = (y: number, m: number) => isAllowed(monthKey(y, m), min?.slice(0, 7), max?.slice(0, 7));
  const goMonth = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate();
    setCursor(clampDay(toDay(new Date(y, m, Math.min(shown.getDate(), last))), min, max));
  };

  // Ochilganda va klaviaturada yurilganda fokus kursor kunida turadi.
  useEffect(() => {
    if (!wantFocus.current || mode !== 'days') return;
    const t = window.setTimeout(() => {
      // Taymer ichida o'chiriladi: effekt qayta ishga tushsa ham fokus yo'qolmaydi.
      wantFocus.current = false;
      gridRef.current?.querySelector<HTMLElement>(`[data-day="${cursor}"]`)?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(t);
  }, [cursor, mode]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const next = moveDay(cursor, e.key);
    if (!next) return;
    e.preventDefault();
    wantFocus.current = true;
    setCursor(clampDay(next, min, max));
  };

  const prevOff = mode === 'days' ? !monthAllowed(year, month - 1) : !!min && String(year - 1) < min.slice(0, 4);
  const nextOff = mode === 'days' ? !monthAllowed(year, month + 1) : !!max && String(year + 1) > max.slice(0, 4);
  const step = (dir: 1 | -1) => (mode === 'days' ? goMonth(year, month + dir) : goMonth(year + dir, month));

  return (
    <div className="w-[272px]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button type="button" className={navButton} onClick={() => step(-1)} disabled={prevOff} aria-label={mode === 'days' ? 'Oldingi oy' : 'Oldingi yil'}>
          <ArrowLeft2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            wantFocus.current = mode === 'months';
            setMode(mode === 'days' ? 'months' : 'days');
          }}
          aria-expanded={mode === 'months'}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-bold text-ink outline-none transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          {mode === 'days' ? `${MONTHS_FULL[month]} ${year}` : year}
          <ArrowDown2 size={14} className={cn('text-ink-muted transition-transform', mode === 'months' && 'rotate-180')} />
        </button>
        <button type="button" className={navButton} onClick={() => step(1)} disabled={nextOff} aria-label={mode === 'days' ? 'Keyingi oy' : 'Keyingi yil'}>
          <ArrowRight2 size={16} />
        </button>
      </div>

      {/* Ikkala ko'rinish bir xil balandlikda — drop-down sakramaydi. */}
      <div className="h-[262px]">
        {mode === 'days' ? (
          <>
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={w}
                  className={cn('flex h-7 items-center justify-center text-[11px] font-semibold', i >= 5 ? 'text-danger' : 'text-ink-muted')}
                >
                  {w}
                </div>
              ))}
            </div>
            <div ref={gridRef} className="grid grid-cols-7 gap-y-0.5" onKeyDown={onKeyDown}>
              {monthGrid(year, month).map(({ day, inMonth }, i) => {
                const off = !isAllowed(day, min, max);
                const selected = day === value;
                return (
                  <button
                    key={day}
                    type="button"
                    data-day={day}
                    tabIndex={day === cursor ? 0 : -1}
                    disabled={off}
                    aria-pressed={selected}
                    aria-current={day === today ? 'date' : undefined}
                    aria-label={dayLabel(fromDay(day)!)}
                    onClick={() => onPick(day)}
                    className={cn(
                      'mx-auto flex h-[36px] w-[36px] items-center justify-center rounded-xl text-[13px] font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-400',
                      selected
                        ? 'bg-primary-600 font-bold text-white shadow-glow'
                        : off
                          ? 'cursor-not-allowed text-ink-muted opacity-35'
                          : cn(
                              'hover:bg-surface-2',
                              !inMonth ? 'text-ink-muted opacity-60' : i % 7 >= 5 ? 'text-danger' : 'text-ink',
                              day === today && 'font-bold text-primary-700 ring-1 ring-inset ring-primary-300',
                            ),
                    )}
                  >
                    {Number(day.slice(8))}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid h-full grid-cols-3 grid-rows-4 gap-1.5">
            {MONTHS_SHORT.map((name, i) => (
              <button
                key={name}
                type="button"
                disabled={!monthAllowed(year, i)}
                onClick={() => {
                  goMonth(year, i);
                  wantFocus.current = true;
                  setMode('days');
                }}
                className={cn(
                  'rounded-xl text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-35',
                  i === month ? 'bg-primary-600 text-white shadow-glow' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-line pt-2.5">
        {[
          { label: 'Kecha', day: toDay(addDays(new Date(), -1)) },
          { label: 'Bugun', day: today },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={!isAllowed(p.day, min, max)}
            onClick={() => onPick(p.day)}
            className={cn(
              'rounded-xl border py-2 text-[12.5px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-35',
              value === p.day
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-line text-ink-soft hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Stillangan kalendar drop-down — native `type="date"` o'rniga.
 * Qiymat formati: "yyyy-mm-dd"; `min` / `max` ham shu formatda.
 */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  block = false,
  placeholder = 'Sanani tanlang',
  ariaLabel = 'Sana',
  compact = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  block?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  /** Tor joy uchun: tugmada "26.11.2026". */
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const selected = fromDay(value);
  const close = useCallback(() => setOpen(false), []);

  return (
    <div className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`${ariaLabel}: ${selected ? dayLabel(selected) : placeholder}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-11 w-full items-center rounded-xl border bg-surface text-sm font-medium outline-none transition-colors focus-visible:border-primary-300',
          compact ? 'gap-2 px-3' : 'gap-2.5 px-3.5',
          open ? 'border-primary-300 text-primary-700' : 'border-line text-ink-soft hover:bg-surface-2',
        )}
      >
        <Calendar size={17} variant="Bulk" className={cn('shrink-0', open ? 'text-primary-500' : 'text-ink-muted')} />
        <span className={cn('flex-1 truncate text-left tabular-nums', selected ? 'text-ink' : 'text-ink-muted')}>
          {!selected ? placeholder : compact ? value.split('-').reverse().join('.') : dayLabel(selected)}
        </span>
        {!compact && (
          <ArrowDown2 size={14} className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
        )}
      </button>

      <Popover open={open} onClose={close} anchorRef={btnRef} label="Sana tanlash">
        <CalendarPanel
          value={value}
          min={min}
          max={max}
          onPick={(day) => {
            onChange(day);
            setOpen(false);
            btnRef.current?.focus({ preventScroll: true });
          }}
        />
      </Popover>
    </div>
  );
}

/* ============================================================
   DateRangePicker — oraliq (interval) tanlagich: 8 tayyor preset
   (Bugun..O'tgan yil) + ixtiyoriy oraliq (kalendardan boshi/oxiri).
   Qiymat: { from, to } — ikkalasi ham "yyyy-mm-dd".
   ============================================================ */

const addDays = (d: Date, n: number) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
/** Shu haftaning dushanbasi (00:00). */
const startOfWeekMon = (d: Date) => {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - ((r.getDay() + 6) % 7));
  return r;
};

/** Oraliq presetlari — bugungiga nisbatan {from,to} Date qaytaradi. */
const RANGE_PRESETS: { label: string; range: (t: Date) => { from: Date; to: Date } }[] = [
  { label: 'Bugun', range: (t) => ({ from: t, to: t }) },
  { label: 'Kecha', range: (t) => ({ from: addDays(t, -1), to: addDays(t, -1) }) },
  { label: 'Bu hafta', range: (t) => ({ from: startOfWeekMon(t), to: t }) },
  {
    label: "O'tgan hafta",
    range: (t) => {
      const s = addDays(startOfWeekMon(t), -7);
      return { from: s, to: addDays(s, 6) };
    },
  },
  { label: 'Bu oy', range: (t) => ({ from: new Date(t.getFullYear(), t.getMonth(), 1), to: t }) },
  {
    label: "O'tgan oy",
    range: (t) => ({
      from: new Date(t.getFullYear(), t.getMonth() - 1, 1),
      to: new Date(t.getFullYear(), t.getMonth(), 0),
    }),
  },
  { label: 'Bu yil', range: (t) => ({ from: new Date(t.getFullYear(), 0, 1), to: t }) },
  {
    label: "O'tgan yil",
    range: (t) => ({
      from: new Date(t.getFullYear() - 1, 0, 1),
      to: new Date(t.getFullYear() - 1, 11, 31),
    }),
  },
];

export function DateRangePicker({
  from,
  to,
  onChange,
  block = false,
  className,
}: {
  from: string;
  to: string;
  onChange: (range: { from: string; to: string }) => void;
  block?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const [btnRef, popLeft] = useAutoAlign<HTMLButtonElement>(open, 414, 282);
  const today = new Date();
  const fromD = parseDate(from);
  const toD = parseDate(to);

  const [view, setView] = useState(() => {
    const b = fromD ?? today;
    return new Date(b.getFullYear(), b.getMonth(), 1);
  });
  const [pending, setPending] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    const b = parseDate(from) ?? new Date();
    setView(new Date(b.getFullYear(), b.getMonth(), 1));
    setPending(null);
  }, [open, from]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [view]);

  const activePreset = useMemo(() => {
    if (!fromD || !toD) return null;
    const t = new Date();
    return RANGE_PRESETS.find((p) => {
      const r = p.range(t);
      return sameDay(r.from, fromD) && sameDay(r.to, toD);
    })?.label ?? null;
  }, [fromD, toD]);

  const label = fromD && toD
    ? activePreset
      ? activePreset
      : sameDay(fromD, toD)
        ? `${fromD.getDate()}-${MONTHS_FULL[fromD.getMonth()]}, ${fromD.getFullYear()}`
        : `${fromD.getDate()} ${MONTHS_FULL[fromD.getMonth()].slice(0, 3)} — ${toD.getDate()} ${MONTHS_FULL[toD.getMonth()].slice(0, 3)}, ${toD.getFullYear()}`
    : 'Oraliqni tanlang';

  function applyPreset(p: (typeof RANGE_PRESETS)[number]) {
    const r = p.range(new Date());
    onChange({ from: toValue(r.from), to: toValue(r.to) });
    setOpen(false);
  }

  function pickDay(day: number) {
    const d = new Date(view.getFullYear(), view.getMonth(), day);
    if (!pending) {
      setPending(d);
      return;
    }
    const [f, t] = pending.getTime() <= d.getTime() ? [pending, d] : [d, pending];
    onChange({ from: toValue(f), to: toValue(t) });
    setPending(null);
    setOpen(false);
  }

  // Kalendarda ajratib ko'rsatiladigan boshi/oxiri (tanlanayotgan yoki tasdiqlangan).
  const hlStart = pending ?? fromD;
  const hlEnd = pending ? null : toD;

  return (
    <div ref={ref} className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface px-3.5 text-sm font-medium outline-none transition-colors',
          open ? 'border-primary-300 text-primary-700' : 'border-line text-ink-soft hover:bg-surface-2',
        )}
      >
        <Calendar size={17} variant="Bulk" className={cn('shrink-0', open ? 'text-primary-500' : 'text-ink-muted')} />
        <span className={cn('flex-1 truncate text-left', !fromD && 'text-ink-muted')}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ left: popLeft }}
            className="absolute z-50 mt-2 flex w-max flex-col rounded-2xl border border-line bg-surface p-3 shadow-pop sm:flex-row"
          >
            {/* Tayyor oraliqlar (telefonda — kalendar ustida) */}
            <div className="mb-3 flex w-64 flex-wrap gap-0.5 border-b border-line pb-2 sm:mb-0 sm:w-30 sm:flex-col sm:flex-nowrap sm:border-b-0 sm:border-r sm:pb-0 sm:pr-2">
              {RANGE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    'rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors',
                    activePreset === p.label
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Kalendar (boshi → oxiri) */}
            <div className="w-64 sm:pl-3">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2"
                >
                  <ArrowLeft2 size={16} />
                </button>
                <span className="text-sm font-semibold text-ink">
                  {MONTHS_FULL[view.getMonth()]} {view.getFullYear()}
                </span>
                <button
                  type="button"
                  onClick={() => setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2"
                >
                  <ArrowRight2 size={16} />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <div
                    key={w}
                    className={cn(
                      'flex h-7 items-center justify-center text-[11px] font-semibold',
                      i >= 5 ? 'text-danger' : 'text-ink-muted',
                    )}
                  >
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <div key={`b${i}`} />;
                  const d = new Date(view.getFullYear(), view.getMonth(), day);
                  const isEdge = (!!hlStart && sameDay(d, hlStart)) || (!!hlEnd && sameDay(d, hlEnd));
                  const inRange =
                    !!hlStart && !!hlEnd && d.getTime() > hlStart.getTime() && d.getTime() < hlEnd.getTime();
                  const isToday = sameDay(d, today);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => pickDay(day)}
                      className={cn(
                        'flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors',
                        isEdge
                          ? 'bg-primary-600 text-white shadow-glow'
                          : inRange
                            ? 'bg-primary-50 text-primary-700'
                            : isToday
                              ? 'bg-primary-50/60 text-primary-700'
                              : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-[11.5px] text-ink-muted">
                {pending ? 'Tugash sanasini tanlang' : 'Boshlanish sanasini tanlang'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const MONTHS_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
];

/** "yyyy-mm" -> { year, month(0-11) }. */
function parseMonth(v: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

/**
 * Stillangan OY tanlagich — native `type="month"` o'rniga (yil navigatsiyasi +
 * 12 oy to'ri). Qiymat formati: "yyyy-mm". `DatePicker` bilan bir xil ko'rinish.
 */
export function MonthPicker({
  value,
  onChange,
  block = false,
  placeholder = 'Oyni tanlang',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  block?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const [btnRef, popLeft] = useAutoAlign<HTMLButtonElement>(open, 280);
  const parsed = parseMonth(value);
  const today = new Date();
  const [viewYear, setViewYear] = useState(() => parsed?.year ?? today.getFullYear());

  useEffect(() => {
    if (open) setViewYear(parseMonth(value)?.year ?? new Date().getFullYear());
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const label = parsed ? `${MONTHS_FULL[parsed.month]} ${parsed.year}` : placeholder;

  function pick(monthIdx: number) {
    onChange(`${viewYear}-${pad2(monthIdx + 1)}`);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface px-3.5 text-sm font-medium outline-none transition-colors',
          open ? 'border-primary-300 text-primary-700' : 'border-line text-ink-soft hover:bg-surface-2',
        )}
      >
        <Calendar size={17} variant="Bulk" className={cn('shrink-0', open ? 'text-primary-500' : 'text-ink-muted')} />
        <span className={cn('flex-1 truncate text-left', !parsed && 'text-ink-muted')}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ left: popLeft }}
            className="absolute z-50 mt-2 w-70 rounded-2xl border border-line bg-surface p-3 shadow-pop"
          >
            {/* Yil navigatsiyasi */}
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewYear((y) => y - 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2"
              >
                <ArrowLeft2 size={16} />
              </button>
              <span className="text-sm font-semibold text-ink">{viewYear}</span>
              <button
                type="button"
                onClick={() => setViewYear((y) => y + 1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2"
              >
                <ArrowRight2 size={16} />
              </button>
            </div>

            {/* Oylar to'ri */}
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_SHORT.map((mn, i) => {
                const isSel = !!parsed && parsed.year === viewYear && parsed.month === i;
                const isThisMonth = today.getFullYear() === viewYear && today.getMonth() === i;
                return (
                  <button
                    key={mn}
                    type="button"
                    onClick={() => pick(i)}
                    className={cn(
                      'flex h-10 items-center justify-center rounded-lg text-[13px] font-medium transition-colors',
                      isSel
                        ? 'bg-primary-600 text-white shadow-glow'
                        : isThisMonth
                          ? 'bg-primary-50 text-primary-700'
                          : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    {mn}
                  </button>
                );
              })}
            </div>

            {/* Shu oy */}
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                onChange(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`);
                setOpen(false);
              }}
              className="mt-2 w-full rounded-xl border border-line py-2 text-[13px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
            >
              Shu oy
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const DEFAULT_TIME_PRESETS = ['08:00', '08:30', '09:00', '13:00', '14:00', '17:00', '18:00'];

/** Ro'yxat ichida tanlangan qatorni markazga suradi (sahifani/modalni emas). */
function centerIn(container: HTMLElement | null, el: HTMLElement | null) {
  if (!container || !el) return;
  container.scrollTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2;
}

/**
 * Stillangan vaqt tanlagich — native `type="time"` (brauzerning ko'k-oq
 * ro'yxati) o'rniga. Soat va daqiqa alohida ustunlarda, tez tanlash
 * tugmalari, katta ko'rinish; ekran chetida o'zi tekislanadi.
 * Qiymat formati: "HH:mm".
 */
export function TimePicker({
  value,
  onChange,
  block = false,
  className,
  presets = DEFAULT_TIME_PRESETS,
  minuteStep = 5,
  placeholder = 'Vaqtni tanlang',
  invalid = false,
  id,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  block?: boolean;
  className?: string;
  /** Tez tanlash tugmalari ("HH:mm"). Bo'sh massiv — ko'rsatilmaydi. */
  presets?: string[];
  minuteStep?: number;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const [btnRef, popLeft] = useAutoAlign<HTMLButtonElement>(open, 272);
  const hoursRef = useRef<HTMLDivElement>(null);
  const minutesRef = useRef<HTMLDivElement>(null);
  // Pastda joy yetmasa (modal tagi, sahifa oxiri) — tepaga ochiladi.
  const [openUp, setOpenUp] = useState(false);
  const toggle = () => {
    if (!open) {
      const r = btnRef.current?.getBoundingClientRect();
      setOpenUp(!!r && window.innerHeight - r.bottom < 360 && r.top > 360);
    }
    setOpen((o) => !o);
  };

  const [hh, mm] = /^\d{2}:\d{2}$/.test(value) ? value.split(':') : ['', ''];
  // Arzon hisob — memo shart emas (React Compiler o'zi optimallashtiradi).
  const minutes: string[] = [];
  for (let m = 0; m < 60; m += minuteStep) minutes.push(pad2(m));
  if (mm && !minutes.includes(mm)) minutes.push(mm);
  minutes.sort();
  const hours = Array.from({ length: 24 }, (_, h) => pad2(h));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    // Ochilganda tanlangan soat/daqiqa ustun markazida ko'rinsin.
    const t = window.setTimeout(() => {
      centerIn(hoursRef.current, hoursRef.current?.querySelector<HTMLElement>('[data-active="true"]') ?? null);
      centerIn(minutesRef.current, minutesRef.current?.querySelector<HTMLElement>('[data-active="true"]') ?? null);
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const pick = (h: string, m: string, close: boolean) => {
    onChange(`${h}:${m}`);
    if (close) setOpen(false);
  };

  const cell = (active: boolean) =>
    cn(
      'flex h-9 w-full shrink-0 items-center justify-center rounded-lg text-[13.5px] font-semibold tabular-nums transition-colors',
      active ? 'bg-primary-600 text-white shadow-sm' : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
    );

  return (
    <div ref={ref} className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        ref={btnRef}
        id={id}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface-2 px-3.5 text-sm outline-none transition-colors focus-visible:border-primary-300 focus-visible:bg-surface',
          invalid
            ? 'border-danger'
            : open
              ? 'border-primary-300 bg-surface'
              : 'border-line hover:border-primary-200',
        )}
      >
        <Clock size={17} variant="Bulk" className={cn('shrink-0', open ? 'text-primary-500' : 'text-ink-muted')} />
        <span className={cn('flex-1 truncate text-left font-semibold tabular-nums', value ? 'text-ink' : 'font-normal text-ink-muted')}>
          {value || placeholder}
        </span>
        <ArrowLeft2
          size={14}
          className={cn('shrink-0 text-ink-muted transition-transform', open ? 'rotate-90' : '-rotate-90')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Vaqt tanlash"
            initial={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: openUp ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ left: popLeft }}
            className={cn(
              'absolute z-50 w-[272px] rounded-2xl border border-line bg-surface p-3 shadow-pop',
              openUp ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            <div className="flex items-baseline justify-between px-1">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">Vaqt</span>
              <span className="text-xl font-bold tabular-nums text-ink">{value || '--:--'}</span>
            </div>

            {presets.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      onChange(p);
                      setOpen(false);
                    }}
                    className={cn(
                      'rounded-lg border px-2 py-1 text-[12px] font-semibold tabular-nums transition-colors',
                      p === value
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-line text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 grid grid-cols-2 gap-2">
              {(
                [
                  ['Soat', hours, hh, hoursRef, (h: string) => pick(h, mm || '00', false)],
                  ['Daqiqa', minutes, mm, minutesRef, (m: string) => pick(hh || '09', m, true)],
                ] as const
              ).map(([label, items, current, colRef, onPick]) => (
                <div key={label}>
                  <p className="mb-1 text-center text-[11px] font-medium text-ink-muted">{label}</p>
                  <div
                    ref={colRef}
                    className="relative flex h-48 flex-col gap-0.5 overflow-y-auto overscroll-contain rounded-xl bg-surface-2/60 p-1 [scrollbar-width:thin]"
                  >
                    {items.map((it) => (
                      <button
                        key={it}
                        type="button"
                        data-active={it === current}
                        onClick={() => onPick(it)}
                        className={cell(it === current)}
                      >
                        {it}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
