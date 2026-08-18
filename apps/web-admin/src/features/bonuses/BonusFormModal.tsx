import { useCallback, useEffect, useMemo, useState } from 'react';
import { Add, CloseCircle, RotateRight, SearchNormal1, TickCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { cn } from '@/shared/lib/cn';
import { useWorkers } from '@/features/workers/useWorkers';
import { useStaff } from '@/features/staff/useStaff';
import type { CreateBonusInput } from './useBonusMutations';
import type { Bonus } from './useBonuses';
import { SOURCE_META, currentMonthValue, type RecipientSource } from './meta';

const SOURCE_KEYS: RecipientSource[] = ['worker', 'staff', 'custom'];

/** "Oy" select'i variantlari — Uzbekcha nomlar, qiymat "01".."12" ("YYYY-MM" uchun). */
const MONTH_OPTIONS: SelectOption[] = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
].map((label, i) => ({ value: String(i + 1).padStart(2, '0'), label }));

/** "Yil" select'i variantlari — joriy yildan +1 dan -5 gacha (yangi yillar tepada). */
const YEAR_OPTIONS: SelectOption[] = Array.from({ length: 7 }, (_, i) => {
  const y = String(new Date().getFullYear() + 1 - i);
  return { value: y, label: y };
});

/**
 * "Premya yozish" — yangi premya (bonus) yaratish oynasi. Qabul qiluvchi
 * haqiqiy ishchilar (`useWorkers`) yoki xodimlar (`useStaff`) ro'yxatidan
 * tanlanadi, yoki erkin nom kiritiladi; ikkalasidan birida
 * `employeeId`/`workerId` backendga yuboriladi (POST /bonuses).
 */
