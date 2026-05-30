import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, role, loading } = useSelector((state) => state.auth);

  // If auth is loading, we can show a simple loading spinner or layout skeleton
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)'
      }}>
        <div className="btn-spinner" style={{ width: '40px', height: '40px', borderThickness: '3px' }}></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // If not authenticated, redirect to appropriate login based on requested route
    const isAdminRoute = allowedRoles && allowedRoles.some(r => r !== 'USER');
    return <Navigate to={isAdminRoute ? '/admin/login' : '/login'} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Role not authorized, redirect to their home dashboard
    return <Navigate to={role === 'USER' ? '/dashboard' : '/admin/dashboard'} replace />;
  }

  return children;
}

export default ProtectedRoute;
