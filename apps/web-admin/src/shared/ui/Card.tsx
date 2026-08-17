import { type HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl border border-line bg-surface shadow-card',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4 p-5 pb-0', className)}>
      <div>
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
