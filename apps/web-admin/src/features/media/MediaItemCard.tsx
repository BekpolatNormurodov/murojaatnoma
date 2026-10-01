import { memo, useEffect, useRef, useState } from 'react';
import { ArrowDown2, Eye, EyeSlash, ExportSquare, MagicStar, ShieldTick, Star1, TickCircle } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { formatCompact } from '@/shared/lib/format';
import type { MediaItem, MediaSentiment, MediaStatus } from './api';
import { Highlight, SourceLogo } from './MediaIcons';
import { PLATFORM_META, SENTIMENT_META, SENTIMENTS, clock, freshAgo, fullTime } from './meta';

interface Props {
  item: MediaItem;
  search?: string;
  canWrite: boolean;
  onStatus: (id: string, status: MediaStatus) => void;
  onSentiment: (id: string, sentiment: MediaSentiment) => void;
  onOpen?: (item: MediaItem) => void;
  onTopic?: (topic: string) => void;
  /** Ticks every minute so "12 daqiqa oldin" stays true. */
  now?: number;
}

/**
 * One news item. The title link is stretched over the whole card (one tab stop,
 * opens the original in a new tab); the action buttons sit above it (z-10).
 */
export const MediaItemCard = memo(function MediaItemCard({
  item,
  search,
  canWrite,
  onStatus,
  onSentiment,
  onOpen,
  onTopic,
  now,
}: Props) {
  const ago = freshAgo(item.publishedAt, now);
  const [imgFailed, setImgFailed] = useState(false);
  const platform = PLATFORM_META[item.platform] ?? PLATFORM_META.web;
  const senti = SENTIMENT_META[item.sentiment];
  const summary = item.aiSummary ?? item.excerpt;
  const important = item.status === 'important';
  const hidden = item.status === 'hidden';
  const unseen = item.status === 'new';
  const showImage = !!item.imageUrl && !imgFailed;

  return (
    <article
      className={cn(
        // Phones: source line on top, thumbnail beside the title. ≥sm: thumbnail column on the left.
        'group relative grid grid-cols-[minmax(0,1fr)_76px] gap-x-3 rounded-2xl border bg-surface p-3.5 transition-all duration-200',
        "[grid-template-areas:'src_src'_'title_thumb'_'sum_sum'_'meta_meta']",
        "sm:grid-cols-[144px_minmax(0,1fr)] sm:gap-x-4 sm:p-4 sm:[grid-template-areas:'thumb_src'_'thumb_title'_'thumb_sum'_'thumb_meta']",
        'hover:-translate-y-px hover:shadow-card focus-within:ring-2 focus-within:ring-primary-300',
        important ? 'border-amber-300 dark:border-amber-500/50' : 'border-line hover:border-primary-200',
        hidden && 'opacity-60',
      )}
    >
      {unseen && (
        <span
          className="absolute left-0 top-4 h-8 w-1 rounded-r-full bg-primary-500"
          aria-label="Yangi"
          title="Ko'rilmagan"
        />
      )}

      {/* Thumbnail / platform tile */}
      <div className="relative mt-1.5 h-[76px] w-[76px] self-start overflow-hidden rounded-xl bg-surface-2 [grid-area:thumb] sm:mt-0 sm:h-24 sm:w-36">
        {showImage ? (
          <img
            src={item.imageUrl!}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className={cn('flex h-full w-full items-center justify-center', platform.tile)}>
            <platform.Icon size={30} />
          </div>
        )}
        <span
          className="absolute bottom-1.5 left-1.5 flex h-6 w-6 items-center justify-center rounded-lg bg-white/95 shadow-sm dark:bg-slate-900/90"
          style={{ color: platform.color }}
          title={platform.label}
        >
          <platform.Icon size={14} />
        </span>
      </div>

      {/* Source line */}
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-muted [grid-area:src]">
        <SourceLogo item={item} size={16} />
        <span className="min-w-0 truncate font-medium text-ink-soft">{item.sourceName}</span>
        {item.official && <OfficialBadge />}
        <span aria-hidden="true">·</span>
        <time dateTime={item.publishedAt} title={fullTime(item.publishedAt)} className="shrink-0 font-semibold tabular-nums text-ink-soft">
          {clock(item.publishedAt)}
        </time>
        {ago && <span className="hidden shrink-0 sm:inline">· {ago}</span>}
        {item.views ? (
          <span className="hidden shrink-0 items-center gap-0.5 sm:inline-flex" title="Ko'rishlar">
            <span aria-hidden="true">·</span>
            <Eye size={13} /> {formatCompact(item.views)}
          </span>
        ) : null}
        <span
          className={cn(
            'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1',
            senti.pill,
          )}
        >
          <senti.Icon size={13} variant="Bold" color="currentColor" />
          {senti.label}
        </span>
      </div>

      {/* Title — stretched link */}
      <h3 className="mt-1.5 min-w-0 text-[14px] font-semibold leading-snug text-ink [grid-area:title] sm:text-[15px]">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onOpen?.(item)}
          className="line-clamp-3 outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] group-hover:text-primary-700 sm:line-clamp-2 dark:group-hover:text-primary-300"
        >
          <Highlight text={item.title} term={search} />
        </a>
      </h3>

      {summary ? (
        <p className="mt-1.5 line-clamp-2 min-w-0 text-[13px] leading-relaxed text-ink-soft [grid-area:sum] sm:mt-1">
          {item.aiSummary && (
            <MagicStar size={13} variant="Bold" className="mr-1 inline -translate-y-px text-violet-500" aria-label="AI xulosa" />
          )}
          <Highlight text={summary} term={search} />
        </p>
      ) : (
        <span className="[grid-area:sum]" />
      )}

      {/* Meta + actions */}
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-2.5 [grid-area:meta]">
        {item.topic && (
          <button
            type="button"
            onClick={() => onTopic?.(item.topic!)}
            className="relative z-10 rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:text-ink hover:ring-primary-300"
            title="Shu mavzu bo'yicha saralash"
          >
            {item.topic}
          </button>
        )}
        {item.keywords.slice(0, 2).map((k) => (
          <span
            key={k}
            className="hidden rounded-lg bg-primary-50 px-2 py-1 text-[11px] font-medium text-primary-700 sm:inline dark:bg-primary-500/10 dark:text-primary-300"
          >
            {k}
          </span>
        ))}

        <div className="relative z-10 ml-auto flex items-center gap-0.5">
          {canWrite && (
            <>
              <SentimentMenu value={item.sentiment} onChange={(s) => onSentiment(item.id, s)} />
              <IconAction
                label={important ? 'Muhimdan olish' : 'Muhim deb belgilash'}
                active={important}
                onClick={() => onStatus(item.id, important ? 'seen' : 'important')}
              >
                <Star1 size={17} variant={important ? 'Bold' : 'Linear'} className={important ? 'text-amber-500' : undefined} />
              </IconAction>
              <IconAction
                label={hidden ? 'Qaytarish' : 'Tegishli emas — yashirish'}
                onClick={() => onStatus(item.id, hidden ? 'seen' : 'hidden')}
              >
                {hidden ? <TickCircle size={17} /> : <EyeSlash size={17} />}
              </IconAction>
            </>
          )}
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onOpen?.(item)}
            aria-label="Asl manbada ochish"
            title="Asl manbada ochish"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-500/10"
          >
            <ExportSquare size={17} />
          </a>
        </div>
      </div>
    </article>
  );
});

