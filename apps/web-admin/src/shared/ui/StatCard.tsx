import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, type Icon as IconType } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { formatDelta } from '@/shared/lib/format';

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  hint,
  tint = '#10b981',
  index = 0,
  to,
}: {
  icon: IconType;
  label: string;
  value: string;
  /** Period-over-period change, % (omit when there is no honest baseline). */
  delta?: number;
  /** Shown next to the delta, e.g. "30 kun". */
  deltaLabel?: string;
  /** For "bad when it grows" metrics (overdue): up = red, down = green. */
  invertDelta?: boolean;
  /** Small secondary line under the label. */
  hint?: React.ReactNode;
  tint?: string;
  index?: number;
  /** Makes the whole card a link. */
  to?: string;
}) {
  const up = (delta ?? 0) >= 0;
  const good = invertDelta ? !up : up;
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${tint}1a`, color: tint }}
        >
          <Icon size={22} variant="Bulk" />
        </div>
        {delta !== undefined && (
          <span
            title={deltaLabel ? `Oldingi ${deltaLabel}ga nisbatan` : undefined}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
              delta === 0
                ? 'bg-surface-2 text-ink-soft'
                : good
                  ? 'bg-success-soft text-primary-700'
                  : 'bg-danger-soft text-red-700',
            )}
          >
            {delta !== 0 && (up ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
            {formatDelta(Math.abs(delta))}
            {deltaLabel && <span className="font-medium opacity-70">· {deltaLabel}</span>}
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
      <div className="mt-1 text-[13px] text-ink-muted">{label}</div>
      {hint && <div className="mt-2 text-xs text-ink-soft">{hint}</div>}
    </>
  );
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="h-full"
    >
      {to ? (
        <Link
          to={to}
          className="block h-full rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-pop focus-visible:outline-2 focus-visible:outline-primary-500"
        >
          {body}
        </Link>
      ) : (
        <div className="h-full rounded-2xl border border-line bg-surface p-5 shadow-card">{body}</div>
      )}
    </motion.div>
  );
}
