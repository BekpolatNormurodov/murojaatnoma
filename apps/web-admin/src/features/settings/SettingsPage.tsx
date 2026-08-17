import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Profile,
  Notification,
  ShieldSecurity,
  Monitor,
  Global,
  Camera,
  Sms,
  Call,
  Lock1,
  Key,
  Trash,
  TickCircle,
  type Icon as IconType,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { useAuth } from '@/shared/store/auth';
import { cn } from '@/shared/lib/cn';

type TabId = 'profile' | 'notifications' | 'security' | 'system';

const TABS: { id: TabId; label: string; icon: IconType }[] = [
  { id: 'profile', label: 'Profil', icon: Profile },
  { id: 'notifications', label: 'Bildirishnomalar', icon: Notification },
  { id: 'security', label: 'Xavfsizlik', icon: ShieldSecurity },
  { id: 'system', label: 'Tizim', icon: Monitor },
];

/* ============================================================
   Bildirishnoma sozlamalari — mahalliy (client-side) preferens.
   Hozircha buning uchun backend endpoint yo'q, shuning uchun
   qurilmada localStorage orqali saqlanadi.
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
  const [tab, setTab] = useState<TabId>('profile');
  const [saved, setSaved] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(loadNotificationPrefs);

  function handleSave() {
    // Tizimda hozircha faqat bildirishnoma sozlamalari kabi mahalliy
    // preferenslar bor — tema va til esa o'z provayderlari orqali
    // o'zgargan zahoti avtomatik saqlanadi (Topbar'dagi tugmalar).
    persistNotificationPrefs(notificationPrefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  }

  return (
    <div>
      <PageHeader
        title="Sozlamalar"
        subtitle="Hisobingiz, bildirishnomalar va tizim sozlamalarini boshqaring"
        action={
          <Button onClick={handleSave}>
            {saved ? <TickCircle size={18} variant="Bulk" /> : null}
            {saved ? 'Saqlandi' : "O'zgarishlarni saqlash"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'relative flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors',
                  active
                    ? 'bg-surface text-primary-700 shadow-card'
                    : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="settings-tab"
                    className="absolute left-0 h-6 w-1 rounded-r-full bg-primary-600"
                  />
                )}
                <t.icon size={20} variant={active ? 'Bulk' : 'Linear'} />
                <span className="whitespace-nowrap">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {tab === 'profile' && <ProfileTab />}
            {tab === 'notifications' && (
              <NotificationsTab prefs={notificationPrefs} onChange={setNotificationPrefs} />
            )}
            {tab === 'security' && <SecurityTab />}
            {tab === 'system' && <SystemTab onDelete={() => setDeleteOpen(true)} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => setDeleteOpen(false)}
        title="Ma'lumotlarni tozalaymizmi?"
        message="Barcha keshlangan ma'lumotlar va sozlamalar dastlabki holatiga qaytariladi. Bu amalni ortga qaytarib bo'lmaydi."
        confirmLabel="Ha, tozalash"
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
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-6 shadow-card">
      <div className="mb-5">
        <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
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
}: {
  label: string;
  icon?: IconType;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      <div className="relative">
        {Icon && (
          <Icon
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
        )}
        <input
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-xl border border-line bg-surface-2 pr-4 text-sm text-ink outline-none transition-colors',
            'placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface',
            Icon ? 'pl-11' : 'pl-4',
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
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-4 last:border-0">
      <div>
        <div className="text-sm font-medium text-ink">{label}</div>
        {description && <div className="mt-0.5 text-[13px] text-ink-muted">{description}</div>}
      </div>
      <button
        onClick={onChange}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-primary-600' : 'bg-line',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', damping: 22, stiffness: 360 }}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm',
            checked ? 'left-5.5' : 'left-0.5',
          )}
        />
      </button>
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
  const { first, last } = splitName(user?.name);

  return (
    <div className="space-y-6">
      <Section title="Shaxsiy ma'lumotlar" subtitle="Profil rasmi va asosiy ma'lumotlaringiz">
        <div className="mb-6 flex items-center gap-5">
          <div className="relative">
            <Avatar name={user?.name || 'Foydalanuvchi'} src={user?.avatar} color="#2563eb" size={76} />
            <button className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-xl border-2 border-surface bg-primary-600 text-white transition-colors hover:bg-primary-700">
              <Camera size={16} variant="Bulk" />
            </button>
          </div>
          <div>
            <div className="text-lg font-bold text-ink">{user?.name || 'Foydalanuvchi'}</div>
            <div className="text-[13px] text-ink-muted">{user?.role || "Lavozim ko'rsatilmagan"}</div>
            <button className="mt-2 text-[13px] font-medium text-primary-600 hover:underline">
              Rasmni o'zgartirish
            </button>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ism" defaultValue={first} placeholder="Kiritilmagan" />
          <Field label="Familiya" defaultValue={last} placeholder="Kiritilmagan" />
          <Field label="Email" icon={Sms} type="email" defaultValue={user?.email} placeholder="Kiritilmagan" />
          <Field label="Telefon" icon={Call} placeholder="Kiritilmagan" />
          <Field label="Lavozim" icon={Profile} defaultValue={user?.role} placeholder="Kiritilmagan" />
          <Field label="Hudud" icon={Global} placeholder="Kiritilmagan" />
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
  function toggle(key: NotificationPrefKey) {
    onChange((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <div className="space-y-6">
      <Section title="Bildirishnomalar" subtitle="Qaysi hodisalar haqida xabar olishni tanlang">
        <Toggle
          label="Yangi murojaatlar"
          description="Fuqarolardan yangi murojaat kelganda xabar berish"
          checked={prefs.newRequests}
          onChange={() => toggle('newRequests')}
        />
        <Toggle
          label="Ishchi hisobotlari"
          description="Ishchilar vazifani yakunlaganda bildirish"
          checked={prefs.workerReports}
          onChange={() => toggle('workerReports')}
        />
        <Toggle
          label="Geofence ogohlantirishlari"
          description="Ishchi belgilangan hududdan chiqib ketganda"
          checked={prefs.geofenceAlerts}
          onChange={() => toggle('geofenceAlerts')}
        />
        <Toggle
          label="Haftalik analitika"
          description="Har dushanba kunlik umumiy hisobot"
          checked={prefs.weeklyAnalytics}
          onChange={() => toggle('weeklyAnalytics')}
        />
        <Toggle
          label="Email orqali"
          description="Bildirishnomalarni emailga ham yuborish"
          checked={prefs.emailNotifications}
          onChange={() => toggle('emailNotifications')}
        />
      </Section>
    </div>
  );
}

function SecurityTab() {
  const [twoFactor, setTwoFactor] = useState(true);
  const [newDeviceAlert, setNewDeviceAlert] = useState(true);
  const [autoLogout, setAutoLogout] = useState(false);

  return (
    <div className="space-y-6">
      <Section title="Parolni o'zgartirish" subtitle="Hisobingiz xavfsizligini ta'minlang">
        <div className="grid gap-4 sm:max-w-md">
          <Field label="Joriy parol" icon={Lock1} type="password" placeholder="••••••••" />
          <Field label="Yangi parol" icon={Key} type="password" placeholder="••••••••" />
          <Field label="Yangi parolni tasdiqlang" icon={Key} type="password" placeholder="••••••••" />
          <Button className="w-fit">Parolni yangilash</Button>
        </div>
      </Section>
      <Section title="Qo'shimcha himoya">
        <Toggle
          label="Ikki bosqichli autentifikatsiya (2FA)"
          description="Kirishda SMS orqali tasdiqlash kodi so'raladi"
          checked={twoFactor}
          onChange={() => setTwoFactor((v) => !v)}
        />
        <Toggle
          label="Yangi qurilmadan kirishni eslatish"
          description="Notanish qurilmadan kirilganda email yuborish"
          checked={newDeviceAlert}
          onChange={() => setNewDeviceAlert((v) => !v)}
        />
        <Toggle
          label="Faol sessiyalarni avtomatik tugatish"
          description="30 daqiqa harakatsizlikdan keyin"
          checked={autoLogout}
          onChange={() => setAutoLogout((v) => !v)}
        />
      </Section>
    </div>
  );
}

function SystemTab({ onDelete }: { onDelete: () => void }) {
  return (
    <div className="space-y-6">
      <Section title="Tizim haqida">
        <div className="space-y-3">
          {[
            { label: 'Platforma versiyasi', value: 'v2.4.0' },
            { label: 'Oxirgi yangilanish', value: '12 Iyun, 2026' },
            { label: 'Server holati', value: 'Faol' },
            { label: 'Ma‘lumotlar bazasi', value: 'PostgreSQL 16' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between border-b border-line py-2.5 text-sm last:border-0"
            >
              <span className="text-ink-soft">{row.label}</span>
              <span className="flex items-center gap-2 font-medium text-ink">
                {row.label === 'Server holati' && (
                  <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                )}
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Xavfli hudud" subtitle="Bu amallar ortga qaytarilmaydi">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-ink">Keshni tozalash</div>
            <div className="mt-0.5 text-[13px] text-ink-muted">
              Barcha lokal sozlamalar dastlabki holatiga qaytadi
            </div>
          </div>
          <Button variant="danger" onClick={onDelete}>
            <Trash size={18} variant="Bulk" />
            Tozalash
          </Button>
        </div>
      </Section>
    </div>
  );
}
