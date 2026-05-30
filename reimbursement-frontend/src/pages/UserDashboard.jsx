import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import { getMyReimbursements } from '../services/reimbursementService';
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePlus,
  HiOutlineLogout,
  HiOutlineEye,
  HiOutlineX
} from 'react-icons/hi';
import { TbFileInvoice, TbReceipt } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

function UserDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // Fetch all claims on load
  useEffect(() => {
    const fetchClaims = async () => {
      try {
        const data = await getMyReimbursements();
        setClaims(data);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to load claims');
      } finally {
        setLoading(false);
      }
    };
    fetchClaims();
  }, []);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    toast.success('Logged out successfully');
  };

  // Metrics calculations
  const totalClaims = claims.length;
  const pendingClaims = claims.filter(c => c.status === 'PENDING').length;
  const approvedClaims = claims.filter(c => c.status === 'APPROVED').length;
  const rejectedClaims = claims.filter(c => c.status === 'REJECTED').length;
  const totalReimbursedAmount = claims
    .filter(c => c.status === 'APPROVED')
    .reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="dashboard-container">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand">
          <TbFileInvoice />
          <span>Reimbursement Portal</span>
        </div>
        <div className="header-user-actions">
          <div className="user-profile-badge">
            <div className="avatar-circle">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span>{user?.name || 'User'}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} id="user-logout-btn">
            <HiOutlineLogout />
            Logout
          </button>
        </div>
      </header>

      {/* ── Main Panel ── */}
      <main className="dashboard-main animate-fade-in">
        {/* Title Bar */}
        <div className="section-header">
          <div className="section-title">
            Dashboard
            <span className="section-subtitle">Track and submit your reimbursement requests</span>
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/submit-reimbursement')}
            id="btn-go-to-submit"
          >
            <HiOutlinePlus />
            Submit New Claim
          </button>
        </div>

        {/* Metrics Grid */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-box total">
              <HiOutlineDocumentText />
            </div>
            <div className="metric-info">
              <span className="metric-value">{totalClaims}</span>
              <span className="metric-label">Total Claims</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box pending">
              <HiOutlineClock />
            </div>
            <div className="metric-info">
              <span className="metric-value">{pendingClaims}</span>
              <span className="metric-label">Pending</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box approved">
              <HiOutlineCheckCircle />
            </div>
            <div className="metric-info">
              <span className="metric-value">{approvedClaims}</span>
              <span className="metric-label">Approved</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box rejected">
              <HiOutlineXCircle />
            </div>
            <div className="metric-info">
              <span className="metric-value">{rejectedClaims}</span>
              <span className="metric-label">Rejected</span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon-box approved">
              <TbReceipt />
            </div>
            <div className="metric-info">
              <span className="metric-value">₹{totalReimbursedAmount.toLocaleString('en-IN')}</span>
              <span className="metric-label">Total Reimbursed</span>
            </div>
          </div>
        </section>

        {/* Claims List Table */}
        <section className="claims-card">
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
              <div className="btn-spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(79, 124, 130, 0.2)', borderTopColor: 'var(--wc-300)' }} />
            </div>
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <TbFileInvoice className="empty-state-icon" />
              <h3 className="empty-state-title">No claims found</h3>
              <p className="empty-state-text">You haven't submitted any reimbursement requests yet.</p>
              <button
                className="btn-primary"
                onClick={() => navigate('/submit-reimbursement')}
              >
                Submit Your First Claim
              </button>
            </div>
          ) : (
            <div className="claims-table-wrapper">
              <table className="claims-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Committee</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td>{new Date(claim.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td className="cell-bold">{claim.committee}</td>
                      <td>{claim.event}</td>
                      <td className="cell-amount">₹{claim.amount.toLocaleString('en-IN')}</td>
                      <td>
                        <span className={`status-badge ${claim.status.toLowerCase()}`}>
                          <span className="status-dot" />
                          {claim.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-action-icon"
                          onClick={() => setSelectedClaim(claim)}
                          title="View Details"
                          id={`view-details-${claim.id}`}
                        >
                          <HiOutlineEye />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {/* ── Details Modal ── */}
      {selectedClaim && (
        <div className="details-modal-overlay" onClick={() => setSelectedClaim(null)}>
          <div className="details-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Claim Details</h3>
              <button className="modal-close-btn" onClick={() => setSelectedClaim(null)}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span className={`status-badge ${selectedClaim.status.toLowerCase()}`}>
                    <span className="status-dot" />
                    {selectedClaim.status}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Claim ID</span>
                <span className="detail-value">{selectedClaim.id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Date Submitted</span>
                <span className="detail-value">
                  {new Date(selectedClaim.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Committee</span>
                <span className="detail-value">{selectedClaim.committee}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Event</span>
                <span className="detail-value">{selectedClaim.event}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Amount</span>
                <span className="detail-value" style={{ fontWeight: '700' }}>
                  ₹{selectedClaim.amount.toLocaleString('en-IN')}
                </span>
              </div>
              {selectedClaim.description && (
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedClaim.description}</span>
                </div>
              )}
              <div className="detail-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="detail-label">Receipt Image</span>
                {selectedClaim.receiptUrl ? (
                  <a href={selectedClaim.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={selectedClaim.receiptUrl}
                      alt="Receipt Scan"
                      className="receipt-image-preview"
                    />
                  </a>
                ) : (
                  <span className="detail-value text-muted">No scan available</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
