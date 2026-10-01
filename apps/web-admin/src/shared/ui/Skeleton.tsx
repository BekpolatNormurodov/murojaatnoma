import { cn } from '@/shared/lib/cn';

/**
 * Shimmer placeholder (see `.skeleton` in index.css). Size it with classes:
 * `<Skeleton className="h-4 w-32" />`. `circle` for avatars.
 */
export function Skeleton({ className, circle }: { className?: string; circle?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn('skeleton', circle ? 'rounded-full' : 'rounded-xl', className)}
    />
  );
}

/** A few text-line placeholders (last line shorter, like real text). */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-3 rounded-md', i === lines - 1 ? 'w-3/5' : 'w-full')}
        />
      ))}
    </div>
  );
}

/** List-row placeholder: avatar + two lines + trailing pill. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 px-2 py-2.5', className)} aria-hidden>
      <Skeleton circle className="h-9 w-9 shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3 w-2/3 rounded-md" />
        <Skeleton className="h-2.5 w-2/5 rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}
