import { useEffect, useRef, useState } from 'react';
import { Camera, CloseCircle, RotateRight, TickCircle } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { cn } from '@/shared/lib/cn';
import { useCreateEmployee, useUpdateEmployee, uploadPhoto, type EmployeeInput } from './useEmployeeMutations';
import type { OversightRow } from './useOversight';

/** "500000" -> "500 000" for the salary input. */
function group(d: string) {
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
}

/**
 * Add / edit an employee (person) straight from Nazorat: photo, name, position,
 * worker-app login (username/password) and this-month salary. `row` null = create.
 */
export function EmployeeFormModal({
  row,
  open,
  onClose,
  onDone,
}: {
  row: OversightRow | null;
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const editing = !!row;
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const fileRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [salary, setSalary] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(row?.fullName ?? '');
    setPosition(row?.position ?? '');
    setPhone('');
    setUsername('');
    setPassword('');
    setSalary(row?.salaryNet != null ? String(row.salaryNet) : '');
    setAvatarUrl(row?.avatarUrl ?? null);
    setError(null);
    setTried(false);
    setSaving(false);
    setUploading(false);
  }, [open, row]);

  const nameOk = fullName.trim().length >= 3;
  const posOk = position.trim().length > 0;
  const userOk = editing || /^[a-z0-9_]+$/.test(username.trim());
  const passOk = editing || password.trim().length >= 4;
  const valid = nameOk && posOk && userOk && passOk;

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(await uploadPhoto(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rasmni yuklab bo'lmadi");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setTried(true);
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    const input: EmployeeInput = {
      fullName: fullName.trim(),
      position: position.trim(),
      ...(phone.trim() ? { phone: phone.trim() } : {}),
      ...(username.trim() ? { username: username.trim() } : {}),
      ...(password.trim() ? { password: password.trim() } : {}),
      ...(avatarUrl ? { avatarUrl } : {}),
      ...(salary.trim() ? { salary: Number(salary) } : {}),
    };
    try {
      if (editing && row) {
        await update.mutateAsync({ id: row.employeeId, ...input });
        onDone(`${input.fullName} yangilandi`);
      } else {
        await create.mutateAsync(input);
        onDone(`${input.fullName} qo'shildi (login: ${input.username})`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={editing ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}
      subtitle={editing ? row?.fullName : 'Ism, lavozim, login, rasm va oylik'}
      width={520}
    >
      <div className="space-y-4">
        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3 text-[13px] font-medium text-red-700">
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Photo */}
        <div className="flex items-center gap-4">
          <Avatar name={fullName || '—'} src={avatarUrl ?? undefined} size={64} />
          <div>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <RotateRight size={16} className="animate-spin" /> : <Camera size={16} />}
              {uploading ? 'Yuklanmoqda...' : avatarUrl ? "Rasmni o'zgartirish" : 'Rasm yuklash'}
            </Button>
          </div>
        </div>

        <Field label="F.I.Sh." error={tried && !nameOk ? 'Kamida 3 harf' : undefined}>
          <Inp value={fullName} onChange={setFullName} placeholder="Ismoilov Xurshid" invalid={tried && !nameOk} />
        </Field>
        <Field label="Lavozim" error={tried && !posOk ? 'Lavozimni kiriting' : undefined}>
          <Inp value={position} onChange={setPosition} placeholder="Bosh mutaxassis" invalid={tried && !posOk} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={editing ? 'Username (yangi)' : 'Username'} error={tried && !userOk ? "faqat a-z, 0-9, _" : undefined}>
            <Inp value={username} onChange={(v) => setUsername(v.toLowerCase())} placeholder={editing ? "o'zgartirmaslik — bo'sh" : 'xurshid'} invalid={tried && !userOk} />
          </Field>
          <Field label={editing ? 'Parol (yangi)' : 'Parol'} error={tried && !passOk ? 'Kamida 4 belgi' : undefined}>
            <Inp value={password} onChange={setPassword} placeholder={editing ? "o'zgartirmaslik — bo'sh" : 'Parol123'} invalid={tried && !passOk} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon (ixtiyoriy)">
            <Inp value={phone} onChange={setPhone} placeholder="+998901234567" />
          </Field>
          <Field label="Oylik (so'm, ixtiyoriy)">
            <div className="relative">
              <input
                inputMode="numeric"
                value={group(salary)}
                onChange={(e) => setSalary(e.target.value.replace(/\D/g, ''))}
                placeholder="6 000 000"
                className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 pr-12 text-sm font-semibold tabular-nums text-ink outline-none focus:border-primary-300 focus:bg-surface"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">so'm</span>
            </div>
          </Field>
        </div>

        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Bekor qilish</Button>
          <Button onClick={submit} disabled={saving || uploading}>
            {saving ? <RotateRight size={18} className="animate-spin" /> : <TickCircle size={18} />}
            {saving ? 'Saqlanmoqda...' : editing ? 'Saqlash' : "Qo'shish"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
      {error && <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">{error}</p>}
    </div>
  );
}

function Inp({ value, onChange, placeholder, invalid }: { value: string; onChange: (v: string) => void; placeholder?: string; invalid?: boolean }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'h-11 w-full rounded-xl border bg-surface-2 px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
        invalid ? 'border-danger' : 'border-line focus:border-primary-300',
      )}
    />
  );
}
