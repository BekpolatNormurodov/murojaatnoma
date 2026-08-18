import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/store/auth';
import { usePermissions, type Feature } from '@/shared/lib/permissions';

/** Faqat tizimga kirgan foydalanuvchilar uchun. Aks holda /login'ga yo'naltiradi. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const isAuthed = useAuth((s) => s.isAuthed);
  const location = useLocation();
  if (!isAuthed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

/** Faqat mehmonlar uchun. Kirgan bo'lsa boshqaruv paneliga yo'naltiradi. */
export function GuestRoute({ children }: { children: ReactNode }) {
  const isAuthed = useAuth((s) => s.isAuthed);
  if (isAuthed) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

/**
 * Rol asosida marshrutni cheklaydi (masalan Moliya/Sozlamalar/Adminlar — faqat SUPER_ADMIN).
 * Ruxsati yo'q rol boshqaruv paneliga ("/") yo'naltiriladi — Sidebar'da ham shu bo'lim
 * yashirin bo'ladi (bir xil `can()` xaritasi, shared/lib/permissions.ts), shu sababli
 * to'g'ridan-to'g'ri URL orqali ochishga urinish ham to'sib qolinadi.
 */
export function RoleRoute({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { can } = usePermissions();
  if (!can(feature)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
