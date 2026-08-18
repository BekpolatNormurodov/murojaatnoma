import { useEffect } from 'react';
import {
  Hierarchy,
  CallCalling,
  Sms,
  Buildings2,
  Calendar,
  MessageQuestion,
  Danger,
  Edit2,
  Trash,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Avatar } from '@/shared/ui/Avatar';
import type { Deputy } from '@/shared/data/types';
import { useRequests } from '@/shared/store/requests';
import { useComplaints } from '@/shared/store/complaints';
import { useMeetingsQuery } from '@/features/meetings/useMeetingsQuery';
import { categoryMeta, deputyStats } from './deputyMeta';

function MiniStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof MessageQuestion;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-3">
      <Icon size={18} variant="Bulk" style={{ color }} />
      <span className="mt-1 text-lg font-bold text-ink">{value}</span>
      <span className="text-[11px] leading-tight text-ink-muted">{label}</span>
    </div>
  );
}

export function DeputyDetail({
  deputy,
  onClose,
  onEdit,
  onDelete,
}: {
  deputy: Deputy | null;
  onClose: () => void;
  onEdit?: (deputy: Deputy) => void;
  onDelete?: (deputy: Deputy) => void;
}) {
  // Statistika kartlari uchun jonli (real) ma'lumot — drawer alohida ochilsa
  // ham do'konlar bo'sh qolmasligi uchun mount'da bir marta yuklaymiz.
  const requests = useRequests((s) => s.requests);
  const hydrateRequests = useRequests((s) => s.hydrate);
  const complaints = useComplaints((s) => s.complaints);
  const fetchComplaints = useComplaints((s) => s.fetchComplaints);
  const { data: meetings } = useMeetingsQuery();

  useEffect(() => {
    hydrateRequests();
    fetchComplaints();
  }, [hydrateRequests, fetchComplaints]);

  return (
    <Drawer
      open={!!deputy}
      onClose={onClose}
      title="O'rinbosar profili"
      subtitle={deputy?.shortDirection}
      width={480}
    >
      {deputy && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={deputy.name} src={deputy.photo} color={deputy.color} size={68} ring />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-ink">{deputy.name}</h3>
              <p className="text-[13px] text-ink-muted">{deputy.position}</p>
            </div>
          </div>

          {/* Direction */}
          <div className="flex items-start gap-2.5 rounded-xl bg-surface-2 p-3.5">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: deputy.color }}
            >
              <Hierarchy size={16} variant="Bulk" />
            </span>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Yo'nalish
              </div>
              <div className="text-[13px] font-medium text-ink">{deputy.direction}</div>
            </div>
          </div>

          {/* Categories */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Javob beradigan murojaatlar
            </h4>
            {deputy.categories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {deputy.categories.map((cat) => {
                  const meta = categoryMeta(cat);
                  return (
                    <span
                      key={cat}
                      className="rounded-full px-2.5 py-1 text-[12px] font-medium"
                      style={{ background: `${meta.color}1a`, color: meta.color }}
                    >
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-ink-muted">Yo'nalish belgilanmagan</p>
            )}
          </div>

          {/* Topics */}
          {deputy.topics.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                Asosiy masalalar
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {deputy.topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-soft"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Stats */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Statistika
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {(() => {
                const s = deputyStats(deputy, requests, complaints, meetings ?? []);
                return (
                  <>
                    <MiniStat icon={MessageQuestion} label="Murojaat" value={s.requests} color="#f59e0b" />
                    <MiniStat icon={Danger} label="Shikoyat" value={s.complaints} color="#ef4444" />
                    <MiniStat icon={Calendar} label="Yig'ilish" value={s.meetings} color="#2563eb" />
                  </>
                );
              })()}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-[13px]">
            <a
              href={`tel:${deputy.phone}`}
              className="flex items-center gap-2 text-ink-soft hover:text-accent-600"
            >
              <CallCalling size={16} variant="Bulk" className="text-ink-muted" /> {deputy.phone}
            </a>
            <a
              href={`mailto:${deputy.email}`}
              className="flex items-center gap-2 text-ink-soft hover:text-accent-600"
            >
              <Sms size={16} variant="Bulk" className="text-ink-muted" /> {deputy.email}
            </a>
            <div className="flex items-center gap-2 text-ink-soft">
              <Buildings2 size={16} variant="Bulk" className="text-ink-muted" /> {deputy.office}
            </div>
            <div className="flex items-center gap-2 text-ink-soft">
              <Calendar size={16} variant="Bulk" className="text-ink-muted" /> Qabul: {deputy.receptionDay}
            </div>
          </div>

          {/* Actions */}
          {(onEdit || onDelete) && (
            <div className="flex gap-3 border-t border-line pt-4">
              {onEdit && (
                <button
                  onClick={() => onEdit(deputy)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
                >
                  <Edit2 size={18} variant="Bulk" /> Tahrirlash
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(deputy)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-danger/30 bg-danger-soft px-4 py-2.5 text-sm font-medium text-red-700 hover:bg-danger/15"
                >
                  <Trash size={18} variant="Bulk" /> O'chirish
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}
