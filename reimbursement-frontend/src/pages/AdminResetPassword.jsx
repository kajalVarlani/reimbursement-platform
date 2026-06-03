import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { adminResetPassword } from '../services/authService';
import { HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { HiExclamationTriangle, HiCheckCircle } from 'react-icons/hi2';
import { HiOutlineShieldCheck } from 'react-icons/hi2';
import './Login.css';

function AdminResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) {
      setError('Invalid reset link: Missing token.');
      return;
    }
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await adminResetPassword(token, password);
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Password reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
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
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="login-form-panel">
        <div className="login-form-container">
          <div className="login-form-header">
            <span className="login-form-badge admin-badge">
              🛡️ Admin Security
            </span>
            <h2 className="login-form-title">Reset Password</h2>
            <p className="login-form-subtitle">
              Enter your new secure admin password below to update your credentials.
            </p>
          </div>

          {error && (
            <div className="form-error" id="admin-reset-password-error">
              <HiExclamationTriangle />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="form-success" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              color: '#10B981',
              marginBottom: '24px',
              fontSize: '14px'
            }} id="admin-reset-password-success">
              <HiCheckCircle style={{ fontSize: '20px', flexShrink: 0 }} />
              <span>Your password has been successfully reset! You can now sign in.</span>
            </div>
          )}

          {!token && (
            <div className="form-error">
              <HiExclamationTriangle />
              <span>Reset token is missing or invalid. Please request a new link.</span>
            </div>
          )}

          {!success && token && (
            <form className="login-form" onSubmit={handleSubmit} id="admin-reset-form">
              <div className="form-group">
                <label className="form-label" htmlFor="admin-new-password">
                  New Password
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="admin-new-password"
                    className="form-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <HiOutlineLockClosed className="form-input-icon" />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="admin-confirm-password">
                  Confirm Password
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="admin-confirm-password"
                    className="form-input"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm your new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                  <HiOutlineLockClosed className="form-input-icon" />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <HiOutlineEyeOff /> : <HiOutlineEye />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="login-btn admin-btn"
                disabled={loading}
                id="admin-reset-submit"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Resetting…
                  </>
                ) : (
                  'Reset Password'
                )}
              </button>
            </form>
          )}

          <div className="login-switch" style={{ marginTop: '24px' }}>
            Back to <Link to="/admin/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AdminResetPassword;
