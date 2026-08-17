import { create } from "zustand";
import { COMPLAINTS } from "@/shared/data/mock";
import type {
  Complaint,
  ComplaintResponse,
  ComplaintStatus,
} from "@/shared/data/types";

interface ComplaintsState {
  complaints: Complaint[];
  /** Shikoyatga rasmiy javob yozish. Birinchi javobda holat "reviewing" ga o'tadi. */
  addResponse: (id: string, text: string, author: string) => void;
  /** Shikoyat holatini o'zgartirish (hal qilindi / rad etildi / ...). */
  setStatus: (id: string, status: ComplaintStatus) => void;
}

export const useComplaints = create<ComplaintsState>((set) => ({
  complaints: COMPLAINTS,
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
  setStatus: (id, status) =>
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
    })),
}));
