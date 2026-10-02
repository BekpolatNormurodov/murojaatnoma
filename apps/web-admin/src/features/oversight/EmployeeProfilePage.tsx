import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft2,
  ArchiveBook,
  Building,
  Calendar,
  CallCalling,
  Clock,
  CloseCircle,
  Edit2,
  Location,
  Map1,
  MessageText1,
  MessageQuestion,
  Moneys,
  Profile2User,
  Refresh2,
  RotateRight,
  ScanBarcode,
  Star1,
  TickCircle,
  Timer1,
  UserRemove,
  Warning2,
  type Icon as IconType,
} from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { Modal } from '@/shared/ui/Modal';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { cn } from '@/shared/lib/cn';
import { formatDateTime, formatSom, timeAgo } from '@/shared/lib/format';
import { usePermissions } from '@/shared/lib/permissions';
import { EmployeeFormModal } from './EmployeeFormModal';
import { AssignZonesModal } from './AssignZonesModal';
import { ArchiveEmployeeDialog } from './ArchiveEmployeeDialog';
import { useResetFace, useRestoreEmployee } from './useEmployeeMutations';
import {
  useEmployeeMurojaats,
  useEmployeeProfile,
  type DayStatus,
  type EmployeeMurojaatRow,
  type EmployeeProfile,
  type MurojaatScope,
  type ProfileDay,
} from './useEmployeeProfile';

type Tab = 'overview' | 'attendance' | 'murojaat' | 'finance';

const TABS: { key: Tab; label: string; icon: IconType }[] = [
  { key: 'overview', label: 'Umumiy', icon: Profile2User },
  { key: 'attendance', label: 'Davomat', icon: Calendar },
  { key: 'murojaat', label: 'Murojaatlar', icon: MessageQuestion },
  { key: 'finance', label: 'Oylik va premya', icon: Moneys },
];

const DAY_META: Record<DayStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' }> = {
  present: { label: 'Keldi', tone: 'success' },
  late: { label: 'Kechikdi', tone: 'warning' },
  left: { label: 'Ketdi', tone: 'success' },
  absent: { label: 'Kelmadi', tone: 'danger' },
  leave: { label: "Ta'tilda", tone: 'info' },
  dayoff: { label: 'Dam olish', tone: 'neutral' },
};

const WEEKDAYS = ['Yak', 'Dush', 'Sesh', 'Chor', 'Pay', 'Jum', 'Shan'];

