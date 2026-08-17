import { create } from "zustand";
import { api } from "@/shared/api/client";
import type { Meeting } from "@/shared/data/types";

/* ============================================================
   Yig'ilishlar — ro'yxat backend GET /meetings orqali yuklanadi
   (@Public, javob shakli mock.ts'dagi Meeting bilan bir xil) va
   useMeetingsQuery -> setMeetings orqali bu do'konga yoziladi.

   To'liq CRUD backendda mavjud: POST/PATCH/DELETE /meetings — shu
   sababli add/update/remove ham real API'ga ulanadi (mahalliy-only
   EMAS). Barcha yozish amallari complaints do'koni (deleteComplaint)
   bilan bir xil naqshda: optimistik yangilanish — UI darhol
   yangilanadi, so'ng backendga so'rov yuboriladi; xato bo'lsa
   oldingi holatga qaytariladi va xatolik chaqiruvchi tarafga qayta
   uloqtiriladi (throw) — shu orqali MeetingsPage komponenti xatoni
   ko'rsata oladi.
   ============================================================ */

interface MeetingsState {
  meetings: Meeting[];
  /** Backend'dan (GET /meetings) kelgan ro'yxatni mahalliy holatga yozadi. */
  setMeetings: (list: Meeting[]) => void;
  /** Yangi yig'ilish qo'shish — POST /meetings. */
  add: (m: Omit<Meeting, "id">) => Promise<void>;
  /** Mavjud yig'ilishni tahrirlash — PATCH /meetings/:id. */
  update: (id: string, patch: Partial<Omit<Meeting, "id">>) => Promise<void>;
  /** Yig'ilishni o'chirish — DELETE /meetings/:id. */
  remove: (id: string) => Promise<void>;
}

export const useMeetings = create<MeetingsState>((set, get) => ({
  meetings: [],
  setMeetings: (list) => set({ meetings: list }),

  // Optimistik qo'shish: vaqtinchalik (local-) id bilan darhol ro'yxat
  // boshiga qo'shiladi; backend qaytargan haqiqiy yozuv bilan almashadi.
  // Xato bo'lsa — vaqtinchalik yozuv olib tashlanadi va xatolik qayta
  // uloqtiriladi.
  add: async (m) => {
    const tempId = `local-${Date.now()}`;
    set((s) => ({ meetings: [{ ...m, id: tempId }, ...s.meetings] }));
    try {
      const created = await api.post<Meeting>("/meetings", m);
      set((s) => ({
        meetings: s.meetings.map((x) => (x.id === tempId ? created : x)),
      }));
    } catch (err) {
      console.error("Yig'ilishni yaratib bo'lmadi:", err);
      set((s) => ({ meetings: s.meetings.filter((x) => x.id !== tempId) }));
      throw err instanceof Error ? err : new Error("Yig'ilishni yaratib bo'lmadi");
    }
  },

  // Optimistik tahrirlash: darhol mahalliy birlashtiriladi (merge),
  // backend qaytargan yozuv bilan almashadi; xato bo'lsa orqaga
  // qaytariladi.
  update: async (id, patch) => {
    const prev = get().meetings;
    set((s) => ({
      meetings: s.meetings.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    try {
      const updated = await api.patch<Meeting>(`/meetings/${id}`, patch);
      set((s) => ({
        meetings: s.meetings.map((x) => (x.id === id ? updated : x)),
      }));
    } catch (err) {
      console.error("Yig'ilishni yangilab bo'lmadi:", err);
      set({ meetings: prev });
      throw err instanceof Error ? err : new Error("Yig'ilishni yangilab bo'lmadi");
    }
  },

  // Optimistik o'chirish: ro'yxatdan darhol olib tashlanadi; backend
  // rad etsa (yoki tarmoq xatosi) — o'sha o'rniga qaytarib qo'yiladi.
  remove: async (id) => {
    const prev = get().meetings;
    const index = prev.findIndex((x) => x.id === id);
    if (index === -1) return;

    set((s) => ({ meetings: s.meetings.filter((x) => x.id !== id) }));

    try {
      await api.del(`/meetings/${id}`);
    } catch (err) {
      console.error("Yig'ilishni o'chirib bo'lmadi:", err);
      set({ meetings: prev });
      throw err instanceof Error ? err : new Error("Yig'ilishni o'chirib bo'lmadi");
    }
  },
}));
