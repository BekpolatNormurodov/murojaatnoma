import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  SearchNormal1,
  Danger,
  Flag,
  Location,
  Clock,
  CallCalling,
  TickCircle,
  Hierarchy,
  Calendar,
  ArrowRight,
  Send2,
  Messages1,
  TickSquare,
  CloseCircle,
  RotateRight,
  Trash,
  type Icon as IconType,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Badge } from '@/shared/ui/Badge';
import { Avatar } from '@/shared/ui/Avatar';
import { Drawer } from '@/shared/ui/Drawer';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import {
  COMPLAINT_SEVERITY_META,
  COMPLAINT_STATUS_META,
  getDeputy,
} from '@/shared/data/mock';
import { useComplaints } from '@/shared/store/complaints';
import type { Complaint, ComplaintStatus } from '@/shared/data/types';
import { formatDate, timeAgo } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} />;
}

const STATUS_TABS: { key: ComplaintStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Barchasi' },
  { key: 'new', label: 'Yangi' },
  { key: 'reviewing', label: "Ko'rib chiqilmoqda" },
  { key: 'resolved', label: 'Hal qilingan' },
  { key: 'rejected', label: 'Rad etilgan' },
];

/** Backenddan kutilmagan qiymat kelsa ham UI qulamasligi uchun himoyalangan meta. */
const FALLBACK_SEVERITY: (typeof COMPLAINT_SEVERITY_META)['low'] = {
  label: "Noma'lum",
  tone: 'neutral',
  color: '#94a3b8',
};
const FALLBACK_STATUS: (typeof COMPLAINT_STATUS_META)['new'] = {
  label: "Noma'lum",
  tone: 'neutral',
};

function severityMeta(s: Complaint['severity']) {
  return COMPLAINT_SEVERITY_META[s] ?? FALLBACK_SEVERITY;
}
function statusMeta(s: Complaint['status']) {
  return COMPLAINT_STATUS_META[s] ?? FALLBACK_STATUS;
}

function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000);
}

function DeadlineChip({ c }: { c: Complaint }) {
  const done = c.status === 'resolved' || c.status === 'rejected';
  if (done) {
    return (
      <span className="flex items-center gap-1 text-[12px] font-medium text-primary-600">
        <TickCircle size={13} variant="Bulk" /> Yopildi
      </span>
    );
  }
  const left = daysLeft(c.deadlineAt);
  const overdue = left < 0;
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[12px] font-medium',
        overdue ? 'text-danger' : left <= 1 ? 'text-amber-600' : 'text-ink-muted',
      )}
    >
      <Clock size={13} variant="Bulk" />
      {overdue ? `${Math.abs(left)} kun kechikdi` : `${left} kun qoldi`}
    </span>
  );
}

