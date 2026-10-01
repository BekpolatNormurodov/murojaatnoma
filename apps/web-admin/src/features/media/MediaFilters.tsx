import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDown2, CloseCircle, TickCircle } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

/**
 * Feed toolbar controls: filter dropdowns (a listbox with counts, full
 * keyboard support), the source-kind segmented control and a labelled switch.
 */

const FOCUS = 'outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface';

export interface FilterOption<V extends string> {
  value: V;
  label: string;
  icon?: ReactNode;
  count?: number;
  /** Small red counter on the right ("3 salbiy"). */
  negative?: number;
}

export function FilterMenu<V extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  allLabel = 'Hammasi',
  allCount,
  empty = "Hozircha yo'q",
  width = 272,
}: {
  label: string;
  icon: ReactNode;
  value: V | undefined;
  options: FilterOption<V>[];
  onChange: (v: V | undefined) => void;
  allLabel?: string;
  allCount?: number;
  empty?: string;
  /** Menu width (px); shrinks to fit phones. */
  width?: number;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [alignEnd, setAlignEnd] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const optRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Row 0 is "Hammasi" (clears the filter), then the options.
  const rows: { value: V | undefined; label: string; icon?: ReactNode; count?: number; negative?: number }[] = [
    { value: undefined, label: allLabel, count: allCount },
    ...options,
  ];
  const selected = options.find((o) => o.value === value);

  function show(focusIndex?: number) {
    const r = btnRef.current?.getBoundingClientRect();
    setAlignEnd(!!r && r.left + Math.min(width, window.innerWidth - 32) > window.innerWidth - 12);
    const sel = rows.findIndex((x) => x.value === value);
    setActive(focusIndex ?? (sel < 0 ? 0 : sel));
    setOpen(true);
  }
  function close(refocus = true) {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }
  function pick(v: V | undefined) {
    onChange(v);
    close();
  }

  // Move DOM focus with the active row (roving focus inside the listbox).
  useEffect(() => {
    if (open) optRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function onListKey(e: React.KeyboardEvent) {
    const last = rows.length - 1;
    if (e.key === 'ArrowDown') setActive((i) => (i >= last ? 0 : i + 1));
    else if (e.key === 'ArrowUp') setActive((i) => (i <= 0 ? last : i - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(last);
    else if (e.key === 'Escape') close();
    else if (e.key === 'Tab') return setOpen(false);
    else return;
    e.preventDefault();
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            show(e.key === 'ArrowUp' ? rows.length - 1 : undefined);
          }
        }}
        className={cn(
          'group inline-flex h-10 w-full min-w-0 items-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition-[color,background-color,border-color,box-shadow] duration-150 sm:w-auto',
          FOCUS,
          selected
            ? 'border-primary-300 bg-primary-50 text-primary-800 shadow-sm dark:border-primary-500/40 dark:bg-primary-500/10 dark:text-primary-200'
            : 'border-line bg-surface text-ink-soft hover:border-ink-muted/40 hover:text-ink',
          open && !selected && 'border-primary-300 text-ink ring-4 ring-primary-100 dark:ring-primary-500/15',
          open && selected && 'ring-4 ring-primary-100 dark:ring-primary-500/15',
        )}
      >
        <span className="flex shrink-0 items-center" aria-hidden="true">
          {selected?.icon ?? icon}
        </span>
        <span className="min-w-0 truncate sm:max-w-[15rem]">
          {selected ? (
            <>
              <span className="hidden font-normal opacity-75 md:inline">{label}: </span>
              <span className="font-semibold">{selected.label}</span>
            </>
          ) : (
            label
          )}
        </span>
        <ArrowDown2
          size={14}
          aria-hidden="true"
          className={cn('ml-auto shrink-0 opacity-70 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.16, ease: [0.22, 1, 0.36, 1] } }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.1 } }}
            style={{ width: `min(${width}px, calc(100vw - 2rem))`, transformOrigin: alignEnd ? 'top right' : 'top left' }}
            className={cn(
              'absolute top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop',
              alignEnd ? 'right-0' : 'left-0',
            )}
          >
            <p className="border-b border-line px-3.5 pb-2 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-soft">{label}</p>
            <div
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
              onKeyDown={onListKey}
              className="max-h-[min(360px,60vh)] overflow-y-auto overscroll-contain p-1.5"
            >
              {rows.map((r, i) => {
                const on = r.value === value;
                return (
                  <button
                    key={r.value ?? '__all'}
                    ref={(el) => {
                      optRefs.current[i] = el;
                    }}
                    type="button"
                    role="option"
                    aria-selected={on}
                    tabIndex={i === active ? 0 : -1}
                    onClick={() => pick(r.value)}
                    onMouseMove={() => i !== active && setActive(i)}
                    className={cn(
                      'flex h-10 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-[13px] outline-none transition-colors',
                      i === active ? 'bg-surface-2 text-ink' : 'text-ink-soft',
                      on && 'font-semibold text-primary-800 dark:text-primary-200',
                      i === 0 && options.length > 0 && 'mb-1',
                    )}
                  >
                    {r.icon && (
                      <span className="flex w-4 shrink-0 justify-center" aria-hidden="true">
                        {r.icon}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    {!!r.negative && (
                      <span className="rounded-md bg-red-50 px-1.5 text-[11px] font-semibold tabular-nums text-red-700 dark:bg-red-500/15 dark:text-red-300">
                        {r.negative} salbiy
                      </span>
                    )}
                    {r.count !== undefined && (
                      <span className={cn('min-w-[1.5rem] text-right text-xs tabular-nums', r.count === 0 ? 'text-ink-muted' : 'text-ink-soft')}>
                        {r.count}
                      </span>
                    )}
                    <TickCircle
                      size={16}
                      variant="Bold"
                      aria-hidden="true"
                      className={cn('shrink-0 text-primary-600 dark:text-primary-400', on ? 'opacity-100' : 'opacity-0')}
                    />
                  </button>
                );
              })}
              {options.length === 0 && <p className="px-2.5 py-3 text-[13px] text-ink-soft">{empty}</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** "Hammasi | Rasmiy | OAV" — a segmented filter with a sliding highlight. */
export function SegmentedFilter<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V | undefined;
  options: { value: V | undefined; label: string; short: string; icon: ReactNode; count?: number }[];
  onChange: (v: V | undefined) => void;
}) {
  const reduce = useReducedMotion();
  const id = useId();
  return (
    <div
      role="group"
      aria-label={label}
      className="grid w-full grid-cols-[repeat(3,auto)] gap-0.5 rounded-xl bg-surface-2 p-1 ring-1 ring-inset ring-line lg:inline-grid lg:w-auto lg:shrink-0"
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'relative isolate flex h-9 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors lg:px-3.5',
              FOCUS,
              on ? 'text-ink' : 'text-ink-soft hover:text-ink',
            )}
          >
            {on && (
              <motion.span
                layoutId={`${id}-pill`}
                transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 40 }}
                className="absolute inset-0 -z-10 rounded-lg bg-surface shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              />
            )}
            <span className="hidden shrink-0 sm:inline-flex" aria-hidden="true">
              {o.icon}
            </span>
            <span className="truncate sm:hidden">{o.short}</span>
            <span className="hidden truncate sm:inline">{o.label}</span>
            {o.count !== undefined && (
              <span
                className={cn(
                  'rounded-md px-1.5 text-[11px] font-semibold tabular-nums',
                  on ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300' : 'bg-black/5 dark:bg-white/10',
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** A switch with its label and a hint; the whole row toggles it. */
export function LabeledSwitch({
  checked,
  onChange,
  children,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="inline-flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-xl px-1 text-[13px] font-medium text-ink-soft hover:text-ink" title={hint}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200',
          FOCUS,
          checked ? 'bg-primary-600' : 'bg-ink-muted/35 dark:bg-white/20',
        )}
      >
        <span
          className={cn(
            'h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
            checked ? 'translate-x-[18px]' : 'translate-x-0',
          )}
        />
      </button>
      {children}
    </label>
  );
}

/** One applied filter, removable. */
export function FilterTag({ icon, children, onClear }: { icon?: ReactNode; children: ReactNode; onClear: () => void }) {
  return (
    <span className="inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg bg-primary-50 pl-2.5 pr-1 text-xs font-medium text-primary-800 ring-1 ring-inset ring-primary-200/70 dark:bg-primary-500/10 dark:text-primary-200 dark:ring-primary-500/25">
      {icon && (
        <span className="flex shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="truncate">{children}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Filtrni olib tashlash: ${typeof children === 'string' ? children : ''}`.trim()}
        className={cn('flex h-6 w-6 items-center justify-center rounded-md opacity-70 transition hover:bg-primary-100 hover:opacity-100 dark:hover:bg-primary-500/20', FOCUS)}
      >
        <CloseCircle size={15} />
      </button>
    </span>
  );
}
