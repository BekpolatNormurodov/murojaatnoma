import { create } from 'zustand';

/**
 * Yig'ilishlar bo'limi uchun yengil, joyida (feature-local) toast tizimi
 * — requests bo'limidagi toastStore bilan bir xil naqsh. Ilovada umumiy
 * toast kutubxonasi yo'q, shuning uchun qo'shish/tahrirlash/o'chirish
 * amallaridan keyin muvaffaqiyat haqida qisqa, ekran-o'quvchi tomonidan
 * ham eshitiladigan (aria-live) xabar berish uchun ishlatiladi.
 */
export type MeetingToastTone = 'success' | 'error';

export interface MeetingToastItem {
  id: number;
  tone: MeetingToastTone;
  message: string;
}

interface MeetingToastState {
  toasts: MeetingToastItem[];
}

let seq = 0;
const AUTO_DISMISS_MS = 4500;

export const useMeetingToastStore = create<MeetingToastState>(() => ({
  toasts: [],
}));

/** Yangi toast ko'rsatadi; belgilangan vaqtdan so'ng o'zi yo'qoladi. */
export function pushMeetingToast(tone: MeetingToastTone, message: string): void {
  const id = ++seq;
  useMeetingToastStore.setState((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
  setTimeout(() => dismissMeetingToast(id), AUTO_DISMISS_MS);
}

/** Toastni muddatidan oldin (masalan, "Yopish" tugmasi bilan) olib tashlaydi. */
export function dismissMeetingToast(id: number): void {
  useMeetingToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
