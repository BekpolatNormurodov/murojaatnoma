import { lazy } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { ProtectedRoute, GuestRoute, RoleRoute } from './guards';
import { LoginPage } from '@/features/auth/LoginPage';

// Route-darajasidagi code-splitting: har bir sahifa alohida chunk sifatida
// kerak bo'lganda yuklanadi — boshlang'ich bundle keskin kichrayadi, sahifalar
// tezroq ochiladi (immutable-kesh tufayli birinchi tashrifdan keyin darhol).
// Named export'lar React.lazy uchun { default: ... }'ga o'giriladi. Suspense
// fallback AdminLayout ichida — Outlet atrofida (sidebar/topbar joyida qoladi).
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const RequestsPage = lazy(() => import('@/features/requests/RequestsPage').then((m) => ({ default: m.RequestsPage })));
const ComplaintsPage = lazy(() => import('@/features/complaints/ComplaintsPage').then((m) => ({ default: m.ComplaintsPage })));
const MeetingsPage = lazy(() => import('@/features/meetings/MeetingsPage').then((m) => ({ default: m.MeetingsPage })));
const DeputiesPage = lazy(() => import('@/features/deputies/DeputiesPage').then((m) => ({ default: m.DeputiesPage })));
const ChatPage = lazy(() => import('@/features/chat/ChatPage').then((m) => ({ default: m.ChatPage })));
const WorkersPage = lazy(() => import('@/features/workers/WorkersPage').then((m) => ({ default: m.WorkersPage })));
const MapPage = lazy(() => import('@/features/map/MapPage').then((m) => ({ default: m.MapPage })));
const AppUsersPage = lazy(() => import('@/features/app-users/AppUsersPage').then((m) => ({ default: m.AppUsersPage })));
const AnalyticsPage = lazy(() => import('@/features/analytics/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage').then((m) => ({ default: m.AttendancePage })));
const CamerasPage = lazy(() => import('@/features/cameras/CamerasPage').then((m) => ({ default: m.CamerasPage })));
const FinancePage = lazy(() => import('@/features/finance/FinancePage').then((m) => ({ default: m.FinancePage })));
const DocumentsPage = lazy(() => import('@/features/documents/DocumentsPage').then((m) => ({ default: m.DocumentsPage })));
const StaffPage = lazy(() => import('@/features/staff/StaffPage').then((m) => ({ default: m.StaffPage })));
const BonusesPage = lazy(() => import('@/features/bonuses/BonusesPage').then((m) => ({ default: m.BonusesPage })));
const NewsPage = lazy(() => import('@/features/news/NewsPage').then((m) => ({ default: m.NewsPage })));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const AdminsPage = lazy(() => import('@/features/admins/AdminsPage').then((m) => ({ default: m.AdminsPage })));

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      // Boshqaruv paneli har doim ochiq (SUPER_ADMIN/ADMIN/VIEWER) — rol noaniq/eski
      // bo'lsa ham RoleRoute'ning "/" ga qaytarish natijasida cheksiz redirect
      // hosil bo'lmasligi uchun bu marshrut ataylab RoleRoute bilan o'ralmagan.
      { index: true, element: <DashboardPage /> },
      { path: 'requests', element: <RoleRoute feature="requests"><RequestsPage /></RoleRoute> },
      { path: 'complaints', element: <RoleRoute feature="complaints"><ComplaintsPage /></RoleRoute> },
      { path: 'meetings', element: <RoleRoute feature="meetings"><MeetingsPage /></RoleRoute> },
      { path: 'chat', element: <RoleRoute feature="chat"><ChatPage /></RoleRoute> },
      { path: 'deputies', element: <RoleRoute feature="deputies"><DeputiesPage /></RoleRoute> },
      { path: 'workers', element: <RoleRoute feature="workers"><WorkersPage /></RoleRoute> },
      { path: 'attendance', element: <RoleRoute feature="attendance"><AttendancePage /></RoleRoute> },
      { path: 'staff', element: <RoleRoute feature="staff"><StaffPage /></RoleRoute> },
      { path: 'bonuses', element: <RoleRoute feature="bonuses"><BonusesPage /></RoleRoute> },
      { path: 'map', element: <RoleRoute feature="map"><MapPage /></RoleRoute> },
      { path: 'app-users', element: <RoleRoute feature="appUsers"><AppUsersPage /></RoleRoute> },
      { path: 'cameras', element: <RoleRoute feature="cameras"><CamerasPage /></RoleRoute> },
      { path: 'finance', element: <RoleRoute feature="finance"><FinancePage /></RoleRoute> },
      { path: 'analytics', element: <RoleRoute feature="analytics"><AnalyticsPage /></RoleRoute> },
      { path: 'documents', element: <RoleRoute feature="documents"><DocumentsPage /></RoleRoute> },
      { path: 'news', element: <RoleRoute feature="news"><NewsPage /></RoleRoute> },
      { path: 'settings', element: <RoleRoute feature="settings"><SettingsPage /></RoleRoute> },
      { path: 'admins', element: <RoleRoute feature="adminUsers"><AdminsPage /></RoleRoute> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
