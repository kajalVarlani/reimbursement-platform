import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../store/authSlice';
import { createReimbursement } from '../services/reimbursementService';
import {
  HiOutlineUpload,
  HiOutlineChevronLeft,
  HiOutlineTrash,
  HiOutlinePaperClip,
  HiOutlineCurrencyRupee,
  HiOutlineLogout,
  HiOutlinePlus
} from 'react-icons/hi';
import { TbFileInvoice } from 'react-icons/tb';
import toast, { Toaster } from 'react-hot-toast';
import './Dashboard.css';

const COMMITTEES = [
  'Technical Committee',
  'Cultural Committee',
  'Sports Committee',
  'Literary Committee',
  'Finance Committee',
  'Alumni Relations Committee',
  'Other / Departmental'
];

function SubmitReimbursement() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
    toast.success('Logged out successfully');
  };

  const [committee, setCommittee] = useState('');
  const [event, setEvent] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Multiple bills state
  const [bills, setBills] = useState([
    {
      amount: '',          // Total Bill Amount
      allocatedAmount: '', // Claimed Amount
      vendorName: '',
      invoiceNumber: '',
      transactionId: '',
      billDate: '',
      file: null,
      dragActive: false,
    }
  ]);

  const updateBillField = (index, field, value) => {
    setBills((prev) => {
      const newBills = [...prev];
      newBills[index] = { ...newBills[index], [field]: value };
      return newBills;
    });
  };

  const addBill = () => {
    setBills((prev) => [
      ...prev,
      {
        amount: '',
        allocatedAmount: '',
        vendorName: '',
        invoiceNumber: '',
        transactionId: '',
        billDate: '',
        file: null,
        dragActive: false,
      }
    ]);
  };

  const removeBill = (index) => {
    if (bills.length <= 1) return;
    setBills((prev) => prev.filter((_, idx) => idx !== index));
  };

  // File drag & drop handlers
  const handleDrag = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      updateBillField(index, 'dragActive', true);
    } else if (e.type === 'dragleave') {
      updateBillField(index, 'dragActive', false);
    }
  };

  const handleDrop = (index, e) => {
    e.preventDefault();
    e.stopPropagation();
    updateBillField(index, 'dragActive', false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        updateBillField(index, 'file', selectedFile);
      }
    }
  };

  const handleFileChange = (index, e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        updateBillField(index, 'file', selectedFile);
      }
    }
  };

  const validateFile = (selectedFile) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      toast.error('Please upload a PDF, PNG, JPG, or JPEG file');
      return false;
    }
    const isUnderLimit = selectedFile.size <= 10 * 1024 * 1024; // 10MB limit
    if (!isUnderLimit) {
      toast.error('File size must be under 10MB');
      return false;
    }
    return true;
  };

  const removeFile = (index) => {
    updateBillField(index, 'file', null);
  };

  const totalReimbursementAmount = bills.reduce((sum, bill) => {
    const amt = parseFloat(bill.allocatedAmount);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!committee || !event) {
      toast.error('Committee and Event are required');
      return;
    }

    // Validate all bills
    for (let i = 0; i < bills.length; i++) {
      const bill = bills[i];
      if (!bill.amount || !bill.allocatedAmount || !bill.file) {
        toast.error(`Please complete all required fields and upload a receipt for Bill #${i + 1}`);
        return;
      }
      
      const amt = parseFloat(bill.amount);
      const allocated = parseFloat(bill.allocatedAmount);

      if (isNaN(amt) || amt <= 0) {
        toast.error(`Please enter a valid Total Amount for Bill #${i + 1}`);
        return;
      }

      if (isNaN(allocated) || allocated <= 0) {
        toast.error(`Please enter a valid Claimed Amount for Bill #${i + 1}`);
        return;
      }

      if (allocated > amt) {
        toast.error(`Claimed Amount cannot exceed Total Bill Amount for Bill #${i + 1}`);
        return;
      }
    }

    setSubmitting(true);
    const toastId = toast.loading('Submitting reimbursement claim…');

    try {
      const formData = new FormData();
      formData.append('committee', committee);
      formData.append('event', event);
      formData.append('description', description);
      formData.append('amount', totalReimbursementAmount.toString());

      // Prepare metadata for bills (removing file/drag drop states)
      const billsMetadata = bills.map((bill) => ({
        amount: parseFloat(bill.amount),
        allocatedAmount: parseFloat(bill.allocatedAmount),
        vendorName: bill.vendorName,
        invoiceNumber: bill.invoiceNumber,
        transactionId: bill.transactionId,
        billDate: bill.billDate,
      }));
      formData.append('bills', JSON.stringify(billsMetadata));

      // Append receipt files in the same order
      bills.forEach((bill) => {
        formData.append('receipts', bill.file);
      });

      await createReimbursement(formData);

      toast.success('Reimbursement claim submitted successfully!', { id: toastId });
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      console.error(err);
      toast.error(
        err.response?.data?.message || 'Failed to submit claim. Please try again.',
        { id: toastId }
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dashboard-container">
      <Toaster position="top-right" />

      {/* ── Header ── */}
      <header className="dashboard-header">
        <div className="header-brand" onClick={() => navigate('/dashboard')} style={{ cursor: 'pointer' }}>
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

      {/* ── Main Form Area ── */}
      <main className="dashboard-main animate-fade-in-up">
        {/* Title Bar */}
        <div className="section-header">
          <button
            className="btn-secondary"
            onClick={() => navigate('/dashboard')}
            style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px' }}
            id="btn-back-to-dashboard"
          >
            <HiOutlineChevronLeft />
            Back to Dashboard
          </button>
        </div>

        <div className="form-card">
          <div className="login-form-header" style={{ marginBottom: '28px' }}>
            <h2 className="login-form-title" style={{ fontSize: '24px' }}>Submit Claim</h2>
            <p className="login-form-subtitle">Create a new reimbursement request. Add one or multiple bills with their details.</p>
          </div>

          <form className="reimbursement-form" onSubmit={handleSubmit} id="submit-reimbursement-form">
            <div className="form-row-grid">
              {/* Committee selection */}
              <div className="form-group">
                <label className="form-label" htmlFor="select-committee">
                  Committee
                </label>
                <select
                  id="select-committee"
                  className="form-select"
                  value={committee}
                  onChange={(e) => setCommittee(e.target.value)}
                  required
                >
                  <option value="" disabled>Select Committee</option>
                  {COMMITTEES.map((comm) => (
                    <option key={comm} value={comm}>{comm}</option>
                  ))}
                </select>
              </div>

              {/* Event Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="input-event">
                  Event / Project Name
                </label>
                <input
                  id="input-event"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="text"
                  placeholder="e.g. Annual Symposium"
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-description">
                Overall Description
              </label>
              <input
                id="input-description"
                className="form-input"
                style={{ paddingLeft: '14px' }}
                type="text"
                placeholder="Briefly state overall claim details"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Bills Section Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Bills &amp; Receipts</h3>
            </div>

            {/* List of bills */}
            {bills.map((bill, index) => (
              <div key={index} style={{ border: '1px solid var(--wc-100)', borderRadius: '12px', padding: '20px', marginBottom: '24px', background: 'var(--card-bg-subtle, #f9fafb)', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--wc-100)', paddingBottom: '10px' }}>
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main, #111827)' }}>Bill #{index + 1}</span>
                  {bills.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBill(index)}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--danger, #ef4444)', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}
                    >
                      <HiOutlineTrash /> Remove Bill
                    </button>
                  )}
                </div>

                <div className="form-row-grid">
                  {/* Total Bill Amount */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-amount-${index}`}>
                      Total Bill Amount (INR) <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div className="form-input-wrapper">
                      <input
                        id={`bill-amount-${index}`}
                        className="form-input"
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="Total on receipt"
                        value={bill.amount}
                        onChange={(e) => updateBillField(index, 'amount', e.target.value)}
                        required
                      />
                      <HiOutlineCurrencyRupee className="form-input-icon" />
                    </div>
                  </div>

                  {/* Claimed Amount */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-claimed-${index}`}>
                      Claimed Amount (INR) <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <div className="form-input-wrapper">
                      <input
                        id={`bill-claimed-${index}`}
                        className="form-input"
                        type="number"
                        step="0.01"
                        min="1"
                        placeholder="Amount to claim"
                        value={bill.allocatedAmount}
                        onChange={(e) => updateBillField(index, 'allocatedAmount', e.target.value)}
                        required
                      />
                      <HiOutlineCurrencyRupee className="form-input-icon" />
                    </div>
                  </div>
                </div>

                <div className="form-row-grid">
                  {/* Vendor Name */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-vendor-${index}`}>
                      Vendor Name
                    </label>
                    <input
                      id={`bill-vendor-${index}`}
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="text"
                      placeholder="e.g. Amazon"
                      value={bill.vendorName}
                      onChange={(e) => updateBillField(index, 'vendorName', e.target.value)}
                    />
                  </div>

                  {/* Invoice Number */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-invoice-${index}`}>
                      Invoice Number
                    </label>
                    <input
                      id={`bill-invoice-${index}`}
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="text"
                      placeholder="e.g. INV-102"
                      value={bill.invoiceNumber}
                      onChange={(e) => updateBillField(index, 'invoiceNumber', e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row-grid">
                  {/* Transaction ID */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-transaction-${index}`}>
                      Transaction ID
                    </label>
                    <input
                      id={`bill-transaction-${index}`}
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="text"
                      placeholder="e.g. TXN-UPI-987"
                      value={bill.transactionId}
                      onChange={(e) => updateBillField(index, 'transactionId', e.target.value)}
                    />
                  </div>

                  {/* Bill Date */}
                  <div className="form-group">
                    <label className="form-label" htmlFor={`bill-date-${index}`}>
                      Bill Date
                    </label>
                    <input
                      id={`bill-date-${index}`}
                      className="form-input"
                      style={{ paddingLeft: '14px' }}
                      type="date"
                      value={bill.billDate}
                      onChange={(e) => updateBillField(index, 'billDate', e.target.value)}
                    />
                  </div>
                </div>

                {/* Scanned File Upload */}
                <div className="form-group" style={{ marginTop: '16px' }}>
                  <label className="form-label">
                    Receipt Scan Upload <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>

                  {!bill.file ? (
                    <div
                      className={`file-upload-zone ${bill.dragActive ? 'drag-active' : ''}`}
                      onDragEnter={(e) => handleDrag(index, e)}
                      onDragOver={(e) => handleDrag(index, e)}
                      onDragLeave={(e) => handleDrag(index, e)}
                      onDrop={(e) => handleDrop(index, e)}
                      onClick={() => document.getElementById(`receipt-upload-input-${index}`).click()}
                      style={{ padding: '24px', cursor: 'pointer' }}
                    >
                      <input
                        id={`receipt-upload-input-${index}`}
                        type="file"
                        style={{ display: 'none' }}
                        accept="image/jpeg,image/jpg,image/png,application/pdf"
                        onChange={(e) => handleFileChange(index, e)}
                      />
                      <HiOutlineUpload className="upload-icon" style={{ fontSize: '24px', marginBottom: '8px' }} />
                      <span className="upload-title" style={{ fontSize: '13.5px' }}>Drag &amp; drop receipt scan here</span>
                      <span className="upload-subtitle" style={{ fontSize: '11px' }}>or click to browse (PDF/PNG/JPG/JPEG, max 10MB)</span>
                    </div>
                  ) : (
                    <div className="file-preview-box" style={{ padding: '12px' }}>
                      <HiOutlinePaperClip className="file-preview-icon" />
                      <div className="file-preview-info">
                        <div className="file-name" style={{ fontSize: '13px' }}>{bill.file.name}</div>
                        <div className="file-size" style={{ fontSize: '11px' }}>{(bill.file.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                      <button type="button" className="btn-remove-file" onClick={() => removeFile(index)} title="Remove file">
                        <HiOutlineTrash />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Total Claim Summary & Add Bill Action */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '24px 0', padding: '16px 20px', background: 'rgba(79, 124, 130, 0.08)', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}>
              <div>
                <span style={{ display: 'block', fontSize: '13px', color: 'var(--text-muted)' }}>Total Claimed Reimbursement Amount</span>
                <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-main, #111827)' }}>
                  ₹{totalReimbursementAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={addBill}
                style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600 }}
              >
                <HiOutlinePlus /> Add Another Bill
              </button>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => navigate('/dashboard')}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={submitting}
                id="btn-submit-claim"
              >
                {submitting ? 'Submitting...' : 'Submit Claim'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default SubmitReimbursement;
