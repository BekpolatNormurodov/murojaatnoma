import { useEffect, useRef, useState } from 'react';
import { ArrowDown2, ArrowLeft2, ArrowRight2, CalendarEdit } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

const MONTHS = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn', 'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek'];
const MONTHS_FULL = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];

function currentValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Pro month picker — a trigger button + popover (year stepper ◀ 2026 ▶ and a
 * 3×4 month grid). Value is "YYYY-MM"; replaces the native <input type="month">
 * so the control looks consistent across browsers and matches the design system.
 */
export function MonthPicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = /^(\d{4})-(\d{2})$/.exec(value);
  const selYear = parsed ? Number(parsed[1]) : new Date().getFullYear();
  const selMonth = parsed ? Number(parsed[2]) : new Date().getMonth() + 1;
  const [viewYear, setViewYear] = useState(selYear);

  useEffect(() => {
    if (open) setViewYear(selYear);
  }, [open, selYear]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const today = currentValue();
  const label = parsed ? `${MONTHS_FULL[selMonth - 1]} ${selYear}` : 'Oy tanlang';

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-sm font-medium outline-none transition-colors',
          open ? 'border-primary-300' : 'border-line hover:bg-surface-2',
        )}
      >
        <span className="flex items-center gap-2.5">
          <CalendarEdit size={17} variant="Bulk" className={cn(open ? 'text-primary-600' : 'text-ink-muted')} />
          <span className="text-ink">{label}</span>
        </span>
        <ArrowDown2 size={15} className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Oyni tanlash"
          className="absolute inset-x-0 z-50 mt-2 min-w-[240px] origin-top rounded-2xl border border-line bg-surface p-3 shadow-pop animate-fade-in"
        >
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Oldingi yil"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft2 size={17} />
            </button>
            <span className="text-sm font-bold tabular-nums text-ink">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Keyingi yil"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowRight2 size={17} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS.map((name, i) => {
              const cellValue = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
              const selected = cellValue === value;
              const isToday = cellValue === today;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(cellValue);
                    setOpen(false);
                  }}
                  className={cn(
                    'h-10 rounded-xl text-[13px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary-300',
                    selected
                      ? 'bg-primary-600 text-white shadow-glow'
                      : isToday
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
