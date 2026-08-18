import { useCallback, useEffect, useState } from 'react';
import { Add, CloseCircle, Eye, EyeSlash } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { ApiError } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import { ADMIN_ROLE_OPTIONS } from './adminsMeta';
import type { AdminRole } from '@/shared/store/auth';
import type { AdminCreateInput } from './useAdminMutations';

const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export function AdminFormModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: AdminCreateInput) => Promise<void>;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('ADMIN');

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 409 (duplicate username/email) — aniq qaysi maydonda ekanini backend
  // aytmaydi, shu sababli ikkalasini ham chegaralab ko'rsatamiz.
  const [conflict, setConflict] = useState(false);

  const reset = useCallback(() => {
    setUsername('');
    setPassword('');
    setShowPassword(false);
    setFullName('');
    setEmail('');
    setRole('ADMIN');
    setSubmitAttempted(false);
    setTouched({});
    setSubmitError(null);
    setConflict(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errors = {
    username: !username.trim()
      ? 'Loginni kiriting'
      : username.trim().length < 3
        ? 'Login kamida 3 belgidan iborat bo\'lishi kerak'
        : undefined,
    password: !password
      ? 'Parolni kiriting'
      : password.length < 6
        ? 'Parol kamida 6 belgidan iborat bo\'lishi kerak'
        : undefined,
    fullName: fullName.trim() ? undefined : 'Ism-familiyani kiriting',
    email: email.trim() && !isEmail(email) ? "Email manzil noto'g'ri" : undefined,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function markTouched(field: string) {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }
  function shownError(field: keyof typeof errors) {
    return submitAttempted || touched[field] ? errors[field] : undefined;
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) return;

    const input: AdminCreateInput = {
      username: username.trim(),
      password,
      fullName: fullName.trim(),
      email: email.trim() ? email.trim() : undefined,
      role,
    };

    setSubmitError(null);
    setConflict(false);
    setSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
      }
      setSubmitError(
        err instanceof Error ? err.message : "Saqlab bo'lmadi. Qaytadan urining.",
      );
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Admin qo'shish"
      subtitle="Yangi web-admin akkaunti — login va parol bilan kiradi"
      width={480}
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

        <Field label="Ism-familiya" required error={shownError('fullName')} errorId="a-fullName-error">
          <input
            id="a-fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => markTouched('fullName')}
            placeholder="Ism familiya"
            aria-invalid={!!shownError('fullName')}
            aria-describedby={shownError('fullName') ? 'a-fullName-error' : undefined}
            className={cn(fieldCls, shownError('fullName') ? 'border-danger' : 'border-line')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Login"
            required
            error={shownError('username')}
            errorId="a-username-error"
          >
            <input
              id="a-username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setConflict(false);
              }}
              onBlur={() => markTouched('username')}
              placeholder="operator1"
              autoComplete="off"
              aria-invalid={!!shownError('username') || conflict}
              aria-describedby={shownError('username') ? 'a-username-error' : undefined}
              className={cn(
                fieldCls,
                'font-mono',
                shownError('username') || conflict ? 'border-danger' : 'border-line',
              )}
            />
          </Field>
          <Field label="Rol" required>
            <Select value={role} onChange={setRole} options={ADMIN_ROLE_OPTIONS} block />
          </Field>
        </div>

        <Field label="Parol" required error={shownError('password')} errorId="a-password-error">
          <div className="relative">
            <input
              id="a-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => markTouched('password')}
              placeholder="Kamida 6 belgi"
              autoComplete="new-password"
              aria-invalid={!!shownError('password')}
              aria-describedby={shownError('password') ? 'a-password-error' : undefined}
              className={cn(
                fieldCls,
                'pr-11',
                shownError('password') ? 'border-danger' : 'border-line',
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted transition-colors hover:text-ink"
            >
              {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>

        <Field label="Email (ixtiyoriy)" error={shownError('email')} errorId="a-email-error">
          <input
            id="a-email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setConflict(false);
            }}
            onBlur={() => markTouched('email')}
            placeholder="ism@hokimiyat.uz"
            aria-invalid={!!shownError('email') || conflict}
            aria-describedby={shownError('email') ? 'a-email-error' : undefined}
            className={cn(
              fieldCls,
              shownError('email') || conflict ? 'border-danger' : 'border-line',
            )}
          />
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
  errorId,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
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
