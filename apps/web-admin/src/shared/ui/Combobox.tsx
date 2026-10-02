import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Add, ArrowDown2, TickCircle } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { matchesSearch } from '@/shared/lib/translit';

/**
 * Erkin matn + tavsiyalar — native `<datalist>` (brauzerning kulrang
 * ro'yxati va ▼ belgisi) o'rniga. Yozilgan matn bo'yicha (kirill/lotin
 * farqisiz) filtrlanadi; ro'yxatda yo'q qiymat ham kiritiladi ("Yangi").
 * Klaviatura: ↑ ↓ Enter Esc.
 */
export function Combobox({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  invalid = false,
  newLabel = 'Yangi',
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  invalid?: boolean;
  /** Ro'yxatda yo'q qiymat yozilganda ko'rsatiladigan belgi. */
  newLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const unique = [...new Set(suggestions.map((s) => s.trim()).filter(Boolean))];
  const exact = unique.some((s) => s.toLowerCase() === value.trim().toLowerCase());
  // To'liq mos kelsa — hamma variantlar ko'rinsin (boshqasini tanlash oson).
  const items = (exact ? unique : unique.filter((s) => matchesSearch(value, s))).slice(0, 8);
  const showNew = value.trim().length > 0 && !exact;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
    setActive(-1);
  };

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <div
        className={cn(
          'flex h-11 items-center rounded-xl border bg-surface-2 transition-colors focus-within:bg-surface',
          invalid ? 'border-danger' : open ? 'border-primary-300' : 'border-line focus-within:border-primary-300',
        )}
      >
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={value}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(items.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(-1, i - 1));
            } else if (e.key === 'Enter' && open && active >= 0 && items[active]) {
              e.preventDefault();
              choose(items[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
          className="h-full min-w-0 flex-1 bg-transparent px-4 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
        {unique.length > 0 && (
          <button
            type="button"
            tabIndex={-1}
            aria-label="Variantlarni ko'rsatish"
            onClick={() => setOpen((o) => !o)}
            className="mr-1.5 grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-surface-2 hover:text-ink"
          >
            <ArrowDown2 size={15} className={cn('transition-transform', open && 'rotate-180')} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (items.length > 0 || showNew) && (
          <motion.ul
            id={listId}
            role="listbox"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-pop"
          >
            {items.map((s, i) => {
              const selected = s.toLowerCase() === value.trim().toLowerCase();
              return (
                <li key={s} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(s)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] transition-colors',
                      i === active ? 'bg-surface-2 text-ink' : 'text-ink-soft',
                      selected && 'font-semibold text-primary-700',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{s}</span>
                    {selected && <TickCircle size={16} variant="Bold" className="shrink-0 text-primary-600" />}
                  </button>
                </li>
              );
            })}
            {showNew && (
              <li className={cn(items.length > 0 && 'mt-1 border-t border-line pt-1')}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(value.trim())}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-primary-700 hover:bg-primary-50"
                >
                  <Add size={16} className="shrink-0" />
                  <span className="min-w-0 truncate">
                    {newLabel}: «{value.trim()}»
                  </span>
                </button>
              </li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
