import { useCallback, useEffect, useState } from 'react';
import { Add, Save2, CloseCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { CATEGORY_META } from '@/shared/data/mock';
import type { Deputy, RequestCategory } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import type { DeputyFormInput } from './useDeputyMutations';

const COLORS = [
  '#7c3aed', '#2563eb', '#0891b2', '#059669', '#d97706',
  '#ef4444', '#ec4899', '#8b5cf6', '#0ea5e9', '#f59e0b',
];

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

export function DeputyFormModal({
  open,
  deputy,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Bo'lsa — tahrirlash rejimi; aks holda yangi o'rinbosar yaratish. */
  deputy: Deputy | null;
  onClose: () => void;
  onSubmit: (input: DeputyFormInput) => Promise<void>;
}) {
  const editing = !!deputy;

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [direction, setDirection] = useState('');
  const [shortDirection, setShortDirection] = useState('');
  const [office, setOffice] = useState('');
  const [receptionDay, setReceptionDay] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [categories, setCategories] = useState<RequestCategory[]>([]);
  const [topics, setTopics] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [photo, setPhoto] = useState('');

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName(deputy?.name ?? '');
    setPosition(deputy?.position ?? '');
    setDirection(deputy?.direction ?? '');
    setShortDirection(deputy?.shortDirection ?? '');
    setOffice(deputy?.office ?? '');
    setReceptionDay(deputy?.receptionDay ?? '');
    setPhone(deputy?.phone ?? '');
    setEmail(deputy?.email ?? '');
    setCategories(deputy?.categories ?? []);
    setTopics(deputy?.topics?.join(', ') ?? '');
    setColor(deputy?.color ?? COLORS[0]);
    setPhoto(deputy?.photo ?? '');
    setSubmitAttempted(false);
    setTouched({});
    setSubmitError(null);
    setSubmitting(false);
  }, [deputy]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errors = {
    name: name.trim() ? undefined : 'Ism-familiyani kiriting',
    position: position.trim() ? undefined : 'Lavozimni kiriting',
    direction: direction.trim() ? undefined : "Yo'nalishni kiriting",
    shortDirection: shortDirection.trim() ? undefined : "Qisqa yo'nalishni kiriting",
    office: office.trim() ? undefined : 'Kabinet raqamini kiriting',
    receptionDay: receptionDay.trim() ? undefined : 'Qabul kunini kiriting',
    phone: !phone.trim()
      ? 'Telefon raqamni kiriting'
      : isPhone(phone)
        ? undefined
        : "Telefon raqam formati noto'g'ri (masalan: +998 71 123 45 67)",
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
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) return;

    const input: DeputyFormInput = {
      name: name.trim(),
      photo: photo.trim(),
      color,
      position: position.trim(),
      direction: direction.trim(),
      shortDirection: shortDirection.trim(),
      categories,
      topics: topics
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      phone: phone.trim(),
      email: email.trim(),
      office: office.trim(),
      receptionDay: receptionDay.trim(),
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
      title={editing ? "O'rinbosarni tahrirlash" : "O'rinbosar qo'shish"}
      subtitle={editing ? deputy?.name : "Hokim o'rinbosari — yo'nalish va mas'uliyat"}
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
          <Field label="Ism-familiya" required error={shownError('name')} errorId="d-name-error">
            <input
              id="d-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => markTouched('name')}
              placeholder="Ism familiya"
              aria-invalid={!!shownError('name')}
              aria-describedby={shownError('name') ? 'd-name-error' : undefined}
              className={cn(fieldCls, shownError('name') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Lavozim" required error={shownError('position')} errorId="d-position-error">
            <input
              id="d-position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              onBlur={() => markTouched('position')}
              placeholder="Hokimning o'rinbosari"
              aria-invalid={!!shownError('position')}
              aria-describedby={shownError('position') ? 'd-position-error' : undefined}
              className={cn(fieldCls, shownError('position') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <Field label="Yo'nalish (to'liq)" required error={shownError('direction')} errorId="d-direction-error">
          <input
            id="d-direction"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            onBlur={() => markTouched('direction')}
            placeholder="Masalan: Qurilish va kommunal xo'jalik"
            aria-invalid={!!shownError('direction')}
            aria-describedby={shownError('direction') ? 'd-direction-error' : undefined}
            className={cn(fieldCls, shownError('direction') ? 'border-danger' : 'border-line')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Qisqa yo'nalish"
            required
            error={shownError('shortDirection')}
            errorId="d-shortDirection-error"
          >
            <input
              id="d-shortDirection"
              value={shortDirection}
              onChange={(e) => setShortDirection(e.target.value)}
              onBlur={() => markTouched('shortDirection')}
              placeholder="Masalan: Kommunal"
              aria-invalid={!!shownError('shortDirection')}
              aria-describedby={shownError('shortDirection') ? 'd-shortDirection-error' : undefined}
              className={cn(fieldCls, shownError('shortDirection') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Kabinet" required error={shownError('office')} errorId="d-office-error">
            <input
              id="d-office"
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              onBlur={() => markTouched('office')}
              placeholder="Masalan: 305-xona"
              aria-invalid={!!shownError('office')}
              aria-describedby={shownError('office') ? 'd-office-error' : undefined}
              className={cn(fieldCls, shownError('office') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon" required error={shownError('phone')} errorId="d-phone-error">
            <input
              id="d-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => markTouched('phone')}
              placeholder="+998 71 123 45 67"
              aria-invalid={!!shownError('phone')}
              aria-describedby={shownError('phone') ? 'd-phone-error' : undefined}
              className={cn(fieldCls, shownError('phone') ? 'border-danger' : 'border-line')}
            />
          </Field>
          <Field label="Email" required error={shownError('email')} errorId="d-email-error">
            <input
              id="d-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="ism@hokimiyat.uz"
              aria-invalid={!!shownError('email')}
              aria-describedby={shownError('email') ? 'd-email-error' : undefined}
              className={cn(fieldCls, shownError('email') ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <Field label="Qabul kuni" required error={shownError('receptionDay')} errorId="d-receptionDay-error">
          <input
            id="d-receptionDay"
            value={receptionDay}
            onChange={(e) => setReceptionDay(e.target.value)}
            onBlur={() => markTouched('receptionDay')}
            placeholder="Masalan: Har payshanba, 15:00–17:00"
            aria-invalid={!!shownError('receptionDay')}
            aria-describedby={shownError('receptionDay') ? 'd-receptionDay-error' : undefined}
            className={cn(fieldCls, shownError('receptionDay') ? 'border-danger' : 'border-line')}
          />
        </Field>

        <Field label="Javob beradigan yo'nalishlar">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORY_KEYS.map((c) => {
              const active = categories.includes(c);
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

        <Field label="Asosiy masalalar (vergul bilan ajrating)">
          <input
            value={topics}
            onChange={(e) => setTopics(e.target.value)}
            placeholder="Yo'l ta'miri, suv ta'minoti, ..."
            className={cn(fieldCls, 'border-line')}
          />
        </Field>

        <Field label="Rasm URL (ixtiyoriy)">
          <input
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://..."
            className={cn(fieldCls, 'border-line')}
          />
        </Field>

        <Field label="Yo'nalish rangi">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  'h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition-all',
                  color === c ? 'ring-2 ring-ink' : '',
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
