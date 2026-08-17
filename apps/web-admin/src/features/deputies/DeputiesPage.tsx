import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Crown1,
  Hierarchy,
  CallCalling,
  Sms,
  Buildings2,
  Calendar,
  MessageQuestion,
  Danger,
  Star1,
} from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { StatCard } from '@/shared/ui/StatCard';
import { Card } from '@/shared/ui/Card';
import { Avatar } from '@/shared/ui/Avatar';
import {
  CATEGORY_META,
  COMPLAINTS,
  DEPUTIES,
  MEETINGS,
  REQUESTS,
  STAFF,
} from '@/shared/data/mock';
import type { Deputy } from '@/shared/data/types';

function deputyStats(d: Deputy) {
  const requests = REQUESTS.filter((r) => d.categories.includes(r.category));
  const openRequests = requests.filter(
    (r) => r.status === 'new' || r.status === 'in_progress',
  ).length;
  const complaints = COMPLAINTS.filter((c) => c.deputyId === d.id).length;
  const meetings = MEETINGS.filter((m) => m.chairDeputyId === d.id).length;
  return { requests: requests.length, openRequests, complaints, meetings };
}

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
    <div className="flex flex-col items-center rounded-xl bg-surface-2 px-2 py-2.5">
      <Icon size={17} variant="Bulk" style={{ color }} />
      <span className="mt-1 text-base font-bold text-ink">{value}</span>
      <span className="text-[10.5px] leading-tight text-ink-muted">{label}</span>
    </div>
  );
}

function DeputyCard({ d, index }: { d: Deputy; index: number }) {
  const s = deputyStats(d);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.06, 0.4), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-card transition-all hover:shadow-pop"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: d.color }} />
      <span
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full"
        style={{ background: d.color, opacity: 0.1 }}
      />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar src={d.photo} name={d.name} color={d.color} size={56} ring />
        <div className="min-w-0">
          <h3 className="truncate text-[16px] font-bold text-ink">{d.name}</h3>
          <p className="text-[12.5px] text-ink-muted">{d.position}</p>
        </div>
      </div>

      {/* Direction */}
      <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 p-3">
        <span
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ background: d.color }}
        >
          <Hierarchy size={15} variant="Bulk" />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Yo'nalish
          </div>
          <div className="text-[13px] font-medium text-ink">{d.direction}</div>
        </div>
      </div>

      {/* Categories handled */}
      <div className="mt-3">
        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
          Javob beradigan murojaatlar
        </div>
        {d.categories.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {d.categories.map((cat) => (
              <span
                key={cat}
                className="rounded-full px-2.5 py-1 text-[11.5px] font-medium"
                style={{
                  background: `${CATEGORY_META[cat].color}1a`,
                  color: CATEGORY_META[cat].color,
                }}
              >
                {CATEGORY_META[cat].label}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {d.topics.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-medium text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Mini stats */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat icon={MessageQuestion} label="Murojaat" value={s.requests} color="#f59e0b" />
        <MiniStat icon={Danger} label="Shikoyat" value={s.complaints} color="#ef4444" />
        <MiniStat icon={Calendar} label="Yig'ilish" value={s.meetings} color="#2563eb" />
      </div>

      {/* Contact */}
      <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12.5px]">
        <a href={`tel:${d.phone}`} className="flex items-center gap-2 text-ink-soft hover:text-accent-600">
          <CallCalling size={15} variant="Bulk" className="text-ink-muted" /> {d.phone}
        </a>
        <a href={`mailto:${d.email}`} className="flex items-center gap-2 text-ink-soft hover:text-accent-600">
          <Sms size={15} variant="Bulk" className="text-ink-muted" /> {d.email}
        </a>
        <div className="flex items-center gap-2 text-ink-soft">
          <Buildings2 size={15} variant="Bulk" className="text-ink-muted" /> {d.office}
        </div>
        <div className="flex items-center gap-2 text-ink-soft">
          <Calendar size={15} variant="Bulk" className="text-ink-muted" /> Qabul: {d.receptionDay}
        </div>
      </div>
    </motion.div>
  );
}

export function DeputiesPage() {
  const hokim = useMemo(() => STAFF.find((s) => s.role === 'hokim'), []);

  const totals = useMemo(() => {
    const routed = REQUESTS.filter((r) =>
      DEPUTIES.some((d) => d.categories.includes(r.category)),
    ).length;
    const directions = DEPUTIES.length;
    const complaints = COMPLAINTS.length;
    return { deputies: DEPUTIES.length, directions, routed, complaints };
  }, []);

  return (
    <div>
      <PageHeader
        title="Hokim o'rinbosarlari"
        subtitle="Hokimiyat rahbariyati — yo'nalishlar bo'yicha mas'ul o'rinbosarlar. Murojaatlar yo'nalishga qarab avtomatik biriktiriladi."
      />

      {/* KPIs */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Hierarchy} label="O'rinbosarlar" value={String(totals.deputies)} tint="#7c3aed" index={0} />
        <StatCard icon={Star1} label="Yo'nalishlar" value={String(totals.directions)} tint="#2563eb" index={1} />
        <StatCard icon={MessageQuestion} label="Biriktirilgan murojaat" value={String(totals.routed)} tint="#f59e0b" index={2} />
        <StatCard icon={Danger} label="Shikoyatlar nazorat" value={String(totals.complaints)} tint="#ef4444" index={3} />
      </div>

      {/* Hokim banner */}
      {hokim && (
        <Card className="mb-6 flex flex-col gap-4 overflow-hidden bg-linear-to-br from-primary-700 to-primary-600 p-5 text-white sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Avatar src={hokim.photo} name={hokim.name} color={hokim.avatarColor} size={64} ring />
            <div>
              <div className="flex items-center gap-2">
                <Crown1 size={18} variant="Bulk" className="text-amber-300" />
                <span className="text-[12px] font-semibold uppercase tracking-wider text-white/80">
                  Tuman hokimi
                </span>
              </div>
              <h2 className="mt-0.5 text-xl font-bold">{hokim.name}</h2>
              <p className="text-[13px] text-white/80">{hokim.position}</p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <div className="rounded-xl bg-white/15 px-4 py-2.5 text-[13px] backdrop-blur-sm">
              Quyida {DEPUTIES.length} ta hokim o'rinbosari o'z yo'nalishi bo'yicha
              <br className="hidden sm:block" /> fuqaro murojaatlari va shikoyatlariga javob beradi.
            </div>
          </div>
        </Card>
      )}

      {/* Deputies grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {DEPUTIES.map((d, i) => (
          <DeputyCard key={d.id} d={d} index={i} />
        ))}
      </div>
    </div>
  );
}
