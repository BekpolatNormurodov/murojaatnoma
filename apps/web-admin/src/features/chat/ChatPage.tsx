import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  MessageAdd1,
  DocumentDownload,
  RotateRight,
  Clock,
} from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { VideoCall, type CallParticipant } from '@/shared/ui/VideoCall';
import { ChatComposer } from './ChatComposer';
import { EmployeePickerModal } from './EmployeePickerModal';
import {
  useConversations,
  useMessages,
  useSendMessage,
  useMarkRead,
  usePrefersReducedMotion,
  useOpenDirectConversation,
  useLiveEmployees,
} from './useChat';
import { pickAvatarColor } from './chatAvatar';
import { useRealtimeChat } from './useRealtimeChat';
import type { LiveLocation } from '@/shared/api/locations';
import { ME_ID, GROUP_ID, useChatUi, type ChatMessage } from '@/shared/store/chat';
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

/**
 * Guruh suhbatidagi jo'natuvchi ismi uchun — barqaror, uyg'un va "pro"
 * ko'rinadigan palitra (bir xil xodim doim bir xil rang). Avvalgi yorqin
 * tasodifiy ranglar o'rniga chuqurroq -600 tonli, o'zaro mos ranglar.
 */
const SENDER_COLORS = [
  '#2563eb', '#7c3aed', '#0891b2', '#c026d3', '#0d9488',
  '#4f46e5', '#db2777', '#ea580c', '#0284c7', '#9333ea',
];
function senderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SENDER_COLORS[h % SENDER_COLORS.length];
}

function senderInfo(senderId: string) {
  if (senderId === ME_ID) return { name: 'Siz', color: '#059669', photo: undefined as string | undefined };
  const st = STAFF.find((s) => s.id === senderId);
  return { name: st?.name ?? 'Xodim', color: senderColor(senderId), photo: st?.photo };
}

function previewText(m: ChatMessage): string {
  if (m.kind === 'image') return '📷 Rasm';
  if (m.kind === 'file') return `📎 ${m.fileName ?? 'Fayl'}`;
  if (m.kind === 'voice') return '🎤 Ovozli xabar';
  return m.text ?? '';
}

/* ---------------- Skeleton (yuklanmoqda) ---------------- */
function RowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-2.5 py-2.5">
      <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-surface-2" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="h-3 w-2/3 animate-pulse rounded bg-surface-2" />
        <div className="h-2.5 w-4/5 animate-pulse rounded bg-surface-2" />
      </div>
    </div>
  );
}

/* ============================================================
   Chat sahifasi — umumiy va shaxsiy suhbatlar
   ============================================================ */
