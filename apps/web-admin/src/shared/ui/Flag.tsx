import { useId } from 'react';
import type { Lang } from '@/shared/i18n/dict';
import { cn } from '@/shared/lib/cn';

/**
 * Davlat bayrog'i — toza SVG (emoji emas).
 * Emoji bayroqlar Windows'da harf sifatida ko'rinadi, shuning uchun
 * har bir til uchun aniq SVG chiziladi. Hammasi 3:2 nisbatda (60x40).
 */
export function Flag({ code, className }: { code: Lang; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 overflow-hidden rounded-[3px] ring-1 ring-black/10 dark:ring-white/15',
        className ?? 'h-4 w-6',
      )}
    >
      {code === 'uz' && <UzFlag />}
      {code === 'ru' && <RuFlag />}
      {code === 'en' && <GbFlag />}
    </span>
  );
}

function UzFlag() {
  return (
    <svg viewBox="0 0 60 40" className="block h-full w-full" preserveAspectRatio="none">
      <rect width="60" height="40" fill="#fff" />
      <rect width="60" height="12.6" fill="#0099b5" />
      <rect y="27.4" width="60" height="12.6" fill="#1eb53a" />
      <rect y="12.6" width="60" height="1.4" fill="#ce1126" />
      <rect y="26" width="60" height="1.4" fill="#ce1126" />
      {/* Yarim oy */}
      <circle cx="13" cy="6.3" r="4" fill="#fff" />
      <circle cx="15" cy="6.3" r="4" fill="#0099b5" />
      {/* Yulduzlar */}
      <g fill="#fff">
        <circle cx="21" cy="3.4" r="0.8" />
        <circle cx="21" cy="6.3" r="0.8" />
        <circle cx="21" cy="9.2" r="0.8" />
        <circle cx="24" cy="4.8" r="0.8" />
        <circle cx="24" cy="7.7" r="0.8" />
        <circle cx="27" cy="6.3" r="0.8" />
      </g>
    </svg>
  );
}

function RuFlag() {
  return (
    <svg viewBox="0 0 60 40" className="block h-full w-full" preserveAspectRatio="none">
      <rect width="60" height="40" fill="#fff" />
      <rect y="13.33" width="60" height="13.34" fill="#0039a6" />
      <rect y="26.67" width="60" height="13.33" fill="#d52b1e" />
    </svg>
  );
}

function GbFlag() {
  const raw = useId().replace(/:/g, '');
  const cs = `gb-s-${raw}`;
  const ct = `gb-t-${raw}`;
  return (
    <svg viewBox="0 0 60 40" className="block h-full w-full" preserveAspectRatio="none">
      <clipPath id={cs}>
        <path d="M0,0 v40 h60 v-40 z" />
      </clipPath>
      <clipPath id={ct}>
        <path d="M30,20 h30 v20 z v-20 h-30 z h-30 v-20 z v20 h30 z" />
      </clipPath>
      <g clipPath={`url(#${cs})`}>
        <path d="M0,0 v40 h60 v-40 z" fill="#012169" />
        <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
        <path
          d="M0,0 L60,40 M60,0 L0,40"
          clipPath={`url(#${ct})`}
          stroke="#c8102e"
          strokeWidth="5.3"
        />
        <path d="M30,0 v40 M0,20 h60" stroke="#fff" strokeWidth="13.3" />
        <path d="M30,0 v40 M0,20 h60" stroke="#c8102e" strokeWidth="8" />
      </g>
    </svg>
  );
}
