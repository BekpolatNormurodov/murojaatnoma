import { create } from 'zustand';

/**
 * Murojaatlar bo'limi uchun yengil, joyida (feature-local) toast tizimi.
 * Ilovada umumiy toast kutubxonasi yo'q, shuning uchun `add`/`remove`/
 * `assignWorker`/`setStatus` kabi amallardan keyin muvaffaqiyat/xatolik
 * haqida qisqa xabar berish uchun shu minimal do'kondan foydalanamiz.
 *
 * Bu — React komponenti emas, oddiy zustand do'koni: istalgan joydan
 * (hatto event handler yoki async funksiya ichidan) `pushRequestToast(...)`
 * chaqirish mumkin, ko'rsatish uchun esa `RequestToastStack` komponenti
 * bir marta (RequestsPage ichida) render qilinadi.
 */
export type RequestToastTone = 'success' | 'error';

export interface RequestToastItem {
  id: number;
  tone: RequestToastTone;
  message: string;
}

interface RequestToastState {
  toasts: RequestToastItem[];
}

let seq = 0;
const AUTO_DISMISS_MS = 4500;

export const useRequestToastStore = create<RequestToastState>(() => ({
  toasts: [],
}));

/** Yangi toast ko'rsatadi; belgilangan vaqtdan so'ng o'zi yo'qoladi. */
export function pushRequestToast(tone: RequestToastTone, message: string): void {
  const id = ++seq;
  useRequestToastStore.setState((s) => ({ toasts: [...s.toasts, { id, tone, message }] }));
  setTimeout(() => dismissRequestToast(id), AUTO_DISMISS_MS);
}

/** Toastni muddatidan oldin (masalan, "Yopish" tugmasi bilan) olib tashlaydi. */
export function dismissRequestToast(id: number): void {
  useRequestToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}
