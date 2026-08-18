import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Add,
  ArrowDown2,
  ArrowLeft2,
  ArrowRight2,
  Calculator,
  CalendarEdit,
  CloseCircle,
  Money,
  NoteText,
  PercentageSquare,
  Profile2User,
  RotateRight,
  SearchNormal1,
  TickCircle,
  Wallet3,
  type Icon as IconType,
} from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { cn } from '@/shared/lib/cn';
import { useWorkers } from '@/features/workers/useWorkers';
import { useStaff } from '@/features/staff/useStaff';
import type { CreateBonusInput } from './useBonusMutations';
import type { Bonus } from './useBonuses';
import { SOURCE_META, currentMonthValue, formatMonthLabel, type RecipientSource } from './meta';

const SOURCE_KEYS: RecipientSource[] = ['worker', 'staff', 'custom'];

/** Miqdorni kiritish usuli — yaxlit summa yoki ishchi oyligidan foiz. */
type AmountMode = 'flat' | 'percent';

/** Oy tarmog'idagi qisqa nomlar (Yan..Dek) — "YYYY-MM" ning "MM" qismi uchun. */
const MONTH_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
];

/**
 * "Premya yozish" — yangi premya (bonus) yaratish oynasi. Qabul qiluvchi
 * haqiqiy ishchilar (`useWorkers`) yoki xodimlar (`useStaff`) ro'yxatidan
 * tanlanadi, yoki erkin nom kiritiladi; ikkalasidan birida
 * `employeeId`/`workerId` backendga yuboriladi (POST /bonuses).
 *
 * Miqdor ikki usulda kiritiladi: yaxlit summa (so'm) yoki tanlangan ishchi
 * oyligidan foiz — foiz rejimida yakuniy summa avtomatik hisoblanadi va
 * `amount` sifatida (yaxlitlangan butun son) yuboriladi.
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

  const [amountMode, setAmountMode] = useState<AmountMode>('flat');
  const [amount, setAmount] = useState(''); // yaxlit summa (faqat raqamlar)
  const [percent, setPercent] = useState(''); // oylikdan foiz "1".."100"
  const [reason, setReason] = useState('');
  const [month, setMonth] = useState(currentMonthValue());

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initForm = useCallback(() => {
    if (initial) {
      // Tahrirlash — mavjud premya bilan to'ldiriladi (har doim yaxlit summa
      // rejimida: saqlangan foizni tiklab bo'lmaydi, faqat yakuniy summa bor).
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
    setAmountMode('flat');
    setPercent('');
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

  // Foiz rejimi faqat oyligi ma'lum (>0) ishchi uchun mavjud; xodim/erkin nomda yo'q.
  const workerSalary = source === 'worker' ? (selectedWorker?.salary ?? 0) : 0;
  const canUsePercent = workerSalary > 0;
  const usingPercent = amountMode === 'percent' && canUsePercent;

  // Manba/qabul qiluvchi oyliksizga o'zgarsa — foiz rejimi yaxlit summaga qaytadi.
  useEffect(() => {
    if (amountMode === 'percent' && !canUsePercent) setAmountMode('flat');
  }, [amountMode, canUsePercent]);

  // --- Miqdorni tekshirish (rejimga qarab) ---
  const flatAmount = Number(amount);
  const flatAmountValid = amount.trim() !== '' && Number.isFinite(flatAmount) && flatAmount > 0;

  const percentValue = Number(percent);
  const percentValid =
    percent.trim() !== '' && Number.isFinite(percentValue) && percentValue > 0 && percentValue <= 100;
  // Oylikdan foiz -> yaxlitlangan so'm (masalan 25% × 4 500 000 = 1 125 000).
  const computedAmount = usingPercent && percentValid ? Math.round((percentValue / 100) * workerSalary) : 0;

  // Yakuniy `amount` — har ikki rejimda musbat butun son.
  const effectiveAmount = usingPercent ? computedAmount : Math.round(flatAmount || 0);
  const amountValid = usingPercent ? percentValid && computedAmount > 0 : flatAmountValid;

  const reasonValid = reason.trim().length > 0;
  const monthValid = /^\d{4}-\d{2}$/.test(month);
  const recipientValid = recipientName.length > 0;
  const valid = amountValid && reasonValid && monthValid && recipientValid;

  const showErr = (key: string) => submitAttempted || touched[key];
  const amountError = showErr('amount') && !amountValid;

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    setSubmitAttempted(true);
    if (!valid || saving) return;
    const input: CreateBonusInput = {
      recipientName,
      amount: effectiveAmount,
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
        <Field label="Qabul qiluvchi manbai" icon={Profile2User}>
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
                      ? 'border-primary-300 bg-primary-50 text-primary-700 shadow-card'
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
          <Field
            label="Qabul qiluvchi F.I.Sh."
            icon={Profile2User}
            error={showErr('recipient') && !recipientValid ? 'Ismni kiriting' : undefined}
          >
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
          <Field
            label={`Qabul qiluvchi (${SOURCE_META[source].label.toLowerCase()}lar ro'yxatidan)`}
            icon={Profile2User}
            error={showErr('recipient') && !recipientValid ? 'Qabul qiluvchini tanlang' : undefined}
          >
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
                        {active && <TickCircle size={18} variant="Bulk" className="shrink-0 text-primary-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </Field>
        )}

        {/* Miqdor — yaxlit summa yoki oylikdan foiz (kartada) */}
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-50 text-primary-600">
              <Wallet3 size={18} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-ink">Premya miqdori</p>
              <p className="text-[11.5px] text-ink-muted">
                {usingPercent ? 'Oylik maoshdan foiz sifatida' : "Yaxlit summa (so'm)"}
              </p>
            </div>
          </div>

          {/* Rejim tanlagichi (segmented) */}
          <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-surface-2 p-1">
            {[
              { mode: 'flat' as AmountMode, label: 'Yaxlit summa', icon: Money, disabled: false },
              { mode: 'percent' as AmountMode, label: 'Oylikdan foiz', icon: PercentageSquare, disabled: !canUsePercent },
            ].map(({ mode, label, icon: Icon, disabled }) => {
              const active = mode === 'percent' ? usingPercent : !usingPercent;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={disabled}
                  onClick={() => setAmountMode(mode)}
                  className={cn(
                    'flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all',
                    active
                      ? 'bg-surface text-primary-700 shadow-card'
                      : disabled
                        ? 'cursor-not-allowed text-ink-muted opacity-60'
                        : 'text-ink-soft hover:text-ink',
                  )}
                >
                  <Icon size={15} variant="Bulk" />
                  {label}
                </button>
              );
            })}
          </div>

          {!canUsePercent && (
            <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              <PercentageSquare size={13} variant="Bulk" className="shrink-0" />
              Foiz rejimi faqat oyligi ma'lum ishchi tanlanganda ishlaydi
            </p>
          )}

          {/* Rejimga qarab kirish maydoni */}
          <div className="mt-3">
            {usingPercent ? (
              <div className="space-y-3">
                <div className="grid grid-cols-[7rem_1fr] gap-2.5">
                  {/* Foiz kiritish (1..100) */}
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={percent}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
                        setPercent(digits === '' ? '' : String(Math.min(100, Number(digits))));
                      }}
                      onBlur={() => setTouched((t) => ({ ...t, amount: true }))}
                      placeholder="25"
                      aria-label="Premya foizi (%)"
                      className={cn(
                        'h-12 w-full rounded-xl border bg-surface-2 px-4 pr-9 text-base font-semibold tabular-nums text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
                        amountError ? 'border-danger' : 'border-line focus:border-primary-300',
                      )}
                    />
                    <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">
                      %
                    </span>
                  </div>
                  {/* Tanlangan ishchining oyligi */}
                  <div className="flex items-center gap-2 rounded-xl border border-line bg-surface-2 px-3.5">
                    <Wallet3 size={16} variant="Bulk" className="shrink-0 text-ink-muted" />
                    <span className="text-[12px] text-ink-muted">Oylik</span>
                    <span className="ml-auto truncate text-[13px] font-semibold tabular-nums text-ink">
                      {formatThousands(String(workerSalary))} so'm
                    </span>
                  </div>
                </div>

                {/* Hisoblangan natija — ajratilgan (highlighted) karta */}
                <div className="rounded-xl border border-primary-300 bg-primary-50 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary-100 text-primary-700">
                      <Calculator size={22} variant="Bulk" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-700">
                        Hisoblangan premya
                      </p>
                      <p className="mt-0.5 text-[22px] font-bold leading-none tabular-nums text-primary-700">
                        {computedAmount > 0 ? (
                          <>
                            {formatThousands(String(computedAmount))}
                            <span className="ml-1 text-sm font-semibold">so'm</span>
                          </>
                        ) : (
                          <span className="text-ink-muted">—</span>
                        )}
                      </p>
                    </div>
                    {percentValid && (
                      <span className="shrink-0 rounded-lg bg-primary-100 px-2.5 py-1 text-[12px] font-bold tabular-nums text-primary-700">
                        {percentValue}%
                      </span>
                    )}
                  </div>
                  {percentValid && computedAmount > 0 && (
                    <p className="mt-2.5 border-t border-primary-300/50 pt-2.5 text-[11.5px] tabular-nums text-primary-700">
                      {percentValue}% × {formatThousands(String(workerSalary))} so'm
                    </p>
                  )}
                </div>
              </div>
            ) : (
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
                    'h-12 w-full rounded-xl border bg-surface-2 px-4 pr-14 text-base font-semibold tabular-nums text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
                    amountError ? 'border-danger' : 'border-line focus:border-primary-300',
                  )}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-ink-muted">
                  so'm
                </span>
              </div>
            )}
          </div>

          {amountError && (
            <p role="alert" className="mt-2 text-[12px] font-medium text-danger">
              {usingPercent ? "1–100 oralig'ida foiz kiriting" : 'Musbat son kiriting'}
            </p>
          )}
        </div>

        {/* Oy — professional oy tanlagich (yil stepperi + oy tarmog'i) */}
        <Field label="Qaysi oy uchun" icon={CalendarEdit} error={showErr('month') && !monthValid ? 'Oyni tanlang' : undefined}>
          <MonthPicker
            value={month}
            invalid={showErr('month') && !monthValid}
            onChange={(value) => {
              setMonth(value);
              setTouched((t) => ({ ...t, month: true }));
            }}
          />
        </Field>

        <Field label="Sabab" icon={NoteText} error={showErr('reason') && !reasonValid ? 'Sababni kiriting' : undefined}>
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

