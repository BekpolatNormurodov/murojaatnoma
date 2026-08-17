import { useState, type ReactNode } from 'react';
import { Video, Scan, Cpu, RotateRight, Add, type Icon as IconType } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { cn } from '@/shared/lib/cn';
import { DISTRICTS } from '@/shared/data/mock';
import type { Camera, CameraType } from '@/shared/data/types';
import { TYPE_LABEL } from './meta';

const TYPE_OPTIONS: { key: CameraType; icon: IconType }[] = [
  { key: 'fixed', icon: Video },
  { key: 'ptz', icon: RotateRight },
  { key: 'anpr', icon: Scan },
  { key: 'thermal', icon: Cpu },
];

const RESOLUTIONS = ['4K', '1080p', '720p'];

export function AddCameraModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (cam: Camera) => void;
}) {
  const [name, setName] = useState('');
  const [districtId, setDistrictId] = useState(DISTRICTS[0]?.id ?? '');
  const [type, setType] = useState<CameraType>('fixed');
  const [resolution, setResolution] = useState('1080p');
  const [recording, setRecording] = useState(true);

  const valid = name.trim().length > 2 && districtId;

  function reset() {
    setName('');
    setDistrictId(DISTRICTS[0]?.id ?? '');
    setType('fixed');
    setResolution('1080p');
    setRecording(true);
  }

  function submit() {
    if (!valid) return;
    const district = DISTRICTS.find((d) => d.id === districtId);
    const [lat, lng] = district?.center ?? [41.31, 69.28];
    const jit = () => (Math.random() - 0.5) * 0.02;
    const cam: Camera = {
      id: `CAM-${Date.now().toString().slice(-5)}`,
      name: name.trim(),
      region: district?.name ?? '—',
      districtId,
      type,
      status: 'online',
      lat: +(lat + jit()).toFixed(5),
      lng: +(lng + jit()).toFixed(5),
      resolution,
      recording,
      uptime: +(97 + Math.random() * 2.8).toFixed(1),
      detections24h: 0,
      lastEvent: 'hozirgina',
      installedAt: new Date().toISOString(),
    };
    onCreate(cam);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Yangi kamera qo'shish" subtitle="Monitoring tarmog'iga yangi qurilma ulang" width={560}>
      <div className="space-y-4">
        <Field label="Kamera nomi">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Markaziy maydon — 03"
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary-300"
          />
        </Field>

        <Field label="Kamera turi">
          <div className="grid grid-cols-4 gap-2">
            {TYPE_OPTIONS.map((o) => {
              const active = type === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setType(o.key)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[11px] font-medium transition-colors',
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-700'
                      : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
                  )}
                >
                  <o.icon size={20} variant={active ? 'Bulk' : 'Linear'} />
                  <span className="text-center leading-tight">{TYPE_LABEL[o.key]}</span>
                </button>
              );
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tuman">
            <Select
              block
              value={districtId}
              onChange={setDistrictId}
              options={DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color }))}
            />
          </Field>
          <Field label="Sifat">
            <Select
              block
              value={resolution}
              onChange={setResolution}
              options={RESOLUTIONS.map((r) => ({ value: r, label: r }))}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center justify-between rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span className="text-[13px] font-medium text-ink-soft">Yozuvni darhol yoqish</span>
          <button
            type="button"
            onClick={() => setRecording((v) => !v)}
            className={cn(
              'relative h-6 w-11 rounded-full transition-colors',
              recording ? 'bg-primary-600' : 'bg-line',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
                recording ? 'left-5.5' : 'left-0.5',
              )}
            />
          </button>
        </label>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Bekor qilish
        </Button>
        <Button onClick={submit} disabled={!valid}>
          <Add size={18} /> Qo'shish
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</label>
      {children}
    </div>
  );
}
