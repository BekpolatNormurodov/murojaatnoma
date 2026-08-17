import { type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloseCircle } from 'iconsax-react';

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  width = 460,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  width?: number;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-canvas shadow-pop"
            style={{ maxWidth: width }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-line bg-surface px-5 py-4">
              <div>
                {title && <h2 className="text-lg font-bold text-ink">{title}</h2>}
                {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
              </div>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <CloseCircle size={22} variant="Bulk" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
