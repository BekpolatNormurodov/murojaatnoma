import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SearchNormal1,
  Calendar,
  Sun1,
  Moon,
  HambergerMenu,
  TickCircle,
  Profile,
  Setting2,
  LogoutCurve,
} from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { Flag } from '@/shared/ui/Flag';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { useAuth } from '@/shared/store/auth';
import { LANGS, type Lang } from '@/shared/i18n/dict';
import { NotificationsBell } from '@/features/notifications/NotificationsBell';
import { cn } from '@/shared/lib/cn';

// Localized date names — Intl's uz-UZ data is unreliable across runtimes
// (falls back to "M06 12, Fri"), so we format manually.
const DATE_NAMES: Record<Lang, { months: string[]; days: string[] }> = {
  uz: {
    months: ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'],
    days: ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'],
  },
  ru: {
    months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
    days: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
  },
  en: {
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
};

function formatToday(lang: Lang, d = new Date()) {
  const { months, days } = DATE_NAMES[lang];
  const weekday = days[d.getDay()];
  const day = d.getDate();
  const month = months[d.getMonth()];
  return lang === 'uz' ? `${weekday}, ${day}-${month}` : `${weekday}, ${day} ${month}`;
}

function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { theme, toggle } = useTheme();
  const { lang, setLang, t } = useI18n();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [langOpen, setLangOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const langRef = useClickOutside<HTMLDivElement>(() => setLangOpen(false));
  const menuRef = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));

  const today = formatToday(lang);


  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-2 px-4 sm:gap-3 lg:px-8">
        {/* Mobile menu */}
        <button
          onClick={onMenuClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-soft transition-colors hover:text-ink lg:hidden"
          aria-label="Menu"
        >
          <HambergerMenu size={20} />
        </button>

        {/* Search */}
        <div className="relative hidden flex-1 md:block md:max-w-md">
          <SearchNormal1
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            placeholder={t('topbar.search')}
            className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-10 pr-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface"
          />
        </div>

        <div className="flex-1 md:hidden">
          <div className="text-[15px] font-bold text-ink">{t('app.org')}</div>
        </div>

        {/* Date */}
        <div className="hidden items-center gap-2 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-soft xl:flex">
          <Calendar size={17} className="text-ink-muted" />
          <span>{today}</span>
        </div>

        {/* Language */}
        <div className="relative" ref={langRef}>
          <button
            onClick={() => {
              setLangOpen((v) => !v);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-2.5 text-ink-soft transition-colors hover:text-ink"
          >
            <Flag code={lang} className="h-4 w-6" />
            <span className="hidden text-[13px] font-semibold uppercase sm:block">{lang}</span>
          </button>
          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-12 w-44 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop"
              >
                {LANGS.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setLang(l.code as Lang);
                      setLangOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors',
                      l.code === lang
                        ? 'bg-primary-50 font-semibold text-primary-700'
                        : 'text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    <Flag code={l.code} className="h-4 w-6" />
                    {l.label}
                    {l.code === lang && (
                      <TickCircle size={16} variant="Bold" className="ml-auto text-primary-600" />
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface-2 text-ink-soft transition-colors hover:text-ink"
          aria-label={theme === 'dark' ? t('topbar.theme.light') : t('topbar.theme.dark')}
          title={theme === 'dark' ? t('topbar.theme.light') : t('topbar.theme.dark')}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.2 }}
            >
              {theme === 'dark' ? (
                <Sun1 size={20} variant="Bulk" className="text-amber-400" />
              ) : (
                <Moon size={20} variant="Bulk" />
              )}
            </motion.span>
          </AnimatePresence>
        </button>

        {/* Notifications — real events, expandable, read state saved */}
        <NotificationsBell onOpenChange={(o) => o && setLangOpen(false)} />

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => {
              setMenuOpen((v) => !v);
              setLangOpen(false);
            }}
            className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 py-1.5 pl-1.5 pr-2 transition-colors hover:border-primary-200 sm:pr-3"
          >
            <Avatar
              name={user?.name ?? 'Admin Hokim'}
              src={user?.avatar}
              color="#2563eb"
              size={32}
            />
            <div className="hidden text-left leading-tight sm:block">
              <div className="text-[13px] font-semibold text-ink">{user?.name ?? 'Admin Hokim'}</div>
              <div className="text-[11px] text-ink-muted">{user?.role ?? t('topbar.profile.role')}</div>
            </div>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.16 }}
                className="absolute right-0 top-12 w-60 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop"
              >
                <div className="flex items-center gap-3 border-b border-line px-4 py-3">
                  <Avatar name={user?.name ?? 'Admin Hokim'} src={user?.avatar} color="#2563eb" size={40} />
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-sm font-semibold text-ink">{user?.name ?? 'Admin Hokim'}</div>
                    <div className="truncate text-[12px] text-ink-muted">{user?.email ?? 'admin@hokimiyat.uz'}</div>
                  </div>
                </div>
                <div className="p-1.5">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Profile size={19} variant="Bulk" className="text-ink-muted" />
                    {t('topbar.menu.profile')}
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <Setting2 size={19} variant="Bulk" className="text-ink-muted" />
                    {t('nav.settings')}
                  </button>
                </div>
                <div className="border-t border-line p-1.5">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setLogoutOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-danger-soft"
                  >
                    <LogoutCurve size={19} variant="Bulk" />
                    {t('nav.logout')}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          logout();
          // Hard redirect: fully resets in-memory state (active call overlay,
          // sockets, stuck modals) so logout never lands on a black/stuck screen.
          window.location.assign('/login');
        }}
        tone="danger"
        icon={LogoutCurve}
        title={t('auth.logout.title')}
        message={t('auth.logout.message')}
        confirmLabel={t('nav.logout')}
        cancelLabel={t('common.cancel')}
      />
    </header>
  );
}
