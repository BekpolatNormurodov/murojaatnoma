import { motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { ArrowUp, ArrowDown, type Icon as IconType } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  deltaLabel,
  invertDelta = false,
  neutralDelta = false,
  spark,
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
  /** Neither good nor bad (e.g. incoming volume) — grey badge. */
  neutralDelta?: boolean;
  /** Mini trend (e.g. last 14 days) drawn under the value. */
  spark?: number[];
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11"
          style={{ background: `${tint}1a`, color: tint }}
        >
          <Icon size={22} variant="Bulk" />
        </div>
        {delta !== undefined && (
          <span
            title={deltaLabel ? `Oldingi ${deltaLabel}ga nisbatan` : undefined}
            className={cn(
              'inline-flex min-w-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-xs font-semibold',
              delta === 0 || neutralDelta
                ? 'bg-surface-2 text-ink-soft'
                : good
                  ? 'bg-success-soft text-primary-700'
                  : 'bg-danger-soft text-red-700',
            )}
          >
            {delta !== 0 && (up ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
            {/* The arrow carries the direction — "↓ +100%" used to read as nonsense. */}
            {`${Math.abs(delta).toFixed(Math.abs(delta) >= 10 ? 0 : 1)}%`}
            {deltaLabel && (
              <span className="hidden font-medium opacity-70 sm:inline">· {deltaLabel}</span>
            )}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-2xl font-bold tracking-tight text-ink tabular-nums">{value}</div>
        {spark && spark.some((v) => v > 0) && (
          <div className="h-9 w-24 shrink-0" aria-hidden>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={tint}
                  strokeWidth={2}
                  fill={tint}
                  fillOpacity={0.12}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
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
