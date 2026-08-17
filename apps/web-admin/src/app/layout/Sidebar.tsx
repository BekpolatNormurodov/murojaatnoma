import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Element3,
  MessageQuestion,
  Profile2User,
  Map1,
  Chart21,
  Setting2,
  LogoutCurve,
  CalendarTick,
  Video,
  WalletMoney,
  Folder2,
  SecurityUser,
  Speaker,
  Danger,
  Calendar,
  Messages2,
  Hierarchy,
  Mobile,
  ShieldTick,
  ArrowLeft2,
  type Icon as IconType,
} from 'iconsax-react';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { useAuth } from '@/shared/store/auth';
import { useUI } from '@/shared/store/ui';
import { useConversations } from '@/features/chat/useChat';
import { useRequests } from '@/shared/store/requests';
import { useComplaints } from '@/shared/store/complaints';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';

interface NavItem {
  to: string;
  labelKey: string;
  icon: IconType;
  badge?: number;
}

interface NavSection {
  titleKey: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    titleKey: 'nav.section.main',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: Element3 },
      { to: '/requests', labelKey: 'nav.requests', icon: MessageQuestion },
      { to: '/complaints', labelKey: 'nav.complaints', icon: Danger },
      { to: '/meetings', labelKey: 'nav.meetings', icon: Calendar },
      { to: '/chat', labelKey: 'nav.chat', icon: Messages2 },
      { to: '/map', labelKey: 'nav.map', icon: Map1 },
      { to: '/app-users', labelKey: 'nav.appUsers', icon: Mobile },
    ],
  },
  {
    titleKey: 'nav.section.staff',
    items: [
      { to: '/deputies', labelKey: 'nav.deputies', icon: Hierarchy },
      { to: '/workers', labelKey: 'nav.workers', icon: Profile2User },
      { to: '/attendance', labelKey: 'nav.attendance', icon: CalendarTick },
      { to: '/staff', labelKey: 'nav.staff', icon: SecurityUser },
    ],
  },
  {
    titleKey: 'nav.section.monitoring',
    items: [{ to: '/cameras', labelKey: 'nav.cameras', icon: Video }],
  },
  {
    titleKey: 'nav.section.finance',
    items: [{ to: '/finance', labelKey: 'nav.finance', icon: WalletMoney }],
  },
  {
    titleKey: 'nav.section.other',
    items: [
      { to: '/analytics', labelKey: 'nav.analytics', icon: Chart21 },
      { to: '/documents', labelKey: 'nav.documents', icon: Folder2 },
      { to: '/news', labelKey: 'nav.news', icon: Speaker },
    ],
  },
];

export function SidebarContent({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const logout = useAuth((s) => s.logout);
  // Suhbatlar ro'yxati boshqa joyda (ChatPage) allaqachon so'ralgan bo'lsa,
  // react-query keshidan qayta ishlatiladi — qo'shimcha so'rov yubormaydi.
  const { data: conversations } = useConversations();
  const chatUnread = (conversations ?? []).reduce((sum, c) => sum + c.unreadCount, 0);
  // Bu do'konlar ilova yuklanganda bir marta backend'dan hydrate bo'ladi
  // (shared/store/requests.ts, shared/store/complaints.ts) — shu yerda
  // faqat mavjud holatdan ochiq/yangi sonini hisoblaymiz.
  const openRequests = useRequests((s) => s.requests).filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;
  const newComplaints = useComplaints((s) => s.complaints).filter((c) => c.status === 'new').length;
  const [logoutOpen, setLogoutOpen] = useState(false);
  return (
    <>
      {/* Logo */}
      <div className={cn('flex items-center gap-3 py-6', collapsed ? 'justify-center px-0' : 'px-6')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-primary-500 to-primary-700 text-white shadow-glow">
          <ShieldTick size={24} variant="Bulk" color="#ffffff" />
        </div>
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-ink">{t('app.org')}</div>
            <div className="text-[11px] text-ink-muted">{t('app.subtitle')}</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className={cn('flex-1 space-y-1 overflow-y-auto overflow-x-hidden pb-4', collapsed ? 'px-2' : 'px-3')}>
        {SECTIONS.map((section, si) => (
          <div key={section.titleKey}>
            {collapsed ? (
              si > 0 && <div className="mx-auto my-2 h-px w-8 bg-line" />
            ) : (
              <p className="px-3 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {t(section.titleKey)}
              </p>
            )}
            {section.items.map((item) => {
              const badge =
                item.to === '/chat'
                  ? chatUnread
                  : item.to === '/requests'
                    ? openRequests
                    : item.to === '/complaints'
                      ? newComplaints
                      : item.badge;
              const showBadge = (badge ?? 0) > 0;
              return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={onNavigate}
                title={collapsed ? t(item.labelKey) : undefined}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'px-3',
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-active"
                        className="absolute left-0 h-6 w-1 rounded-r-full bg-primary-600"
                      />
                    )}
                    <span className="relative shrink-0">
                      <item.icon
                        size={21}
                        variant={isActive ? 'Bulk' : 'Linear'}
                        className={cn(isActive ? 'text-primary-600' : 'text-ink-muted')}
                      />
                      {showBadge && collapsed && (
                        <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                      )}
                    </span>
                    {!collapsed && (
                      <>
                        <span className="flex-1 truncate">{t(item.labelKey)}</span>
                        {showBadge && (
                          <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-bold text-white">
                            {badge}
                          </span>
                        )}
                      </>
                    )}
                  </>
                )}
              </NavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('space-y-1 border-t border-line py-4', collapsed ? 'px-2' : 'px-3')}>
        <NavLink
          to="/settings"
          onClick={onNavigate}
          title={collapsed ? t('nav.settings') : undefined}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'px-3',
              isActive
                ? 'bg-primary-50 text-primary-700'
                : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
            )
          }
        >
          <Setting2 size={21} className="shrink-0" />
          {!collapsed && t('nav.settings')}
        </NavLink>
        <button
          onClick={() => setLogoutOpen(true)}
          title={collapsed ? t('nav.logout') : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-danger-soft',
            collapsed ? 'justify-center px-0' : 'px-3',
          )}
        >
          <LogoutCurve size={21} className="shrink-0" />
          {!collapsed && t('nav.logout')}
        </button>
      </div>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          onNavigate?.();
          logout();
          navigate('/login', { replace: true });
        }}
        tone="danger"
        icon={LogoutCurve}
        title={t('auth.logout.title')}
        message={t('auth.logout.message')}
        confirmLabel={t('nav.logout')}
        cancelLabel={t('common.cancel')}
      />
    </>
  );
}

export function Sidebar() {
  const collapsed = useUI((s) => s.sidebarCollapsed);
  const toggle = useUI((s) => s.toggleSidebar);
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-surface transition-[width] duration-300 ease-out lg:flex',
        collapsed ? 'lg:w-20' : 'lg:w-66',
      )}
    >
      {/* Yig'ish / yoyish tugmasi */}
      <button
        onClick={toggle}
        title={collapsed ? 'Yoyish' : "Yig'ish"}
        aria-label={collapsed ? 'Yoyish' : "Yig'ish"}
        className="absolute -right-3 top-20 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-ink-soft shadow-card transition-colors hover:border-primary-300 hover:text-primary-600"
      >
        <ArrowLeft2
          size={14}
          className={cn('transition-transform duration-300', collapsed && 'rotate-180')}
        />
      </button>
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
