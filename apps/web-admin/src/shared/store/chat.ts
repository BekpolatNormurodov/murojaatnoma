import { create } from "zustand";
import { STAFF } from "@/shared/data/mock";
import type { StaffMember } from "@/shared/data/types";

/* ============================================================
   Chat — umumiy (guruh) va shaxsiy (xodimlar bilan) suhbatlar.
   Matn, ovoz, fayl va rasm xabarlarini qo'llab-quvvatlaydi.
   In-memory (persist yo'q) — ovoz/fayllar blob URL bo'lgani uchun.
   ============================================================ */

export const ME_ID = "me";
export const GROUP_ID = "group-all";

export type ChatMessageKind = "text" | "image" | "file" | "voice";
export type ChatMessageStatus = "sent" | "delivered" | "read";

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
  kind: "group" | "direct";
  title: string;
  subtitle?: string;
  avatarColor?: string;
  photo?: string;
  /** Faqat "direct" uchun — xodim id'si. */
  staffId?: string;
  online: boolean;
}

/* ---------------- Seed / boshlang'ich ma'lumotlar ---------------- */

const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

function buildConversations(): Conversation[] {
  const group: Conversation = {
    id: GROUP_ID,
    kind: "group",
    title: "Umumiy chat",
    subtitle: `${STAFF.length} a'zo · Hokimiyat apparati`,
    avatarColor: "#10b981",
    online: true,
  };

  const directs: Conversation[] = STAFF.map((s: StaffMember, i: number) => ({
    id: `dm-${s.id}`,
    kind: "direct",
    title: s.name,
    subtitle: s.position,
    avatarColor: s.avatarColor,
    photo: s.photo,
    staffId: s.id,
    online: s.status === "active" && i % 3 !== 1,
  }));

  return [group, ...directs];
}

function buildSeedMessages(): ChatMessage[] {
  const list: ChatMessage[] = [];
  const id = () => `m-${Math.random().toString(36).slice(2, 10)}`;

  // Umumiy guruh suhbati
  const groupSeed: { sender: string; text: string; ago: number }[] = [
    {
      sender: STAFF[1]?.id ?? "s2",
      text: "Assalomu alaykum, hammaga xayrli tong! Bugungi yig'ilish soat 10:00 da.",
      ago: 220,
    },
    {
      sender: STAFF[4]?.id ?? "s5",
      text: "Va alaykum assalom. Murojaatlar bo'yicha hisobot tayyor.",
      ago: 205,
    },
    {
      sender: ME_ID,
      text: "Rahmat. Shoshilinch murojaatlarga e'tibor qarating, muddati o'tmasin.",
      ago: 180,
    },
    {
      sender: STAFF[2]?.id ?? "s3",
      text: "Obodonlashtirish bo'yicha 3 ta yangi murojaat keldi, ko'rib chiqyapmiz.",
      ago: 95,
    },
    {
      sender: STAFF[5]?.id ?? "s6",
      text: "Call-markaz: bugun 42 ta qo'ng'iroq qabul qilindi.",
      ago: 30,
    },
  ];
  groupSeed.forEach((g) =>
    list.push({
      id: id(),
      conversationId: GROUP_ID,
      senderId: g.sender,
      kind: "text",
      text: g.text,
      createdAt: minsAgo(g.ago),
      status: g.sender === ME_ID ? "read" : "read",
    }),
  );

  // Shaxsiy suhbatlar (bir nechtasi)
  const s1 = STAFF[1];
  if (s1) {
    list.push(
      {
        id: id(),
        conversationId: `dm-${s1.id}`,
        senderId: s1.id,
        kind: "text",
        text: "Hurmatli rahbar, kommunal to'lovlar hisobotini yubordim.",
        createdAt: minsAgo(48),
        status: "read",
      },
      {
        id: id(),
        conversationId: `dm-${s1.id}`,
        senderId: ME_ID,
        kind: "text",
        text: "Qabul qildim, ko'rib chiqaman. Rahmat!",
        createdAt: minsAgo(46),
        status: "read",
      },
      {
        id: id(),
        conversationId: `dm-${s1.id}`,
        senderId: s1.id,
        kind: "text",
        text: "Ertaga qo'shimcha ma'lumot kerak bo'lsa, tayyorman.",
        createdAt: minsAgo(8),
        status: "delivered",
      },
    );
  }

  const s4 = STAFF[4];
  if (s4) {
    list.push(
      {
        id: id(),
        conversationId: `dm-${s4.id}`,
        senderId: s4.id,
        kind: "text",
        text: "Yangi murojaat operatori sifatida grafik bo'yicha savol bor edi.",
        createdAt: minsAgo(125),
        status: "read",
      },
      {
        id: id(),
        conversationId: `dm-${s4.id}`,
        senderId: ME_ID,
        kind: "text",
        text: "Albatta, yozing.",
        createdAt: minsAgo(120),
        status: "read",
      },
    );
  }

  return list.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
}

/* ---------------- Store ---------------- */

interface ChatState {
  conversations: Conversation[];
  messages: ChatMessage[];
  send: (m: Omit<ChatMessage, "id" | "createdAt" | "status">) => void;
  /** Suhbatdagi qarama-qarshi tomon xabarlarini "o'qilgan" deb belgilash. */
  markRead: (conversationId: string) => void;
}

export const useChat = create<ChatState>((set) => ({
  conversations: buildConversations(),
  messages: buildSeedMessages(),
  send: (m) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          ...m,
          id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: new Date().toISOString(),
          status: m.senderId === ME_ID ? "sent" : "delivered",
        },
      ],
    })),
  markRead: (conversationId) =>
    set((s) => {
      let changed = false;
      const messages = s.messages.map((msg) => {
        if (
          msg.conversationId === conversationId &&
          msg.senderId !== ME_ID &&
          msg.status !== "read"
        ) {
          changed = true;
          return { ...msg, status: "read" as const };
        }
        return msg;
      });
      return changed ? { messages } : {};
    }),
}));