function hhmm(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Xodimning ichki profili — bitta sahifada hammasi: kimligi va ish tartibi,
 * bugun qayerda, oxirgi 31 kun davomati (yuz skan kadrlari bilan), qaysi
 * murojaatlarga javob bergani (filtrlar bilan) va oylik/premya. Shu yerdan
 * tahrirlash, hudud, yuzni qayta o'rnatish, ishdan bo'shatish/tiklash.
 */
export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'overview') as Tab;
  const setTab = (t: Tab) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (t === 'overview') next.delete('tab');
        else next.set('tab', t);
        return next;
      },
      { replace: true },
    );

  const { data: p, isLoading, isError, error, refetch } = useEmployeeProfile(id);
  const { canWrite } = usePermissions();
  const [editing, setEditing] = useState(false);
  const [zones, setZones] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [faceReset, setFaceReset] = useState(false);
  const [zoom, setZoom] = useState<{ url: string; caption: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const restore = useRestoreEmployee();
  const resetFace = useResetFace();

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-44 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-24 animate-pulse rounded-2xl bg-surface-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-2" />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <Card className="flex flex-col items-center gap-3 p-14 text-center">
        <CloseCircle size={40} variant="Bulk" className="text-danger" />
        <p className="font-semibold text-ink">Xodimni ochib bo'lmadi</p>
        <p className="text-sm text-ink-muted">{error instanceof Error ? error.message : 'Topilmadi'}</p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate('/oversight')}>
            <ArrowLeft2 size={16} /> Ro'yxatga
          </Button>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </div>
      </Card>
    );
  }

  const formRow = {
    employeeId: p.employeeId,
    fullName: p.fullName,
    position: p.position,
    phone: p.phone,
    username: p.username,
    avatarUrl: p.avatarUrl,
    salaryBase: p.month.salaryBase,
  };

  return (
    <div className="pb-10">
      <Link
        to={p.isActive ? '/oversight' : '/oversight?view=archive'}
        className="mb-4 inline-flex items-center gap-1.5 rounded-lg py-1 text-[13px] font-medium text-ink-muted hover:text-ink"
      >
        <ArrowLeft2 size={16} /> Xodimlar boshqaruvi
      </Link>

      <Hero
        p={p}
        canWrite={canWrite}
        onZoom={() => p.avatarUrl && setZoom({ url: p.avatarUrl, caption: p.fullName })}
        onEdit={() => setEditing(true)}
        onZones={() => setZones(true)}
        onArchive={() => setArchiving(true)}
        onRestore={async () => {
          try {
            await restore.mutateAsync(p.employeeId);
            flash(`${p.fullName} qayta ishga tiklandi`);
          } catch (e) {
            flash(e instanceof Error ? e.message : "Tiklab bo'lmadi");
          }
        }}
        restoring={restore.isPending}
      />

      <MonthStrip p={p} />

      <div className="-mx-4 mt-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex gap-1 rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Bo'limlar">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = t.key === 'murojaat' ? p.murojaat.assigned : null;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={cn(
                  'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-[13px] font-medium transition-colors',
                  active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                <t.icon size={16} variant={active ? 'Bulk' : 'Linear'} />
                {t.label}
                {count != null && count > 0 && (
                  <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular-nums text-ink-muted">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4">
        {tab === 'overview' && (
          <OverviewTab p={p} canWrite={canWrite} onZones={() => setZones(true)} onFaceReset={() => setFaceReset(true)} />
        )}
        {tab === 'attendance' && <AttendanceTab p={p} onZoom={setZoom} />}
        {tab === 'murojaat' && <MurojaatTab p={p} />}
        {tab === 'finance' && <FinanceTab p={p} />}
      </div>

      <EmployeeFormModal
        open={editing}
        row={formRow}
        year={p.month.year}
        month={p.month.month}
        onClose={() => setEditing(false)}
        onDone={flash}
      />
      <AssignZonesModal
        row={
          zones
            ? { employeeId: p.employeeId, fullName: p.fullName, assignedMahallaCodes: p.assignedMahallas.map((m) => m.code) }
            : null
        }
        onClose={() => setZones(false)}
      />
      <ArchiveEmployeeDialog
        employee={archiving ? { id: p.employeeId, fullName: p.fullName } : null}
        onClose={() => setArchiving(false)}
        onDone={flash}
      />
      <ConfirmDialog
        open={faceReset}
        onClose={() => (resetFace.isPending ? undefined : setFaceReset(false))}
        onConfirm={async () => {
          try {
            const r = await resetFace.mutateAsync(p.employeeId);
            flash(`Yuz qayta o'rnatildi (${r.removed} ta shablon o'chdi) — xodim ilovada yuzini qayta ro'yxatdan o'tkazadi`);
            setFaceReset(false);
          } catch (e) {
            flash(e instanceof Error ? e.message : "Bajarib bo'lmadi");
          }
        }}
        tone="danger"
        icon={ScanBarcode}
        title="Yuzni qayta o'rnatish"
        message={
          <>
            <span className="font-semibold text-ink">{p.fullName}</span> ning yuz shablonlari o'chiriladi. Keyingi
            keldi-ketdida ilova yuzni qaytadan ro'yxatdan o'tkazishni so'raydi. Telefon almashganda yoki yuz tanilmay
            qolganda ishlating.
          </>
        }
        confirmLabel="Qayta o'rnatish"
        loading={resetFace.isPending}
      />
      <Modal open={!!zoom} onClose={() => setZoom(null)} title={zoom?.caption} width={460}>
        {zoom && <img src={zoom.url} alt={zoom.caption} className="mx-auto max-h-[70vh] w-full rounded-xl object-contain" />}
      </Modal>
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[70] mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-xl bg-ink px-4 py-2.5 text-center text-sm font-medium text-white shadow-pop"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Hero ───────────────────────── */

function Hero({
  p,
  canWrite,
  onZoom,
  onEdit,
  onZones,
  onArchive,
  onRestore,
  restoring,
}: {
  p: EmployeeProfile;
  canWrite: boolean;
  onZoom: () => void;
  onEdit: () => void;
  onZones: () => void;
  onArchive: () => void;
  onRestore: () => void;
  restoring: boolean;
}) {
  const live = p.live;
  return (
    <Card className="overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-primary-600/90 via-primary-500/80 to-emerald-400/70 sm:h-24" />
      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-10 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <button
              type="button"
              onClick={onZoom}
              disabled={!p.avatarUrl}
              aria-label={p.avatarUrl ? 'Rasmni kattalashtirish' : undefined}
              className={cn(
                'shrink-0 rounded-full ring-4 ring-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-500 disabled:cursor-default',
                !p.isActive && 'grayscale',
              )}
            >
              <Avatar name={p.fullName} src={p.avatarUrl ?? undefined} size={92} />
            </button>
            <div className="min-w-0 pt-11 sm:pt-[3.75rem]">
              <h1 className="break-words text-xl font-bold leading-tight text-ink sm:text-2xl">{p.fullName}</h1>
              <p className="mt-0.5 text-[13.5px] text-ink-soft">
                {p.position}
                {p.department && <span className="text-ink-muted"> · {p.department}</span>}
              </p>
            </div>
          </div>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {p.isActive ? (
                <>
                  <Button variant="secondary" onClick={onEdit}>
                    <Edit2 size={16} /> Tahrirlash
                  </Button>
                  <Button variant="secondary" onClick={onZones}>
                    <Location size={16} /> Hudud
                  </Button>
                  <Button variant="ghost" onClick={onArchive} className="text-danger hover:bg-danger-soft">
                    <UserRemove size={16} /> Ishdan bo'shatish
                  </Button>
                </>
              ) : (
                <Button onClick={onRestore} disabled={restoring}>
                  {restoring ? <RotateRight size={16} className="animate-spin" /> : <Refresh2 size={16} />}
                  Qayta tiklash
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {p.isActive ? (
            <Badge tone="success" dot>
              Faol
            </Badge>
          ) : (
            <Badge tone="neutral">
              <ArchiveBook size={13} /> Arxivda · {p.archivedAt ? new Date(p.archivedAt).toLocaleDateString('uz-UZ') : ''}
            </Badge>
          )}
          <Badge tone={p.face.enrolled ? 'success' : 'warning'}>
            <ScanBarcode size={13} /> {p.face.enrolled ? 'Yuz ro‘yxatda' : 'Yuz yo‘q'}
          </Badge>
          {p.username ? <Badge tone="info">@{p.username}</Badge> : <Badge tone="warning">Login yo'q</Badge>}
          {live && (
            <Badge tone={live.stale ? 'neutral' : live.insideZone ? 'success' : 'danger'}>
              <Location size={13} /> {live.mahallaName ?? 'Joy aniqlanmadi'} · {timeAgo(live.at)}
            </Badge>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
          {!p.phone.startsWith('+99800') && (
            <a
              href={`tel:${p.phone}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2"
            >
              <CallCalling size={16} variant="Bulk" className="text-primary-600" /> {p.phone}
            </a>
          )}
          {p.isActive && (
            <>
              <Link
                to={`/chat?to=${encodeURIComponent(p.employeeId)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2"
              >
                <MessageText1 size={16} variant="Bulk" className="text-primary-600" /> Xabar yozish
              </Link>
              <Link
                to={`/map?employee=${encodeURIComponent(p.employeeId)}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2"
              >
                <Map1 size={16} variant="Bulk" className="text-primary-600" /> Xaritada
              </Link>
            </>
          )}
        </div>

        {!p.isActive && p.archiveReason && (
          <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[13px] text-ink-soft">
            Ishdan bo'shatish sababi: <span className="font-medium text-ink">{p.archiveReason}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

/* ───────────────────────── Bu oy ───────────────────────── */

const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

function MonthStrip({ p }: { p: EmployeeProfile }) {
  const m = p.month;
  const tiles: { label: string; value: string; hint?: string; icon: IconType; color: string }[] = [
    { label: 'Ish kunlari', value: String(m.daysWorked), hint: m.absentDays ? `${m.absentDays} kun kelmagan` : undefined, icon: TickCircle, color: '#10b981' },
    { label: 'Kechikishlar', value: String(m.lateDays), hint: m.lateMinutes ? `jami ${m.lateMinutes} daq` : undefined, icon: Timer1, color: '#f59e0b' },
    { label: 'Ishlagan soat', value: m.hours.toFixed(1), icon: Clock, color: '#3b82f6' },
    { label: 'Hal qilgan murojaat', value: String(p.murojaat.resolved), hint: `${p.murojaat.answered} tasiga javob bergan`, icon: MessageQuestion, color: '#8b5cf6' },
    { label: "O'rtacha baho", value: p.murojaat.avgRating != null ? `${p.murojaat.avgRating}/5` : '—', icon: Star1, color: '#eab308' },
  ];
  return (
    <div className="mt-4">
      <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
        {MONTHS[m.month - 1]} {m.year} — bu oy
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: `${t.color}1a`, color: t.color }}>
                <t.icon size={16} variant="Bulk" />
              </span>
              <span className="text-xl font-bold tabular-nums text-ink">{t.value}</span>
            </div>
            <p className="mt-1.5 truncate text-[12px] text-ink-soft">{t.label}</p>
            {t.hint && <p className="truncate text-[11px] text-ink-muted">{t.hint}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── Umumiy ───────────────────────── */

function OverviewTab({
  p,
  canWrite,
  onZones,
  onFaceReset,
}: {
  p: EmployeeProfile;
  canWrite: boolean;
  onZones: () => void;
  onFaceReset: () => void;
}) {
  const rows: { icon: IconType; label: string; value: React.ReactNode }[] = [
    { icon: Profile2User, label: 'Lavozim', value: p.position },
    { icon: Building, label: "Bo'lim", value: p.department ?? <span className="text-ink-muted">Biriktirilmagan</span> },
    { icon: Clock, label: 'Ish vaqti', value: `${p.workStartTime} – ${p.workEndTime}` },
    {
      icon: CallCalling,
      label: 'Telefon',
      value: p.phone.startsWith('+99800') ? <span className="text-ink-muted">Kiritilmagan</span> : p.phone,
    },
    { icon: Profile2User, label: 'Ilova logini', value: p.username ? `@${p.username}` : <span className="text-ink-muted">Yo'q</span> },
    { icon: Calendar, label: "Tizimga qo'shilgan", value: new Date(p.createdAt).toLocaleDateString('uz-UZ') },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_1fr]">
      <Card className="p-5">
        <h3 className="mb-3 text-[15px] font-semibold text-ink">Ma'lumotlar</h3>
        <dl className="divide-y divide-line">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center gap-3 py-2.5">
              <r.icon size={17} variant="Bulk" className="shrink-0 text-ink-muted" />
              <dt className="w-36 shrink-0 text-[13px] text-ink-muted">{r.label}</dt>
              <dd className="min-w-0 flex-1 break-words text-[13.5px] font-medium text-ink">{r.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Ish hududi</h3>
            {canWrite && p.isActive && (
              <button onClick={onZones} className="text-[12.5px] font-medium text-primary-600 hover:underline">
                O'zgartirish
              </button>
            )}
          </div>
          {p.assignedMahallas.length === 0 ? (
            <p className="text-[13px] text-ink-soft">Butun tuman (mahalla biriktirilmagan)</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {p.assignedMahallas.map((m) => (
                <span key={m.code} className="rounded-lg bg-primary-50 px-2 py-1 text-[12px] font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
                  {m.name}
                </span>
              ))}
            </div>
          )}
          <p className="mt-3 text-[12px] text-ink-muted">
            {p.office
              ? `Shaxsiy ofis nuqtasi: ${p.office.lat.toFixed(5)}, ${p.office.lng.toFixed(5)} · ${p.office.radiusM} m`
              : 'Ofis: umumiy hokimiyat binosi'}
          </p>
        </Card>

        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-semibold text-ink">Yuz tasdiqlash</h3>
            {canWrite && p.isActive && p.face.enrolled && (
              <button onClick={onFaceReset} className="text-[12.5px] font-medium text-danger hover:underline">
                Qayta o'rnatish
              </button>
            )}
          </div>
          {p.face.enrolled ? (
            <p className="text-[13px] text-ink-soft">
              {p.face.templates} ta shablon · oxirgisi {p.face.lastAt ? formatDateTime(p.face.lastAt) : '—'}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-amber-700 dark:text-amber-400">
              <Warning2 size={16} variant="Bulk" /> Xodim ilovada yuzini hali ro'yxatdan o'tkazmagan
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ───────────────────────── Davomat ───────────────────────── */

function AttendanceTab({ p, onZoom }: { p: EmployeeProfile; onZoom: (z: { url: string; caption: string }) => void }) {
  const [onlyProblems, setOnlyProblems] = useState(false);
  const days = onlyProblems ? p.attendance.filter((d) => d.status === 'absent' || d.status === 'late') : p.attendance;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 sm:px-5">
        <div>
          <h3 className="text-[15px] font-semibold text-ink">Oxirgi 31 kun</h3>
          <p className="text-[12px] text-ink-muted">Ish vaqti {p.workStartTime}–{p.workEndTime} · rasm bosilsa kattalashadi</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-soft">
          <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} className="h-4 w-4 accent-primary-600" />
          Faqat kechikkan / kelmagan
        </label>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="border-y border-line text-[11px] uppercase tracking-wider text-ink-muted">
              <th className="px-5 py-2.5 font-semibold">Sana</th>
              <th className="px-3 py-2.5 font-semibold">Holat</th>
              <th className="px-3 py-2.5 font-semibold">Keldi</th>
              <th className="px-3 py-2.5 font-semibold">Ketdi</th>
              <th className="px-5 py-2.5 text-right font-semibold">Soat</th>
            </tr>
          </thead>
          <tbody>
            {days.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-sm text-ink-muted">
                  Bu davrda muammo yo'q
                </td>
              </tr>
            ) : (
              days.map((d) => <DayRow key={d.date} d={d} name={p.fullName} onZoom={onZoom} />)
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DayRow({ d, name, onZoom }: { d: ProfileDay; name: string; onZoom: (z: { url: string; caption: string }) => void }) {
  const date = new Date(`${d.date}T00:00:00`);
  const meta = DAY_META[d.status];
  const muted = d.status === 'dayoff';
  return (
    <tr className={cn('border-b border-line/60', muted && 'text-ink-muted')}>
      <td className="whitespace-nowrap px-5 py-2.5">
        <span className="font-medium tabular-nums text-ink">{`${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`}</span>
        <span className="ml-2 text-[12px] text-ink-muted">{WEEKDAYS[date.getDay()]}</span>
      </td>
      <td className="px-3 py-2.5">
        <Badge tone={meta.tone} dot>
          {meta.label}
          {d.checkIn?.isLate ? ` · ${d.checkIn.lateMinutes} daq` : ''}
        </Badge>
      </td>
      <td className="px-3 py-2.5">
        <ScanCell time={d.checkIn?.time} photo={d.checkIn?.photoUrl} caption={`${name} · keldi ${hhmm(d.checkIn?.time)}, ${d.date}`} onZoom={onZoom} />
      </td>
      <td className="px-3 py-2.5">
        <ScanCell time={d.checkOut?.time} photo={d.checkOut?.photoUrl} caption={`${name} · ketdi ${hhmm(d.checkOut?.time)}, ${d.date}`} onZoom={onZoom} />
      </td>
      <td className="px-5 py-2.5 text-right tabular-nums text-ink-soft">{d.hoursWorked != null ? d.hoursWorked.toFixed(1) : '—'}</td>
    </tr>
  );
}

function ScanCell({
  time,
  photo,
  caption,
  onZoom,
}: {
  time?: string;
  photo?: string | null;
  caption: string;
  onZoom: (z: { url: string; caption: string }) => void;
}) {
  const [broken, setBroken] = useState(false);
  if (!time) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex items-center gap-2">
      {photo && !broken && (
        <button
          type="button"
          onClick={() => onZoom({ url: photo, caption })}
          aria-label={`Skan rasmi: ${caption}`}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-line transition-transform hover:scale-110"
        >
          <img src={photo} alt="" loading="lazy" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        </button>
      )}
      <span className="font-medium tabular-nums text-ink">{hhmm(time)}</span>
    </span>
  );
}

/* ───────────────────────── Murojaatlar ───────────────────────── */

const SCOPES: { key: MurojaatScope; label: string }[] = [
  { key: 'all', label: 'Hammasi' },
  { key: 'assigned', label: 'Biriktirilgan' },
  { key: 'answered', label: 'Javob bergan' },
  { key: 'resolved', label: 'Hal qilgan' },
];

const STATUS_META: Record<EmployeeMurojaatRow['status'], { label: string; tone: 'info' | 'warning' | 'success' | 'danger' }> = {
  NEW: { label: 'Yangi', tone: 'info' },
  IN_PROGRESS: { label: 'Jarayonda', tone: 'warning' },
  RESOLVED: { label: 'Hal qilingan', tone: 'success' },
  REJECTED: { label: 'Rad etilgan', tone: 'danger' },
};

function MurojaatTab({ p }: { p: EmployeeProfile }) {
  const navigate = useNavigate();
  const [scope, setScope] = useState<MurojaatScope>('all');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [days, setDays] = useState(0);
  const q = useEmployeeMurojaats(p.employeeId, { scope, status: status || undefined, kind: kind || undefined, days: days || undefined });
  const rows = q.data ?? [];
  const s = p.murojaat;

  const summary = useMemo(
    () => [
      { label: 'Biriktirilgan', value: s.assigned },
      { label: 'Ochiq', value: s.open },
      { label: "Muddati o'tgan", value: s.overdue, danger: s.overdue > 0 },
      { label: 'Hal qilgan', value: s.resolved },
      { label: 'Javob bergan', value: s.answered },
      { label: "O'rtacha 1-javob", value: s.avgFirstReplyHours != null ? `${s.avgFirstReplyHours} soat` : '—' },
    ],
    [s],
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface px-3.5 py-3">
            <p className={cn('text-xl font-bold tabular-nums', 'danger' in t && t.danger ? 'text-red-600' : 'text-ink')}>{t.value}</p>
            <p className="truncate text-[12px] text-ink-muted">{t.label}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 px-4 pt-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface-2 p-1" role="tablist" aria-label="Qaysi murojaatlar">
            {SCOPES.map((sc) => (
              <button
                key={sc.key}
                role="tab"
                aria-selected={scope === sc.key}
                onClick={() => setScope(sc.key)}
                className={cn(
                  'rounded-[10px] px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  scope === sc.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {sc.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Select label="Holat" value={status} onChange={setStatus} options={[['', 'Barcha holat'], ['NEW', 'Yangi'], ['IN_PROGRESS', 'Jarayonda'], ['RESOLVED', 'Hal qilingan'], ['REJECTED', 'Rad etilgan']]} />
            <Select label="Turi" value={kind} onChange={setKind} options={[['', 'Ariza va shikoyat'], ['ARIZA', 'Ariza'], ['SHIKOYAT', 'Shikoyat']]} />
            <Select
              label="Davr"
              value={String(days)}
              onChange={(v) => setDays(Number(v))}
              options={[['0', 'Butun davr'], ['7', 'Oxirgi 7 kun'], ['30', 'Oxirgi 30 kun'], ['90', 'Oxirgi 3 oy']]}
            />
          </div>
        </div>

        <div className="mt-3">
          {q.isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <MessageQuestion size={36} variant="Bulk" className="text-ink-muted" />
              <p className="text-sm text-ink-soft">Bu filtrlar bo'yicha murojaat yo'q</p>
            </div>
          ) : (
            <ul className="divide-y divide-line border-t border-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => navigate(`/requests?id=${encodeURIComponent(r.id)}`)}
                    className="flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors hover:bg-surface-2 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold',
                            r.kind === 'SHIKOYAT' ? 'bg-danger-soft text-red-700' : 'bg-primary-50 text-primary-700 dark:bg-primary-500/10',
                          )}
                        >
                          {r.kind === 'SHIKOYAT' ? 'Shikoyat' : 'Ariza'}
                        </span>
                        {r.overdue && (
                          <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[10.5px] font-semibold text-white">Muddati o'tgan</span>
                        )}
                        {!r.assignedToThem && (
                          <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-ink-muted">Boshqasiga biriktirilgan</span>
                        )}
                        <span className="truncate text-[13.5px] font-semibold text-ink">{r.title}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-[12px] text-ink-muted">
                        {r.citizenName}
                        {r.category ? ` · ${r.category}` : ''} · {new Date(r.createdAt).toLocaleDateString('uz-UZ')}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-wrap items-center gap-2 text-[12px]">
                      {r.replies > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" title={r.lastReplyAt ? `Oxirgi javob: ${formatDateTime(r.lastReplyAt)}` : undefined}>
                          <MessageText1 size={13} variant="Bulk" /> {r.replies} ta javob
                        </span>
                      ) : (
                        <span className="rounded-lg bg-surface-2 px-2 py-1 text-ink-muted">Javob yo'q</span>
                      )}
                      {r.rating != null && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-amber-600">
                          <Star1 size={13} variant="Bold" /> {r.rating}
                        </span>
                      )}
                      <Badge tone={STATUS_META[r.status].tone} dot>
                        {STATUS_META[r.status].label}
                      </Badge>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink outline-none focus:border-primary-300"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

/* ───────────────────────── Moliya ───────────────────────── */

function FinanceTab({ p }: { p: EmployeeProfile }) {
  const m = p.month;
  const items = [
    { label: 'Asosiy oylik', value: m.salaryBase != null ? formatSom(m.salaryBase) : 'Belgilanmagan' },
    { label: "Premya (bu oy)", value: formatSom(m.premya), accent: m.premya > 0 },
    { label: "Sof oylik (premya va ushlanma bilan)", value: m.salaryNet != null ? formatSom(m.salaryNet) : '—', strong: true },
  ];
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-semibold text-ink">
        {MONTHS[m.month - 1]} {m.year}
      </h3>
      <dl className="mt-3 divide-y divide-line">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between gap-3 py-3">
            <dt className="text-[13.5px] text-ink-soft">{i.label}</dt>
            <dd
              className={cn(
                'tabular-nums',
                i.strong ? 'text-lg font-bold text-primary-700 dark:text-primary-300' : 'font-semibold text-ink',
                i.accent && 'text-emerald-600',
              )}
            >
              {i.value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/salaries" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2">
          <Moneys size={16} variant="Bulk" className="text-primary-600" /> Oyliklar sahifasi
        </Link>
        <Link to="/bonuses" className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-[13px] font-medium text-ink-soft hover:bg-surface-2">
          <Star1 size={16} variant="Bulk" className="text-amber-500" /> Premyalar
        </Link>
      </div>
    </Card>
  );
}
