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

/** Lenient telefon format tekshiruvi — kamida 9 raqam, faqat +/bo'sh joy/tire. */
function isPhone(v: string) {
  const digits = v.trim().replace(/[\s()-]/g, '');
  return /^\+?\d{9,13}$/.test(digits);
}

export function StaffFormModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  /** `createLogin` — "Login yaratish (telefon orqali)" belgilangan bo'lsa true;
   *  chaqiruvchi (StaffPage) xodim yaratilgandan so'ng buni ishlatib alohida
   *  POST /employees yuboradi (worker-app OTP-login uchun). */
  onSubmit: (input: StaffFormInput, createLogin: boolean) => Promise<void>;
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
  // worker-app'ga shu telefon raqami bilan OTP orqali kirish uchun /employees
  // yozuvi ham yaratilsinmi (staff yozuvidan mustaqil, xatosi alohida ushlanadi).
  const [createLogin, setCreateLogin] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
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
    setCreateLogin(false);
    setSubmitAttempted(false);
    setTouched({});
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
    phone: !phone.trim()
      ? 'Telefon raqamni kiriting'
      : isPhone(phone)
        ? undefined
        : "Telefon raqam formati noto'g'ri (masalan: +998 90 123 45 67)",
    email: !email.trim()
      ? 'Email manzilni kiriting'
      : isEmail(email)
        ? undefined
        : "Email manzil noto'g'ri",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function markTouched(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }
  /** Submit urinilgandan yoki fielddan chiqilgandan keyingina xato ko'rsatiladi. */
  function shownError(field: keyof typeof errors) {
    return submitAttempted || touched[field] ? errors[field] : undefined;
  }

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
      await onSubmit(input, createLogin);
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
          <Field label="Ism-familiya" required error={shownError('name')} errorId="s-name-error">
            <input
              id="s-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
              placeholder="Ism familiya"
              aria-invalid={!!shownError('name')}
              aria-describedby={shownError('name') ? 's-name-error' : undefined}
              className={cn(fieldCls, shownError('name') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Lavozim" required error={shownError('position')} errorId="s-position-error">
            <input
              id="s-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              onBlur={() => markTouched('position')}
              placeholder="Masalan: Bosh mutaxassis"
              aria-invalid={!!shownError('position')}
              aria-describedby={shownError('position') ? 's-position-error' : undefined}
              className={cn(fieldCls, shownError('position') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bo'lim" required error={shownError('department')} errorId="s-department-error">
            <input
              id="s-department"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              onBlur={() => markTouched('department')}
              placeholder="Masalan: Kotibiyat"
              aria-invalid={!!shownError('department')}
              aria-describedby={shownError('department') ? 's-department-error' : undefined}
              className={cn(fieldCls, shownError('department') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Login" required error={shownError('login')} errorId="s-login-error">
            <input
              id="s-login"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              onBlur={() => markTouched('login')}
              placeholder="tizim.login"
              aria-invalid={!!shownError('login')}
              aria-describedby={shownError('login') ? 's-login-error' : undefined}
              className={cn(fieldCls, 'font-mono', shownError('login') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" required error={shownError('phone')} errorId="s-phone-error">
            <input
              id="s-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => markTouched('phone')}
              placeholder="+998 90 123 45 67"
              aria-invalid={!!shownError('phone')}
              aria-describedby={shownError('phone') ? 's-phone-error' : undefined}
              className={cn(fieldCls, shownError('phone') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Email" required error={shownError('email')} errorId="s-email-error">
            <input
              id="s-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="ism@hokimiyat.uz"
              aria-invalid={!!shownError('email')}
              aria-describedby={shownError('email') ? 's-email-error' : undefined}
              className={cn(fieldCls, shownError('email') ? 'border-danger' : 'border-line')}
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

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
          <input
            type="checkbox"
            checked={createLogin}
            onChange={(e) => setCreateLogin(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary-600"
          />
          <span className="text-[13px]">
            <span className="block font-medium text-ink">Login yaratish (telefon orqali)</span>
            <span className="mt-0.5 block text-ink-muted">
              Xodim worker-app'ga yuqoridagi telefon raqami bilan SMS-kod (OTP) orqali kira oladi
            </span>
          </span>
        </label>

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
  errorId,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
  /** Xato matnining id'si — inputning aria-describedby bilan bog'lash uchun. */
  errorId?: string;
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
      {error && (
        <span id={errorId} role="alert" className="mt-1.5 block text-[12px] font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