export function ComplaintsPage() {
  const complaints = useComplaints((s) => s.complaints);
  const loading = useComplaints((s) => s.loading);
  const error = useComplaints((s) => s.error);
  const fetchComplaints = useComplaints((s) => s.fetchComplaints);
  const [tab, setTab] = useState<ComplaintStatus | 'all'>('all');
  const [severity, setSeverity] = useState<Complaint['severity'] | 'all'>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = complaints.find((c) => c.id === selectedId) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints.filter((c) => {
      if (tab !== 'all' && c.status !== tab) return false;
      if (severity !== 'all' && c.severity !== severity) return false;
      if (!q) return true;
      return (
        c.title.toLowerCase().includes(q) ||
        c.topic.toLowerCase().includes(q) ||
        c.region.toLowerCase().includes(q) ||
        c.citizenName.toLowerCase().includes(q)
      );
    });
  }, [complaints, tab, severity, query]);

  const stats = useMemo(() => {
    const total = complaints.length;
    const fresh = complaints.filter((c) => c.status === 'new').length;
    const reviewing = complaints.filter((c) => c.status === 'reviewing').length;
    const resolved = complaints.filter((c) => c.status === 'resolved').length;
    const escalated = complaints.filter((c) => c.escalated).length;
    return { total, fresh, reviewing, resolved, escalated };
  }, [complaints]);

  const counts = useMemo(
    () =>
      STATUS_TABS.reduce<Record<string, number>>((acc, t) => {
        acc[t.key] =
          t.key === 'all'
            ? complaints.length
            : complaints.filter((c) => c.status === t.key).length;
        return acc;
      }, {}),
    [complaints],
  );

  const hasActiveFilters = tab !== 'all' || severity !== 'all' || query.trim() !== '';
  function resetFilters() {
    setTab('all');
    setSeverity('all');
    setQuery('');
  }

  return (
    <div>
      <PageHeader
        title="Shikoyatlar"
        subtitle="Fuqarolarning rasmiy shikoyatlari — yo'nalish bo'yicha hokim o'rinbosarlariga biriktiriladi"
        action={
          <div
            role="status"
            aria-atomic="true"
            className="flex items-center gap-2 rounded-xl border border-danger-soft bg-danger-soft px-3.5 py-2 text-[13px] font-medium text-red-700"
          >
            <Flag size={17} variant="Bulk" /> {stats.escalated} ta nazoratda
          </div>
        }
      />

      {error ? (
        <Card role="alert" className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">{error}</p>
          </div>
          <Button variant="secondary" onClick={() => fetchComplaints()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : loading && complaints.length === 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[92px]" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px]" />
            ))}
          </div>
        </div>
      ) : (
        <>
      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Danger} label="Jami shikoyatlar" value={String(stats.total)} tint="#ef4444" index={0} />
        <StatCard icon={Flag} label="Yangi" value={String(stats.fresh)} tint="#3b82f6" index={1} />
        <StatCard icon={Clock} label="Ko'rib chiqilmoqda" value={String(stats.reviewing)} tint="#f59e0b" index={2} />
        <StatCard icon={TickCircle} label="Hal qilingan" value={String(stats.resolved)} tint="#10b981" index={3} />
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition-colors',
                tab === t.key
                  ? 'bg-ink text-white'
                  : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              {t.label}
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px]',
                  tab === t.key ? 'bg-white/20' : 'bg-surface-2 text-ink-muted',
                )}
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <SearchNormal1 size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish..."
            aria-label="Shikoyatlar orasidan qidirish"
            className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-sm outline-none focus:border-primary-300"
          />
        </div>
      </div>

      {/* Severity filter */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          onClick={() => setSeverity('all')}
          className={cn(
            'rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
            severity === 'all' ? 'bg-primary-600 text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
          )}
        >
          Barcha darajalar
        </button>
        {(['high', 'medium', 'low'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverity(s)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors',
              severity === s ? 'text-white' : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
            )}
            style={severity === s ? { background: COMPLAINT_SEVERITY_META[s].color } : undefined}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: severity === s ? '#fff' : COMPLAINT_SEVERITY_META[s].color }}
            />
            {COMPLAINT_SEVERITY_META[s].label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((c, i) => {
          const deputy = getDeputy(c.deputyId);
          const sev = severityMeta(c.severity);
          const st = statusMeta(c.status);
          return (
            <motion.button
              key={c.id}
              type="button"
              onClick={() => setSelectedId(c.id)}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.35 }}
              className="group relative overflow-hidden rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-pop"
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ background: sev.color }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                    style={{ background: sev.color }}
                  >
                    {sev.label}
                  </span>
                  {c.isRepeat && <Badge tone="warning">Takroriy</Badge>}
                </div>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
              </div>

              <h3 className="mt-2.5 line-clamp-2 text-[15px] font-semibold text-ink">{c.title}</h3>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-ink-muted">
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-medium text-ink-soft">{c.topic}</span>
                {c.escalated && (
                  <span className="flex items-center gap-0.5 font-medium text-danger">
                    <Flag size={12} variant="Bulk" /> Yuqoriga ko'tarilgan
                  </span>
                )}
              </div>

              {/* Citizen */}
              <div className="mt-3 flex items-center gap-2.5 border-t border-line pt-3">
                <Avatar src={c.citizenPhoto} name={c.citizenName} size={34} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-ink">{c.citizenName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-ink-muted">
                    <Location size={11} variant="Bulk" /> {c.region}
                  </div>
                </div>
                <ArrowRight
                  size={16}
                  className="text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600"
                />
              </div>

              {/* Deputy + deadline */}
              <div className="mt-3 flex items-center justify-between gap-2">
                {deputy ? (
                  <div className="flex min-w-0 items-center gap-1.5">
                    <Avatar src={deputy.photo} name={deputy.name} color={deputy.color} size={22} />
                    <span className="truncate text-[11.5px] text-ink-soft">{deputy.shortDirection}</span>
                  </div>
                ) : (
                  <span className="text-[11.5px] text-ink-muted">Biriktirilmagan</span>
                )}
                <DeadlineChip c={c} />
              </div>
            </motion.button>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Danger size={40} variant="Bulk" className="text-ink-muted" />
          {complaints.length === 0 ? (
            <>
              <p className="text-sm text-ink-muted">Hozircha shikoyatlar mavjud emas</p>
              <Button variant="secondary" size="sm" onClick={() => fetchComplaints()}>
                <RotateRight size={15} /> Qayta yuklash
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-muted">Mos shikoyatlar topilmadi</p>
              {hasActiveFilters && (
                <Button variant="secondary" size="sm" onClick={resetFilters}>
                  Filtrlarni tozalash
                </Button>
              )}
            </>
          )}
        </Card>
      )}
        </>
      )}

      <ComplaintDetail complaint={selected} onClose={() => setSelectedId(null)} />
    </div>
  );
}

