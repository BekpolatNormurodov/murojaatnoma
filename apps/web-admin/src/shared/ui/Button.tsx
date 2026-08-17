import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-primary-600 text-white hover:bg-primary-700 shadow-[0_8px_30px_rgba(16,185,129,0.25)]',
  secondary: 'bg-surface-2 text-ink hover:bg-line border border-line',
  ghost: 'text-ink-soft hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-95',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5',
  md: 'h-10 px-4 text-sm gap-2',
  lg: 'h-12 px-6 text-[15px] gap-2',
  icon: 'h-10 w-10',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-medium outline-none transition-all',
        'active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
