import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { userResetPassword } from '../services/authService';
import { HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff } from 'react-icons/hi';
import { HiExclamationTriangle, HiCheckCircle } from 'react-icons/hi2';
import { TbFileInvoice } from 'react-icons/tb';
import './Login.css';

function UserResetPassword() {
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
      await userResetPassword(token, password);
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
      <div className="login-brand-panel user-panel">
        <div className="brand-orb brand-orb-1" />
        <div className="brand-orb brand-orb-2" />
        <div className="brand-orb brand-orb-3" />

        <div className="brand-content">
          <div className="brand-icon-wrapper">
            <TbFileInvoice />
          </div>
          <h1 className="brand-title">
            Reimbursement<br />Portal
          </h1>
          <p className="brand-subtitle">
            Submit, track, and manage your reimbursement requests with ease. Fast approvals, complete transparency.
          </p>
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div className="login-form-panel">
        <div className="login-form-container">
          <div className="login-form-header">
            <span className="login-form-badge user-badge">
               User Security
            </span>
            <h2 className="login-form-title">Reset Password</h2>
            <p className="login-form-subtitle">
              Enter your new secure password below to update your credentials.
            </p>
          </div>

          {error && (
            <div className="form-error" id="reset-password-error">
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
            }} id="reset-password-success">
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
            <form className="login-form" onSubmit={handleSubmit} id="user-reset-form">
              <div className="form-group">
                <label className="form-label" htmlFor="new-password">
                  New Password
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="new-password"
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
                <label className="form-label" htmlFor="confirm-password">
                  Confirm Password
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="confirm-password"
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
                className="login-btn user-btn"
                disabled={loading}
                id="user-reset-submit"
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
            Back to <Link to="/login">Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UserResetPassword;
