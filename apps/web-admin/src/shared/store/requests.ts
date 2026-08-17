import { create } from "zustand";
import { REQUESTS } from "@/shared/data/mock";
import type { CitizenRequest, RequestStatus } from "@/shared/data/types";

interface RequestsState {
  requests: CitizenRequest[];
  /** Yangi murojaat qo'shish (id avtomatik beriladi). */
  add: (r: Omit<CitizenRequest, "id">) => void;
  /** Murojaatga xodim biriktirish. Yangi murojaat avtomatik "Jarayonda" ga o'tadi. */
  assignWorker: (requestId: string, workerId: string) => void;
  /** Biriktirilgan xodimni olib tashlash. */
  unassignWorker: (requestId: string) => void;
  /** Murojaat holatini o'zgartirish. Hal qilinganda resolvedAt belgilanadi. */
  setStatus: (requestId: string, status: RequestStatus) => void;
}

export const useRequests = create<RequestsState>((set) => ({
  requests: REQUESTS,
  add: (r) =>
    set((s) => ({
      requests: [{ ...r, id: `R-${Date.now()}` }, ...s.requests],
    })),
  assignWorker: (requestId, workerId) =>
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === requestId
          ? {
              ...r,
              assignedWorkerId: workerId,
              status: r.status === "new" ? "in_progress" : r.status,
            }
          : r,
      ),
    })),
  unassignWorker: (requestId) =>
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === requestId ? { ...r, assignedWorkerId: null } : r,
      ),
    })),
  setStatus: (requestId, status) =>
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
    })),
}));
