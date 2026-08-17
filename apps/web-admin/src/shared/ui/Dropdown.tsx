import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown2, type Icon as IconType } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

export interface DropdownItem {
  label: string;
  icon?: IconType;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  /** Bo'limni ajratuvchi chiziq (yuqorisida). */
  divider?: boolean;
  /** Faol (tanlangan) holatni belgilash. */
  active?: boolean;
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

export function Dropdown({
  trigger,
  items,
  align = 'end',
  width = 220,
  label,
  direction = 'down',
}: {
  /** Maxsus trigger element. Berilmasa, `label` bilan tugma chiqadi. */
  trigger?: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  width?: number;
  label?: string;
  /** Menyu yo'nalishi — pastga (default) yoki tepaga ochilishi. */
  direction?: 'down' | 'up';
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const up = direction === 'up';

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen((o) => !o)}>
        {trigger ?? (
          <button
            className={cn(
              'flex items-center gap-2 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2',
              open && 'border-primary-300 bg-primary-50 text-primary-700',
            )}
          >
            {label}
            <ArrowDown2
              size={15}
              className={cn('transition-transform', open && 'rotate-180')}
            />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: up ? 6 : -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: up ? 6 : -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ width }}
            className={cn(
              'absolute z-50 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
              up ? 'bottom-full mb-2' : 'mt-2',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((it, i) => (
              <div key={i}>
                {it.divider && <div className="my-1.5 h-px bg-line" />}
                <button
                  disabled={it.disabled}
                  onClick={() => {
                    if (it.disabled) return;
                    it.onClick?.();
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition-colors',
                    it.disabled && 'cursor-not-allowed opacity-40',
                    it.danger
                      ? 'text-red-600 hover:bg-danger-soft'
                      : it.active
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {it.icon && <it.icon size={17} variant="Bulk" className="shrink-0" />}
                  <span className="flex-1">{it.label}</span>
                  {it.active && <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
