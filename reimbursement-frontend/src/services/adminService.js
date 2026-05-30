import api from './api';

// ── Approval Queue (ADMINISTRATOR role) ──

export const getApprovalQueue = async () => {
  const response = await api.get('/admin/reimbursements');
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
