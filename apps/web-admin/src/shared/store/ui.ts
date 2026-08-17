import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  /** Desktop sidebar yig'ilgan (faqat ikonalar) holatda. */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () =>
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
    }),
    { name: "hokimiyat-ui" },
  ),
);
