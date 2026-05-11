import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token from localStorage
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('acecapital_token');
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
      localStorage.removeItem('acecapital_token');
      localStorage.removeItem('acecapital_user');
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
  getDailyHistory: (params) => api.get('/api/positions/history/daily', { params }),
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
  getPortfolioShare: () => api.get('/api/stats/portfolio-share'),
};

// ─── Withdrawals ──────────────────────────────────────────────────────────
export const withdrawalsAPI = {
  getAll: (params) => api.get('/api/withdrawals', { params }),
  updateStatus: (id, data) => api.put(`/api/withdrawals/${id}/status`, data),
};

// ─── EAs ──────────────────────────────────────────────────────────────────
export const easAPI = {
  list: () => api.get('/api/eas'),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getUsersOverview: () => api.get('/api/admin/users-overview'),
  getRevenue: () => api.get('/api/admin/revenue'),
  updateAccountMeta: (id, data) => api.put(`/api/admin/accounts/${id}`, data),
  addAccount: (data) => api.post('/api/admin/accounts', data),
  getToken: (login, server) => api.get(`/api/mt4/token?login=${login}&server=${encodeURIComponent(server)}`),
  deleteAccount: (id) => api.delete(`/api/admin/accounts/${id}`),
  reassignAccount: (id, userId) => api.put(`/api/admin/accounts/${id}/reassign`, { user_id: userId }),
  disconnectAccount: (id) => api.post(`/api/accounts/${id}/disconnect`),
  testOfflineAlert: () => api.post('/api/admin/test-offline-alert'),
  updateCommissionRate: (userId, rate) => api.put(`/api/admin/users/${userId}/commission`, { commission_rate: rate }),
  generateInvoice: (userId, month, year) => api.get('/api/admin/invoice', { params: { user_id: userId, month, year } }),
  sendInvoiceEmail: (invoice) => api.post('/api/admin/invoice/send', { invoice }),
  // EAs management
  listEAs: () => api.get('/api/admin/eas'),
  createEA: (data) => api.post('/api/admin/eas', data),
  updateEA: (id, data) => api.put(`/api/admin/eas/${id}`, data),
  deleteEA: (id) => api.delete(`/api/admin/eas/${id}`),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/api/notifications', { params }),
  markAllRead: () => api.put('/api/notifications/read-all'),
  markOneRead: (id) => api.put(`/api/notifications/${id}/read`),
  delete: (id) => api.delete(`/api/notifications/${id}`),
};

// ─── Deposits ─────────────────────────────────────────────────────────────
export const depositsAPI = {
  getAll: (params) => api.get('/api/deposits', { params }),
};

// ─── Referrals ────────────────────────────────────────────────────────────
export const referralsAPI = {
  get: () => api.get('/api/referrals'),
};

// ─── Support Tickets ──────────────────────────────────────────────────────
export const ticketsAPI = {
  getAll: (params) => api.get('/api/tickets', { params }),
  create: (data) => api.post('/api/tickets', data),
  get: (id) => api.get(`/api/tickets/${id}`),
  addMessage: (id, message) => api.post(`/api/tickets/${id}/messages`, { message }),
  updateStatus: (id, status) => api.put(`/api/tickets/${id}/status`, { status }),
};

// ─── Monthly Statement ────────────────────────────────────────────────────
export const statementAPI = {
  download: (params) => api.get('/api/stats/statement', { params, responseType: 'blob' }),
};
