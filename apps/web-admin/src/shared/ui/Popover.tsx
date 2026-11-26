import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/shared/lib/cn';
import { placePopover } from './calendar';

interface PanelProps {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  className?: string;
  children: ReactNode;
}

function Panel({ anchorRef, onClose, label, className, children }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<ReturnType<typeof placePopover> | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const panel = ref.current;
      if (!anchor || !panel) return;
      setPos(
        placePopover(
          anchor.getBoundingClientRect(),
          // offset o'lchamlari ochilish animatsiyasidagi scale'ga bog'liq emas.
          { width: panel.offsetWidth, height: panel.offsetHeight },
          { width: document.documentElement.clientWidth, height: window.innerHeight },
        ),
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !anchorRef.current?.contains(target)) onClose();
    };
    // Capture bosqichi: Esc faqat drop-down'ni yopadi, ostidagi modalni emas.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
      anchorRef.current?.focus();
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [anchorRef, onClose]);

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-label={label}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        transformOrigin: pos?.above ? 'bottom' : 'top',
      }}
      className={cn(
        'fixed z-[80] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-pop',
        className,
      )}
    >
      {children}
    </motion.div>
  );
}

/**
 * Tugmaga bog'langan drop-down. `<body>` ichiga chiziladi, shuning uchun modal
 * yoki `overflow-hidden` kartada kesilib qolmaydi.
 */
export function Popover({ open, ...props }: PanelProps & { open: boolean }) {
  return createPortal(<AnimatePresence>{open && <Panel {...props} />}</AnimatePresence>, document.body);
}
