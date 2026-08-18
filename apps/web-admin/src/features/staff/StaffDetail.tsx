import { useState } from 'react';
import {
  Crown1,
  Key,
  SecurityUser,
  ShieldTick,
  Clock,
  Sms,
  Call,
  RecordCircle,
  Save2,
  Trash,
  CloseCircle,
  UserSquare as LoginIcon,
  type Icon as IconType,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Switch } from '@/shared/ui/Switch';
import { cn } from '@/shared/lib/cn';
import { formatDate, timeAgo } from '@/shared/lib/format';
import { ALL_MODULES, MODULE_LABEL, ROLE_META, WEEKDAYS } from '@/shared/data/mock';
import type { ModuleKey, StaffMember, StaffRole, StaffStatus } from '@/shared/data/types';
import { ROLE_ICON, roleMeta, staffStatusMeta } from './staffMeta';

const STATUS_ORDER: StaffStatus[] = ['active', 'inactive', 'suspended'];

export function StaffDetail({
  member,
  onClose,
  onSave,
  onDelete,
}: {
  member: StaffMember | null;
  onClose: () => void;
  /** Haqiqiy PATCH — Promise qaytaradi; xato bo'lsa drawer'da ko'rsatiladi. */
  onSave: (updated: StaffMember) => void | Promise<void>;
  onDelete?: (member: StaffMember) => void;
}) {
  return (
    <Drawer
      open={!!member}
      onClose={onClose}
      title={member?.name}
      subtitle={member ? member.position : undefined}
      width={520}
    >
      {member && (
        <StaffEditor
          key={member.id}
          member={member}
          onSave={onSave}
          onClose={onClose}
          onDelete={onDelete}
        />
      )}
    </Drawer>
  );
}

