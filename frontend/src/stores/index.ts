import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: { id: string; role: string; name: string; username?: string; must_change_password?: boolean; employee_id?: string | null; emp_code?: string | null } | null;
  adminToken: string | null;
  adminUser: AuthState['user'];
  setAuth: (token: string, user: AuthState['user']) => void;
  clearAuth: () => void;
  startImpersonation: (token: string, user: AuthState['user']) => void;
  stopImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      adminToken: null,
      adminUser: null,
      setAuth: (token, user) => {
        localStorage.setItem('access_token', token);
        set({ token, user, adminToken: null, adminUser: null });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        set({ token: null, user: null, adminToken: null, adminUser: null });
      },
      startImpersonation: (targetToken, targetUser) => {
        const currentToken = get().token;
        const currentUser = get().user;
        if (!currentToken || !currentUser) return;
        
        localStorage.setItem('access_token', targetToken);
        set({
          token: targetToken,
          user: targetUser,
          adminToken: currentToken,
          adminUser: currentUser,
        });
      },
      stopImpersonation: () => {
        const { adminToken, adminUser } = get();
        if (!adminToken || !adminUser) return;
        
        localStorage.setItem('access_token', adminToken);
        set({
          token: adminToken,
          user: adminUser,
          adminToken: null,
          adminUser: null,
        });
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          localStorage.setItem('access_token', state.token);
        }
      },
    }
  )
);