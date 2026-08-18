import { AnimatePresence, motion } from 'framer-motion';
import { TickCircle, CloseCircle } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { dismissRequestToast, useRequestToastStore } from './toastStore';
import { usePrefersReducedMotion } from './usePrefersReducedMotion';

/**
 * Murojaatlar bo'limidagi amallar (qo'shish/o'chirish/biriktirish/holat)
 * natijasini ko'rsatadigan toast steki. RequestsPage ichida bir marta
 * render qilinadi — xabarlar esa xatoda joydan `pushRequestToast(...)`
 * chaqiruvi bilan qo'shiladi.
 */
export function RequestToastStack() {
  const { t } = useI18n();
  const toasts = useRequestToastStore((s) => s.toasts);
  const reducedMotion = usePrefersReducedMotion();

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[70] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
            initial={reducedMotion ? false : { opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.96 }}
            transition={reducedMotion ? { duration: 0.12 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-line bg-surface p-3.5 shadow-pop"
          >
            <span
              className={cn(
                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                toast.tone === 'success' ? 'bg-success-soft text-primary-600' : 'bg-danger-soft text-danger',
              )}
            >
              {toast.tone === 'success' ? (
                <TickCircle size={18} variant="Bulk" />
              ) : (
                <CloseCircle size={18} variant="Bulk" />
              )}
            </span>
            <p className="flex-1 pt-1 text-[13px] font-medium leading-snug text-ink">{toast.message}</p>
            <button
              onClick={() => dismissRequestToast(toast.id)}
              aria-label={t('requests.toast.closeAria')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
