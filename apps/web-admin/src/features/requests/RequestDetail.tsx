import { useMemo, useState } from 'react';
import {
  Location,
  Calendar,
  CallCalling,
  Star1,
  Clock,
  MoneyRecive,
  Gallery,
  TickCircle,
  ArrowRight,
  Timer1,
  Danger,
  Hierarchy,
  UserTick,
  CloseCircle,
  SearchNormal1,
  Buildings2,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Modal } from '@/shared/ui/Modal';
import {
  CATEGORY_META,
  STATUS_META,
  deputyForCategory,
} from '@/shared/data/mock';
import { useRequests } from '@/shared/store/requests';
import { useWorkers } from '@/features/workers/useWorkers';
import type {
  CitizenRequest,
  Priority,
  RequestStatus,
  Worker,
  WorkerStatus,
} from '@/shared/data/types';
import { formatSom, formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { getDeadline, URGENCY_META } from './deadline';

const PRIORITY_META: Record<Priority, { label: string; tone: 'danger' | 'warning' | 'neutral' }> = {
  high: { label: 'Yuqori', tone: 'danger' },
  medium: { label: "O'rta", tone: 'warning' },
  low: { label: 'Past', tone: 'neutral' },
};

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star1
          key={n}
          size={16}
          variant={n <= value ? 'Bold' : 'Linear'}
          className={n <= value ? 'text-amber-400' : 'text-ink-muted'}
        />
      ))}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="flex items-center gap-2 text-[13px] text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

