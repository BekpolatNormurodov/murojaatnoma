import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Video,
  VideoSlash,
  Cpu,
  Activity,
  Location,
  Monitor,
  Maximize4,
  SearchNormal1,
  Add,
  Play,
  Pause,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { StatCard } from '@/shared/ui/StatCard';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Button } from '@/shared/ui/Button';
import { Select } from '@/shared/ui/Select';
import { DISTRICTS } from '@/shared/data/mock';
import type { Camera, CameraStatus } from '@/shared/data/types';
import { formatNumber, timeAgo } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { useLiveCameras } from './useLiveCameras';
import { EVENT_META, STATUS_LABEL, TYPE_LABEL } from './meta';
import { CameraDetail } from './CameraDetail';
import { AddCameraModal } from './AddCameraModal';

const DISTRICT_COLORS = DISTRICTS.reduce<Record<string, string>>((acc, d) => {
  acc[d.id] = d.color;
  return acc;
}, {});

function CameraTile({ cam, clock, onOpen }: { cam: Camera; clock: string; onOpen: () => void }) {
  const online = cam.status === 'online';
  const tint = DISTRICT_COLORS[cam.districtId] ?? '#3b82f6';
  return (
    <Card className="group cursor-pointer overflow-hidden p-0 transition-shadow hover:shadow-pop" onClick={onOpen}>
      {/* Feed */}
      <div className="relative aspect-video overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: online
              ? `radial-gradient(120% 120% at 30% 20%, ${tint}55, #0f172a 70%)`
              : 'linear-gradient(135deg,#1e293b,#0f172a)',
          }}
        />
        {/* scanlines */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(255,255,255,.06) 0px, rgba(255,255,255,.06) 1px, transparent 1px, transparent 3px)',
          }}
        />

        {online ? (
          <>
            {/* REC */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded-md bg-black/40 px-2 py-1 backdrop-blur">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[10px] font-bold tracking-wider text-white">REC</span>
            </div>
            {/* time */}
            <div className="absolute right-2.5 top-2.5 rounded-md bg-black/40 px-2 py-1 font-mono text-[10px] text-white backdrop-blur">
              {clock}
            </div>
            {/* detections */}
            <motion.div
              key={cam.detections24h}
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.12, 1] }}
              transition={{ duration: 0.4 }}
              className="absolute bottom-2.5 left-2.5 flex items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[10px] text-white backdrop-blur"
            >
              <Activity size={11} /> {cam.detections24h} aniqlash
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center text-white/15">
              <Video size={56} variant="Bulk" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-slate-500">
            <VideoSlash size={40} variant="Bulk" />
            <span className="text-[11px] font-medium">
              {cam.status === 'maintenance' ? 'Texnik xizmatda' : 'Signal yo‘q'}
            </span>
          </div>
        )}

        {/* hover expand */}
        <span className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
          <Maximize4 size={14} />
        </span>
      </div>

      {/* Meta */}
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[14px] font-semibold text-ink">{cam.name}</h3>
            <p className="flex items-center gap-1 text-[11px] text-ink-muted">
              <Location size={11} /> {cam.region}
            </p>
          </div>
          <span
            className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold', STATUS_LABEL[cam.status].tone)}
          >
            {STATUS_LABEL[cam.status].label}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface-2 py-1.5">
            <div className="text-[12px] font-bold text-ink">{cam.resolution}</div>
            <div className="text-[10px] text-ink-muted">Sifat</div>
          </div>
          <div className="rounded-lg bg-surface-2 py-1.5">
            <div className="text-[12px] font-bold text-ink">{cam.uptime}%</div>
            <div className="text-[10px] text-ink-muted">Uptime</div>
          </div>
          <div className="rounded-lg bg-surface-2 py-1.5">
            <div className="truncate text-[12px] font-bold text-ink">{cam.id}</div>
            <div className="text-[10px] text-ink-muted">ID</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[11px]">
          <span className="flex items-center gap-1 text-ink-soft">
            <Cpu size={13} className="text-ink-muted" /> {TYPE_LABEL[cam.type]}
          </span>
          <span className="text-ink-muted">{cam.lastEvent ?? '—'}</span>
        </div>
      </div>
    </Card>
  );
}

