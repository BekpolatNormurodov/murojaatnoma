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
  More,
  Trash,
  Edit2,
  Archive,
  ArchiveMinus,
  Broom,
  type Icon as IconType,
} from 'iconsax-react';
import { Avatar } from '@/shared/ui/Avatar';
import { Button } from '@/shared/ui/Button';
import { ConfirmDialog } from '@/shared/ui/ConfirmDialog';
import { ApiError } from '@/shared/api/client';
import { useCall } from '@/shared/realtime/CallProvider';
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
  useDeleteMessage,
  useEditMessage,
  useArchiveConversation,
  useClearConversation,
  useDeleteConversation,
} from './useChat';
import { pickAvatarColor } from './chatAvatar';
import { useRealtimeChat } from './useRealtimeChat';
import type { LiveLocation } from '@/shared/api/locations';
import {
  ME_ID,
  GROUP_ID,
  useChatUi,
  type ChatMessage,
  type ChatConversation,
} from '@/shared/store/chat';
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
  if (m.kind === 'video') return '🎥 Video xabar';
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

/* ---------------- Amallar menyusi (framer-motion popover) ---------------- */
interface PopMenuItem {
  label: string;
  icon?: IconType;
  onClick: () => void;
  danger?: boolean;
  /** Element ustida ajratuvchi chiziq. */
  divider?: boolean;
}

/**
 * Kichik "..." amallar menyusi — xabar va suhbat qatorlarida ishlatiladi.
 * O'z `open` holatini boshqaradi (hover'dan mustaqil, shu tufayli ochiq turgan
 * menyu sichqoncha ketganda ham yo'qolmaydi), tashqariga bosish / Esc bilan
 * yopiladi.
 */
