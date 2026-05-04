import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('seizeweb_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('seizeweb_token');
      localStorage.removeItem('seizeweb_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  changePassword: (data) => api.put('/auth/change-password', data),
};

// ─── Accounts ─────────────────────────────────────────────────────────────
export const accountsAPI = {
  getAll: () => api.get('/api/accounts'),
  connect: (data) => api.post('/api/accounts/connect', data),
  disconnect: (id) => api.post(`/api/accounts/${id}/disconnect`),
  delete: (id) => api.delete(`/api/accounts/${id}`),
  sync: (id) => api.post(`/api/accounts/${id}/sync`),
};

// ─── Positions ────────────────────────────────────────────────────────────
export const positionsAPI = {
  getOpen: (accountId) =>
    api.get('/api/positions', { params: accountId ? { account_id: accountId } : {} }),
  getHistory: (params) => api.get('/api/positions/history', { params }),
  syncHistory: (accountId) => api.post(`/api/positions/sync-history/${accountId}`),
};

// ─── Stats ────────────────────────────────────────────────────────────────
export const statsAPI = {
  getSummary: (accountId) =>
    api.get('/api/stats/summary', { params: accountId ? { account_id: accountId } : {} }),
  getEquityChart: (params) => api.get('/api/stats/equity-chart', { params }),
  getSymbolBreakdown: (accountId) =>
    api.get('/api/stats/symbol-breakdown', { params: accountId ? { account_id: accountId } : {} }),
  getMonthlyGain: (accountId) =>
    api.get('/api/stats/monthly-gain', { params: accountId ? { account_id: accountId } : {} }),
};

// ─── Withdrawals ──────────────────────────────────────────────────────────
export const withdrawalsAPI = {
  getAll: (params) => api.get('/api/withdrawals', { params }),
  updateStatus: (id, data) => api.put(`/api/withdrawals/${id}/status`, data),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getUsersOverview: () => api.get('/api/admin/users-overview'),
  updateAccountMeta: (id, data) => api.put(`/api/admin/accounts/${id}`, data),
  addAccount: (data) => api.post('/api/admin/accounts', data),
  getToken: (login, server) => api.get(`/api/mt4/token?login=${login}&server=${encodeURIComponent(server)}`),
  deleteAccount: (id) => api.delete(`/api/accounts/${id}`),
  disconnectAccount: (id) => api.post(`/api/accounts/${id}/disconnect`),
};
