import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Video,
  VideoSlash,
  Location,
  Cpu,
  Activity,
  RotateLeft,
  RotateRight,
  Maximize4,
  Add,
  Camera as CameraIcon,
  Wifi,
  RecordCircle,
  ArrowUp2,
  ArrowDown,
  ArrowLeft2,
  ArrowRight2,
  CloseCircle,
  Trash,
} from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import type { Camera } from '@/shared/data/types';
import type { CamEvent } from './useLiveCameras';
import { EVENT_META, STATUS_LABEL, TYPE_LABEL } from './meta';

export function CameraDetail({
  cam,
  clock,
  events,
  onClose,
  onDelete,
}: {
  cam: Camera | null;
  clock: string;
  events: CamEvent[];
  onClose: () => void;
  /** Backendga DELETE /cameras/:id yuboradigan chaqiruvchi. */
  onDelete: (id: string) => Promise<void>;
}) {
  const [fps, setFps] = useState(25);
  const [bitrate, setBitrate] = useState(4.2);
  const [zoom, setZoom] = useState(1);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Live jitter — FPS / bitrate o'zgarib turadi
  useEffect(() => {
    if (!cam || cam.status !== 'online') return;
    const t = setInterval(() => {
      setFps(23 + Math.round(Math.random() * 7));
      setBitrate(Number((3.6 + Math.random() * 1.8).toFixed(1)));
    }, 1200);
    return () => clearInterval(t);
  }, [cam]);

  useEffect(() => {
    setZoom(1);
    setDeleteOpen(false);
    setDeleting(false);
    setDeleteError(null);
  }, [cam]);

  const online = cam?.status === 'online';
  const camEvents = cam ? events.filter((e) => e.camId === cam.id).slice(0, 8) : [];

  async function confirmDelete() {
    if (!cam) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(cam.id);
      setDeleteOpen(false);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Kamerani o'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  }

  return (
    <Modal open={!!cam} onClose={onClose} width={820} showClose={false}>
      {cam && (
        <div>
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-ink">{cam.name}</h2>
              <p className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                <Location size={14} /> {cam.region} · {TYPE_LABEL[cam.type]}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', STATUS_LABEL[cam.status].tone)}
              >
                {STATUS_LABEL[cam.status].label}
              </span>
              <button
                onClick={() => setDeleteOpen(true)}
                title="O'chirish"
                aria-label="Kamerani o'chirish"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash size={19} variant="Bulk" />
              </button>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <CloseCircle size={22} variant="Bulk" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            {/* Live feed */}
            <div>
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-line bg-slate-950">
                <div
                  className="absolute inset-0 transition-transform duration-300"
                  style={{
                    transform: `scale(${zoom})`,
                    background: online
                      ? 'radial-gradient(120% 120% at 30% 20%, #1e3a5f, #020617 75%)'
                      : 'linear-gradient(135deg,#1e293b,#020617)',
                  }}
                />
                {/* scanlines */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-25"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0px, rgba(255,255,255,.06) 1px, transparent 1px, transparent 3px)',
                  }}
                />

                {online ? (
                  <>
                    {/* REC + LIVE */}
                    <div className="absolute left-3 top-3 flex items-center gap-2">
                      <span className="flex items-center gap-1.5 rounded-md bg-black/50 px-2 py-1 backdrop-blur">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        <span className="text-[10px] font-bold tracking-wider text-white">LIVE</span>
                      </span>
                    </div>
                    <div className="absolute right-3 top-3 rounded-md bg-black/50 px-2 py-1 font-mono text-[11px] text-white backdrop-blur">
                      {clock}
                    </div>

                    {/* moving detection boxes */}
                    <motion.div
                      className="absolute rounded border-2 border-emerald-400/80"
                      style={{ width: 64, height: 84 }}
                      animate={{
                        left: ['18%', '52%', '34%', '18%'],
                        top: ['30%', '40%', '58%', '30%'],
                      }}
                      transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-emerald-400 px-1 text-[9px] font-bold text-slate-900">
                        Shaxs 98%
                      </span>
                    </motion.div>
                    <motion.div
                      className="absolute rounded border-2 border-amber-400/80"
                      style={{ width: 92, height: 56 }}
                      animate={{
                        left: ['60%', '30%', '64%', '60%'],
                        top: ['62%', '55%', '38%', '62%'],
                      }}
                      transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-amber-400 px-1 text-[9px] font-bold text-slate-900">
                        Avto
                      </span>
                    </motion.div>

                    <div className="absolute inset-0 flex items-center justify-center text-white/10">
                      <Video size={84} variant="Bulk" />
                    </div>

                    {/* bottom bar */}
                    <div className="absolute inset-x-3 bottom-3 flex items-center justify-between">
                      <span className="flex items-center gap-1 rounded-md bg-black/50 px-2 py-1 text-[10px] text-white backdrop-blur">
                        <Activity size={11} /> {cam.detections24h} aniqlash (24s)
                      </span>
                      <span className="rounded-md bg-black/50 px-2 py-1 font-mono text-[10px] text-emerald-300 backdrop-blur">
                        {cam.resolution} · {fps} FPS · {bitrate} Mbps
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
                    <VideoSlash size={52} variant="Bulk" />
                    <span className="text-sm font-medium">
                      {cam.status === 'maintenance' ? 'Texnik xizmatda' : 'Signal yo‘q'}
                    </span>
                  </div>
                )}
              </div>

              {/* Controls */}
              <div className="mt-3 flex items-center justify-between gap-3">
                {/* PTZ */}
                <div className="flex items-center gap-2">
                  {cam.type === 'ptz' ? (
                    <>
                      <div className="grid grid-cols-3 grid-rows-3 gap-0.5">
                        <span />
                        <PtzBtn icon={ArrowUp2} disabled={!online} />
                        <span />
                        <PtzBtn icon={ArrowLeft2} disabled={!online} />
                        <span className="flex items-center justify-center">
                          <RotateRight size={14} className="text-ink-muted" />
                        </span>
                        <PtzBtn icon={ArrowRight2} disabled={!online} />
                        <span />
                        <PtzBtn icon={ArrowDown} disabled={!online} />
                        <span />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <PtzBtn icon={RotateLeft} disabled={!online} />
                        <PtzBtn icon={RotateRight} disabled={!online} />
                      </div>
                    </>
                  ) : (
                    <span className="text-[12px] text-ink-muted">PTZ qo'llab-quvvatlanmaydi</span>
                  )}
                </div>

                {/* Zoom + actions */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setZoom((z) => Math.max(1, +(z - 0.2).toFixed(1)))}
                    disabled={!online}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Add size={18} className="rotate-45" />
                  </button>
                  <span className="w-10 text-center font-mono text-[12px] text-ink-soft">{zoom.toFixed(1)}x</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(1)))}
                    disabled={!online}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-40"
                  >
                    <Add size={18} />
                  </button>
                  <button
                    disabled={!online}
                    className="ml-1 flex h-9 items-center gap-1.5 rounded-lg bg-primary-600 px-3 text-[13px] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
                  >
                    <CameraIcon size={16} variant="Bulk" /> Snapshot
                  </button>
                </div>
              </div>
            </div>

            {/* Side: stats + events */}
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <Stat icon={Wifi} label="Uptime" value={`${cam.uptime}%`} tint="#10b981" />
                <Stat icon={Cpu} label="Turi" value={TYPE_LABEL[cam.type]} tint="#6366f1" />
                <Stat icon={Activity} label="Aniqlash" value={String(cam.detections24h)} tint="#a855f7" />
                <Stat icon={RecordCircle} label="Yozuv" value={cam.recording ? 'Yoqilgan' : "O'chiq"} tint="#ef4444" />
              </div>

              <div className="flex-1 rounded-2xl border border-line bg-surface-2 p-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <Activity size={15} variant="Bulk" className="text-primary-600" /> Jonli hodisalar
                </h4>
                <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {camEvents.length === 0 && (
                      <p className="py-6 text-center text-[12px] text-ink-muted">
                        Hodisalar kutilmoqda...
                      </p>
                    )}
                    {camEvents.map((e) => {
                      const m = EVENT_META[e.kind];
                      return (
                        <motion.div
                          key={e.id}
                          initial={{ opacity: 0, x: 12 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-center gap-2 rounded-lg bg-surface px-2.5 py-2"
                        >
                          <span
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                            style={{ background: `${m.color}1a`, color: m.color }}
                          >
                            <m.icon size={15} variant="Bulk" />
                          </span>
                          <span className="flex-1 truncate text-[12px] text-ink-soft">{e.label}</span>
                          <span className="shrink-0 text-[10px] text-ink-muted">{timeAgo(new Date(e.at).toISOString())}</span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>

              <button className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2">
                <Maximize4 size={16} /> To'liq ekran arxivi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* O'chirish tasdiqi */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Kamerani o'chirasizmi?"
        message={
          <>
            {cam && <>"{cam.name}" kamerasi monitoring tarmog'idan butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.</>}
            {deleteError && (
              <span role="alert" className="mt-2 block font-medium text-danger">
                {deleteError}
              </span>
            )}
          </>
        }
        confirmLabel="Ha, o'chirish"
        tone="danger"
        icon={Trash}
        loading={deleting}
      />
    </Modal>
  );
}

function PtzBtn({ icon: Icon, disabled }: { icon: typeof ArrowUp2; disabled?: boolean }) {
  return (
    <button
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:opacity-40"
    >
      <Icon size={15} />
    </button>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Wifi;
  label: string;
  value: string;
  tint: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${tint}1a`, color: tint }}>
        <Icon size={16} variant="Bulk" />
      </div>
      <div className="mt-2 truncate text-[14px] font-bold text-ink">{value}</div>
      <div className="text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}