function StaffEditor({
  member,
  onSave,
  onClose,
  onDelete,
}: {
  member: StaffMember;
  onSave: (updated: StaffMember) => void | Promise<void>;
  onClose: () => void;
  onDelete?: (member: StaffMember) => void;
}) {
  const [role, setRole] = useState<StaffRole>(member.role);
  const [status, setStatus] = useState<StaffStatus>(member.status);
  const [login, setLogin] = useState(member.login);
  const [permissions, setPermissions] = useState<ModuleKey[]>(member.permissions);
  const [schedule, setSchedule] = useState(member.schedule);
  const [twoFactor, setTwoFactor] = useState(member.twoFactor);
  const [loginTouched, setLoginTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loginError = login.trim() ? undefined : 'Loginni kiriting';
  const showLoginError = loginTouched && loginError;

  function toggleModule(m: ModuleKey) {
    setPermissions((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }
  function toggleDay(d: number) {
    setSchedule((s) => ({
      ...s,
      days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort(),
    }));
  }
  function applyRoleDefaults(r: StaffRole) {
    setRole(r);
    setPermissions([...roleMeta(r).defaults]);
  }

  async function handleSave() {
    setLoginTouched(true);
    if (loginError) {
      setSaveError(loginError);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      await onSave({ ...member, role, status, login: login.trim(), permissions, schedule, twoFactor });
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Saqlab bo'lmadi. Qaytadan urining.");
      setSaving(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Identity */}
      <div className="flex items-center gap-4">
        <Avatar name={member.name} src={member.photo} color={member.avatarColor} size={64} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="primary">{roleMeta(role).label}</Badge>
            <Badge tone={staffStatusMeta(status).tone}>{staffStatusMeta(status).label}</Badge>
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-[13px] text-ink-muted">
            <span className="flex items-center gap-1.5">
              <Sms size={14} /> {member.email}
            </span>
            <span className="flex items-center gap-1.5">
              <Call size={14} /> {member.phone}
            </span>
          </div>
        </div>
      </div>

      {/* Role */}
      <section>
        <SectionTitle icon={Crown1} title="Lavozim (rol)" />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(Object.keys(ROLE_META) as StaffRole[])
            .sort((a, b) => ROLE_META[a].rank - ROLE_META[b].rank)
            .map((r) => {
              const Icon = ROLE_ICON[r];
              const active = role === r;
              return (
                <button
                  key={r}
                  onClick={() => applyRoleDefaults(r)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm transition-all',
                    active
                      ? 'border-primary-400 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-line bg-surface hover:border-primary-200',
                  )}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: `${ROLE_META[r].color}1a`, color: ROLE_META[r].color }}
                  >
                    <Icon size={17} variant="Bulk" />
                  </span>
                  <span className={cn('font-medium', active ? 'text-primary-700' : 'text-ink-soft')}>
                    {ROLE_META[r].label}
                  </span>
                </button>
              );
            })}
        </div>
      </section>

      {/* Status */}
      <section>
        <SectionTitle icon={RecordCircle} title="Holat" />
        <div className="flex gap-2">
          {STATUS_ORDER.map((s) => {
            const active = status === s;
            const meta = staffStatusMeta(s);
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? s === 'active'
                      ? 'border-success bg-success-soft text-primary-700'
                      : s === 'suspended'
                        ? 'border-danger bg-danger-soft text-red-700'
                        : 'border-line bg-surface-2 text-ink'
                    : 'border-line bg-surface text-ink-muted hover:bg-surface-2',
                )}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Credentials */}
      <section>
        <SectionTitle icon={Key} title="Kirish ma'lumotlari" />
        <label htmlFor="staff-login" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
          Login
        </label>
        <div className="relative">
          <LoginIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            id="staff-login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onBlur={() => setLoginTouched(true)}
            aria-invalid={!!showLoginError}
            aria-describedby={showLoginError ? 'staff-login-error' : undefined}
            className={cn(
              'h-11 w-full rounded-xl border bg-surface-2 pl-11 pr-4 text-sm text-ink outline-none focus:border-primary-300 focus:bg-surface',
              showLoginError ? 'border-danger' : 'border-line',
            )}
          />
        </div>
        {showLoginError && (
          <span id="staff-login-error" role="alert" className="mt-1.5 block text-[12px] font-medium text-danger">
            {loginError}
          </span>
        )}

        <div className="mt-4 flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-ink-soft">
            <ShieldTick size={18} variant="Bulk" className="text-accent-600" />
            Ikki bosqichli himoya (2FA)
          </span>
          <Switch checked={twoFactor} onChange={setTwoFactor} />
        </div>
      </section>

      {/* Work hours */}
      <section>
        <SectionTitle icon={Clock} title="Ish vaqti" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">Boshlanishi</label>
            <input
              type="time"
              value={schedule.start}
              onChange={(e) => setSchedule((s) => ({ ...s, start: e.target.value }))}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-primary-300 focus:bg-surface"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">Tugashi</label>
            <input
              type="time"
              value={schedule.end}
              onChange={(e) => setSchedule((s) => ({ ...s, end: e.target.value }))}
              className="h-11 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-ink outline-none focus:border-primary-300 focus:bg-surface"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAYS.map((d, i) => {
            const day = i + 1;
            const active = schedule.days.includes(day);
            return (
              <button
                key={d}
                onClick={() => toggleDay(day)}
                className={cn(
                  'h-10 w-11 rounded-xl border text-sm font-semibold transition-colors',
                  active
                    ? 'border-primary-400 bg-primary-500 text-white'
                    : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </section>

      {/* Permissions */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionTitle icon={SecurityUser} title="Modullarga ruxsat (dostup)" className="mb-0" />
          <button
            onClick={() => setPermissions([...roleMeta(role).defaults])}
            className="text-[13px] font-medium text-primary-600 hover:underline"
          >
            Rol bo'yicha
          </button>
        </div>
        <p className="mb-3 text-[13px] text-ink-muted">
          {permissions.length} / {ALL_MODULES.length} modul yoqilgan
        </p>
        <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
          {ALL_MODULES.map((m) => {
            const on = permissions.includes(m);
            return (
              <div
                key={m}
                className="flex items-center justify-between gap-3 bg-surface px-4 py-2.5"
              >
                <span className={cn('text-sm', on ? 'text-ink' : 'text-ink-muted')}>
                  {MODULE_LABEL[m]}
                </span>
                <Switch checked={on} onChange={() => toggleModule(m)} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 rounded-xl bg-surface-2 p-4 text-[13px]">
        <div>
          <div className="text-ink-muted">Oxirgi kirish</div>
          <div className="font-medium text-ink">
            {member.lastLogin ? timeAgo(member.lastLogin) : '—'}
          </div>
        </div>
        <div>
          <div className="text-ink-muted">Qo'shilgan</div>
          <div className="font-medium text-ink">{formatDate(member.createdAt)}</div>
        </div>
      </div>

      {/* Delete */}
      {onDelete && (
        <button
          onClick={() => onDelete(member)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger-soft py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-danger/15"
        >
          <Trash size={18} variant="Bulk" /> Xodimni o'chirish
        </button>
      )}

      {/* Save */}
      <div className="sticky bottom-0 -mx-5 border-t border-line bg-canvas px-5 py-4">
        {saveError && (
          <div
            role="alert"
            className="mb-3 flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3 text-[13px] font-medium text-red-700"
          >
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:opacity-60"
          >
            Bekor qilish
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex flex-2 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              'Saqlanmoqda...'
            ) : (
              <>
                <Save2 size={18} variant="Bulk" /> Saqlash
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  className,
}: {
  icon: IconType;
  title: string;
  className?: string;
}) {
  return (
    <h4 className={cn('mb-3 flex items-center gap-2 text-sm font-semibold text-ink', className)}>
      <Icon size={18} variant="Bulk" className="text-primary-600" />
      {title}
    </h4>
  );
}
