import { useEffect, useId, useRef, useState } from 'react';
import { Camera, CloseCircle, Eye, EyeSlash, Magicpen, RotateRight, TickCircle, Trash } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Avatar } from '@/shared/ui/Avatar';
import { cn } from '@/shared/lib/cn';
import { foldSearch } from '@/shared/lib/translit';
import { useCreateEmployee, useUpdateEmployee, uploadPhoto, type EmployeeInput } from './useEmployeeMutations';
import type { OversightRow } from './useOversight';

/** "500000" -> "500 000" for the salary input. */
function group(d: string) {
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : '';
}

/** Auto-generated placeholder phones (not real numbers) — never pre-filled. */
function isPlaceholderPhone(phone: string): boolean {
  return /^\+99800\d{7}$/.test(phone) || /^\+99890000\d{4}$/.test(phone);
}

/** 9 local digits -> "90 123 45 67" (the +998 prefix is a fixed adornment). */
function formatLocalPhone(d: string): string {
  const p = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return p.join(' ');
}

/** "Ismoilov Xurshid Akmal o'g'li" -> "ismoilov_xurshid" (Cyrillic-safe). */
function suggestUsername(fullName: string): string {
  const words = foldSearch(fullName)
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  return words.slice(0, 2).join('_').slice(0, 32);
}

/** Keep only what the backend accepts: a-z, 0-9, _ (spaces -> _). */
function sanitizeUsername(v: string): string {
  return foldSearch(v).replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
}

