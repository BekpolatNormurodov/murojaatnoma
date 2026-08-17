import { useCallback, useEffect, useState } from 'react';
import { Add, Save2, CloseCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { CATEGORY_META, DISTRICTS } from '@/shared/data/mock';
import type { RequestCategory, Worker, WorkerStatus } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import type { WorkerFormInput } from './useWorkerMutations';

const AVATAR_COLORS = [
  '#10b981', '#3b82f6', '#a855f7', '#f59e0b', '#ef4444',
  '#06b6d4', '#ec4899', '#8b5cf6', '#0ea5e9', '#64748b',
];

const STATUS_OPTIONS: { value: WorkerStatus; label: string; dot: string }[] = [
  { value: 'online', label: 'Onlayn', dot: '#10b981' },
  { value: 'on_task', label: 'Vazifada', dot: '#f59e0b' },
  { value: 'break', label: 'Tanaffus', dot: '#06b6d4' },
  { value: 'offline', label: 'Oflayn', dot: '#94a3b8' },
];

const DISTRICT_OPTIONS = DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color }));
const CATEGORY_KEYS = Object.keys(CATEGORY_META) as RequestCategory[];

const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
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
  onSubmit: (input: WorkerFormInput) => Promise<void>;
}) {
  const editing = !!worker;

  const [name, setName] = useState('');
  const [position, setPosition] = useState('');
  const [districtId, setDistrictId] = useState(DISTRICTS[0].id);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState<RequestCategory[]>([]);
  const [status, setStatus] = useState<WorkerStatus>('offline');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [photo, setPhoto] = useState('');
  const [salary, setSalary] = useState('');
  const [vehicle, setVehicle] = useState('');

  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setName(worker?.name ?? '');
    setPosition(worker?.position ?? '');
    setDistrictId(worker?.districtId ?? DISTRICTS[0].id);
    setPhone(worker?.phone ?? '');
    setEmail(worker?.email ?? '');
    setSpecialization(worker?.specialization ?? []);
    setStatus(worker?.status ?? 'offline');
    setAvatarColor(worker?.avatarColor ?? AVATAR_COLORS[0]);
    setPhoto(worker?.photo ?? '');
    setSalary(worker && worker.salary ? String(worker.salary) : '');
    setVehicle(worker?.vehicle ?? '');
    setSubmitAttempted(false);
    setSubmitError(null);
    setSubmitting(false);
  }, [worker]);

  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const errors = {
    name: name.trim() ? undefined : 'Ism-familiyani kiriting',
    position: position.trim() ? undefined : 'Lavozimni kiriting',
    phone: phone.trim() ? undefined : 'Telefon raqamni kiriting',
    email: !email.trim()
      ? 'Email manzilni kiriting'
      : isEmail(email)
        ? undefined
        : "Email manzil noto'g'ri",
  };
  const hasErrors = Object.values(errors).some(Boolean);

  function toggleCategory(c: RequestCategory) {
    setSpecialization((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) return;

    const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0];
    const salaryNum = Number(salary.replace(/\s/g, ''));
    const input: WorkerFormInput = {
      name: name.trim(),
      photo: photo.trim(),
      avatarColor,
      position: position.trim(),
      region: district.name,
      districtId: district.id,
      phone: phone.trim(),
      email: email.trim(),
      specialization,
      status,
      salary: Number.isFinite(salaryNum) ? salaryNum : 0,
      vehicle: vehicle.trim() ? vehicle.trim() : null,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onSubmit(input);
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
              placeholder="Masalan: Elektrik"
              className={cn(fieldCls, submitAttempted && errors.position ? 'border-danger' : 'border-line')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tuman" required>
            <Select value={districtId} onChange={setDistrictId} options={DISTRICT_OPTIONS} block />
          </Field>
          <Field label="Holat" required>
            <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} block />
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

        <Field label="Rasm URL (ixtiyoriy)">
          <input
            value={photo}
            onChange={(e) => setPhoto(e.target.value)}
            placeholder="https://..."
            className={cn(fieldCls, 'border-line')}
          />
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
