import api from './api';

// Create a new reimbursement claim (FormData contains fields and receipt file)
export const createReimbursement = async (formData) => {
  const response = await api.post('/user/reimbursements', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

// Retrieve all reimbursement claims for the authenticated user
export const getMyReimbursements = async () => {
  const response = await api.get('/user/reimbursements');
  return response.data;
};

// Retrieve details for a specific reimbursement claim
export const getReimbursementDetails = async (id) => {
  const response = await api.get(`/user/reimbursements/${id}`);
  return response.data;
};

// Cancel a PENDING or QUERY_RAISED reimbursement
export const cancelReimbursement = async (id) => {
  const response = await api.post(`/user/reimbursements/${id}/cancel`);
  return response.data;
};

// Resubmit a QUERY_RAISED reimbursement with an optional remark
export const resubmitReimbursement = async (id, remark = '') => {
  const response = await api.post(`/user/reimbursements/${id}/resubmit`, { remark });
  return response.data;
};

// Get the activity log for a specific reimbursement (owner only)
export const getReimbursementActivityLog = async (id) => {
  const response = await api.get(`/user/reimbursements/${id}/activity`);
  return response.data;
};

// ── Bills ──────────────────────────────────────────────────────────────────────

// List all bills attached to a reimbursement
export const getBills = async (reimbursementId) => {
  const response = await api.get(`/user/reimbursements/${reimbursementId}/bills`);
  return response.data;
};

// Attach a new bill to a reimbursement (multipart/form-data)
export const attachBill = async (reimbursementId, formData) => {
  const response = await api.post(`/user/reimbursements/${reimbursementId}/bills`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// Detach a bill from a reimbursement
export const detachBill = async (reimbursementId, billId) => {
  const response = await api.delete(`/user/reimbursements/${reimbursementId}/bills/${billId}`);
  return response.data;
};

