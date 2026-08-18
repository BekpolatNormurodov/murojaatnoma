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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
            className="relative w-full overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
            style={{ maxWidth: width }}
          >
            {(title || showClose) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div>
                  {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
                  {subtitle && (
                    <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>
                  )}
                </div>
                {showClose && (
                  <button
                    onClick={onClose}
                    className="-mr-1.5 -mt-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <CloseCircle size={22} variant="Bulk" />
                  </button>
                )}
              </div>
            )}
            <div className="p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
