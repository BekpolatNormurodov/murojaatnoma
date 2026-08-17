import { useState } from 'react';
import { Add, Location, Profile, Call } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Select } from '@/shared/ui/Select';
import { CATEGORY_META, DISTRICTS } from '@/shared/data/mock';
import type { CitizenRequest, Priority, RequestCategory } from '@/shared/data/types';
import { cn } from '@/shared/lib/cn';

const CATEGORY_OPTIONS = (Object.keys(CATEGORY_META) as RequestCategory[]).map((c) => ({
  value: c,
  label: CATEGORY_META[c].label,
  dot: CATEGORY_META[c].color,
}));

const DISTRICT_OPTIONS = DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color }));

const PRIORITY_OPTIONS: { value: Priority; label: string; dot: string }[] = [
  { value: 'high', label: 'Yuqori', dot: '#ef4444' },
  { value: 'medium', label: "O'rta", dot: '#f59e0b' },
  { value: 'low', label: 'Past', dot: '#94a3b8' },
];

const fieldCls =
  'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary-300';

export function AddRequestModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (r: Omit<CitizenRequest, 'id'>) => void;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<RequestCategory>('kommunal');
  const [districtId, setDistrictId] = useState(DISTRICTS[0].id);
  const [address, setAddress] = useState('');
  const [citizenName, setCitizenName] = useState('');
  const [citizenPhone, setCitizenPhone] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [description, setDescription] = useState('');

  const valid =
    title.trim().length > 3 && citizenName.trim().length > 1 && address.trim().length > 1;

  function reset() {
    setTitle('');
    setCategory('kommunal');
    setDistrictId(DISTRICTS[0].id);
    setAddress('');
    setCitizenName('');
    setCitizenPhone('');
    setPriority('medium');
    setDescription('');
  }

  function submit() {
    if (!valid) return;
    const district = DISTRICTS.find((d) => d.id === districtId) ?? DISTRICTS[0];
    const payload: Omit<CitizenRequest, 'id'> = {
      title: title.trim(),
      description: description.trim() || title.trim(),
      category,
      status: 'new',
      region: district.name,
      districtId: district.id,
      address: address.trim(),
      citizenName: citizenName.trim(),
      citizenPhone: citizenPhone.trim() || '+998 90 000 00 00',
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
    onCreate(payload);
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Murojaat qo'shish"
      subtitle="Fuqaro murojaatini tizimga kiriting"
      width={560}
    >
      <div className="space-y-4">
        <Field label="Sarlavha">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Muammo qisqacha nomi"
            className={fieldCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategoriya">
            <Select value={category} onChange={setCategory} options={CATEGORY_OPTIONS} block />
          </Field>
          <Field label="Tuman">
            <Select value={districtId} onChange={setDistrictId} options={DISTRICT_OPTIONS} block />
          </Field>
        </div>

        <Field label="Manzil">
          <div className="relative">
            <Location
              size={16}
              variant="Bulk"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Ko'cha, uy raqami"
              className={cn(fieldCls, 'pl-9')}
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fuqaro F.I.O.">
            <div className="relative">
              <Profile
                size={16}
                variant="Bulk"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                value={citizenName}
                onChange={(e) => setCitizenName(e.target.value)}
                placeholder="Ism familiya"
                className={cn(fieldCls, 'pl-9')}
              />
            </div>
          </Field>
          <Field label="Telefon">
            <div className="relative">
              <Call
                size={16}
                variant="Bulk"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                value={citizenPhone}
                onChange={(e) => setCitizenPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className={cn(fieldCls, 'pl-9')}
              />
            </div>
          </Field>
        </div>

        <Field label="Muhimlik darajasi">
          <Select value={priority} onChange={setPriority} options={PRIORITY_OPTIONS} block />
        </Field>

        <Field label="Tavsif">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Muammo tafsiloti..."
            className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary-300"
          />
        </Field>

        <div className="flex gap-3 border-t border-line pt-4">
          <button
            onClick={submit}
            disabled={!valid}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-colors',
              valid ? 'bg-primary-600 shadow-glow hover:bg-primary-700' : 'cursor-not-allowed bg-ink-muted/40',
            )}
          >
            <Add size={18} /> Qo'shish
          </button>
          <button
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}
