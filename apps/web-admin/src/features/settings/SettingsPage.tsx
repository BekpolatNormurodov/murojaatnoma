import { useId, useState, type ReactNode } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  Profile,
  Notification,
  ShieldSecurity,
  Monitor,
  Camera,
  Sms,
  Lock1,
  Key,
  Trash,
  TickCircle,
  UserSquare,
  type Icon as IconType,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Flag } from '@/shared/ui/Flag';
import { useAuth } from '@/shared/store/auth';
import { useTheme } from '@/shared/theme/ThemeProvider';
import { useI18n } from '@/shared/i18n/I18nProvider';
import type { Lang } from '@/shared/i18n/dict';
import { useHealthQuery, formatUptime } from './useHealthQuery';
import { cn } from '@/shared/lib/cn';

type TabId = 'profile' | 'notifications' | 'security' | 'system';

/* ============================================================
   Bildirishnoma sozlamalari — mahalliy (client-side) preferens.
   Hozircha buning uchun backend endpoint yo'q, shuning uchun
   qurilmada localStorage orqali saqlanadi. Tema va til esa
   ThemeProvider/I18nProvider orqali o'zgargan zahoti avtomatik
   saqlanadi va butun ilova bo'ylab qo'llanadi — bu yerda faqat
   ularga real boshqaruv elementi beriladi (Topbar'dagilar bilan
   bir xil haqiqiy state'ga ulangan).
   ============================================================ */

type NotificationPrefKey =
  | 'newRequests'
  | 'workerReports'
  | 'geofenceAlerts'
  | 'weeklyAnalytics'
  | 'emailNotifications';

type NotificationPrefs = Record<NotificationPrefKey, boolean>;

const NOTIFICATION_PREFS_KEY = 'hkm-settings-notifications';

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  newRequests: true,
  workerReports: true,
  geofenceAlerts: true,
  weeklyAnalytics: false,
  emailNotifications: true,
};

function loadNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_PREFS;
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return { ...DEFAULT_NOTIFICATION_PREFS, ...parsed };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

function persistNotificationPrefs(prefs: NotificationPrefs) {
  try {
    window.localStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage mavjud bo'lmasa (masalan, maxfiy rejim) — jimgina o'tkazib yuboramiz.
  }
}

