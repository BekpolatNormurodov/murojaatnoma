import { useEffect, useState } from 'react';
import { Add, CloseCircle, Money, NoteText, RotateRight, TickCircle, Wallet3 } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import type { SalaryRosterRow } from './useSalaries';
import type { UpsertSalaryInput } from './useSalaryMutations';

/** "500000" -> "500 000" — display only (thousands separated). */
function group(digits: string): string {
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

/**
 * Oylik maoshni belgilash/tahrirlash. Xodim va oy ustidan (parent'dan) keladi;
 * bu yerda faqat asosiy summa + ustama (bonus) + ushlanma (penalty) + izoh
 * kiritiladi. Sof summa (net) real vaqtda ko'rsatiladi. PUT /salaries (upsert).
 */
export function SalaryFormModal({
  open,
  onClose,
  onSubmit,
  row,
  year,
  month,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: UpsertSalaryInput) => Promise<unknown>;
  row: SalaryRosterRow | null;
  year: number;
  month: number;
}) {
  const editing = !!row?.salary;
  const [amount, setAmount] = useState('');
  const [bonus, setBonus] = useState('');
  const [penalty, setPenalty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = row?.salary;
    setAmount(s ? String(s.amount) : '');
    setBonus(s && s.bonus ? String(s.bonus) : '');
    setPenalty(s && s.penalty ? String(s.penalty) : '');
    setNote(s?.note ?? '');
    setSaving(false);
    setError(null);
    setSubmitAttempted(false);
  }, [open, row]);

  const amountNum = Number(amount || 0);
  const bonusNum = Number(bonus || 0);
  const penaltyNum = Number(penalty || 0);
  const net = amountNum + bonusNum - penaltyNum;
  const amountValid = amount.trim() !== '' && Number.isFinite(amountNum) && amountNum > 0;
  // Ushlanma (jarima) asosiy + ustamadan oshib ketmasligi kerak — aks holda
  // sof to'lov manfiy bo'lib qoladi.
  const netValid = net >= 0;

  async function submit() {
    setSubmitAttempted(true);
    if (!amountValid || !netValid || saving || !row) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        employeeId: row.employeeId,
        year,
        month,
        amount: Math.round(amountNum),
        bonus: Math.round(bonusNum),
        penalty: Math.round(penaltyNum),
        note: note.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Oylikni saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  if (!row) return null;

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose()}
      title={editing ? 'Oylikni tahrirlash' : 'Oylik belgilash'}
      subtitle={`${row.fullName} — ${MONTHS[month - 1]} ${year}`}
      width={480}
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3.5 text-[13px] font-medium text-red-700">
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <MoneyField label="Asosiy oylik (so'm)" icon={Wallet3} value={amount} onChange={setAmount} placeholder="6 000 000" invalid={submitAttempted && !amountValid} />
        {submitAttempted && !amountValid && (
          <p role="alert" className="-mt-2 text-[12px] font-medium text-danger">Musbat summa kiriting</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <MoneyField label="Ustama (bonus)" icon={Add} value={bonus} onChange={setBonus} placeholder="0" />
          <MoneyField label="Ushlanma (jarima)" icon={Money} value={penalty} onChange={setPenalty} placeholder="0" />
        </div>

        {/* Sof summa (net) — jonli; manfiy bo'lsa ogohlantiradi */}
        <div
          className={cn(
            'flex items-center justify-between rounded-xl border px-4 py-3',
            netValid ? 'border-primary-300 bg-primary-50' : 'border-red-300 bg-danger-soft',
          )}
        >
          <span className={cn('text-[13px] font-semibold', netValid ? 'text-primary-700' : 'text-red-700')}>Sof to'lov</span>
          <span className={cn('text-[20px] font-bold tabular-nums', netValid ? 'text-primary-700' : 'text-red-700')}>
            {net < 0 ? '−' : ''}{group(String(Math.abs(net)))} <span className="text-sm font-semibold">so'm</span>
          </span>
        </div>
        {submitAttempted && !netValid && (
          <p role="alert" className="-mt-2 text-[12px] font-medium text-danger">
            Ushlanma asosiy + ustamadan oshib ketdi — sof to'lov manfiy bo'lib qoldi
          </p>
        )}

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
            <NoteText size={15} variant="Bulk" className="text-ink-muted" /> Izoh (ixtiyoriy)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Masalan: KPI ustamasi bilan"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface"
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => !saving && onClose()} disabled={saving}>Bekor qilish</Button>
          <Button onClick={submit} disabled={saving || !netValid}>
            {saving ? <RotateRight size={18} className="animate-spin" /> : <TickCircle size={18} />}
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MoneyField({
  label,
  icon: Icon,
  value,
  onChange,
  placeholder,
  invalid = false,
}: {
  label: string;
  icon: typeof Wallet3;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
        <Icon size={15} variant="Bulk" className="text-ink-muted" /> {label}
      </label>
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={group(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
          placeholder={placeholder}
          className={cn(
            'h-11 w-full rounded-xl border bg-surface-2 px-4 pr-12 text-sm font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-muted focus:bg-surface',
            invalid ? 'border-danger' : 'border-line focus:border-primary-300',
          )}
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted">so'm</span>
      </div>
    </div>
  );
}
