import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import {
  getApprovalQueue,
  approveReimbursement,
  rejectReimbursement,
  raiseQueryOnReimbursement,
  markAsPaid,
  getApprovalActivityLog,
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
  HiOutlineQuestionMarkCircle,
  HiOutlineClipboardList,
  HiOutlineCurrencyRupee,
  HiOutlineFilter,
} from 'react-icons/hi';
import { TbFileInvoice, TbShieldCheck } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  QUERY_RAISED: 'Query Raised',
  CANCELLED: 'Cancelled',
};

const SUPER_ADMIN_STATUS_FILTERS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'QUERY_RAISED', label: 'Query Raised' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function ApprovalQueue() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role } = useSelector((state) => state.auth);
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Confirm action modal state
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    action: null, // 'approve' | 'reject' | 'query' | 'mark-paid'
    claimId: null,
    remark: '',
    processing: false,
  });

  // Activity log modal
  const [activityModal, setActivityModal] = useState({ open: false, logs: [], loading: false });

  const fetchQueue = useCallback(async (filter) => {
    setLoading(true);
    try {
      const data = await getApprovalQueue(filter ?? statusFilter);
      setClaims(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load approval queue');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value);
    fetchQueue(value);
  };

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
    const loadingMessages = {
      approve: 'Approving claim…',
      reject: 'Rejecting claim…',
      query: 'Raising query…',
      'mark-paid': 'Marking as paid…',
    };
    const toastId = toast.loading(loadingMessages[action] || 'Processing…');
    try {
      if (action === 'approve') {
        await approveReimbursement(claimId, remark);
        toast.success('Claim approved successfully!', { id: toastId });
      } else if (action === 'reject') {
        await rejectReimbursement(claimId, remark);
        toast.success('Claim rejected.', { id: toastId });
      } else if (action === 'query') {
        await raiseQueryOnReimbursement(claimId, remark);
        toast.success('Query raised successfully!', { id: toastId });
      } else if (action === 'mark-paid') {
        await markAsPaid(claimId);
        toast.success('Reimbursement marked as paid!', { id: toastId });
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

  const openActivityLog = async (claimId) => {
    setActivityModal({ open: true, logs: [], loading: true });
    setSelectedClaim(null);
    try {
      const logs = await getApprovalActivityLog(claimId);
      setActivityModal({ open: true, logs, loading: false });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load activity log.');
      setActivityModal((p) => ({ ...p, loading: false }));
    }
  };

  // Count helpers for metrics
  const pendingCount = claims.filter(c => c.status === 'PENDING' || c.status === 'QUERY_RAISED').length;
  const approvedCount = claims.filter(c => c.status === 'APPROVED').length;
  const totalAmount = claims.reduce((sum, c) => sum + (c.amount || 0), 0);

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
          <button
            className="btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px' }}
            onClick={() => navigate('/admin/history')}
            id="btn-go-history"
          >
            View History
          </button>
          {isSuperAdmin && (
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
                {isSuperAdmin ? 'Super Admin' : 'Administrator'}
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
            {isSuperAdmin ? 'All Reimbursements' : 'Approval Queue'}
            <span className="section-subtitle">
              {isSuperAdmin
                ? 'Global audit view — all reimbursement claims across the system'
                : 'Review and action pending reimbursement claims at your priority level'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isSuperAdmin && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <HiOutlineFilter style={{ color: 'var(--text-muted)', fontSize: '16px' }} />
                <select
                  className="form-select"
                  style={{ padding: '8px 12px', fontSize: '13px', minWidth: '150px' }}
                  value={statusFilter}
                  onChange={(e) => handleStatusFilterChange(e.target.value)}
                  id="status-filter-select"
                >
                  {SUPER_ADMIN_STATUS_FILTERS.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              className="btn-secondary"
              style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={() => fetchQueue()}
              id="btn-refresh-queue"
            >
              <HiOutlineRefresh />
              Refresh
            </button>
          </div>
        </div>

        {/* Metrics */}
        <section className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-box pending">
              <HiOutlineClock />
            </div>
            <div className="metric-info">
              <span className="metric-value">{isSuperAdmin ? claims.length : pendingCount}</span>
              <span className="metric-label">{isSuperAdmin ? (statusFilter ? STATUS_LABELS[statusFilter] : 'Total') : 'Pending in Queue'}</span>
            </div>
          </div>
          {!isSuperAdmin && (
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
          )}
          {isSuperAdmin && (
            <div className="metric-card">
              <div className="metric-icon-box approved">
                <HiOutlineCheckCircle />
              </div>
              <div className="metric-info">
                <span className="metric-value">{approvedCount}</span>
                <span className="metric-label">Approved</span>
              </div>
            </div>
          )}
          <div className="metric-card">
            <div className="metric-icon-box total">
              <TbShieldCheck />
            </div>
            <div className="metric-info">
              <span className="metric-value">
                ₹{totalAmount.toLocaleString('en-IN')}
              </span>
              <span className="metric-label">{isSuperAdmin ? 'Total Value' : 'Total Amount Pending'}</span>
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
              <h3 className="empty-state-title">{isSuperAdmin ? 'No claims found' : 'Queue is clear!'}</h3>
              <p className="empty-state-text">
                {isSuperAdmin
                  ? 'No reimbursements match the selected filter.'
                  : 'No pending claims require your action at this time.'}
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
                    <th>{isSuperAdmin ? 'Status' : 'Priority Level'}</th>
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
                        {isSuperAdmin ? (
                          <span className={`status-badge ${claim.status.toLowerCase().replace('_', '-')}`}>
                            <span className="status-dot" />
                            {STATUS_LABELS[claim.status] || claim.status}
                          </span>
                        ) : (
                          <span className="priority-badge">Level {claim.currentPriority}</span>
                        )}
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
                            className="btn-action-icon"
                            onClick={() => openActivityLog(claim.id)}
                            title="Activity Log"
                            id={`btn-activity-${claim.id}`}
                          >
                            <HiOutlineClipboardList />
                          </button>
                          {/* Regular admin actions — only on PENDING/QUERY_RAISED */}
                          {!isSuperAdmin && (claim.status === 'PENDING' || claim.status === 'QUERY_RAISED') && (
                            <>
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
                                className="btn-action-query"
                                onClick={() => openConfirm('query', claim.id)}
                                title="Raise Query"
                                id={`btn-query-${claim.id}`}
                              >
                                <HiOutlineQuestionMarkCircle />
                                Query
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
                            </>
                          )}
                          {/* Super Admin — view only; no approve/reject/query */}
                          {/* Super Admin — mark as paid on APPROVED claims */}
                          {isSuperAdmin && claim.status === 'APPROVED' && !claim.isPaid && (
                            <button
                              className="btn-action-approve"
                              onClick={() => openConfirm('mark-paid', claim.id)}
                              title="Mark as Paid"
                              id={`btn-mark-paid-${claim.id}`}
                            >
                              <HiOutlineCurrencyRupee />
                              Mark Paid
                            </button>
                          )}
                          {isSuperAdmin && claim.isPaid && (
                            <span style={{ fontSize: '12px', color: 'var(--success)', fontWeight: 600, padding: '4px 8px' }}>
                              ✅ Paid
                            </span>
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Regular admin actions in modal — only for non-super-admins */}
                {!isSuperAdmin && (selectedClaim.status === 'PENDING' || selectedClaim.status === 'QUERY_RAISED') && (
                  <>
                    <button
                      className="btn-action-approve"
                      style={{ padding: '7px 14px' }}
                      onClick={() => { setSelectedClaim(null); openConfirm('approve', selectedClaim.id); }}
                      id="modal-btn-approve"
                    >
                      <HiOutlineThumbUp /> Approve
                    </button>
                    <button
                      className="btn-action-query"
                      style={{ padding: '7px 14px' }}
                      onClick={() => { setSelectedClaim(null); openConfirm('query', selectedClaim.id); }}
                      id="modal-btn-query"
                    >
                      <HiOutlineQuestionMarkCircle /> Query
                    </button>
                    <button
                      className="btn-action-reject"
                      style={{ padding: '7px 14px' }}
                      onClick={() => { setSelectedClaim(null); openConfirm('reject', selectedClaim.id); }}
                      id="modal-btn-reject"
                    >
                      <HiOutlineThumbDown /> Reject
                    </button>
                  </>
                )}
                {/* Super Admin — only Mark Paid action allowed */}
                {isSuperAdmin && selectedClaim.status === 'APPROVED' && !selectedClaim.isPaid && (
                  <button
                    className="btn-action-approve"
                    style={{ padding: '7px 14px' }}
                    onClick={() => { setSelectedClaim(null); openConfirm('mark-paid', selectedClaim.id); }}
                    id="modal-btn-mark-paid"
                  >
                    <HiOutlineCurrencyRupee /> Mark Paid
                  </button>
                )}
                <button
                  className="btn-action-icon"
                  onClick={() => openActivityLog(selectedClaim.id)}
                  title="Activity Log"
                  id="modal-btn-activity"
                >
                  <HiOutlineClipboardList />
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
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span className={`status-badge ${selectedClaim.status.toLowerCase().replace('_', '-')}`}>
                    <span className="status-dot" />
                    {STATUS_LABELS[selectedClaim.status] || selectedClaim.status}
                  </span>
                  {selectedClaim.isPaid && (
                    <span style={{ marginLeft: '8px', color: 'var(--success)', fontSize: '12px', fontWeight: 600 }}>
                      ✅ Paid
                    </span>
                  )}
                </span>
              </div>
              {!isSuperAdmin && (
                <div className="detail-row">
                  <span className="detail-label">Priority Level</span>
                  <span className="detail-value">
                    <span className="priority-badge">Level {selectedClaim.currentPriority}</span>
                  </span>
                </div>
              )}
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
        <div className="details-modal-overlay" onClick={() => setActivityModal({ open: false, logs: [], loading: false })}>
          <div className="details-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Activity Log</h3>
              <button className="modal-close-btn" onClick={() => setActivityModal({ open: false, logs: [], loading: false })}>
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
                {confirmModal.action === 'approve'
                  ? '✅ Approve Claim'
                  : confirmModal.action === 'reject'
                    ? '❌ Reject Claim'
                    : confirmModal.action === 'mark-paid'
                      ? '💰 Mark as Paid'
                      : '❓ Raise Query / Concern'}
              </h3>
              <button className="modal-close-btn" onClick={closeConfirm}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {confirmModal.action === 'approve'
                  ? 'Are you sure you want to approve this reimbursement claim? It will advance to the next priority level or be fully approved.'
                  : confirmModal.action === 'reject'
                    ? 'Are you sure you want to reject this claim? This action will terminate the approval workflow.'
                    : confirmModal.action === 'mark-paid'
                      ? 'Are you sure you want to mark this reimbursement as paid? The submitting user will be notified via email.'
                      : 'Are you sure you want to raise a query on this claim? This will suspend the approval process and notify the user to provide clarification.'}
              </p>

              {confirmModal.action !== 'mark-paid' && (
                <div className="form-group">
                  <label className="form-label" htmlFor="remark-input">
                    Remark{confirmModal.action === 'approve' ? ' (optional)' : ' (required)'}
                  </label>
                  <textarea
                    id="remark-input"
                    className="form-textarea"
                    placeholder={
                      confirmModal.action === 'approve'
                        ? 'Add an optional note…'
                        : confirmModal.action === 'reject'
                          ? 'State the reason for rejection…'
                          : 'Explain your query or concern…'
                    }
                    value={confirmModal.remark}
                    onChange={(e) =>
                      setConfirmModal((prev) => ({ ...prev, remark: e.target.value }))
                    }
                    rows={3}
                    disabled={confirmModal.processing}
                  />
                </div>
              )}

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
                    confirmModal.action === 'approve' || confirmModal.action === 'mark-paid'
                      ? 'btn-confirm-approve'
                      : confirmModal.action === 'reject'
                        ? 'btn-confirm-reject'
                        : 'btn-confirm-query'
                  }
                  onClick={handleConfirmAction}
                  disabled={
                    confirmModal.processing ||
                    (confirmModal.action !== 'approve' && confirmModal.action !== 'mark-paid' && !confirmModal.remark.trim())
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
                  ) : confirmModal.action === 'reject' ? (
                    'Confirm Reject'
                  ) : confirmModal.action === 'mark-paid' ? (
                    'Confirm Mark Paid'
                  ) : (
                    'Confirm Raise Query'
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
