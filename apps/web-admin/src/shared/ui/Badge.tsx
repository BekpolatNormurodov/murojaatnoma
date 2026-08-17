import { cn } from '@/shared/lib/cn';

type Tone = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'primary';

const tones: Record<Tone, string> = {
  info: 'bg-info-soft text-accent-700',
  warning: 'bg-warning-soft text-amber-700',
  success: 'bg-success-soft text-primary-700',
  danger: 'bg-danger-soft text-red-700',
  neutral: 'bg-surface-2 text-ink-soft',
  primary: 'bg-primary-100 text-primary-700',
};

export function Badge({
  children,
  tone = 'neutral',
  dot = false,
  className,
}: {
  children: React.ReactNode;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
