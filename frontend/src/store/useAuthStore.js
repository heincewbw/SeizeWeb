import { create } from 'zustand';
import { authAPI } from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  initialize: async () => {
    const token = localStorage.getItem('acecapital_token');
    const userStr = localStorage.getItem('acecapital_user');

    if (!token || !userStr) {
      set({ loading: false });
      return;
    }

    try {
      const { data } = await authAPI.getMe();
      set({ user: data.user, token, isAuthenticated: true, loading: false });
      connectSocket(token);
    } catch {
      localStorage.removeItem('acecapital_token');
      localStorage.removeItem('acecapital_user');
    }
  },

  login: (token, user) => {
    localStorage.setItem('acecapital_token', token);
    localStorage.setItem('acecapital_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
    connectSocket(token);
  },

  logout: () => {
    localStorage.removeItem('acecapital_token');
    localStorage.removeItem('acecapital_user');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (user) => set({ user }),
}));

export default useAuthStore;
