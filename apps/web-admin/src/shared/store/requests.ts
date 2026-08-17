import { create } from "zustand";
import { api } from "@/shared/api/client";
import type { CitizenRequest, RequestStatus } from "@/shared/data/types";

/**
 * Backendning umumiy sahifalash konverti (`GET /requests` shu shaklda
 * qaytadi: `{ data, total, page, limit }`). `CitizenRequest` maydonlari
 * mock bilan 1:1 mos keladi (backend buni ataylab shunday qilib bergan).
 */
interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

interface RequestsState {
  requests: CitizenRequest[];
  /** Ro'yxat backend'dan birinchi marta yuklanayotganini bildiradi. */
  loading: boolean;
  /** Oxirgi yuklashda yuz bergan xatolik (bo'lmasa — null). */
  error: string | null;
  /** Murojaatlar ro'yxatini GET /requests orqali (qayta) yuklaydi. */
  hydrate: () => Promise<void>;
  /** Yangi murojaat qo'shish (id avtomatik beriladi). */
  add: (r: Omit<CitizenRequest, "id">) => Promise<void>;
  /** Murojaatga xodim biriktirish. Yangi murojaat avtomatik "Jarayonda" ga o'tadi. */
  assignWorker: (requestId: string, workerId: string) => Promise<void>;
  /** Biriktirilgan xodimni olib tashlash. */
  unassignWorker: (requestId: string) => Promise<void>;
  /** Murojaat holatini o'zgartirish. Hal qilinganda resolvedAt belgilanadi. */
  setStatus: (requestId: string, status: RequestStatus) => Promise<void>;
}

export const useRequests = create<RequestsState>((set, get) => ({
  requests: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      // Admin jadvalidagi qidiruv/filtr/saralash klient tomonda ishlaydi
      // (mock davridagi kabi), shuning uchun ruxsat etilgan maksimal
      // `limit=100` bilan bitta so'rovda to'liq ro'yxatni olamiz.
      const res = await api.get<Paginated<CitizenRequest>>("/requests?limit=100");
      set({ requests: res.data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Murojaatlarni yuklab bo'lmadi",
      });
    }
  },

  add: async (r) => {
    // Optimistik: vaqtinchalik id bilan darhol ekranda ko'rsatamiz, so'ng
    // backend haqiqiy yozuvni qaytarsa — shu bilan almashtiramiz. Backend
    // hali bu endpointni qo'llab-quvvatlamasa ham (yoki tarmoq xatosi
    // bo'lsa), mahalliy yozuv ekranda qolib, ish jarayoni uzilmaydi.
    const tempId = `R-${Date.now()}`;
    set((s) => ({ requests: [{ ...r, id: tempId }, ...s.requests] }));
    try {
      const created = await api.post<CitizenRequest>("/requests", r);
      set((s) => ({
        requests: s.requests.map((x) => (x.id === tempId ? created : x)),
      }));
    } catch (err) {
      console.error("Murojaat qo'shishda xatolik:", err);
    }
  },

  assignWorker: async (requestId, workerId) => {
    const prev = get().requests;
    const current = prev.find((r) => r.id === requestId);
    if (!current) return;
    const nextStatus: RequestStatus = current.status === "new" ? "in_progress" : current.status;

    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === requestId ? { ...r, assignedWorkerId: workerId, status: nextStatus } : r,
      ),
    }));
    try {
      await api.patch<CitizenRequest>(`/requests/${requestId}`, {
        assignedWorkerId: workerId,
        status: nextStatus,
      });
    } catch (err) {
      console.error("Xodim biriktirishda xatolik:", err);
      set({ requests: prev });
    }
  },

  unassignWorker: async (requestId) => {
    const prev = get().requests;
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === requestId ? { ...r, assignedWorkerId: null } : r,
      ),
    }));
    try {
      await api.patch<CitizenRequest>(`/requests/${requestId}`, { assignedWorkerId: null });
    } catch (err) {
      console.error("Xodimni olib tashlashda xatolik:", err);
      set({ requests: prev });
    }
  },

  setStatus: async (requestId, status) => {
    const prev = get().requests;
    set((s) => ({
      requests: s.requests.map((r) => {
        if (r.id !== requestId) return r;
        const done = status === "resolved";
        return {
          ...r,
          status,
          resolvedAt: done ? (r.resolvedAt ?? new Date().toISOString()) : null,
        };
      }),
    }));
    try {
      await api.patch<CitizenRequest>(`/requests/${requestId}`, { status });
    } catch (err) {
      console.error("Holatni o'zgartirishda xatolik:", err);
      set({ requests: prev });
    }
  },
}));

// Do'kon yaratilishi bilan bir marta backend'dan yuklaymiz — sahifa hech
// qanday o'zgarishsiz ishlayveradi (boshida bo'sh ro'yxat -> mavjud
// "Hech narsa topilmadi" holati ko'rinadi, keyin ma'lumot kelib to'ladi).
useRequests.getState().hydrate();