/** State body (gov.uz, President's press office, UzA, parliament, hokimlik). */
export function OfficialBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md bg-accent-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-700 ring-1 ring-accent-200 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/30"
      title="Rasmiy davlat manbasi"
    >
      <ShieldTick size={11} variant="Bold" />
      {!compact && 'Rasmiy'}
    </span>
  );
}

function IconAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

/** Lets an admin correct the automatic sentiment. */
function SentimentMenu({ value, onChange }: { value: MediaSentiment; onChange: (s: MediaSentiment) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  const cur = SENTIMENT_META[value];
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Baholashni o'zgartirish"
        title="Baholashni o'zgartirish"
        className="flex h-9 items-center gap-0.5 rounded-xl px-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <cur.Icon size={17} color={cur.color} variant="Bold" />
        <ArrowDown2 size={12} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-20 mb-1.5 w-40 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-pop"
        >
          {SENTIMENTS.map((s) => {
            const m = SENTIMENT_META[s];
            return (
              <button
                key={s}
                role="menuitemradio"
                aria-checked={s === value}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (s !== value) onChange(s);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface-2',
                  s === value && 'font-semibold',
                )}
              >
                <m.Icon size={16} color={m.color} variant="Bold" />
                {m.label}
                {s === value && <TickCircle size={14} className="ml-auto text-primary-600" variant="Bold" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
