import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Add,
  Calendar,
  Location,
  Clock,
  People,
  Video,
  TickCircle,
  CloseCircle,
  Calendar1,
  Edit2,
  AddCircle,
  CloseSquare,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Modal } from '@/shared/ui/Modal';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { DatePicker, TimePicker } from '@/shared/ui/DatePicker';
import { VideoCall, type CallParticipant } from '@/shared/ui/VideoCall';
import {
  DEPUTIES,
  HOME_DISTRICT_ID,
  MEETING_STATUS_META,
  MEETING_TYPE_META,
  getDeputy,
} from '@/shared/data/mock';
import { useMeetings } from '@/shared/store/meetings';
import type { Meeting, MeetingStatus, MeetingType } from '@/shared/data/types';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

const TYPE_TABS: { key: MeetingType | 'all'; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'apparat', label: 'Apparat' },
  { key: 'qabul', label: 'Qabul' },
  { key: 'shtab', label: 'Shtab' },
  { key: 'video', label: 'Video selektor' },
  { key: 'hashar', label: 'Obodonlashtirish' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toTimeInput = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const TYPE_OPTIONS: SelectOption<MeetingType>[] = (
  Object.keys(MEETING_TYPE_META) as MeetingType[]
).map((k) => ({ value: k, label: MEETING_TYPE_META[k].label, dot: MEETING_TYPE_META[k].color }));

const STATUS_OPTIONS: SelectOption<MeetingStatus>[] = (
  Object.keys(MEETING_STATUS_META) as MeetingStatus[]
).map((k) => ({ value: k, label: MEETING_STATUS_META[k].label }));

const CHAIR_OPTIONS: SelectOption<string>[] = DEPUTIES.map((d) => ({
  value: d.id,
  label: d.name,
  dot: d.color,
}));

const DURATION_OPTIONS: SelectOption<string>[] = [30, 45, 60, 90, 120].map((n) => ({
  value: String(n),
  label: `${n} daqiqa`,
}));

function timeLabel(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getDate() === n.getDate() &&
    d.getMonth() === n.getMonth() &&
    d.getFullYear() === n.getFullYear()
  );
}

function MeetingCard({
  m,
  index,
  onEdit,
  onJoin,
}: {
  m: Meeting;
  index: number;
  onEdit: (m: Meeting) => void;
  onJoin: (m: Meeting) => void;
}) {
  const type = MEETING_TYPE_META[m.type];
  const st = MEETING_STATUS_META[m.status];
  const chair = getDeputy(m.chairDeputyId);
  const cancelled = m.status === 'cancelled';
  const canJoin = m.type === 'video' && (m.status === 'scheduled' || m.status === 'ongoing');
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card transition-all hover:shadow-pop',
        cancelled && 'opacity-70',
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: type.color }} />
      <div className="flex items-start justify-between gap-2">
        <span
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
          style={{ background: `${type.color}1a`, color: type.color }}
        >
          {m.type === 'video' ? <Video size={14} variant="Bulk" /> : <Calendar size={14} variant="Bulk" />}
          {type.label}
        </span>
        <div className="flex items-center gap-1.5">
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
          <button
            type="button"
            onClick={() => onEdit(m)}
            title="Tahrirlash"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted opacity-0 transition-all hover:border-primary-200 hover:text-primary-600 group-hover:opacity-100"
          >
            <Edit2 size={15} variant="Bulk" />
          </button>
        </div>
      </div>

      <h3 className={cn('mt-3 text-[15px] font-semibold text-ink', cancelled && 'line-through')}>
        {m.title}
      </h3>

      {/* date/time/location */}
      <div className="mt-2.5 space-y-1.5 text-[13px] text-ink-soft">
        <div className="flex items-center gap-2">
          <Calendar1 size={15} variant="Bulk" className="text-ink-muted" />
          <span className="font-medium text-ink">{formatDate(m.startAt)}</span>
          <span className="text-ink-muted">·</span>
          <span>{timeLabel(m.startAt)}</span>
          <span className="text-ink-muted">·</span>
          <span>{m.durationMin} daq</span>
        </div>
        <div className="flex items-center gap-2">
          <Location size={15} variant="Bulk" className="text-ink-muted" />
          <span className="truncate">{m.location}</span>
        </div>
      </div>

      {/* agenda */}
      <div className="mt-3 rounded-xl bg-surface-2 p-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Kun tartibi
        </div>
        <ul className="space-y-1">
          {m.agenda.map((a, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-ink-soft">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: type.color }}
              />
              {a}
            </li>
          ))}
        </ul>
      </div>

      {/* footer: chair + participants */}
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
        {chair ? (
          <div className="flex min-w-0 items-center gap-2">
            <Avatar src={chair.photo} name={chair.name} color={chair.color} size={28} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[12.5px] font-medium text-ink">{chair.name}</div>
              <div className="text-[10.5px] text-ink-muted">Raislik qiluvchi</div>
            </div>
          </div>
        ) : (
          <span className="text-[12px] text-ink-muted">Raislik belgilanmagan</span>
        )}
        <span className="flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-soft">
          <People size={14} variant="Bulk" /> {m.participants}
        </span>
      </div>

      {canJoin && (
        <button
          type="button"
          onClick={() => onJoin(m)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
        >
          {m.status === 'ongoing' ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          ) : (
            <Video size={16} variant="Bulk" />
          )}
          {m.status === 'ongoing' ? 'Jonli — qo\u02bbshilish' : 'Video qo\u02bbshilish'}
        </button>
      )}
    </motion.div>
  );
}

