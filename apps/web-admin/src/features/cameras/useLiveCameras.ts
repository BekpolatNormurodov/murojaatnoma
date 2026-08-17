import { useEffect, useState } from "react";
import type { Camera } from "@/shared/data/types";

/* ============================================================
   Kameralar — real /cameras ma'lumotidan olingan holat
   — hodisalar oqimi uchun backend'da alohida endpoint yo'q, shuning
   uchun hech qanday sonni "o'ylab topmaymiz": jonli hodisalar ro'yxati
   doim bo'sh (honest empty) qaytadi, kameralar esa backend qaytargan
   qiymatlar (masalan `detections24h`, `lastEvent`) bilan ko'rsatiladi.
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

  function addCamera(cam: Camera) {
    setCameras((prev) => [cam, ...prev]);
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

  return { cameras, events, addCamera, toggleStatus };
}
