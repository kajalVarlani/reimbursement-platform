import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { HiOutlineQuestionMarkCircle } from 'react-icons/hi';
import { TbFileInvoice } from 'react-icons/tb';
import './Login.css'; // utilizes existing page layout styles

function NotFound() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useSelector((state) => state.auth);

  const handleGoHome = () => {
    if (isAuthenticated) {
      if (role === 'USER') {
        navigate('/dashboard');
      } else {
        navigate('/admin/dashboard');
      }
    } else {
      navigate('/');
    }
  };

  return (
    <div className="login-page" style={{ justifyContent: 'center', alignItems: 'center' }}>
      {/* Background Orbs */}
      <div className="brand-orb brand-orb-1" style={{ opacity: 0.08 }} />
      <div className="brand-orb brand-orb-2" style={{ opacity: 0.08 }} />

      <div style={{
        textAlign: 'center',
        padding: '40px',
        maxWidth: '520px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-light)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        margin: '20px',
        zIndex: 2
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(224, 156, 58, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--warning)',
          fontSize: '48px'
        }}>
          <HiOutlineQuestionMarkCircle />
        </div>

        <h1 style={{
          fontSize: '36px',
          fontWeight: 800,
          color: 'var(--text-primary)',
          margin: 0,
          lineHeight: 1.2
        }}>
          404
        </h1>

        <h2 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          Page Not Found
        </h2>

        <p style={{
          fontSize: '14.5px',
          color: 'var(--text-muted)',
          margin: 0,
          lineHeight: 1.6
        }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <button
          onClick={handleGoHome}
          className="login-btn user-btn"
          style={{ width: 'auto', padding: '12px 32px', marginTop: '8px' }}
          id="btn-not-found-home"
        >
          Go back to Home
        </button>
      </div>
    </div>
  );
}

export default NotFound;
