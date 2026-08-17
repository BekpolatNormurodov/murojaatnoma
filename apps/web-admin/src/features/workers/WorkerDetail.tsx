import {
  Star1,
  Call,
  Sms,
  Location,
  TickCircle,
  CloseCircle,
  LoginCurve,
  LogoutCurve,
  Clock,
  Calendar,
  Medal,
  Driving,
  WalletMoney,
  DocumentText,
  TaskSquare,
  ShieldTick,
} from 'iconsax-react';
import { Drawer } from '@/shared/ui/Drawer';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Progress } from '@/shared/ui/Progress';
import { ATTENDANCE_META, CATEGORY_META } from '@/shared/data/mock';
import type { Worker, WorkerDocType } from '@/shared/data/types';
import { formatDate, formatNumber, formatSomShort } from '@/shared/lib/format';

const DOC_STATUS: Record<
  string,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  valid: { label: 'Amal qiladi', tone: 'success' },
  expiring: { label: 'Muddati tugayapti', tone: 'warning' },
  expired: { label: "Muddati o'tgan", tone: 'danger' },
};

const DOC_TYPE_LABEL: Record<WorkerDocType, string> = {
  passport: 'Passport',
  contract: 'Shartnoma',
  certificate: 'Sertifikat',
  license: 'Guvohnoma',
  medical: 'Tibbiy',
};

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-lg font-bold" style={{ color: accent ?? 'var(--color-ink)' }}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-ink-muted">{label}</div>
    </div>
  );
}

