import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { userForgotPassword } from '../services/authService';
import { HiOutlineMail } from 'react-icons/hi';
import { HiExclamationTriangle, HiCheckCircle } from 'react-icons/hi2';
import { TbFileInvoice } from 'react-icons/tb';
import './Login.css';

function UserForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await userForgotPassword(email.trim());
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <header className="landing-nav">
        <div className="landing-nav-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>
          <img src="/infernxt-logo.png" alt="inferNXT" className="brand-logo brand-logo-company" />
        </div>
        <div className="landing-nav-logo-right" onClick={() => navigate('/')}>
          <img src="/claimnest-logo-clean.png" alt="ClaimNest" className="brand-logo brand-logo-product" />
        </div>
      </header>

      <div className="login-page">
        {/* ── Left Branding Panel ── */}
        <div className="login-brand-panel user-panel">
          <div className="brand-orb brand-orb-1" />
          <div className="brand-orb brand-orb-2" />
          <div className="brand-orb brand-orb-3" />

          <div className="brand-content">
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
               User Recovery
            </span>
            <h2 className="login-form-title">Forgot Password</h2>
            <p className="login-form-subtitle">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          {error && (
            <div className="form-error" id="forgot-password-error">
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
            }} id="forgot-password-success">
              <HiCheckCircle style={{ fontSize: '20px', flexShrink: 0 }} />
              <span>If that email is in our database, we have sent a reset password link to it.</span>
            </div>
          )}

          {!success && (
            <form className="login-form" onSubmit={handleSubmit} id="user-forgot-form">
              <div className="form-group">
                <label className="form-label" htmlFor="recovery-email">
                  Email Address
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="recovery-email"
                    className="form-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <HiOutlineMail className="form-input-icon" />
                </div>
              </div>

              <button
                type="submit"
                className="login-btn user-btn"
                disabled={loading}
                id="user-forgot-submit"
              >
                {loading ? (
                  <>
                    <span className="btn-spinner" />
                    Sending link…
                  </>
                ) : (
                  'Send Reset Link'
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
  </div>
  );
}

export default UserForgotPassword;
