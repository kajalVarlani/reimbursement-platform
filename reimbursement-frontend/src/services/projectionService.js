import api from './api';

/**
 * Get the currently active projection window (for C/DC banner notification)
 */
export const getActiveProjectionWindow = async () => {
  const response = await api.get('/projections/active-window');
  return response.data;
};

/**
 * Submit a monthly expense projection (C/DC)
 * @param {string} targetMonth - e.g. "2026-10"
 * @param {Array} items - [{ eventName, expectedAmount, description, tentativeDate }]
 */
export const submitProjection = async (targetMonth, items) => {
  const response = await api.post('/projections/submit', { targetMonth, items });
  return response.data;
};
