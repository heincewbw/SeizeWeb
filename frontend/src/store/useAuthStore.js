import { create } from 'zustand';
import { authAPI } from '@/services/api';
import { connectSocket, disconnectSocket } from '@/services/socket';

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  loading: true,

  initialize: async () => {
    const token = localStorage.getItem('seizeweb_token');
    const userStr = localStorage.getItem('seizeweb_user');

    if (!token || !userStr) {
      set({ loading: false });
      return;
    }

    try {
      const { data } = await authAPI.getMe();
      set({ user: data.user, token, isAuthenticated: true, loading: false });
      connectSocket(token);
    } catch {
      localStorage.removeItem('seizeweb_token');
      localStorage.removeItem('seizeweb_user');
      set({ user: null, token: null, isAuthenticated: false, loading: false });
    }
  },

  login: (token, user) => {
    localStorage.setItem('seizeweb_token', token);
    localStorage.setItem('seizeweb_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true });
    connectSocket(token);
  },

  logout: () => {
    localStorage.removeItem('seizeweb_token');
    localStorage.removeItem('seizeweb_user');
    disconnectSocket();
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateUser: (user) => set({ user }),
}));

export default useAuthStore;
