import { create } from "zustand";

/* ============================================================
   Chat — umumiy (guruh) va shaxsiy (xodimlar bilan) suhbatlar.
   Ma'lumotlar (suhbatlar/xabarlar) endi backend'dan keladi — qarang
   features/chat/useChat.ts (react-query hooklar). Bu fayl faqat umumiy
   turlar/konstantalarni va UI-only holatni (hozir ochiq suhbat) saqlaydi.
   ============================================================ */

export const ME_ID = "me";
export const GROUP_ID = "group-all";

/** "call" — server-written row for a finished admin↔employee call (never sent by a client). */
export type ChatMessageKind = "text" | "image" | "file" | "voice" | "video" | "call";

/** `meta` of a `kind: "call"` row. */
export interface ChatCallMeta {
  callId?: string;
  media: "audio" | "video";
  /** ended | missed | rejected | cancelled | busy — or live/ended for a group call */
  status: string;
  durationSec?: number;
  /** Group call ("everyone") announcement: a join button while live. */
  meeting?: boolean;
  meetingId?: string;
  title?: string;
  hostName?: string;
}
/** "sending" — faqat klient tomonidagi optimistik holat (server javobidan
 *  oldin ko'rsatiladi); server hech qachon uni qaytarmaydi. */
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read";
export type ConversationKind = "group" | "direct";

export interface ChatMessage {
  id: string;
  conversationId: string;
  /** "me" = administrator, aks holda xodim id'si. */
  senderId: string;
  kind: ChatMessageKind;
  /** Matn xabari yoki rasm/fayl izohi. */
  text?: string;
  /** Rasm/fayl nomi. */
  fileName?: string;
  /** Fayl hajmi (bayt). */
  fileSize?: number;
  /** Object URL yoki data URL (rasm/fayl/ovoz). */
  url?: string;
  /** Ovozli xabar davomiyligi (soniya). */
  durationSec?: number;
  createdAt: string; // ISO
  /** Xabar tahrirlangan bo'lsa — oxirgi tahrir vaqti (ISO). Bo'lmasa — tahrirlanmagan. */
  editedAt?: string;
  status: ChatMessageStatus;
  /** Faqat `kind: "call"` uchun — qo'ng'iroq natijasi. */
  meta?: ChatCallMeta | null;
}

export interface Conversation {
  id: string;
  kind: ConversationKind;
  title: string;
  subtitle?: string;
  avatarColor?: string;
  photo?: string;
  /** Faqat "direct" uchun — xodim id'si. */
  staffId?: string;
  online: boolean;
}

/**
 * `GET /chat/conversations` javobidagi bitta element — `Conversation`
 * ustiga, ro'yxat UI'si uchun serverda hisoblab qo'yilgan oxirgi xabar va
 * o'qilmaganlar sonini qo'shadi (avval bu klient tomonda to'liq xabarlar
 * ro'yxatidan hisoblanardi).
 */
export interface ChatConversation extends Conversation {
  lastMessage: ChatMessage | null;
  unreadCount: number;
  /** Suhbat arxivlangan bo'lsa `true` — asosiy ro'yxatda yashiriladi, "Arxiv"
   *  ko'rinishida ko'rsatiladi (`GET /chat/conversations?archived=true`). */
  archived?: boolean;
}

/** `POST /chat/conversations/:id/messages` so'rov tanasi. */
export interface CreateChatMessageInput {
  senderId?: string;
  kind: ChatMessageKind;
  text?: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
  durationSec?: number;
}

/* ---------------- UI-only holat ---------------- */

interface ChatUiState {
  /** Hozir ochiq turgan suhbat id'si (sahifalar orasida eslab qolish uchun global). */
  activeConversationId: string;
  setActiveConversationId: (id: string) => void;
}

export const useChatUi = create<ChatUiState>((set) => ({
  activeConversationId: GROUP_ID,
  setActiveConversationId: (id) => set({ activeConversationId: id }),
}));
