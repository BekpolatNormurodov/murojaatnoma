import { useCallback, useEffect, useState } from 'react';
import { Add, CloseCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { Switch } from '@/shared/ui/Switch';
import { ALL_MODULES, MODULE_LABEL, ROLE_META, WEEKDAYS } from '@/shared/data/mock';
import type { ModuleKey, StaffRole, StaffStatus } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import type { StaffFormInput } from './useStaffMutations';

const AVATAR_COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9', '#64748b',
];

const ROLE_OPTIONS = (Object.keys(ROLE_META) as StaffRole[])
  .sort((a, b) => ROLE_META[a].rank - ROLE_META[b].rank)
  .map((r) => ({ value: r, label: ROLE_META[r].label, dot: ROLE_META[r].color }));

const STATUS_OPTIONS: { value: StaffStatus; label: string; dot: string }[] = [
  { value: 'active', label: 'Faol', dot: '#10b981' },
  { value: 'inactive', label: 'Nofaol', dot: '#94a3b8' },
  { value: 'suspended', label: "To'xtatilgan", dot: '#ef4444' },
];

const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function StaffFormModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: StaffFormInput) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [department, setDepartment] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [login, setLogin] = useState('');
  const [role, setRole] = useState<StaffRole>('operator');
  const [status, setStatus] = useState<StaffStatus>('active');
  const [permissions, setPermissions] = useState<ModuleKey[]>([...ROLE_META.operator.defaults]);
  const [scheduleDays, setScheduleDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleStart, setScheduleStart] = useState('09:00');
  const [scheduleEnd, setScheduleEnd] = useState('18:00');
  const [twoFactor, setTwoFactor] = useState(false);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [photo, setPhoto] = useState('');

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName('');
    setPosition('');
    setDepartment('');
    setEmail('');
    setPhone('');
    setLogin('');
    setRole('operator');
    setStatus('active');
    setPermissions([...ROLE_META.operator.defaults]);
    setScheduleDays([1, 2, 3, 4, 5]);
    setScheduleStart('09:00');
    setScheduleEnd('18:00');
    setTwoFactor(false);
    setAvatarColor(AVATAR_COLORS[0]);
    setPhoto('');
    setSubmitAttempted(false);
    setSubmitError(null);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errors = {
    name: name.trim() ? undefined : 'Ism-familiyani kiriting',
    position: position.trim() ? undefined : 'Lavozimni kiriting',
    department: department.trim() ? undefined : "Bo'limni kiriting",
    login: login.trim() ? undefined : 'Loginni kiriting',
    phone: phone.trim() ? undefined : 'Telefon raqamni kiriting',
    email: !email.trim()
      ? 'Email manzilni kiriting'
      : isEmail(email)
        ? undefined
        : "Email manzil noto'g'ri",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function applyRole(r: StaffRole) {
    setRole(r);
    setPermissions([...ROLE_META[r].defaults]);
  }
  function toggleModule(m: ModuleKey) {
    setPermissions((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }
  function toggleDay(d: number) {
    setScheduleDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) return;

    const input: StaffFormInput = {
      name: name.trim(),
      photo: photo.trim(),
      avatarColor,
      role,
      position: position.trim(),
      department: department.trim(),
      email: email.trim(),
      phone: phone.trim(),
      login: login.trim(),
      status,
      permissions,
      schedule: { start: scheduleStart, end: scheduleEnd, days: scheduleDays },
      twoFactor,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Saqlab bo'lmadi. Qaytadan urining.");
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xodim qo'shish"
      subtitle="Hokim apparati xodimi — rol va ruxsatlar bilan"
      width={580}
    >
      <div className="space-y-4">
        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3.5 text-[13px] font-medium text-red-700"
          >
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Ism-familiya" required error={submitAttempted ? errors.name : undefined}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ism familiya"
              className={cn(fieldCls, submitAttempted && errors.name ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Lavozim" required error={submitAttempted ? errors.position : undefined}>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Masalan: Bosh mutaxassis"
              className={cn(fieldCls, submitAttempted && errors.position ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bo'lim" required error={submitAttempted ? errors.department : undefined}>
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Masalan: Kotibiyat"
              className={cn(fieldCls, submitAttempted && errors.department ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Login" required error={submitAttempted ? errors.login : undefined}>
            <input
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="tizim.login"
              className={cn(fieldCls, 'font-mono', submitAttempted && errors.login ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" required error={submitAttempted ? errors.phone : undefined}>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+998 90 123 45 67"
              className={cn(fieldCls, submitAttempted && errors.phone ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Email" required error={submitAttempted ? errors.email : undefined}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ism@hokimiyat.uz"
              className={cn(fieldCls, submitAttempted && errors.email ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rol" required>
            <Select value={role} onChange={applyRole} options={ROLE_OPTIONS} block />
          </Field>
          <Field label="Holat" required>
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} block />
          </Field>
        </div>

        <Field label="Ish kunlari">
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d, i) => {
              const day = i + 1;
              const active = scheduleDays.includes(day);
              return (
                <button
                  key={d}
                  type="button"
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
            <div className="ml-auto flex items-center gap-2">
              <input
                type="time"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
                className="h-10 rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-primary-300"
              />
              <span className="text-ink-muted">—</span>
              <input
                type="time"
                value={scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
                className="h-10 rounded-xl border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-primary-300"
              />
            </div>
          </div>
        </Field>

        <Field label={`Modullarga ruxsat (${permissions.length}/${ALL_MODULES.length})`}>
          <div className="grid max-h-52 grid-cols-1 gap-px overflow-y-auto rounded-xl border border-line sm:grid-cols-2">
            {ALL_MODULES.map((m) => {
              const on = permissions.includes(m);
              return (
                <div key={m} className="flex items-center justify-between gap-2 bg-surface px-3 py-2">
                  <span className={cn('truncate text-[13px]', on ? 'text-ink' : 'text-ink-muted')}>
                    {MODULE_LABEL[m]}
                  </span>
                  <Switch checked={on} onChange={() => toggleModule(m)} />
                </div>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rasm URL (ixtiyoriy)">
            <input
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
              placeholder="https://..."
              className={cn(fieldCls, 'border-line')}
            />
          </Field>
          <div className="flex items-end">
            <div className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-2 px-4">
              <span className="text-[13px] font-medium text-ink-soft">2FA himoya</span>
              <Switch checked={twoFactor} onChange={setTwoFactor} />
            </div>
          </div>
        </div>

        <Field label="Avatar rangi">
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                className={cn(
                  'h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition-all',
                  avatarColor === c ? 'ring-2 ring-ink' : '',
                )}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
        </Field>

        <div className="flex gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className={cn(
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition-colors',
              submitting ? 'cursor-not-allowed bg-ink-muted/40' : 'bg-primary-600 shadow-glow hover:bg-primary-700',
            )}
          >
            {submitting ? (
              'Saqlanmoqda...'
            ) : (
              <>
                <Add size={18} /> Qo'shish
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[12px] font-medium text-danger">{error}</span>}
    </label>
  );
}
