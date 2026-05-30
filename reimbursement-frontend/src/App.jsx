import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import UserLogin from './pages/UserLogin';
import AdminLogin from './pages/AdminLogin';
import UserDashboard from './pages/UserDashboard';
import SubmitReimbursement from './pages/SubmitReimbursement';
import ApprovalQueue from './pages/ApprovalQueue';
import ManageUsers from './pages/ManageUsers';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Public Routes ── */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<UserLogin />} />
        <Route path="/admin/login" element={<AdminLogin />} />

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
          path="/admin/manage"
          element={
            <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
              <ManageUsers />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
