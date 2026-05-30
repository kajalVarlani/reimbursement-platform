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
