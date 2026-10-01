import { useState } from 'react';
import { Add, CloseCircle, Global, InfoCircle, Key, MagicStar, SearchNormal1, TickCircle, Trash, Warning2 } from 'iconsax-react';
import { Modal } from '@/shared/ui/Modal';
import { Button } from '@/shared/ui/Button';
import { Switch } from '@/shared/ui/Switch';
import { cn } from '@/shared/lib/cn';
import type { MediaFeedConfig, MediaSettings, MediaSettingsView } from './api';
import { useMediaSettings, useSaveMediaSettings } from './api';
import { PLATFORM_META } from './meta';

type Tab = 'keywords' | 'sources' | 'keys';

const TABS: { key: Tab; label: string }[] = [
  { key: 'keywords', label: "Kalit so'zlar" },
  { key: 'sources', label: 'Manbalar' },
  { key: 'keys', label: 'Integratsiyalar' },
];

export function MediaSettingsModal({
  open,
  onClose,
  canEdit,
  initialTab = 'keywords',
}: {
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
  initialTab?: Tab;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Monitoring sozlamalari" subtitle="Nimani va qayerdan kuzatamiz" width={760}>
      {/* Mounted per opening, so tab + draft always start from the server state. */}
      {open && <SettingsBody onClose={onClose} canEdit={canEdit} initialTab={initialTab} />}
    </Modal>
  );
}

function SettingsBody({ onClose, canEdit, initialTab }: { onClose: () => void; canEdit: boolean; initialTab: Tab }) {
  const { data } = useMediaSettings(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  return (
    <>
      <div role="tablist" className="-mt-1 mb-5 flex gap-1 overflow-x-auto rounded-xl bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'h-9 flex-1 whitespace-nowrap rounded-lg px-3 text-[13px] font-medium transition-colors',
              tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!canEdit && tab !== 'keys' && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-info-soft p-3 text-[13px] text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
          <InfoCircle size={18} className="shrink-0" /> Faqat bosh administrator o'zgartira oladi — siz ko'rish rejimidasiz.
        </p>
      )}

      {!data ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <SettingsForm data={data} tab={tab} canEdit={canEdit} onClose={onClose} />
      )}
    </>
  );
}