export function MeetingsPage() {
  const meetings = useMeetings((s) => s.meetings);
  const [type, setType] = useState<MeetingType | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);
  const [callTarget, setCallTarget] = useState<Meeting | null>(null);

  const callParticipants = useMemo<CallParticipant[]>(() => {
    if (!callTarget) return [];
    const chair = getDeputy(callTarget.chairDeputyId);
    const list: CallParticipant[] = [];
    if (chair) {
      list.push({
        id: chair.id,
        name: chair.name,
        photo: chair.photo,
        color: chair.color,
        role: 'Raislik qiluvchi',
      });
    }
    DEPUTIES.filter((d) => d.id !== callTarget.chairDeputyId)
      .slice(0, 4)
      .forEach((d) =>
        list.push({ id: d.id, name: d.name, photo: d.photo, color: d.color, role: "A'zo" }),
      );
    return list;
  }, [callTarget]);

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (m: Meeting) => {
    setEditTarget(m);
    setFormOpen(true);
  };

  const filtered = useMemo(
    () => meetings.filter((m) => type === 'all' || m.type === type),
    [meetings, type],
  );

  const upcoming = useMemo(
    () =>
      filtered
        .filter((m) => m.status === 'scheduled' || m.status === 'ongoing')
        .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt)),
    [filtered],
  );
  const past = useMemo(
    () =>
      filtered
        .filter((m) => m.status === 'done' || m.status === 'cancelled')
        .sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt)),
    [filtered],
  );

  const stats = useMemo(() => {
    const total = meetings.length;
    const today = meetings.filter((m) => isToday(m.startAt)).length;
    const scheduled = meetings.filter((m) => m.status === 'scheduled').length;
    const done = meetings.filter((m) => m.status === 'done').length;
    return { total, today, scheduled, done };
  }, [meetings]);

  return (
    <div>
      <PageHeader
        title="Yig'ilishlar"
        subtitle="Apparat yig'ilishlari, fuqarolar qabuli, shtab va video selektorlar jadvali"
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
          >
            <Add size={20} /> Yangi yig'ilish
          </button>
        }
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Jami yig'ilishlar" value={String(stats.total)} tint="#2563eb" index={0} />
        <StatCard icon={Clock} label="Bugun" value={String(stats.today)} tint="#f59e0b" index={1} />
        <StatCard icon={Calendar1} label="Rejalashtirilgan" value={String(stats.scheduled)} tint="#06b6d4" index={2} />
        <StatCard icon={TickCircle} label="O'tkazilgan" value={String(stats.done)} tint="#10b981" index={3} />
      </div>

      {/* Type filter */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {TYPE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setType(t.key)}
            className={cn(
              'flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
              type === t.key
                ? 'border-transparent text-white shadow-sm'
                : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
            )}
            style={
              type === t.key
                ? { background: t.key === 'all' ? '#0f172a' : MEETING_TYPE_META[t.key as MeetingType].color }
                : undefined
            }
          >
            {t.key !== 'all' && (
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: type === t.key ? '#fff' : MEETING_TYPE_META[t.key as MeetingType].color }}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* Upcoming */}
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
          Yaqin va joriy ({upcoming.length})
        </h2>
      </div>
      {upcoming.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((m, i) => (
            <MeetingCard key={m.id} m={m} index={i} onEdit={openEdit} onJoin={setCallTarget} />
          ))}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center gap-2 py-10 text-center">
          <Calendar size={36} variant="Bulk" className="text-ink-muted" />
          <p className="text-sm text-ink-muted">Yaqin yig'ilishlar yo'q</p>
        </Card>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <div className="mb-3 mt-8 flex items-center gap-2">
            <CloseCircle size={16} variant="Bulk" className="text-ink-muted" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
              O'tkazilgan va bekor qilingan ({past.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {past.map((m, i) => (
              <MeetingCard key={m.id} m={m} index={i} onEdit={openEdit} onJoin={setCallTarget} />
            ))}
          </div>
        </>
      )}

      <MeetingFormModal
        open={formOpen}
        target={editTarget}
        onClose={() => setFormOpen(false)}
      />

      <VideoCall
        open={!!callTarget}
        onClose={() => setCallTarget(null)}
        title={callTarget?.title}
        subtitle={callTarget ? `Video selektor · ${callTarget.location}` : undefined}
        participants={callParticipants}
        scheduledAt={callTarget?.startAt}
      />
    </div>
  );
}