export function RequestDetail({
  request,
  onClose,
}: {
  request: CitizenRequest | null;
  onClose: () => void;
}) {
  const r = request;
  const { data: workersData } = useWorkers();
  const workers = workersData ?? [];
  const worker = workers.find((w) => w.id === r?.assignedWorkerId);
  const cat = r ? CATEGORY_META[r.category] : null;
  const deputy = r ? deputyForCategory(r.category) : undefined;
  const dl = r ? getDeadline(r) : null;
  const assignWorker = useRequests((s) => s.assignWorker);
  const unassignWorker = useRequests((s) => s.unassignWorker);
  const setStatus = useRequests((s) => s.setStatus);
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <Drawer open={!!r} onClose={onClose} title="Murojaat tafsilotlari" subtitle={r ? `#${r.id}` : undefined} width={500}>
      {r && cat && (
        <div className="space-y-5">
          {/* Header */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: `${cat.color}1a`, color: cat.color }}
              >
                {cat.label}
              </span>
              <Badge tone={PRIORITY_META[r.priority].tone}>{PRIORITY_META[r.priority].label}</Badge>
              <Badge tone={STATUS_META[r.status].tone} dot>
                {STATUS_META[r.status].label}
              </Badge>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink">{r.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{r.description}</p>
          </div>

          {/* Muddat / SLA */}
          {dl && (
            <div
              className={cn(
                'rounded-2xl border p-4',
                !dl.done && dl.urgency === 'overdue'
                  ? 'animate-pulse-danger border-red-300 bg-danger-soft'
                  : !dl.done && dl.urgency === 'critical'
                    ? 'border-orange-300 bg-orange-100'
                    : 'border-line bg-surface',
              )}
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <Timer1 size={16} variant="Bulk" className="text-ink-muted" /> Hal qilish muddati
                </p>
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold',
                    dl.done && dl.overdue
                      ? 'bg-danger-soft text-red-700'
                      : cn(URGENCY_META[dl.urgency].soft, URGENCY_META[dl.urgency].text),
                  )}
                >
                  {dl.done ? <TickCircle size={13} variant="Bold" /> : <Timer1 size={13} variant="Bold" />}
                  {dl.label}
                </span>
              </div>

              <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-surface-2 py-2.5">
                  <div className="text-lg font-bold text-ink">{dl.slaDays}</div>
                  <div className="text-[11px] text-ink-muted">kun ({cat?.label})</div>
                </div>
                <div className="rounded-xl bg-surface-2 py-2.5">
                  <div className="text-[13px] font-bold text-ink">{formatDate(dl.dueAt.toISOString())}</div>
                  <div className="text-[11px] text-ink-muted">tugash sanasi</div>
                </div>
                <div className="rounded-xl bg-surface-2 py-2.5">
                  <div
                    className="text-lg font-bold"
                    style={{ color: dl.done ? undefined : URGENCY_META[dl.urgency].color }}
                  >
                    {dl.done ? '—' : Math.abs(dl.daysLeft)}
                  </div>
                  <div className="text-[11px] text-ink-muted">
                    {dl.done ? 'yakunlangan' : dl.overdue ? 'kun kechikdi' : 'kun qoldi'}
                  </div>
                </div>
              </div>

              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.round(dl.progress * 100)}%`,
                    background: dl.done && dl.overdue ? '#ef4444' : URGENCY_META[dl.urgency].color,
                  }}
                />
              </div>

              {!dl.done && (dl.urgency === 'overdue' || dl.urgency === 'critical') && (
                <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-red-700">
                  <Danger size={14} variant="Bulk" />
                  {dl.urgency === 'overdue'
                    ? 'Murojaat muddati o‘tib ketgan — zudlik bilan hal qilish talab etiladi!'
                    : 'Muddat tugashiga oz qoldi — shoshilinch choralar ko‘ring!'}
                </p>
              )}
            </div>
          )}

          {/* Photos */}
          {r.photos.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Gallery size={16} variant="Bulk" className="text-ink-muted" /> Biriktirilgan rasmlar
              </p>
              <div className="grid grid-cols-3 gap-2">
                {r.photos.map((src, i) => (
                  <div key={i} className="aspect-square overflow-hidden rounded-xl border border-line bg-surface-2">
                    <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Citizen */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Murojaatchi</p>
            <div className="flex items-center gap-3">
              <Avatar src={r.citizenPhoto} name={r.citizenName} size={44} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{r.citizenName}</div>
                <a
                  href={`tel:${r.citizenPhone}`}
                  className="flex items-center gap-1.5 text-[13px] text-accent-600"
                >
                  <CallCalling size={14} variant="Bulk" /> {r.citizenPhone}
                </a>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Location size={16} variant="Bulk" className="text-ink-muted" /> Manzil
            </p>
            <p className="text-[13px] text-ink-soft">{r.address}</p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {r.region} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
            </p>
          </div>

          {/* Meta */}
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            <InfoRow
              icon={<Calendar size={15} variant="Bulk" className="text-ink-muted" />}
              label="Kelgan sana"
              value={formatDate(r.createdAt)}
            />
            {r.resolvedAt && (
              <InfoRow
                icon={<TickCircle size={15} variant="Bulk" className="text-primary-500" />}
                label="Hal qilingan"
                value={formatDate(r.resolvedAt)}
              />
            )}
            {r.responseHours != null && (
              <InfoRow
                icon={<Clock size={15} variant="Bulk" className="text-amber-500" />}
                label="Javob vaqti"
                value={`${r.responseHours} soat`}
              />
            )}
            <InfoRow
              icon={<MoneyRecive size={15} variant="Bulk" className="text-accent-500" />}
              label="Xarajat"
              value={r.cost > 0 ? formatSom(r.cost) : '—'}
            />
            {r.feedback != null && (
              <InfoRow
                icon={<Star1 size={15} variant="Bulk" className="text-amber-400" />}
                label="Fuqaro bahosi"
                value={<Stars value={r.feedback} />}
              />
            )}
          </div>

          {/* Responsible deputy (yo'nalish bo'yicha avtomatik) */}
          {deputy && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Hierarchy size={16} variant="Bulk" className="text-primary-600" /> Mas'ul hokim o'rinbosari
              </p>
              <div className="flex items-center gap-3">
                <Avatar src={deputy.photo} name={deputy.name} color={deputy.color} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{deputy.name}</div>
                  <div className="text-[12px] text-ink-muted">{deputy.shortDirection}</div>
                </div>
                <span
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                  style={{ background: `${cat.color}1a`, color: cat.color }}
                >
                  {cat.label}
                </span>
              </div>
              <p className="mt-2.5 text-[11.5px] text-ink-muted">
                Murojaat yo'nalishi bo'yicha avtomatik biriktirildi.
              </p>
            </div>
          )}

          {/* Assigned worker */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[13px] font-semibold text-ink">Mas'ul xodim</p>
              {worker && (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="text-[12px] font-medium text-primary-600 hover:underline"
                >
                  O'zgartirish
                </button>
              )}
            </div>
            {worker ? (
              <div className="flex items-center gap-3">
                <Avatar src={worker.photo} name={worker.name} color={worker.avatarColor} size={42} status={worker.status} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{worker.name}</div>
                  <div className="text-[12px] text-ink-muted">{worker.position}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="flex items-center gap-1 text-[13px] font-semibold text-amber-500">
                    <Star1 size={14} variant="Bold" /> {worker.rating.toFixed(1)}
                  </span>
                  <button
                    onClick={() => unassignWorker(r.id)}
                    className="flex items-center gap-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-danger"
                  >
                    <CloseCircle size={13} variant="Bulk" /> Olib tashlash
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPickerOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line py-2.5 text-[13px] font-medium text-primary-600 hover:bg-primary-50"
              >
                <UserTick size={16} variant="Bulk" /> Xodim biriktirish <ArrowRight size={14} />
              </button>
            )}
          </div>

          {/* Holatni o'zgartirish */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2.5 text-[13px] font-semibold text-ink">Holatni o'zgartirish</p>
            <div className="flex flex-wrap gap-1.5">
              {(['in_progress', 'resolved', 'rejected'] as RequestStatus[]).map((s) => {
                const active = r.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => setStatus(r.id, s)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-ink text-white'
                        : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    {s === 'resolved' && <TickCircle size={15} variant="Bulk" />}
                    {STATUS_META[s].label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2">
              Chop etish
            </button>
          </div>

          <WorkerPickerModal
            open={pickerOpen}
            request={r}
            currentId={r.assignedWorkerId}
            workers={workers}
            onClose={() => setPickerOpen(false)}
            onAssign={(workerId) => {
              assignWorker(r.id, workerId);
              setPickerOpen(false);
            }}
          />
        </div>
      )}
    </Drawer>
  );
}

/* ============================================================
   Xodim biriktirish oynasi (mos mutaxassis + hudud bo'yicha)
   ============================================================ */
const WORKER_STATUS_DOT: Record<WorkerStatus, { label: string; color: string }> = {
  online: { label: 'Onlayn', color: '#10b981' },
  on_task: { label: 'Vazifada', color: '#f59e0b' },
  break: { label: 'Tanaffus', color: '#94a3b8' },
  offline: { label: 'Oflayn', color: '#cbd5e1' },
};

function WorkerPickerModal({
  open,
  request,
  currentId,
  workers,
  onClose,
  onAssign,
}: {
  open: boolean;
  request: CitizenRequest;
  currentId: string | null;
  workers: Worker[];
  onClose: () => void;
  onAssign: (workerId: string) => void;
}) {
  const [q, setQ] = useState('');
  const cat = CATEGORY_META[request.category];

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const score = (w: Worker) =>
      (w.specialization.includes(request.category) ? 2 : 0) +
      (w.districtId === request.districtId ? 1 : 0);
    return workers
      .filter(
        (w) =>
          !needle ||
          w.name.toLowerCase().includes(needle) ||
          w.position.toLowerCase().includes(needle),
      )
      .slice()
      .sort((a, b) => score(b) - score(a) || b.rating - a.rating);
  }, [workers, q, request.category, request.districtId]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Xodim biriktirish"
      subtitle={`#${request.id} · ${cat.label}`}
      width={520}
    >
      <div className="relative mb-3">
        <SearchNormal1 size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Xodim qidirish..."
          autoFocus
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
        />
      </div>
      <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
        {list.map((w) => {
          const match = w.specialization.includes(request.category);
          const sameDistrict = w.districtId === request.districtId;
          const stt = WORKER_STATUS_DOT[w.status];
          const current = w.id === currentId;
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => onAssign(w.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                current
                  ? 'border-primary-300 bg-primary-50'
                  : 'border-line bg-surface hover:border-primary-200 hover:bg-surface-2',
              )}
            >
              <Avatar src={w.photo} name={w.name} color={w.avatarColor} size={40} status={w.status} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[14px] font-medium text-ink">{w.name}</span>
                  {match && (
                    <span
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold"
                      style={{ background: `${cat.color}1a`, color: cat.color }}
                    >
                      Mos mutaxassis
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-ink-muted">
                  <span className="truncate">{w.position}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: stt.color }} />
                    {stt.label}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-muted">
                  <Buildings2 size={12} variant="Bulk" /> {w.region}
                  {sameDistrict && <span className="font-medium text-primary-600">· shu hudud</span>}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="flex items-center gap-1 text-[12.5px] font-semibold text-amber-500">
                  <Star1 size={13} variant="Bold" /> {w.rating.toFixed(1)}
                </span>
                <span className="text-[11px] text-ink-muted">{w.activeTasks} faol</span>
                {current && <span className="text-[10.5px] font-semibold text-primary-600">Biriktirilgan</span>}
              </div>
            </button>
          );
        })}
        {list.length === 0 && (
          <p className="py-10 text-center text-sm text-ink-muted">Xodim topilmadi</p>
        )}
      </div>
    </Modal>
  );
}
