import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import { getApprovalHistory, getApprovalActivityLog } from '../services/adminService';
import {
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineLogout,
  HiOutlineEye,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineArrowLeft,
  HiOutlineClipboardList,
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
  const [activityModal, setActivityModal] = useState({ open: false, logs: [], loading: false });

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const resetFilters = () => {
    setSearchTerm('');
    setActionFilter('');
    setCommitteeFilter('');
    setMinAmount('');
    setMaxAmount('');
  };

  // Dynamic list of unique committees for the filter dropdown
  const committees = useMemo(() => {
    const list = new Set();
    history.forEach((h) => {
      const claim = h.reimbursement;
      if (claim?.committee) list.add(claim.committee);
    });
    return Array.from(list).sort();
  }, [history]);

  const filteredHistory = useMemo(() => {
    return history.filter((record) => {
      const claim = record.reimbursement;
      if (!claim) return false;

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesUser = claim.user?.name?.toLowerCase().includes(term) || claim.user?.email?.toLowerCase().includes(term);
        const matchesEvent = claim.event?.toLowerCase().includes(term);
        const matchesCommittee = claim.committee?.toLowerCase().includes(term);
        const matchesDesc = claim.description?.toLowerCase().includes(term);
        const matchesRemark = record.remark?.toLowerCase().includes(term);
        const matchesAmount = String(claim.amount).includes(term);
        if (!matchesUser && !matchesEvent && !matchesCommittee && !matchesDesc && !matchesRemark && !matchesAmount) {
          return false;
        }
      }

      if (actionFilter && record.status !== actionFilter) {
        return false;
      }

      if (committeeFilter && claim.committee !== committeeFilter) {
        return false;
      }

      if (minAmount.trim()) {
        const minVal = parseFloat(minAmount);
        if (!isNaN(minVal) && claim.amount < minVal) return false;
      }

      if (maxAmount.trim()) {
        const maxVal = parseFloat(maxAmount);
        if (!isNaN(maxVal) && claim.amount > maxVal) return false;
      }

      return true;
    });
  }, [history, searchTerm, actionFilter, committeeFilter, minAmount, maxAmount]);

  const renderFilterBar = () => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      padding: '16px 20px',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border-light)',
      alignItems: 'center',
      borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
    }}>
      <div style={{ flex: '1 1 200px', position: 'relative' }}>
        <input
          type="text"
          className="form-input"
          style={{ paddingLeft: '14px', width: '100%', height: '38px', fontSize: '13.5px' }}
          placeholder="Search by submitter, event, committee, remark..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ minWidth: '130px' }}>
        <select
          className="form-select"
          style={{ width: '100%', height: '38px', fontSize: '13px', padding: '0 12px' }}
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        >
          <option value="">All Actions</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="QUERY_RAISED">Query Raised</option>
        </select>
      </div>

      <div style={{ minWidth: '150px' }}>
        <select
          className="form-select"
          style={{ width: '100%', height: '38px', fontSize: '13px', padding: '0 12px' }}
          value={committeeFilter}
          onChange={(e) => setCommitteeFilter(e.target.value)}
        >
          <option value="">All Committees</option>
          {committees.map((comm) => (
            <option key={comm} value={comm}>{comm}</option>
          ))}
        </select>
      </div>

      <div style={{ width: '100px' }}>
        <input
          type="number"
          className="form-input"
          style={{ paddingLeft: '10px', width: '100%', height: '38px', fontSize: '13px' }}
          placeholder="Min ₹"
          value={minAmount}
          onChange={(e) => setMinAmount(e.target.value)}
        />
      </div>

      <div style={{ width: '100px' }}>
        <input
          type="number"
          className="form-input"
          style={{ paddingLeft: '10px', width: '100%', height: '38px', fontSize: '13px' }}
          placeholder="Max ₹"
          value={maxAmount}
          onChange={(e) => setMaxAmount(e.target.value)}
        />
      </div>

      {(searchTerm || actionFilter || committeeFilter || minAmount || maxAmount) && (
        <button
          onClick={resetFilters}
          className="btn-secondary"
          style={{ padding: '8px 14px', height: '38px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          Clear
        </button>
      )}
    </div>
  );

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
          <img src="/infernxt-logo.png" alt="inferNXT" className="brand-logo brand-logo-company" />
        </div>
        <div className="header-user-actions">
          <img src="/claimnest-logo-clean.png" alt="ClaimNest" className="brand-logo brand-logo-product" />
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
            <>
              {renderFilterBar()}
              
              {filteredHistory.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <HiOutlineClock className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="empty-state-title">No matching history records</h3>
                  <p className="empty-state-text">Try adjusting your search terms or filters.</p>
                  <button className="btn-secondary" onClick={resetFilters} style={{ padding: '8px 16px', fontSize: '13px', margin: '12px auto 0 auto' }}>
                    Reset Filters
                  </button>
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
                      {filteredHistory.map((record) => {
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
                              <div className="action-btn-group">
                                <button
                                  className="btn-action-icon"
                                  onClick={() => setSelectedClaim(claim)}
                                  title="View Details"
                                  id={`btn-view-${record.id}`}
                                >
                                  <HiOutlineEye />
                                </button>
                                <button
                                  className="btn-action-icon"
                                  onClick={() => claim && openActivityLog(claim.id)}
                                  title="Activity Log"
                                  id={`btn-activity-${record.id}`}
                                >
                                  <HiOutlineClipboardList />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
    </div>
  );
}

export default ApprovalHistory;
