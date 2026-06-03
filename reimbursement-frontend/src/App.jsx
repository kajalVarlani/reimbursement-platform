import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UserLogin from './pages/UserLogin';
import AdminLogin from './pages/AdminLogin';
import UserForgotPassword from './pages/UserForgotPassword';
import AdminForgotPassword from './pages/AdminForgotPassword';
import UserResetPassword from './pages/UserResetPassword';
import AdminResetPassword from './pages/AdminResetPassword';
import UserDashboard from './pages/UserDashboard';
import SubmitReimbursement from './pages/SubmitReimbursement';
import ApprovalQueue from './pages/ApprovalQueue';
import ApprovalHistory from './pages/ApprovalHistory';
import ManageUsers from './pages/ManageUsers';
import NotFound from './pages/NotFound';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/forgot-password" element={<UserForgotPassword />} />
        <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
        <Route path="/reset-password" element={<UserResetPassword />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />

        {/* ── Protected User Routes ── */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['USER']}>
              <UserDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/submit-reimbursement"
          element={
            <ProtectedRoute allowedRoles={['USER']}>
              <SubmitReimbursement />
            </ProtectedRoute>
          }
        />

        {/* ── Protected Admin Routes ── */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'SUPER_ADMIN']}>
              <ApprovalQueue />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/history"
          element={
            <ProtectedRoute allowedRoles={['ADMINISTRATOR', 'SUPER_ADMIN']}>
              <ApprovalHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/manage"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <ManageUsers />
            </ProtectedRoute>
          }
        />

        {/* ── 404 Fallback Route ── */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
