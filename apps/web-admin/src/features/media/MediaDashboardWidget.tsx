import { Link } from 'react-router-dom';
import { ArrowRight, Danger, ExportSquare, MagicStar, Radar } from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { cn } from '@/shared/lib/cn';
import { timeAgo } from '@/shared/lib/format';
import { useMediaLive, useMediaOverview } from './api';
import { SentimentBar } from './MediaDigestCard';
import { SourceLogo } from './MediaIcons';
import { OfficialBadge } from './MediaItemCard';
import { PLATFORMS, PLATFORM_META, SENTIMENT_META, aiModelLabel, shortTime } from './meta';

/**
 * "OAV monitoringi" on the Boshqaruv paneli: the latest xulosa, the 24h mood
 * and what needs attention — each item opens its original post.
 */
export function MediaDashboardWidget() {
  // A single district gets a few posts a day — a week is the meaningful window.
  const { data: ov, isLoading, isError } = useMediaOverview('7d');
  useMediaLive();
  const digest = ov?.digest;
  // Attention first (salbiy / muhim), then the freshest.
  const list = ov ? (ov.alerts.length ? ov.alerts : ov.latest).slice(0, 4) : [];
  const running = !!ov?.status.running;

  return (
    <Card className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-r from-violet-500/10 via-accent-500/5 to-transparent dark:from-violet-500/15"
      />
      <div className="relative grid gap-5 p-5 lg:grid-cols-5">
        {/* Left: xulosa */}
        <div className="min-w-0 lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
              <Radar size={19} variant="Bulk" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-ink">OAV monitoringi</h3>
              <p className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span className={cn('h-1.5 w-1.5 rounded-full', running ? 'animate-pulse bg-amber-500' : 'bg-emerald-500')} />
                {running
                  ? "Manbalar o'qilmoqda…"
                  : ov?.status.lastRun
                    ? `Yangilandi ${timeAgo(ov.status.lastRun.finishedAt)} · har 15 daqiqada`
                    : 'Har 15 daqiqada yangilanadi'}
              </p>
            </div>
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-soft ring-1 ring-line">
              <MagicStar size={12} variant="Bold" className="text-violet-500" />
              {aiModelLabel(digest?.model)}
            </span>
          </div>

          {isLoading ? (
            <div className="mt-4 space-y-2.5">
              <div className="h-5 w-4/5 animate-pulse rounded-lg bg-surface-2" />
              <div className="h-4 w-full animate-pulse rounded-lg bg-surface-2" />
              <div className="h-4 w-2/3 animate-pulse rounded-lg bg-surface-2" />
            </div>
          ) : isError ? (
            <p className="mt-4 text-sm text-ink-soft">Monitoring ma'lumotini yuklab bo'lmadi.</p>
          ) : (
            <>
              <p className="mt-4 text-[16px] font-bold leading-snug text-ink">
                {digest?.headline ?? "Birinchi yig'ish davom etmoqda…"}
              </p>
              {digest && <p className="mt-1.5 line-clamp-3 text-[13px] leading-relaxed text-ink-soft">{digest.summary}</p>}
              {ov && (
                <p className="mt-4 text-xs font-medium text-ink-soft">
                  So'nggi 7 kun: <b className="text-ink">{ov.totals.all}</b> ta xabar
                  {ov.totals.unseen > 0 && <> · <b className="text-ink">{ov.totals.unseen}</b> ta ko'rilmagan</>}
                </p>
              )}
              {ov && (
                <SentimentBar
                  className="mt-2"
                  positive={ov.totals.positive}
                  neutral={ov.totals.neutral}
                  negative={ov.totals.negative}
                />
              )}
              {ov && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => {
                    const m = PLATFORM_META[p];
                    return (
                      <span key={p} className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs text-ink-soft ring-1 ring-line">
                        <span style={{ color: m.color }}>
                          <m.Icon size={14} />
                        </span>
                        {m.label}
                        <b className="font-semibold tabular-nums text-ink">{ov.platforms[p] ?? 0}</b>
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Right: attention list */}
        <div className="min-w-0 lg:col-span-2 lg:border-l lg:border-line lg:pl-5">
          <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            {ov?.alerts.length ? (
              <>
                <Danger size={16} variant="Bold" className="text-red-500" /> Diqqat talab qiladi
              </>
            ) : (
              "So'nggi xabarlar"
            )}
          </p>
          <ul className="space-y-1">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => <li key={i} className="h-14 animate-pulse rounded-xl bg-surface-2" />)
              : list.length === 0
                ? <li className="rounded-xl border border-dashed border-line p-4 text-center text-[13px] text-ink-soft">So'nggi 7 kunda xabar yo'q</li>
                : list.map((it) => {
                    const s = SENTIMENT_META[it.sentiment];
                    return (
                      <li key={it.id}>
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-start gap-2.5 rounded-xl p-2 transition-colors hover:bg-surface-2"
                        >
                          <SourceLogo item={it} size={22} className="mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <p className="line-clamp-2 text-[13px] font-medium leading-snug text-ink group-hover:text-primary-700 dark:group-hover:text-primary-300">
                              {it.title}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-soft">
                              <s.Icon size={12} color={s.color} variant="Bold" />
                              <span className="truncate">{it.sourceName}</span>
                              {it.official && <OfficialBadge compact />} · {shortTime(it.publishedAt)}
                            </p>
                          </div>
                          <ExportSquare size={15} className="mt-0.5 shrink-0 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      </li>
                    );
                  })}
          </ul>
          <Link
            to="/media"
            className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50 dark:text-primary-300 dark:hover:bg-primary-500/10"
          >
            Barcha xabarlar va xulosa <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
