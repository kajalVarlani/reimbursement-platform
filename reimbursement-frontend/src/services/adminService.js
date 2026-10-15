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

export const approveReimbursement = async (id, payload = {}) => {
  const body = typeof payload === 'string' ? { remark: payload } : payload;
  const response = await api.post(`/admin/reimbursements/${id}/approve`, body);
  return response.data;
};

export const getSignatureAuditCertificate = async (id) => {
  const response = await api.get(`/admin/reimbursements/${id}/signature-audit`);
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
export const markAsPaid = async (id, payload = {}) => {
  const response = await api.post(`/admin/reimbursements/${id}/mark-paid`, payload);
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

export const createUser = async ({ name, email, designation, clubName }) => {
  const response = await api.post('/admin/users', { name, email, designation, clubName });
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

export const listFacultyMentors = async () => {
  const response = await api.get('/admin/faculty-mentors');
  return response.data;
};

// ── Club-Mentor Mappings ──

export const listClubMappings = async () => {
  const response = await api.get('/admin/club-mappings');
  return response.data;
};

export const upsertClubMapping = async ({ clubName, facultyMentorId }) => {
  const response = await api.post('/admin/club-mappings', { clubName, facultyMentorId });
  return response.data;
};

export const deleteClubMapping = async (id) => {
  const response = await api.delete(`/admin/club-mappings/${id}`);
  return response.data;
};

// ── Treasurer Advance Buffer Management ──

export const getBufferStatus = async () => {
  const response = await api.get('/admin/buffer');
  return response.data;
};

export const replenishBuffer = async ({ amount, month, notes }) => {
  const response = await api.post('/admin/buffer/replenish', { amount, month, notes });
  return response.data;
};

export const topUpBuffer = async ({ amount, notes }) => {
  const response = await api.post('/admin/buffer/top-up', { amount, notes });
  return response.data;
};

// ── Monthly Projections (Treasurer Admin View) ──

export const setProjectionWindow = async ({ targetMonth, deadline, instructions }) => {
  const response = await api.post('/projections/window', { targetMonth, deadline, instructions });
  return response.data;
};

export const listProjections = async (month = '') => {
  const params = month ? { month } : {};
  const response = await api.get('/projections/list', { params });
  return response.data;
};

// ── Treasurer Monthly Indent Export (.xlsx) & Summary ──

export const getIndentSummary = async (month = '') => {
  const params = month ? { month } : {};
  const response = await api.get('/admin/indent/summary', { params });
  return response.data;
};

export const exportTreasurerMonthlyIndent = async (month = '') => {
  const params = month ? { month } : {};
  const response = await api.get('/admin/indent/export', {
    params,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `Treasurer_Monthly_Indent_${month || 'Current'}.xlsx`;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.parentNode.removeChild(link);
  window.URL.revokeObjectURL(url);
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

// ── Club Budget Allocation (Treasurer → per-club per-month) ──

export const getClubBudgets = async (month = '') => {
  const params = month ? { month } : {};
  const response = await api.get('/admin/club-budgets', { params });
  return response.data; // { targetMonth, budgets: [...] }
};

export const upsertClubBudget = async ({ clubName, targetMonth, allocatedAmount, notes }) => {
  const response = await api.post('/admin/club-budgets', { clubName, targetMonth, allocatedAmount, notes });
  return response.data;
};

export const deleteClubBudget = async (id) => {
  const response = await api.delete(`/admin/club-budgets/${id}`);
  return response.data;
};
