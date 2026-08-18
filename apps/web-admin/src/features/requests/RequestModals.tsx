import { useCallback, useEffect, useRef, useState } from 'react';
import { Add, Location, Profile, Call, Warning2, CloseCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { useI18n } from '@/shared/i18n/I18nProvider';
import { CATEGORY_META, DISTRICTS } from '@/shared/data/mock';
import type { CitizenRequest, Priority, RequestCategory } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';
import { pushRequestToast } from './toastStore';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_META) as RequestCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_META[c].label,
  dot: CATEGORY_META[c].color,
}));

const DISTRICT_OPTIONS = DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color }));

const PRIORITY_OPTION_META: { value: Priority; labelKey: string; dot: string }[] = [
  { value: 'high', labelKey: 'common.priorityHigh', dot: '#ef4444' },
  { value: 'medium', labelKey: 'common.priorityMedium', dot: '#f59e0b' },
  { value: 'low', labelKey: 'common.priorityLow', dot: '#94a3b8' },
];

const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm outline-none transition-colors focus:border-primary-300';

/* ============================================================
   Validatsiya — sarlavha/tavsif/manzil/F.I.O./telefon majburiy.
   Kategoriya, tuman va muhimlik Select orqali tanlanadi va har doim
   boshlang'ich qiymatga ega bo'lgani uchun bo'sh bo'la olmaydi.
   ============================================================ */
type TextFieldKey = 'title' | 'description' | 'address' | 'citizenName' | 'citizenPhone';

interface TextValues {
  title: string;
  description: string;
  address: string;
  citizenName: string;
  citizenPhone: string;
}

function validateField(
  key: TextFieldKey,
  values: TextValues,
  t: (key: string) => string,
): string | undefined {
  switch (key) {
    case 'title': {
      const v = values.title.trim();
      if (!v) return t('requests.validation.titleRequired');
      if (v.length < 4) return t('requests.validation.titleMinLen');
      return undefined;
    }
    case 'description': {
      const v = values.description.trim();
      if (!v) return t('requests.validation.descriptionRequired');
      if (v.length < 10) return t('requests.validation.descriptionMinLen');
      return undefined;
    }
    case 'address': {
      const v = values.address.trim();
      if (!v) return t('requests.validation.addressRequired');
      if (v.length < 3) return t('requests.validation.addressMinLen');
      return undefined;
    }
    case 'citizenName': {
      const v = values.citizenName.trim();
      if (!v) return t('requests.validation.nameRequired');
      if (v.length < 2) return t('requests.validation.nameMinLen');
      return undefined;
    }
    case 'citizenPhone': {
      const v = values.citizenPhone.trim();
      if (!v) return t('requests.validation.phoneRequired');
      const digits = v.replace(/\D/g, '');
      if (digits.length < 9 || digits.length > 13) {
        return t('requests.validation.phoneInvalid');
      }
      return undefined;
    }
    default:
      return undefined;
  }
}

const TEXT_FIELD_KEYS: TextFieldKey[] = ['title', 'description', 'address', 'citizenName', 'citizenPhone'];

