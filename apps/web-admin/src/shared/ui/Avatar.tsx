import { useState } from 'react';
import { cn } from '@/shared/lib/cn';

/** Ism bo'yicha bosh harflar (initials). */
function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({
  name,
  src,
  color = '#10b981',
  size = 40,
  status,
  ring = false,
  className,
}: {
  name: string;
  src?: string;
  color?: string;
  size?: number;
  status?: 'online' | 'offline' | 'on_task' | 'break';
  ring?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const statusColor =
    status === 'online'
      ? 'bg-success'
      : status === 'on_task'
        ? 'bg-warning'
        : status === 'break'
          ? 'bg-accent-500'
          : 'bg-ink-muted';

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full rounded-full object-cover',
            ring && 'ring-2 ring-surface',
          )}
          style={{ background: `${color}22` }}
        />
      ) : (
        <div
          className={cn(
            'flex h-full w-full items-center justify-center rounded-full font-semibold text-white',
            ring && 'ring-2 ring-surface',
          )}
          style={{
            background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            fontSize: size * 0.38,
          }}
        >
          {initials(name)}
        </div>
      )}
      {status && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-2 border-surface',
            statusColor,
          )}
          style={{ width: Math.max(8, size * 0.28), height: Math.max(8, size * 0.28) }}
        />
      )}
    </div>
  );
}
