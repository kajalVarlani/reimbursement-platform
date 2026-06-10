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
  HiOutlineLogout
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
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // File drag & drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (validateFile(selectedFile)) {
        setFile(selectedFile);
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

  const removeFile = () => {
    setFile(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!committee || !event || !amount || !file) {
      toast.error('All fields are required');
      return;
    }

    const claimAmount = parseFloat(amount);
    if (isNaN(claimAmount) || claimAmount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading('Submitting reimbursement claim…');

    try {
      const formData = new FormData();
      formData.append('committee', committee);
      formData.append('event', event);
      formData.append('amount', amount);
      formData.append('description', description);
      formData.append('receipt', file);

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
            <p className="login-form-subtitle">Create a new reimbursement request. Upload your receipt scans.</p>
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

            {/* Amount & Description */}
            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="input-amount">
                  Reimbursement Amount (INR)
                </label>
                <div className="form-input-wrapper">
                  <input
                    id="input-amount"
                    className="form-input"
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                  <HiOutlineCurrencyRupee className="form-input-icon" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="input-description">
                  Short Description
                </label>
                <input
                  id="input-description"
                  className="form-input"
                  style={{ paddingLeft: '14px' }}
                  type="text"
                  placeholder="Briefly state purchase reason"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Receipt Scanned File Upload */}
            <div className="form-group">
              <label className="form-label">
                Receipt Scan Upload
              </label>

              {!file ? (
                <div
                  className={`file-upload-zone ${dragActive ? 'drag-active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('receipt-upload-input').click()}
                  id="drag-drop-zone"
                >
                  <input
                    id="receipt-upload-input"
                    type="file"
                    style={{ display: 'none' }}
                    accept="image/jpeg,image/jpg,image/png,application/pdf"
                    onChange={handleFileChange}
                  />
                  <HiOutlineUpload className="upload-icon" />
                  <span className="upload-title">Drag &amp; drop your receipt here</span>
                  <span className="upload-subtitle">or click to browse from device (max 10MB, PDF/PNG/JPG/JPEG)</span>
                </div>
              ) : (
                <div className="file-preview-box" id="file-uploaded-preview">
                  <HiOutlinePaperClip className="file-preview-icon" />
                  <div className="file-preview-info">
                    <div className="file-name">{file.name}</div>
                    <div className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
                  </div>
                  <button type="button" className="btn-remove-file" onClick={removeFile} title="Remove file" id="btn-remove-uploaded-file">
                    <HiOutlineTrash />
                  </button>
                </div>
              )}
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