export function SettingsPage() {
  const { t, setLang } = useI18n();
  const { setTheme } = useTheme();
  const [tab, setTab] = useState<TabId>('profile');
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);
  const reduceMotion = useReducedMotion();

  const TABS: { id: TabId; label: string; icon: IconType }[] = [
    { id: 'profile', label: t('settings.tabs.profile'), icon: Profile },
    { id: 'notifications', label: t('settings.notifications'), icon: Notification },
    { id: 'security', label: t('settings.security'), icon: ShieldSecurity },
    { id: 'system', label: t('settings.tabs.system'), icon: Monitor },
  ];

  function handleSave() {
    persistNotificationPrefs(notificationPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  // "Xavfli hudud" > "Keshni tozalash" — dialog matni va'da qilgan narsani
  // haqiqatan bajaradi: bildirishnoma preferenslari, tema va til dastlabki
  // holatiga qaytariladi (auth/token'ga tegilmaydi — bu "kesh" emas, sessiya).
  function handleClearCache() {
    persistNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    setNotificationPrefs(DEFAULT_NOTIFICATION_PREFS);
    setTheme('light');
    setLang('uz');
    setDeleteOpen(false);
    setCleared(true);
    setTimeout(() => setCleared(false), 3000);
  }

  return (
    <div>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.pageSubtitle')}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={handleSave}>
              {saved ? <TickCircle size={18} variant="Bulk" /> : null}
              {saved ? t('settings.savedShort') : t('settings.saveChanges')}
            </Button>
            <span role="status" aria-live="polite" className="sr-only">
              {saved ? t('settings.saved') : ''}
            </span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((tb) => {
            const active = tab === tb.id;
            return (
              <button
                key={tb.id}
                onClick={() => setTab(tb.id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-primary-700 shadow-card'
                    : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab"
                    layout={!reduceMotion}
                    transition={reduceMotion ? { duration: 0 } : undefined}
                    className="absolute left-0 h-6 w-1 rounded-r-full bg-primary-600"
                  />
                )}
                <tb.icon size={20} variant={active ? 'Bulk' : 'Linear'} />
                <span className="whitespace-nowrap">{tb.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={reduceMotion ? { duration: 0.01 } : { duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'profile' && <ProfileTab />}
            {tab === 'notifications' && (
              <NotificationsTab prefs={notificationPrefs} onChange={setNotificationPrefs} />
            )}
            {tab === 'security' && <SecurityTab />}
            {tab === 'system' && <SystemTab onRequestClear={() => setDeleteOpen(true)} cleared={cleared} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleClearCache}
        title={t('settings.confirmClear.title')}
        message={t('settings.confirmClear.message')}
        confirmLabel={t('settings.confirmClear.confirmLabel')}
        cancelLabel={t('common.cancel')}
        tone="danger"
        icon={Trash}
      />
    </div>
  );
}

/* ============================================================
   Reusable bits
   ============================================================ */

function Section({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="mb-5">
        <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-muted">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  defaultValue,
  type = 'text',
  placeholder,
  readOnly = false,
  disabled = false,
}: {
  label: string;
  icon?: IconType;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
        )}
        <input
          id={id}
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          readOnly={readOnly}
          disabled={disabled}
          className={cn(
            'h-11 w-full rounded-xl border border-line bg-surface-2 pr-4 text-sm text-ink outline-none transition-colors',
            'placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface',
            Icon ? 'pl-11' : 'pl-4',
            disabled && 'cursor-not-allowed opacity-50 focus:border-line focus:bg-surface-2',
          )}
        />
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        'flex w-full items-center justify-between gap-4 border-b border-line py-4 text-left transition-colors last:border-0',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-2/50',
      )}
    >
      <span>
        <span className="block text-sm font-medium text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-muted">{description}</span>}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-line',
        )}
      >
        <motion.span
          layout={!reduceMotion}
          transition={{ type: 'spring', damping: 22, stiffness: 360 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm',
            checked ? 'left-5.5' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

/** uz/ru tanlagich — Til qatorining o'ng tomonida, ikkita segment-tugma. */
function LanguageSwitch({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  const options: { code: Lang; label: string }[] = [
    { code: 'uz', label: "O'zbekcha" },
    { code: 'ru', label: 'Русский' },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = o.code === lang;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => onChange(o.code)}
            aria-pressed={active}
            className={cn(
              'flex h-11 items-center gap-2 rounded-xl border px-3.5 text-[13px] font-medium transition-colors',
              active
                ? 'border-primary-300 bg-primary-50 text-primary-700'
                : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
            )}
          >
            <Flag code={o.code} className="h-4 w-6" />
            {o.label}
            {active && <TickCircle size={15} variant="Bold" className="text-primary-600" />}
          </button>
        );
      })}
    </div>
  );
}

function InfoRow({
  label,
  value,
  dotClassName,
}: {
  label: string;
  value: string;
  dotClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-line py-2.5 text-sm last:border-0">
      <span className="text-ink-soft">{label}</span>
      <span className="flex items-center gap-2 font-medium text-ink">
        {dotClassName && <span className={cn('h-2 w-2 rounded-full', dotClassName)} />}
        {value}
      </span>
    </div>
  );
}

/* ============================================================
   Tabs
   ============================================================ */

/** "Ism Familiya" ko'rinishidagi to'liq ismni ikki maydonga ajratadi. */
function splitName(fullName: string | undefined): { first: string; last: string } {
  const trimmed = fullName?.trim() ?? '';
  if (!trimmed) return { first: '', last: '' };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { first, last: rest.join(' ') };
}

