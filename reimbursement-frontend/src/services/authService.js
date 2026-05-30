import api from './api';

// ── User Auth ──
export const userLogin = async (credentials) => {
  const response = await api.post('/user/auth/login', credentials);
  return response.data;
};

export const userForgotPassword = async (email) => {
  const response = await api.post('/user/auth/forgot-password', { email });
  return response.data;
};

export const userResetPassword = async (token, newPassword) => {
  const response = await api.post('/user/auth/reset-password', { token, newPassword });
  return response.data;
};

// ── Admin Auth ──
export const adminLogin = async (credentials) => {
  const response = await api.post('/admin/auth/login', credentials);
  return response.data;
};

export const adminForgotPassword = async (email) => {
  const response = await api.post('/admin/auth/forgot-password', { email });
  return response.data;
};

export const adminResetPassword = async (token, newPassword) => {
  const response = await api.post('/admin/auth/reset-password', { token, newPassword });
  return response.data;
};
