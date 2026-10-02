import { useState } from 'react';
import { InfoCircle, RotateRight, UserRemove } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { useArchiveEmployee } from './useEmployeeMutations';

const REASONS = ["O'z xohishi bilan", 'Boshqa ishga o‘tdi', 'Shartnoma muddati tugadi', 'Intizomiy sabab'];

/**
 * Ishdan bo'shatish — o'chirish emas: xodim arxivga o'tadi, ilovaga kira
 * olmaydi, ro'yxatlardan yo'qoladi, lekin davomat, murojaat va oylik tarixi
 * saqlanadi. Ochiq murojaatlari bo'shatiladi (boshqasiga berish uchun).
 */
export function ArchiveEmployeeDialog({
  employee,
  onClose,
  onDone,
}: {
  employee: { id: string; fullName: string } | null;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const archive = useArchiveEmployee();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Har safar boshqa xodim uchun ochilganda maydon tozalanadi.
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if ((employee?.id ?? null) !== openedFor) {
    setOpenedFor(employee?.id ?? null);
    setReason('');
    setError(null);
  }

  async function submit() {
    if (!employee) return;
    setError(null);
    try {
      const res = await archive.mutateAsync({ id: employee.id, reason: reason.trim() || undefined });
      onDone(
        `${employee.fullName} ishdan bo'shatildi` +
          (res.releasedMurojaats ? ` · ${res.releasedMurojaats} ta ochiq murojaat bo'shatildi` : ''),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bajarib bo'lmadi");
    }
  }

  return (
    <Modal
      open={!!employee}
      onClose={archive.isPending ? () => {} : onClose}
      title="Ishdan bo'shatish"
      subtitle={employee?.fullName}
      width={460}
    >
      <div className="space-y-4">
        <div className="flex gap-2.5 rounded-xl bg-surface-2 p-3 text-[12.5px] text-ink-soft">
          <InfoCircle size={18} variant="Bulk" className="mt-0.5 shrink-0 text-primary-600" />
          <ul className="space-y-1">
            <li>Xodim ilovaga kira olmaydi va ro'yxatlardan yashiriladi.</li>
            <li>Davomat, murojaatlar va oylik tarixi saqlanadi — "Arxiv"dan qayta tiklash mumkin.</li>
            <li>Ochiq murojaatlari mas'ulsiz qoladi — boshqa xodimga biriktiring.</li>
          </ul>
        </div>

        <div>
          <label htmlFor="archive-reason" className="mb-1.5 block text-[13px] font-medium text-ink-soft">
            Sabab <span className="font-normal text-ink-muted">(ixtiyoriy)</span>
          </label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                aria-pressed={reason === r}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[12px] transition-colors',
                  reason === r
                    ? 'border-primary-300 bg-primary-50 text-primary-700'
                    : 'border-line text-ink-soft hover:bg-surface-2',
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            id="archive-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="Masalan: buyruq №45, 01.10.2026"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-2.5 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-primary-300 focus:bg-surface"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-[13px] font-medium text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={archive.isPending}>
            Bekor qilish
          </Button>
          <Button variant="danger" onClick={() => void submit()} disabled={archive.isPending}>
            {archive.isPending ? <RotateRight size={17} className="animate-spin" /> : <UserRemove size={17} />}
            Ishdan bo'shatish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
