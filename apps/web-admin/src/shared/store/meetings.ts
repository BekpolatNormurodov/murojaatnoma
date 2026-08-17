import { create } from "zustand";
import { MEETINGS } from "@/shared/data/mock";
import type { Meeting } from "@/shared/data/types";

interface MeetingsState {
  meetings: Meeting[];
  /** Yangi yig'ilish qo'shish (id avtomatik beriladi). */
  add: (m: Omit<Meeting, "id">) => void;
  /** Mavjud yig'ilishni tahrirlash. */
  update: (id: string, patch: Partial<Omit<Meeting, "id">>) => void;
  /** Yig'ilishni o'chirish. */
  remove: (id: string) => void;
}

export const useMeetings = create<MeetingsState>((set) => ({
  meetings: MEETINGS,
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
