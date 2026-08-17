import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Add, Speaker, Eye, Calendar, Star1, ArrowRight, Edit2, CloseCircle, RotateRight } from 'iconsax-react';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Badge } from '@/shared/ui/Badge';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { cn } from '@/shared/lib/cn';
import { formatDate, formatCompact, timeAgo } from '@/shared/lib/format';
import { NEWS_META } from '@/shared/data/mock';
import type { NewsCategory, NewsItem } from '@/shared/data/types';
import { useNews } from './useNews';
import { AddNewsModal, NewsDetailDrawer } from './NewsModals';

const CATEGORIES = Object.keys(NEWS_META) as NewsCategory[];

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-surface-2', className)} />;
}

export function NewsPage() {
  const [cat, setCat] = useState<NewsCategory | 'all'>('all');
  const [onlyDrafts, setOnlyDrafts] = useState(false);
  const { data, isLoading, isError, error, refetch } = useNews();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (data) setItems(data);
  }, [data]);

  const hero = useMemo(
    () => items.find((n) => n.featured && n.status === 'published'),
    [items],
  );

  const list = useMemo(() => {
    return items.filter((n) => {
      if (onlyDrafts && n.status !== 'draft') return false;
      if (!onlyDrafts && hero && n.id === hero.id) return false;
      if (cat !== 'all' && n.category !== cat) return false;
      return true;
    });
  }, [items, cat, onlyDrafts, hero]);

  return (
    <div>
      <PageHeader
        title="Yangiliklar va e'lonlar"
        subtitle="Tuman hokimiyati rasmiy xabarlari, e'lonlar va tadbirlar"
        action={
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
          >
            <Add size={20} /> Yangilik qo'shish
          </button>
        }
      />

      {isError ? (
        <Card className="flex flex-col items-center gap-3 p-14 text-center">
          <CloseCircle size={40} variant="Bulk" className="text-danger" />
          <div>
            <p className="font-semibold text-ink">Ma'lumotlarni yuklab bo'lmadi</p>
            <p className="mt-1 text-sm text-ink-muted">
              {error instanceof Error ? error.message : "Noma'lum xatolik yuz berdi"}
            </p>
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RotateRight size={16} /> Qayta urinish
          </Button>
        </Card>
      ) : (
        <>
          {/* Hero */}
          {isLoading ? (
            <Skeleton className="h-72 sm:h-80" />
          ) : (
            hero &&
            !onlyDrafts &&
            cat === 'all' && <HeroCard item={hero} onClick={() => setSelected(hero)} />
          )}

          {/* Filters */}
          <div className="mb-5 mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              <CatPill active={cat === 'all'} onClick={() => setCat('all')} label="Barchasi" />
              {CATEGORIES.map((c) => (
                <CatPill
                  key={c}
                  active={cat === c}
                  onClick={() => setCat(c)}
                  label={NEWS_META[c].label}
                  color={NEWS_META[c].color}
                />
              ))}
            </div>
            <button
              onClick={() => setOnlyDrafts((v) => !v)}
              className={cn(
                'inline-flex items-center gap-2 self-start rounded-xl border px-3.5 py-2 text-[13px] font-medium transition-colors lg:self-auto',
                onlyDrafts
                  ? 'border-amber-400 bg-warning-soft text-amber-700'
                  : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
              )}
            >
              <Edit2 size={16} variant="Bulk" />
              Qoralamalar
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-80" />)
              : list.map((n, i) => (
                  <NewsCard key={n.id} item={n} index={i} onClick={() => setSelected(n)} />
                ))}
          </div>

          {!isLoading && list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line py-16 text-center text-ink-muted">
              {onlyDrafts ? 'Qoralamalar yo‘q' : 'Yangilik topilmadi'}
            </div>
          )}
        </>
      )}

      <AddNewsModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreate={(item) => setItems((prev) => [item, ...prev])}
      />
      <NewsDetailDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function HeroCard({ item, onClick }: { item: NewsItem; onClick: () => void }) {
  const meta = NEWS_META[item.category];
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-3xl border border-line shadow-card"
    >
      <div className="absolute inset-0">
        <img
          src={item.cover}
          alt={item.title}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-transparent" />
      </div>
      <div className="relative flex min-h-72 flex-col justify-end p-6 sm:min-h-80 sm:p-8">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
            style={{ background: meta.color }}
          >
            <Speaker size={14} variant="Bulk" /> {meta.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <Star1 size={13} variant="Bold" className="text-amber-300" /> Muhim
          </span>
        </div>
        <h2 className="mt-3 max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl">
          {item.title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-white/80 line-clamp-2">{item.excerpt}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[13px] text-white/70">
          <span>{item.author}</span>
          <span className="flex items-center gap-1.5">
            <Calendar size={14} /> {formatDate(item.publishedAt)}
          </span>
          <span className="flex items-center gap-1.5">
            <Eye size={14} /> {formatCompact(item.views)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-medium text-white transition-transform group-hover:translate-x-1">
            Batafsil <ArrowRight size={16} />
          </span>
        </div>
      </div>
    </motion.article>
  );
}

function NewsCard({ item, index, onClick }: { item: NewsItem; index: number; onClick: () => void }) {
  const meta = NEWS_META[item.category];
  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3), duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      onClick={onClick}
      className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-all hover:-translate-y-1 hover:shadow-pop"
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={item.cover}
          alt={item.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white shadow-sm"
          style={{ background: meta.color }}
        >
          {meta.label}
        </span>
        {item.status === 'draft' && (
          <span className="absolute right-3 top-3">
            <Badge tone="warning" dot>
              Qoralama
            </Badge>
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="font-semibold leading-snug text-ink line-clamp-2 transition-colors group-hover:text-primary-600">
          {item.title}
        </h3>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-ink-muted line-clamp-2">
          {item.excerpt}
        </p>
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-ink-muted">
          <span className="truncate">{item.author}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye size={13} /> {formatCompact(item.views)}
            </span>
            <span>{timeAgo(item.publishedAt)}</span>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

function CatPill({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-all',
        active
          ? 'border-primary-400 bg-primary-50 text-primary-700'
          : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
      )}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
