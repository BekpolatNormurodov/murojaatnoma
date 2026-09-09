import { ArrowLeft2, ArrowRight2 } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

/** Compact page-number model with ellipses: 1 … 4 5 [6] 7 8 … 20 */
function pageItems(page: number, pageCount: number): (number | '…')[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const items: (number | '…')[] = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(pageCount - 1, page + 1);
  if (from > 2) items.push('…');
  for (let i = from; i <= to; i++) items.push(i);
  if (to < pageCount - 1) items.push('…');
  items.push(pageCount);
  return items;
}

/**
 * Pro table pagination: "X–Y / total" range on the left, prev / numbered pages
 * (with ellipses) / next on the right. Client-side; parent owns `page`.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  className?: string;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  if (pageCount <= 1) return null;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const btn =
    'grid h-9 min-w-9 place-items-center rounded-lg border border-line bg-surface px-2 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 px-5 py-3.5', className)}>
      <span className="text-[12.5px] text-ink-muted">
        <span className="font-semibold text-ink-soft">{from}–{to}</span> / {total}
      </span>
      <div className="flex items-center gap-1.5">
        <button className={btn} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Oldingi">
          <ArrowLeft2 size={16} />
        </button>
        {pageItems(page, pageCount).map((it, i) =>
          it === '…' ? (
            <span key={`e${i}`} className="px-1 text-ink-muted">
              …
            </span>
          ) : (
            <button
              key={it}
              onClick={() => onPage(it)}
              aria-current={it === page ? 'page' : undefined}
              className={cn(
                btn,
                it === page && 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-50',
              )}
            >
              {it}
            </button>
          ),
        )}
        <button className={btn} onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Keyingi">
          <ArrowRight2 size={16} />
        </button>
      </div>
    </div>
  );
}