export function WorkerDetail({
  worker,
  onClose,
}: {
  worker: Worker | null;
  onClose: () => void;
}) {
  return (
    <Drawer
      open={!!worker}
      onClose={onClose}
      title="Ishchi profili"
      subtitle={worker?.region}
      width={500}
    >
      {worker && (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={worker.name} src={worker.photo} color={worker.avatarColor} size={68} status={worker.status} />
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-ink">{worker.name}</h3>
              <p className="text-[13px] text-ink-muted">{worker.position}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="flex items-center gap-1 text-sm font-bold text-ink">
                  <Star1 size={15} variant="Bold" className="text-warning" />
                  {worker.rating}
                </span>
                <span className="text-ink-muted">·</span>
                <span className="flex items-center gap-1 text-[13px] text-ink-soft">
                  <Location size={13} /> {worker.region}
                </span>
              </div>
            </div>
          </div>

          {/* Geofence */}
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium ${
              worker.insideRegion
                ? 'bg-success-soft text-primary-700'
                : 'bg-danger-soft text-red-700'
            }`}
          >
            {worker.insideRegion ? (
              <ShieldTick size={18} variant="Bulk" />
            ) : (
              <CloseCircle size={18} variant="Bulk" />
            )}
            {worker.insideRegion
              ? 'Hozir biriktirilgan hududda (geofence ichida)'
              : 'Diqqat: hudud tashqarisida'}
          </div>

          {/* Today attendance */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Bugungi ish kuni
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <LoginCurve size={14} className="text-success" /> Keldi
                </div>
                <div className="mt-1 text-base font-bold text-ink">
                  {worker.checkInTime ?? '—'}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <LogoutCurve size={14} className="text-danger" /> Ketdi
                </div>
                <div className="mt-1 text-base font-bold text-ink">
                  {worker.checkOutTime ?? (worker.checkInTime ? 'Ishda' : '—')}
                </div>
              </div>
              <div className="rounded-xl border border-line bg-surface p-3">
                <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <TickCircle size={14} className="text-accent-500" /> Tasdiq
                </div>
                <div
                  className={`mt-1 text-base font-bold ${worker.todayConfirmed ? 'text-primary-600' : 'text-ink-muted'}`}
                >
                  {worker.todayConfirmed ? 'Ha' : "Yo'q"}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat label="Davomat" value={`${worker.attendanceRate}%`} accent="#10b981" />
            <MiniStat label="O'z vaqtida" value={`${worker.onTimeRate}%`} accent="#3b82f6" />
            <MiniStat label="Oylik soat" value={`${worker.monthlyHours}h`} />
            <MiniStat label="Bajargan" value={formatNumber(worker.completedTasks)} />
            <MiniStat label="Faol vazifa" value={String(worker.activeTasks)} accent="#f59e0b" />
            <MiniStat label="Ball" value={formatNumber(worker.points)} accent="#a855f7" />
          </div>

          {/* Attendance strip */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <Calendar size={14} /> So'nggi 21 kun davomat
              </h4>
            </div>
            <div className="flex flex-wrap gap-1">
              {[...worker.attendance].reverse().map((d) => (
                <div
                  key={d.date}
                  title={`${d.date} · ${ATTENDANCE_META[d.status].label}${d.checkIn ? ` · ${d.checkIn}→${d.checkOut ?? 'ishda'}` : ''}${d.selfConfirmed ? ' · tasdiqlangan' : ''}`}
                  className="h-6 w-6 rounded-md"
                  style={{ background: ATTENDANCE_META[d.status].color, opacity: d.status === 'leave' ? 0.35 : 1 }}
                />
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-3 text-[11px] text-ink-muted">
              {Object.entries(ATTENDANCE_META).map(([k, m]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: m.color }} />
                  {m.label}
                </span>
              ))}
            </div>
          </div>

          {/* Specialization */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Mutaxassislik
            </h4>
            <div className="flex flex-wrap gap-2">
              {worker.specialization.map((c) => (
                <span
                  key={c}
                  className="rounded-lg px-2.5 py-1 text-[12px] font-medium"
                  style={{ background: `${CATEGORY_META[c].color}1a`, color: CATEGORY_META[c].color }}
                >
                  {CATEGORY_META[c].label}
                </span>
              ))}
            </div>
          </div>

          {/* Documents */}
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <DocumentText size={14} /> Hujjatlar ({worker.documents.length})
            </h4>
            <div className="space-y-1.5">
              {worker.documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-ink-soft">
                    <DocumentText size={18} variant="Bulk" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{doc.name}</p>
                    <p className="text-[11px] text-ink-muted">
                      {DOC_TYPE_LABEL[doc.type]}
                      {doc.expiresAt && ` · ${formatDate(doc.expiresAt)}gacha`}
                    </p>
                  </div>
                  <Badge tone={DOC_STATUS[doc.status].tone}>{DOC_STATUS[doc.status].label}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Finance + contact */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <WalletMoney size={14} className="text-primary-600" /> Oylik
              </div>
              <div className="mt-1 text-sm font-bold text-ink">{formatSomShort(worker.salary)}</div>
            </div>
            <div className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <Medal size={14} className="text-warning" /> Bonus
              </div>
              <div className="mt-1 text-sm font-bold text-ink">{formatSomShort(worker.bonus)}</div>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-line bg-surface p-4 text-[13px]">
            <div className="flex items-center gap-2 text-ink-soft">
              <Call size={16} className="text-ink-muted" /> {worker.phone}
            </div>
            <div className="flex items-center gap-2 text-ink-soft">
              <Sms size={16} className="text-ink-muted" /> {worker.email}
            </div>
            {worker.vehicle && (
              <div className="flex items-center gap-2 text-ink-soft">
                <Driving size={16} className="text-ink-muted" /> {worker.vehicle}
              </div>
            )}
            <div className="flex items-center gap-2 text-ink-soft">
              <Clock size={16} className="text-ink-muted" /> Ishga qabul: {formatDate(worker.hiredAt)}
            </div>
          </div>

          {/* Rating bar */}
          <div className="rounded-xl border border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-between text-[13px]">
              <span className="flex items-center gap-1.5 font-medium text-ink">
                <TaskSquare size={15} className="text-primary-600" /> Reyting darajasi
              </span>
              <span className="font-bold text-ink">{worker.rating} / 5.0</span>
            </div>
            <Progress value={(worker.rating / 5) * 100} color={worker.avatarColor} />
          </div>
        </div>
      )}
    </Drawer>
  );
}