function PopMenu({
  items,
  ariaLabel,
  triggerClassName,
  align = 'end',
  width = 190,
}: {
  items: PopMenuItem[];
  ariaLabel: string;
  triggerClassName?: string;
  align?: 'start' | 'end';
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink',
          open && 'bg-surface-2 text-ink',
          triggerClassName,
        )}
      >
        <More size={17} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ width }}
            className={cn(
              'absolute z-50 mt-1.5 overflow-hidden rounded-2xl border border-line bg-surface p-1.5 shadow-pop',
              align === 'end' ? 'right-0' : 'left-0',
            )}
          >
            {items.map((it, i) => (
              <div key={i}>
                {it.divider && <div className="my-1 h-px bg-line" />}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    it.onClick();
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium transition-colors',
                    it.danger
                      ? 'text-red-600 hover:bg-danger-soft'
                      : 'text-ink-soft hover:bg-surface-2 hover:text-ink',
                  )}
                >
                  {it.icon && <it.icon size={16} variant="Bulk" className="shrink-0" />}
                  <span className="flex-1">{it.label}</span>
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   Chat sahifasi — umumiy va shaxsiy suhbatlar
   ============================================================ */
export function ChatPage() {
  const activeId = useChatUi((s) => s.activeConversationId);
  const setActiveId = useChatUi((s) => s.setActiveConversationId);

  // Asosiy ro'yxat (arxivlanmagan) yoki "Arxiv" ko'rinishi (arxivlangan) —
  // header'dagi "Arxiv" tugmasi bilan almashtiriladi. Ikkalasi alohida keshda.
  const [archivedView, setArchivedView] = useState(false);
  const conversationsQuery = useConversations(archivedView);
  const conversations = useMemo(() => conversationsQuery.data ?? [], [conversationsQuery.data]);

  const messagesQuery = useMessages(activeId);
  const activeMessages = useMemo(() => messagesQuery.data ?? [], [messagesQuery.data]);

  const sendMessage = useSendMessage();
  const { mutate: markRead } = useMarkRead();

  // Chat boshqaruvi (xabar/suhbat amallari) — barchasi backend'ga bog'langan.
  const deleteMessage = useDeleteMessage();
  const editMessage = useEditMessage();
  const archiveConversation = useArchiveConversation();
  const clearConversation = useClearConversation();
  const deleteConversation = useDeleteConversation();

  // Xabar tahrirlash holati (inline, bubble ustida) va xatolik (masalan 409).
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Tasdiq talab qiluvchi (buzuvchi) amal — bitta ConfirmDialog boshqaradi.
  const [pending, setPending] = useState<
    | { kind: 'msg-delete'; conversationId: string; messageId: string }
    | { kind: 'conv-clear'; conversationId: string; title: string }
    | { kind: 'conv-delete'; conversationId: string; title: string }
    | null
  >(null);

  // Jonli (realtime) suhbat: yangi xabarlar, o'qildi, "yozmoqda…" va onlayn
  // holati socket orqali darhol keladi (86436 gateway kontrakti). Suhbat
  // darajasidagi hodisa (`chat:conversation`) — faol suhbat o'chirilsa uni
  // tozalaymiz (boshqa amallarni kesh invalidatsiyasi hookda hal qiladi).
  const { typing, emitTyping } = useRealtimeChat(activeId, (event) => {
    if (event.action === 'deleted' && event.conversationId === activeId) {
      setActiveId(GROUP_ID);
    }
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const [pickerOpen, setPickerOpen] = useState(false);
  const openDirect = useOpenDirectConversation();
  const employeesQuery = useLiveEmployees();
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'direct'>('all');
  const [mobileThread, setMobileThread] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Real WebRTC 1:1 qo'ng'iroq (global CallProvider) — audio/video tugmalari
  // shu yerda ishga tushiriladi; kiruvchi/faol qo'ng'iroq UI'si esa butun ilova
  // bo'ylab <CallOverlay/> orqali ko'rsatiladi.
  const { startCall, phase: callPhase } = useCall();

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

  // Qo'ng'iroq faqat 1:1 (direct) suhbatlarda va xodim id'si (staffId) mavjud
  // bo'lganda mumkin; guruh chatida o'chirilgan bo'ladi (kontrakt: 1:1 only).
  const canCall = activeConv?.kind === 'direct' && !!activeConv.staffId;

  function startChatCall(media: 'audio' | 'video') {
    if (!activeConv || activeConv.kind !== 'direct' || !activeConv.staffId) return;
    if (callPhase !== 'idle') return;
    startCall(activeConv.staffId, activeConv.title, media);
  }

  function openConv(id: string) {
    // Boshqa suhbatga o'tayotganda yarim qolgan tahrirni bekor qilamiz.
    setEditing(null);
    setEditError(null);
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
  function handleSendVideo(url: string, durationSec: number) {
    sendMessage.mutate({ conversationId: activeId, senderId: ME_ID, kind: 'video', url, durationSec });
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

  /* ---------- Xabar amallari (tahrirlash / o'chirish) ---------- */
  function beginEdit(msg: ChatMessage) {
    setEditing({ id: msg.id, text: msg.text ?? '' });
    setEditError(null);
  }
  function cancelEdit() {
    setEditing(null);
    setEditError(null);
  }
  function saveEdit() {
    if (!editing) return;
    const text = editing.text.trim();
    if (!text) return;
    editMessage.mutate(
      { conversationId: activeId, messageId: editing.id, text },
      {
        onSuccess: () => {
          setEditing(null);
          setEditError(null);
        },
        onError: (err) => {
          // O'qilgan xabar (409) — tahrirlab bo'lmaydi.
          setEditError(
            err instanceof ApiError && err.status === 409
              ? "O'qilgan xabarni tahrirlab bo'lmaydi"
              : "Xabarni tahrirlab bo'lmadi",
          );
        },
      },
    );
  }

  /* ---------- Suhbat amallari (arxiv / tozalash / o'chirish) ---------- */
  function toggleArchive(conv: ChatConversation) {
    const nextArchived = !(conv.archived ?? archivedView);
    archiveConversation.mutate(
      { id: conv.id, archived: nextArchived },
      {
        onSuccess: () => {
          // Arxivlangan/arxivdan chiqarilgan suhbat joriy ro'yxatdan chiqadi —
          // agar u faol bo'lsa, umumiy chatga qaytamiz.
          if (activeId === conv.id) setActiveId(GROUP_ID);
        },
      },
    );
  }

  // Bitta ConfirmDialog — pending amalga qarab bajaradi.
  function runPending() {
    if (!pending) return;
    if (pending.kind === 'msg-delete') {
      deleteMessage.mutate(
        { conversationId: pending.conversationId, messageId: pending.messageId },
        { onSettled: () => setPending(null) },
      );
    } else if (pending.kind === 'conv-clear') {
      clearConversation.mutate(pending.conversationId, { onSettled: () => setPending(null) });
    } else {
      const id = pending.conversationId;
      deleteConversation.mutate(id, {
        onSuccess: () => {
          if (activeId === id) setActiveId(GROUP_ID);
        },
        onSettled: () => setPending(null),
      });
    }
  }

  // Suhbat qatori / thread header uchun "..." menyu elementlari. `group-all`
  // uchun bu menyu umuman ko'rsatilmaydi (buzuvchi amallar taqiqlangan).
  function conversationMenuItems(conv: ChatConversation): PopMenuItem[] {
    const isArchived = conv.archived ?? archivedView;
    return [
      {
        label: isArchived ? 'Arxivdan chiqarish' : 'Arxivlash',
        icon: isArchived ? ArchiveMinus : Archive,
        onClick: () => toggleArchive(conv),
      },
      {
        label: 'Tozalash',
        icon: Broom,
        onClick: () => setPending({ kind: 'conv-clear', conversationId: conv.id, title: conv.title }),
      },
      {
        label: "O'chirish",
        icon: Trash,
        danger: true,
        divider: true,
        onClick: () => setPending({ kind: 'conv-delete', conversationId: conv.id, title: conv.title }),
      },
    ];
  }

  const pendingLoading =
    pending?.kind === 'msg-delete'
      ? deleteMessage.isPending
      : pending?.kind === 'conv-clear'
        ? clearConversation.isPending
        : pending?.kind === 'conv-delete'
          ? deleteConversation.isPending
          : false;

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
              {archivedView ? (
                <Archive size={22} variant="Bulk" className="text-primary-600" />
              ) : (
                <Messages2 size={22} variant="Bulk" className="text-primary-600" />
              )}
              {archivedView ? 'Arxiv' : 'Suhbatlar'}
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
          <div className="mt-3 flex items-center gap-1.5">
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
            <button
              onClick={() => setArchivedView((v) => !v)}
              title={archivedView ? 'Asosiy suhbatlar' : 'Arxivlangan suhbatlar'}
              className={cn(
                'ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors',
                archivedView ? 'bg-ink text-white' : 'bg-surface-2 text-ink-soft hover:text-ink',
              )}
            >
              <Archive size={15} variant="Bulk" />
              Arxiv
            </button>
          </div>
          {!archivedView && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPickerOpen(true)}
              className="mt-2 w-full justify-center"
            >
              <MessageAdd1 size={16} variant="Bulk" />
              Xodimga yozish
            </Button>
          )}
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
              {archivedView ? (
                <>
                  <Archive size={36} variant="Bulk" className="text-ink-muted" />
                  <p className="text-sm font-medium text-ink">Arxivlangan suhbatlar yo'q</p>
                  <p className="text-xs text-ink-muted">Suhbatni arxivlaganingizda shu yerda ko'rinadi</p>
                </>
              ) : (
                <>
                  <Messages2 size={36} variant="Bulk" className="text-ink-muted" />
                  <p className="text-sm font-medium text-ink">Hozircha suhbatlar yo'q</p>
                  <p className="text-xs text-ink-muted">Xodim bilan yozishmani boshlaganingizda shu yerda ko'rinadi</p>
                </>
              )}
            </div>
          ) : (
            <>
              {convList.map((conv) => {
                const last = conv.lastMessage;
                const unread = conv.unreadCount;
                return (
                  <div
                    key={conv.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openConv(conv.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openConv(conv.id);
                      }
                    }}
                    className={cn(
                      'group relative flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300',
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
                    {/* Suhbat amallari — umumiy chat (group-all) uchun ko'rsatilmaydi */}
                    {conv.id !== GROUP_ID && (
                      <div
                        className="absolute right-1.5 top-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PopMenu
                          ariaLabel="Suhbat amallari"
                          items={conversationMenuItems(conv)}
                          align="end"
                          triggerClassName="bg-surface opacity-0 shadow-sm group-hover:opacity-100 focus-visible:opacity-100"
                        />
                      </div>
                    )}
                  </div>
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
                onClick={() => startChatCall('audio')}
                disabled={!canCall || callPhase !== 'idle'}
                title={canCall ? "Audio qo'ng'iroq" : "Faqat xodim bilan 1:1 qo'ng'iroq"}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
              >
                <Call size={21} variant="Bulk" />
              </button>
              <button
                onClick={() => startChatCall('video')}
                disabled={!canCall || callPhase !== 'idle'}
                title={canCall ? "Video qo'ng'iroq" : "Faqat xodim bilan 1:1 qo'ng'iroq"}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-primary-50 hover:text-primary-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-soft"
              >
                <Video size={21} variant="Bulk" />
              </button>
              {/* Suhbat amallari (arxiv/tozalash/o'chirish) — umumiy chat uchun yo'q */}
              {activeConv.id !== GROUP_ID && (
                <PopMenu
                  ariaLabel="Suhbat amallari"
                  items={conversationMenuItems(activeConv)}
                  align="end"
                  triggerClassName="h-10 w-10 rounded-xl hover:bg-primary-50 hover:text-primary-600"
                />
              )}
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
                        isEditing={editing?.id === item.msg.id}
                        editText={editing?.text ?? ''}
                        editSaving={editMessage.isPending}
                        editError={editError}
                        onEditText={(t) => setEditing((e) => (e ? { ...e, text: t } : e))}
                        onSaveEdit={saveEdit}
                        onCancelEdit={cancelEdit}
                        onBeginEdit={() => beginEdit(item.msg)}
                        onDelete={() =>
                          setPending({
                            kind: 'msg-delete',
                            conversationId: activeId,
                            messageId: item.msg.id,
                          })
                        }
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
              onSendVideo={handleSendVideo}
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

      {/* "Xodimga yozish" — xodim tanlagich (umumiy chat entry-point) */}
      <EmployeePickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickEmployee}
      />

      {/* Buzuvchi amallar uchun yagona tasdiq oynasi (xabar/suhbat o'chirish, tozalash) */}
      <ConfirmDialog
        open={pending !== null}
        onClose={() => {
          if (!pendingLoading) setPending(null);
        }}
        onConfirm={runPending}
        loading={pendingLoading}
        tone={pending?.kind === 'conv-clear' ? 'warning' : 'danger'}
        icon={pending?.kind === 'conv-clear' ? Broom : Trash}
        title={
          pending?.kind === 'msg-delete'
            ? "Xabarni o'chirish"
            : pending?.kind === 'conv-clear'
              ? 'Suhbatni tozalash'
              : "Suhbatni o'chirish"
        }
        confirmLabel={pending?.kind === 'conv-clear' ? 'Tozalash' : "O'chirish"}
        message={
          pending?.kind === 'msg-delete'
            ? 'Bu xabar butunlay o’chiriladi. Bu amalni ortga qaytarib bo’lmaydi.'
            : pending?.kind === 'conv-clear'
              ? `"${pending.title}" suhbatidagi barcha xabarlar o’chiriladi va suhbat arxivlanadi.`
              : pending?.kind === 'conv-delete'
                ? `"${pending.title}" suhbati va undagi barcha xabarlar butunlay o’chiriladi.`
                : ''
        }
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
  isEditing,
  editText,
  editSaving,
  editError,
  onEditText,
  onSaveEdit,
  onCancelEdit,
  onBeginEdit,
  onDelete,
}: {
  msg: ChatMessage;
  first: boolean;
  isGroup: boolean;
  reduce: boolean;
  onImageClick: (url: string) => void;
  /** Shu xabar hozir tahrirlanmoqda (inline editor ko'rsatiladi). */
  isEditing: boolean;
  editText: string;
  editSaving: boolean;
  editError: string | null;
  onEditText: (text: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onBeginEdit: () => void;
  onDelete: () => void;
}) {
  const mine = msg.senderId === ME_ID;
  const info = senderInfo(msg.senderId);
  const sending = msg.status === 'sending';
  // Tahrirlash faqat: o'zimizniki + matn + hali o'qilmagan (backend 409 bermasin).
  const canEdit = mine && msg.kind === 'text' && msg.status !== 'read';

  // "..." amallar menyusi — optimistik (sending) va tahrirlanayotgan xabarda yashiriladi.
  const menuEl =
    !sending && !isEditing ? (
      <div className="shrink-0 self-center">
        <PopMenu
          ariaLabel="Xabar amallari"
          align={mine ? 'end' : 'start'}
          width={172}
          triggerClassName="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          items={[
            ...(canEdit ? [{ label: 'Tahrirlash', icon: Edit2, onClick: onBeginEdit }] : []),
            { label: "O'chirish", icon: Trash, danger: true, onClick: onDelete },
          ]}
        />
      </div>
    ) : null;

  // Tahrirlash rejimi — bubble o'rniga inline muharrir (composer'ga tegmaymiz).
  if (isEditing) {
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
        className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start', first ? 'mt-3' : 'mt-0.5')}
      >
        {!mine && <div className="w-8 shrink-0" />}
        <div className="flex w-72 max-w-[80%] flex-col gap-2 rounded-2xl border border-primary-300 bg-surface p-2.5 shadow-card">
          <textarea
            autoFocus
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSaveEdit();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                onCancelEdit();
              }
            }}
            rows={2}
            className="max-h-40 min-h-9 w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2 text-[14px] text-ink outline-none focus:border-primary-300"
          />
          {editError && <span className="px-1 text-[11px] font-medium text-danger">{editError}</span>}
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-[12px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              tahrirlashni bekor qilish
            </button>
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={editSaving || !editText.trim()}
              className="inline-flex h-8 items-center rounded-lg bg-primary-600 px-3 text-[12.5px] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-50"
            >
              {editSaving ? 'Saqlanmoqda…' : 'Saqlash'}
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}
      className={cn(
        'group flex items-end gap-2',
        mine ? 'justify-end' : 'justify-start',
        first ? 'mt-3' : 'mt-0.5',
      )}
    >
      {!mine && (
        <div className="w-8 shrink-0">
          {first && <Avatar name={info.name} src={info.photo} color={info.color} size={32} />}
        </div>
      )}
      {mine && menuEl}
      <div
        className={cn(
          'max-w-[78%] sm:max-w-[68%]',
          mine ? 'items-end' : 'items-start',
          'flex flex-col',
        )}
      >
        <div
          className={cn(
            'transition-opacity',
            msg.kind === 'video'
              ? 'bg-transparent'
              : cn(
                  'overflow-hidden shadow-card',
                  msg.kind === 'image' ? 'rounded-2xl' : 'px-3.5 py-2.5',
                  mine
                    ? 'rounded-2xl rounded-br-md bg-primary-600 text-white'
                    : 'rounded-2xl rounded-bl-md border border-line bg-surface text-ink',
                ),
            sending && 'opacity-70',
          )}
        >
          {!mine && first && isGroup && msg.kind !== 'image' && msg.kind !== 'video' && (
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

          {msg.kind === 'video' && msg.url && (
            <VideoNoteBubble url={msg.url} duration={msg.durationSec ?? 1} mine={mine} />
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
          {msg.editedAt && <span className="text-ink-muted/80">tahrirlangan</span>}
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
      {!mine && menuEl}
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

/* ---------------- Dumaloq video xabar (video-note) ---------------- */
function VideoNoteBubble({ url, duration, mine }: { url: string; duration: number; mine: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) v.pause();
    else void v.play();
  }

  return (
    <button
      onClick={toggle}
      title={playing ? 'Pauza' : "Ko'rish"}
      className={cn(
        'relative block aspect-square h-[180px] w-[180px] shrink-0 overflow-hidden rounded-full shadow-card ring-2',
        mine ? 'ring-primary-200' : 'ring-line',
      )}
    >
      <video
        ref={videoRef}
        src={url}
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-primary-600">
            <Play size={22} variant="Bold" />
          </span>
        </span>
      )}
      <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium tabular-nums text-white">
        {fmtDur(duration)}
      </span>
    </button>
  );
}