/* ============================================================
   Yig'ilish qo'shish / tahrirlash formasi
   ============================================================ */
const fieldCls =
  'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';
const labelCls = 'mb-1.5 block text-[12.5px] font-medium text-ink-soft';

function MeetingFormModal({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: Meeting | null;
  onClose: () => void;
}) {
  const add = useMeetings((s) => s.add);
  const update = useMeetings((s) => s.update);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<MeetingType>('apparat');
  const [status, setStatus] = useState<MeetingStatus>('scheduled');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [duration, setDuration] = useState('60');
  const [location, setLocation] = useState('');
  const [chairId, setChairId] = useState(DEPUTIES[0]?.id ?? '');
  const [participants, setParticipants] = useState('12');
  const [agenda, setAgenda] = useState<string[]>(['']);

  useEffect(() => {
    if (!open) return;
    if (target) {
      const d = new Date(target.startAt);
      setTitle(target.title);
      setType(target.type);
      setStatus(target.status);
      setDate(toDateInput(d));
      setTime(toTimeInput(d));
      setDuration(String(target.durationMin));
      setLocation(target.location);
      setChairId(target.chairDeputyId);
      setParticipants(String(target.participants));
      setAgenda(target.agenda.length ? target.agenda : ['']);
    } else {
      const now = new Date();
      setTitle('');
      setType('apparat');
      setStatus('scheduled');
      setDate(toDateInput(now));
      setTime('10:00');
      setDuration('60');
      setLocation('Hokimiyat katta majlislar zali');
      setChairId(DEPUTIES[0]?.id ?? '');
      setParticipants('12');
      setAgenda(['']);
    }
  }, [open, target]);

  const valid = title.trim().length > 0 && !!date && !!time;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const startAt = new Date(`${date}T${time}`).toISOString();
    const cleanAgenda = agenda.map((a) => a.trim()).filter(Boolean);
    const payload: Omit<Meeting, 'id'> = {
      title: title.trim(),
      type,
      status,
      startAt,
      durationMin: Number(duration) || 60,
      location: location.trim() || 'Belgilanmagan',
      chairDeputyId: chairId,
      agenda: cleanAgenda.length ? cleanAgenda : ['Kun tartibi belgilanmagan'],
      participants: Math.max(1, Number(participants) || 1),
      districtId: HOME_DISTRICT_ID,
    };
    if (target) update(target.id, payload);
    else add(payload);
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? "Yig'ilishni tahrirlash" : "Yangi yig'ilish"}
      subtitle={target ? `#${target.id}` : "Jadvalga yangi tadbir qo'shish"}
      width={580}
    >
      <form onSubmit={handleSubmit}>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <div>
            <label className={labelCls}>Sarlavha</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Haftalik apparat yig'ilishi"
              className={fieldCls}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Turi</label>
              <Select value={type} onChange={setType} options={TYPE_OPTIONS} block />
            </div>
            <div>
              <label className={labelCls}>Holati</label>
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} block />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Sana</label>
              <DatePicker value={date} onChange={setDate} block />
            </div>
            <div>
              <label className={labelCls}>Vaqti</label>
              <TimePicker value={time} onChange={setTime} block />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Davomiyligi</label>
              <Select value={duration} onChange={setDuration} options={DURATION_OPTIONS} block />
            </div>
            <div>
              <label className={labelCls}>Ishtirokchilar</label>
              <input
                type="number"
                min={1}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                className={fieldCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Joyi</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Manzil yoki zal nomi"
              className={fieldCls}
            />
          </div>

          <div>
            <label className={labelCls}>Raislik qiluvchi</label>
            <Select value={chairId} onChange={setChairId} options={CHAIR_OPTIONS} block />
          </div>

          <div>
            <label className={labelCls}>Kun tartibi</label>
            <div className="space-y-2">
              {agenda.map((a, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-ink-muted">{i + 1}.</span>
                  <input
                    value={a}
                    onChange={(e) =>
                      setAgenda((prev) => prev.map((x, idx) => (idx === i ? e.target.value : x)))
                    }
                    placeholder="Masala / band nomi"
                    className={cn(fieldCls, 'h-10 flex-1')}
                  />
                  <button
                    type="button"
                    onClick={() => setAgenda((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors hover:border-danger/40 hover:text-danger"
                    title="O'chirish"
                  >
                    <CloseSquare size={18} variant="Bulk" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setAgenda((prev) => [...prev, ''])}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary-600 hover:bg-primary-50"
            >
              <AddCircle size={17} variant="Bulk" /> Band qo'shish
            </button>
          </div>
        </div>

        <div className="mt-5 flex gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={!valid}
            className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow transition-all hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {target ? "O'zgarishlarni saqlash" : "Qo'shish"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2"
          >
            Bekor qilish
          </button>
        </div>
      </form>
    </Modal>
  );
}
