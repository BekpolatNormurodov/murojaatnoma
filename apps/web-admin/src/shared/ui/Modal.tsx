import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseCircle } from 'iconsax-react';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 440,
  showClose = true,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
  showClose?: boolean;
}) {
  // Esc tugmasi bilan yopish + scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  // Portal to <body> so the modal escapes any transformed/backdrop-filtered
  // ancestor (e.g. the Topbar). Without this, `position: fixed` is resolved
  // against that ancestor's box instead of the viewport, so a modal opened from
  // the header (like the logout confirm) pins to the top instead of centering.
  return createPortal(
    <AnimatePresence>
      {open && (
        // Phones: bottom-sheet (items-end, no side gutter). ≥sm: centered card.
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/45 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            // Height-capped flex column: the header stays put and the body
            // scrolls, so a tall form never pushes its buttons off-screen on a
            // short viewport (phones, landscape, small laptops).
            className="relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-pop sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl"
            style={{ maxWidth: width }}
          >
            {(title || showClose) && (
              <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6">
                <div>
                  {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
                  {subtitle && (
                    <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    aria-label="Yopish"
                    className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <CloseCircle size={22} variant="Bulk" />
                  </button>
                )}
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
