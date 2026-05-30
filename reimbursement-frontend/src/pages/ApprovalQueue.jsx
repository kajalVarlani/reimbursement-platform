import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import {
  getApprovalQueue,
  approveReimbursement,
  rejectReimbursement,
} from '../services/adminService';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineLogout,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineThumbUp,
  HiOutlineThumbDown,
  HiOutlineRefresh,
} from 'react-icons/hi';
import { TbFileInvoice, TbShieldCheck } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

function ApprovalQueue() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // Confirm action modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null, // 'approve' | 'reject'
    claimId: null,
    remark: '',
    processing: false,
  });

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getApprovalQueue();
      setClaims(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchQueue();
  }, [fetchQueue]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/admin/login');
    toast.success('Logged out successfully');
  };

  const openConfirm = (action, claimId) => {
    setConfirmModal({ open: true, action, claimId, remark: '', processing: false });
  };

  const closeConfirm = () => {
    if (confirmModal.processing) return;
    setConfirmModal({ open: false, action: null, claimId: null, remark: '', processing: false });
  };

  const handleConfirmAction = async () => {
    const { action, claimId, remark } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, processing: true }));
    const toastId = toast.loading(
      action === 'approve' ? 'Approving claim…' : 'Rejecting claim…'
    );
    try {
      if (action === 'approve') {
        await approveReimbursement(claimId, remark);
        toast.success('Claim approved successfully!', { id: toastId });
      } else {
        await rejectReimbursement(claimId, remark);
        toast.success('Claim rejected.', { id: toastId });
      }
      setConfirmModal({ open: false, action: null, claimId: null, remark: '', processing: false });
      setSelectedClaim(null);
      await fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed. Please try again.', {
        id: toastId,
      });
      setConfirmModal((prev) => ({ ...prev, processing: false }));
    }
  };

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
            Approval Queue
            <span className="section-subtitle">
              Review and action pending reimbursement claims at your priority level
            </span>
          </div>
          <button
            className="btn-secondary"
            style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
            onClick={fetchQueue}
            id="btn-refresh-queue"
          >
            <HiOutlineRefresh />
            Refresh
          </button>
        </div>

        {/* Metrics */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-box pending">
              <HiOutlineClock />
            </div>
            <div className="metric-info">
              <span className="metric-value">{claims.length}</span>
              <span className="metric-label">Pending in Queue</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-box approved">
              <HiOutlineCheckCircle />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                {claims.filter((c) => c.approvals?.some((a) => a.status === 'APPROVED')).length}
              </span>
              <span className="metric-label">Partially Approved</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-box total">
              <TbShieldCheck />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                ₹
                {claims
                  .reduce((sum, c) => sum + (c.amount || 0), 0)
                  .toLocaleString('en-IN')}
              </span>
              <span className="metric-label">Total Amount Pending</span>
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
          ) : claims.length === 0 ? (
            <div className="empty-state">
              <HiOutlineCheckCircle className="empty-state-icon" style={{ color: 'var(--success)' }} />
              <h3 className="empty-state-title">Queue is clear!</h3>
              <p className="empty-state-text">
                No pending claims require your action at this time.
              </p>
            </div>
          ) : (
            <div className="claims-table-wrapper">
              <table className="claims-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Submitted By</th>
                    <th>Committee</th>
                    <th>Event</th>
                    <th>Amount</th>
                    <th>Priority Level</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {claims.map((claim) => (
                    <tr key={claim.id}>
                      <td>
                        {new Date(claim.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="cell-bold">{claim.user?.name || '—'}</td>
                      <td>{claim.committee}</td>
                      <td>{claim.event}</td>
                      <td className="cell-amount">₹{claim.amount.toLocaleString('en-IN')}</td>
                      <td>
                        <span className="priority-badge">Level {claim.currentPriority}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btn-group">
                          <button
                            className="btn-action-icon"
                            onClick={() => setSelectedClaim(claim)}
                            title="View Details"
                            id={`btn-view-${claim.id}`}
                          >
                            <HiOutlineEye />
                          </button>
                          <button
                            className="btn-action-approve"
                            onClick={() => openConfirm('approve', claim.id)}
                            title="Approve"
                            id={`btn-approve-${claim.id}`}
                          >
                            <HiOutlineThumbUp />
                            Approve
                          </button>
                          <button
                            className="btn-action-reject"
                            onClick={() => openConfirm('reject', claim.id)}
                            title="Reject"
                            id={`btn-reject-${claim.id}`}
                          >
                            <HiOutlineThumbDown />
                            Reject
                          </button>
                        </div>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <button
                  className="btn-action-approve"
                  style={{ padding: '7px 14px' }}
                  onClick={() => { setSelectedClaim(null); openConfirm('approve', selectedClaim.id); }}
                  id="modal-btn-approve"
                >
                  <HiOutlineThumbUp /> Approve
                </button>
                <button
                  className="btn-action-reject"
                  style={{ padding: '7px 14px' }}
                  onClick={() => { setSelectedClaim(null); openConfirm('reject', selectedClaim.id); }}
                  id="modal-btn-reject"
                >
                  <HiOutlineThumbDown /> Reject
                </button>
                <button className="modal-close-btn" onClick={() => setSelectedClaim(null)}>
                  <HiOutlineX />
                </button>
              </div>
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
                <span className="detail-label">Priority Level</span>
                <span className="detail-value">
                  <span className="priority-badge">Level {selectedClaim.currentPriority}</span>
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

      {/* ── Confirm Action Modal ── */}
      {confirmModal.open && (
        <div className="details-modal-overlay" onClick={closeConfirm}>
          <div
            className="details-modal-card"
            style={{ maxWidth: '480px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                {confirmModal.action === 'approve' ? '✅ Approve Claim' : '❌ Reject Claim'}
              </h3>
              <button className="modal-close-btn" onClick={closeConfirm}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {confirmModal.action === 'approve'
                  ? 'Are you sure you want to approve this reimbursement claim? It will advance to the next priority level or be fully approved.'
                  : 'Are you sure you want to reject this claim? This action will terminate the approval workflow.'}
              </p>

              <div className="form-group">
                <label className="form-label" htmlFor="remark-input">
                  Remark{confirmModal.action === 'reject' ? ' (required)' : ' (optional)'}
                </label>
                <textarea
                  id="remark-input"
                  className="form-textarea"
                  placeholder={
                    confirmModal.action === 'approve'
                      ? 'Add an optional note…'
                      : 'State the reason for rejection…'
                  }
                  value={confirmModal.remark}
                  onChange={(e) =>
                    setConfirmModal((prev) => ({ ...prev, remark: e.target.value }))
                  }
                  rows={3}
                  disabled={confirmModal.processing}
                />
              </div>

              <div className="form-actions">
                <button
                  className="btn-secondary"
                  onClick={closeConfirm}
                  disabled={confirmModal.processing}
                >
                  Cancel
                </button>
                <button
                  className={
                    confirmModal.action === 'approve' ? 'btn-confirm-approve' : 'btn-confirm-reject'
                  }
                  onClick={handleConfirmAction}
                  disabled={
                    confirmModal.processing ||
                    (confirmModal.action === 'reject' && !confirmModal.remark.trim())
                  }
                  id="btn-confirm-action"
                >
                  {confirmModal.processing ? (
                    <>
                      <span className="btn-spinner" />
                      Processing…
                    </>
                  ) : confirmModal.action === 'approve' ? (
                    'Confirm Approve'
                  ) : (
                    'Confirm Reject'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ApprovalQueue;
