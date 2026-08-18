import { useCallback, useEffect, useState } from 'react';
import { Save2, CloseCircle, Eye, EyeSlash, Lock1 } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { Switch } from '@/shared/ui/Switch';
import { cn } from '@/shared/lib/cn';
import { ADMIN_ROLE_META, ADMIN_ROLE_OPTIONS } from './adminsMeta';
import type { AdminRole } from '@/shared/store/auth';
import type { AdminUser } from './useAdmins';
import type { AdminUpdateInput } from './useAdminMutations';

const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';

/** Tahrirlanayotgan admin uchun qulflash sababi (bo'lsa — tegishli maydon bloklanadi). */
export interface AdminEditLock {
  /** O'zining qatori — rol/holatni o'zgartira olmaydi. */
  isSelf: boolean;
  /** Oxirgi faol SUPER_ADMIN — rol/holatni o'zgartira olmaydi. */
  isLastActiveSuperAdmin: boolean;
}

function lockReason(lock: AdminEditLock, kind: 'role' | 'active'): string | undefined {
  if (lock.isSelf) {
    return kind === 'role'
      ? "O'zingizning rolingizni o'zgartira olmaysiz"
      : "O'zingizni faolsizlantira olmaysiz";
  }
  if (lock.isLastActiveSuperAdmin) {
    return kind === 'role'
      ? "Bu — oxirgi faol super admin, rolini o'zgartirib bo'lmaydi"
      : "Bu — oxirgi faol super admin, faolsizlantirib bo'lmaydi";
  }
  return undefined;
}

export function AdminEditModal({
  open,
  admin,
  lock,
  onClose,
  onSubmit,
}: {
  open: boolean;
  admin: AdminUser | null;
  lock: AdminEditLock;
  onClose: () => void;
  onSubmit: (input: AdminUpdateInput) => Promise<void>;
}) {
  const [role, setRole] = useState<AdminRole>('ADMIN');
  const [isActive, setIsActive] = useState(true);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setRole(admin?.role ?? 'ADMIN');
    setIsActive(admin?.isActive ?? true);
    setNewPassword('');
    setShowPassword(false);
    setSubmitAttempted(false);
    setSubmitError(null);
    setSubmitting(false);
  }, [admin]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const roleLocked = lock.isSelf || lock.isLastActiveSuperAdmin;
  const activeLocked = lock.isSelf || lock.isLastActiveSuperAdmin;

  const passwordError =
    newPassword && newPassword.length < 6
      ? 'Yangi parol kamida 6 belgidan iborat bo\'lishi kerak'
      : undefined;
  const hasErrors = !!passwordError;

  const changed =
    !!admin &&
    (role !== admin.role || isActive !== admin.isActive || newPassword.trim().length > 0);

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors || !admin) return;

    const patch: AdminUpdateInput = {};
    if (role !== admin.role) patch.role = role;
    if (isActive !== admin.isActive) patch.isActive = isActive;
    if (newPassword.trim()) patch.password = newPassword.trim();

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(patch);
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Saqlab bo'lmadi. Qaytadan urining.");
      setSubmitting(false);
    }
  }

  // Modal yopilayotganda `admin` `null`ga tushishi mumkin (bir vaqtda `open`
  // bilan) — erta `return null` qilmaymiz, aks holda Modal'ning yopilish
  // animatsiyasi (AnimatePresence) o'tkazib yuboriladi (Worker/StaffFormModal
  // bilan bir xil pattern: oxirgi ma'lum qiymatlar bilan render davom etadi).
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adminni tahrirlash"
      subtitle={admin ? `${admin.fullName} · ${admin.username}` : undefined}
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

        <Field label="Rol" required>
          {roleLocked ? (
            <div
              title={lockReason(lock, 'role')}
              className="flex h-11 w-full cursor-not-allowed items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5 text-sm font-medium text-ink-muted"
            >
              <Lock1 size={15} variant="Bulk" className="shrink-0" />
              {ADMIN_ROLE_META[role].label}
            </div>
          ) : (
            <Select value={role} onChange={setRole} options={ADMIN_ROLE_OPTIONS} block />
          )}
        </Field>

        <div
          title={activeLocked ? lockReason(lock, 'active') : undefined}
          className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-2 px-4"
        >
          <span className="flex items-center gap-2 text-[13px] font-medium text-ink-soft">
            {activeLocked && <Lock1 size={14} variant="Bulk" className="text-ink-muted" />}
            {isActive ? 'Faol' : 'Nofaol'}
          </span>
          <Switch checked={isActive} onChange={setIsActive} disabled={activeLocked} />
        </div>

        <Field
          label="Yangi parol (ixtiyoriy)"
          error={submitAttempted ? passwordError : undefined}
          errorId="ae-password-error"
        >
          <div className="relative">
            <input
              id="ae-password"
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="O'zgartirmaslik uchun bo'sh qoldiring"
              autoComplete="new-password"
              aria-invalid={!!(submitAttempted && passwordError)}
              aria-describedby={submitAttempted && passwordError ? 'ae-password-error' : undefined}
              className={cn(
                fieldCls,
                'pr-11',
                submitAttempted && passwordError ? 'border-danger' : 'border-line',
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

        <div className="flex gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || !changed}
            className={cn(
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition-colors',
              submitting || !changed
                ? 'cursor-not-allowed bg-ink-muted/40'
                : 'bg-primary-600 shadow-glow hover:bg-primary-700',
            )}
          >
            {submitting ? (
              'Saqlanmoqda...'
            ) : (
              <>
                <Save2 size={18} variant="Bulk" /> Saqlash
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