export function AddRequestModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (r: Omit<CitizenRequest, 'id'>) => Promise<void>;
}) {
  const { t } = useI18n();
  const priorityOptions: { value: Priority; label: string; dot: string }[] = PRIORITY_OPTION_META.map(
    (p) => ({ value: p.value, label: t(p.labelKey), dot: p.dot }),
  );
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RequestCategory>('kommunal');
  const [districtId, setDistrictId] = useState(DISTRICTS[0].id);
  const [address, setAddress] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');

  const [errors, setErrors] = useState<Partial<Record<TextFieldKey, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<TextFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const values = (): TextValues => ({ title, description, address, citizenName, citizenPhone });

  const liveErrors = TEXT_FIELD_KEYS.reduce<Partial<Record<TextFieldKey, string>>>((acc, k) => {
    const err = validateField(k, values(), t);
    if (err) acc[k] = err;
    return acc;
  }, {});
  const hasErrors = Object.keys(liveErrors).length > 0;

  const reset = useCallback(() => {
    setTitle('');
    setCategory('kommunal');
    setDistrictId(DISTRICTS[0].id);
    setAddress('');
    setCitizenName('');
    setCitizenPhone('');
    setPriority('medium');
    setDescription('');
    setErrors({});
    setTouched({});
    setSubmitAttempted(false);
    setSubmitError(null);
    setSubmitting(false);
  }, []);

  // Har safar oyna ochilganda formani toza holatda boshlaymiz — oldingi
  // urinishdan qolgan qiymat/xatolar ko'rinmasin.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  function handleBlur(key: TextFieldKey) {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((e) => ({ ...e, [key]: validateField(key, values(), t) }));
  }

  function revalidateIfTouched(key: TextFieldKey, nextValues: TextValues) {
    if (touched[key] || submitAttempted) {
      setErrors((e) => ({ ...e, [key]: validateField(key, nextValues, t) }));
    }
  }

  async function submit() {
    setSubmitAttempted(true);
    if (hasErrors) {
      setErrors(liveErrors);
      setTouched({
        title: true,
        description: true,
        address: true,
        citizenName: true,
        citizenPhone: true,
      });
      requestAnimationFrame(() => summaryRef.current?.focus());
      return;
    }

    const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0];
    const payload: Omit<CitizenRequest, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      category,
      status: 'new',
      region: district.name,
      districtId: district.id,
      address: address.trim(),
      citizenName: citizenName.trim(),
      citizenPhone: citizenPhone.trim(),
      citizenPhoto: '',
      createdAt: new Date().toISOString(),
      resolvedAt: null,
      assignedWorkerId: null,
      priority,
      lat: district.center[0],
      lng: district.center[1],
      photos: [],
      responseHours: null,
      feedback: null,
      cost: 0,
    };

    setSubmitError(null);
    setSubmitting(true);
    try {
      await onCreate(payload);
      pushRequestToast('success', t('requests.toast.created'));
      reset();
      onClose();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('requests.toast.createError'),
      );
      setSubmitting(false);
    }
  }

  const errorCount = Object.keys(errors).filter((k) => errors[k as TextFieldKey]).length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('requests.addButton')}
      subtitle={t('requests.addModal.subtitle')}
      width={560}
    >
      <div className="space-y-4">
        {submitAttempted && errorCount > 0 && (
          <div
            ref={summaryRef}
            role="alert"
            tabIndex={-1}
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3.5 text-[13px] font-medium text-red-700 outline-none"
          >
            <Warning2 size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>
              {errorCount === 1
                ? t('requests.addModal.fixOneField')
                : t('requests.addModal.fixFieldsTemplate').replace('{count}', String(errorCount))}{' '}
              {t('requests.addModal.checkFieldsBelow')}
            </span>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3.5 text-[13px] font-medium text-red-700"
          >
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        <Field label={t('requests.addModal.titleLabel')} required error={errors.title} errorId="req-title-error">
          <input
            id="req-title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              revalidateIfTouched('title', { ...values(), title: e.target.value });
            }}
            onBlur={() => handleBlur('title')}
            placeholder={t('requests.addModal.titlePlaceholder')}
            aria-required="true"
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? 'req-title-error' : undefined}
            className={cn(fieldCls, errors.title ? 'border-danger' : 'border-line')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('requests.addModal.categoryLabel')} required>
            <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} block />
          </Field>
          <Field label={t('requests.addModal.districtLabel')} required>
            <Select value={districtId} onChange={setDistrictId} options={DISTRICT_OPTIONS} block />
          </Field>
        </div>

        <Field label={t('common.address')} required error={errors.address} errorId="req-address-error">
          <div className="relative">
            <Location
              size={16}
              variant="Bulk"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              id="req-address"
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                revalidateIfTouched('address', { ...values(), address: e.target.value });
              }}
              onBlur={() => handleBlur('address')}
              placeholder={t('requests.addModal.addressPlaceholder')}
              aria-required="true"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? 'req-address-error' : undefined}
              className={cn(fieldCls, 'pl-9', errors.address ? 'border-danger' : 'border-line')}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('requests.addModal.citizenNameLabel')} required error={errors.citizenName} errorId="req-name-error">
            <div className="relative">
              <Profile
                size={16}
                variant="Bulk"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="req-citizen-name"
                value={citizenName}
                onChange={(e) => {
                  setCitizenName(e.target.value);
                  revalidateIfTouched('citizenName', { ...values(), citizenName: e.target.value });
                }}
                onBlur={() => handleBlur('citizenName')}
                placeholder={t('requests.addModal.namePlaceholder')}
                aria-required="true"
                aria-invalid={!!errors.citizenName}
                aria-describedby={errors.citizenName ? 'req-name-error' : undefined}
                className={cn(fieldCls, 'pl-9', errors.citizenName ? 'border-danger' : 'border-line')}
              />
            </div>
          </Field>
          <Field label={t('requests.addModal.phoneLabel')} required error={errors.citizenPhone} errorId="req-phone-error">
            <div className="relative">
              <Call
                size={16}
                variant="Bulk"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                id="req-citizen-phone"
                type="tel"
                inputMode="tel"
                value={citizenPhone}
                onChange={(e) => {
                  setCitizenPhone(e.target.value);
                  revalidateIfTouched('citizenPhone', { ...values(), citizenPhone: e.target.value });
                }}
                onBlur={() => handleBlur('citizenPhone')}
                placeholder={t('requests.addModal.phonePlaceholder')}
                aria-required="true"
                aria-invalid={!!errors.citizenPhone}
                aria-describedby={errors.citizenPhone ? 'req-phone-error' : undefined}
                className={cn(fieldCls, 'pl-9', errors.citizenPhone ? 'border-danger' : 'border-line')}
              />
            </div>
          </Field>
        </div>

        <Field label={t('requests.addModal.priorityLabel')} required>
          <Select value={priority} onChange={setPriority} options={priorityOptions} block />
        </Field>

        <Field label={t('requests.addModal.descriptionLabel')} required error={errors.description} errorId="req-description-error">
          <textarea
            id="req-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              revalidateIfTouched('description', { ...values(), description: e.target.value });
            }}
            onBlur={() => handleBlur('description')}
            rows={3}
            placeholder={t('requests.addModal.descriptionPlaceholder')}
            aria-required="true"
            aria-invalid={!!errors.description}
            aria-describedby={errors.description ? 'req-description-error' : undefined}
            className={cn(
              'w-full resize-none rounded-xl border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-primary-300',
              errors.description ? 'border-danger' : 'border-line',
            )}
          />
        </Field>

        <div className="flex gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            aria-disabled={hasErrors || submitting}
            className={cn(
              'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium text-white transition-colors',
              !hasErrors && !submitting
                ? 'bg-primary-600 shadow-glow hover:bg-primary-700'
                : 'cursor-not-allowed bg-ink-muted/40',
            )}
          >
            {submitting ? (
              t('common.sending')
            ) : (
              <>
                <Add size={18} /> {t('common.add')}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="h-11 rounded-xl border border-line bg-surface px-5 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('common.cancel')}
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
  errorId,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  errorId?: string;
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
      {error && (
        <span id={errorId} className="mt-1.5 block text-[12px] font-medium text-danger">
          {error}
        </span>
      )}
    </label>
  );
}
