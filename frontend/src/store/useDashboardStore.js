import { create } from 'zustand';

const useDashboardStore = create((set) => ({
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),

  accounts: [],
  setAccounts: (accounts) => set({ accounts }),
  updateAccount: (updatedAccount) =>
    set((state) => ({
      accounts: state.accounts.map((a) =>
        a.id === updatedAccount.accountId ? { ...a, ...updatedAccount } : a
      ),
    })),

  positions: [],
  setPositions: (positions) => set({ positions }),

  summary: null,
  setSummary: (summary) => set({ summary }),
}));

export default useDashboardStore;
