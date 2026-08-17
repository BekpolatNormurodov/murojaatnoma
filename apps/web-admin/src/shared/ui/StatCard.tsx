import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, type Icon as IconType } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { formatDelta } from '@/shared/lib/format';

export function StatCard({
  icon: Icon,
  label,
  value,
  delta,
  tint = '#10b981',
  index = 0,
}: {
  icon: IconType;
  label: string;
  value: string;
  delta?: number;
  tint?: string;
  index?: number;
}) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-line bg-surface p-5 shadow-card"
    >
      <div className="flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-xl"
          style={{ background: `${tint}1a`, color: tint }}
        >
          <Icon size={22} variant="Bulk" />
        </div>
        {delta !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
              positive ? 'bg-success-soft text-primary-700' : 'bg-danger-soft text-red-700',
            )}
          >
            {positive ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
            {formatDelta(Math.abs(delta))}
          </span>
        )}
      </div>
      <div className="mt-4 text-2xl font-bold tracking-tight text-ink">{value}</div>
      <div className="mt-1 text-[13px] text-ink-muted">{label}</div>
    </motion.div>
  );
}
