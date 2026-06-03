import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import { getApprovalHistory } from '../services/adminService';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineLogout,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineArrowLeft,
} from 'react-icons/hi';
import { TbFileInvoice, TbShieldCheck } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

function ApprovalHistory() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApprovalHistory();
      setHistory(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approval history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="dashboard-container">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/admin/dashboard')}>
          <TbFileInvoice />
          <span>Reimbursement Portal</span>
        </div>
        <div className="header-user-actions">
          <button
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={() => navigate('/admin/dashboard')}
            id="btn-go-queue"
          >
            <HiOutlineArrowLeft />
            Back to Queue
          </button>
          {role === 'SUPER_ADMIN' && (
            <button
              className="btn-secondary"
              style={{ padding: '8px 16px', fontSize: '13px' }}
              onClick={() => navigate('/admin/manage')}
              id="btn-go-manage"
            >
              Manage Users
            </button>
          )}
          <div className="user-profile-badge">
            <div className="avatar-circle admin-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.3 }}>
              <span style={{ fontSize: '13.5px', fontWeight: 700 }}>{user?.name || 'Admin'}</span>
              <span style={{ fontSize: '11px', color: 'var(--wc-300)', fontWeight: 500 }}>
                {role === 'SUPER_ADMIN' ? 'Super Admin' : 'Administrator'}
              </span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout} id="admin-logout-btn">
            <HiOutlineLogout />
            Logout
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="dashboard-main animate-fade-in">
        {/* Title Bar */}
        <div className="section-header">
          <div className="section-title">
            Approval History
            <span className="section-subtitle">
              Review reimbursement requests you have previously acted upon
            </span>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={fetchHistory}
            id="btn-refresh-history"
          >
            <HiOutlineRefresh />
            Refresh
          </button>
        </div>

        {/* Metrics */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-box approved">
              <HiOutlineCheckCircle />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                {history.filter((h) => h.status === 'APPROVED').length}
              </span>
              <span className="metric-label">Approved By You</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-box rejected">
              <HiOutlineX style={{ fontSize: '20px' }} />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                {history.filter((h) => h.status === 'REJECTED').length}
              </span>
              <span className="metric-label">Rejected By You</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-box pending">
              <HiOutlineClock />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                {history.filter((h) => h.status === 'QUERY_RAISED').length}
              </span>
              <span className="metric-label">Queries Raised By You</span>
            </div>
          </div>
        </section>

        {/* Claims Table */}
        <section className="claims-card">
          {loading ? (
            <div style={{ padding: '60px', display: 'flex', justifyContent: 'center' }}>
              <div
                className="btn-spinner"
                style={{
                  width: '40px',
                  height: '40px',
                  border: '3px solid rgba(79, 124, 130, 0.2)',
                  borderTopColor: 'var(--wc-300)',
                }}
              />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state">
              <HiOutlineClock className="empty-state-icon" />
              <h3 className="empty-state-title">No history found</h3>
              <p className="empty-state-text">
                You haven't actioned any claims yet.
              </p>
            </div>
          ) : (
            <div className="claims-table-wrapper">
              <table className="claims-table">
                <thead>
                  <tr>
                    <th>Action Date</th>
                    <th>Submitted By</th>
                    <th>Committee</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Your Action</th>
                    <th>Your Remark</th>
                    <th style={{ textAlign: 'right' }}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record) => {
                    const claim = record.reimbursement;
                    return (
                      <tr key={record.id}>
                        <td>
                          {record.actedAt
                            ? new Date(record.actedAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </td>
                        <td className="cell-bold">{claim?.user?.name || '—'}</td>
                        <td>{claim?.committee || '—'}</td>
                        <td>{claim?.event || '—'}</td>
                        <td className="cell-amount">
                          ₹{claim?.amount ? claim.amount.toLocaleString('en-IN') : '0'}
                        </td>
                        <td>
                          <span className={`status-badge ${record.status.toLowerCase()}`}>
                            <span className="status-dot" />
                            {record.status}
                          </span>
                        </td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={record.remark}>
                          {record.remark || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No remark</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn-action-icon"
                            onClick={() => setSelectedClaim(claim)}
                            title="View Details"
                            id={`btn-view-${record.id}`}
                          >
                            <HiOutlineEye />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
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
                <span className="detail-label">Claim ID</span>
                <span className="detail-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
                  {selectedClaim.id}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Submitted By</span>
                <span className="detail-value">
                  {selectedClaim.user?.name}
                  <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '12px' }}>
                    ({selectedClaim.user?.email})
                  </span>
                </span>
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
                <span className="detail-value" style={{ fontWeight: 700 }}>
                  ₹{selectedClaim.amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Current Status</span>
                <span className="detail-value">
                  <span className={`status-badge ${selectedClaim.status.toLowerCase()}`}>
                    <span className="status-dot" />
                    {selectedClaim.status}
                  </span>
                </span>
              </div>
              {selectedClaim.description && (
                <div className="detail-row">
                  <span className="detail-label">Description</span>
                  <span className="detail-value">{selectedClaim.description}</span>
                </div>
              )}

              {/* Approval trail */}
              {selectedClaim.approvals && selectedClaim.approvals.length > 0 && (
                <div>
                  <span className="detail-label" style={{ display: 'block', marginBottom: '10px' }}>
                    Approval Trail
                  </span>
                  <div className="approval-trail">
                    {selectedClaim.approvals.map((ap) => (
                      <div key={ap.id} className="approval-trail-item">
                        <span
                          className={`status-badge ${ap.status.toLowerCase()}`}
                          style={{ fontSize: '11px' }}
                        >
                          <span className="status-dot" />
                          {ap.status}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>
                          {ap.administrator?.name}
                        </span>
                        {ap.remark && (
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            "{ap.remark}"
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span className="detail-label">Receipt Image</span>
                {selectedClaim.receiptUrl ? (
                  <a href={selectedClaim.receiptUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={selectedClaim.receiptUrl}
                      alt="Receipt"
                      className="receipt-image-preview"
                    />
                  </a>
                ) : (
                  <span className="detail-value" style={{ color: 'var(--text-muted)' }}>
                    No receipt uploaded
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalHistory;
