import { useEffect, useRef, useState } from "react";
import type { Camera } from "@/shared/data/types";

/* ============================================================
   Real-time kamera simulyatsiyasi (mock)
   — onlayn kameralar vaqt o'tishi bilan hodisa generatsiya qiladi
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

const EVENT_KINDS: { kind: CamEventKind; label: string; weight: number }[] = [
  { kind: "motion", label: "Harakat aniqlandi", weight: 5 },
  { kind: "person", label: "Piyoda aniqlandi", weight: 4 },
  { kind: "vehicle", label: "Transport vositasi", weight: 4 },
  { kind: "anpr", label: "Avto raqam o'qildi", weight: 2 },
  { kind: "alert", label: "Shubhali harakat", weight: 1 },
];
const WEIGHTED: CamEventKind[] = EVENT_KINDS.flatMap((e) =>
  Array(e.weight).fill(e.kind),
);

function pickKind(): { kind: CamEventKind; label: string } {
  const k = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
  return EVENT_KINDS.find((e) => e.kind === k)!;
}

export function useLiveCameras(baseCameras: Camera[], live: boolean) {
  const [cameras, setCameras] = useState<Camera[]>(() =>
    baseCameras.map((c) => ({ ...c })),
  );
  const [events, setEvents] = useState<CamEvent[]>([]);
  const camsRef = useRef(cameras);
  const seq = useRef(0);
  camsRef.current = cameras;

  // Backend'dan ro'yxat (qayta) kelganda mahalliy holatni yangilaymiz —
  // masalan sahifa ochilganda so'rov birinchi renderdan keyin tugaydi.
  const baseIds = baseCameras.map((c) => c.id).join(",");
  useEffect(() => {
    setCameras(baseCameras.map((c) => ({ ...c })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseIds]);

  useEffect(() => {
    if (!live) return;
    const tick = () => {
      const online = camsRef.current.filter((c) => c.status === "online");
      if (!online.length) return;
      // 1-2 ta hodisa har tick'da
      const burst = Math.random() > 0.7 ? 2 : 1;
      const newEvents: CamEvent[] = [];
      const bump: Record<string, number> = {};
      for (let i = 0; i < burst; i++) {
        const cam = online[Math.floor(Math.random() * online.length)];
        const ev = pickKind();
        seq.current += 1;
        newEvents.push({
          id: `e${seq.current}`,
          camId: cam.id,
          camName: cam.name,
          region: cam.region,
          kind: ev.kind,
          label: ev.label,
          at: Date.now(),
        });
        bump[cam.id] = (bump[cam.id] ?? 0) + 1;
      }
      setEvents((prev) => [...newEvents, ...prev].slice(0, 50));
      setCameras((prev) =>
        prev.map((c) =>
          bump[c.id]
            ? {
                ...c,
                detections24h: c.detections24h + bump[c.id],
                lastEvent: "hozirgina",
              }
            : c,
        ),
      );
    };
    const t = setInterval(tick, 1900);
    return () => clearInterval(t);
  }, [live]);

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
