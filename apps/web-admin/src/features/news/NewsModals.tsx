import { useEffect, useState } from 'react';
import {
  Add,
  Speaker,
  Eye,
  Calendar,
  Star1,
  Edit2,
  Share,
  Printer,
  Clock,
  Image as ImageIcon,
  TickCircle,
  Trash,
  RotateRight,
} from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Drawer } from '@/shared/ui/Drawer';
import { Badge } from '@/shared/ui/Badge';
import { Select } from '@/shared/ui/Select';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { NEWS_META } from '@/shared/data/mock';
import type { NewsCategory, NewsItem, NewsStatus } from '@/shared/data/types';
import { formatDate, formatCompact, timeAgo } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

const CATEGORY_OPTIONS = (Object.keys(NEWS_META) as NewsCategory[]).map((c) => ({
  value: c,
  label: NEWS_META[c].label,
  dot: NEWS_META[c].color,
}));

const STATUS_OPTIONS: { value: NewsStatus; label: string; dot: string }[] = [
  { value: 'published', label: 'Chop etish', dot: '#10b981' },
  { value: 'draft', label: 'Qoralama', dot: '#f59e0b' },
];

const FALLBACK_COVER =
  'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=800&q=70';

/* ============================================================
   Forma maydonlari \u2014 qo'shish va tahrirlash modallari o'rtasida
   umumiy (bir xil ko'rinish, ikkala joyda ham qayta ishlatiladi).
   ============================================================ */
interface NewsFormValues {
  title: string;
  category: NewsCategory;
  excerpt: string;
  body: string;
  cover: string;
  author: string;
  status: NewsStatus;
  featured: boolean;
}

function NewsFormFields({
  values,
  set,
}: {
  values: NewsFormValues;
  set: <K extends keyof NewsFormValues>(key: K, value: NewsFormValues[K]) => void;
}) {
  const { title, category, excerpt, body, cover, author, status, featured } = values;
  return (
    <>
      {/* Cover preview */}
      <div className="relative h-36 overflow-hidden rounded-xl border border-line bg-surface-2">
        <img
          src={cover.trim() || FALLBACK_COVER}
          alt=""
          className="h-full w-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK_COVER;
          }}
        />
        <span
          className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
          style={{ background: NEWS_META[category].color }}
        >
          <Speaker size={13} variant="Bulk" /> {NEWS_META[category].label}
        </span>
      </div>

      <Field label="Sarlavha">
        <input
          value={title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Yangilik sarlavhasi"
          className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary-300"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Turkum">
          <Select value={category} onChange={(v) => set('category', v)} options={CATEGORY_OPTIONS} block />
        </Field>
        <Field label="Holat">
          <Select value={status} onChange={(v) => set('status', v)} options={STATUS_OPTIONS} block />
        </Field>
      </div>

      <Field label="Qisqa tavsif">
        <textarea
          value={excerpt}
          onChange={(e) => set('excerpt', e.target.value)}
          rows={2}
          placeholder="Yangilik mazmunini qisqacha bayon eting"
          className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary-300"
        />
      </Field>

      <Field label="To'liq matn">
        <textarea
          value={body}
          onChange={(e) => set('body', e.target.value)}
          rows={4}
          placeholder="Yangilikning to'liq matni..."
          className="w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-primary-300"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Muallif">
          <input
            value={author}
            onChange={(e) => set('author', e.target.value)}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm outline-none focus:border-primary-300"
          />
        </Field>
        <Field label="Muqova rasm (URL)">
          <div className="relative">
            <ImageIcon
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={cover}
              onChange={(e) => set('cover', e.target.value)}
              placeholder="https://..."
              className="h-11 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm outline-none focus:border-primary-300"
            />
          </div>
        </Field>
      </div>

      <button
        type="button"
        onClick={() => set('featured', !featured)}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-medium transition-colors',
          featured
            ? 'border-amber-300 bg-warning-soft text-amber-700'
            : 'border-line bg-surface text-ink-soft hover:bg-surface-2',
        )}
      >
        <span className="flex items-center gap-2">
          <Star1 size={17} variant={featured ? 'Bold' : 'Linear'} /> Asosiy yangilik (bosh sahifa)
        </span>
        <span
          className={cn(
            'relative h-5 w-9 rounded-full transition-colors',
            featured ? 'bg-amber-500' : 'bg-ink-muted/40',
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all',
              featured ? 'left-4.5' : 'left-0.5',
            )}
          />
        </span>
      </button>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

const EMPTY_NEWS_FORM: NewsFormValues = {
  title: '',
  category: 'yangilik',
  excerpt: '',
  body: '',
  cover: '',
  author: 'Matbuot xizmati',
  status: 'published',
  featured: false,
};

function newsFormFromItem(item: NewsItem): NewsFormValues {
  return {
    title: item.title,
    category: item.category,
    excerpt: item.excerpt,
    body: item.body,
    cover: item.cover,
    author: item.author,
    status: item.status,
    featured: item.featured,
  };
}

