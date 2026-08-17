import { useEffect, useState } from "react";
import { api } from "@/shared/api/client";
import type { Camera } from "@/shared/data/types";

/* ============================================================
   Kameralar — real /cameras ma'lumotidan olingan holat
   — hodisalar oqimi uchun backend'da alohida endpoint yo'q, shuning
   uchun hech qanday sonni "o'ylab topmaymiz": jonli hodisalar ro'yxati
   doim bo'sh (honest empty) qaytadi, kameralar esa backend qaytargan
   qiymatlar (masalan `detections24h`, `lastEvent`) bilan ko'rsatiladi.

   addCamera/removeCamera POST/DELETE /cameras'ga ulangan (mahalliy-only
   EMAS): addCamera backend qaytargan haqiqiy yozuvni ro'yxat boshiga
   qo'shadi; removeCamera optimistik o'chiradi — xato bo'lsa oldingi
   holatga qaytariladi va xatolik chaqiruvchi tarafga qayta uloqtiriladi
   (throw), complaints do'konidagi deleteComplaint bilan bir xil naqsh.
   ============================================================ */
export type CamEventKind = "motion" | "vehicle" | "person" | "anpr" | "alert";

export interface CamEvent {
  id: string;
  camId: string;
  camName: string;
  region: string;
  kind: CamEventKind;
  label: string;
  at: number; // timestamp (ms)
}

export function useLiveCameras(baseCameras: Camera[], _live: boolean) {
  const [cameras, setCameras] = useState<Camera[]>(() =>
    baseCameras.map((c) => ({ ...c })),
  );
  // Haqiqiy hodisalar oqimi backend'da mavjud emas — soxta (random)
  // hodisalar generatsiya qilinmaydi, shuning uchun bu ro'yxat doim
  // bo'sh qoladi (honest empty), hech qachon o'ylab topilgan son emas.
  const [events] = useState<CamEvent[]>([]);

  // Backend'dan ro'yxat (qayta) kelganda mahalliy holatni yangilaymiz —
  // masalan sahifa ochilganda so'rov birinchi renderdan keyin tugaydi.
  const baseIds = baseCameras.map((c) => c.id).join(",");
  useEffect(() => {
    setCameras(baseCameras.map((c) => ({ ...c })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseIds]);

  // POST /cameras — backend qaytargan haqiqiy yozuv ro'yxat boshiga
  // qo'shiladi.
  async function addCamera(payload: Omit<Camera, "id">) {
    const created = await api.post<Camera>("/cameras", payload);
    setCameras((prev) => [created, ...prev]);
    return created;
  }

  // DELETE /cameras/:id — optimistik o'chirish: ro'yxatdan darhol olib
  // tashlanadi; backend rad etsa (yoki tarmoq xatosi) — o'sha o'rniga
  // qaytarib qo'yiladi.
  async function removeCamera(id: string) {
    const prev = cameras;
    setCameras((c) => c.filter((x) => x.id !== id));
    try {
      await api.del(`/cameras/${id}`);
    } catch (err) {
      console.error("Kamerani o'chirib bo'lmadi:", err);
      setCameras(prev);
      throw err instanceof Error ? err : new Error("Kamerani o'chirib bo'lmadi");
    }
  }

  function toggleStatus(id: string) {
    setCameras((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: c.status === "online" ? "offline" : "online",
              recording: c.status !== "online",
            }
          : c,
      ),
    );
  }

  return { cameras, events, addCamera, removeCamera, toggleStatus };
}