/* ============================================================
   Holat o'zgartirish tasdiqi uchun matnlar
   ============================================================ */
type TransitionStatus = 'reviewing' | 'resolved' | 'rejected';
const STATUS_CONFIRM: Record<
  TransitionStatus,
  { title: string; message: string; tone: 'primary' | 'warning' | 'danger'; icon: IconType }
> = {
  reviewing: {
    title: "Ko'rib chiqishga o'tkazilsinmi?",
    message: 'Shikoyat holati "Ko\'rib chiqilmoqda"ga o\'zgaradi. Fuqaro ilovada buni ko\'radi.',
    tone: 'primary',
    icon: Clock,
  },
  resolved: {
    title: 'Shikoyat hal qilindi deb belgilansinmi?',
    message: 'Holat "Hal qilindi"ga o\'zgaradi va yopilgan sana qayd etiladi.',
    tone: 'primary',
    icon: TickCircle,
  },
  rejected: {
    title: 'Shikoyat rad etilsinmi?',
    message: 'Holat "Rad etildi"ga o\'zgaradi. Sababini rasmiy javobda ko\'rsatishni tavsiya qilamiz.',
    tone: 'danger',
    icon: CloseCircle,
  },
};

const MIN_REPLY_LEN = 3;

function ComplaintDetail({
  complaint,
  onClose,
}: {
  complaint: Complaint | null;
  onClose: () => void;
}) {
  const c = complaint;
  const deputy = c ? getDeputy(c.deputyId) : undefined;
  const author = deputy?.name ?? 'Hokimiyat';
  const addResponse = useComplaints((s) => s.addResponse);
  const setStatus = useComplaints((s) => s.setStatus);
  const deleteComplaint = useComplaints((s) => s.deleteComplaint);

  const [reply, setReply] = useState('');
  const [touched, setTouched] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const [pendingStatus, setPendingStatus] = useState<TransitionStatus | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setReply('');
    setTouched(false);
    setSendError(null);
    setSent(false);
    setPendingStatus(null);
    setStatusError(null);
    setDeleteOpen(false);
    setDeleteError(null);
  }, [c?.id]);

  const trimmedReply = reply.trim();
  const replyEmpty = touched && trimmedReply.length === 0;
  const replyTooShort = touched && trimmedReply.length > 0 && trimmedReply.length < MIN_REPLY_LEN;

  async function send() {
    setTouched(true);
    if (!c || trimmedReply.length < MIN_REPLY_LEN) return;
    setSending(true);
    setSendError(null);
    try {
      await addResponse(c.id, trimmedReply, author);
      setReply('');
      setTouched(false);
      setSent(true);
      window.setTimeout(() => setSent(false), 2500);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Javobni yuborib bo'lmadi");
    } finally {
      setSending(false);
    }
  }

  function requestStatus(s: TransitionStatus) {
    if (!c || c.status === s) return;
    setStatusError(null);
    setPendingStatus(s);
  }

  async function confirmStatus() {
    if (!c || !pendingStatus) return;
    setStatusChanging(true);
    try {
      await setStatus(c.id, pendingStatus);
      setPendingStatus(null);
      setStatusError(null);
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : "Holatni yangilab bo'lmadi");
    } finally {
      setStatusChanging(false);
    }
  }

  function closeStatusDialog() {
    if (statusChanging) return;
    setPendingStatus(null);
    setStatusError(null);
  }

  async function confirmDelete() {
    if (!c) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteComplaint(c.id);
      setDeleteOpen(false);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Shikoyatni o'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  }

  const sev = c ? severityMeta(c.severity) : null;
  const st = c ? statusMeta(c.status) : null;
  const sortedResponses = c
    ? [...c.responses].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
    : [];

  return (
    <Drawer
      open={!!c}
      onClose={onClose}
      title="Shikoyat tafsilotlari"
      subtitle={c ? `#${c.id}` : undefined}
      width={500}
    >
      {c && sev && st && (
        <div className="space-y-5">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white"
                  style={{ background: sev.color }}
                >
                  {sev.label} daraja
                </span>
                <Badge tone={st.tone} dot>
                  {st.label}
                </Badge>
                {c.isRepeat && <Badge tone="warning">Takroriy</Badge>}
                {c.escalated && (
                  <Badge tone="danger">
                    <Flag size={12} variant="Bulk" /> Nazoratda
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label="Shikoyatni o'chirish"
                className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl border border-danger-soft bg-danger-soft px-3 text-[12.5px] font-medium text-red-700 transition-colors hover:brightness-95"
              >
                <Trash size={16} variant="Bulk" /> O'chirish
              </button>
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink">{c.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{c.description}</p>
          </div>

          {/* Responsible deputy */}
          {deputy && (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <Hierarchy size={16} variant="Bulk" className="text-primary-600" /> Mas'ul hokim o'rinbosari
              </p>
              <div className="flex items-center gap-3">
                <Avatar src={deputy.photo} name={deputy.name} color={deputy.color} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-ink">{deputy.name}</div>
                  <div className="text-[12px] text-ink-muted">{deputy.shortDirection}</div>
                </div>
                <span
                  className="rounded-lg px-2 py-1 text-[11px] font-semibold"
                  style={{ background: `${deputy.color}1a`, color: deputy.color }}
                >
                  {c.topic}
                </span>
              </div>
            </div>
          )}

          {/* Citizen */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 text-[13px] font-semibold text-ink">Shikoyatchi</p>
            <div className="flex items-center gap-3">
              <Avatar src={c.citizenPhoto} name={c.citizenName} size={44} />
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{c.citizenName}</div>
                <a
                  href={`tel:${c.citizenPhone}`}
                  className="flex items-center gap-1.5 text-[13px] text-accent-600"
                >
                  <CallCalling size={14} variant="Bulk" /> {c.citizenPhone}
                </a>
              </div>
            </div>
          </div>

          {/* Location & meta */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Location size={16} variant="Bulk" className="text-ink-muted" /> Manzil
            </p>
            <p className="text-[13px] text-ink-soft">{c.address}</p>
          </div>

          <div className="divide-y divide-line rounded-2xl border border-line bg-surface px-4">
            <div className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Calendar size={15} variant="Bulk" className="text-ink-muted" /> Kelgan sana
              </span>
              <span className="text-sm font-medium text-ink">{formatDate(c.createdAt)} · {timeAgo(c.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                <Clock size={15} variant="Bulk" className="text-amber-500" /> Javob muddati
              </span>
              <DeadlineChip c={c} />
            </div>
            {c.resolvedAt && (
              <div className="flex items-center justify-between py-2.5">
                <span className="flex items-center gap-2 text-[13px] text-ink-soft">
                  <TickCircle size={15} variant="Bulk" className="text-primary-500" /> Yopilgan sana
                </span>
                <span className="text-sm font-medium text-ink">{formatDate(c.resolvedAt)}</span>
              </div>
            )}
          </div>

          {/* Holatni o'zgartirish */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-2.5 text-[13px] font-semibold text-ink">Holatni o'zgartirish</p>
            <div className="flex flex-wrap gap-1.5">
              {(['reviewing', 'resolved', 'rejected'] as TransitionStatus[]).map((s) => {
                const meta = statusMeta(s);
                const active = c.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => requestStatus(s)}
                    aria-pressed={active}
                    className={cn(
                      'flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-colors',
                      active
                        ? 'bg-ink text-white'
                        : 'border border-line bg-surface text-ink-soft hover:bg-surface-2',
                    )}
                  >
                    {s === 'resolved' && <TickSquare size={15} variant="Bulk" />}
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rasmiy javoblar */}
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="mb-3 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Messages1 size={16} variant="Bulk" className="text-primary-600" /> Rasmiy javoblar
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-ink-muted">
                {c.responses.length}
              </span>
            </p>

            {sortedResponses.length > 0 ? (
              <div className="space-y-3">
                {sortedResponses.map((r) => (
                  <div key={r.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">{r.author}</span>
                      <span className="text-[11px] text-ink-muted">{timeAgo(r.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{r.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-xl bg-surface-2 px-3 py-4 text-center text-[12.5px] text-ink-muted">
                Hozircha rasmiy javob yozilmagan
              </p>
            )}

            {/* Javob yozish */}
            <div className="mt-3">
              <label htmlFor="complaint-reply" className="sr-only">
                Rasmiy javob matni
              </label>
              <textarea
                id="complaint-reply"
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  if (sendError) setSendError(null);
                }}
                onBlur={() => setTouched(true)}
                rows={3}
                placeholder="Fuqaroga rasmiy javob yozing..."
                disabled={sending}
                aria-invalid={replyEmpty || replyTooShort || !!sendError}
                aria-describedby="complaint-reply-hint"
                className={cn(
                  'w-full resize-none rounded-xl border bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-colors focus:border-primary-300 disabled:opacity-60',
                  replyEmpty || replyTooShort || sendError ? 'border-danger' : 'border-line',
                )}
              />
              <div id="complaint-reply-hint" className="mt-1.5 min-h-[16px] text-[11.5px]">
                {replyEmpty ? (
                  <span role="alert" className="font-medium text-danger">
                    Javob matnini kiriting
                  </span>
                ) : replyTooShort ? (
                  <span role="alert" className="font-medium text-danger">
                    Javob kamida {MIN_REPLY_LEN} ta belgidan iborat bo'lsin
                  </span>
                ) : sendError ? (
                  <span role="alert" className="font-medium text-danger">
                    {sendError}
                  </span>
                ) : (
                  <span className="text-ink-muted">Fuqaro ushbu javobni ilovada ko'radi</span>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span aria-live="polite" className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  {sent && <TickCircle size={13} variant="Bold" className="text-primary-600" />}
                  {sent ? 'Yuborildi' : deputy ? `${deputy.name} nomidan` : 'Hokimiyat nomidan'}
                </span>
                <button
                  type="button"
                  onClick={send}
                  disabled={sending || trimmedReply.length === 0}
                  className="flex h-11 items-center gap-1.5 rounded-xl bg-primary-600 px-4 text-[13px] font-medium text-white shadow-glow transition-all hover:bg-primary-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  {sending ? (
                    <RotateRight size={16} className="animate-spin" />
                  ) : (
                    <Send2 size={16} variant="Bulk" />
                  )}
                  {sending ? 'Yuborilmoqda...' : 'Javob yuborish'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Holat o'zgartirish tasdiqi */}
      <ConfirmDialog
        open={!!pendingStatus}
        onClose={closeStatusDialog}
        onConfirm={confirmStatus}
        title={pendingStatus ? STATUS_CONFIRM[pendingStatus].title : ''}
        message={
          <>
            {pendingStatus && STATUS_CONFIRM[pendingStatus].message}
            {statusError && (
              <span role="alert" className="mt-2 block font-medium text-danger">
                {statusError}
              </span>
            )}
          </>
        }
        confirmLabel="Tasdiqlash"
        tone={pendingStatus ? STATUS_CONFIRM[pendingStatus].tone : 'primary'}
        icon={pendingStatus ? STATUS_CONFIRM[pendingStatus].icon : undefined}
        loading={statusChanging}
      />

      {/* O'chirish tasdiqi */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Shikoyatni o'chirasizmi?"
        message={
          <>
            {c && <>"{c.title}" nomli shikoyat butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.</>}
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
    </Drawer>
  );
}