function ProfileTab() {
  const user = useAuth((s) => s.user);
  const { t } = useI18n();
  const { first, last } = splitName(user?.name);
  const comingSoonTitle = t('settings.profile.comingSoonFull');

  return (
    <div className="space-y-6">
      <Section title={t('settings.profile.sectionTitle')} subtitle={t('settings.profile.sectionSubtitle')}>
        <div className="mb-6 flex items-center gap-5">
          <div className="relative">
            <Avatar
              name={user?.name || t('settings.profile.defaultUserName')}
              src={user?.avatar}
              color="#2563eb"
              size={76}
            />
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={comingSoonTitle}
              className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-xl border-2 border-surface bg-primary-600 text-white opacity-70"
            >
              <Camera size={16} variant="Bulk" />
            </button>
          </div>
          <div>
            <div className="text-lg font-bold text-ink">{user?.name || t('settings.profile.defaultUserName')}</div>
            <div className="text-[13px] text-ink-muted">{user?.role || t('settings.profile.noRole')}</div>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title={comingSoonTitle}
              className="mt-2 cursor-not-allowed text-[13px] font-medium text-primary-600/60"
            >
              {t('settings.profile.changePhoto')}
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('settings.profile.firstName')} defaultValue={first} placeholder={t('settings.profile.notEntered')} readOnly />
          <Field label={t('settings.profile.lastName')} defaultValue={last} placeholder={t('settings.profile.notEntered')} readOnly />
          <Field label={t('settings.profile.email')} icon={Sms} type="email" defaultValue={user?.email} placeholder={t('settings.profile.notEntered')} readOnly />
          <Field label={t('staff.login')} icon={UserSquare} defaultValue={user?.username} placeholder={t('settings.profile.notEntered')} readOnly />
          <Field label={t('settings.profile.position')} icon={Profile} defaultValue={user?.role} placeholder={t('settings.profile.notEntered')} readOnly />
        </div>
      </Section>
    </div>
  );
}

