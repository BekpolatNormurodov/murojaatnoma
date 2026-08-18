import {
  Calendar1,
  Location,
  Clock,
  People,
  Edit2,
  Trash,
  Video,
  ClipboardTick,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Avatar } from '@/shared/ui/Avatar';
import { Badge } from '@/shared/ui/Badge';
import { getDeputy } from '@/shared/data/mock';
import type { Meeting } from '@/shared/data/types';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { meetingTypeMeta, meetingStatusMeta, timeLabel, endTimeLabel, weekdayDate } from './meetingMeta';

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
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 text-[13px] text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="text-right text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

/**
 * Yig'ilish tafsilotlari — kartadagi ma'lumotni to'liq, o'qish uchun
 * qulay ko'rinishda ko'rsatadi va tahrirlash/o'chirish/qo'shilish
 * amallarini MeetingsPage'ga delegatsiya qiladi (dublikat mantiq yo'q —
 * bitta ConfirmDialog, bitta forma, shu yerda faqat trigger tugmalar).
 */
export function MeetingDetail({
  meeting,
  onClose,
  onEdit,
  onDelete,
  onJoin,
}: {
  meeting: Meeting | null;
  onClose: () => void;
  onEdit: (m: Meeting) => void;
  onDelete: (m: Meeting) => void;
  onJoin: (m: Meeting) => void;
}) {
  const m = meeting;
  const type = m ? meetingTypeMeta(m.type) : null;
  const st = m ? meetingStatusMeta(m.status) : null;
  const chair = m ? getDeputy(m.chairDeputyId) : undefined;
  const canJoin = !!m && m.type === 'video' && (m.status === 'scheduled' || m.status === 'ongoing');

  return (
    <Drawer open={!!m} onClose={onClose} title="Yig'ilish tafsilotlari" subtitle={m ? `#${m.id}` : undefined} width={480}>
      {m && type && st && (
        <div className="space-y-5">
          {/* Header: badges + title */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[12px] font-semibold"
                style={{ background: `${type.color}1a`, color: type.color }}
              >
                {m.type === 'video' ? <Video size={14} variant="Bulk" /> : <Calendar1 size={14} variant="Bulk" />}
                {type.label}
              </span>
              <Badge tone={st.tone} dot>
                {st.label}
              </Badge>
            </div>
            <h3 className={cn('mt-3 text-lg font-bold text-ink', m.status === 'cancelled' && 'line-through')}>
              {m.title}
            </h3>
          </div>

          {/* Sana / vaqt / joy / ishtirokchilar */}
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            <InfoRow
              icon={<Calendar1 size={15} variant="Bulk" className="text-ink-muted" />}
              label="Sana"
              value={weekdayDate(m.startAt, formatDate)}
            />
            <InfoRow
              icon={<Clock size={15} variant="Bulk" className="text-ink-muted" />}
              label="Vaqti"
              value={`${timeLabel(m.startAt)} – ${endTimeLabel(m.startAt, m.durationMin)} (${m.durationMin} daq)`}
            />
            <InfoRow
              icon={<Location size={15} variant="Bulk" className="text-ink-muted" />}
              label="Joyi"
              value={<span className="text-right">{m.location}</span>}
            />
            <InfoRow
              icon={<People size={15} variant="Bulk" className="text-ink-muted" />}
              label="Ishtirokchilar"
              value={`${m.participants} kishi`}
            />
          </div>

          {/* Raislik qiluvchi */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Raislik qiluvchi</p>
            {chair ? (
              <div className="flex items-center gap-3">
                <Avatar src={chair.photo} name={chair.name} color={chair.color} size={42} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{chair.name}</div>
                  <div className="text-[12px] text-ink-muted">{chair.shortDirection}</div>
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">Raislik belgilanmagan</p>
            )}
          </div>

          {/* Kun tartibi */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <ClipboardTick size={16} variant="Bulk" className="text-ink-muted" /> Kun tartibi
            </p>
            <ol className="space-y-2">
              {m.agenda.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px] text-ink-soft">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold"
                    style={{ background: `${type.color}1a`, color: type.color }}
                  >
                    {i + 1}
                  </span>
                  {a}
                </li>
              ))}
            </ol>
          </div>

          {/* Video qo'shilish */}
          {canJoin && (
            <button
              type="button"
              onClick={() => onJoin(m)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-600 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-700"
            >
              {m.status === 'ongoing' ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                </span>
              ) : (
                <Video size={17} variant="Bulk" />
              )}
              {m.status === 'ongoing' ? "Jonli — qo'shilish" : "Video qo'shilish"}
            </button>
          )}

          {/* Amallar */}
          <div className="flex gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={() => onEdit(m)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-line bg-surface text-sm font-medium text-ink-soft transition-colors hover:bg-surface-2"
            >
              <Edit2 size={17} variant="Bulk" /> Tahrirlash
            </button>
            <button
              type="button"
              onClick={() => onDelete(m)}
              className="flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-danger-soft px-4 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
            >
              <Trash size={17} variant="Bulk" /> O'chirish
            </button>
          </div>
        </div>
      )}
    </Drawer>
  );
}
