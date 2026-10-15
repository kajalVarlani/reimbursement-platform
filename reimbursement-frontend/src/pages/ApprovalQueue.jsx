import { useState, useEffect, useCallback, useMemo } from 'react';
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
  getBufferStatus,
  exportTreasurerMonthlyIndent,
  getIndentSummary,
  topUpBuffer,
  getSignatureAuditCertificate,
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
  HiOutlineDocumentDownload,
  HiOutlinePlus,
} from 'react-icons/hi';
import { TbFileInvoice, TbShieldCheck, TbCertificate } from 'react-icons/tb';
import SignaturePadModal from '../components/SignaturePadModal';
import SanctionCertificateModal from '../components/SanctionCertificateModal';
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

  const canActOnClaim = (claim) => {
    if (!claim || (claim.status !== 'PENDING' && claim.status !== 'QUERY_RAISED')) return false;
    if (role === 'FACULTY_MENTOR') {
      return claim.currentStage === 'FACULTY_MENTOR';
    }
    if (role === 'SUPER_ADMIN') {
      return claim.currentStage === 'TREASURER' || claim.currentStage === 'ACCOUNTANT_REVIEW';
    }
    if (role === 'ACCOUNTANT') {
      return (claim.currentStage === 'TREASURER' || claim.currentStage === 'ACCOUNTANT_REVIEW') && claim.routedToAccountant;
    }
    if (role === 'DEAN_STUDENTS') {
      return claim.currentStage === 'DEAN_STUDENTS';
    }
    return false;
  };

  const canMarkPaid = (claim) => {
    if (!claim || claim.status !== 'APPROVED' || claim.isPaid) return false;
    if (role === 'SUPER_ADMIN') {
      // In post-event accountant flow, treasurer can confirm once accountant marks paid
      if (claim.routedToAccountant || !claim.withinBuffer) {
        return Boolean(claim.accountantPaid);
      }
      return true;
    }
    if (role === 'ACCOUNTANT') {
      return (claim.routedToAccountant || !claim.withinBuffer) && !claim.accountantPaid;
    }
    return false;
  };

  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedClaim, setSelectedClaim] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  // Treasurer advance buffer state
  const [bufferStatus, setBufferStatus] = useState(null);
  const [exportingIndent, setExportingIndent] = useState(false);

  // Indent Generator Modal state
  const [showIndentModal, setShowIndentModal] = useState(false);
  const [indentMonth, setIndentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [indentSummary, setIndentSummary] = useState(null);
  const [loadingIndent, setLoadingIndent] = useState(false);

  // Quick Top-up Modal state
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpNotes, setTopUpNotes] = useState('');
  const [toppingUp, setToppingUp] = useState(false);

  // Digital signature approval modal state
  const [signatureModal, setSignatureModal] = useState({
    open: false,
    claim: null,
    processing: false,
  });

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
  const [committeeFilter, setCommitteeFilter] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');

  const resetFilters = () => {
    setSearchTerm('');
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
        const matchesUser = claim.user?.name?.toLowerCase().includes(term) || claim.user?.email?.toLowerCase().includes(term);
        const matchesEvent = claim.event?.toLowerCase().includes(term);
        const matchesCommittee = claim.committee?.toLowerCase().includes(term);
        const matchesDesc = claim.description?.toLowerCase().includes(term);
        const matchesAmount = String(claim.amount).includes(term);
        if (!matchesUser && !matchesEvent && !matchesCommittee && !matchesDesc && !matchesAmount) {
          return false;
        }
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
  }, [claims, searchTerm, committeeFilter, minAmount, maxAmount]);

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
          placeholder="Search by submitter, event, committee, amount..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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

      {(searchTerm || committeeFilter || minAmount || maxAmount) && (
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

  const fetchBuffer = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const data = await getBufferStatus();
      setBufferStatus(data);
    } catch (e) {
      console.error('Failed to load buffer status', e);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchQueue();
    fetchBuffer();
  }, [fetchQueue, fetchBuffer]);

  const loadIndentSummary = useCallback(async (month) => {
    setLoadingIndent(true);
    try {
      const summary = await getIndentSummary(month);
      setIndentSummary(summary);
    } catch (e) {
      console.error('Failed to load indent summary', e);
    } finally {
      setLoadingIndent(false);
    }
  }, []);

  const handleDownloadIndent = async () => {
    setExportingIndent(true);
    const toastId = toast.loading(`Generating official indent for ${indentMonth}…`);
    try {
      await exportTreasurerMonthlyIndent(indentMonth);
      toast.success('Official Indent (.xlsx) downloaded successfully!', { id: toastId });
      await fetchBuffer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to export indent', { id: toastId });
    } finally {
      setExportingIndent(false);
    }
  };

  const handleQuickTopUp = async (e) => {
    e.preventDefault();
    if (!topUpAmount || parseFloat(topUpAmount) <= 0) {
      toast.error('Please enter a valid top-up amount');
      return;
    }
    setToppingUp(true);
    const toastId = toast.loading('Adding buffer top-up…');
    try {
      await topUpBuffer({ amount: parseFloat(topUpAmount), notes: topUpNotes });
      toast.success(`Buffer topped up by ₹${parseFloat(topUpAmount).toLocaleString('en-IN')}!`, { id: toastId });
      setShowTopUpModal(false);
      setTopUpAmount('');
      setTopUpNotes('');
      await fetchBuffer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to top up buffer', { id: toastId });
    } finally {
      setToppingUp(false);
    }
  };

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
    const claim = claims.find((c) => c.id === claimId);
    if (action === 'approve') {
      setSignatureModal({
        open: true,
        claim,
        processing: false,
      });
      return;
    }
    setConfirmModal({
      open: true,
      action,
      claimId,
      claim,
      remark: '',
      paymentReference: '',
      notes: '',
      processing: false,
    });
  };

  const handleSignedApprove = async (signatureDataUrl, remark) => {
    const claim = signatureModal.claim;
    if (!claim) return;
    setSignatureModal((prev) => ({ ...prev, processing: true }));
    const toastId = toast.loading('Signing & approving claim with cryptographic seal…');
    try {
      await approveReimbursement(claim.id, {
        remark,
        signatureImageUrl: signatureDataUrl,
      });
      toast.success('Claim approved & digitally signed with HMAC-SHA256 seal!', { id: toastId });
      setSignatureModal({ open: false, claim: null, processing: false });
      setSelectedClaim(null);
      await fetchQueue();
      if (isSuperAdmin) await fetchBuffer();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Approval failed. Please try again.', { id: toastId });
      setSignatureModal((prev) => ({ ...prev, processing: false }));
    }
  };

  const closeConfirm = () => {
    if (confirmModal.processing) return;
    setConfirmModal({
      open: false,
      action: null,
      claimId: null,
      claim: null,
      remark: '',
      paymentReference: '',
      notes: '',
      processing: false,
    });
  };

  const handleConfirmAction = async () => {
    const { action, claimId, remark, paymentReference, notes } = confirmModal;
    setConfirmModal((prev) => ({ ...prev, processing: true }));
    const loadingMessages = {
      approve: 'Approving claim…',
      reject: 'Rejecting claim…',
      query: 'Raising query…',
      'mark-paid': 'Disbursing & marking as paid…',
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
        await markAsPaid(claimId, { paymentReference, notes });
        toast.success('Reimbursement payment marked as disbursed!', { id: toastId });
      }
      setConfirmModal({
        open: false,
        action: null,
        claimId: null,
        claim: null,
        remark: '',
        paymentReference: '',
        notes: '',
        processing: false,
      });
      setSelectedClaim(null);
      await fetchQueue();
      if (isSuperAdmin) await fetchBuffer();
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
  // A claim is active/pending in the queue if it has not yet been disbursed (isPaid: false) and is not cancelled/rejected
  const isPendingClaim = (c) => !c.isPaid && c.status !== 'REJECTED' && c.status !== 'CANCELLED';
  const pendingCount = claims.filter(isPendingClaim).length;
  // Partially approved: in-flight claim that has received at least one stage approval
  const partiallyApprovedCount = claims.filter(c => isPendingClaim(c) && c.approvals?.some(a => a.status === 'APPROVED')).length;
  const approvedCount = claims.filter(c => c.status === 'APPROVED').length;
  const paidCount = claims.filter(c => c.isPaid).length;
  const pendingAmount = claims.filter(isPendingClaim).reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalAmount = claims.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalPaidAmount = claims.filter(c => c.isPaid).reduce((sum, c) => sum + (c.amount || 0), 0);

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
                {role === 'SUPER_ADMIN' ? 'Treasurer (Super Admin)' :
                 role === 'FACULTY_MENTOR' ? 'Faculty Mentor' :
                 role === 'DEAN_STUDENTS' ? 'Dean Students' :
                 role === 'ACCOUNTANT' ? 'Central Accountant' : 'Administrator'}
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

        {/* ── Treasurer Advance Buffer & Indent Card (Super Admin) ── */}
        {isSuperAdmin && bufferStatus && (
          <div
            id="treasurer-buffer-banner"
            style={{
              background: 'linear-gradient(135deg, rgba(79, 124, 130, 0.08) 0%, rgba(240, 248, 250, 0.6) 100%)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px 24px',
              marginBottom: '22px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.03)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(79, 124, 130, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--wc-300)', fontSize: '24px' }}>
                  <HiOutlineCurrencyRupee />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                      Treasurer Advance Buffer — {bufferStatus.currentMonth}
                    </h3>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px', background: 'var(--wc-100)', color: 'var(--wc-400)', textTransform: 'uppercase' }}>
                      Super Admin
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: bufferStatus.currentBalance <= 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)',
                      color: bufferStatus.currentBalance <= 0 ? '#ef4444' : '#10b981',
                    }}>
                      {bufferStatus.currentBalance <= 0 ? 'Buffer Exhausted' : 'Active & Surplus Available'}
                    </span>
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Immediate student & vendor payouts. Direct buffer debit upon payment mark-off.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  className="btn-secondary"
                  onClick={() => setShowTopUpModal(true)}
                  style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '5px' }}
                  id="btn-treasurer-topup-buffer"
                >
                  <HiOutlinePlus /> Top-Up
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/admin/manage')}
                  style={{ padding: '8px 14px', fontSize: '13px' }}
                  id="btn-treasurer-manage-buffer"
                >
                  Manage Buffer &amp; Budgets
                </button>
                <button
                  className="btn-primary"
                  onClick={() => {
                    setShowIndentModal(true);
                    loadIndentSummary(indentMonth);
                  }}
                  style={{ padding: '8px 18px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  id="btn-treasurer-export-indent"
                >
                  <HiOutlineDocumentDownload style={{ fontSize: '16px' }} />
                  Generate Indent (.xlsx)
                </button>
              </div>
            </div>

            {/* Quick 3 Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '16px' }}>
              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Advance</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                  ₹{bufferStatus.monthlyAdvance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Allocated for {bufferStatus.currentMonth}</div>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Available Balance</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: bufferStatus.currentBalance < 10000 ? '#ef4444' : '#10b981', marginTop: '2px' }}>
                  ₹{bufferStatus.currentBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Remaining for payouts</div>
              </div>

              <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disbursed from Buffer</div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--wc-200)', marginTop: '2px' }}>
                  ₹{Math.max(0, bufferStatus.monthlyAdvance - bufferStatus.currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>Total debited claims</div>
              </div>
            </div>

            {/* Buffer Progress Bar */}
            <div style={{ marginTop: '14px' }}>
              {(() => {
                const spent = Math.max(0, bufferStatus.monthlyAdvance - bufferStatus.currentBalance);
                const percent = bufferStatus.monthlyAdvance > 0
                  ? Math.min(100, Math.round((spent / bufferStatus.monthlyAdvance) * 100))
                  : 0;
                const color = percent >= 90 ? '#ef4444' : percent >= 70 ? '#f59e0b' : '#10b981';

                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span>Buffer Disbursed: ₹{spent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      <span style={{ fontWeight: 700, color }}>{percent}% Utilized</span>
                    </div>
                    <div style={{ height: '7px', background: 'var(--border-lighter, #e5e7eb)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ width: `${percent}%`, height: '100%', background: color, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

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
                  {partiallyApprovedCount}
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
                ₹{(isSuperAdmin && !statusFilter ? totalAmount : pendingAmount).toLocaleString('en-IN')}
              </span>
              <span className="metric-label">{isSuperAdmin && !statusFilter ? 'Total Value' : 'Total Amount Pending'}</span>
            </div>
          </div>
          {isSuperAdmin && (
            <div className="metric-card">
              <div className="metric-icon-box approved">
                <HiOutlineCurrencyRupee />
              </div>
              <div className="metric-info">
                <span className="metric-value" style={{ fontSize: '18px' }}>
                  ₹{totalPaidAmount.toLocaleString('en-IN')}
                </span>
                <span className="metric-label">Disbursed ({paidCount} claims)</span>
              </div>
            </div>
          )}
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
            <>
              {renderFilterBar()}
              
              {filteredClaims.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 20px' }}>
                  <HiOutlineClock className="empty-state-icon" style={{ color: 'var(--text-muted)' }} />
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
                        <th>Submitted By</th>
                        <th>Committee</th>
                        <th>Event</th>
                        <th>Amount</th>
                        <th>{isSuperAdmin ? 'Status' : 'Priority Level'}</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClaims.map((claim) => (
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
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span>{claim.event}</span>
                              {claim.bills?.some((rb) => rb.conflicts?.some((c) => ['APPROVED', 'PENDING', 'QUERY_RAISED'].includes(c.status))) && (
                                <span className="duplicate-badge-table" title="At least one bill in this claim is also attached to another active or approved claim">
                                  ⚠️ Duplicate Bill
                                </span>
                              )}
                            </div>
                          </td>
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
                              <button
                                className="btn-action-icon"
                                onClick={() => handleOpenCertificate(claim.id)}
                                title="Sanction Certificate & Cryptographic Trail"
                                id={`btn-cert-${claim.id}`}
                                style={{ color: '#2a9d6e' }}
                              >
                                <TbCertificate style={{ fontSize: '18px' }} />
                              </button>
                              {/* Admin actions if authorized at this stage */}
                              {canActOnClaim(claim) && (
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
                              {/* Stage indicator if claim is pending another stage */}
                              {!canActOnClaim(claim) && (claim.status === 'PENDING' || claim.status === 'QUERY_RAISED') && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(79, 124, 130, 0.08)',
                                  color: 'var(--text-secondary)',
                                  fontWeight: 600,
                                }}>
                                  ⏳ Awaiting {
                                    claim.currentStage === 'FACULTY_MENTOR' ? 'Faculty Mentor' :
                                    claim.currentStage === 'TREASURER' ? 'Treasurer' :
                                    claim.currentStage === 'ACCOUNTANT_REVIEW' ? 'Accountant' :
                                    claim.currentStage === 'DEAN_STUDENTS' ? 'Dean Students' : claim.currentStage
                                  }
                                </span>
                              )}
                              {/* Mark as paid on APPROVED claims */}
                              {canMarkPaid(claim) && (
                                <button
                                  className="btn-action-approve"
                                  onClick={() => openConfirm('mark-paid', claim.id)}
                                  title={role === 'ACCOUNTANT' ? 'Mark Paid (Accountant)' : 'Confirm & Mark Paid (Treasurer)'}
                                  id={`btn-mark-paid-${claim.id}`}
                                >
                                  <HiOutlineCurrencyRupee />
                                  {role === 'ACCOUNTANT' ? 'Mark Paid' : (claim.accountantPaid ? 'Confirm & Mark Paid' : 'Mark Paid')}
                                </button>
                              )}
                              {!claim.isPaid && claim.accountantPaid && role === 'ACCOUNTANT' && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(59, 130, 246, 0.1)',
                                  color: '#2563eb',
                                  fontWeight: 600,
                                }}>
                                  ✓ Paid (Loopback to Treasurer)
                                </span>
                              )}
                              {!claim.isPaid && claim.status === 'APPROVED' && (claim.routedToAccountant || !claim.withinBuffer) && !claim.accountantPaid && role === 'SUPER_ADMIN' && (
                                <span style={{
                                  fontSize: '11px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: '#d97706',
                                  fontWeight: 600,
                                }}>
                                  ⏳ Awaiting Accountant Payout
                                </span>
                              )}
                              {claim.isPaid && (
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
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {/* Actions in modal on PENDING/QUERY_RAISED claims if authorized */}
                {canActOnClaim(selectedClaim) && (
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
                {/* Mark Paid action allowed for authorized roles */}
                {canMarkPaid(selectedClaim) && (
                  <button
                    className="btn-action-approve"
                    style={{ padding: '7px 14px' }}
                    onClick={() => { setSelectedClaim(null); openConfirm('mark-paid', selectedClaim.id); }}
                    id="modal-btn-mark-paid"
                  >
                    <HiOutlineCurrencyRupee /> {role === 'ACCOUNTANT' ? 'Mark Paid' : (selectedClaim.accountantPaid ? 'Confirm & Mark Paid' : 'Mark Paid')}
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
                      const hasConflict = rb.conflicts?.some((c) => ['APPROVED', 'PENDING', 'QUERY_RAISED'].includes(c.status));
                      
                      const billAmount = b.amount || 0;
                      const currentRequested = rb.allocatedAmount || 0;

                      const approvedAllocated = rb.conflicts
                        ? rb.conflicts
                            .filter((c) => c.status === 'APPROVED')
                            .reduce((sum, c) => sum + (c.allocatedAmount || 0), 0)
                        : 0;

                      const pendingAllocated = rb.conflicts
                        ? rb.conflicts
                            .filter((c) => c.status === 'PENDING' || c.status === 'QUERY_RAISED')
                            .reduce((sum, c) => sum + (c.allocatedAmount || 0), 0)
                        : 0;

                      const remainingBeforeThis = Math.max(0, billAmount - approvedAllocated);
                      const netRemaining = billAmount - (approvedAllocated + pendingAllocated + currentRequested);
                      const isOverAllocated = (approvedAllocated + pendingAllocated + currentRequested) > billAmount;

                      return (
                        <div
                          key={b.id || idx}
                          style={{
                            border: hasConflict ? '2px solid rgba(220, 75, 75, 0.45)' : '1px solid var(--wc-100)',
                            borderRadius: '10px',
                            padding: '16px',
                            background: hasConflict ? 'rgba(220, 75, 75, 0.01)' : 'var(--card-bg-subtle, #f9fafb)',
                            boxShadow: hasConflict ? '0 0 8px rgba(220, 75, 75, 0.05)' : 'none',
                          }}
                        >
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

                          {rb.conflicts && rb.conflicts.length > 0 && (
                            <div className="bill-conflict-box">
                              <div className="conflict-header">
                                <span>⚠️ Duplicate Bill Detected</span>
                              </div>
                              <div className="conflict-body">
                                
                                {/* Allocation Breakdown summary */}
                                <div style={{
                                  margin: '0 0 16px 0',
                                  padding: '12px',
                                  backgroundColor: '#fff',
                                  border: isOverAllocated ? '1px solid rgba(220, 75, 75, 0.3)' : '1px solid var(--wc-100)',
                                  borderRadius: '8px',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                }}>
                                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: isOverAllocated ? '#bc3535' : 'var(--primary)', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}>
                                    📊 Bill Allocation Summary
                                  </h4>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px 16px', fontSize: '12.5px', marginBottom: '10px' }}>
                                    <div>
                                      <span style={{ color: 'var(--text-muted)' }}>Total Bill Value:</span>
                                      <strong style={{ marginLeft: '6px' }}>₹{billAmount.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--text-muted)' }}>Requested in this Claim:</span>
                                      <strong style={{ marginLeft: '6px', color: 'var(--primary)' }}>₹{currentRequested.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--text-muted)' }}>Approved in other Claims:</span>
                                      <strong style={{ marginLeft: '6px', color: 'var(--success)' }}>₹{approvedAllocated.toLocaleString('en-IN')}</strong>
                                    </div>
                                    <div>
                                      <span style={{ color: 'var(--text-muted)' }}>Pending in other Claims:</span>
                                      <strong style={{ marginLeft: '6px', color: '#c98218' }}>₹{pendingAllocated.toLocaleString('en-IN')}</strong>
                                    </div>
                                  </div>
                                  
                                  <div style={{
                                    paddingTop: '10px',
                                    borderTop: '1px dashed var(--wc-100)',
                                    fontSize: '13px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                      <span style={{ color: 'var(--text-muted)' }}>Max amount remaining that can be claimed:</span>
                                      <strong style={{ color: remainingBeforeThis <= 0 ? '#bc3535' : 'var(--text-primary)' }}>
                                        ₹{remainingBeforeThis.toLocaleString('en-IN')}
                                      </strong>
                                    </div>
                                    
                                    {isOverAllocated ? (
                                      <div style={{
                                        marginTop: '6px',
                                        color: '#bc3535',
                                        background: 'rgba(220, 75, 75, 0.05)',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        border: '1px solid rgba(220, 75, 75, 0.15)'
                                      }}>
                                        ⚠️ Over-allocated: Combined claims (₹{(approvedAllocated + pendingAllocated + currentRequested).toLocaleString('en-IN')}) exceed total bill value by ₹{((approvedAllocated + pendingAllocated + currentRequested) - billAmount).toLocaleString('en-IN')}.
                                      </div>
                                    ) : (
                                      <div style={{
                                        marginTop: '6px',
                                        color: '#1e7550',
                                        background: 'rgba(42, 157, 110, 0.05)',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        border: '1px solid rgba(42, 157, 110, 0.15)'
                                      }}>
                                        ✅ Safe: Combined claims are within the bill value. Remaining after this claim: ₹{netRemaining.toLocaleString('en-IN')}.
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <p style={{ fontSize: '13px', marginBottom: '8px', fontWeight: 600 }}>
                                  This bill is shared with {rb.conflicts.length} other claim{rb.conflicts.length > 1 ? 's' : ''}:
                                </p>
                                <ul className="conflict-list" style={{ paddingLeft: '18px', listStyleType: 'disc' }}>
                                  {rb.conflicts.map((c, cIdx) => (
                                    <li key={c.reimbursementId || cIdx} className="conflict-item" style={{ marginBottom: '6px' }}>
                                      <strong>{c.committee} &mdash; {c.event}</strong> (Claim total: ₹{c.amount.toLocaleString('en-IN')})
                                      <br />
                                      <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                                        Allocated on this bill: <strong>₹{(c.allocatedAmount || 0).toLocaleString('en-IN')}</strong>
                                      </span>
                                      <br />
                                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        Submitted by: {c.user?.name || '—'} ({c.user?.email || '—'})
                                      </span>
                                      <br />
                                      <span style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                        Status: <span className={`conflict-status ${c.status.toLowerCase().replace('_', '-')}`}>{STATUS_LABELS[c.status] || c.status}</span>
                                        {c.isUnderSameApprovalRightNow && (
                                          <span className="same-level-flag">Awaiting your approval</span>
                                        )}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
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
                      ? (role === 'ACCOUNTANT'
                          ? 'Confirm that payment has been disbursed to the beneficiary. This will loop back to the Treasurer for ledger confirmation & budget debit.'
                          : (confirmModal.claim?.accountantPaid
                              ? 'Confirm receipt of Central Accountant disbursal. This will debit the club budget and finalize the claim to COMPLETED.'
                              : 'Confirm that payment has been disbursed to the beneficiary. The submitting user will receive a confirmation email.'))
                      : 'Are you sure you want to raise a query on this claim? This will suspend the approval process and notify the user to provide clarification.'}
              </p>

              {/* ── Mark Paid Routing Info & Details ── */}
              {confirmModal.action === 'mark-paid' && (
                <div style={{ marginTop: '14px', marginBottom: '16px' }}>
                  {confirmModal.claim && (
                    <div
                      style={{
                        background: role === 'ACCOUNTANT'
                          ? 'rgba(59, 130, 246, 0.08)'
                          : confirmModal.claim.accountantPaid
                            ? 'rgba(16, 185, 129, 0.08)'
                            : 'rgba(16, 185, 129, 0.08)',
                        border: `1px solid ${
                          role === 'ACCOUNTANT'
                            ? 'rgba(59, 130, 246, 0.28)'
                            : 'rgba(16, 185, 129, 0.28)'
                        }`,
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 16px',
                        marginBottom: '16px',
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {role === 'ACCOUNTANT'
                          ? '🏦 Step 1: Central Accountant Bank Disbursal'
                          : confirmModal.claim.accountantPaid
                            ? '🏛️ Step 2 (Loopback): Treasurer Final Mark-Off & Budget Debit'
                            : '🟢 Advance Buffer Payout'}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                        {role === 'ACCOUNTANT' ? (
                          <>
                            Enter the bank transaction/UTR reference for disbursing <strong>₹{confirmModal.claim.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>. After you confirm, this claim will automatically <strong>loop back to the Treasurer</strong> for final ledger confirmation &amp; budget debit.
                          </>
                        ) : confirmModal.claim.accountantPaid ? (
                          <>
                            Central Accountant has disbursed this claim under UTR: <strong>{confirmModal.claim.accountantPaymentRef || confirmModal.paymentReference || 'N/A'}</strong>. Confirming will debit <strong>₹{confirmModal.claim.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> from the <strong>{confirmModal.claim.committee}</strong> club budget and finalize this claim as <strong>COMPLETED</strong>.
                          </>
                        ) : (
                          <>
                            Claim of <strong>₹{confirmModal.claim.amount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong> will be debited from both the <strong>Treasurer Advance Buffer</strong> and the <strong>{confirmModal.claim.committee}</strong> club budget.
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" htmlFor="payment-ref-input">
                      Payment Reference / UTR Number (Optional)
                    </label>
                    <input
                      id="payment-ref-input"
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="text"
                      placeholder="e.g. UTR / IMPS / Cheque / Cash voucher #"
                      value={confirmModal.paymentReference || ''}
                      onChange={(e) =>
                        setConfirmModal((prev) => ({ ...prev, paymentReference: e.target.value }))
                      }
                      disabled={confirmModal.processing}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="payment-notes-input">
                      Disbursal Notes / Remarks (Optional)
                    </label>
                    <input
                      id="payment-notes-input"
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="text"
                      placeholder="e.g. Direct transfer to vendor account completed"
                      value={confirmModal.notes || ''}
                      onChange={(e) =>
                        setConfirmModal((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      disabled={confirmModal.processing}
                    />
                  </div>
                </div>
              )}

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
                    role === 'ACCOUNTANT' ? 'Disburse & Loopback to Treasurer' : (confirmModal.claim?.accountantPaid ? 'Confirm & Finalize Mark Paid' : 'Confirm Mark Paid')
                  ) : (
                    'Confirm Raise Query'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ── Treasurer Official Monthly Indent Modal ── */}
      {showIndentModal && (
        <div className="details-modal-overlay" onClick={() => setShowIndentModal(false)}>
          <div
            className="details-modal-card"
            style={{ maxWidth: '850px', width: '95%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>📋</span>
                <div>
                  <h3 className="modal-title" style={{ margin: 0 }}>
                    Treasurer Monthly Indent &amp; Reconciliation
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Reconciles advance buffer disbursements, Accountant payouts, and paper bills for Dean Students.
                  </span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowIndentModal(false)}>
                <HiOutlineX />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Month Selector bar */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <label htmlFor="indent-modal-month" style={{ fontSize: '13px', fontWeight: 600 }}>Select Month:</label>
                  <input
                    id="indent-modal-month"
                    type="month"
                    className="form-input"
                    style={{ width: '160px', height: '36px', fontSize: '13px', paddingLeft: '12px' }}
                    value={indentMonth}
                    onChange={(e) => {
                      setIndentMonth(e.target.value);
                      loadIndentSummary(e.target.value);
                    }}
                  />
                  <button
                    className="btn-secondary"
                    onClick={() => loadIndentSummary(indentMonth)}
                    style={{ padding: '6px 12px', height: '36px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <HiOutlineRefresh /> Refresh
                  </button>
                </div>

                <button
                  className="btn-primary"
                  onClick={handleDownloadIndent}
                  disabled={exportingIndent}
                  style={{ padding: '8px 18px', height: '36px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                  id="btn-download-indent-xlsx"
                >
                  {exportingIndent ? <><span className="btn-spinner" /> Generating…</> : <><HiOutlineDocumentDownload style={{ fontSize: '16px' }} /> Download Official Indent (.xlsx)</>}
                </button>
              </div>

              {/* KPI Summary Cards */}
              {loadingIndent ? (
                <div style={{ padding: '36px', display: 'flex', justifyContent: 'center' }}>
                  <div className="btn-spinner" style={{ width: '32px', height: '32px', border: '3px solid rgba(79,124,130,0.2)', borderTopColor: 'var(--wc-300)' }} />
                </div>
              ) : indentSummary ? (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Monthly Advance</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                        ₹{indentSummary.monthlyAdvance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        Bal: <strong style={{ color: indentSummary.currentBalance < 10000 ? '#ef4444' : '#10b981' }}>₹{indentSummary.currentBalance?.toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Buffer Payouts</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--wc-200)', marginTop: '2px' }}>
                        ₹{indentSummary.bufferTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {indentSummary.bufferClaimsCount || 0} claims settled
                      </div>
                    </div>

                    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Central Accountant</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#3b82f6', marginTop: '2px' }}>
                        ₹{indentSummary.accountantTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {indentSummary.accountantClaimsCount || 0} routed claims
                      </div>
                    </div>

                    <div style={{ background: 'white', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Disbursed</div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#10b981', marginTop: '2px' }}>
                        ₹{indentSummary.totalDisbursed?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        {indentSummary.totalClaimsCount || 0} claims ({indentSummary.totalBills || 0} bills)
                      </div>
                    </div>
                  </div>

                  {/* Buffer Exhaustion Status Alert */}
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: '16px',
                    background: indentSummary.isBufferExhausted ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)',
                    border: `1px solid ${indentSummary.isBufferExhausted ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '13px',
                  }}>
                    <span>
                      <strong>Buffer Status for {indentSummary.targetMonth}: </strong>
                      <span style={{ color: indentSummary.isBufferExhausted ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                        {indentSummary.isBufferExhausted ? 'EXHAUSTED (0.00 Balance Remaining)' : 'SURPLUS AVAILABLE (Buffer Healthy)'}
                      </span>
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Total {indentSummary.totalBills || 0} physical bills to audit
                    </span>
                  </div>

                  {/* Reconciliation Claims Table */}
                  <h4 style={{ fontSize: '13.5px', fontWeight: 700, margin: '0 0 8px', color: 'var(--text-primary)' }}>
                    Reconciled Claims for {indentMonth} ({indentSummary.reimbursements?.length || 0})
                  </h4>
                  {indentSummary.reimbursements && indentSummary.reimbursements.length > 0 ? (
                    <div style={{ overflowX: 'auto', border: '1px solid var(--border-light)', borderRadius: 'var(--radius-sm)' }}>
                      <table className="claims-table" style={{ margin: 0, fontSize: '12.5px' }}>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Paid Date</th>
                            <th>Club / Committee</th>
                            <th>Event</th>
                            <th>Payee &amp; Mode</th>
                            <th>Channel</th>
                            <th style={{ textAlign: 'right' }}>Amount (₹)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indentSummary.reimbursements.map((r, idx) => (
                            <tr key={r.id}>
                              <td style={{ color: 'var(--text-muted)' }}>{idx + 1}</td>
                              <td>{new Date(r.paidAt).toLocaleDateString('en-IN')}</td>
                              <td className="cell-bold">{r.committee}</td>
                              <td>{r.event}</td>
                              <td>
                                <span style={{ fontWeight: 600 }}>{r.beneficiaryName || 'Beneficiary'}</span>
                                <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)' }}>
                                  {r.paymentMode} {r.paymentReference ? `• ${r.paymentReference}` : ''}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  fontSize: '11px',
                                  padding: '2px 7px',
                                  borderRadius: '10px',
                                  fontWeight: 600,
                                  background: r.fundingChannel === 'Treasurer Buffer' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                                  color: r.fundingChannel === 'Treasurer Buffer' ? '#10b981' : '#3b82f6',
                                }}>
                                  {r.fundingChannel}
                                </span>
                              </td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--wc-200)' }}>
                                ₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No cleared or disbursed reimbursement claims found for {indentMonth}.
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '14px 20px', borderTop: '1px solid var(--border-light)' }}>
              <button className="btn-secondary" onClick={() => setShowIndentModal(false)}>
                Close
              </button>
              <button
                className="btn-primary"
                onClick={handleDownloadIndent}
                disabled={exportingIndent}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {exportingIndent ? <><span className="btn-spinner" /> Generating…</> : <><HiOutlineDocumentDownload /> Download Indent (.xlsx)</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Top-Up Modal ── */}
      {showTopUpModal && (
        <div className="details-modal-overlay" onClick={() => setShowTopUpModal(false)}>
          <div
            className="details-modal-card"
            style={{ maxWidth: '420px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3 className="modal-title">Top-Up Advance Buffer</h3>
              <button className="modal-close-btn" onClick={() => setShowTopUpModal(false)}>
                <HiOutlineX />
              </button>
            </div>
            <form onSubmit={handleQuickTopUp} style={{ padding: '20px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Add funds to the Treasurer Advance Buffer for immediate reimbursement payouts. Current Balance: <strong>₹{bufferStatus?.currentBalance?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </p>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="quick-topup-amount">Top-Up Amount (₹)</label>
                <input
                  id="quick-topup-amount"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="number"
                  min="1"
                  placeholder="e.g. 15000"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '18px' }}>
                <label className="form-label" htmlFor="quick-topup-notes">Notes / Reason (Optional)</label>
                <input
                  id="quick-topup-notes"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="text"
                  placeholder="e.g. Mid-month event top-up"
                  value={topUpNotes}
                  onChange={(e) => setTopUpNotes(e.target.value)}
                />
              </div>
              <div className="form-actions" style={{ margin: 0 }}>
                <button type="button" className="btn-secondary" onClick={() => setShowTopUpModal(false)} disabled={toppingUp}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" id="btn-submit-quick-topup" disabled={toppingUp}>
                  {toppingUp ? <><span className="btn-spinner" /> Adding…</> : 'Confirm Top-Up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ── Digital Signature Modal for Approvals ── */}
      <SignaturePadModal
        isOpen={signatureModal.open}
        onClose={() => setSignatureModal({ open: false, claim: null, processing: false })}
        onConfirm={handleSignedApprove}
        title="Digitally Sign & Approve Claim"
        actionLabel="Sign & Approve"
        actionColor="#2a9d6e"
        requireRemark={false}
        remarkLabel="Approval Remark / Notes (optional)"
        remarkPlaceholder="e.g. Verified bills against cycle quota; recommended for advance approval."
        claimInfo={signatureModal.claim ? {
          committee: signatureModal.claim.committee,
          event: signatureModal.claim.event,
          amount: signatureModal.claim.amount,
        } : null}
        processing={signatureModal.processing}
      />

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

export default ApprovalQueue;