function NotificationsTab({
  prefs,
  onChange,
}: {
  prefs: NotificationPrefs;
  onChange: (updater: (prev: NotificationPrefs) => NotificationPrefs) => void;
}) {
  const { t } = useI18n();
  function toggle(key: NotificationPrefKey) {
    onChange((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-6">
      <Section title={t('settings.notifications')} subtitle={t('settings.notif.sectionSubtitle')}>
        <Toggle
          label={t('settings.notif.newRequests')}
          description={t('settings.notif.newRequestsDesc')}
          checked={prefs.newRequests}
          onChange={() => toggle('newRequests')}
        />
        <Toggle
          label={t('settings.notif.workerReports')}
          description={t('settings.notif.workerReportsDesc')}
          checked={prefs.workerReports}
          onChange={() => toggle('workerReports')}
        />
        <Toggle
          label={t('settings.notif.geofenceAlerts')}
          description={t('settings.notif.geofenceAlertsDesc')}
          checked={prefs.geofenceAlerts}
          onChange={() => toggle('geofenceAlerts')}
        />
        <Toggle
          label={t('settings.notif.weeklyAnalytics')}
          description={t('settings.notif.weeklyAnalyticsDesc')}
          checked={prefs.weeklyAnalytics}
          onChange={() => toggle('weeklyAnalytics')}
        />
        <Toggle
          label={t('settings.notif.emailChannel')}
          description={t('settings.notif.emailChannelDesc')}
          checked={prefs.emailNotifications}
          onChange={() => toggle('emailNotifications')}
        />
      </Section>
    </div>
  );
}

function SecurityTab() {
  const { t } = useI18n();
  const [twoFactor, setTwoFactor] = useState(true);
  const [newDeviceAlert, setNewDeviceAlert] = useState(true);
  const [autoLogout, setAutoLogout] = useState(false);
  const comingSoon = t('settings.security.comingSoon');

  return (
    <div className="space-y-6">
      <Section
        title={
          <>
            {t('settings.security.changePasswordTitle')}
            <Badge tone="neutral">{comingSoon}</Badge>
          </>
        }
        subtitle={t('settings.security.changePasswordSubtitle')}
      >
        <div className="grid gap-4 sm:max-w-md">
          <Field label={t('settings.security.currentPassword')} icon={Lock1} type="password" placeholder="••••••••" disabled />
          <Field label={t('settings.security.newPassword')} icon={Key} type="password" placeholder="••••••••" disabled />
          <Field label={t('settings.security.confirmPassword')} icon={Key} type="password" placeholder="••••••••" disabled />
          <Button className="w-fit" disabled>
            {t('settings.security.updatePassword')}
          </Button>
        </div>
      </Section>
      <Section
        title={
          <>
            {t('settings.security.additionalProtectionTitle')}
            <Badge tone="neutral">{comingSoon}</Badge>
          </>
        }
      >
        <Toggle
          disabled
          label={t('settings.security.twoFactorAuth')}
          description={t('settings.security.twoFactorDesc')}
          checked={twoFactor}
          onChange={() => setTwoFactor((v) => !v)}
        />
        <Toggle
          disabled
          label={t('settings.security.newDeviceAlert')}
          description={t('settings.security.newDeviceAlertDesc')}
          checked={newDeviceAlert}
          onChange={() => setNewDeviceAlert((v) => !v)}
        />
        <Toggle
          disabled
          label={t('settings.security.autoLogout')}
          description={t('settings.security.autoLogoutDesc')}
          checked={autoLogout}
          onChange={() => setAutoLogout((v) => !v)}
        />
      </Section>
    </div>
  );
}

function SystemTab({
  onRequestClear,
  cleared,
}: {
  onRequestClear: () => void;
  cleared: boolean;
}) {
  const { t, lang, setLang } = useI18n();
  const { theme, toggle: toggleTheme } = useTheme();
  const { data: health, isLoading: healthLoading, isError: healthError } = useHealthQuery();

  const healthKnown = !healthLoading && !healthError && !!health;
  const serverOk = healthKnown && health!.status === 'ok';
  const dbUp = healthKnown && health!.database === 'up';

  const serverValue = !healthKnown ? t('common.unknown') : serverOk ? t('common.active') : t('common.offline');
  const dbValue = !healthKnown ? t('common.unknown') : dbUp ? t('common.active') : t('common.offline');
  const uptimeValue = healthKnown ? formatUptime(health!.uptimeSeconds, t) : '—';
  const uptimeLabel = t('settings.system.uptimeLabel');
  const clearedMessage = t('settings.system.cacheClearedMessage');

  return (
    <div className="space-y-6">
      <Section title={t('settings.appearance')}>
        <Toggle
          label={t('settings.theme')}
          description={t('settings.theme.desc')}
          checked={theme === 'dark'}
          onChange={toggleTheme}
        />
        <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-ink">{t('settings.language')}</div>
            <div className="mt-0.5 text-[13px] text-ink-muted">{t('settings.language.desc')}</div>
          </div>
          <LanguageSwitch lang={lang} onChange={setLang} />
        </div>
      </Section>

      <Section title={t('settings.system.aboutTitle')}>
        <div className="space-y-3">
          <InfoRow label={t('settings.system.platformVersion')} value="v2.4.0" />
          <InfoRow label={t('settings.system.lastUpdate')} value="12 Iyun, 2026" />
          <InfoRow
            label={t('settings.system.serverStatus')}
            value={serverValue}
            dotClassName={!healthKnown ? 'bg-ink-muted' : serverOk ? 'bg-success animate-pulse motion-reduce:animate-none' : 'bg-danger'}
          />
          <InfoRow
            label={t('settings.system.database')}
            value={dbValue}
            dotClassName={!healthKnown ? 'bg-ink-muted' : dbUp ? 'bg-success' : 'bg-danger'}
          />
          <InfoRow label={uptimeLabel} value={uptimeValue} />
        </div>
      </Section>

      <Section title={t('settings.system.dangerZoneTitle')} subtitle={t('settings.system.dangerZoneSubtitle')}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-ink">{t('settings.system.clearCacheTitle')}</div>
            <div className="mt-0.5 text-[13px] text-ink-muted">{t('settings.system.clearCacheDesc')}</div>
            <p role="status" aria-live="polite" className="mt-1.5 text-[12.5px] font-medium text-primary-600">
              {cleared ? clearedMessage : ''}
            </p>
          </div>
          <Button variant="danger" onClick={onRequestClear}>
            <Trash size={18} variant="Bulk" />
            {t('common.clear')}
          </Button>
        </div>
      </Section>
    </div>
  );
}
