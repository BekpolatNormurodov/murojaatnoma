import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown2, TickCircle, type Icon as IconType } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

export interface SelectOption<V extends string = string> {
  value: V;
  label: string;
  /** Variant oldidagi ikona. */
  icon?: IconType;
  /** Variant oldidagi rangli nuqta. */
  dot?: string;
}

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
 * Stillangan, animatsiyali select — native `<select>` o'rniga.
 * Qiymat asosida ishlaydi (value + onChange).
 */
export function Select<V extends string = string>({
  value,
  onChange,
  options,
  placeholder = 'Tanlang',
  icon: LeadIcon,
  size = 'md',
  block = false,
  menuAlign = 'start',
  className,
}: {
  value: V;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  icon?: IconType;
  size?: 'sm' | 'md';
  block?: boolean;
  menuAlign?: 'start' | 'end';
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={ref} className={cn('relative', block ? 'w-full' : 'inline-block', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-xl border bg-surface text-sm font-medium outline-none transition-colors',
          size === 'sm' ? 'h-10 px-3' : 'h-11 px-3.5',
          open
            ? 'border-primary-300 text-primary-700'
            : 'border-line text-ink-soft hover:bg-surface-2',
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {LeadIcon && <LeadIcon size={16} variant="Bulk" className="shrink-0 text-ink-muted" />}
          {selected?.dot && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: selected.dot }} />
          )}
          <span className={cn('truncate', !selected && 'text-ink-muted')}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ArrowDown2 size={15} className={cn('shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'absolute z-50 mt-2 max-h-72 min-w-full overflow-y-auto whitespace-nowrap rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
              menuAlign === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {o.icon && <o.icon size={17} variant="Bulk" className="shrink-0" />}
                  {o.dot && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: o.dot }} />}
                  <span className="flex-1">{o.label}</span>
                  {active && <TickCircle size={16} variant="Bulk" className="shrink-0 text-primary-600" />}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
