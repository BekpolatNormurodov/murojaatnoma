import { useMemo } from 'react';
import {
  CallCalling,
  Sms,
  Location,
  Calendar,
  Clock,
  Star1,
  MessageQuestion,
  TickCircle,
  Verify,
  Activity,
  Send2,
  Slash,
  ShieldTick,
  Cup,
  Android,
  Apple,
  Notification,
  type Icon as IconType,
} from 'iconsax-react';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { Drawer } from '@/shared/ui/Drawer';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { APP_USER_STATUS_META } from '@/shared/data/mock';
import type { AppUser } from '@/shared/data/types';
import { formatDate, timeAgo, formatNumber } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

function StatTile({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: IconType;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 text-center">
      <div
        className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl"
        style={{ background: `${color}1a`, color }}
      >
        <Icon size={18} variant="Bulk" />
      </div>
      <div className="mt-2 text-lg font-bold text-ink">{value}</div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-[13px] text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export function AppUserDetail({
  user,
  onClose,
  onToggleBlock,
  onToggleVerify,
  pending = false,
}: {
  user: AppUser | null;
  onClose: () => void;
  /** Bloklash/faollashtirish — bloklashdan oldin sahifa darajasida tasdiq so'raladi. */
  onToggleBlock?: (user: AppUser) => void;
  /** Shaxsni tasdiqlash/tasdiqni bekor qilish. */
  onToggleVerify?: (user: AppUser) => void;
  /** Shu foydalanuvchi uchun PATCH so'rovi hozir bajarilyaptimi. */
  pending?: boolean;
}) {
  const { t } = useI18n();
  const u = user;
  const maxActivity = useMemo(
    () => (u ? Math.max(1, ...u.activity.map((a) => a.count)) : 1),
    [u],
  );

  const status = u ? APP_USER_STATUS_META[u.status] : null;
  const resolveRate = u && u.requestsCount > 0 ? Math.round((u.resolvedCount / u.requestsCount) * 100) : 0;
  const isBlocked = u?.status === 'blocked';

  return (
    <Drawer
      open={!!u}
      onClose={onClose}
      title={t('appUsers.detail.title')}
      subtitle={u ? `#${u.id}` : undefined}
      width={500}
    >
      {u && status && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar src={u.photo} name={u.name} color={u.avatarColor} size={64} ring />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-lg font-bold text-ink">{u.name}</h3>
                {u.verified && (
                  <Verify size={18} variant="Bold" className="shrink-0 text-accent-500" />
                )}
              </div>
              <a
                href={`tel:${u.phone}`}
                className="mt-0.5 flex items-center gap-1.5 text-[13px] text-accent-600"
              >
                <CallCalling size={14} variant="Bulk" /> {u.phone}
              </a>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={status.tone} dot>
                  {status.label}
                </Badge>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-ink-soft">
                  {u.device === 'android' ? (
                    <Android size={13} variant="Bulk" className="text-primary-500" />
                  ) : (
                    <Apple size={13} variant="Bulk" className="text-ink-soft" />
                  )}
                  {u.device === 'android' ? t('appUsers.deviceAndroid') : t('appUsers.deviceIos')} · v{u.appVersion}
                </span>
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-4 gap-2.5">
            <StatTile
              icon={MessageQuestion}
              value={formatNumber(u.requestsCount)}
              label={t('appUsers.requestsLabel')}
              color="#3b82f6"
            />
            <StatTile
              icon={TickCircle}
              value={formatNumber(u.resolvedCount)}
              label={t('common.resolved')}
              color="#10b981"
            />
            <StatTile
              icon={Cup}
              value={formatNumber(u.points)}
              label={t('appUsers.detail.points')}
              color="#f59e0b"
            />
            <StatTile
              icon={Star1}
              value={u.avgRating > 0 ? u.avgRating.toFixed(1) : '—'}
              label={t('appUsers.detail.rating')}
              color="#a855f7"
            />
          </div>

          {/* Activity */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Activity size={16} variant="Bulk" className="text-ink-muted" /> {t('appUsers.detail.activity14d')}
            </p>
            <div className="flex h-20 items-end justify-between gap-1">
              {u.activity.map((a, i) => (
                <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className={cn(
                      'w-full rounded-md transition-all',
                      a.count > 0 ? 'bg-primary-500' : 'bg-surface-2',
                    )}
                    style={{ height: `${a.count > 0 ? (a.count / maxActivity) * 100 : 6}%` }}
                    title={`${formatDate(a.date)}: ${a.count}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Engagement */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="font-semibold text-ink">{t('appUsers.detail.resolveRate')}</span>
              <span className="font-semibold text-primary-600">{resolveRate}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{ width: `${resolveRate}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">
              {t('appUsers.detail.resolveRateFootnote')
                .replace('{resolved}', String(u.resolvedCount))
                .replace('{total}', String(u.requestsCount))}
            </p>
          </div>

          {/* Info */}
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            <InfoRow
              icon={<Location size={15} variant="Bulk" className="text-ink-muted" />}
              label={t('appUsers.regionLabel')}
              value={u.region}
            />
            <InfoRow
              icon={<Location size={15} variant="Bulk" className="text-ink-muted" />}
              label={t('common.address')}
              value={<span className="max-w-56 truncate text-right">{u.address}</span>}
            />
            <InfoRow
              icon={<Calendar size={15} variant="Bulk" className="text-ink-muted" />}
              label={t('appUsers.detail.registeredAt')}
              value={formatDate(u.registeredAt)}
            />
            <InfoRow
              icon={<Clock size={15} variant="Bulk" className="text-amber-500" />}
              label={t('appUsers.lastActiveLabel')}
              value={timeAgo(u.lastActiveAt)}
            />
            <InfoRow
              icon={<ShieldTick size={15} variant="Bulk" className="text-accent-500" />}
              label={t('appUsers.detail.identityVerification')}
              value={
                u.verified ? (
                  <span className="text-primary-600">{t('appUsers.verifiedLabel')}</span>
                ) : (
                  <span className="text-ink-muted">{t('appUsers.detail.notVerified')}</span>
                )
              }
            />
            <InfoRow
              icon={<Notification size={15} variant="Bulk" className="text-ink-muted" />}
              label={t('appUsers.detail.notifications')}
              value={u.notificationsOn ? t('appUsers.detail.notifOn') : t('appUsers.detail.notifOff')}
            />
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700">
              <Send2 size={16} variant="Bulk" /> {t('appUsers.detail.sendMessage')}
            </button>
            <a
              href={`tel:${u.phone}`}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
            >
              <Sms size={16} variant="Bulk" /> {t('appUsers.detail.contact')}
            </a>
            <button
              type="button"
              onClick={() => onToggleVerify?.(u)}
              disabled={pending}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                u.verified
                  ? 'border-line bg-surface text-ink-soft hover:bg-surface-2'
                  : 'border-accent-200 bg-info-soft text-accent-700 hover:opacity-90',
              )}
            >
              <ShieldTick size={16} variant="Bulk" />
              {u.verified ? t('appUsers.actions.unverify') : t('appUsers.actions.verify')}
            </button>
            <button
              type="button"
              onClick={() => onToggleBlock?.(u)}
              disabled={pending}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
                isBlocked
                  ? 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
                  : 'border-red-200 bg-danger-soft text-red-700 hover:opacity-90',
              )}
            >
              <Slash size={16} variant="Bulk" /> {isBlocked ? t('appUsers.actions.activate') : t('appUsers.actions.block')}
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
