import api from './api';

// ── Approval Queue (ADMINISTRATOR role) ──

// For regular admins: returns PENDING/QUERY_RAISED claims at their priority level.
// For SUPER_ADMIN: returns all reimbursements (with optional ?status= filter).
export const getApprovalQueue = async (status = '') => {
  const params = status ? { status } : {};
  const response = await api.get('/admin/reimbursements', { params });
  return response.data;
};

export const getApprovalHistory = async () => {
  const response = await api.get('/admin/reimbursements/history');
  return response.data;
};

export const approveReimbursement = async (id, remark = '') => {
  const response = await api.post(`/admin/reimbursements/${id}/approve`, { remark });
  return response.data;
};

export const rejectReimbursement = async (id, remark = '') => {
  const response = await api.post(`/admin/reimbursements/${id}/reject`, { remark });
  return response.data;
};

export const raiseQueryOnReimbursement = async (id, remark) => {
  const response = await api.post(`/admin/reimbursements/${id}/query`, { remark });
  return response.data;
};

// Mark an APPROVED reimbursement as paid (SUPER_ADMIN only)
export const markAsPaid = async (id) => {
  const response = await api.post(`/admin/reimbursements/${id}/mark-paid`);
  return response.data;
};

// Get the full activity log for a reimbursement (admin access)
export const getApprovalActivityLog = async (id) => {
  const response = await api.get(`/admin/reimbursements/${id}/activity`);
  return response.data;
};

// SUPER_ADMIN global audit: all reimbursements with optional status filter
export const listAllReimbursements = async (status = '') => {
  const params = status ? { status } : {};
  const response = await api.get('/admin/reimbursements', { params });
  return response.data;
};

// ── Users (SUPER_ADMIN role) ──

export const listUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

export const createUser = async ({ name, email }) => {
  const response = await api.post('/admin/users', { name, email });
  return response.data;
};

export const deleteUser = async (id) => {
  const response = await api.delete(`/admin/users/${id}`);
  return response.data;
};

// ── Administrators (SUPER_ADMIN role) ──

export const listAdmins = async () => {
  const response = await api.get('/admin/admins');
  return response.data;
};

export const createAdmin = async ({ name, email, role, positionId }) => {
  const response = await api.post('/admin/admins', { name, email, role, positionId });
  return response.data;
};

export const deleteAdmin = async (id) => {
  const response = await api.delete(`/admin/admins/${id}`);
  return response.data;
};

// ── Positions (SUPER_ADMIN role) ──

export const listPositions = async () => {
  const response = await api.get('/admin/positions');
  return response.data;
};

export const createPosition = async ({ name, priority }) => {
  const response = await api.post('/admin/positions', { name, priority });
  return response.data;
};

export const updatePosition = async (id, { name, priority }) => {
  const response = await api.put(`/admin/positions/${id}`, { name, priority });
  return response.data;
};

export const deletePosition = async (id) => {
  const response = await api.delete(`/admin/positions/${id}`);
  return response.data;
};