/* ============================================================
   Yangilik qo'shish modali \u2014 POST /news
   ============================================================ */
export function AddNewsModal({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Backendga POST /news yuboradigan va yaratilgan yozuvni qaytaradigan chaqiruvchi. */
  onCreate: (payload: Omit<NewsItem, 'id'>) => Promise<NewsItem>;
}) {
  const [values, setValues] = useState<NewsFormValues>(EMPTY_NEWS_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof NewsFormValues>(key: K, value: NewsFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const valid = values.title.trim().length > 3 && values.excerpt.trim().length > 3;

  function reset() {
    setValues(EMPTY_NEWS_FORM);
    setError(null);
    setSaving(false);
  }

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    if (!valid || saving) return;
    const payload: Omit<NewsItem, 'id'> = {
      title: values.title.trim(),
      excerpt: values.excerpt.trim(),
      body: values.body.trim() || values.excerpt.trim(),
      category: values.category,
      status: values.status,
      cover: values.cover.trim() || FALLBACK_COVER,
      author: values.author.trim() || 'Matbuot xizmati',
      publishedAt: new Date().toISOString(),
      views: 0,
      featured: values.featured,
    };
    setSaving(true);
    setError(null);
    try {
      await onCreate(payload);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yangilikni saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Yangilik qo'shish"
      subtitle="Rasmiy xabar, e'lon yoki tadbir e'lon qiling"
      width={560}
    >
      <div className="space-y-4">
        <NewsFormFields values={values} set={set} />

        {error && (
          <p role="alert" className="text-[12.5px] font-medium text-danger">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!valid || saving}
            className={cn(
              'flex flex-2 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-colors',
              valid ? 'bg-primary-600 shadow-glow hover:bg-primary-700' : 'cursor-not-allowed bg-ink-muted/40',
              saving && 'pointer-events-none opacity-70',
            )}
          >
            {saving ? (
              <RotateRight size={18} className="animate-spin" />
            ) : (
              <Add size={18} />
            )}
            {saving ? 'Saqlanmoqda...' : values.status === 'draft' ? 'Qoralama saqlash' : 'E\u2019lon qilish'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Yangilikni tahrirlash modali \u2014 PATCH /news/:id
   ============================================================ */
export function EditNewsModal({
  item,
  onClose,
  onUpdate,
}: {
  item: NewsItem | null;
  onClose: () => void;
  /** Backendga PATCH /news/:id yuboradigan va yangilangan yozuvni qaytaradigan chaqiruvchi. */
  onUpdate: (id: string, payload: Omit<NewsItem, 'id'>) => Promise<NewsItem>;
}) {
  const [values, setValues] = useState<NewsFormValues>(EMPTY_NEWS_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setValues(newsFormFromItem(item));
      setError(null);
      setSaving(false);
    }
  }, [item]);

  function set<K extends keyof NewsFormValues>(key: K, value: NewsFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  const valid = values.title.trim().length > 3 && values.excerpt.trim().length > 3;

  function handleClose() {
    if (saving) return;
    onClose();
  }

  async function submit() {
    if (!valid || saving || !item) return;
    const payload: Omit<NewsItem, 'id'> = {
      title: values.title.trim(),
      excerpt: values.excerpt.trim(),
      body: values.body.trim() || values.excerpt.trim(),
      category: values.category,
      status: values.status,
      cover: values.cover.trim() || FALLBACK_COVER,
      author: values.author.trim() || 'Matbuot xizmati',
      publishedAt: item.publishedAt,
      views: item.views,
      featured: values.featured,
    };
    setSaving(true);
    setError(null);
    try {
      await onUpdate(item.id, payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "O'zgarishlarni saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!item}
      onClose={handleClose}
      title="Yangilikni tahrirlash"
      subtitle={item ? `#${item.id}` : undefined}
      width={560}
    >
      <div className="space-y-4">
        <NewsFormFields values={values} set={set} />

        {error && (
          <p role="alert" className="text-[12.5px] font-medium text-danger">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 rounded-xl border border-line bg-surface py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2 disabled:pointer-events-none disabled:opacity-50"
          >
            Bekor qilish
          </button>
          <button
            onClick={submit}
            disabled={!valid || saving}
            className={cn(
              'flex flex-2 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-colors',
              valid ? 'bg-primary-600 shadow-glow hover:bg-primary-700' : 'cursor-not-allowed bg-ink-muted/40',
              saving && 'pointer-events-none opacity-70',
            )}
          >
            {saving ? (
              <RotateRight size={18} className="animate-spin" />
            ) : (
              <TickCircle size={18} variant="Bulk" />
            )}
            {saving ? 'Saqlanmoqda...' : "O'zgarishlarni saqlash"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ============================================================
   Yangilik tafsiloti (detail) — to'liq ko'rinish
   ============================================================ */
export function NewsDetailDrawer({
  item,
  onClose,
  onEdit,
  onDelete,
}: {
  item: NewsItem | null;
  onClose: () => void;
  /** "Tahrirlash" bosilganda chaqiriladi — sahifa tahrirlash modalini ochadi. */
  onEdit: (item: NewsItem) => void;
  /** Backendga DELETE /news/:id yuboradigan chaqiruvchi. */
  onDelete: (id: string) => Promise<void>;
}) {
  const meta = item ? NEWS_META[item.category] : null;
  // mazmunni boyitish uchun matnni paragraflarga ajratamiz
  const paragraphs = item
    ? [
        item.body,
        `Ushbu ${meta?.label.toLowerCase()} tuman hokimiyati tomonidan rasmiy tasdiqlangan. Aholi qo'shimcha ma'lumotlarni hokimiyatning rasmiy kanallari hamda mobil ilova orqali kuzatib borishi mumkin.`,
        "Hokimiyat fuqarolarni faol bo'lishga, takliflar va murojaatlarni mobil ilova orqali yuborishga chaqiradi. Har bir murojaat belgilangan muddatda ko'rib chiqiladi.",
      ]
    : [];

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    setDeleteOpen(false);
    setDeleting(false);
    setDeleteError(null);
  }, [item?.id]);

  async function confirmDelete() {
    if (!item) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(item.id);
      setDeleteOpen(false);
      onClose();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Yangilikni o'chirib bo'lmadi");
    } finally {
      setDeleting(false);
    }
  }

  function closeDeleteDialog() {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteError(null);
  }

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title="Yangilik"
      subtitle={item ? `#${item.id}` : undefined}
      width={620}
    >
      {item && meta && (
        <article className="space-y-5">
          {/* Cover */}
          <div className="relative h-56 overflow-hidden rounded-2xl border border-line">
            <img src={item.cover} alt={item.title} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 to-transparent" />
            <div className="absolute bottom-3 left-3 flex items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white"
                style={{ background: meta.color }}
              >
                <Speaker size={13} variant="Bulk" /> {meta.label}
              </span>
              {item.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  <Star1 size={12} variant="Bold" className="text-amber-300" /> Muhim
                </span>
              )}
              {item.status === 'draft' && (
                <Badge tone="warning" dot>
                  Qoralama
                </Badge>
              )}
            </div>
          </div>

          {/* Title + meta */}
          <div>
            <h1 className="text-xl font-bold leading-snug text-ink">{item.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-[13px] text-ink-muted">
              <span className="flex items-center gap-1.5">
                <Speaker size={14} variant="Bulk" /> {item.author}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={14} variant="Bulk" /> {formatDate(item.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} variant="Bulk" /> {timeAgo(item.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Eye size={14} variant="Bulk" /> {formatCompact(item.views)}
              </span>
            </div>
          </div>

          {/* Lead */}
          <p className="rounded-2xl border-l-4 bg-surface-2 p-4 text-[15px] font-medium leading-relaxed text-ink" style={{ borderColor: meta.color }}>
            {item.excerpt}
          </p>

          {/* Body */}
          <div className="space-y-3 text-[14px] leading-relaxed text-ink-soft">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-2xl border border-line bg-surface p-3.5 text-center">
              <Eye size={18} variant="Bulk" className="mx-auto text-accent-500" />
              <div className="mt-1.5 text-base font-bold text-ink">{formatCompact(item.views)}</div>
              <div className="text-[11px] text-ink-muted">Ko'rishlar</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3.5 text-center">
              <Star1 size={18} variant="Bulk" className="mx-auto text-amber-500" />
              <div className="mt-1.5 text-base font-bold text-ink">{item.featured ? 'Ha' : "Yo'q"}</div>
              <div className="text-[11px] text-ink-muted">Asosiy</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-3.5 text-center">
              <TickCircle size={18} variant="Bulk" className="mx-auto text-primary-500" />
              <div className="mt-1.5 text-base font-bold text-ink">
                {item.status === 'published' ? 'Faol' : 'Qoralama'}
              </div>
              <div className="text-[11px] text-ink-muted">Holat</div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <button
              onClick={() => onEdit(item)}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary-600 py-2.5 text-sm font-medium text-white shadow-glow hover:bg-primary-700"
            >
              <Edit2 size={16} variant="Bulk" /> Tahrirlash
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2">
              <Share size={16} variant="Bulk" /> Ulashish
            </button>
            <button className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-surface-2">
              <Printer size={16} variant="Bulk" /> Chop etish
            </button>
            <button
              onClick={() => setDeleteOpen(true)}
              aria-label="Yangilikni o'chirish"
              title="O'chirish"
              className="flex items-center justify-center gap-1.5 rounded-xl border border-danger-soft bg-danger-soft px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:brightness-95"
            >
              <Trash size={16} variant="Bulk" />
            </button>
          </div>
        </article>
      )}

      {/* O'chirish tasdiqi */}
      <ConfirmDialog
        open={deleteOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Yangilikni o'chirasizmi?"
        message={
          <>
            {item && <>"{item.title}" nomli yangilik butunlay o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.</>}
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
