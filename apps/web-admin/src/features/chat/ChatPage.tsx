import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  SearchNormal1,
  People,
  Call,
  Video,
  ArrowLeft2,
  Document,
  TickCircle,
  Play,
  Pause,
  CloseCircle,
  Messages2,
  DocumentDownload,
} from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { VideoCall, type CallParticipant } from '@/shared/ui/VideoCall';
import { ChatComposer } from './ChatComposer';
import { useChat, ME_ID, GROUP_ID, type ChatMessage } from '@/shared/store/chat';
import { STAFF } from '@/shared/data/mock';
import { formatDate } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';

/* ---------------- helperlar ---------------- */

const pad = (n: number) => String(n).padStart(2, '0');
const timeHM = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};
function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((a.getTime() - b.getTime()) / 86_400_000);
  if (diff === 0) return 'Bugun';
  if (diff === 1) return 'Kecha';
  return formatDate(iso);
}
const fmtDur = (s: number) => `${Math.floor(s / 60)}:${pad(s % 60)}`;
function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function senderInfo(senderId: string) {
  if (senderId === ME_ID) return { name: 'Siz', color: '#10b981', photo: undefined as string | undefined };
  const st = STAFF.find((s) => s.id === senderId);
  return { name: st?.name ?? 'Xodim', color: st?.avatarColor ?? '#64748b', photo: st?.photo };
}

function previewText(m: ChatMessage): string {
  if (m.kind === 'image') return '📷 Rasm';
  if (m.kind === 'file') return `📎 ${m.fileName ?? 'Fayl'}`;
  if (m.kind === 'voice') return '🎤 Ovozli xabar';
  return m.text ?? '';
}

const REPLIES = [
  'Qabul qildim, rahmat!',
  'Albatta, hoziroq bajaraman.',
  "Ma'lumot uchun rahmat.",
  'Tushunarli, ustida ishlayapman.',
  "Yaxshi, tayyor bo'lgach xabar beraman.",
  "Hammasi joyida, hujjatni ko'rib chiqaman.",
];

/* ============================================================
   Chat sahifasi — umumiy va shaxsiy suhbatlar
   ============================================================ */