/**
 * Professional oy tanlagich — trigger + popover (yil stepperi ◀ 2026 ▶ va
 * 3×4 oy tarmog'i). Qiymat "YYYY-MM" formatida; native <input> ishlatilmaydi.
 * Tanlanganda yopiladi, tashqariga bosish yoki Esc bilan ham yopiladi.
 */
function MonthPicker({
  value,
  onChange,
  invalid = false,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = /^(\d{4})-(\d{2})$/.exec(value);
  const selYear = parsed ? Number(parsed[1]) : new Date().getFullYear();
  const [viewYear, setViewYear] = useState(selYear);

  // Panel ochilganda tanlangan yildan boshlab ko'rsatiladi.
  useEffect(() => {
    if (open) setViewYear(selYear);
  }, [open, selYear]);

  // Tashqariga bosish yoki Esc — panelni yopadi.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const todayValue = currentMonthValue();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3.5 text-sm font-medium outline-none transition-colors',
          open
            ? 'border-primary-300'
            : invalid
              ? 'border-danger'
              : 'border-line hover:bg-surface-2',
        )}
      >
        <span className="flex items-center gap-2.5">
          <CalendarEdit size={17} variant="Bulk" className={cn(open ? 'text-primary-600' : 'text-ink-muted')} />
          <span className="text-ink">{formatMonthLabel(value)}</span>
        </span>
        <ArrowDown2 size={15} className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Oyni tanlash"
          className="absolute inset-x-0 z-50 mt-2 origin-top rounded-2xl border border-line bg-surface p-3 shadow-pop animate-fade-in"
        >
          {/* Yil stepperi */}
          <div className="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              aria-label="Oldingi yil"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft2 size={17} />
            </button>
            <span className="text-sm font-bold tabular-nums text-ink">{viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              aria-label="Keyingi yil"
              className="grid h-8 w-8 place-items-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowRight2 size={17} />
            </button>
          </div>

          {/* 3×4 oy tarmog'i */}
          <div className="grid grid-cols-3 gap-1.5">
            {MONTH_SHORT.map((name, i) => {
              const cellValue = `${viewYear}-${String(i + 1).padStart(2, '0')}`;
              const selected = cellValue === value;
              const isToday = cellValue === todayValue;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(cellValue);
                    setOpen(false);
                  }}
                  className={cn(
                    'h-10 rounded-xl text-[13px] font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary-300',
                    selected
                      ? 'bg-primary-600 text-white shadow-glow'
                      : isToday
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/** "500000" -> "500 000" — mingliklar ajratilgan ko'rinish (faqat display). */
function formatThousands(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function Field({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon?: IconType;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
        {Icon && <Icon size={15} variant="Bulk" className="text-ink-muted" />}
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
