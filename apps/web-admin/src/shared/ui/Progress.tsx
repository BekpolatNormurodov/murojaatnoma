import { cn } from '@/shared/lib/cn';

export function Progress({
  value,
  color = '#10b981',
  track = 'bg-surface-2',
  height = 8,
  className,
}: {
  value: number; // 0..100
  color?: string;
  track?: string;
  height?: number;
  className?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn('w-full overflow-hidden rounded-full', track, className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{ width: `${v}%`, background: color }}
      />
    </div>
  );
}