function generatePassword(): string {
  // No look-alikes (0/O, 1/l/I) — it is read aloud / typed from paper.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint32Array(10);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

/**
 * Add / edit an employee (person) straight from Nazorat: photo, name, position,
 * worker-app login (username/password), phone and this month's BASE salary.
 * `row` null = create.
 */
export function EmployeeFormModal({
  row,
  open,
  year,
  month,
  positions = [],
  onClose,
  onDone,
}: {
  row: OversightRow | null;
  open: boolean;
  /** The month Nazorat is showing — the salary field reads/writes THIS month. */
  year: number;
  month: number;
  /** Existing positions — offered as suggestions in the Lavozim field. */
  positions?: string[];
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const editing = !!row;
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = useId();

  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [phone, setPhone] = useState(''); // 9 local digits
  const [username, setUsername] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
    const p = row?.phone ?? '';
    setPhone(p && !isPlaceholderPhone(p) && p.startsWith('+998') ? p.slice(4) : '');
    setUsername(row?.username ?? '');
    setUsernameTouched(!!row);
    setPassword('');
    setShowPassword(false);
    // BASE salary (amount), not net: net = amount + bonus − penalty.
    setSalary(row?.salaryBase != null ? String(row.salaryBase) : '');
    setAvatarUrl(row?.avatarUrl ?? null);
    setError(null);
    setTried(false);
    setSaving(false);
    setUploading(false);
  }, [open, row]);

  // Create: keep suggesting a login from the name until the admin edits it.
  useEffect(() => {
    if (!editing && !usernameTouched) setUsername(suggestUsername(fullName));
  }, [fullName, editing, usernameTouched]);

  const nameOk = fullName.trim().length >= 3;
  const posOk = position.trim().length >= 2;
  const userOk = editing && !username ? true : /^[a-z0-9_]{3,32}$/.test(username);
  const passOk = editing && !password ? true : password.length >= 6;
  const phoneOk = phone.length === 0 || phone.length === 9;
  const valid = nameOk && posOk && userOk && passOk && phoneOk;

  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Faqat rasm fayli (JPG/PNG) tanlang');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError('Rasm 8 MB dan oshmasin');
      return;
    }
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
    if (!valid || saving || uploading) return;
    setSaving(true);
    setError(null);
    const salaryNum = salary.trim() ? Number(salary) : null;
    const input: EmployeeInput = {
      fullName: fullName.trim().replace(/\s+/g, ' '),
      position: position.trim(),
      ...(phone.length === 9 ? { phone: `+998${phone}` } : {}),
      // Edit: only send login fields that actually changed.
      ...(username && username !== (row?.username ?? '') ? { username } : {}),
      ...(password ? { password } : {}),
      ...(avatarUrl !== (row?.avatarUrl ?? null) ? { avatarUrl } : {}),
      // Only touch EmployeeSalary when the amount actually changed.
      ...(salaryNum != null && salaryNum !== (row?.salaryBase ?? null)
        ? { salary: salaryNum, salaryYear: year, salaryMonth: month }
        : {}),
    };
    try {
      if (editing && row) {
        await update.mutateAsync({ id: row.employeeId, ...input });
        onDone(`${input.fullName} — o'zgarishlar saqlandi`);
      } else {
        await create.mutateAsync(input);
        onDone(`${input.fullName} qo'shildi · login: ${username}`);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  const fid = (k: string) => `${ids}-${k}`;

  return (
    <Modal
      open={open}
      onClose={saving ? () => {} : onClose}
      title={editing ? 'Xodimni tahrirlash' : "Yangi xodim qo'shish"}
      subtitle={editing ? row?.fullName : "Ism, lavozim, ilovaga kirish ma'lumotlari, rasm va oylik"}
      width={560}
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-5"
      >
        {/* Rasm */}
        <div className="flex items-center gap-4">
          <Avatar name={fullName || '—'} src={avatarUrl ?? undefined} size={64} />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickPhoto} />
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <RotateRight size={16} className="animate-spin" /> : <Camera size={16} />}
              {uploading ? 'Yuklanmoqda…' : avatarUrl ? "Rasmni almashtirish" : 'Rasm yuklash'}
            </Button>
            {avatarUrl && !uploading && (
              <Button type="button" variant="ghost" onClick={() => setAvatarUrl(null)} aria-label="Rasmni olib tashlash">
                <Trash size={16} /> Olib tashlash
              </Button>
            )}
          </div>
        </div>

        <Section title="Shaxsiy ma'lumot">
          <Field id={fid('name')} label="F.I.Sh." required error={tried && !nameOk ? "Kamida 3 harf" : undefined}>
            <Inp id={fid('name')} value={fullName} onChange={setFullName} placeholder="Ismoilov Xurshid Akmal o'g'li" invalid={tried && !nameOk} autoComplete="off" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field id={fid('pos')} label="Lavozim" required error={tried && !posOk ? 'Lavozimni kiriting' : undefined}>
              <Inp id={fid('pos')} value={position} onChange={setPosition} placeholder="Bosh mutaxassis" invalid={tried && !posOk} list={fid('pos-list')} />
              <datalist id={fid('pos-list')}>
                {positions.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field id={fid('phone')} label="Telefon" hint="Ixtiyoriy" error={tried && !phoneOk ? "9 ta raqam: 90 123 45 67" : undefined}>
              <div className={cn('flex h-11 items-center rounded-xl border bg-surface-2 focus-within:bg-surface', tried && !phoneOk ? 'border-danger' : 'border-line focus-within:border-primary-300')}>
                <span className="pl-4 pr-1 text-sm font-medium text-ink-muted">+998</span>
                <input
                  id={fid('phone')}
                  inputMode="tel"
                  autoComplete="tel-national"
                  value={formatLocalPhone(phone)}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').replace(/^998/, '').slice(0, 9))}
                  placeholder="90 123 45 67"
                  className="h-full min-w-0 flex-1 bg-transparent pr-4 text-sm tabular-nums text-ink outline-none placeholder:text-ink-muted"
                />
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Ilovaga kirish (Hokimiyat Xodim)">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              id={fid('user')}
              label="Login (username)"
              required={!editing}
              hint={!editing && !usernameTouched && username ? 'Ismdan avtomatik' : undefined}
              error={tried && !userOk ? '3–32 ta: a-z, 0-9, _' : undefined}
            >
              <Inp
                id={fid('user')}
                value={username}
                onChange={(v) => {
                  setUsernameTouched(true);
                  setUsername(sanitizeUsername(v));
                }}
                placeholder="ismoilov_xurshid"
                invalid={tried && !userOk}
                autoComplete="off"
                spellCheck={false}
              />
            </Field>
            <Field
              id={fid('pass')}
              label={editing ? 'Yangi parol' : 'Parol'}
              required={!editing}
              hint={editing ? "O'zgartirmaslik uchun bo'sh qoldiring" : undefined}
              error={tried && !passOk ? 'Kamida 6 belgi' : undefined}
            >
              <div className={cn('flex h-11 items-center rounded-xl border bg-surface-2 focus-within:bg-surface', tried && !passOk ? 'border-danger' : 'border-line focus-within:border-primary-300')}>
                <input
                  id={fid('pass')}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editing ? '••••••' : 'Kamida 6 belgi'}
                  autoComplete="new-password"
                  className="h-full min-w-0 flex-1 bg-transparent pl-4 text-sm text-ink outline-none placeholder:text-ink-muted"
                />
                <IconBtn label={showPassword ? 'Parolni yashirish' : "Parolni ko'rsatish"} onClick={() => setShowPassword((v) => !v)}>
                  {showPassword ? <EyeSlash size={17} /> : <Eye size={17} />}
                </IconBtn>
                <IconBtn
                  label="Parol yaratish"
                  onClick={() => {
                    setPassword(generatePassword());
                    setShowPassword(true);
                  }}
                >
                  <Magicpen size={17} />
                </IconBtn>
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Oylik">
          <Field id={fid('salary')} label={`${month.toString().padStart(2, '0')}.${year} oyi uchun asosiy oylik`} hint="Premya va ushlanmalar alohida hisoblanadi">
            <div className="relative">
              <input
                id={fid('salary')}
                inputMode="numeric"
                value={group(salary)}
                onChange={(e) => setSalary(e.target.value.replace(/\D/g, '').slice(0, 12))}
                placeholder="6 000 000"
                className="h-11 w-full rounded-xl border border-line bg-surface-2 px-4 pr-14 text-sm font-semibold tabular-nums text-ink outline-none focus:border-primary-300 focus:bg-surface"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink-muted">so'm</span>
            </div>
          </Field>
        </Section>

        {error && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-danger-soft p-3 text-[13px] font-medium text-red-700">
            <CloseCircle size={18} variant="Bulk" className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Bekor qilish
          </Button>
          <Button type="submit" disabled={saving || uploading}>
            {saving ? <RotateRight size={18} className="animate-spin" /> : <TickCircle size={18} />}
            {saving ? 'Saqlanmoqda…' : editing ? 'Saqlash' : "Qo'shish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-ink-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[13px] font-medium text-ink-soft">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </label>
        {hint && !error && hint.length <= 18 && (
          <span className="shrink-0 text-[11.5px] text-ink-muted">{hint}</span>
        )}
      </div>
      {children}
      {/* Longer hints go under the input so they never squeeze the label. */}
      {hint && !error && hint.length > 18 && <p className="mt-1.5 text-[11.5px] text-ink-muted">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function Inp({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  list,
  autoComplete,
  spellCheck,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  invalid?: boolean;
  list?: string;
  autoComplete?: string;
  spellCheck?: boolean;
}) {
  return (
    <input
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      list={list}
      autoComplete={autoComplete}
      spellCheck={spellCheck}
      aria-invalid={invalid || undefined}
      className={cn(
        'h-11 w-full rounded-xl border bg-surface-2 px-4 text-sm text-ink outline-none placeholder:text-ink-muted focus:bg-surface',
        invalid ? 'border-danger' : 'border-line focus:border-primary-300',
      )}
    />
  );
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition-colors hover:bg-surface-2 hover:text-primary-600"
    >
      {children}
    </button>
  );
}
