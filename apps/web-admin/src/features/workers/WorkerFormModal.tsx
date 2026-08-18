import { useCallback, useEffect, useState } from 'react';
import { Add, Save2, CloseCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { CATEGORY_META, DISTRICTS } from '@/shared/data/mock';
import type { RequestCategory, Worker } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import type { WorkerFormInput } from './useWorkerMutations';

const AVATAR_COLORS = [
  '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#8b5cf6', '#0ea5e9', '#64748b',
];

// Loyiha Mirzo Ulug'bek tumani (viloyat — "Toshkent shahri") — yagona hudud,
// shuning uchun tuman tanlash yo'q; har bir ishchi shu tumanga biriktiriladi.
const FIXED_DISTRICT = DISTRICTS.find((d) => d.name.includes("Mirzo Ulug'bek")) ?? DISTRICTS[0];
const CATEGORY_KEYS = Object.keys(CATEGORY_META) as RequestCategory[];

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

export function WorkerFormModal({
  open,
  worker,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Bo'lsa — tahrirlash rejimi; aks holda yangi ishchi yaratish. */
  worker: Worker | null;
  onClose: () => void;
  /** `createLogin` — "Login yaratish (telefon orqali)" belgilangan bo'lsa true
   *  (faqat yaratishda ko'rinadi); chaqiruvchi (WorkersPage) ishchi
   *  yaratilgandan so'ng buni ishlatib alohida POST /employees yuboradi
   *  (worker-app login/parol hisobini yaratish uchun). */
  onSubmit: (input: WorkerFormInput, createLogin: boolean) => Promise<void>;
}) {
  const editing = !!worker;

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState<RequestCategory[]>([]);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [photo, setPhoto] = useState('');
  const [salary, setSalary] = useState('');
  const [vehicle, setVehicle] = useState('');
  // worker-app hisobini (login/parol) yaratish uchun /employees yozuvi ham
  // yaratilsinmi — faqat yangi ishchi yaratishda dolzarb.
  const [createLogin, setCreateLogin] = useState(false);

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName(worker?.name ?? '');
    setPosition(worker?.position ?? '');
    setPhone(worker?.phone ?? '');
    setEmail(worker?.email ?? '');
    setSpecialization(worker?.specialization ?? []);
    setAvatarColor(worker?.avatarColor ?? AVATAR_COLORS[0]);
    setPhoto(worker?.photo ?? '');
    setSalary(worker && worker.salary ? String(worker.salary) : '');
    setVehicle(worker?.vehicle ?? '');
    setCreateLogin(false);
    setSubmitAttempted(false);
    setTouched({});
    setSubmitError(null);
    setSubmitting(false);
  }, [worker]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errors = {
    name: name.trim() ? undefined : 'Ism-familiyani kiriting',
    position: position.trim() ? undefined : 'Lavozimni kiriting',
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

  function toggleCategory(c: RequestCategory) {
    setSpecialization((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) return;

    const salaryNum = Number(salary.replace(/\s/g, ''));
    const input: WorkerFormInput = {
      name: name.trim(),
      photo: photo.trim(),
      avatarColor,
      position: position.trim(),
      // Yagona hudud — Mirzo Ulug'bek tumani, viloyat "Toshkent shahri".
      region: 'Toshkent shahri',
      districtId: FIXED_DISTRICT.id,
      phone: phone.trim(),
      email: email.trim(),
      specialization,
      // "Holat" auto-derived jonli-lokatsiya statusi — bu yerda kiritilmaydi;
      // WorkerFormInput status'ni talab qilgani uchun default 'offline' yuboriladi.
      status: 'offline',
      salary: Number.isFinite(salaryNum) ? salaryNum : 0,
      vehicle: vehicle.trim() ? vehicle.trim() : null,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(input, createLogin);
      onClose();
    } catch (err) {
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
      title={editing ? 'Ishchini tahrirlash' : "Ishchi qo'shish"}
      subtitle={editing ? worker?.name : 'Dala ishchisi profilini tizimga kiriting'}
      width={560}
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
          <Field label="Ism-familiya" required error={shownError('name')} errorId="w-name-error">
            <input
              id="w-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
              placeholder="Ism familiya"
              aria-invalid={!!shownError('name')}
              aria-describedby={shownError('name') ? 'w-name-error' : undefined}
              className={cn(fieldCls, shownError('name') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Lavozim" required error={shownError('position')} errorId="w-position-error">
            <input
              id="w-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              onBlur={() => markTouched('position')}
              placeholder="Masalan: Elektrik"
              aria-invalid={!!shownError('position')}
              aria-describedby={shownError('position') ? 'w-position-error' : undefined}
              className={cn(fieldCls, shownError('position') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" required error={shownError('phone')} errorId="w-phone-error">
            <input
              id="w-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => markTouched('phone')}
              placeholder="+998 90 123 45 67"
              aria-invalid={!!shownError('phone')}
              aria-describedby={shownError('phone') ? 'w-phone-error' : undefined}
              className={cn(fieldCls, shownError('phone') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Email" required error={shownError('email')} errorId="w-email-error">
            <input
              id="w-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="ism@hokimiyat.uz"
              aria-invalid={!!shownError('email')}
              aria-describedby={shownError('email') ? 'w-email-error' : undefined}
              className={cn(fieldCls, shownError('email') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <Field label="Mutaxassislik">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((c) => {
              const active = specialization.includes(c);
              const meta = CATEGORY_META[c];
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleCategory(c)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                    active ? 'border-transparent text-white' : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                  style={active ? { background: meta.color } : undefined}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Oylik (so'm)">
            <input
              value={salary}
              onChange={(e) => setSalary(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              placeholder="0"
              className={cn(fieldCls, 'border-line')}
            />
          </Field>
          <Field label="Transport">
            <input
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Masalan: Damas 01A123BC"
              className={cn(fieldCls, 'border-line')}
            />
          </Field>
        </div>

        <Field label="Avatar rasmi (ixtiyoriy)">
          <input
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://..."
            className={cn(fieldCls, 'border-line')}
          />
          <p className="mt-1.5 text-[12px] text-ink-muted">
            Bu profil rasmi (avatar). Yuz biometriyasi bunga aloqasi yo'q — u mobil ilovada
            xodim tomonidan ro'yxatdan o'tkaziladi.
          </p>
        </Field>

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

        {!editing && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-2 p-3.5">
            <input
              type="checkbox"
              checked={createLogin}
              onChange={(e) => setCreateLogin(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary-600"
            />
            <span className="text-[13px]">
              <span className="block font-medium text-ink">Worker-app hisobini yaratish</span>
              <span className="mt-0.5 block text-ink-muted">
                Ishchi uchun worker-app hisobi yaratiladi — u login va parol bilan kiradi (SMS/OTP emas).
              </span>
            </span>
          </label>
        )}

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
            ) : editing ? (
              <>
                <Save2 size={18} variant="Bulk" /> Saqlash
              </>
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
