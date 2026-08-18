import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
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
  RotateRight,
  Trash,
  FilterRemove,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { Select, type SelectOption } from '@/shared/ui/Select';
import { DatePicker, TimePicker } from '@/shared/ui/DatePicker';
import { MeetingCall } from '@/shared/realtime/MeetingCall';
import { DEPUTIES, HOME_DISTRICT_ID, MEETING_TYPE_META, getDeputy } from '@/shared/data/mock';
import { useMeetings } from '@/shared/store/meetings';
import { useMeetingsQuery } from './useMeetingsQuery';
import { MeetingDetail } from './MeetingDetail';
import { MeetingToastStack } from './MeetingToasts';
import { pushMeetingToast } from './toastStore';
import {
  meetingTypeMeta,
  meetingStatusMeta,
  toDateInput,
  toTimeInput,
  timeLabel,
  isToday,
} from './meetingMeta';
import type { Meeting, MeetingStatus, MeetingType } from '@/shared/data/types';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

const TYPE_TABS: { key: MeetingType | 'all'; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'apparat', label: 'Apparat' },
  { key: 'qabul', label: 'Qabul' },
  { key: 'shtab', label: 'Shtab' },
  { key: 'video', label: 'Video selektor' },
  { key: 'hashar', label: 'Obodonlashtirish' },
];

const TYPE_OPTIONS: SelectOption<MeetingType>[] = (
  Object.keys(MEETING_TYPE_META) as MeetingType[]
).map((k) => ({ value: k, label: MEETING_TYPE_META[k].label, dot: MEETING_TYPE_META[k].color }));

const STATUS_OPTIONS: SelectOption<MeetingStatus>[] = (
  ['scheduled', 'ongoing', 'done', 'cancelled'] as MeetingStatus[]
).map((k) => ({ value: k, label: meetingStatusMeta(k).label }));

const CHAIR_OPTIONS: SelectOption<string>[] = DEPUTIES.map((d) => ({
  value: d.id,
  label: d.name,
  dot: d.color,
}));

const DURATION_OPTIONS: SelectOption<string>[] = [30, 45, 60, 90, 120].map((n) => ({
  value: String(n),
  label: `${n} daqiqa`,
}));

function MeetingCard({
  m,
  index,
  reducedMotion,
  onOpen,
  onEdit,
  onDelete,
  onJoin,
}: {
  m: Meeting;
  index: number;
  reducedMotion: boolean;
  onOpen: (m: Meeting) => void;
  onEdit: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
  onJoin: (m: Meeting) => void;
}) {
  const type = meetingTypeMeta(m.type);
  const st = meetingStatusMeta(m.status);
  const chair = getDeputy(m.chairDeputyId);
  const cancelled = m.status === 'cancelled';
  const canJoin = m.type === 'video' && (m.status === 'scheduled' || m.status === 'ongoing');

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onOpen(m);
    }
  }

  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(m)}
      onKeyDown={handleKeyDown}
      aria-label={`"${m.title}" yig'ilishi tafsilotlari`}
      initial={reducedMotion ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reducedMotion ? { duration: 0.15 } : { delay: Math.min(index * 0.04, 0.3), duration: 0.35 }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-surface p-4 shadow-card outline-none transition-all hover:shadow-pop focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
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
        <div className="flex items-center gap-1">
          <Badge tone={st.tone} dot>
            {st.label}
          </Badge>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(m);
            }}
            title="Tahrirlash"
            aria-label={`"${m.title}" yig'ilishini tahrirlash`}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted opacity-0 transition-all hover:border-primary-200 hover:text-primary-600 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Edit2 size={15} variant="Bulk" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(m);
            }}
            title="O'chirish"
            aria-label={`"${m.title}" yig'ilishini o'chirish`}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface text-ink-muted opacity-0 transition-all hover:border-danger/40 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <Trash size={15} variant="Bulk" />
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
          {m.agenda.slice(0, 3).map((a, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-ink-soft">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: type.color }}
              />
              <span className="truncate">{a}</span>
            </li>
          ))}
          {m.agenda.length > 3 && (
            <li className="pl-3 text-[11.5px] font-medium text-ink-muted">
              +{m.agenda.length - 3} yana
            </li>
          )}
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
          onClick={(e) => {
            e.stopPropagation();
            onJoin(m);
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
        >
          {m.status === 'ongoing' ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
          ) : (
            <Video size={16} variant="Bulk" />
          )}
          {m.status === 'ongoing' ? 'Jonli — qoʻshilish' : 'Video qoʻshilish'}
        </button>
      )}
    </motion.div>
  );
}

