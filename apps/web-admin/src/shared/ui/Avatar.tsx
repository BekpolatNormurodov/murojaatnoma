import { useState, type KeyboardEvent, type MouseEvent } from 'react';
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
  onClick,
}: {
  name: string;
  src?: string;
  color?: string;
  size?: number;
  status?: 'online' | 'offline' | 'on_task' | 'break';
  ring?: boolean;
  className?: string;
  /** Berilsa — avatar bosiladigan bo'ladi (masalan profil oynasini ochish). */
  onClick?: () => void;
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

  // onClick berilganda <div> ni tugma sifatida ochamiz. Element <div> bo'lib
  // qoladi (boshqa tugma/link ichida nesting DOM'da yaroqli bo'lishi uchun);
  // bosilganda tashqi konteyner (masalan bosiladigan karta) ochilib
  // ketmasligi uchun hodisa tarqalishini to'xtatamiz.
  const clickable = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'relative shrink-0',
        clickable &&
          'cursor-pointer rounded-full transition-all hover:ring-2 hover:ring-primary-300',
        className,
      )}
      style={{ width: size, height: size }}
      {...(clickable
        ? {
            role: 'button',
            tabIndex: 0,
            onClick: (e: MouseEvent) => {
              e.stopPropagation();
              onClick();
            },
            onKeyDown: (e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClick();
              }
            },
          }
        : {})}
    >
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
