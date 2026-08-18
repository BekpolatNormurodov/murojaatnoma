import { Crown1, ShieldTick, Eye, type Icon as IconType } from 'iconsax-react';
import type { AdminRole } from '@/shared/store/auth';

/** `Badge`ning `tone` proplari bilan bir xil (Badge.tsx'da eksport qilinmagan). */
type BadgeTone = 'info' | 'warning' | 'success' | 'danger' | 'neutral' | 'primary';

/** Rol bo'yicha ko'rinish: yorliq matni, rangi, ikonasi va Badge ohangi. */
export const ADMIN_ROLE_META: Record<
  AdminRole,
  { label: string; color: string; icon: IconType; tone: BadgeTone }
> = {
  SUPER_ADMIN: { label: 'Super admin', color: '#7c3aed', icon: Crown1, tone: 'primary' },
  ADMIN: { label: 'Admin', color: '#2563eb', icon: ShieldTick, tone: 'info' },
  VIEWER: { label: 'Kuzatuvchi', color: '#64748b', icon: Eye, tone: 'neutral' },
};

export const ADMIN_ROLE_OPTIONS = (Object.keys(ADMIN_ROLE_META) as AdminRole[]).map((r) => ({
  value: r,
  label: ADMIN_ROLE_META[r].label,
  dot: ADMIN_ROLE_META[r].color,
}));