function SettingsForm({
  data,
  tab,
  canEdit,
  onClose,
}: {
  data: MediaSettingsView;
  tab: Tab;
  canEdit: boolean;
  onClose: () => void;
}) {
  const save = useSaveMediaSettings();
  const [draft, setDraft] = useState<MediaSettings>(() => structuredClone(data.settings));
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof MediaSettings>(k: K, v: MediaSettings[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  async function submit() {
    setError(null);
    try {
      await save.mutateAsync(draft);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Saqlab bo'lmadi");
    }
  }

  return (
    <>
      {tab === 'keywords' ? (
        <div className="space-y-5">
          <Field
            label="Asosiy kalit so'zlar"
            hint="Aniq tumanga tegishli iboralar. Har xil yozilishi (ʻ ' ` , ғ/г, kirill/lotin) avtomatik tenglashtiriladi."
          >
            <TagInput value={draft.keywords} onChange={(v) => set('keywords', v)} disabled={!canEdit} placeholder="masalan: Qorasuv mahallasi" />
          </Field>
          <Field label="Ikkilamchi so'zlar" hint="Yolg'iz o'zi noaniq (olim, ko'cha, metro nomi) — pastroq moslik bilan olinadi.">
            <TagInput value={draft.weakKeywords} onChange={(v) => set('weakKeywords', v)} disabled={!canEdit} tone="amber" />
          </Field>
          <Field label="Istisno iboralar" hint="Matndan oldin olib tashlanadi: «Mirzo Ulug'bek nomidagi universitet» tumanga hisoblanmaydi.">
            <TagInput value={draft.excludes} onChange={(v) => set('excludes', v)} disabled={!canEdit} tone="red" />
          </Field>
          <Field
            label={`Minimal moslik: ${draft.minRelevance}%`}
            hint="Bundan past baholangan xabarlar lentada yashiriladi (filtrdan «past moslik»ni yoqib ko'rish mumkin)."
          >
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.minRelevance}
              disabled={!canEdit}
              onChange={(e) => set('minRelevance', Number(e.target.value))}
              className="w-full accent-primary-600"
              aria-label="Minimal moslik"
            />
          </Field>
        </div>
      ) : tab === 'sources' ? (
        <div className="space-y-6">
          <Section icon={<PLATFORM_META.web.Icon size={16} />} color={PLATFORM_META.web.color} title="Yangilik saytlari (RSS)">
            <FeedList feeds={draft.rssFeeds} onChange={(v) => set('rssFeeds', v)} disabled={!canEdit} />
          </Section>
          <Section icon={<PLATFORM_META.telegram.Icon size={16} />} color={PLATFORM_META.telegram.color} title="Telegram kanallar" note="Kalit kerak emas — ochiq kanallar t.me/s orqali o'qiladi">
            <TagInput value={draft.telegramChannels} onChange={(v) => set('telegramChannels', v)} disabled={!canEdit} prefix="@" placeholder="kanal nomi yoki t.me havola" />
          </Section>
          <Section icon={<PLATFORM_META.youtube.Icon size={16} />} color={PLATFORM_META.youtube.color} title="YouTube">
            <Field label="Kanallar (ID: UC...)" hint="Kalitsiz ishlaydi — kanalning ochiq RSS'i o'qiladi.">
              <TagInput value={draft.youtubeChannels} onChange={(v) => set('youtubeChannels', v)} disabled={!canEdit} placeholder="UCxxxxxxxxxxxxxxxxxxxxxx" />
            </Field>
            <Field label="Qidiruv so'rovi" hint={'YOUTUBE_API_KEY bilan butun YouTube bo‘yicha qidiradi. «|» = YOKI.'}>
              <TextInput value={draft.youtubeQuery} onChange={(v) => set('youtubeQuery', v)} disabled={!canEdit} />
            </Field>
          </Section>
          <Section icon={<PLATFORM_META.instagram.Icon size={16} />} color={PLATFORM_META.instagram.color} title="Instagram" note="INSTAGRAM_ACCESS_TOKEN kerak">
            <Field label="Heshteglar">
              <TagInput value={draft.instagramHashtags} onChange={(v) => set('instagramHashtags', v)} disabled={!canEdit} prefix="#" />
            </Field>
            <Field label="Akkauntlar (biznes/creator)">
              <TagInput value={draft.instagramAccounts} onChange={(v) => set('instagramAccounts', v)} disabled={!canEdit} prefix="@" />
            </Field>
          </Section>
          <Section icon={<SearchNormal1 size={16} />} color="#4285F4" title="Google News qidiruvi" note="Google indekslagan barcha nashrlar">
            <TextInput value={draft.googleNewsQuery} onChange={(v) => set('googleNewsQuery', v)} disabled={!canEdit} />
          </Section>
        </div>
      ) : (
        <IntegrationsTab integrations={data.integrations} />
      )}

      {error && (
        <p className="mt-4 flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-[13px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <Warning2 size={18} className="shrink-0" /> {error}
        </p>
      )}

      {canEdit && tab !== 'keys' && (
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-6 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
          <Button variant="ghost" size="sm" onClick={() => setDraft(structuredClone(data.defaults))}>
            Standart holat
          </Button>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button onClick={submit} disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saqlanmoqda…' : 'Saqlash'}
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold text-ink">{label}</p>
      {children}
      {hint && <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{hint}</p>}
    </div>
  );
}

function Section({
  icon,
  color,
  title,
  note,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2" style={{ color }}>
          {icon}
        </span>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {note && <span className="text-xs text-ink-muted">· {note}</span>}
      </div>
      {children}
    </section>
  );
}

function TextInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-surface-2 dark:focus:ring-primary-500/20"
    />
  );
}

const TAG_TONES = {
  green: 'bg-primary-50 text-primary-800 ring-primary-200 dark:bg-primary-500/10 dark:text-primary-300 dark:ring-primary-500/30',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  red: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
};

/** Chips + inline input: Enter / comma adds, Backspace on empty removes the last. */
function TagInput({
  value,
  onChange,
  disabled,
  placeholder = "Qo'shish va Enter",
  prefix,
  tone = 'green',
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  prefix?: string;
  tone?: keyof typeof TAG_TONES;
}) {
  const [text, setText] = useState('');
  const add = (raw: string) => {
    const parts = raw
      .split(/[,\n]/)
      .map((p) => p.trim().replace(prefix ? new RegExp(`^\\${prefix}`) : /^$/, ''))
      .filter(Boolean);
    if (parts.length) onChange([...new Set([...value, ...parts])]);
    setText('');
  };
  return (
    <div
      className={cn(
        'flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5 transition focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-500/20',
        disabled && 'bg-surface-2',
      )}
    >
      {value.map((v) => (
        <span key={v} className={cn('inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1 text-[13px] ring-1', TAG_TONES[tone])}>
          <span className="truncate">
            {prefix}
            {v}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== v))}
              aria-label={`${v} ni olib tashlash`}
              className="-mr-0.5 rounded opacity-60 hover:opacity-100"
            >
              <CloseCircle size={15} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <input
          value={text}
          onChange={(e) => {
            const v = e.target.value;
            if (v.includes(',')) add(v);
            else setText(v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(text);
            } else if (e.key === 'Backspace' && !text && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => text.trim() && add(text)}
          onPaste={(e) => {
            const t = e.clipboardData.getData('text');
            if (/[,\n]/.test(t)) {
              e.preventDefault();
              add(t);
            }
          }}
          placeholder={value.length ? '' : placeholder}
          className="h-8 min-w-[10rem] flex-1 bg-transparent px-1.5 text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      )}
    </div>
  );
}

function FeedList({
  feeds,
  onChange,
  disabled,
}: {
  feeds: MediaFeedConfig[];
  onChange: (v: MediaFeedConfig[]) => void;
  disabled?: boolean;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const validUrl = /^https?:\/\/\S{4,}$/i.test(url.trim());
  const addFeed = () => {
    if (!name.trim() || !validUrl) return;
    const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'feed';
    let key = base.length >= 2 ? base : `${base}-rss`;
    let n = 2;
    while (feeds.some((f) => f.key === key)) key = `${base}-${n++}`;
    onChange([...feeds, { key, name: name.trim(), url: url.trim(), enabled: true }]);
    setName('');
    setUrl('');
  };
  return (
    <div className="space-y-2">
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {feeds.map((f) => (
          <li key={f.key} className="flex items-center gap-3 px-3 py-2.5">
            <Global size={16} className="shrink-0 text-ink-muted" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-ink">{f.name}</p>
              <p className="truncate text-xs text-ink-muted">{f.url}</p>
            </div>
            <Switch
              checked={f.enabled}
              disabled={disabled}
              onChange={(v) => onChange(feeds.map((x) => (x.key === f.key ? { ...x, enabled: v } : x)))}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onChange(feeds.filter((x) => x.key !== f.key))}
                aria-label={`${f.name} ni o'chirish`}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-danger-soft hover:text-red-600"
              >
                <Trash size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nomi (masalan: Qalampir)"
            aria-label="RSS nomi"
            className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary-400 sm:w-44"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFeed()}
            placeholder="https://sayt.uz/rss"
            aria-label="RSS manzili"
            className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary-400"
          />
          <Button variant="secondary" onClick={addFeed} disabled={!name.trim() || !validUrl}>
            <Add size={16} /> Qo'shish
          </Button>
        </div>
      )}
    </div>
  );
}

const KEY_GUIDES = [
  {
    id: 'ai',
    title: 'AI xulosa — Claude',
    icon: <MagicStar size={18} variant="Bulk" />,
    color: '#7c3aed',
    env: ['ANTHROPIC_API_KEY=sk-ant-...', '# ixtiyoriy: MEDIA_AI_MODEL=claude-sonnet-5-5'],
    gives: "Har bir xabarni o'qib: tumanga tegishlimi, kayfiyati, mavzusi va 1 gaplik mazmuni. Hokim uchun xulosa, xavflar va tavsiyalar.",
    steps: ['console.anthropic.com → API Keys → Create Key', 'Billing bo‘limida balans bo‘lishi kerak'],
  },
  {
    id: 'youtube',
    title: 'YouTube qidiruvi',
    icon: <PLATFORM_META.youtube.Icon size={18} />,
    color: PLATFORM_META.youtube.color,
    env: ['YOUTUBE_API_KEY=AIza...'],
    gives: "Butun YouTube bo'yicha kalit so'z qidiruvi (kalitsiz faqat ro'yxatdagi kanallar). Kuniga ~5 000 kvota birligi ishlatiladi (bepul limit 10 000).",
    steps: ['console.cloud.google.com → loyiha yarating', 'APIs & Services → «YouTube Data API v3» ni yoqing', 'Credentials → Create credentials → API key'],
  },
  {
    id: 'instagram',
    title: 'Instagram',
    icon: <PLATFORM_META.instagram.Icon size={18} />,
    color: PLATFORM_META.instagram.color,
    env: ['INSTAGRAM_ACCESS_TOKEN=EAA...', 'INSTAGRAM_BUSINESS_ID=1784...'],
    gives: 'Heshteglar va ochiq biznes akkauntlar (kun.uz, daryo.uz ...) postlari.',
    steps: [
      'Instagram akkauntni Business/Creator qiling va Facebook sahifaga ulang',
      'developers.facebook.com → App yarating → Instagram Graph API',
      'Ruxsatlar: instagram_basic, pages_read_engagement, Instagram Public Content Access',
      'Uzoq muddatli (long-lived) token va IG business ID oling',
    ],
  },
] as const;

function IntegrationsTab({ integrations }: { integrations: { ai: boolean; aiModel: string | null; youtube: boolean; instagram: boolean } }) {
  const connected: Record<string, boolean> = { ai: integrations.ai, youtube: integrations.youtube, instagram: integrations.instagram };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <FreeSource label="Yangilik saytlari (RSS)" Icon={PLATFORM_META.web.Icon} color={PLATFORM_META.web.color} />
        <FreeSource label="Telegram kanallar" Icon={PLATFORM_META.telegram.Icon} color={PLATFORM_META.telegram.color} />
        <FreeSource label="Google News" Icon={({ size }) => <SearchNormal1 size={size} />} color="#4285F4" />
        <FreeSource label="YouTube kanallar (RSS)" Icon={PLATFORM_META.youtube.Icon} color={PLATFORM_META.youtube.color} />
      </div>
      {KEY_GUIDES.map((g) => {
        const on = connected[g.id];
        return (
          <section key={g.id} className="rounded-2xl border border-line p-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2" style={{ color: g.color }}>
                {g.icon}
              </span>
              <h3 className="text-sm font-semibold text-ink">{g.title}</h3>
              <span
                className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1',
                  on
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30'
                    : 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
                )}
              >
                {on ? <TickCircle size={13} variant="Bold" /> : <Key size={13} variant="Bold" />}
                {on ? (g.id === 'ai' && integrations.aiModel ? `Ulangan · ${integrations.aiModel}` : 'Ulangan') : 'Kalit kerak'}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{g.gives}</p>
            {!on && (
              <>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-ink-soft">
                  {g.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-[12px] leading-relaxed text-emerald-300">
                  {g.env.join('\n')}
                </pre>
              </>
            )}
          </section>
        );
      })}
      <p className="flex items-start gap-2 rounded-xl bg-surface-2 p-3 text-xs leading-relaxed text-ink-soft">
        <InfoCircle size={16} className="shrink-0 text-ink-muted" />
        Kalitlar faqat serverdagi <code className="rounded bg-surface px-1">.env</code> faylga yoziladi (kodga emas), so'ng backend qayta ishga
        tushiriladi. Kalit qo'shilmaguncha monitoring qolgan manbalar va avtomatik tahlil bilan ishlayveradi.
      </p>
    </div>
  );
}

function FreeSource({
  label,
  Icon,
  color,
}: {
  label: string;
  Icon: (p: { size?: number; className?: string }) => React.ReactElement;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5">
      <span style={{ color }}>
        <Icon size={18} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{label}</span>
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
        <TickCircle size={13} variant="Bold" /> Kalitsiz
      </span>
    </div>
  );
}
