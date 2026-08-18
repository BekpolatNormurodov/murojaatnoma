import { create } from "zustand";
import { api } from "@/shared/api/client";
import type {
  Complaint,
  ComplaintResponse,
  ComplaintStatus,
  RequestCategory,
} from "@/shared/data/types";

/* ============================================================
   Shikoyatlar — backend GET /complaints orqali yuklanadi
   (@Public, javob shakli mock.ts'dagi Complaint bilan bir xil).
   Holat o'zgarishi PATCH /complaints/:id ga yuboriladi; backend
   hozircha faqat `status` maydonini saqlaydi, shu sababli
   `resolvedAt` (yopilgan sana) oldingi mock mantig'i bo'yicha
   mahalliy hisoblab qo'yiladi.

   Barcha yozish amallari (addResponse/setStatus/deleteComplaint)
   optimistik: UI darhol yangilanadi, so'ng backendga so'rov
   yuboriladi; xato bo'lsa oldingi holatga qaytariladi va xatolik
   chaqiruvchi tarafga qayta uloqtiriladi (throw) — shu orqali
   ComplaintsPage komponenti xatoni maydon yonida ko'rsata oladi.
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
  addResponse: (id: string, text: string, author: string) => Promise<void>;
  /** Shikoyat holatini o'zgartirish (hal qilindi / rad etildi / ...). */
  setStatus: (id: string, status: ComplaintStatus) => Promise<void>;
  /** Shikoyat yo'nalishini (category) belgilash / o'zgartirish. */
  setCategory: (id: string, category: RequestCategory) => Promise<void>;
  /** Shikoyatni butunlay o'chirish. */
  deleteComplaint: (id: string) => Promise<void>;
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

  // Rasmiy javob backendga POST /complaints/:id/response orqali saqlanadi.
  // Optimistik: darhol mahalliy ko'rsatamiz, backend qaytargan yozuv bilan
  // almashtiramiz; xato bo'lsa orqaga qaytaramiz.
  addResponse: async (id, text, author) => {
    const prev = get().complaints;
    set((s) => ({
      complaints: s.complaints.map((c) => {
        if (c.id !== id) return c;
        const response: ComplaintResponse = {
          id: `local-${Date.now()}`,
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
    }));
    try {
      const updated = await api.post<Complaint>(`/complaints/${id}/response`, { text, author });
      set((s) => ({
        complaints: s.complaints.map((c) => (c.id === id ? updated : c)),
      }));
    } catch (err) {
      console.error("Shikoyat javobini saqlab bo'lmadi:", err);
      set({ complaints: prev });
      throw err instanceof Error ? err : new Error("Javobni yuborib bo'lmadi");
    }
  },

  setStatus: async (id, status) => {
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

    try {
      await api.patch<Complaint>(`/complaints/${id}`, { status });
    } catch (err) {
      console.error("Shikoyat holatini yangilab bo'lmadi:", err);
      // Backend rad etsa — mahalliy holatni orqaga qaytaramiz.
      if (prev) {
        set((s) => ({
          complaints: s.complaints.map((c) => (c.id === id ? prev : c)),
        }));
      }
      throw err instanceof Error ? err : new Error("Holatni yangilab bo'lmadi");
    }
  },

  // Yo'nalish (category) PATCH /complaints/:id ga { category } bilan yuboriladi.
  // setStatus kabi optimistik: UI darhol yangilanadi, xato bo'lsa orqaga qaytadi.
  setCategory: async (id, category) => {
    const prev = get().complaints.find((c) => c.id === id) ?? null;

    set((s) => ({
      complaints: s.complaints.map((c) =>
        c.id === id ? { ...c, category } : c,
      ),
    }));

    try {
      await api.patch<Complaint>(`/complaints/${id}`, { category });
    } catch (err) {
      console.error("Shikoyat yo'nalishini yangilab bo'lmadi:", err);
      if (prev) {
        set((s) => ({
          complaints: s.complaints.map((c) => (c.id === id ? prev : c)),
        }));
      }
      throw err instanceof Error ? err : new Error("Yo'nalishni yangilab bo'lmadi");
    }
  },

  // Optimistik o'chirish: ro'yxatdan darhol olib tashlanadi; backend
  // rad etsa (yoki tarmoq xatosi) — o'sha o'rniga qaytarib qo'yiladi.
  deleteComplaint: async (id) => {
    const prev = get().complaints;
    const index = prev.findIndex((c) => c.id === id);
    if (index === -1) return;

    set((s) => ({ complaints: s.complaints.filter((c) => c.id !== id) }));

    try {
      await api.del(`/complaints/${id}`);
    } catch (err) {
      console.error("Shikoyatni o'chirib bo'lmadi:", err);
      set({ complaints: prev });
      throw err instanceof Error ? err : new Error("Shikoyatni o'chirib bo'lmadi");
    }
  },
}));

// Eslatma: bu do'kon avval modul yuklanishi bilan (import vaqtida) darhol
// fetchComplaints() chaqirardi. Endi backend admin-data endpointlari
// autentifikatsiya talab qilgani sababli, bu yerda emas — ComplaintsPage
// komponenti mount bo'lganda (foydalanuvchi tizimga kirgandan keyin)
// chaqiriladi.
