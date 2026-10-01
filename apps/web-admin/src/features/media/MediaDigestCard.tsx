import { useState } from 'react';
import { Clock, Danger, ExportSquare, MagicStar, RotateRight, TickCircle, Timer1 } from 'iconsax-react';
import { Card } from '@/shared/ui/Card';
import { Modal } from '@/shared/ui/Modal';
import { cn } from '@/shared/lib/cn';
import type { MediaDigest, MediaOverview } from './api';
import { useMediaDigests } from './api';
import { PLATFORM_META, SENTIMENT_META, aiModelLabel, fullTime, shortTime } from './meta';

const LEVEL = {
  high: { label: 'Yuqori', cls: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/30', bar: 'bg-red-500' },
  medium: { label: "O'rta", cls: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30', bar: 'bg-amber-500' },
  low: { label: 'Past', cls: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30', bar: 'bg-slate-400' },
} as const;

/** Positive / neutral / negative as one proportional bar + legend. */
export function SentimentBar({
  positive,
  neutral,
  negative,
  className,
  showLegend = true,
}: {
  positive: number;
  neutral: number;
  negative: number;
  className?: string;
  showLegend?: boolean;
}) {
  const total = positive + neutral + negative;
  const parts = [
    { key: 'negative', n: negative },
    { key: 'neutral', n: neutral },
    { key: 'positive', n: positive },
  ] as const;
  return (
    <div className={className}>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2"
        role="img"
        aria-label={`Salbiy ${negative}, neytral ${neutral}, ijobiy ${positive}`}
      >
        {total > 0 &&
          parts.map((p) =>
            p.n > 0 ? (
              <span
                key={p.key}
                style={{ width: `${(p.n / total) * 100}%`, background: SENTIMENT_META[p.key].color }}
                className="h-full transition-[width] duration-500 first:rounded-l-full last:rounded-r-full"
              />
            ) : null,
          )}
      </div>
      {showLegend && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-soft">
          {parts.map((p) => {
            const m = SENTIMENT_META[p.key];
            return (
              <span key={p.key} className="inline-flex items-center gap-1.5">
                <m.Icon size={14} color={m.color} variant="Bold" />
                {m.label} <b className="font-semibold tabular-nums text-ink">{p.n}</b>
                {total > 0 && <span className="text-ink-soft">({Math.round((p.n / total) * 100)}%)</span>}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MediaDigestCard({
  digest,
  refs,
  loading,
  canWrite,
  regenerating,
  onRegenerate,
}: {
  digest: MediaDigest | null;
  refs: MediaOverview['digestRefs'];
  loading: boolean;
  canWrite: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const isAi = !!digest && digest.model !== 'rules';
  const hours = digest
    ? Math.round((new Date(digest.periodTo).getTime() - new Date(digest.periodFrom).getTime()) / 3_600_000)
    : 24;

  return (
    <Card className="relative overflow-hidden">
      {/* soft brand wash */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-br from-violet-500/10 via-accent-500/5 to-transparent dark:from-violet-500/15"
      />
      <div className="relative p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300">
            <MagicStar size={20} variant="Bulk" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">Xulosa</h2>
            <p className="text-xs text-ink-soft">
              {digest ? (
                <>
                  {fullTime(digest.createdAt)} holatiga · so'nggi {hours >= 48 ? `${Math.round(hours / 24)} kun` : `${hours} soat`} ·{' '}
                  {digest.itemCount} ta material
                </>
              ) : (
                'Har 15 daqiqada yangilanadi'
              )}
            </p>
          </div>
          <span
            className={cn(
              'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
              isAi
                ? 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30'
                : 'bg-surface-2 text-ink-soft ring-line',
            )}
            title={isAi ? digest?.model : "AI tahlil o'chiq — avtomatik (qoidaga asoslangan) tahlil"}
          >
            <MagicStar size={12} variant="Bold" />
            {aiModelLabel(digest?.model)}
          </span>
        </div>

        {loading && !digest ? (
          <div className="mt-5 space-y-3">
            <div className="h-6 w-4/5 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-surface-2" />
            <div className="h-4 w-11/12 animate-pulse rounded-lg bg-surface-2" />
            <div className="h-4 w-2/3 animate-pulse rounded-lg bg-surface-2" />
          </div>
        ) : !digest ? (
          <div className="mt-5 rounded-xl border border-dashed border-line p-5 text-center text-sm text-ink-soft">
            <Timer1 size={28} className="mx-auto mb-2 text-ink-soft" variant="Bulk" />
            Birinchi yig'ish davom etmoqda — xulosa bir necha daqiqada paydo bo'ladi.
          </div>
        ) : (
          <>
            <p className="mt-4 text-lg font-bold leading-snug tracking-tight text-ink sm:text-xl">{digest.headline}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">{digest.summary}</p>

            <SentimentBar
              className="mt-4"
              positive={digest.positive}
              neutral={digest.neutral}
              negative={digest.negative}
            />

            {digest.topics.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {digest.topics.map((t) => {
                  const m = SENTIMENT_META[t.sentiment];
                  return (
                    <span
                      key={t.name}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-xs text-ink-soft ring-1 ring-line"
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
                      {t.name}
                      <b className="font-semibold tabular-nums text-ink">{t.count}</b>
                    </span>
                  );
                })}
              </div>
            )}

            {(digest.risks.length > 0 || digest.recommendations.length > 0) && (
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {digest.risks.length > 0 && (
                  <section aria-labelledby="media-risks">
                    <h3 id="media-risks" className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <Danger size={16} variant="Bold" className="text-red-500" /> Diqqat talab qiladi
                    </h3>
                    <ul className="space-y-2">
                      {digest.risks.map((r, i) => {
                        const lv = LEVEL[r.level] ?? LEVEL.medium;
                        const links = r.itemIds.map((id) => refs.find((x) => x.id === id)).filter(Boolean);
                        return (
                          <li key={i} className="relative overflow-hidden rounded-xl border border-line bg-surface p-3 pl-4">
                            <span className={cn('absolute inset-y-0 left-0 w-1', lv.bar)} aria-hidden="true" />
                            <div className="flex items-start gap-2">
                              <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-ink">{r.title}</p>
                              <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1', lv.cls)}>
                                {lv.label}
                              </span>
                            </div>
                            {r.detail && <p className="mt-1 text-xs leading-relaxed text-ink-soft">{r.detail}</p>}
                            {links.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {links.map((l) => {
                                  const pm = PLATFORM_META[l!.platform] ?? PLATFORM_META.web;
                                  return (
                                    <a
                                      key={l!.id}
                                      href={l!.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={l!.title}
                                      className="inline-flex max-w-full items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[11px] font-medium text-ink-soft ring-1 ring-line transition-colors hover:text-primary-700 hover:ring-primary-300"
                                    >
                                      <span style={{ color: pm.color }}>
                                        <pm.Icon size={12} />
                                      </span>
                                      <span className="truncate">{l!.sourceName}</span>
                                      <span className="text-ink-soft">{shortTime(l!.publishedAt)}</span>
                                      <ExportSquare size={11} />
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
                {digest.recommendations.length > 0 && (
                  <section aria-labelledby="media-recs">
                    <h3 id="media-recs" className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <TickCircle size={16} variant="Bold" className="text-primary-600" /> Tavsiyalar
                    </h3>
                    <ol className="space-y-2">
                      {digest.recommendations.map((r, i) => (
                        <li key={i} className="flex gap-2.5 rounded-xl bg-primary-50/60 p-3 text-[13px] leading-relaxed text-ink dark:bg-primary-500/10">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-bold text-white">
                            {i + 1}
                          </span>
                          {r}
                        </li>
                      ))}
                    </ol>
                  </section>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <Clock size={16} /> Oldingi xulosalar
              </button>
              {canWrite && (
                <button
                  type="button"
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-violet-700 transition-colors hover:bg-violet-50 disabled:opacity-60 dark:text-violet-300 dark:hover:bg-violet-500/10"
                >
                  <RotateRight size={16} className={regenerating ? 'animate-spin' : undefined} />
                  {regenerating ? 'Yozilmoqda…' : 'Xulosani qayta yozish'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <DigestHistory open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Card>
  );
}

function DigestHistory({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, isLoading } = useMediaDigests(open);
  return (
    <Modal open={open} onClose={onClose} title="Oldingi xulosalar" subtitle="So'nggi 12 ta xulosa" width={640}>
      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : !data?.length ? (
        <p className="text-sm text-ink-soft">Hali xulosa yo'q.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-line pl-5">
          {data.map((d) => (
            <li key={d.id} className="relative">
              <span className="absolute -left-[26px] top-1.5 h-3 w-3 rounded-full border-2 border-surface bg-violet-500" />
              <p className="text-xs text-ink-soft">
                {fullTime(d.createdAt)} · {d.itemCount} ta material · {aiModelLabel(d.model)}
              </p>
              <p className="mt-1 text-[14px] font-semibold text-ink">{d.headline}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{d.summary}</p>
              <SentimentBar className="mt-2" positive={d.positive} neutral={d.neutral} negative={d.negative} showLegend={false} />
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}
