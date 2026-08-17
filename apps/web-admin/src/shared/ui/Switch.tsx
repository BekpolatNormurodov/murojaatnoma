import { motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';

export function Switch({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors outline-none',
        checked ? 'bg-primary-500' : 'bg-ink-muted/40',
        disabled && 'cursor-not-allowed opacity-50',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={cn(
          'inline-block h-5 w-5 rounded-full bg-white shadow-sm',
          checked ? 'ml-5.5' : 'ml-0.5',
        )}
      />
    </button>
  );
}
