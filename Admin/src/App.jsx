// The route tree keeps login and password reset public and guards every admin workspace page.
import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import AdminLayout from './layout/AdminLayout.jsx';
import { LoadingState } from './components/ui.jsx';

const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const MembersPage = lazy(() => import('./pages/MembersPage.jsx'));
const MemberDetailPage = lazy(() => import('./pages/MemberDetailPage.jsx'));
const PlansPage = lazy(() => import('./pages/PlansPage.jsx'));
const PointsPage = lazy(() => import('./pages/PointsPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage.jsx'));
const OperationsPage = lazy(() => import('./pages/OperationsPage.jsx'));
const MembershipMemberDetailPage = lazy(() => import('./membership/MembershipMemberDetailPage.jsx'));
const MembershipBillsPage = lazy(() => import('./membership/MembershipBillsPage.jsx'));
const MembershipPendingQueuePage = lazy(() => import('./membership/MembershipPendingQueuePage.jsx'));
const MembershipReportsPage = lazy(() => import('./membership/MembershipReportsPage.jsx'));
const NewMembershipPlansPage = lazy(() => import('./membership/PlansPage.jsx'));
const MembershipComingNextPage = lazy(() => import('./membership/ComingNextPage.jsx'));

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="grid min-h-screen place-items-center p-5"><LoadingState /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  return <Suspense fallback={<div className="grid min-h-screen place-items-center p-5"><LoadingState /></div>}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<ProtectedRoute />}>
      <Route element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="members" element={<MembersPage />} />
        <Route path="members/:userId" element={<MemberDetailPage />} />
        <Route path="plans" element={<Navigate to="/membership/plans" replace />} />
        <Route path="points" element={<PointsPage />} />
        <Route path="payments" element={<PaymentsPage />} />
        <Route path="membership/plans" element={<NewMembershipPlansPage />} />
        <Route path="membership/members" element={<MembershipComingNextPage title="Members" />} />
        <Route path="membership/members/:id" element={<MembershipMemberDetailPage />} />
        <Route path="membership/bills" element={<MembershipBillsPage />} />
        <Route path="membership/queue" element={<MembershipPendingQueuePage />} />
        <Route path="membership/settings" element={<MembershipComingNextPage title="Settings" />} />
        <Route path="membership/reports" element={<MembershipReportsPage />} />
        <Route path="membership/audit" element={<MembershipComingNextPage title="Audit Log" />} />
        <Route path="posts" element={<OperationsPage type="posts" />} />
        <Route path="events" element={<OperationsPage type="events" />} />
        <Route path="enquiries" element={<OperationsPage type="enquiries" />} />
        <Route path="admins" element={<OperationsPage type="admins" />} />
        <Route path="reports" element={<OperationsPage type="reports" />} />
        <Route path="audit-log" element={<OperationsPage type="audit" />} />
        <Route path="email-log" element={<OperationsPage type="email" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Route>
  </Routes></Suspense>;
}
