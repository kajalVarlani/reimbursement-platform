import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { TbFileInvoice } from 'react-icons/tb';
import {
  HiOutlineDocumentText,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineShieldCheck,
  HiArrowRight,
  HiOutlineUpload,
  HiOutlineBell,
} from 'react-icons/hi';
import './Login.css';

const FEATURES = [
  {
    icon: <HiOutlineUpload />,
    title: 'Quick Submissions',
    desc: 'Upload receipts and submit claims in under two minutes.',
  },
  {
    icon: <HiOutlineClock />,
    title: 'Real-time Tracking',
    desc: 'Watch your claim move through every approval stage live.',
  },
  {
    icon: <HiOutlineCheckCircle />,
    title: 'Multi-level Approvals',
    desc: 'Structured priority-based workflow ensures accountability.',
  },
  {
    icon: <HiOutlineBell />,
    title: 'Instant Notifications',
    desc: 'Get email alerts the moment your claim status changes.',
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useSelector((state) => state.auth);

  // Redirect already-authenticated users to their home
  useEffect(() => {
    if (isAuthenticated) {
      if (role === 'USER') navigate('/dashboard');
      else navigate('/admin/dashboard');
    }
  }, [isAuthenticated, role, navigate]);

  return (
    <div className="landing-page">
      {/* ── Animated background orbs ── */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />
      <div className="landing-orb landing-orb-3" />

      {/* ── Nav bar ── */}
      <header className="landing-nav">
        <div className="landing-nav-brand">
          <img src="/infernxt-logo.png" alt="inferNXT" className="brand-logo brand-logo-company" />
        </div>
        <div className="landing-nav-logo-right">
          <img src="/claimnest-logo-clean.png" alt="ClaimNest" className="brand-logo brand-logo-product" />
        </div>
      </header>


      {/* ── Hero ── */}
      <main className="landing-main">
        <section className="landing-hero animate-fade-in-up">

          <h1 className="landing-hero-title">
            Reimbursement,<br />
            <span className="landing-hero-accent">reimagined.</span>
          </h1>
          <p className="landing-hero-subtitle">
            Submit expense claims, track approvals in real-time, and get reimbursed — all from one
            elegant platform built for your organisation.
          </p>

          {/* ── Role Cards ── */}
          <div className="landing-role-cards">
            {/* User Card */}
            <button
              className="role-card role-card-user"
              onClick={() => navigate('/login')}
              id="btn-user-login"
            >
              <div className="role-card-icon">
                <HiOutlineDocumentText />
              </div>
              <div className="role-card-body">
                <span className="role-card-label">Employee / Treasurer</span>
                <h3 className="role-card-title">User Login</h3>
                <p className="role-card-desc">
                  Submit claims, upload receipts, and track your reimbursement requests.
                </p>
              </div>
              <div className="role-card-arrow">
                <HiArrowRight />
              </div>
            </button>

            {/* Admin Card */}
            <button
              className="role-card role-card-admin"
              onClick={() => navigate('/admin/login')}
              id="btn-admin-login"
            >
              <div className="role-card-icon admin-icon">
                <HiOutlineShieldCheck />
              </div>
              <div className="role-card-body">
                <span className="role-card-label">Administrator</span>
                <h3 className="role-card-title">Admin Login</h3>
                <p className="role-card-desc">
                  Review pending claims, approve or reject requests, and manage your team.
                </p>
              </div>
              <div className="role-card-arrow">
                <HiArrowRight />
              </div>
            </button>
          </div>
        </section>

        {/* ── Features Strip ── */}
        <section className="landing-features animate-fade-in">
          {FEATURES.map((f) => (
            <div className="feature-tile" key={f.title}>
              <div className="feature-tile-icon">{f.icon}</div>
              <div>
                <div className="feature-tile-title">{f.title}</div>
                <div className="feature-tile-desc">{f.desc}</div>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} ReimbursePortal. All rights reserved.</span>
      </footer>
    </div>
  );
}

export default LandingPage;