export function ChatPage() {
  const conversationsQuery = useConversations();
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);

  const activeId = useChatUi((s) => s.activeConversationId);
  const setActiveId = useChatUi((s) => s.setActiveConversationId);

  const messagesQuery = useMessages(activeId);
  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const sendMessage = useSendMessage();
  const { mutate: markRead } = useMarkRead();

  // Jonli (realtime) suhbat: yangi xabarlar, o'qildi, "yozmoqda…" va onlayn
  // holati socket orqali darhol keladi (86436 gateway kontrakti).
  const { typing, emitTyping } = useRealtimeChat(activeId);

  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const openDirect = useOpenDirectConversation();
  const employeesQuery = useLiveEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct'>('all');
  const [mobileThread, setMobileThread] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Oxirgi marta qaysi suhbat uchun tagiga tushirilganini eslab qolamiz —
  // suhbat ochilganda sakrab (animatsiyasiz), yangi xabar kelganda esa
  // silliq skroll qilish uchun.
  const scrolledConvRef = useRef<string | null>(null);

  const prefersReducedMotion = usePrefersReducedMotion();

  const activeConv = conversations.find((c) => c.id === activeId) ?? null;

  // Suhbatlar ro'yxati: qidiruv/filtr, so'ng guruh birinchi + oxirgi xabar vaqti bo'yicha
  const convList = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === 'direct' ? c.kind === 'direct' : true))
      .filter((c) => !q || c.title.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.id === GROUP_ID) return -1;
        if (b.id === GROUP_ID) return 1;
        const ta = a.lastMessage ? +new Date(a.lastMessage.createdAt) : 0;
        const tb = b.lastMessage ? +new Date(b.lastMessage.createdAt) : 0;
        return tb - ta;
      });
  }, [conversations, query, filter]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations],
  );

  // Faol suhbat ochilganda (yoki unga yangi xabar kelganda) o'qilgan deb belgilash
  useEffect(() => {
    if (!activeId) return;
    markRead(activeId);
  }, [activeId, activeMessages.length, markRead]);

  // Pastga avtomatik scroll: suhbat ochilganda (yoki hali xabarlar
  // yuklanmaganda) — sakrab, animatsiyasiz; keyingi yangi xabarlarda —
  // silliq skroll. `prefers-reduced-motion` yoqilgan bo'lsa har doim sakraydi.
  useEffect(() => {
    if (!activeId || messagesQuery.isLoading) return;
    const el = bottomRef.current;
    if (!el) return;

    const isFirstOpen = scrolledConvRef.current !== activeId;
    const behavior: ScrollBehavior = isFirstOpen || prefersReducedMotion ? 'auto' : 'smooth';
    el.scrollIntoView({ behavior, block: 'end' });
    scrolledConvRef.current = activeId;
  }, [activeId, activeMessages.length, messagesQuery.isLoading, prefersReducedMotion]);

  // "Xodimga yozish" yo'li: `?to=<employeeId>` — xarita sahifasidan yoki shu
  // sahifadagi tanlagichdan kelgan bitta DM ochish so'rovi. Xodim nomi/rangi
  // xarita ishlatadigan aynan o'sha jonli ro'yxatdan (`useLiveEmployees`)
  // olinadi; topilmasa — "Xodim" degan neytral sarlavha bilan davom etiladi.
  // Suhbat ochilgach faol qilinadi va `to` parametri URL'dan tozalanadi
  // (sahifani yangilash qayta trigger qilmasligi uchun).
  const resolvingToRef = useRef<string | null>(null);
  const toEmployeeId = searchParams.get('to');

  useEffect(() => {
    if (!toEmployeeId) {
      resolvingToRef.current = null;
      return;
    }
    if (employeesQuery.isLoading) return; // ism/rasmni olguncha kutamiz
    if (resolvingToRef.current === toEmployeeId) return; // shu param uchun so'rov allaqachon yuborilgan
    resolvingToRef.current = toEmployeeId;

    const employee = employees.find((e) => e.employeeId === toEmployeeId);

    openDirect.mutate(
      {
        employeeId: toEmployeeId,
        title: employee?.fullName.trim() || 'Xodim',
        avatarColor: pickAvatarColor(toEmployeeId),
      },
      {
        onSuccess: (conversation) => {
          setActiveId(conversation.id);
          setMobileThread(true);
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('to');
              return next;
            },
            { replace: true },
          );
        },
        onSettled: () => {
          resolvingToRef.current = null;
        },
      },
    );
    // openDirect.mutate is intentionally excluded — it's stable enough for this
    // purpose and including the mutation object would re-fire this effect on
    // every pending/success/error transition (the resolvingToRef guard above
    // is what actually prevents duplicate requests).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toEmployeeId, employeesQuery.isLoading, employees, setActiveId, setSearchParams]);

  function handlePickEmployee(employee: LiveLocation) {
    setPickerOpen(false);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('to', employee.employeeId);
        return next;
      },
      { replace: false },
    );
  }

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

  function handleSendText(text: string) {
    sendMessage.mutate({ conversationId: activeId, senderId: ME_ID, kind: 'text', text });
  }
  function handleSendVoice(url: string, durationSec: number) {
    sendMessage.mutate({ conversationId: activeId, senderId: ME_ID, kind: 'voice', url, durationSec });
  }
  function handleSendFile(url: string, kind: 'image' | 'file', name: string, size: number) {
    sendMessage.mutate({
      conversationId: activeId,
      senderId: ME_ID,
      kind,
      url,
      fileName: name,
      fileSize: size,
    });
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
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPickerOpen(true)}
            className="mt-2 w-full justify-center"
          >
            <MessageAdd1 size={16} variant="Bulk" />
            Xodimga yozish
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {conversationsQuery.isError ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <CloseCircle size={32} variant="Bulk" className="text-danger" />
              <p className="text-sm text-ink-muted">Suhbatlarni yuklab bo'lmadi</p>
              <Button variant="secondary" size="sm" onClick={() => conversationsQuery.refetch()}>
                <RotateRight size={15} /> Qayta urinish
              </Button>
            </div>
          ) : conversationsQuery.isLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-16 text-center">
              <Messages2 size={36} variant="Bulk" className="text-ink-muted" />
              <p className="text-sm font-medium text-ink">Hozircha suhbatlar yo'q</p>
              <p className="text-xs text-ink-muted">Xodim bilan yozishmani boshlaganingizda shu yerda ko'rinadi</p>
            </div>
          ) : (
            <>
              {convList.map((conv) => {
                const last = conv.lastMessage;
                const unread = conv.unreadCount;
                return (
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
                          {last ? (
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
                );
              })}
              {convList.length === 0 && (
                <p className="py-10 text-center text-sm text-ink-muted">Suhbat topilmadi</p>
              )}
            </>
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
                  {typing ? (
                    <span className="font-medium text-primary-600">yozmoqda…</span>
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
            <div
              ref={scrollRef}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
              className="flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-6"
            >
              {messagesQuery.isError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <CloseCircle size={32} variant="Bulk" className="text-danger" />
                  <p className="text-sm text-ink-muted">Xabarlarni yuklab bo'lmadi</p>
                  <Button variant="secondary" size="sm" onClick={() => messagesQuery.refetch()}>
                    <RotateRight size={15} /> Qayta urinish
                  </Button>
                </div>
              ) : messagesQuery.isLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
                </div>
              ) : (
                <>
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
                        reduce={prefersReducedMotion}
                        onImageClick={setLightbox}
                      />
                    ),
                  )}
                  {activeMessages.length === 0 && (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                      <Messages2 size={36} variant="Bulk" className="text-ink-muted" />
                      <p className="text-sm text-ink-muted">Hali xabarlar yo'q — birinchi bo'lib yozing</p>
                    </div>
                  )}
                  {typing && <TypingBubble />}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Yozish paneli */}
            <ChatComposer
              onSendText={handleSendText}
              onSendVoice={handleSendVoice}
              onSendFile={handleSendFile}
              onTyping={(isTyping) => {
                if (activeId) emitTyping(activeId, isTyping);
              }}
            />
          </>
        ) : conversationsQuery.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" />
          </div>
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
        title={activeConv?.title ?? 'Qo‘ng‘iroq'}
        subtitle={activeConv?.kind === 'group' ? 'Guruh qo‘ng‘irog‘i' : undefined}
        participants={callParticipants}
      />

      {/* "Xodimga yozish" — xodim tanlagich (umumiy chat entry-point) */}
      <EmployeePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickEmployee}
      />

      {/* Rasm ko'rish (lightbox) */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
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
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
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
  reduce,
  onImageClick,
}: {
  msg: ChatMessage;
  first: boolean;
  isGroup: boolean;
  reduce: boolean;
  onImageClick: (url: string) => void;
}) {
  const mine = msg.senderId === ME_ID;
  const info = senderInfo(msg.senderId);
  const sending = msg.status === 'sending';

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
      className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', first ? 'mt-3' : 'mt-0.5')}
    >
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
            'overflow-hidden shadow-card transition-opacity',
            msg.kind === 'image' ? 'rounded-2xl' : 'px-3.5 py-2.5',
            mine
              ? 'rounded-2xl rounded-br-md bg-primary-600 text-white'
              : 'rounded-2xl rounded-bl-md border border-line bg-surface text-ink',
            sending && 'opacity-70',
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
          {mine &&
            (sending ? (
              <Clock size={11} variant="Linear" className="text-ink-muted/70" />
            ) : (
              <TickCircle
                size={12}
                variant={msg.status === 'read' ? 'Bold' : 'Linear'}
                className={msg.status === 'read' ? 'text-primary-500' : 'text-ink-muted'}
              />
            ))}
        </div>
      </div>
    </motion.div>
  );
}

/* ---------------- "Yozmoqda…" ko'rsatkichi ---------------- */
function TypingBubble() {
  return (
    <div className="mt-3 flex items-end gap-2 justify-start">
      <div className="w-8 shrink-0" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-line bg-surface px-3.5 py-3 shadow-card">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-ink-muted"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
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