export function CamerasPage() {
  const [status, setStatus] = useState<CameraStatus | 'all'>('all');
  const [district, setDistrict] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [clock, setClock] = useState('');
  const [live, setLive] = useState(true);
  const [selected, setSelected] = useState<Camera | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const { cameras, events, addCamera } = useLiveCameras(live);

  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      const p = (n: number) => (n < 10 ? `0${n}` : `${n}`);
      setClock(`${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`);
    };
    fmt();
    const t = setInterval(fmt, 1000);
    return () => clearInterval(t);
  }, []);

  // tanlangan kamera jonli yangilanib tursin
  const selectedLive = selected ? cameras.find((c) => c.id === selected.id) ?? selected : null;

  const online = cameras.filter((c) => c.status === 'online').length;
  const offline = cameras.filter((c) => c.status === 'offline').length;
  const maint = cameras.filter((c) => c.status === 'maintenance').length;
  const detections = cameras.reduce((s, c) => s + c.detections24h, 0);
  const avgUptime = (cameras.reduce((s, c) => s + c.uptime, 0) / cameras.length).toFixed(1);

  const filtered = useMemo(
    () =>
      cameras.filter((c) => {
        const s = status === 'all' || c.status === status;
        const d = district === 'all' || c.districtId === district;
        const q = !query || c.name.toLowerCase().includes(query.toLowerCase());
        return s && d && q;
      }),
    [cameras, status, district, query],
  );

  const STATUS_FILTERS: { key: CameraStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'Barchasi' },
    { key: 'online', label: 'Onlayn' },
    { key: 'maintenance', label: 'Texnik xizmat' },
    { key: 'offline', label: 'Oflayn' },
  ];

  return (
    <div>
      <PageHeader
        title="Kuzatuv kameralari"
        subtitle="Shahar bo'ylab CCTV monitoring — jonli holat, uptime va hodisalar"
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLive((v) => !v)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors',
                live
                  ? 'border-primary-200 bg-success-soft text-primary-700'
                  : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {live ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-70" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-600" />
                  </span>
                  Jonli efir
                </>
              ) : (
                <>
                  <Play size={16} variant="Bulk" /> To‘xtatilgan
                </>
              )}
            </button>
            <Button onClick={() => setAddOpen(true)}>
              <Add size={18} /> Kamera qo‘shish
            </Button>
          </div>
        }
      />

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard icon={Video} label="Onlayn" value={`${online}/${cameras.length}`} tint="#10b981" index={0} />
        <StatCard icon={VideoSlash} label="Oflayn" value={String(offline)} tint="#ef4444" index={1} />
        <StatCard icon={Cpu} label="Texnik xizmat" value={String(maint)} tint="#f59e0b" index={2} />
        <StatCard icon={Activity} label="Aniqlash (24s)" value={formatNumber(detections)} tint="#a855f7" index={3} />
        <StatCard icon={Monitor} label="O'rtacha uptime" value={`${avgUptime}%`} tint="#3b82f6" index={4} />
      </div>

      {/* Filters */}
      <div className="mt-5 mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatus(f.key)}
              className={cn(
                'rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
                status === f.key
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Select
            value={district}
            onChange={setDistrict}
            options={[
              { value: 'all', label: 'Barcha tumanlar' },
              ...DISTRICTS.map((d) => ({ value: d.id, label: d.name, dot: d.color })),
            ]}
          />
          <div className="relative w-full lg:w-56">
            <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kamera qidirish..."
              className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
            />
          </div>
        </div>
      </div>

      {/* Grid + live feed */}
      <div className="grid gap-5 xl:grid-cols-[1fr_330px]">
        <div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((cam, i) => (
              <motion.div
                key={cam.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.4) }}
              >
                <CameraTile cam={cam} clock={clock} onOpen={() => setSelected(cam)} />
              </motion.div>
            ))}
          </div>
          {filtered.length === 0 && (
            <div className="py-20 text-center text-ink-muted">Kamera topilmadi</div>
          )}
        </div>

        {/* Live events feed */}
        <aside className="xl:sticky xl:top-4 xl:self-start">
          <Card className="p-0">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <Activity size={17} variant="Bulk" className="text-primary-600" /> Jonli hodisalar
              </h3>
              {live ? (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-primary-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-500 opacity-70" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary-600" />
                  </span>
                  Efirda
                </span>
              ) : (
                <button
                  onClick={() => setLive(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                >
                  <Pause size={13} variant="Bulk" /> Pauza
                </button>
              )}
            </div>
            <div className="max-h-140 space-y-1.5 overflow-y-auto p-2.5">
              <AnimatePresence initial={false}>
                {events.length === 0 && (
                  <p className="py-12 text-center text-[12px] text-ink-muted">
                    {live ? 'Hodisalar kutilmoqda...' : 'Jonli efir to‘xtatilgan'}
                  </p>
                )}
                {events.map((e) => {
                  const m = EVENT_META[e.kind];
                  return (
                    <motion.button
                      key={e.id}
                      layout
                      initial={{ opacity: 0, x: 16, height: 0 }}
                      animate={{ opacity: 1, x: 0, height: 'auto' }}
                      exit={{ opacity: 0 }}
                      onClick={() => {
                        const c = cameras.find((cc) => cc.id === e.camId);
                        if (c) setSelected(c);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${m.color}1a`, color: m.color }}
                      >
                        <m.icon size={17} variant="Bulk" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-medium text-ink">{e.label}</div>
                        <div className="flex items-center gap-1 truncate text-[11px] text-ink-muted">
                          <Location size={10} /> {e.camName}
                        </div>
                      </div>
                      <span className="shrink-0 text-[10px] text-ink-muted">
                        {timeAgo(new Date(e.at).toISOString())}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </Card>
        </aside>
      </div>

      <CameraDetail cam={selectedLive} clock={clock} events={events} onClose={() => setSelected(null)} />
      <AddCameraModal open={addOpen} onClose={() => setAddOpen(false)} onCreate={addCamera} />
    </div>
  );
}
