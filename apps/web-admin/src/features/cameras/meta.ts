import {
  Activity,
  People,
  Car,
  Scan,
  Danger,
  type Icon as IconType,
} from "iconsax-react";
import type { CameraStatus, CameraType } from "@/shared/data/types";
import type { CamEventKind } from "./useLiveCameras";

export const TYPE_LABEL: Record<CameraType, string> = {
  fixed: "Statsionar",
  ptz: "Aylanuvchi PTZ",
  anpr: "Raqam (ANPR)",
  thermal: "Termal",
};

export const STATUS_LABEL: Record<
  CameraStatus,
  { label: string; color: string; tone: string }
> = {
  online: {
    label: "Onlayn",
    color: "#10b981",
    tone: "bg-success-soft text-primary-700",
  },
  offline: {
    label: "Oflayn",
    color: "#ef4444",
    tone: "bg-danger-soft text-red-700",
  },
  maintenance: {
    label: "Texnik xizmat",
    color: "#f59e0b",
    tone: "bg-warning-soft text-amber-700",
  },
};

export const EVENT_META: Record<
  CamEventKind,
  { icon: IconType; color: string }
> = {
  motion: { icon: Activity, color: "#3b82f6" },
  person: { icon: People, color: "#10b981" },
  vehicle: { icon: Car, color: "#f59e0b" },
  anpr: { icon: Scan, color: "#a855f7" },
  alert: { icon: Danger, color: "#ef4444" },
};
