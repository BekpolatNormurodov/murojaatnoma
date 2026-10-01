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
  /**
   * Bitta murojaatni (masalan, dashboard/xaritadan `?id=` havola bilan
   * ochilganda) ro'yxatda bo'lmasa GET /requests/:id orqali olib qo'shadi.
   */
  ensure: (id: string) => Promise<CitizenRequest | null>;
  /** Yangi murojaat qo'shish (id avtomatik beriladi). */
  add: (r: Omit<CitizenRequest, "id">) => Promise<void>;
  /** Murojaatga xodim biriktirish. Yangi murojaat avtomatik "Jarayonda" ga o'tadi. */
  assignWorker: (requestId: string, workerId: string) => Promise<void>;
  /** Biriktirilgan xodimni olib tashlash. */
  unassignWorker: (requestId: string) => Promise<void>;
  /** Murojaat holatini o'zgartirish. Hal qilinganda resolvedAt belgilanadi. */
  /** `note` — fuqaroga javob / rad etish sababi (server talab qiladi). */
  setStatus: (requestId: string, status: RequestStatus, note?: string) => Promise<void>;
  /** Murojaatni butunlay o'chirish (DELETE /requests/:id). */
  remove: (requestId: string) => Promise<void>;
}

export const useRequests = create<RequestsState>((set, get) => ({
  requests: [],
  loading: false,
  error: null,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      // Admin jadvalidagi qidiruv/filtr/saralash klient tomonda ishlaydi,
      // shuning uchun BUTUN ro'yxat kerak. Backend sahifasi maksimal 100 ta —
      // ilgari faqat birinchi 100 tasi olinardi va qolganlari jimgina
      // ko'rinmay qolardi. Endi qolgan sahifalarni parallel olamiz.
      const PAGE = 100;
      const MAX_PAGES = 30;
      const first = await api.get<Paginated<CitizenRequest>>(`/requests?limit=${PAGE}&page=1`);
      const pages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE));
      const rest = await Promise.all(
        Array.from({ length: Math.max(0, pages - 1) }, (_, i) =>
          api.get<Paginated<CitizenRequest>>(`/requests?limit=${PAGE}&page=${i + 2}`),
        ),
      );
      const seen = new Set<string>();
      const all = [first, ...rest]
        .flatMap((p) => p.data)
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
      set({ requests: all, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Murojaatlarni yuklab bo'lmadi",
      });
    }
  },

  ensure: async (id) => {
    const have = get().requests.find((r) => r.id === id);
    if (have) return have;
    try {
      const one = await api.get<CitizenRequest>(`/requests/${encodeURIComponent(id)}`);
      set((s) =>
        s.requests.some((r) => r.id === one.id) ? s : { requests: [one, ...s.requests] },
      );
      return one;
    } catch {
      return null;
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
      // Backend qabul qilmasa — optimistik (soxta id'li) yozuvni olib
      // tashlaymiz, aks holda unga keyingi amallar 404 beradi.
      set((s) => ({ requests: s.requests.filter((x) => x.id !== tempId) }));
      // Chaqiruvchiga (masalan, "Murojaat qo'shish" oynasiga) xatolikni
      // bildiramiz — u inline xato ko'rsatib, foydalanuvchiga qayta
      // urinish imkonini beradi.
      throw err;
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
      throw err;
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
      throw err;
    }
  },

  setStatus: async (requestId, status, note) => {
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
      const fresh = await api.patch<CitizenRequest>(`/requests/${requestId}`, {
        status,
        ...(note?.trim() ? { note: note.trim() } : {}),
      });
      // Server truth (dueAt, escalation, assignee may have changed with the move).
      if (fresh?.id) {
        set((s) => ({ requests: s.requests.map((r) => (r.id === fresh.id ? { ...r, ...fresh } : r)) }));
      }
    } catch (err) {
      console.error("Holatni o'zgartirishda xatolik:", err);
      set({ requests: prev });
      throw err;
    }
  },

  remove: async (requestId) => {
    // Optimistik: ro'yxatdan darhol olib tashlaymiz; backend rad etsa
    // (masalan tarmoq xatosi) — orqaga qaytaramiz va xatolikni
    // chaqiruvchiga uzatamiz (u tasdiqlash oynasida ko'rsatadi).
    const prev = get().requests;
    set((s) => ({ requests: s.requests.filter((r) => r.id !== requestId) }));
    try {
      await api.del<void>(`/requests/${requestId}`);
    } catch (err) {
      console.error("Murojaatni o'chirishda xatolik:", err);
      set({ requests: prev });
      throw err;
    }
  },
}));

// Eslatma: bu do'kon avval modul yuklanishi bilan (import vaqtida) darhol
// hydrate() chaqirardi. Endi backend admin-data endpointlari autentifikatsiya
// talab qilgani sababli, bu yerda emas — RequestsPage komponenti mount
// bo'lganda (foydalanuvchi tizimga kirgandan keyin) chaqiriladi.
