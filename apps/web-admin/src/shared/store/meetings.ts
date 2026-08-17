import { create } from "zustand";
import type { Meeting } from "@/shared/data/types";

interface MeetingsState {
  meetings: Meeting[];
  /** Backend'dan (GET /meetings) kelgan ro'yxatni mahalliy holatga yozadi. */
  setMeetings: (list: Meeting[]) => void;
  /** Yangi yig'ilish qo'shish (id avtomatik beriladi). */
  add: (m: Omit<Meeting, "id">) => void;
  /** Mavjud yig'ilishni tahrirlash. */
  update: (id: string, patch: Partial<Omit<Meeting, "id">>) => void;
  /** Yig'ilishni o'chirish. */
  remove: (id: string) => void;
}

// Boshlang'ich holat bo'sh — ro'yxat backend'dan MeetingsPage orqali
// (useMeetingsQuery -> setMeetings) yuklanadi. Qo'shish/tahrirlash/o'chirish
// uchun hozircha alohida backend endpoint yo'q (faqat GET /meetings mavjud),
// shu sababli bu amallar mahalliy holatda bajariladi.
export const useMeetings = create<MeetingsState>((set) => ({
  meetings: [],
  setMeetings: (list) => set({ meetings: list }),
  add: (m) =>
    set((s) => ({
      meetings: [{ ...m, id: `YIG-${Date.now()}` }, ...s.meetings],
    })),
  update: (id, patch) =>
    set((s) => ({
      meetings: s.meetings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    })),
  remove: (id) =>
    set((s) => ({ meetings: s.meetings.filter((x) => x.id !== id) })),
}));
