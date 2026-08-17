import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { type Icon as IconType } from 'iconsax-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { cn } from '@/shared/lib/cn';

type Tone = 'danger' | 'primary' | 'warning';

const toneStyles: Record<Tone, { ring: string; bg: string; icon: string; btn: string }> = {
  danger: {
    ring: 'ring-danger/15',
    bg: 'bg-danger-soft',
    icon: 'text-danger',
    btn: 'bg-danger hover:brightness-95 text-white',
  },
  primary: {
    ring: 'ring-primary-200',
    bg: 'bg-primary-50',
    icon: 'text-primary-600',
    btn: 'bg-primary-600 hover:bg-primary-700 text-white',
  },
  warning: {
    ring: 'ring-warning/20',
    bg: 'bg-warning-soft',
    icon: 'text-warning',
    btn: 'bg-warning hover:brightness-95 text-white',
  },
};

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Tasdiqlash',
  cancelLabel = 'Bekor qilish',
  tone = 'primary',
  icon: Icon,
  loading = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: Tone;
  icon?: IconType;
  loading?: boolean;
}) {
  const s = toneStyles[tone];
  return (
    <Modal open={open} onClose={onClose} width={400} showClose={false}>
      <div className="flex flex-col items-center text-center">
        {Icon && (
          <motion.div
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 14, stiffness: 260, delay: 0.05 }}
            className={cn(
              'mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ring-8',
              s.bg,
              s.ring,
            )}
          >
            <Icon size={32} variant="Bulk" className={s.icon} />
          </motion.div>
        )}
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{message}</p>

        <div className="mt-6 flex w-full gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl px-6 text-[15px] font-medium outline-none transition-all',
              'active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60',
              s.btn,
            )}
          >
            {loading ? 'Iltimos kuting...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
