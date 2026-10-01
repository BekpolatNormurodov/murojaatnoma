import { motion, useReducedMotion } from 'framer-motion';
import { DocumentText, EmojiHappy, EmojiSad, ExportSquare, Refresh2, Setting2, ShieldTick, TrendDown, TrendUp } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import type { MediaItem, MediaOverview, MediaPeriod } from './api';
import { SourceLogo } from './MediaIcons';
import { clock } from './meta';
import { useCountUp } from './useCountUp';

const PERIODS: { key: Exclude<MediaPeriod, 'all'>; label: string }[] = [
  { key: '24h', label: '24 soat' },
  { key: '7d', label: '7 kun' },
  { key: '30d', label: '30 kun' },
];

type Filter = 'all' | 'negative' | 'positive' | 'official';

/**
 * Top of the OAV monitoringi page: live status, the four numbers that matter
 * (each one filters the feed), and a ticker of the newest headlines.
 */
export function MediaHero({
  ov,
  period,
  onPeriod,
  running,
  onRefresh,
  onSettings,
  failedSources,
  active,
  onFilter,
}: {
  ov?: MediaOverview;
  period: Exclude<MediaPeriod, 'all'>;
  onPeriod: (p: Exclude<MediaPeriod, 'all'>) => void;
  running: boolean;
  onRefresh: () => void;
  onSettings: () => void;
  failedSources: number;
  active: Filter | null;
  onFilter: (f: Filter) => void;
}) {
  const reduce = useReducedMotion();
  const t = ov?.totals;
  const delta = t ? deltaPct(t.all, t.previous) : undefined;
  const last = ov?.status.lastRun?.finishedAt;
  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? '';

  return (
    <section
      aria-label="OAV monitoringi"
      className="relative isolate mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#064e3b] via-[#0b3b63] to-[#312e81] text-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.55)]"
    >
      {/* Aurora — slow drifting light, off for reduced motion */}
      <Blob reduce={!!reduce} className="-left-24 -top-32 h-80 w-80 bg-emerald-400/35" dx={60} dy={40} duration={16} />
      <Blob reduce={!!reduce} className="-right-20 top-10 h-96 w-96 bg-sky-400/25" dx={-50} dy={30} duration={20} />
      <Blob reduce={!!reduce} className="bottom-[-140px] left-1/3 h-80 w-[28rem] bg-violet-500/30" dx={40} dy={-30} duration={24} />
      {/* fine grid */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top_left,black,transparent_70%)]"
      />

      <div className="relative p-5 sm:p-7 lg:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100 ring-1 ring-white/15 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping', running ? 'bg-amber-300' : 'bg-emerald-300')} />
                <span className={cn('relative inline-flex h-2 w-2 rounded-full', running ? 'bg-amber-300' : 'bg-emerald-300')} />
              </span>
              {running ? "Manbalar o'qilmoqda" : 'OAV monitoringi · jonli'}
            </span>
            <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-[34px]">
              Mirzo Ulug'bek tumani haqida
              <span className="block bg-gradient-to-r from-emerald-200 via-sky-200 to-violet-200 bg-clip-text text-transparent">
                OAV va davlat manbalari nima demoqda
              </span>
            </h1>
            <p className="mt-2 text-sm text-white/75">
              {ov ? `${ov.status.sources.length} ta manba` : '40+ manba'} har 15 daqiqada o'qiladi
              {last && <> · oxirgi yangilanish <b className="font-semibold text-white">{clock(last)}</b> ({timeAgo(last)})</>}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSettings}
              aria-label={failedSources > 0 ? `Sozlamalar — ${failedSources} ta manbada xato` : 'Sozlamalar'}
              title={failedSources > 0 ? `${failedSources} ta manbada xato — «Holat» bo'limida` : "Kalit so'zlar, manbalar, holat va integratsiyalar"}
              className="relative inline-flex h-11 items-center gap-2 rounded-xl bg-white/10 px-3.5 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Setting2 size={18} />
              <span className="hidden sm:inline">Sozlamalar</span>
              {failedSources > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold ring-2 ring-[#0b3b63]">
                  {failedSources}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={running}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#0b3b63] shadow-lg shadow-black/20 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b3b63] disabled:opacity-70"
            >
              <Refresh2 size={18} className={running ? 'motion-safe:animate-spin' : undefined} />
              {running ? 'Yangilanmoqda…' : 'Yangilash'}
            </button>
          </div>
        </div>

        {/* Period */}
        <div role="tablist" aria-label="Davr" className="mt-5 inline-flex rounded-xl bg-black/20 p-1 ring-1 ring-white/10 backdrop-blur">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              role="tab"
              aria-selected={period === p.key}
              onClick={() => onPeriod(p.key)}
              className={cn(
                'relative h-9 rounded-lg px-4 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                period === p.key ? 'text-[#0b3b63]' : 'text-white/80 hover:text-white',
              )}
            >
              {period === p.key && (
                <motion.span
                  layoutId="media-period-pill"
                  className="absolute inset-0 rounded-lg bg-white shadow"
                  transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="relative">{p.label}</span>
            </button>
          ))}
        </div>

        {/* The four numbers — each filters the feed */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Jami xabarlar"
            sub={`so'nggi ${periodLabel}`}
            value={t?.all}
            icon={<DocumentText size={20} variant="Bulk" />}
            tone="from-white/15 to-white/5"
            active={active === 'all'}
            onClick={() => onFilter('all')}
            badge={
              delta !== undefined ? (
                <span
                  title="Oldingi xuddi shunday davrga nisbatan"
                  className={cn(
                    'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold',
                    delta >= 0 ? 'bg-emerald-400/20 text-emerald-100' : 'bg-red-400/20 text-red-100',
                  )}
                >
                  {delta >= 0 ? <TrendUp size={12} /> : <TrendDown size={12} />}
                  {delta > 0 ? '+' : ''}
                  {delta}%
                </span>
              ) : null
            }
          />
          <Stat
            label="Rasmiy manbalardan"
            sub="hokimlik, hukumat, UzA ..."
            value={t?.official}
            icon={<ShieldTick size={20} variant="Bulk" />}
            tone="from-sky-400/25 to-sky-400/5"
            active={active === 'official'}
            onClick={() => onFilter('official')}
          />
          <Stat
            label="Salbiy"
            sub={t && t.all ? `jamining ${Math.round((t.negative / t.all) * 100)}%` : 'diqqat talab qiladi'}
            value={t?.negative}
            icon={<EmojiSad size={20} variant="Bulk" />}
            tone="from-red-400/30 to-red-400/5"
            active={active === 'negative'}
            onClick={() => onFilter('negative')}
          />
          <Stat
            label="Ijobiy"
            sub={t && t.all ? `jamining ${Math.round((t.positive / t.all) * 100)}%` : 'yaxshi xabarlar'}
            value={t?.positive}
            icon={<EmojiHappy size={20} variant="Bulk" />}
            tone="from-emerald-400/30 to-emerald-400/5"
            active={active === 'positive'}
            onClick={() => onFilter('positive')}
          />
        </div>
      </div>

      <Ticker items={ov?.latest ?? []} reduce={!!reduce} />
    </section>
  );
}

function deltaPct(cur: number, prev: number): number | undefined {
  if (prev === 0) return cur > 0 ? 100 : undefined;
  return Math.round(((cur - prev) / prev) * 100);
}

function Blob({
  className,
  dx,
  dy,
  duration,
  reduce,
}: {
  className: string;
  dx: number;
  dy: number;
  duration: number;
  reduce: boolean;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn('pointer-events-none absolute -z-10 rounded-full blur-3xl', className)}
      animate={reduce ? undefined : { x: [0, dx, 0], y: [0, dy, 0], scale: [1, 1.12, 1] }}
      transition={reduce ? undefined : { duration, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function Stat({
  label,
  sub,
  value,
  icon,
  tone,
  active,
  onClick,
  badge,
}: {
  label: string;
  sub: string;
  value?: number;
  icon: React.ReactNode;
  tone: string;
  active: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
}) {
  const shown = useCountUp(value);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'group relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-left ring-1 backdrop-blur-md transition',
        'motion-safe:hover:-translate-y-0.5 hover:ring-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
        tone,
        active ? 'ring-2 ring-white' : 'ring-white/15',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">{icon}</span>
        {badge}
      </div>
      <p className="mt-3 text-[30px] font-bold leading-none tracking-tight tabular-nums sm:text-[34px]">
        {shown === undefined ? <span className="inline-block h-8 w-14 animate-pulse rounded-lg bg-white/15 align-middle" /> : shown}
      </p>
      <p className="mt-1.5 text-[13px] font-semibold text-white">{label}</p>
      <p className="truncate text-xs text-white/70">{sub}</p>
    </button>
  );
}

/** "SO'NGGI" — the newest headlines gliding by; hover pauses, each opens its source. */
function Ticker({ items, reduce }: { items: MediaItem[]; reduce: boolean }) {
  if (!items.length) return null;
  const loop = reduce ? items : [...items, ...items];
  const seconds = Math.max(28, items.length * 9);
  return (
    <div className="group relative flex items-center gap-3 border-t border-white/10 bg-black/25 px-5 py-2.5 backdrop-blur sm:px-7 lg:px-8">
      <style>{'@keyframes media-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}'}</style>
      <span className="shrink-0 rounded-md bg-red-500 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
        So'nggi
      </span>
      <div className="relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_4%,black_96%,transparent)]">
        <div
          className={cn('flex w-max gap-8', !reduce && 'group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]', reduce && 'overflow-x-auto')}
          style={reduce ? undefined : { animation: `media-ticker ${seconds}s linear infinite` }}
        >
          {loop.map((it, i) => (
            <a
              key={`${it.id}-${i}`}
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={i >= items.length ? -1 : undefined}
              aria-hidden={i >= items.length ? true : undefined}
              className="inline-flex max-w-[34rem] shrink-0 items-center gap-2 rounded-md text-[13px] text-white/90 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <SourceLogo item={it} size={18} />
              <span className="shrink-0 font-semibold tabular-nums text-emerald-200">{clock(it.publishedAt)}</span>
              <span className="truncate">{it.title}</span>
              <ExportSquare size={13} className="shrink-0 opacity-60" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