export function MeetingsPage() {
  const meetings = useMeetings((s) => s.meetings);
  const setMeetings = useMeetings((s) => s.setMeetings);
  const removeMeeting = useMeetings((s) => s.remove);
  const { data, isLoading, isError, error, refetch } = useMeetingsQuery();
  const reducedMotion = !!useReducedMotion();
  const [type, setType] = useState<MeetingType | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Meeting | null>(null);
  const [detailTarget, setDetailTarget] = useState<Meeting | null>(null);
  const [callTarget, setCallTarget] = useState<Meeting | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (data) setMeetings(data);
  }, [data, setMeetings]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError(null);
    const title = deleteTarget.title;
    try {
      await removeMeeting(deleteTarget.id);
      setDeleteTarget(null);
      setDetailTarget((cur) => (cur?.id === deleteTarget.id ? null : cur));
      pushMeetingToast('success', `"${title}" yig'ilishi o'chirildi`);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Yig'ilishni o'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  const openCreate = () => {
    setEditTarget(null);
    setFormOpen(true);
  };
  const openEdit = (m: Meeting) => {
    setDetailTarget(null);
    setEditTarget(m);
    setFormOpen(true);
  };
  const openDetail = (m: Meeting) => setDetailTarget(m);
  const openJoin = (m: Meeting) => {
    setDetailTarget(null);
    setCallTarget(m);
  };
  const requestDelete = (m: Meeting) => {
    setDetailTarget(null);
    setDeleteTarget(m);
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

  const noneAtAll = !isLoading && meetings.length === 0;
  const filteredEmpty = !isLoading && meetings.length > 0 && filtered.length === 0;

  return (
    <div>
      <PageHeader
        title="Yig'ilishlar"
        subtitle="Apparat yig'ilishlari, fuqarolar qabuli, shtab va video selektorlar jadvali"
        action={
          <button
            onClick={openCreate}
            className="flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
          >
            <Add size={20} /> Yangi yig'ilish
          </button>
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          {/* KPIs */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {isLoading && meetings.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[104px]" />)
            ) : (
              <>
                <StatCard icon={Calendar} label="Jami yig'ilishlar" value={String(stats.total)} tint="#2563eb" index={0} />
                <StatCard icon={Clock} label="Bugun" value={String(stats.today)} tint="#f59e0b" index={1} />
                <StatCard icon={Calendar1} label="Rejalashtirilgan" value={String(stats.scheduled)} tint="#06b6d4" index={2} />
                <StatCard icon={TickCircle} label="O'tkazilgan" value={String(stats.done)} tint="#10b981" index={3} />
              </>
            )}
          </div>

          {!noneAtAll && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {TYPE_TABS.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  aria-pressed={type === t.key}
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
          )}

          {isLoading && meetings.length === 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64" />
              ))}
            </div>
          ) : noneAtAll ? (
            <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                <Calendar size={30} variant="Bulk" />
              </span>
              <div>
                <p className="font-semibold text-ink">Hozircha yig'ilishlar yo'q</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Birinchi yig'ilishni qo'shib, jadvalni to'ldirishni boshlang.
                </p>
              </div>
              <button
                onClick={openCreate}
                className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
              >
                <Add size={20} /> Yig'ilish qo'shish
              </button>
            </Card>
          ) : filteredEmpty ? (
            <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2 text-ink-muted">
                <FilterRemove size={28} variant="Bulk" />
              </span>
              <div>
                <p className="font-semibold text-ink">Bu turdagi yig'ilishlar topilmadi</p>
                <p className="mt-1 text-sm text-ink-muted">Boshqa turni tanlang yoki filtrni tozalang.</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <Button variant="secondary" onClick={() => setType('all')}>
                  Barchasini ko'rish
                </Button>
                <button
                  onClick={openCreate}
                  className="flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
                >
                  <Add size={20} /> Yig'ilish qo'shish
                </button>
              </div>
            </Card>
          ) : (
            <>
              {/* Upcoming */}
              <div className="mb-3 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-400 opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary-500" />
                </span>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
                  Yaqin va joriy ({upcoming.length})
                </h2>
              </div>
              {upcoming.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {upcoming.map((m, i) => (
                    <MeetingCard
                      key={m.id}
                      m={m}
                      index={i}
                      reducedMotion={reducedMotion}
                      onOpen={openDetail}
                      onEdit={openEdit}
                      onDelete={requestDelete}
                      onJoin={openJoin}
                    />
                  ))}
                </div>
              ) : (
                <Card className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <Calendar size={36} variant="Bulk" className="text-ink-muted" />
                  <p className="text-sm text-ink-muted">Yaqin yig'ilishlar yo'q</p>
                  <button
                    onClick={openCreate}
                    className="mt-1 flex h-11 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-medium text-white shadow-glow transition-colors hover:bg-primary-700"
                  >
                    <Add size={20} /> Yig'ilish qo'shish
                  </button>
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
                      <MeetingCard
                        key={m.id}
                        m={m}
                        index={i}
                        reducedMotion={reducedMotion}
                        onOpen={openDetail}
                        onEdit={openEdit}
                        onDelete={requestDelete}
                        onJoin={openJoin}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}

      <MeetingFormModal
        open={formOpen}
        target={editTarget}
        onClose={() => setFormOpen(false)}
      />

      <MeetingDetail
        meeting={detailTarget}
        onClose={() => setDetailTarget(null)}
        onEdit={openEdit}
        onDelete={requestDelete}
        onJoin={openJoin}
      />

      <MeetingCall
        open={!!callTarget}
        meetingId={callTarget?.id}
        title={callTarget?.title}
        subtitle={callTarget ? `Video selektor · ${callTarget.location}` : undefined}
        onClose={() => setCallTarget(null)}
      />

      {/* O'chirish tasdiqi */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Yig'ilishni o'chirasizmi?"
        message={
          <>
            {deleteTarget && <>"{deleteTarget.title}" yig'ilishi butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.</>}
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

      <MeetingToastStack />
    </div>
  );
}

/* ============================================================
   Yig'ilish qo'shish / tahrirlash formasi
   ============================================================ */
const fieldCls =
  'h-11 w-full rounded-xl border bg-surface px-3.5 text-sm text-ink outline-none transition-colors focus:border-primary-300';
const labelCls = 'mb-1.5 block text-[12.5px] font-medium text-ink-soft';

/** Sarlavha/sana/vaqt/ishtirokchilar kabi maydonlar uchun xato izohi bilan wrapper. */
function FormField({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = htmlFor && error ? `${htmlFor}-error` : undefined;
  return (
    <div>
      <label htmlFor={htmlFor} className={labelCls}>
        {label}
      </label>
      {children}
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface TouchedState {
  title: boolean;
  date: boolean;
  time: boolean;
  participants: boolean;
}

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
  const titleRef = useRef<HTMLInputElement>(null);

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState<TouchedState>({
    title: false,
    date: false,
    time: false,
    participants: false,
  });
  const [submitAttempted, setSubmitAttempted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    setSubmitAttempted(false);
    setTouched({ title: false, date: false, time: false, participants: false });
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

  const participantsNum = Number(participants);
  const fieldErrors = {
    title:
      title.trim().length === 0
        ? 'Sarlavhani kiriting'
        : title.trim().length < 3
          ? "Sarlavha kamida 3 ta belgidan iborat bo'lsin"
          : undefined,
    date: date ? undefined : 'Sanani tanlang',
    time: time ? undefined : 'Vaqtni tanlang',
    participants:
      participants.trim() === '' || Number.isNaN(participantsNum)
        ? 'Ishtirokchilar sonini kiriting'
        : participantsNum < 1
          ? "Kamida 1 kishi bo'lishi kerak"
          : undefined,
  };
  const hasErrors = Object.values(fieldErrors).some(Boolean);
  const shown = (key: keyof TouchedState) => (touched[key] || submitAttempted ? fieldErrors[key] : undefined);

  function markTouched(key: keyof TouchedState) {
    setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    if (hasErrors) {
      if (fieldErrors.title) titleRef.current?.focus();
      return;
    }
    if (saving) return;
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
    setSaving(true);
    setError(null);
    try {
      if (target) await update(target.id, payload);
      else await add(payload);
      pushMeetingToast(
        'success',
        target ? `"${payload.title}" yig'ilishi yangilandi` : `"${payload.title}" yig'ilishi qo'shildi`,
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : target
            ? "Yig'ilishni yangilab bo'lmadi"
            : "Yig'ilishni yaratib bo'lmadi",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={target ? "Yig'ilishni tahrirlash" : "Yangi yig'ilish"}
      subtitle={target ? `#${target.id}` : "Jadvalga yangi tadbir qo'shish"}
      width={580}
    >
      <form onSubmit={handleSubmit} noValidate>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          <FormField label="Sarlavha" htmlFor="meeting-title" error={shown('title')}>
            <input
              id="meeting-title"
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => markTouched('title')}
              placeholder="Masalan: Haftalik apparat yig'ilishi"
              aria-invalid={!!shown('title')}
              aria-describedby={shown('title') ? 'meeting-title-error' : undefined}
              className={cn(fieldCls, shown('title') ? 'border-danger' : 'border-line')}
              autoFocus
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Turi">
              <Select value={type} onChange={setType} options={TYPE_OPTIONS} block />
            </FormField>
            <FormField label="Holati">
              <Select value={status} onChange={setStatus} options={STATUS_OPTIONS} block />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sana" error={shown('date')}>
              <DatePicker
                value={date}
                onChange={(v) => {
                  setDate(v);
                  markTouched('date');
                }}
                block
              />
            </FormField>
            <FormField label="Vaqti" error={shown('time')}>
              <TimePicker
                value={time}
                onChange={(v) => {
                  setTime(v);
                  markTouched('time');
                }}
                block
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Davomiyligi">
              <Select value={duration} onChange={setDuration} options={DURATION_OPTIONS} block />
            </FormField>
            <FormField label="Ishtirokchilar" htmlFor="meeting-participants" error={shown('participants')}>
              <input
                id="meeting-participants"
                type="number"
                min={1}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
                onBlur={() => markTouched('participants')}
                aria-invalid={!!shown('participants')}
                aria-describedby={shown('participants') ? 'meeting-participants-error' : undefined}
                className={cn(fieldCls, shown('participants') ? 'border-danger' : 'border-line')}
              />
            </FormField>
          </div>

          <FormField label="Joyi" htmlFor="meeting-location">
            <input
              id="meeting-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Manzil yoki zal nomi"
              className={cn(fieldCls, 'border-line')}
            />
          </FormField>

          <FormField label="Raislik qiluvchi">
            <Select value={chairId} onChange={setChairId} options={CHAIR_OPTIONS} block />
          </FormField>

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
                    aria-label={`Kun tartibi bandi ${i + 1}`}
                    className={cn(fieldCls, 'h-10 flex-1 border-line')}
                  />
                  <button
                    type="button"
                    onClick={() => setAgenda((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev))}
                    aria-label={`${i + 1}-bandni o'chirish`}
                    className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-ink-muted transition-colors after:absolute after:-inset-1 after:content-[''] hover:border-danger/40 hover:text-danger"
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
              className="relative mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-primary-600 after:absolute after:-inset-1.5 after:content-[''] hover:bg-primary-50"
            >
              <AddCircle size={17} variant="Bulk" /> Band qo'shish
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
            {error}
          </p>
        )}

        <div className="mt-5 flex gap-3 border-t border-line pt-4">
          <button
            type="submit"
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow transition-all hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving && <RotateRight size={16} className="animate-spin" />}
            {saving ? 'Saqlanmoqda...' : target ? "O'zgarishlarni saqlash" : "Qo'shish"}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-xl border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Bekor qilish
          </button>
        </div>
      </form>
    </Modal>
  );
}