export function BonusFormModal({
  open,
  onClose,
  onSubmit,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  /** Backendga (POST yoki PATCH) yuboradigan chaqiruvchi (parent'da mutatsiya). */
  onSubmit: (input: CreateBonusInput) => Promise<unknown>;
  /** Berilsa — tahrirlash rejimi: forma shu premya bilan to'ldiriladi. */
  initial?: Bonus | null;
}) {
  const editing = !!initial;
  const workersQuery = useWorkers();
  const staffQuery = useStaff();
  const workers = workersQuery.data ?? [];
  const staffList = staffQuery.data ?? [];

  const [source, setSource] = useState<RecipientSource>('worker');
  const [recipientId, setRecipientId] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [personQuery, setPersonQuery] = useState('');

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [month, setMonth] = useState(currentMonthValue());

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initForm = useCallback(() => {
    if (initial) {
      // Tahrirlash — mavjud premya bilan to'ldiriladi.
      const src: RecipientSource = initial.employeeId
        ? 'staff'
        : initial.workerId
          ? 'worker'
          : 'custom';
      setSource(src);
      setRecipientId(initial.employeeId ?? initial.workerId ?? null);
      setCustomName(src === 'custom' ? initial.recipientName : '');
      setAmount(String(initial.amount));
      setReason(initial.reason);
      setMonth(/^\d{4}-\d{2}$/.test(initial.month) ? initial.month : currentMonthValue());
    } else {
      // Yangi premya — bo'sh forma.
      setSource('worker');
      setRecipientId(null);
      setCustomName('');
      setAmount('');
      setReason('');
      setMonth(currentMonthValue());
    }
    setPersonQuery('');
    setTouched({});
    setSubmitAttempted(false);
    setError(null);
    setSaving(false);
  }, [initial]);

  // Har safar ochilganda forma qayta tayyorlanadi (yangi = bo'sh, tahrir = to'ldirilgan).
  useEffect(() => {
    if (open) initForm();
  }, [open, initForm]);

  const selectedWorker = source === 'worker' ? workers.find((w) => w.id === recipientId) : undefined;
  const selectedStaff = source === 'staff' ? staffList.find((s) => s.id === recipientId) : undefined;

  const recipientName =
    source === 'custom'
      ? customName.trim()
      : (selectedWorker?.name ?? selectedStaff?.name ?? (editing ? initial!.recipientName : ''));

  const amountValue = Number(amount);
  const amountValid = amount.trim() !== '' && Number.isFinite(amountValue) && amountValue > 0;
  const reasonValid = reason.trim().length > 0;
  const monthValid = /^\d{4}-\d{2}$/.test(month);
  // "YYYY-MM" — Yil/Oy select'lari uchun ajratilgan qismlar.
  const [yearPart, monthPart] = month.split('-');
  const recipientValid = recipientName.length > 0;
  const valid = amountValid && reasonValid && monthValid && recipientValid;

  const showErr = (key: string) => submitAttempted || touched[key];

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    setSubmitAttempted(true);
    if (!valid || saving) return;
    const input: CreateBonusInput = {
      recipientName,
      amount: Math.round(amountValue),
      reason: reason.trim(),
      month,
      // Faol manba id'si (tahrirda oldindan tanlangan); qolganlari null — PATCH
      // ularni tozalaydi (masalan xodimdan erkin nomga o'tkazilganda).
      employeeId: source === 'staff' ? recipientId : null,
      workerId: source === 'worker' ? recipientId : null,
    };
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Premyani saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  const people = useMemo(() => {
    const q = personQuery.trim().toLowerCase();
    if (source === 'worker') {
      return workers.filter((w) => !q || w.name.toLowerCase().includes(q) || w.position.toLowerCase().includes(q));
    }
    if (source === 'staff') {
      return staffList.filter((s) => !q || s.name.toLowerCase().includes(q) || s.position.toLowerCase().includes(q));
    }
    return [];
  }, [source, personQuery, workers, staffList]);

  const peopleLoading = source === 'worker' ? workersQuery.isLoading : source === 'staff' ? staffQuery.isLoading : false;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? 'Premyani tahrirlash' : 'Premya yozish'}
      subtitle={editing ? "Premya ma'lumotlarini yangilang" : 'Xodim yoki ishchiga premya (bonus) belgilang'}
      width={560}
    >
      <div className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3.5 text-[13px] font-medium text-red-700"
          >
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Manba tanlash */}
        <Field label="Qabul qiluvchi manbai">
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_KEYS.map((key) => {
              const m = SOURCE_META[key];
              const active = source === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSource(key);
                    setRecipientId(null);
                    setPersonQuery('');
                  }}
                  className={cn(
                    'flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-all',
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  <m.icon size={16} variant="Bulk" />
                  {m.label}
                </button>
              );
            })}
          </div>
        </Field>

        {source === 'custom' ? (
          <Field label="Qabul qiluvchi F.I.Sh." error={showErr('recipient') && !recipientValid ? 'Ismni kiriting' : undefined}>
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, recipient: true }))}
              placeholder="Masalan: Aliyev Vali Aliyevich"
              className={cn(
                'h-11 w-full rounded-xl border bg-surface-2 px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
                showErr('recipient') && !recipientValid ? 'border-danger' : 'border-line focus:border-primary-300',
              )}
            />
          </Field>
        ) : (
          <Field label={`Qabul qiluvchi (${SOURCE_META[source].label.toLowerCase()}lar ro'yxatidan)`} error={showErr('recipient') && !recipientValid ? 'Qabul qiluvchini tanlang' : undefined}>
            <div
              className={cn(
                'overflow-hidden rounded-xl border bg-surface',
                showErr('recipient') && !recipientValid ? 'border-danger' : 'border-line',
              )}
            >
              <div className="relative border-b border-line">
                <SearchNormal1 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Ism yoki lavozim bo'yicha qidirish..."
                  className="h-11 w-full bg-transparent pl-10 pr-3.5 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
              <div className="max-h-52 overflow-y-auto p-1.5">
                {peopleLoading ? (
                  <div className="space-y-1.5 p-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="h-11 animate-pulse rounded-lg bg-surface-2" />
                    ))}
                  </div>
                ) : people.length === 0 ? (
                  <p className="px-3 py-6 text-center text-[13px] text-ink-muted">Hech kim topilmadi</p>
                ) : (
                  people.map((p) => {
                    const active = p.id === recipientId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setRecipientId(p.id);
                          setTouched((t) => ({ ...t, recipient: true }));
                        }}
                        className={cn(
                          'flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          active ? 'bg-primary-50' : 'hover:bg-surface-2',
                        )}
                      >
                        <Avatar name={p.name} src={p.photo} color={p.avatarColor} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-[13px] font-medium', active ? 'text-primary-700' : 'text-ink')}>
                            {p.name}
                          </span>
                          <span className="block truncate text-[11.5px] text-ink-muted">{p.position}</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Miqdor (so'm)" error={showErr('amount') && !amountValid ? "Musbat son kiriting" : undefined}>
            <div className="relative">
              {/* Mingliklar bilan formatlangan, faqat musbat butun son kiritish
                  mumkin (raqam bo'lmagan belgilar — minus ham — o'tmaydi). */}
              <input
                type="text"
                inputMode="numeric"
                value={formatThousands(amount)}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
                onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                placeholder="500 000"
                aria-label="Premya miqdori (so'm)"
                className={cn(
                  'h-11 w-full rounded-xl border bg-surface-2 px-4 pr-12 text-sm tabular-nums text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
                  showErr('amount') && !amountValid ? 'border-danger' : 'border-line focus:border-primary-300',
                )}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted">
                so'm
              </span>
            </div>
          </Field>
          <Field label="Oy" error={showErr('month') && !monthValid ? 'Oyni tanlang' : undefined}>
            {/* Yil + Oy — ikkita toza Select "YYYY-MM" qiymatiga birlashadi. */}
            <div className="grid grid-cols-[6.25rem_1fr] gap-2">
              <Select
                block
                value={yearPart}
                onChange={(y) => {
                  setMonth(`${y}-${monthPart}`);
                  setTouched((t) => ({ ...t, month: true }));
                }}
                options={YEAR_OPTIONS}
              />
              <Select
                block
                menuAlign="end"
                value={monthPart}
                onChange={(mm) => {
                  setMonth(`${yearPart}-${mm}`);
                  setTouched((t) => ({ ...t, month: true }));
                }}
                options={MONTH_OPTIONS}
              />
            </div>
          </Field>
        </div>

        <Field label="Sabab" error={showErr('reason') && !reasonValid ? 'Sababni kiriting' : undefined}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, reason: true }))}
            rows={3}
            placeholder="Masalan: Oylik reja 120% bajarildi"
            className={cn(
              'w-full resize-none rounded-xl border bg-surface-2 px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
              showErr('reason') && !reasonValid ? 'border-danger' : 'border-line focus:border-primary-300',
            )}
          />
        </Field>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (
              <RotateRight size={18} className="animate-spin" />
            ) : editing ? (
              <TickCircle size={18} />
            ) : (
              <Add size={18} />
            )}
            {saving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : 'Premya yaratish'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** "500000" -> "500 000" — mingliklar ajratilgan ko'rinish (faqat display). */
function formatThousands(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
