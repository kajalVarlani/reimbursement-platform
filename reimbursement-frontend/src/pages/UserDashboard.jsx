import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import {
  getMyReimbursements,
  cancelReimbursement,
  resubmitReimbursement,
  getReimbursementActivityLog,
} from '../services/reimbursementService';
import {
  HiOutlineDocumentText,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlinePlus,
  HiOutlineLogout,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineBan,
  HiOutlineRefresh,
  HiOutlineClipboardList,
} from 'react-icons/hi';
import { TbFileInvoice, TbReceipt } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

// ── Status badge helper ──────────────────────────────────────────────────────
const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  QUERY_RAISED: 'Query Raised',
  CANCELLED: 'Cancelled',
};

function UserDashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);

  // Activity log modal state
  const [activityModal, setActivityModal] = useState({ open: false, claimId: null, logs: [], loading: false });

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState({ open: false, claimId: null, processing: false });

  // Resubmit modal state
  const [resubmitModal, setResubmitModal] = useState({ open: false, claimId: null, remark: '', processing: false });

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyReimbursements();
      setClaims(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    toast.success('Logged out successfully');
  };

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const openCancelModal = (claimId) => {
    setCancelModal({ open: true, claimId, processing: false });
    setSelectedClaim(null);
  };

  const handleCancel = async () => {
    setCancelModal((p) => ({ ...p, processing: true }));
    const toastId = toast.loading('Cancelling claim…');
    try {
      await cancelReimbursement(cancelModal.claimId);
      toast.success('Claim cancelled successfully.', { id: toastId });
      setCancelModal({ open: false, claimId: null, processing: false });
      await fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel claim.', { id: toastId });
      setCancelModal((p) => ({ ...p, processing: false }));
    }
  };

  // ── Resubmit ────────────────────────────────────────────────────────────────
  const openResubmitModal = (claimId) => {
    setResubmitModal({ open: true, claimId, remark: '', processing: false });
    setSelectedClaim(null);
  };

  const handleResubmit = async () => {
    setResubmitModal((p) => ({ ...p, processing: true }));
    const toastId = toast.loading('Resubmitting claim…');
    try {
      await resubmitReimbursement(resubmitModal.claimId, resubmitModal.remark);
      toast.success('Claim resubmitted successfully!', { id: toastId });
      setResubmitModal({ open: false, claimId: null, remark: '', processing: false });
      await fetchClaims();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to resubmit claim.', { id: toastId });
      setResubmitModal((p) => ({ ...p, processing: false }));
    }
  };

  // ── Activity Log ────────────────────────────────────────────────────────────
  const openActivityLog = async (claimId) => {
    setActivityModal({ open: true, claimId, logs: [], loading: true });
    setSelectedClaim(null);
    try {
      const logs = await getReimbursementActivityLog(claimId);
      setActivityModal((p) => ({ ...p, logs, loading: false }));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load activity log.');
      setActivityModal((p) => ({ ...p, loading: false }));
    }
  };

  // Metrics calculations
  const totalClaims = claims.length;
  const pendingClaims = claims.filter(c => c.status === 'PENDING' || c.status === 'QUERY_RAISED').length;
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
              <span className="metric-label">In Progress</span>
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
                        <span className={`status-badge ${claim.status.toLowerCase().replace('_', '-')}`}>
                          <span className="status-dot" />
                          {STATUS_LABELS[claim.status] || claim.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="action-btn-group">
                          <button
                            className="btn-action-icon"
                            onClick={() => setSelectedClaim(claim)}
                            title="View Details"
                            id={`view-details-${claim.id}`}
                          >
                            <HiOutlineEye />
                          </button>
                          <button
                            className="btn-action-icon"
                            onClick={() => openActivityLog(claim.id)}
                            title="Activity Log"
                            id={`activity-log-${claim.id}`}
                          >
                            <HiOutlineClipboardList />
                          </button>
                          {claim.status === 'QUERY_RAISED' && (
                            <button
                              className="btn-action-approve"
                              onClick={() => openResubmitModal(claim.id)}
                              title="Resubmit"
                              id={`resubmit-${claim.id}`}
                            >
                              <HiOutlineRefresh />
                              Resubmit
                            </button>
                          )}
                          {(claim.status === 'PENDING' || claim.status === 'QUERY_RAISED') && (
                            <button
                              className="btn-action-reject"
                              onClick={() => openCancelModal(claim.id)}
                              title="Cancel"
                              id={`cancel-${claim.id}`}
                            >
                              <HiOutlineBan />
                              Cancel
                            </button>
                          )}
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
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {selectedClaim.status === 'QUERY_RAISED' && (
                  <button
                    className="btn-action-approve"
                    style={{ padding: '7px 14px' }}
                    onClick={() => openResubmitModal(selectedClaim.id)}
                    id="modal-btn-resubmit"
                  >
                    <HiOutlineRefresh /> Resubmit
                  </button>
                )}
                {(selectedClaim.status === 'PENDING' || selectedClaim.status === 'QUERY_RAISED') && (
                  <button
                    className="btn-action-reject"
                    style={{ padding: '7px 14px' }}
                    onClick={() => openCancelModal(selectedClaim.id)}
                    id="modal-btn-cancel"
                  >
                    <HiOutlineBan /> Cancel
                  </button>
                )}
                <button className="modal-close-btn" onClick={() => setSelectedClaim(null)}>
                  <HiOutlineX />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span className={`status-badge ${selectedClaim.status.toLowerCase().replace('_', '-')}`}>
                    <span className="status-dot" />
                    {STATUS_LABELS[selectedClaim.status] || selectedClaim.status}
                  </span>
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Claim ID</span>
                <span className="detail-value" style={{ fontSize: '12px', wordBreak: 'break-all' }}>{selectedClaim.id}</span>
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
                          className={`status-badge ${ap.status.toLowerCase().replace('_', '-')}`}
                          style={{ fontSize: '11px' }}
                        >
                          <span className="status-dot" />
                          {STATUS_LABELS[ap.status] || ap.status}
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

              {selectedClaim.bills && selectedClaim.bills.length > 0 ? (
                <div style={{ marginTop: '20px' }}>
                  <span className="detail-label" style={{ display: 'block', marginBottom: '12px' }}>
                    Attached Bills &amp; Receipts ({selectedClaim.bills.length})
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {selectedClaim.bills.map((rb, idx) => {
                      const b = rb.bill;
                      if (!b) return null;
                      return (
                        <div key={b.id || idx} style={{ border: '1px solid var(--wc-100)', borderRadius: '10px', padding: '16px', background: 'var(--card-bg-subtle, #f9fafb)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px dashed var(--wc-100)', paddingBottom: '8px' }}>
                            <span style={{ fontWeight: 600, fontSize: '14.5px' }}>Bill #{idx + 1}</span>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                Total: <span style={{ fontWeight: 600 }}>₹{b.amount.toLocaleString('en-IN')}</span>
                              </span>
                              <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '14.5px' }}>
                                Claimed: ₹{rb.allocatedAmount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px 12px', fontSize: '13px', marginBottom: '12px' }}>
                            {b.vendorName && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Vendor</span>
                                <span style={{ fontWeight: 500 }}>{b.vendorName}</span>
                              </div>
                            )}
                            {b.invoiceNumber && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Invoice No.</span>
                                <span style={{ fontWeight: 500 }}>{b.invoiceNumber}</span>
                              </div>
                            )}
                            {b.transactionId && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Transaction ID</span>
                                <span style={{ fontWeight: 500 }}>{b.transactionId}</span>
                              </div>
                            )}
                            {b.billDate && (
                              <div>
                                <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Bill Date</span>
                                <span style={{ fontWeight: 500 }}>{new Date(b.billDate).toLocaleDateString('en-IN')}</span>
                              </div>
                            )}
                          </div>
                          <div>
                            {b.receiptUrl ? (
                              b.receiptUrl.toLowerCase().includes('.pdf') ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  <iframe
                                    src={b.receiptUrl}
                                    title={`Receipt PDF ${idx + 1}`}
                                    style={{ width: '100%', height: '220px', border: '1px solid var(--wc-100)', borderRadius: '6px' }}
                                  />
                                  <a
                                    href={b.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-secondary"
                                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 12px', textDecoration: 'none', textAlign: 'center', fontSize: '12px', width: 'fit-content' }}
                                  >
                                    Open PDF in New Tab
                                  </a>
                                </div>
                              ) : (
                                <a href={b.receiptUrl} target="_blank" rel="noopener noreferrer">
                                  <img
                                    src={b.receiptUrl}
                                    alt={`Bill ${idx + 1} Receipt`}
                                    style={{ maxWidth: '100%', maxHeight: '220px', borderRadius: '6px', objectFit: 'contain', display: 'block', border: '1px solid var(--wc-100)' }}
                                  />
                                </a>
                              )
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No receipt document uploaded</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="detail-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span className="detail-label">Receipt Document / Image</span>
                  {selectedClaim.receiptUrl ? (
                    selectedClaim.receiptUrl.toLowerCase().includes('.pdf') ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
                        <iframe
                          src={selectedClaim.receiptUrl}
                          title="Receipt PDF"
                          style={{ width: '100%', height: '350px', border: '1px solid var(--wc-100)', borderRadius: '6px' }}
                        />
                        <a
                          href={selectedClaim.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px 16px', textDecoration: 'none', textAlign: 'center', fontSize: '13px' }}
                        >
                          Open PDF in New Tab
                        </a>
                      </div>
                    ) : (
                      <a href={selectedClaim.receiptUrl} target="_blank" rel="noopener noreferrer">
                        <img
                          src={selectedClaim.receiptUrl}
                          alt="Receipt Scan"
                          className="receipt-image-preview"
                        />
                      </a>
                    )
                  ) : (
                    <span className="detail-value text-muted">No scan available</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Activity Log Modal ── */}
      {activityModal.open && (
        <div className="details-modal-overlay" onClick={() => setActivityModal({ open: false, claimId: null, logs: [], loading: false })}>
          <div className="details-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Activity Log</h3>
              <button className="modal-close-btn" onClick={() => setActivityModal({ open: false, claimId: null, logs: [], loading: false })}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              {activityModal.loading ? (
                <div style={{ padding: '40px', display: 'flex', justifyContent: 'center' }}>
                  <div className="btn-spinner" style={{ width: '36px', height: '36px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
                </div>
              ) : activityModal.logs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                  No activity recorded yet.
                </p>
              ) : (
                <div className="activity-timeline">
                  {activityModal.logs.map((log) => (
                    <div key={log.id} className="activity-item">
                      <div className="activity-dot" />
                      <div className="activity-content">
                        <div className="activity-action">{log.action.replace(/_/g, ' ')}</div>
                        <div className="activity-text">{log.activity}</div>
                        <div className="activity-meta">
                          <span className="activity-actor">
                            {log.actorRole} — {log.user?.name || log.administrator?.name || 'System'}
                          </span>
                          <span className="activity-time">
                            {new Date(log.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Cancel Confirm Modal ── */}
      {cancelModal.open && (
        <div className="details-modal-overlay" onClick={() => !cancelModal.processing && setCancelModal({ open: false, claimId: null, processing: false })}>
          <div className="details-modal-card" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">❌ Cancel Claim</h3>
              <button className="modal-close-btn" onClick={() => setCancelModal({ open: false, claimId: null, processing: false })} disabled={cancelModal.processing}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Are you sure you want to cancel this reimbursement claim? This action cannot be undone.
              </p>
              <div className="form-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setCancelModal({ open: false, claimId: null, processing: false })}
                  disabled={cancelModal.processing}
                >
                  Go Back
                </button>
                <button
                  className="btn-confirm-reject"
                  onClick={handleCancel}
                  disabled={cancelModal.processing}
                  id="btn-confirm-cancel"
                >
                  {cancelModal.processing ? <><span className="btn-spinner" /> Cancelling…</> : 'Confirm Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Resubmit Modal ── */}
      {resubmitModal.open && (
        <div className="details-modal-overlay" onClick={() => !resubmitModal.processing && setResubmitModal({ open: false, claimId: null, remark: '', processing: false })}>
          <div className="details-modal-card" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔄 Resubmit Claim</h3>
              <button className="modal-close-btn" onClick={() => setResubmitModal({ open: false, claimId: null, remark: '', processing: false })} disabled={resubmitModal.processing}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Resubmit this claim after addressing the query raised by the administrator. You may optionally include a response remark.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="resubmit-remark">Response Remark (optional)</label>
                <textarea
                  id="resubmit-remark"
                  className="form-textarea"
                  placeholder="Explain how you addressed the query…"
                  value={resubmitModal.remark}
                  onChange={(e) => setResubmitModal((p) => ({ ...p, remark: e.target.value }))}
                  rows={3}
                  disabled={resubmitModal.processing}
                />
              </div>
              <div className="form-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setResubmitModal({ open: false, claimId: null, remark: '', processing: false })}
                  disabled={resubmitModal.processing}
                >
                  Cancel
                </button>
                <button
                  className="btn-confirm-approve"
                  onClick={handleResubmit}
                  disabled={resubmitModal.processing}
                  id="btn-confirm-resubmit"
                >
                  {resubmitModal.processing ? <><span className="btn-spinner" /> Resubmitting…</> : 'Confirm Resubmit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserDashboard;
