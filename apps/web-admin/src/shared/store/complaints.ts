import { create } from "zustand";
import { api } from "@/shared/api/client";
import type {
  Complaint,
  ComplaintResponse,
  ComplaintStatus,
} from "@/shared/data/types";

/* ============================================================
   Shikoyatlar — backend GET /complaints orqali yuklanadi
   (@Public, javob shakli mock.ts'dagi Complaint bilan bir xil).
   Holat o'zgarishi PATCH /complaints/:id ga yuboriladi; backend
   hozircha faqat `status` maydonini saqlaydi, shu sababli
   `resolvedAt` (yopilgan sana) oldingi mock mantig'i bo'yicha
   mahalliy hisoblab qo'yiladi.
   ============================================================ */

interface ComplaintsState {
  complaints: Complaint[];
  /** Ro'yxat birinchi marta (yoki qayta) yuklanayotganini bildiradi. */
  loading: boolean;
  /** Oxirgi yuklash xatoligi matni (bo'lmasa — null). */
  error: string | null;
  /** Shikoyatlar ro'yxatini backenddan qayta yuklaydi. */
  fetchComplaints: () => Promise<void>;
  /** Shikoyatga rasmiy javob yozish. Birinchi javobda holat "reviewing" ga o'tadi. */
  addResponse: (id: string, text: string, author: string) => void;
  /** Shikoyat holatini o'zgartirish (hal qilindi / rad etildi / ...). */
  setStatus: (id: string, status: ComplaintStatus) => void;
}

export const useComplaints = create<ComplaintsState>((set, get) => ({
  complaints: [],
  loading: false,
  error: null,

  fetchComplaints: async () => {
    set({ loading: true, error: null });
    try {
      const complaints = await api.get<Complaint[]>("/complaints");
      set({ complaints, loading: false });
    } catch (e) {
      set({
        loading: false,
        error:
          e instanceof Error ? e.message : "Shikoyatlarni yuklab bo'lmadi",
      });
    }
  },

  // Backendda hozircha rasmiy javoblarni saqlash uchun alohida endpoint yo'q
  // (faqat status PATCH qilinadi), shu sababli javob mahalliy holatda qo'shiladi.
  addResponse: (id, text, author) =>
    set((s) => ({
      complaints: s.complaints.map((c) => {
        if (c.id !== id) return c;
        const response: ComplaintResponse = {
          id: `R-${Date.now()}`,
          text,
          author,
          createdAt: new Date().toISOString(),
        };
        return {
          ...c,
          responses: [...c.responses, response],
          status: c.status === "new" ? "reviewing" : c.status,
        };
      }),
    })),

  setStatus: (id, status) => {
    const prev = get().complaints.find((c) => c.id === id) ?? null;

    // Darhol (optimistik) yangilash — sahifa hech qanday kutish holatisiz,
    // avvalgidek bir zumda javob beradi.
    set((s) => ({
      complaints: s.complaints.map((c) => {
        if (c.id !== id) return c;
        const done = status === "resolved" || status === "rejected";
        return {
          ...c,
          status,
          resolvedAt: done ? (c.resolvedAt ?? new Date().toISOString()) : null,
        };
      }),
    }));

    api.patch<Complaint>(`/complaints/${id}`, { status }).catch((err) => {
      console.error("Shikoyat holatini yangilab bo'lmadi:", err);
      // Backend rad etsa — mahalliy holatni orqaga qaytaramiz.
      if (prev) {
        set((s) => ({
          complaints: s.complaints.map((c) => (c.id === id ? prev : c)),
        }));
      }
    });
  },
}));

// Do'kon yaratilishi bilan ro'yxatni backenddan yuklaymiz — ComplaintsPage
// alohida hydration chaqirig'isiz, tayyor holatni o'qiydi.
void useComplaints.getState().fetchComplaints();