export function ChatPage() {
  const conversations = useChat((s) => s.conversations);
  const messages = useChat((s) => s.messages);
  const send = useChat((s) => s.send);
  const markRead = useChat((s) => s.markRead);

  const [activeId, setActiveId] = useState<string>(GROUP_ID);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct'>('all');
  const [mobileThread, setMobileThread] = useState(false);
  const [typingConv, setTypingConv] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  const activeMessages = useMemo(
    () =>
      messages
        .filter((m) => m.conversationId === activeId)
        .sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)),
    [messages, activeId],
  );

  // Suhbatlar ro'yxati: oxirgi xabar + o'qilmaganlar
  const convList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === 'direct' ? c.kind === 'direct' : true))
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .map((c) => {
        const msgs = messages.filter((m) => m.conversationId === c.id);
        const last = msgs.reduce<ChatMessage | null>(
          (acc, m) => (!acc || +new Date(m.createdAt) > +new Date(acc.createdAt) ? m : acc),
          null,
        );
        const unread = msgs.filter((m) => m.senderId !== ME_ID && m.status !== 'read').length;
        return { conv: c, last, unread };
      })
      .sort((a, b) => {
        if (a.conv.id === GROUP_ID) return -1;
        if (b.conv.id === GROUP_ID) return 1;
        const ta = a.last ? +new Date(a.last.createdAt) : 0;
        const tb = b.last ? +new Date(b.last.createdAt) : 0;
        return tb - ta;
      });
  }, [conversations, messages, query, filter]);

  const totalUnread = useMemo(
    () => messages.filter((m) => m.senderId !== ME_ID && m.status !== 'read').length,
    [messages],
  );

  // Faol suhbat ochilganda o'qilgan deb belgilash
  useEffect(() => {
    markRead(activeId);
  }, [activeId, activeMessages.length, markRead]);

  // Pastga avtomatik scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeId, activeMessages.length, typingConv]);

  // Render uchun kunlar bo'yicha guruhlash
  const rendered = useMemo(() => {
    const items: (
      | { kind: 'day'; id: string; label: string }
      | { kind: 'msg'; id: string; msg: ChatMessage; first: boolean }
    )[] = [];
    let lastDay = '';
    let lastSender = '';
    for (const m of activeMessages) {
      const dk = dayKey(m.createdAt);
      if (dk !== lastDay) {
        items.push({ kind: 'day', id: `day-${dk}`, label: dayLabel(m.createdAt) });
        lastDay = dk;
        lastSender = '';
      }
      items.push({ kind: 'msg', id: m.id, msg: m, first: m.senderId !== lastSender });
      lastSender = m.senderId;
    }
    return items;
  }, [activeMessages]);

  const callParticipants: CallParticipant[] = useMemo(() => {
    if (!activeConv) return [];
    if (activeConv.kind === 'direct') {
      const st = STAFF.find((s) => s.id === activeConv.staffId);
      return st ? [{ id: st.id, name: st.name, photo: st.photo, color: st.avatarColor, role: st.position }] : [];
    }
    return STAFF.slice(0, 6).map((s) => ({
      id: s.id,
      name: s.name,
      photo: s.photo,
      color: s.avatarColor,
      role: s.position,
    }));
  }, [activeConv]);

  function openConv(id: string) {
    setActiveId(id);
    setMobileThread(true);
    markRead(id);
  }

  function scheduleReply(convId: string) {
    const conv = conversations.find((c) => c.id === convId);
    if (!conv || conv.kind !== 'direct' || !conv.online || !conv.staffId) return;
    setTypingConv(convId);
    const staffId = conv.staffId;
    window.setTimeout(
      () => {
        setTypingConv((cur) => (cur === convId ? null : cur));
        send({
          conversationId: convId,
          senderId: staffId,
          kind: 'text',
          text: REPLIES[Math.floor(Math.random() * REPLIES.length)],
        });
      },
      1600 + Math.random() * 1400,
    );
  }

  function handleSendText(text: string) {
    send({ conversationId: activeId, senderId: ME_ID, kind: 'text', text });
    scheduleReply(activeId);
  }
  function handleSendVoice(url: string, durationSec: number) {
    send({ conversationId: activeId, senderId: ME_ID, kind: 'voice', url, durationSec });
    scheduleReply(activeId);
  }
  function handleSendFile(url: string, kind: 'image' | 'file', name: string, size: number) {
    send({ conversationId: activeId, senderId: ME_ID, kind, url, fileName: name, fileSize: size });
    scheduleReply(activeId);
  }

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-136 overflow-hidden rounded-2xl border border-line bg-canvas shadow-card">
      {/* ---------- Suhbatlar ro'yxati ---------- */}
      <aside
        className={cn(
          'flex w-full shrink-0 flex-col border-r border-line bg-surface lg:w-80',
          mobileThread ? 'hidden lg:flex' : 'flex',
        )}
      >
        <div className="border-b border-line px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
              <Messages2 size={22} variant="Bulk" className="text-primary-600" />
              Suhbatlar
            </h2>
            {totalUnread > 0 && (
              <span className="rounded-full bg-danger px-2 py-0.5 text-[11px] font-bold text-white">
                {totalUnread}
              </span>
            )}
          </div>
          <div className="relative">
            <SearchNormal1 size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Qidirish…"
              className="h-10 w-full rounded-xl border border-line bg-surface-2 pl-9 pr-3 text-sm outline-none focus:border-primary-300"
            />
          </div>
          <div className="mt-3 flex gap-1.5">
            {(['all', 'direct'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                  filter === f ? 'bg-ink text-white' : 'bg-surface-2 text-ink-soft hover:text-ink',
                )}
              >
                {f === 'all' ? 'Hammasi' : 'Xodimlar'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {convList.map(({ conv, last, unread }) => (
            <button
              key={conv.id}
              onClick={() => openConv(conv.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors',
                activeId === conv.id ? 'bg-primary-50' : 'hover:bg-surface-2',
              )}
            >
              <div className="relative shrink-0">
                {conv.kind === 'group' ? (
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white"
                    style={{ background: `linear-gradient(135deg, ${conv.avatarColor}, ${conv.avatarColor}bb)` }}
                  >
                    <People size={24} variant="Bulk" />
                  </span>
                ) : (
                  <Avatar name={conv.title} src={conv.photo} color={conv.avatarColor} size={48} />
                )}
                {conv.kind === 'direct' && conv.online && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-[14px]', unread ? 'font-bold text-ink' : 'font-semibold text-ink')}>
                    {conv.title}
                  </span>
                  {last && <span className="shrink-0 text-[11px] text-ink-muted">{timeHM(last.createdAt)}</span>}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('truncate text-[12.5px]', unread ? 'text-ink-soft' : 'text-ink-muted')}>
                    {typingConv === conv.id ? (
                      <span className="text-primary-600">yozmoqda…</span>
                    ) : last ? (
                      <>
                        {last.senderId === ME_ID && <span className="text-ink-muted">Siz: </span>}
                        {conv.kind === 'group' && last.senderId !== ME_ID && (
                          <span className="text-ink-muted">{senderInfo(last.senderId).name.split(' ')[0]}: </span>
                        )}
                        {previewText(last)}
                      </>
                    ) : (
                      <span className="italic text-ink-muted">Xabar yo'q</span>
                    )}
                  </span>
                  {unread > 0 && (
                    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 px-1.5 text-[11px] font-bold text-white">
                      {unread}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
          {convList.length === 0 && (
            <p className="py-10 text-center text-sm text-ink-muted">Suhbat topilmadi</p>
          )}
        </div>
      </aside>

      {/* ---------- Suhbat oynasi ---------- */}
      <section
        className={cn(
          'flex min-w-0 flex-1 flex-col bg-canvas',
          mobileThread ? 'flex' : 'hidden lg:flex',
        )}
      >
        {activeConv ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-line bg-surface px-3 py-3 sm:px-4">
              <button
                onClick={() => setMobileThread(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft hover:bg-surface-2 lg:hidden"
              >
                <ArrowLeft2 size={20} />
              </button>
              <div className="relative shrink-0">
                {activeConv.kind === 'group' ? (
                  <span
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white"
                    style={{ background: `linear-gradient(135deg, ${activeConv.avatarColor}, ${activeConv.avatarColor}bb)` }}
                  >
                    <People size={22} variant="Bulk" />
                  </span>
                ) : (
                  <Avatar name={activeConv.title} src={activeConv.photo} color={activeConv.avatarColor} size={44} />
                )}
                {activeConv.kind === 'direct' && activeConv.online && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-surface bg-success" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[15px] font-bold text-ink">{activeConv.title}</h3>
                <p className="truncate text-[12px] text-ink-muted">
                  {typingConv === activeConv.id ? (
                    <span className="text-primary-600">yozmoqda…</span>
                  ) : activeConv.kind === 'group' ? (
                    activeConv.subtitle
                  ) : activeConv.online ? (
                    <span className="text-success">onlayn</span>
                  ) : (
                    'oflayn'
                  )}
                </p>
              </div>
              <button
                onClick={() => setCallOpen(true)}
                title="Audio qo'ng'iroq"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <Call size={21} variant="Bulk" />
              </button>
              <button
                onClick={() => setCallOpen(true)}
                title="Video qo'ng'iroq"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600"
              >
                <Video size={21} variant="Bulk" />
              </button>
            </div>

            {/* Xabarlar */}
            <div ref={scrollRef} className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-6">
              {rendered.map((item) =>
                item.kind === 'day' ? (
                  <div key={item.id} className="flex justify-center py-3">
                    <span className="rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-ink-muted">
                      {item.label}
                    </span>
                  </div>
                ) : (
                  <MessageRow
                    key={item.id}
                    msg={item.msg}
                    first={item.first}
                    isGroup={activeConv.kind === 'group'}
                    onImageClick={setLightbox}
                  />
                ),
              )}
              {typingConv === activeConv.id && (
                <div className="flex items-center gap-1.5 px-1 pt-2">
                  <span className="flex gap-1 rounded-2xl bg-surface px-3 py-2.5 shadow-card">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="h-2 w-2 rounded-full bg-ink-muted"
                        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                </div>
              )}
            </div>

            {/* Yozish paneli */}
            <ChatComposer
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
              onSendFile={handleSendFile}
            />
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
            <Messages2 size={48} variant="Bulk" className="text-ink-muted" />
            <p className="text-sm text-ink-muted">Suhbatni tanlang</p>
          </div>
        )}
      </section>

      {/* Video/Audio qo'ng'iroq */}
      <VideoCall
        open={callOpen}
        onClose={() => setCallOpen(false)}
        title={activeConv?.title ?? 'Qo\u2018ng\u2018iroq'}
        subtitle={activeConv?.kind === 'group' ? 'Guruh qo\u2018ng\u2018irog\u2018i' : undefined}
        participants={callParticipants}
      />

      {/* Rasm ko'rish (lightbox) */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          >
            <button
              onClick={() => setLightbox(null)}
              className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <CloseCircle size={24} variant="Bulk" />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={lightbox}
              alt="rasm"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Bitta xabar ---------------- */
function MessageRow({
  msg,
  first,
  isGroup,
  onImageClick,
}: {
  msg: ChatMessage;
  first: boolean;
  isGroup: boolean;
  onImageClick: (url: string) => void;
}) {
  const mine = msg.senderId === ME_ID;
  const info = senderInfo(msg.senderId);

  return (
    <div className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', first ? 'mt-3' : 'mt-0.5')}>
      {!mine && (
        <div className="w-8 shrink-0">
          {first && <Avatar name={info.name} src={info.photo} color={info.color} size={32} />}
        </div>
      )}
      <div
        className={cn(
          'max-w-[78%] sm:max-w-[68%]',
          mine ? 'items-end' : 'items-start',
          'flex flex-col',
        )}
      >
        <div
          className={cn(
            'overflow-hidden shadow-card',
            msg.kind === 'image' ? 'rounded-2xl' : 'px-3.5 py-2.5',
            mine
              ? 'rounded-2xl rounded-br-md bg-primary-600 text-white'
              : 'rounded-2xl rounded-bl-md bg-surface text-ink',
          )}
        >
          {!mine && first && isGroup && msg.kind !== 'image' && (
            <p className="mb-0.5 text-[12px] font-semibold" style={{ color: info.color }}>
              {info.name}
            </p>
          )}

          {msg.kind === 'text' && <p className="whitespace-pre-wrap wrap-break-word text-[14px] leading-relaxed">{msg.text}</p>}

          {msg.kind === 'image' && msg.url && (
            <button onClick={() => onImageClick(msg.url!)} className="block">
              <img src={msg.url} alt={msg.fileName ?? 'rasm'} className="max-h-72 w-full cursor-pointer object-cover" />
            </button>
          )}

          {msg.kind === 'file' && msg.url && (
            <a
              href={msg.url}
              download={msg.fileName}
              className={cn(
                'flex items-center gap-3',
                mine ? 'text-white' : 'text-ink',
              )}
            >
              <span
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                  mine ? 'bg-white/20' : 'bg-surface-2',
                )}
              >
                <Document size={20} variant="Bulk" />
              </span>
              <span className="min-w-0">
                <span className="block max-w-44 truncate text-[13px] font-medium">{msg.fileName}</span>
                <span className={cn('text-[11px]', mine ? 'text-white/70' : 'text-ink-muted')}>
                  {msg.fileSize ? fmtBytes(msg.fileSize) : ''}
                </span>
              </span>
              <DocumentDownload size={18} className={mine ? 'text-white/80' : 'text-ink-muted'} />
            </a>
          )}

          {msg.kind === 'voice' && msg.url && (
            <VoiceBubble url={msg.url} duration={msg.durationSec ?? 1} mine={mine} />
          )}
        </div>
        <div className={cn('mt-0.5 flex items-center gap-1 px-1 text-[10.5px] text-ink-muted')}>
          <span>{timeHM(msg.createdAt)}</span>
          {mine && (
            <TickCircle
              size={12}
              variant={msg.status === 'read' ? 'Bold' : 'Linear'}
              className={msg.status === 'read' ? 'text-primary-500' : 'text-ink-muted'}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Ovozli xabar ---------------- */
function VoiceBubble({ url, duration, mine }: { url: string; duration: number; mine: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);

  const bars = useMemo(
    () => Array.from({ length: 30 }, (_, i) => 5 + ((i * 11 + url.length * 3) % 17)),
    [url],
  );
  const pct = duration > 0 ? Math.min(1, cur / duration) : 0;

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else void a.play();
  }

  return (
    <div className="flex items-center gap-2.5 py-0.5">
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
      />
      <button
        onClick={toggle}
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          mine ? 'bg-white/20 text-white' : 'bg-primary-50 text-primary-600',
        )}
      >
        {playing ? <Pause size={18} variant="Bold" /> : <Play size={18} variant="Bold" />}
      </button>
      <div className="flex h-7 items-center gap-0.5">
        {bars.map((h, i) => {
          const filled = i / bars.length <= pct;
          return (
            <span
              key={i}
              className={cn(
                'w-0.5 rounded-full transition-colors',
                mine ? (filled ? 'bg-white' : 'bg-white/35') : filled ? 'bg-primary-500' : 'bg-ink-muted/30',
              )}
              style={{ height: h }}
            />
          );
        })}
      </div>
      <span className={cn('text-[11px] tabular-nums', mine ? 'text-white/80' : 'text-ink-muted')}>
        {fmtDur(playing || cur > 0 ? Math.round(cur) : duration)}
      </span>
    </div>
  );
}
