import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { ProtectedRoute, GuestRoute } from './guards';
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
      { index: true, element: <DashboardPage /> },
      { path: 'requests', element: <RequestsPage /> },
      { path: 'complaints', element: <ComplaintsPage /> },
      { path: 'meetings', element: <MeetingsPage /> },
      { path: 'chat', element: <ChatPage /> },
      { path: 'deputies', element: <DeputiesPage /> },
      { path: 'workers', element: <WorkersPage /> },
      { path: 'attendance', element: <AttendancePage /> },
      { path: 'staff', element: <StaffPage /> },
      { path: 'bonuses', element: <BonusesPage /> },
      { path: 'map', element: <MapPage /> },
      { path: 'app-users', element: <AppUsersPage /> },
      { path: 'cameras', element: <CamerasPage /> },
      { path: 'finance', element: <FinancePage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'documents', element: <DocumentsPage /> },
      { path: 'news', element: <NewsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
