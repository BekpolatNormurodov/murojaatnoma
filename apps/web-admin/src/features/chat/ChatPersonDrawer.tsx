import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Call, CallCalling, Location, Map1, Video, Warning2 } from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { Drawer } from '@/shared/ui/Drawer';
import { Modal } from '@/shared/ui/Modal';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { useAttendanceToday } from '@/features/attendance/useAttendanceToday';
import { AttendanceDayDetail } from '@/features/attendance/AttendanceDayDetail';
import { useLiveEmployees } from './useChat';

/**
 * Chatdagi odamning profili — sarlavha yoki guruhdagi avatar bosilganda
 * ochiladi: katta rasm (bosilsa to'liq o'lchamda), lavozim, telefon, hozir
 * qayerda (jonli joylashuv) va bugungi davomati (yuz skan kadrlari bilan).
 * Ma'lumot xarita va davomat sahifalari ishlatadigan o'sha keshdan keladi.
 */
export function ChatPersonDrawer({
  employeeId,
  fallback,
  online,
  onClose,
  onCall,
}: {
  employeeId: string | null;
  fallback?: { name: string; photo?: string; color?: string };
  online?: boolean;
  onClose: () => void;
  /** Berilsa — 1:1 audio/video qo'ng'iroq tugmalari ko'rsatiladi. */
  onCall?: (kind: 'audio' | 'video') => void;
}) {
  const open = employeeId != null;
  const live = useLiveEmployees();
  const today = useAttendanceToday(undefined, { enabled: open });
  const [zoom, setZoom] = useState(false);

  const emp = (Array.isArray(live.data) ? live.data : []).find((e) => e.employeeId === employeeId);
  const entry = today.data?.roster.find((r) => r.employeeId === employeeId);
  const name = emp?.fullName ?? entry?.fullName ?? fallback?.name ?? '';
  const photo = emp?.avatarUrl ?? entry?.avatarUrl ?? fallback?.photo ?? undefined;
  const position = emp?.position ?? entry?.position ?? '';
  const phone = emp?.phone ?? entry?.phone ?? '';

  return (
    <Drawer open={open} onClose={onClose} title="Profil" subtitle={position || undefined} width={440}>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        <div className="flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => photo && setZoom(true)}
            disabled={!photo}
            aria-label={photo ? `${name} rasmini kattalashtirish` : undefined}
            className="relative rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-500 disabled:cursor-default"
          >
            <Avatar name={name} src={photo} color={fallback?.color} size={96} />
            {online && (
              <span className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-surface bg-success" />
            )}
          </button>
          <h3 className="mt-3 text-lg font-bold text-ink">{name || '—'}</h3>
          {position && <p className="text-[13px] text-ink-muted">{position}</p>}
          <span
            className={cn(
              'mt-2 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium',
              online ? 'bg-success-soft text-primary-700 dark:text-primary-400' : 'bg-surface-2 text-ink-muted',
            )}
          >
            {online ? 'Onlayn' : 'Oflayn'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {onCall ? (
            <>
              <QuickAction icon={<Call size={18} variant="Bulk" />} label="Qo'ng'iroq" onClick={() => onCall('audio')} />
              <QuickAction icon={<Video size={18} variant="Bulk" />} label="Video" onClick={() => onCall('video')} />
            </>
          ) : (
            phone && (
              <a
                href={`tel:${phone}`}
                className="col-span-2 flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-line text-[12px] font-medium text-ink-soft hover:bg-surface-2"
              >
                <Call size={18} variant="Bulk" className="text-primary-600" /> Qo'ng'iroq
              </a>
            )
          )}
          {employeeId && (
            <Link
              to={`/map?employee=${encodeURIComponent(employeeId)}`}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-line text-[12px] font-medium text-ink-soft hover:bg-surface-2"
            >
              <Map1 size={18} variant="Bulk" className="text-primary-600" /> Xaritada
            </Link>
          )}
        </div>

        {phone && (
          <a
            href={`tel:${phone}`}
            className="flex items-center gap-3 rounded-xl border border-line p-3 hover:bg-surface-2"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
              <CallCalling size={17} variant="Bulk" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">{phone}</span>
              <span className="block text-[12px] text-ink-muted">Telefon</span>
            </span>
          </a>
        )}

        {/* Davomat kartasi jonli joylashuvni o'zi ko'rsatadi — takrorlamaymiz. */}
        {emp && !entry?.live && (
          <div className="flex items-center gap-3 rounded-xl border border-line p-3">
            <span
              className={cn(
                'grid h-9 w-9 shrink-0 place-items-center rounded-lg',
                !emp.hasLocation || emp.isStale
                  ? 'bg-surface-2 text-ink-muted'
                  : (emp.insideAssignedZone ?? emp.insideDistrict)
                    ? 'bg-success-soft text-primary-600'
                    : 'bg-danger-soft text-red-600',
              )}
            >
              {!emp.hasLocation || emp.isStale ? <Warning2 size={17} variant="Bulk" /> : <Location size={17} variant="Bulk" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink">
                {emp.hasLocation ? (emp.mahallaName ?? 'Mahalla aniqlanmadi') : 'Joylashuv yuborilmagan'}
              </span>
              <span className="block text-[12px] text-ink-muted">
                {emp.lastLocationAt
                  ? `${emp.isStale ? "Aloqa yo'q" : (emp.insideAssignedZone ?? emp.insideDistrict) ? 'Hududida' : 'Hududdan tashqarida'} · ${timeAgo(emp.lastLocationAt)}`
                  : 'Hozircha signal yo‘q'}
              </span>
            </span>
          </div>
        )}

        {entry ? (
          <AttendanceDayDetail entry={entry} dayLabel="Bugungi davomat" />
        ) : (
          today.isLoading && <div className="skeleton h-40 rounded-2xl" />
        )}
      </div>

      <Modal open={zoom} onClose={() => setZoom(false)} title={name} subtitle={position || undefined} width={460}>
        {photo && <img src={photo} alt={name} className="mx-auto max-h-[70vh] w-full rounded-xl object-contain" />}
      </Modal>
    </Drawer>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border border-line text-[12px] font-medium text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-500/10"
    >
      <span className="text-primary-600">{icon}</span>
      {label}
    </button>
  );
}
