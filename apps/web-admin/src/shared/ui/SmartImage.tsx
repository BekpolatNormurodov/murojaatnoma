import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft2, ArrowRight2, CloseCircle, DocumentDownload, GalleryRemove } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';

/**
 * Rasm — yuklanguncha shimmer, keyin silliq paydo bo'ladi; ochilmasa singan
 * belgi o'rniga toza "Rasm ochilmadi" ko'rinishi. `loading="lazy"` +
 * `decoding="async"` — ro'yxatlarda faqat ko'ringanlari yuklanadi.
 * (Server jpg/png uchun WebP nusxasini o'zi beradi — URL o'zgarmaydi.)
 */
export function SmartImage({
  src,
  alt = '',
  className,
  imgClassName,
  fallbackLabel = 'Rasm ochilmadi',
  onClick,
}: {
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
  fallbackLabel?: string;
  onClick?: () => void;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [seen, setSeen] = useState(src);
  if (seen !== src) {
    setSeen(src);
    setState('loading');
  }

  const body =
    state === 'error' ? (
      <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-surface-2 p-2 text-center text-ink-muted">
        <GalleryRemove size={22} variant="Bulk" />
        <span className="text-[11px] leading-tight">{fallbackLabel}</span>
      </span>
    ) : (
      <>
        {state === 'loading' && <span className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden />}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-300',
            state === 'ok' ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      </>
    );

  return onClick && state !== 'error' ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={alt || 'Rasmni kattalashtirish'}
      className={cn('relative block overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500', className)}
    >
      {body}
    </button>
  ) : (
    <span className={cn('relative block overflow-hidden', className)}>{body}</span>
  );
}

/**
 * Rasmlarni to'liq ekranda ko'rish: ← → klavishlari, Esc, yuklab olish.
 */
export function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndex,
}: {
  photos: string[];
  index: number | null;
  onClose: () => void;
  onIndex: (i: number) => void;
}) {
  const open = index != null && photos.length > 0;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndex(((index ?? 0) + 1) % photos.length);
      if (e.key === 'ArrowLeft') onIndex(((index ?? 0) - 1 + photos.length) % photos.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, index, photos.length, onClose, onIndex]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-4"
          onClick={onClose}
          role="dialog"
          aria-label="Rasm"
        >
          <div className="absolute right-4 top-4 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] font-medium tabular-nums text-white">
              {(index ?? 0) + 1} / {photos.length}
            </span>
            <a
              href={photos[index ?? 0]}
              target="_blank"
              rel="noreferrer"
              download
              aria-label="Yuklab olish"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <DocumentDownload size={20} />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Yopish"
              className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <CloseCircle size={22} />
            </button>
          </div>
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="Oldingi"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndex(((index ?? 0) - 1 + photos.length) % photos.length);
                }}
                className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ArrowLeft2 size={22} />
              </button>
              <button
                type="button"
                aria-label="Keyingi"
                onClick={(e) => {
                  e.stopPropagation();
                  onIndex(((index ?? 0) + 1) % photos.length);
                }}
                className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
              >
                <ArrowRight2 size={22} />
              </button>
            </>
          )}
          <motion.img
            key={photos[index ?? 0]}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            src={photos[index ?? 0]}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-[86vh] max-w-[92vw] rounded-xl object-contain shadow-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
