import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { loginAdmin, clearError } from '../store/authSlice';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { HiExclamationTriangle } from 'react-icons/hi2';
import { HiOutlineShieldCheck } from 'react-icons/hi2';
import './Login.css';

function AdminLogin() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, isAuthenticated, role } = useSelector((state) => state.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Redirect if already authenticated as admin
  useEffect(() => {
    if (isAuthenticated && role && role !== 'USER') {
      navigate('/admin/dashboard');
    }
  }, [isAuthenticated, role, navigate]);

  // Clear errors on unmount
  useEffect(() => {
    return () => dispatch(clearError());
  }, [dispatch]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    dispatch(loginAdmin({ email: email.trim(), password }));
  };

  return (
    <div className="login-page">
      {/* ── Left Branding Panel ── */}
      <div className="login-brand-panel admin-panel">
        <div className="brand-orb brand-orb-1" />
        <div className="brand-orb brand-orb-2" />
        <div className="brand-orb brand-orb-3" />

        <div className="brand-content">
          <div className="brand-icon-wrapper">
            <HiOutlineShieldCheck />
          </div>
          <h1 className="brand-title">
            Admin<br />Control Center
          </h1>
          <p className="brand-subtitle">
            Manage approvals, users, and reimbursement workflows from a single, powerful dashboard.
          </p>
          <ul className="brand-features">
            <li><span className="feature-dot" /> Approve & reject claims</li>
            <li><span className="feature-dot" /> User management controls</li>
            <li><span className="feature-dot" /> Financial overview reports</li>
            <li><span className="feature-dot" /> Role-based access management</li>
          </ul>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="login-form-panel">
        <div className="login-form-container">
          <div className="login-form-header">
            <span className="login-form-badge admin-badge">
              🛡️ Admin Login
            </span>
            <h2 className="login-form-title">Administrator Access</h2>
            <p className="login-form-subtitle">
              Sign in with your admin credentials
            </p>
          </div>

          {error && (
            <div className="form-error" id="admin-login-error">
              <HiExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} id="admin-login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="admin-email">
                Email Address
              </label>
              <div className="form-input-wrapper">
                <input
                  id="admin-email"
                  className="form-input"
                  type="email"
                  placeholder="admin@organization.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <HiOutlineMail className="form-input-icon" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="admin-password">
                Password
              </label>
              <div className="form-input-wrapper">
                <input
                  id="admin-password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <HiOutlineLockClosed className="form-input-icon" />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  id="admin-password-toggle"
                >
                  {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                </button>
              </div>
            </div>

            <div className="form-footer">
              <div />
              <button
                type="button"
                className="forgot-password-link"
                id="admin-forgot-password"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              className="login-btn admin-btn"
              disabled={loading}
              id="admin-login-submit"
            >
              {loading ? (
                <>
                  <span className="btn-spinner" />
                  Signing in…
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="login-switch">
            Not an admin?
            <Link to="/login">Sign in as User</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminLogin;
