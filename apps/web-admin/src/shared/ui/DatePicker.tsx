import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Clock, ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

const MONTHS_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];
// Dushanbadan boshlanadi
const WEEKDAYS = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];

/** DatePicker'dagi tez tanlash tugmalari (bugungidan necha kun oldin). */
const DAY_PRESETS = [
  { label: 'Bugun', back: 0 },
  { label: 'Kecha', back: 1 },
  { label: "O'tgan kun", back: 2 },
];

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
 * Ochilganda tugma o'ng chekkaga yaqin bo'lsa — drop-down'ni o'ngga
 * (`right-0`) tekislaydi, aks holda `left-0`. Shu bilan sahifaning o'ng
 * tomonidagi (masalan Davomat sarlavhasidagi) kalendar ekrandan chiqib
 * ketmaydi. `popoverWidth` — drop-down eni (px, taxminan).
 */
function useAutoAlign<T extends HTMLElement>(open: boolean, popoverWidth = 288) {
  const btnRef = useRef<T>(null);
  const [alignEnd, setAlignEnd] = useState(false);
  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setAlignEnd(r.left + popoverWidth > window.innerWidth - 8);
  }, [open, popoverWidth]);
  return [btnRef, alignEnd] as const;
}

/**
 * Stillangan kalendar drop-down — native `type="date"` o'rniga.
 * Qiymat formati: "yyyy-mm-dd".
 */
export function DatePicker({
  value,
  onChange,
  block = false,
  placeholder = 'Sanani tanlang',
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
  const [btnRef, alignEnd] = useAutoAlign<HTMLButtonElement>(open);
  const selected = parseDate(value);
  const today = new Date();

  // Ko'rsatilayotgan oy (oyning 1-kuni)
  const [view, setView] = useState(() => {
    const base = selected ?? today;
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  useEffect(() => {
    if (open) {
      const base = parseDate(value) ?? new Date();
      setView(new Date(base.getFullYear(), base.getMonth(), 1));
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Oy katakchalari (Dushanbadan boshlab)
  const cells = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Dushanba
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [view]);

  const label = selected
    ? `${selected.getDate()}-${MONTHS_FULL[selected.getMonth()]}, ${selected.getFullYear()}`
    : placeholder;

  function pick(day: number) {
    const d = new Date(view.getFullYear(), view.getMonth(), day);
    onChange(toValue(d));
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
        <span className={cn('flex-1 truncate text-left', !selected && 'text-ink-muted')}>{label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute z-50 mt-2 w-70 rounded-2xl border border-line bg-surface p-3 shadow-pop',
              alignEnd ? 'right-0' : 'left-0',
            )}
          >
            {/* Oy navigatsiyasi */}
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

            {/* Hafta kunlari */}
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

            {/* Kunlar */}
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (day === null) return <div key={`b${i}`} />;
                const d = new Date(view.getFullYear(), view.getMonth(), day);
                const isSel = !!selected && sameDay(d, selected);
                const isToday = sameDay(d, today);
                const weekend = i % 7 >= 5;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pick(day)}
                    className={cn(
                      'flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors',
                      isSel
                        ? 'bg-primary-600 text-white shadow-glow'
                        : isToday
                          ? 'bg-primary-50 text-primary-700'
                          : weekend
                            ? 'text-danger hover:bg-surface-2'
                            : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            {/* Tez tanlash */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {DAY_PRESETS.map((p) => {
                const d = new Date();
                d.setDate(d.getDate() - p.back);
                const active = !!selected && sameDay(d, selected);
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => {
                      onChange(toValue(d));
                      setOpen(false);
                    }}
                    className={cn(
                      'rounded-xl border py-2 text-[12px] font-medium transition-colors',
                      active
                        ? 'border-primary-300 bg-primary-50 text-primary-700'
                        : 'border-line text-ink-soft hover:border-primary-300 hover:bg-primary-50 hover:text-primary-600',
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
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
  const [btnRef, alignEnd] = useAutoAlign<HTMLButtonElement>(open);
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
            className={cn(
              'absolute z-50 mt-2 w-70 rounded-2xl border border-line bg-surface p-3 shadow-pop',
              alignEnd ? 'right-0' : 'left-0',
            )}
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

// 07:00 dan 21:30 gacha 30 daqiqalik oraliqlar
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 21; h++) {
  for (const m of [0, 30]) TIME_SLOTS.push(`${pad2(h)}:${pad2(m)}`);
}

/**
 * Stillangan vaqt drop-down — native `type="time"` o'rniga.
 * Qiymat formati: "HH:mm".
 */
export function TimePicker({
  value,
  onChange,
  block = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  block?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  const slots = useMemo(() => {
    if (value && !TIME_SLOTS.includes(value)) {
      return [...TIME_SLOTS, value].sort();
    }
    return TIME_SLOTS;
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface px-3.5 text-sm font-medium outline-none transition-colors',
          open ? 'border-primary-300 text-primary-700' : 'border-line text-ink-soft hover:bg-surface-2',
        )}
      >
        <Clock size={17} variant="Bulk" className={cn('shrink-0', open ? 'text-primary-500' : 'text-ink-muted')} />
        <span className={cn('flex-1 truncate text-left', !value && 'text-ink-muted')}>
          {value || 'Vaqtni tanlang'}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute left-0 z-50 mt-2 max-h-60 w-full min-w-35 overflow-y-auto rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
          >
            {slots.map((s) => {
              const active = s === value;
              return (
                <button
                  key={s}
                  type="button"
                  ref={(el) => {
                    if (active && el && open) el.scrollIntoView({ block: 'center' });
                  }}
                  onClick={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center justify-center rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {s}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
