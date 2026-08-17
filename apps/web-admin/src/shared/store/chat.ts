import { create } from "zustand";

/* ============================================================
   Chat — umumiy (guruh) va shaxsiy (xodimlar bilan) suhbatlar.
   Ma'lumotlar (suhbatlar/xabarlar) endi backend'dan keladi — qarang
   features/chat/useChat.ts (react-query hooklar). Bu fayl faqat umumiy
   turlar/konstantalarni va UI-only holatni (hozir ochiq suhbat) saqlaydi.
   ============================================================ */

export const ME_ID = "me";
export const GROUP_ID = "group-all";

export type ChatMessageKind = "text" | "image" | "file" | "voice";
export type ChatMessageStatus = "sent" | "delivered" | "read";
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
  status: ChatMessageStatus;
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
