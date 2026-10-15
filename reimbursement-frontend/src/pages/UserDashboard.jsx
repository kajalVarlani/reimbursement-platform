import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { logout } from '../store/authSlice';
import {
  getMyReimbursements,
  cancelReimbursement,
  resubmitReimbursement,
  getReimbursementActivityLog,
  getMyClubBudget,
  getSignatureAuditCertificate,
} from '../services/reimbursementService';
import {
  getActiveProjectionWindow,
  submitProjection,
} from '../services/projectionService';
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
  HiOutlineCalendar,
  HiOutlineTrash,
  HiOutlineExclamation,
} from 'react-icons/hi';
import { TbFileInvoice, TbReceipt, TbCertificate } from 'react-icons/tb';
import SanctionCertificateModal from '../components/SanctionCertificateModal';
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

  // Club budget state (Convenor / Deputy Convenor)
  const [clubBudget, setClubBudget] = useState(null);
  const [loadingBudget, setLoadingBudget] = useState(false);
  const [budgetRefreshedAt, setBudgetRefreshedAt] = useState(null);

  // Projection deadline window
  const [projWindow, setProjWindow] = useState(null);
  const [showProjectionModal, setShowProjectionModal] = useState(false);
  const [projItems, setProjItems] = useState([{ eventName: '', expectedAmount: '', description: '', tentativeDate: '' }]);
  const [projTargetMonth, setProjTargetMonth] = useState('');
  const [submittingProjection, setSubmittingProjection] = useState(false);

  // Sanction certificate viewer modal state
  const [certModal, setCertModal] = useState({
    open: false,
    certificate: null,
    loading: false,
  });

  const handleOpenCertificate = async (claimId) => {
    setCertModal({ open: true, certificate: null, loading: true });
    try {
      const data = await getSignatureAuditCertificate(claimId);
      setCertModal({ open: true, certificate: data, loading: false });
    } catch (err) {
      toast.error('Failed to load sanction certificate');
      setCertModal({ open: false, certificate: null, loading: false });
    }
  };

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setCommitteeFilter('');
    setMinAmount('');
    setMaxAmount('');
  };

  // Dynamic list of unique committees for the filter dropdown
  const committees = useMemo(() => {
    const list = new Set();
    claims.forEach((c) => {
      if (c.committee) list.add(c.committee);
    });
    return Array.from(list).sort();
  }, [claims]);

  const filteredClaims = useMemo(() => {
    return claims.filter((claim) => {
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesEvent = claim.event?.toLowerCase().includes(term);
        const matchesCommittee = claim.committee?.toLowerCase().includes(term);
        const matchesDesc = claim.description?.toLowerCase().includes(term);
        const matchesAmount = String(claim.amount).includes(term);
        if (!matchesEvent && !matchesCommittee && !matchesDesc && !matchesAmount) {
          return false;
        }
      }

      if (statusFilter && claim.status !== statusFilter) {
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
  }, [claims, searchTerm, statusFilter, committeeFilter, minAmount, maxAmount]);

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
          placeholder="Search by event, committee, description, amount..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div style={{ minWidth: '130px' }}>
        <select
          className="form-select"
          style={{ width: '100%', height: '38px', fontSize: '13px', padding: '0 12px' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
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

      {(searchTerm || statusFilter || committeeFilter || minAmount || maxAmount) && (
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

  // Activity log modal state
  const [activityModal, setActivityModal] = useState({ open: false, claimId: null, logs: [], loading: false });

  // Cancel modal state
  const [cancelModal, setCancelModal] = useState({ open: false, claimId: null, processing: false });

  // Resubmit modal state
  const [resubmitModal, setResubmitModal] = useState({ open: false, claimId: null, remark: '', processing: false });

  const fetchClubBudget = useCallback(async () => {
    setLoadingBudget(true);
    try {
      const data = await getMyClubBudget();
      setClubBudget(data);
      setBudgetRefreshedAt(new Date());
    } catch {
      // Silently ignore if not configured
    } finally {
      setLoadingBudget(false);
    }
  }, []);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyReimbursements();
      setClaims(data);
      fetchClubBudget();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load claims');
    } finally {
      setLoading(false);
    }
  }, [fetchClubBudget]);

  const fetchProjectionWindow = useCallback(async () => {
    try {
      const data = await getActiveProjectionWindow();
      if (data && data.active) {
        setProjWindow(data);
        // Pre-fill target month from window
        if (data.targetMonth) setProjTargetMonth(data.targetMonth);
      }
    } catch {
      // Silently ignore — not critical
    }
  }, []);

  useEffect(() => {
    fetchClaims();
    fetchProjectionWindow();
    fetchClubBudget();
  }, [fetchClaims, fetchProjectionWindow, fetchClubBudget]);

  // ── Projection submission ───────────────────────────────────────────────────
  const addProjItem = () => {
    setProjItems((p) => [...p, { eventName: '', expectedAmount: '', description: '', tentativeDate: '' }]);
  };

  const removeProjItem = (idx) => {
    if (projItems.length <= 1) return;
    setProjItems((p) => p.filter((_, i) => i !== idx));
  };

  const updateProjItem = (idx, field, value) => {
    setProjItems((p) => {
      const next = [...p];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSubmitProjection = async (e) => {
    e.preventDefault();
    if (!projTargetMonth) {
      toast.error('Please select the target month for your projection.');
      return;
    }
    for (let i = 0; i < projItems.length; i++) {
      const item = projItems[i];
      if (!item.eventName.trim()) {
        toast.error(`Event name is required for item #${i + 1}`);
        return;
      }
      const amt = parseFloat(item.expectedAmount);
      if (isNaN(amt) || amt <= 0) {
        toast.error(`Expected amount must be greater than 0 for item #${i + 1}`);
        return;
      }
    }
    setSubmittingProjection(true);
    const toastId = toast.loading('Submitting projection…');
    try {
      const items = projItems.map((item) => ({
        eventName: item.eventName.trim(),
        expectedAmount: parseFloat(item.expectedAmount),
        description: item.description.trim() || undefined,
        tentativeDate: item.tentativeDate || undefined,
      }));
      await submitProjection(projTargetMonth, items);
      toast.success('Monthly projection submitted!', { id: toastId });
      setShowProjectionModal(false);
      setProjItems([{ eventName: '', expectedAmount: '', description: '', tentativeDate: '' }]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit projection', { id: toastId });
    } finally {
      setSubmittingProjection(false);
    }
  };

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
          <img src="/infernxt-logo.png" alt="inferNXT" className="brand-logo brand-logo-company" />
        </div>
        <div className="header-user-actions">
          <img src="/claimnest-logo-clean.png" alt="ClaimNest" className="brand-logo brand-logo-product" />
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
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {projWindow && !projWindow.isExpired && (
              <button
                className="btn-secondary"
                onClick={() => setShowProjectionModal(true)}
                id="btn-submit-projection"
                style={{ padding: '9px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#f59e0b', color: '#f59e0b' }}
              >
                <HiOutlineCalendar /> Submit Projection
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => navigate('/submit-reimbursement')}
              id="btn-go-to-submit"
            >
              <HiOutlinePlus />
              Submit New Claim
            </button>
          </div>
        </div>

        {/* ── Projection Deadline Banner ── */}
        {projWindow && (
          <div
            id="projection-deadline-banner"
            style={{
              background: projWindow.isExpired
                ? 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(185,28,28,0.06) 100%)'
                : 'linear-gradient(135deg, rgba(245,158,11,0.14) 0%, rgba(217,119,6,0.07) 100%)',
              border: `1px solid ${projWindow.isExpired ? 'rgba(239,68,68,0.28)' : 'rgba(245,158,11,0.32)'}`,
              borderRadius: 'var(--radius-lg)',
              padding: '14px 20px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '14px',
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
              background: projWindow.isExpired ? 'rgba(239,68,68,0.13)' : 'rgba(245,158,11,0.16)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: projWindow.isExpired ? '#ef4444' : '#f59e0b', fontSize: '18px'
            }}>
              {projWindow.isExpired ? <HiOutlineExclamation /> : <HiOutlineCalendar />}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: projWindow.isExpired ? '#ef4444' : '#d97706', marginBottom: '4px' }}>
                {projWindow.isExpired
                  ? `Projection Deadline Passed — ${projWindow.targetMonth}`
                  : `⏰ Monthly Projection Due — Submit by ${new Date(projWindow.deadline).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
                }
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {projWindow.isExpired
                  ? `The submission window for ${projWindow.targetMonth} expense projections is now closed.`
                  : `Submit your club's itemised monthly expense projections for ${projWindow.targetMonth}.`
                }
                {projWindow.instructions && (
                  <span style={{ display: 'block', marginTop: '3px', fontStyle: 'italic', color: 'var(--text-muted)', fontSize: '12.5px' }}>
                    Treasurer note: {projWindow.instructions}
                  </span>
                )}
              </div>
            </div>
            {!projWindow.isExpired && (
              <button
                className="btn-primary"
                onClick={() => setShowProjectionModal(true)}
                style={{ flexShrink: 0, padding: '8px 14px', fontSize: '12.5px', background: '#d97706', borderColor: '#d97706' }}
                id="btn-banner-submit-projection"
              >
                Submit Now
              </button>
            )}
          </div>
        )}

        {/* ── Club Budget Allocation Banner (Convenor / Deputy Convenor) ── */}
        {(user?.clubName || clubBudget?.hasBudget || user?.designation === 'CONVENOR' || user?.designation === 'DEPUTY_CONVENOR') && (
          <div
            id="club-budget-status-card"
            style={{
              background: 'white',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              marginBottom: '24px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(79, 124, 130, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wc-300)', fontSize: '22px' }}>
                  <TbFileInvoice />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      {user?.clubName || clubBudget?.clubName} — Monthly Budget
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'var(--wc-100)', color: 'var(--wc-400)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {user?.designation === 'CONVENOR' ? 'Convenor' : user?.designation === 'DEPUTY_CONVENOR' ? 'Deputy Convenor' : 'C / DC'}
                    </span>
                    {clubBudget?.hasBudget && (
                      <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: clubBudget.remainingAmount <= 0 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: clubBudget.remainingAmount <= 0 ? '#ef4444' : '#10b981' }}>
                        {clubBudget.remainingAmount <= 0 ? 'Budget Exhausted' : 'Budget Active'}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Allocated by Treasurer for {clubBudget?.targetMonth || 'current month'}. Cleared reimbursements are debited automatically.
                    {budgetRefreshedAt && (
                      <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        · Last refreshed {budgetRefreshedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <button
                className="btn-secondary"
                onClick={fetchClubBudget}
                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                title="Refresh budget status"
                id="btn-refresh-user-budget"
                disabled={loadingBudget}
              >
                {loadingBudget ? <><span className="btn-spinner" style={{ width: '12px', height: '12px', border: '2px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)', marginRight: '2px' }} /> Refreshing…</> : <><HiOutlineRefresh /> Refresh</>}
              </button>
            </div>

            {clubBudget?.hasBudget ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Allocated Budget</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                      ₹{clubBudget.allocatedAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Sanctioned by Treasurer</div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed / Debited</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--wc-200)', marginTop: '4px' }}>
                      ₹{clubBudget.spentAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Cleared reimbursement payouts</div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '12px 16px', border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Balance</div>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: clubBudget.remainingAmount < 1000 ? '#ef4444' : '#10b981', marginTop: '4px' }}>
                      ₹{clubBudget.remainingAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Remaining unspent budget</div>
                  </div>
                </div>

                {/* Utilization Progress Bar */}
                <div>
                  {(() => {
                    const percentUsed = clubBudget.allocatedAmount > 0
                      ? Math.min(100, Math.round((clubBudget.spentAmount / clubBudget.allocatedAmount) * 100))
                      : 0;
                    const barColor = percentUsed >= 90 ? '#ef4444' : percentUsed >= 70 ? '#f59e0b' : '#10b981';

                    return (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Budget Utilization</span>
                          <span style={{ color: barColor }}>{percentUsed}% utilized (₹{clubBudget.remainingAmount?.toLocaleString('en-IN')} remaining)</span>
                        </div>
                        <div style={{ height: '8px', background: 'var(--border-lighter, #e5e7eb)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percentUsed}%`,
                              height: '100%',
                              background: barColor,
                              transition: 'width 0.4s ease',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {clubBudget.notes && (
                  <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--text-secondary)', fontStyle: 'italic', background: 'rgba(79, 124, 130, 0.05)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    Note from Treasurer: {clubBudget.notes}
                  </div>
                )}
              </>
            ) : (
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <HiOutlineExclamation style={{ fontSize: '20px', color: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                  No monthly budget allocation has been set for <strong>{user?.clubName || 'your club'}</strong> by the Treasurer yet. Once allocated, cleared reimbursements will automatically debit from here.
                </span>
              </div>
            )}
          </div>
        )}

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
            <>
              {renderFilterBar()}
              
              {filteredClaims.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <HiOutlineXCircle className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
                  <h3 className="empty-state-title">No matching claims</h3>
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
                        <th>Date</th>
                        <th>Committee</th>
                        <th>Event</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim) => (
                        <tr key={claim.id}>
                          <td>{new Date(claim.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                          <td className="cell-bold">{claim.committee}</td>
                          <td>{claim.event}</td>
                          <td className="cell-amount">₹{claim.amount.toLocaleString('en-IN')}</td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <span className={`status-badge ${claim.status.toLowerCase().replace('_', '-')}`}>
                                <span className="status-dot" />
                                {STATUS_LABELS[claim.status] || claim.status}
                              </span>
                              {claim.isPaid && (
                                <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 7px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', color: '#10b981', display: 'inline-flex', alignItems: 'center', gap: '3px', width: 'fit-content' }}>
                                  ✅ Paid{claim.paidAt ? ` · ${new Date(claim.paidAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}` : ''}
                                </span>
                              )}
                            </div>
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
                              <button
                                className="btn-action-icon"
                                onClick={() => handleOpenCertificate(claim.id)}
                                title="Sanction Certificate & Cryptographic Trail"
                                id={`cert-${claim.id}`}
                                style={{ color: '#2a9d6e' }}
                              >
                                <TbCertificate style={{ fontSize: '18px' }} />
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
                <button
                  className="btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  onClick={() => handleOpenCertificate(selectedClaim.id)}
                  title="View Official Sanction Certificate"
                  id="modal-btn-certificate"
                >
                  <TbCertificate style={{ fontSize: '16px', color: 'var(--success)' }} />
                  Sanction Certificate
                </button>
                <button className="modal-close-btn" onClick={() => setSelectedClaim(null)}>
                  <HiOutlineX />
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <span className="detail-label">Status</span>
                <span className="detail-value" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
                  <span className={`status-badge ${selectedClaim.status.toLowerCase().replace('_', '-')}`}>
                    <span className="status-dot" />
                    {STATUS_LABELS[selectedClaim.status] || selectedClaim.status}
                  </span>
                  {selectedClaim.isPaid && (
                    <span style={{ fontSize: '12px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>
                      ✅ Payment Disbursed
                    </span>
                  )}
                </span>
              </div>
              {selectedClaim.isPaid && selectedClaim.paidAt && (
                <div className="detail-row">
                  <span className="detail-label">Payment Date</span>
                  <span className="detail-value" style={{ color: '#10b981', fontWeight: 600 }}>
                    {new Date(selectedClaim.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {selectedClaim.isPaid && selectedClaim.paymentReference && (
                <div className="detail-row">
                  <span className="detail-label">Payment Ref / UTR</span>
                  <span className="detail-value" style={{ fontFamily: 'monospace', fontSize: '13px' }}>
                    {selectedClaim.paymentReference}
                  </span>
                </div>
              )}
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

      {/* ── Projection Submission Modal ── */}
      {showProjectionModal && (
        <div className="details-modal-overlay" onClick={() => setShowProjectionModal(false)}>
          <div
            className="details-modal-card"
            style={{ maxWidth: '680px', width: '95vw' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">
                <HiOutlineCalendar style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                Submit Monthly Expense Projection
              </h3>
              <button className="modal-close-btn" onClick={() => setShowProjectionModal(false)}>
                <HiOutlineX />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.6 }}>
                Submit your club's itemised expense projections for the upcoming month.
                List each planned event with its expected cost so the Treasurer can allocate the appropriate buffer amount.
              </p>

              <form onSubmit={handleSubmitProjection} id="submit-projection-form">
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" htmlFor="proj-target-month-select">Target Month</label>
                  <input
                    id="proj-target-month-select"
                    className="form-input"
                    style={{ paddingLeft: '14px', maxWidth: '220px' }}
                    type="month"
                    value={projTargetMonth}
                    onChange={(e) => setProjTargetMonth(e.target.value)}
                    required
                  />
                </div>

                {/* Event Items */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Planned Events &amp; Expected Costs</label>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={addProjItem}
                      style={{ padding: '5px 12px', fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      id="btn-add-proj-item"
                    >
                      <HiOutlinePlus /> Add Event
                    </button>
                  </div>

                  {projItems.map((item, idx) => (
                    <div
                      key={idx}
                      style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)', padding: '14px 16px', marginBottom: '10px', position: 'relative' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Event #{idx + 1}</span>
                        {projItems.length > 1 && (
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => removeProjItem(idx)}
                            title="Remove event"
                          >
                            <HiOutlineTrash />
                          </button>
                        )}
                      </div>
                      <div className="form-row-grid" style={{ gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor={`proj-event-${idx}`}>Event Name *</label>
                          <input
                            id={`proj-event-${idx}`}
                            className="form-input"
                            style={{ paddingLeft: '12px' }}
                            type="text"
                            placeholder="e.g. Annual Fest Workshop"
                            value={item.eventName}
                            onChange={(e) => updateProjItem(idx, 'eventName', e.target.value)}
                            required
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor={`proj-amount-${idx}`}>Expected Amount (₹) *</label>
                          <input
                            id={`proj-amount-${idx}`}
                            className="form-input"
                            style={{ paddingLeft: '12px' }}
                            type="number"
                            min="1"
                            placeholder="e.g. 5000"
                            value={item.expectedAmount}
                            onChange={(e) => updateProjItem(idx, 'expectedAmount', e.target.value)}
                            required
                          />
                        </div>
                      </div>
                      <div className="form-row-grid" style={{ gap: '12px', marginTop: '10px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor={`proj-desc-${idx}`}>Description</label>
                          <input
                            id={`proj-desc-${idx}`}
                            className="form-input"
                            style={{ paddingLeft: '12px' }}
                            type="text"
                            placeholder="Brief description (optional)"
                            value={item.description}
                            onChange={(e) => updateProjItem(idx, 'description', e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor={`proj-date-${idx}`}>Tentative Date</label>
                          <input
                            id={`proj-date-${idx}`}
                            className="form-input"
                            style={{ paddingLeft: '12px' }}
                            type="date"
                            value={item.tentativeDate}
                            onChange={(e) => updateProjItem(idx, 'tentativeDate', e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Total */}
                  <div style={{ textAlign: 'right', fontSize: '14px', fontWeight: 700, color: 'var(--wc-200)', padding: '8px 0' }}>
                    Total Projected: ₹{projItems.reduce((sum, item) => sum + (parseFloat(item.expectedAmount) || 0), 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowProjectionModal(false)} disabled={submittingProjection}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submittingProjection} id="btn-submit-projection-confirm">
                    {submittingProjection ? <><span className="btn-spinner" /> Submitting…</> : 'Submit Projection'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Sanction Certificate Viewer Modal ── */}
      <SanctionCertificateModal
        isOpen={certModal.open}
        onClose={() => setCertModal({ open: false, certificate: null, loading: false })}
        certificate={certModal.certificate}
        loading={certModal.loading}
      />
    </div>
  );
}

export default UserDashboard;
