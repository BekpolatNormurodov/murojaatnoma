import { Call, Sms, Edit2, ArrowRight } from 'iconsax-react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@/shared/ui/Modal';
import { Avatar } from '@/shared/ui/Avatar';

/** Odam turi — qo'ng'iroq/chat imkoniyatlarini shu bo'yicha aniqlaymiz. */
export type PersonKind = 'worker' | 'staff' | 'deputy' | 'citizen';

/**
 * Har qanday sahifada ko'rsatiladigan odam (ishchi, xodim, o'rinbosar yoki
 * fuqaro) uchun umumiy, yengil ma'lumot. Avatar bosilganda shu obyekt bilan
 * `PersonProfileModal` ochiladi.
 */
export interface PersonRef {
  id: string;
  name: string;
  photo?: string;
  color?: string; // avatar rangi
  position?: string; // lavozim / rol / yo'nalish
  phone?: string;
  kind: PersonKind;
}

/** Odam turi bo'yicha yorliq (badge) — ism yonida ko'rsatiladi. */
const KIND_META: Record<PersonKind, { label: string; color: string }> = {
  worker: { label: 'Ishchi', color: '#10b981' },
  staff: { label: 'Xodim', color: '#3b82f6' },
  deputy: { label: "O'rinbosar", color: '#a855f7' },
  citizen: { label: 'Fuqaro', color: '#64748b' },
};

/** Bitta tezkor amal tugmasi — WorkerDetail "Tezkor amallar" uslubida. */
function ActionButton({
  icon,
  label,
  accent,
  onClick,
  disabled,
  title,
}: {
  icon: React.ReactNode;
  label: string;
  accent: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className={accent}>{icon}</span> {label}
    </button>
  );
}

/**
 * Umumiy "odam profili" oynasi — istalgan joyda avatar/ism bosilganda ochiladi.
 * Header (avatar + ism + lavozim), telefon `tel:` havolasi va tezkor amallar
 * qatori (Qo'ng'iroq / Chat / Tahrirlash / To'liq profil) ko'rsatiladi.
 *
 * `onCall` — umumiy qo'ng'iroq ulanishi (keyinchalik WebRTC `call:invite` shu
 * yerga ulanadi); berilmasa `tel:` havolasiga tushadi.
 */
export function PersonProfileModal({
  person,
  onClose,
  onEdit,
  onViewPage,
  onCall,
}: {
  person: PersonRef | null;
  onClose: () => void;
  onEdit?: (p: PersonRef) => void;
  onViewPage?: (p: PersonRef) => void;
  onCall?: (p: PersonRef) => void;
}) {
  const navigate = useNavigate();

  return (
    <Modal
      open={!!person}
      onClose={onClose}
      title="Profil"
      subtitle={person?.position}
      width={420}
    >
      {person && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            <Avatar name={person.name} src={person.photo} color={person.color} size={64} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-ink">{person.name}</h3>
                <span
                  className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    background: `${KIND_META[person.kind].color}1a`,
                    color: KIND_META[person.kind].color,
                  }}
                >
                  {KIND_META[person.kind].label}
                </span>
              </div>
              {person.position && (
                <p className="mt-0.5 text-[13px] text-ink-muted">{person.position}</p>
              )}
              {person.phone && (
                <a
                  href={`tel:${person.phone}`}
                  className="mt-1 flex items-center gap-1.5 text-[13px] text-accent-600"
                >
                  <Call size={14} variant="Bulk" /> {person.phone}
                </a>
              )}
            </div>
          </div>

          {/* Tezkor amallar */}
          <div className="grid grid-cols-2 gap-2">
            {/* Qo'ng'iroq — onCall bo'lsa umumiy handler, aks holda tel:, aks holda o'chirilgan */}
            {onCall ? (
              <ActionButton
                icon={<Call size={16} variant="Bulk" />}
                label="Qo'ng'iroq"
                accent="text-primary-500"
                onClick={() => onCall(person)}
              />
            ) : person.phone ? (
              <a
                href={`tel:${person.phone}`}
                className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2"
              >
                <Call size={16} variant="Bulk" className="text-primary-500" /> Qo'ng'iroq
              </a>
            ) : (
              <ActionButton
                icon={<Call size={16} variant="Bulk" />}
                label="Qo'ng'iroq"
                accent="text-primary-500"
                disabled
                title="tez orada"
              />
            )}

            {/* Chat — faqat xodim/o'rinbosar uchun (fuqaroga ko'rsatilmaydi) */}
            {person.kind !== 'citizen' && (
              <ActionButton
                icon={<Sms size={16} variant="Bulk" />}
                label="Chat"
                accent="text-accent-500"
                onClick={() => navigate(`/chat?to=${person.id}`)}
              />
            )}

            {/* Tahrirlash — faqat onEdit berilganda */}
            {onEdit && (
              <ActionButton
                icon={<Edit2 size={16} variant="Bulk" />}
                label="Tahrirlash"
                accent="text-warning"
                onClick={() => onEdit(person)}
              />
            )}

            {/* To'liq profil — faqat onViewPage berilganda */}
            {onViewPage && (
              <ActionButton
                icon={<ArrowRight size={16} variant="Bulk" />}
                label="Profilga o'tish"
                accent="text-primary-600"
                onClick={() => onViewPage(person)}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
