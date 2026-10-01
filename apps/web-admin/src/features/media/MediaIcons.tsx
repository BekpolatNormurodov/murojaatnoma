import { useState } from 'react';
import { Global, Instagram, Youtube } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import type { MediaItem } from './api';
import { PLATFORM_META, outletDomain } from './meta';

/** Telegram's paper-plane mark (iconsax has none). Simple Icons, CC0. */
export function TelegramIcon({ size = 18, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

type IconProps = { size?: number; className?: string };

export function WebIcon({ size = 18, className }: IconProps) {
  return <Global size={size} variant="Bold" className={className} color="currentColor" />;
}
export function YoutubeIcon({ size = 18, className }: IconProps) {
  return <Youtube size={size} variant="Bold" className={className} color="currentColor" />;
}
export function InstagramIcon({ size = 18, className }: IconProps) {
  return <Instagram size={size} variant="Bold" className={className} color="currentColor" />;
}

/**
 * Round outlet mark: the site's favicon for web items (falls back to a globe),
 * the platform logo for Telegram / YouTube / Instagram.
 */
export function SourceLogo({
  item,
  size = 20,
  className,
}: {
  item: Pick<MediaItem, 'url' | 'sourceName' | 'platform'>;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const meta = PLATFORM_META[item.platform] ?? PLATFORM_META.web;
  const domain = outletDomain(item);
  const box = { width: size, height: size };
  if (domain && !failed) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        style={box}
        className={cn('shrink-0 rounded-full bg-white object-contain ring-1 ring-line', className)}
      />
    );
  }
  return (
    <span
      style={box}
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-full', meta.tile, className)}
    >
      <meta.Icon size={Math.round(size * 0.7)} />
    </span>
  );
}

/** Highlights `term` inside `text` (case-insensitive) with <mark>. */
export function Highlight({ text, term }: { text: string; term?: string }) {
  const t = term?.trim();
  if (!t || t.length < 2) return <>{text}</>;
  const parts = text.split(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-200/70 px-0.5 text-inherit dark:bg-amber-400/30">
            {p}
          </mark>
        ) : (
          p
        ),
      )}
    </>
  );
}
