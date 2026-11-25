import { ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { DateRangePicker } from '@/shared/ui/DatePicker';
import { cn } from '@/shared/lib/cn';
import {
  clampRange,
  localDay,
  PERIOD_PRESETS,
  resolvePeriod,
  shiftRange,
  toSelection,
  type PeriodSelection,
} from './period';

/** Davr tanlagich: Bugun / 7 kun / 30 kun, ‹ oraliq (yoki bitta kun) ›. */
export function PeriodBar({ value, onChange }: { value: PeriodSelection; onChange: (v: PeriodSelection) => void }) {
  const today = localDay();
  const range = resolvePeriod(value, today);
  const arrow =
    'grid h-11 w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40';
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex w-fit rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Davr">
        {PERIOD_PRESETS.map((p) => {
          const active = 'preset' in value && value.preset === p.key;
          return (
            <button
              key={p.key}
              role="tab"
              aria-selected={active}
              onClick={() => onChange({ preset: p.key })}
              className={cn(
                'rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors',
                active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className={arrow}
          onClick={() => onChange(toSelection(shiftRange(range, -1, today), today))}
          aria-label="Oldingi davr"
          title="Oldingi davr"
        >
          <ArrowLeft2 size={16} />
        </button>
        <DateRangePicker
          from={range.from}
          to={range.to}
          onChange={(r) => onChange(toSelection(clampRange(r, today), today))}
        />
        <button
          type="button"
          className={arrow}
          onClick={() => onChange(toSelection(shiftRange(range, 1, today), today))}
          disabled={range.to >= today}
          aria-label="Keyingi davr"
          title="Keyingi davr"
        >
          <ArrowRight2 size={16} />
        </button>
      </div>
    </div>
  );
}
