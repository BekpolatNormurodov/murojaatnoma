import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Add,
  ArrowDown2,
  GalleryAdd,
  InfoCircle,
  RotateRight,
  Save2,
  SearchNormal1,
  TickCircle,
  CloseCircle,
} from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { CATEGORY_META, DISTRICTS } from '@/shared/data/mock';
import type { RequestCategory, Worker } from '@/shared/data/types';
import { api } from '@/shared/api/client';
import { cn } from '@/shared/lib/cn';
import type { WorkerFormInput } from './useWorkerMutations';
import { WORKER_POSITIONS } from './workerMeta';

/** Avatar rasm yuklash cheklovlari — faqat rasm turlari, ≤5 MB. */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

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
  /** `createLogin` — har bir ishchi worker-app hisobini (login/parol) oladi,
   *  shuning uchun yaratishda doim `true` yuboriladi; chaqiruvchi (WorkersPage)
   *  ishchi yaratilgandan so'ng buni ishlatib alohida POST /employees yuboradi
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

  // Avatar rasm yuklash holati (POST /uploads/image → { url }).
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    setUploading(false);
    setUploadError(null);
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
    position: position.trim() ? undefined : 'Lavozimni tanlang',
    phone: !phone.trim()
      ? 'Telefon raqamni kiriting'
      : isPhone(phone)
        ? undefined
        : "Telefon raqam formati noto'g'ri (masalan: +998 90 123 45 67)",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  // Email ixtiyoriy — bo'sh bo'lsa submitni bloklamaydi; kiritilsa faqat
  // format yumshoq tekshiriladi (bu ham submitni to'xtatmaydi).
  const emailError = email.trim() && !isEmail(email) ? "Email manzil noto'g'ri" : undefined;
  const shownEmailError =
    submitAttempted || touched.email ? emailError : undefined;

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

  /**
   * Avatar rasmini tanlash → mijoz tomonida tekshirish (faqat rasm, ≤5 MB) →
   * multipart yuklash (POST /uploads/image, "file" maydoni, admin Bearer token
   * bilan — api.upload boundary'ni brauzer o'zi qo'yishi uchun Content-Type
   * qo'ymaydi). Javob { url } — u `photo` state'iga saqlanadi.
   */
  async function handlePhotoPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Bir xil faylni qayta tanlash mumkin bo'lishi uchun inputni tozalaymiz.
    e.target.value = '';
    if (!file) return;

    setUploadError(null);
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setUploadError('Faqat JPG, PNG yoki WEBP rasm yuklang');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setUploadError('Rasm hajmi 5 MB dan oshmasligi kerak');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    try {
      const res = await api.upload<{ url: string }>('/uploads/image', formData);
      setPhoto(res.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi");
    } finally {
      setUploading(false);
    }
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
      // Har bir ishchi worker-app hisobini oladi — provisioning doim ishlaydi.
      await onSubmit(input, true);
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
            <PositionSelect
              value={position}
              onChange={(v) => {
                setPosition(v);
                markTouched('position');
              }}
              onBlur={() => markTouched('position')}
              invalid={!!shownError('position')}
              errorId={shownError('position') ? 'w-position-error' : undefined}
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
          <Field label="Email (ixtiyoriy)" error={shownEmailError} errorId="w-email-error">
            <input
              id="w-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => markTouched('email')}
              placeholder="ism@hokimiyat.uz"
              aria-invalid={!!shownEmailError}
              aria-describedby={shownEmailError ? 'w-email-error' : undefined}
              className={cn(fieldCls, shownEmailError ? 'border-danger' : 'border-line')}
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
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoPick}
            className="hidden"
          />
          {photo ? (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
              <img
                src={photo}
                alt="Avatar"
                className="h-14 w-14 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">Rasm yuklandi</p>
                <p className="truncate text-[12px] text-ink-muted">{photo}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPhoto('');
                  setUploadError(null);
                }}
                aria-label="Rasmni olib tashlash"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface hover:text-danger"
              >
                <CloseCircle size={20} variant="Bulk" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className={cn(
                'flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium transition-colors',
                uploading
                  ? 'cursor-not-allowed border-line text-ink-muted'
                  : 'border-line bg-surface text-ink-soft hover:border-primary-300 hover:bg-surface-2',
              )}
            >
              {uploading ? (
                <>
                  <RotateRight size={18} className="animate-spin" /> Yuklanmoqda...
                </>
              ) : (
                <>
                  <GalleryAdd size={18} variant="Bulk" /> Rasm yuklash
                </>
              )}
            </button>
          )}
          {uploadError && (
            <span role="alert" className="mt-1.5 block text-[12px] font-medium text-danger">
              {uploadError}
            </span>
          )}
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
          <div className="flex items-start gap-2.5 rounded-xl border border-line bg-surface-2 p-3.5 text-[13px]">
            <InfoCircle size={18} variant="Bulk" className="mt-0.5 shrink-0 text-primary-600" />
            <span className="text-ink-soft">
              Ishchi login va parol bilan worker-app'ga kiradi — hisob avtomatik yaratiladi.
            </span>
          </div>
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

/**
 * "Lavozim" — qidiruvli tanlagich (combobox): trigger tugma + popover ichida
 * qidiruv maydoni va aylanadigan (scroll) ro'yxat. Tanlangan qiymat `position`
 * state'iga yoziladi. BonusFormModal'dagi qabul qiluvchi qidiruvi uslubida.
 */
function PositionSelect({
  value,
  onChange,
  onBlur,
  invalid = false,
  errorId,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  /** Xato matni id'si — trigger'ning aria-describedby bilan bog'lash uchun. */
  errorId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Tashqariga bosish yoki Esc — panelni yopadi (va fieldni "touched" qiladi).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        onBlur?.();
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onBlur]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? WORKER_POSITIONS.filter((p) => p.toLowerCase().includes(q)) : WORKER_POSITIONS;
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        id="w-position"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid}
        aria-describedby={errorId}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-sm outline-none transition-colors',
          open ? 'border-primary-300' : invalid ? 'border-danger' : 'border-line',
        )}
      >
        <span className={cn('truncate text-left', value ? 'text-ink' : 'text-ink-muted')}>
          {value || 'Lavozimni tanlang'}
        </span>
        <ArrowDown2
          size={15}
          className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute inset-x-0 z-50 mt-2 origin-top overflow-hidden rounded-2xl border border-line bg-surface shadow-pop animate-fade-in"
        >
          <div className="relative border-b border-line">
            <SearchNormal1 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lavozim qidirish..."
              className="h-11 w-full bg-transparent pl-10 pr-3.5 text-sm text-ink outline-none placeholder:text-ink-muted"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-ink-muted">Hech narsa topilmadi</p>
            ) : (
              filtered.map((p) => {
                const active = p === value;
                return (
                  <button
                    key={p}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      onChange(p);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={cn(
                      'flex min-h-10 w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors',
                      active ? 'bg-primary-50 font-medium text-primary-700' : 'text-ink hover:bg-surface-2',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{p}</span>
                    {active && <TickCircle size={16} variant="Bulk" className="shrink-0 text-primary-600" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
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
