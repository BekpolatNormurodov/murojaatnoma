import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight2,
  InfoCircle,
  MessageQuestion,
  Notification,
  Profile2User,
  TickCircle,
  Video,
  WalletMoney,
  type Icon as IconType,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { cn } from '@/shared/lib/cn';
import { timeAgo, formatDateTime } from '@/shared/lib/format';
import { useI18n } from '@/shared/i18n/I18nProvider';
import type { NotificationItem, NotificationType } from '@/shared/data/types';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationsCount,
} from './useNotifications';

const META: Record<NotificationType, { icon: IconType; color: string }> = {
  request: { icon: MessageQuestion, color: '#3b82f6' },
  worker: { icon: Profile2User, color: '#f59e0b' },
  finance: { icon: WalletMoney, color: '#10b981' },
  camera: { icon: Video, color: '#a855f7' },
  system: { icon: InfoCircle, color: '#64748b' },
};
const FALLBACK = { icon: InfoCircle, color: '#64748b' };

/**
 * Topbar bell: unread badge, a dropdown of the latest items (tap to expand the
 * full text — it used to be cut at two lines with nowhere to read the rest),
 * "Ochish" jumps to the linked murojaat, read state is saved on the server,
 * and "Barchasi" opens the full list.
 */
export function NotificationsBell({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const { t } = useI18n();
  const { data, isLoading } = useNotifications();
  const { data: count } = useUnreadNotificationsCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const [open, setOpenState] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const items = Array.isArray(data) ? data : [];
  const unread = data ? items.filter((n) => !n.read).length : (count?.count ?? 0);

  const setOpen = (v: boolean) => {
    setOpenState(v);
    onOpenChange?.(v);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        aria-label={`${t('topbar.notifications')}${unread ? ` — ${unread}` : ''}`}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-soft transition-colors hover:text-ink"
      >
        <Notification size={20} variant="Bulk" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-surface">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[400px]"
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">{t('topbar.notifications')}</h3>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-[12px] font-medium text-primary-600 hover:underline"
                >
                  {t('topbar.markAll')}
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {isLoading && items.length === 0 && (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="skeleton h-14 rounded-xl" />
                  ))}
                </div>
              )}
              {!isLoading && items.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-ink-muted">{t('topbar.empty')}</p>
              )}
              {items.slice(0, 15).map((n) => (
                <Item key={n.id} n={n} onRead={(id) => markRead.mutate(id)} onNavigate={() => setOpen(false)} />
              ))}
            </div>
            <button
              onClick={() => {
                setOpen(false);
                setAllOpen(true);
              }}
              className="block w-full border-t border-line px-4 py-3 text-center text-[13px] font-medium text-primary-600 hover:bg-surface-2"
            >
              {t('topbar.viewAll')}
              {items.length > 0 && ` (${items.length})`}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Drawer
        open={allOpen}
        onClose={() => setAllOpen(false)}
        title={t('topbar.notifications')}
        subtitle={unread ? `${unread} ta o‘qilmagan` : 'Hammasi o‘qilgan'}
        width={480}
      >
        <div className="flex items-center justify-end border-b border-line px-5 py-2">
          <button
            onClick={() => markAll.mutate()}
            disabled={unread === 0}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-medium text-primary-600 hover:bg-surface-2 disabled:opacity-40"
          >
            <TickCircle size={15} /> {t('topbar.markAll')}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-ink-muted">{t('topbar.empty')}</p>
          ) : (
            items.map((n) => (
              <Item key={n.id} n={n} full onRead={(id) => markRead.mutate(id)} onNavigate={() => setAllOpen(false)} />
            ))
          )}
        </div>
      </Drawer>
    </div>
  );
}

function Item({
  n,
  full = false,
  onRead,
  onNavigate,
}: {
  n: NotificationItem;
  full?: boolean;
  onRead: (id: string) => void;
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(false);
  const meta = META[n.type] ?? FALLBACK;
  const Ic = meta.icon;
  const showAll = full || expanded;

  return (
    <div className={cn('border-b border-line/60 transition-colors', !n.read && 'bg-primary-50/40 dark:bg-primary-500/5')}>
      <button
        onClick={() => {
          setExpanded((v) => !v);
          if (!n.read) onRead(n.id);
        }}
        aria-expanded={showAll}
        className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2"
      >
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${meta.color}1a`, color: meta.color }}
        >
          <Ic size={18} variant="Bulk" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className={cn('text-[13px] font-semibold text-ink', !showAll && 'truncate')}>{n.title}</span>
            {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary-500" aria-label="o‘qilmagan" />}
          </span>
          <span className={cn('mt-0.5 block whitespace-pre-line text-[12.5px] text-ink-soft', !showAll && 'line-clamp-2')}>
            {n.message}
          </span>
          <span className="mt-1 block text-[11px] text-ink-muted" title={formatDateTime(n.createdAt)}>
            {showAll ? formatDateTime(n.createdAt) : timeAgo(n.createdAt)}
          </span>
        </span>
      </button>
      {showAll && n.href && (
        <div className="-mt-1 px-4 pb-3 pl-16">
          <button
            onClick={() => {
              onNavigate();
              navigate(n.href!);
            }}
            className="inline-flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-primary-700"
          >
            Ochish <ArrowRight2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
