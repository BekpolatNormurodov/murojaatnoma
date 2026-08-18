import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { ProtectedRoute, GuestRoute, RoleRoute } from './guards';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { RequestsPage } from '@/features/requests/RequestsPage';
import { ComplaintsPage } from '@/features/complaints/ComplaintsPage';
import { MeetingsPage } from '@/features/meetings/MeetingsPage';
import { DeputiesPage } from '@/features/deputies/DeputiesPage';
import { ChatPage } from '@/features/chat/ChatPage';
import { WorkersPage } from '@/features/workers/WorkersPage';
import { MapPage } from '@/features/map/MapPage';
import { AppUsersPage } from '@/features/app-users/AppUsersPage';
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AttendancePage } from '@/features/attendance/AttendancePage';
import { CamerasPage } from '@/features/cameras/CamerasPage';
import { FinancePage } from '@/features/finance/FinancePage';
import { DocumentsPage } from '@/features/documents/DocumentsPage';
import { StaffPage } from '@/features/staff/StaffPage';
import { BonusesPage } from '@/features/bonuses/BonusesPage';
import { NewsPage } from '@/features/news/NewsPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

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
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
