import { CloseCircle, Clock, TickCircle, Timer1 } from 'iconsax-react';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import type { MediaPlatform, MediaSourceHealth } from './api';
import { useMediaStatus } from './api';
import { PLATFORMS, PLATFORM_META, fullTime } from './meta';

/**
 * "Holat" tab of the settings modal: every source of the last run — what was
 * read, what matched, and why something failed or was skipped. Problems first.
 */
export function SourcesStatus() {
  const { data: status, isLoading } = useMediaStatus(true);
  const sources = status?.sources ?? [];
  const ok = sources.filter((s) => s.ok === true).length;
  const failed = sources.filter((s) => s.ok === false);
  const skipped = sources.filter((s) => s.ok === null);
  const run = status?.lastRun;

  if (isLoading && !status) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-2" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <Stat tone="ok" n={ok} label="ishlayapti" />
        <Stat tone="err" n={failed.length} label="xato" />
        <Stat tone="skip" n={skipped.length} label="kalit kutilmoqda" />
      </div>
      {run && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-surface-2 px-3 py-2.5 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <Clock size={14} /> Oxirgi yig'ish: <b className="text-ink">{fullTime(run.finishedAt)}</b> ({timeAgo(run.finishedAt)})
          </span>
          <span className="inline-flex items-center gap-1">
            <Timer1 size={14} /> {(run.durationMs / 1000).toFixed(1)} s
          </span>
          <span>
            Yangi: <b className="text-ink">{run.newItems}</b>
          </span>
          {status?.nextRunAt && (
            <span>
              Keyingisi: <b className="text-ink">{fullTime(status.nextRunAt).split(', ')[1]}</b>
            </span>
          )}
        </p>
      )}

      {sources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-ink-muted">
          Birinchi yig'ish hali tugamadi — bir necha soniyadan so'ng qayta oching.
        </p>
      ) : (
        PLATFORMS.map((p) => {
          const list = order(sources.filter((s) => s.platform === p));
          if (!list.length) return null;
          return <PlatformGroup key={p} platform={p} list={list} />;
        })
      )}
    </div>
  );
}

function order(list: MediaSourceHealth[]): MediaSourceHealth[] {
  const rank = (s: MediaSourceHealth) => (s.ok === false ? 0 : s.ok === null ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

function PlatformGroup({ platform, list }: { platform: MediaPlatform; list: MediaSourceHealth[] }) {
  const m = PLATFORM_META[platform];
  return (
    <section>
      <h3 className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold text-ink">
        <span style={{ color: m.color }}>
          <m.Icon size={16} />
        </span>
        {m.label}
        <span className="text-xs font-normal text-ink-muted">· {list.length} ta</span>
      </h3>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {list.map((s) => (
          <li key={s.key} className="flex items-start gap-3 px-3 py-2.5">
            <span
              className={cn(
                'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                s.ok === true ? 'bg-emerald-500' : s.ok === false ? 'bg-red-500' : 'bg-slate-300 dark:bg-slate-600',
              )}
              aria-label={s.ok === true ? 'Ishlayapti' : s.ok === false ? 'Xato' : "O'tkazib yuborildi"}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{s.name}</p>
              <p className={cn('text-xs leading-snug', s.ok === false ? 'text-red-600 dark:text-red-400' : 'text-ink-muted')}>
                {s.ok === false
                  ? s.error
                  : s.ok === null
                    ? s.skipped
                    : `${s.fetched} ta o'qildi · ${s.matched} tasi tumanga oid`}
              </p>
            </div>
            {s.ok === false && s.lastSuccessAt && (
              <span className="shrink-0 text-[11px] text-ink-muted" title="Oxirgi muvaffaqiyatli o'qish">
                {timeAgo(s.lastSuccessAt)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ tone, n, label }: { tone: 'ok' | 'err' | 'skip'; n: number; label: string }) {
  const cls = {
    ok: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    err: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    skip: 'bg-surface-2 text-ink-soft',
  }[tone];
  const Icon = tone === 'ok' ? TickCircle : tone === 'err' ? CloseCircle : Timer1;
  return (
    <div className={cn('rounded-xl px-3 py-2.5', cls)}>
      <p className="flex items-center gap-1.5 text-xl font-bold tabular-nums">
        <Icon size={18} variant="Bold" /> {n}
      </p>
      <p className="mt-0.5 text-xs">{label}</p>
    </div>
  );
}
