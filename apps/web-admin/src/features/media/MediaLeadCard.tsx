import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, MagicStar } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import type { MediaItem } from './api';
import { Highlight, SourceLogo } from './MediaIcons';
import { OfficialBadge, StorySources } from './MediaItemCard';
import { PLATFORM_META, SENTIMENT_META, clock, dayLabel, freshAgo, fullTime } from './meta';

/**
 * The newest story, magazine-style: big picture with the headline on it
 * (desktop: picture left, text right). The whole card opens the original.
 */
export function MediaLeadCard({
  item,
  search,
  now,
  onOpen,
}: {
  item: MediaItem;
  search?: string;
  now: number;
  onOpen?: (item: MediaItem) => void;
}) {
  const reduce = useReducedMotion();
  const [imgFailed, setImgFailed] = useState(false);
  const platform = PLATFORM_META[item.platform] ?? PLATFORM_META.web;
  const senti = SENTIMENT_META[item.sentiment];
  const summary = item.aiSummary ?? item.excerpt;
  const ago = freshAgo(item.publishedAt, now);
  const showImage = !!item.imageUrl && !imgFailed;

  return (
    <motion.article
      initial={reduce ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="group relative grid overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-shadow hover:shadow-pop focus-within:ring-2 focus-within:ring-primary-400 lg:grid-cols-[1.15fr_1fr]"
    >
      {/* Picture */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-2 lg:aspect-auto lg:min-h-[300px]">
        {showImage ? (
          <img
            src={item.imageUrl!}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-700 motion-safe:group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-600 via-accent-700 to-violet-700 text-white/90">
            <platform.Icon size={64} />
          </div>
        )}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent lg:bg-gradient-to-r lg:from-transparent lg:via-transparent lg:to-black/10" />
        <div className="absolute left-3 top-3 flex items-center gap-1.5">
          <span className="rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
            Eng yangi
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold shadow dark:bg-slate-900/90" style={{ color: platform.color }}>
            <platform.Icon size={12} /> {platform.label}
          </span>
        </div>
        {/* phones: headline over the picture */}
        <p className="absolute inset-x-3 bottom-3 line-clamp-3 text-lg font-bold leading-snug text-white drop-shadow lg:hidden">
          {item.title}
        </p>
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-col p-4 sm:p-5 lg:p-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-soft">
          <SourceLogo item={item} size={20} />
          <span className="min-w-0 truncate font-semibold text-ink">{item.sourceName}</span>
          {item.official && <OfficialBadge />}
          <span aria-hidden="true">·</span>
          <time dateTime={item.publishedAt} title={fullTime(item.publishedAt)} className="font-semibold tabular-nums">
            {dayLabel(item.publishedAt, new Date(now))}, {clock(item.publishedAt)}
          </time>
          {ago && <span>· {ago}</span>}
        </div>

        <h3 className="mt-3 hidden text-[22px] font-bold leading-snug tracking-tight text-ink lg:block xl:text-2xl">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen?.(item)}
            className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:text-primary-700 dark:group-hover:text-primary-300"
          >
            <Highlight text={item.title} term={search} />
          </a>
        </h3>
        {/* phones: the card itself is the link (title is on the picture) */}
        <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => onOpen?.(item)} className="absolute inset-0 lg:hidden" aria-label={item.title} />

        {summary && (
          <p className="mt-2.5 line-clamp-4 text-[15px] leading-relaxed text-ink-soft">
            {item.aiSummary && <MagicStar size={14} variant="Bold" className="mr-1 inline -translate-y-px text-violet-500" aria-label="AI xulosa" />}
            <Highlight text={summary} term={search} />
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1', senti.pill)}>
            <senti.Icon size={14} variant="Bold" color="currentColor" aria-hidden="true" />
            {senti.label}
          </span>
          {item.topic && (
            <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line">{item.topic}</span>
          )}
          <StorySources refs={item.alsoIn} />
          <span className="ml-auto inline-flex items-center gap-1 text-[13px] font-semibold text-primary-700 dark:text-primary-300">
            Asl manbada o'qish
            <ArrowRight size={16} className="transition-transform motion-safe:group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </motion.article>
  );
}
