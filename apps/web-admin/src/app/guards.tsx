import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/store/auth';

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
