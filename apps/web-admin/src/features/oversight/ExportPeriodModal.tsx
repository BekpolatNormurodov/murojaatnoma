import { useState } from 'react';
import { DocumentDownload, RotateRight } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/ui/DatePicker';
import { MonthPicker } from '@/shared/ui/MonthPicker';
import { cn } from '@/shared/lib/cn';
import {
  daysInclusive,
  localDay,
  MAX_DAILY_DAYS,
  MAX_RANGE_DAYS,
  monthRange,
  rangeText,
  resolvePeriod,
  type Range,
} from './period';

type Mode = 'week' | 'month' | 'custom';

/** Excel davri: oxirgi 7 kun + bugun, bir oy yoki ixtiyoriy oraliq. */
export function ExportPeriodModal({
  open,
  pageMonth,
  filterNote,
  busy,
  onClose,
  onExport,
}: {
  open: boolean;
  /** Sahifada tanlangan oy, "YYYY-MM". */
  pageMonth: string;
  /** Faol filtr / qidiruv haqida eslatma (bo'lsa). */
  filterNote?: string;
  busy: boolean;
  onClose: () => void;
  onExport: (range: Range) => void;
}) {
  const [mode, setMode] = useState<Mode>('week');
  const [month, setMonth] = useState(pageMonth);
  const [custom, setCustom] = useState<Range>(() => resolvePeriod({ preset: 'week' }));
  // Har ochilganda sahifadagi oydan boshlanadi.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setMonth(pageMonth);
      setMode(pageMonth === localDay().slice(0, 7) ? 'week' : 'month');
    }
  }

  const today = localDay();
  const [y, m] = month.split('-').map(Number);
  const range = mode === 'week' ? resolvePeriod({ preset: 'week' }) : mode === 'month' ? monthRange(y, m) : custom;
  const days = daysInclusive(range.from, range.to);
  const problem =
    !range.from || !range.to
      ? 'Ikkala sanani tanlang'
      : range.from > range.to
        ? "Boshlanish sanasi tugash sanasidan keyin bo'lmasin"
        : range.to > today
          ? "Kelajak sanani tanlab bo'lmaydi"
          : days > MAX_RANGE_DAYS
            ? `Davr ${MAX_RANGE_DAYS} kundan oshmasin`
            : null;

  const options: { key: Mode; label: string }[] = [
    { key: 'week', label: 'Oxirgi 7 kun va bugun' },
    { key: 'month', label: 'Oy bo‘yicha' },
    { key: 'custom', label: 'Boshqa davr' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Excel davri" subtitle="Qaysi kunlar uchun hisobot tayyorlansin" width={440}>
      <div className="space-y-4">
        <div className="space-y-2" role="radiogroup" aria-label="Davr">
          {options.map((o) => (
            <label
              key={o.key}
              className={cn(
                'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[13.5px] font-medium',
                mode === o.key ? 'border-primary-300 bg-primary-50 text-primary-700' : 'border-line text-ink-soft',
              )}
            >
              <input
                type="radio"
                name="export-period"
                checked={mode === o.key}
                onChange={() => setMode(o.key)}
                className="h-4 w-4 accent-primary-600"
              />
              {o.label}
            </label>
          ))}
        </div>

        {mode === 'month' && <MonthPicker value={month} onChange={setMonth} max={today.slice(0, 7)} />}
        {mode === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            {(['from', 'to'] as const).map((k) => {
              const label = k === 'from' ? 'Boshlanish' : 'Tugash';
              return (
                <div key={k} className="min-w-0 text-[12px] text-ink-muted">
                  {label}
                  <DatePicker
                    value={custom[k]}
                    max={today}
                    onChange={(v) => setCustom((r) => ({ ...r, [k]: v }))}
                    ariaLabel={label}
                    compact
                    block
                    className="mt-1"
                  />
                </div>
              );
            })}
          </div>
        )}

        {problem ? (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[12.5px] font-medium text-red-700">
            {problem}
          </p>
        ) : (
          <div className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-soft">
            <span className="font-semibold tabular-nums text-ink">{rangeText(range)}</span> · {days} kun
            {days > MAX_DAILY_DAYS && (
              <span className="mt-0.5 block text-amber-700">
                «Kunlik» va «Oraliqlar» varaqlari faqat {MAX_DAILY_DAYS} kungacha bo'lgan davrda qo'shiladi.
              </span>
            )}
          </div>
        )}
        {filterNote && <p className="text-[12px] text-ink-muted">{filterNote}</p>}

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Bekor qilish
          </Button>
          <Button onClick={() => onExport(range)} disabled={busy || !!problem}>
            {busy ? <RotateRight size={18} className="animate-spin" /> : <DocumentDownload size={18} />}
            {busy ? 'Tayyorlanmoqda...' : 'Yuklab olish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
