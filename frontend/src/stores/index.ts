import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { flushAuthPersistence } from '../utils/authSession';

interface AuthState {
  token: string | null;
  user: { id: string; role: string; name: string; username?: string; must_change_password?: boolean; employee_id?: string | null; emp_code?: string | null } | null;
  adminToken: string | null;
  adminUser: AuthState['user'];
  workMode: 'staff' | 'desk';
  passwordChangeDismissed: boolean;
  setAuth: (token: string, user: AuthState['user']) => void;
  clearAuth: () => void;
  startImpersonation: (token: string, user: AuthState['user']) => void;
  stopImpersonation: () => void;
  setWorkMode: (mode: 'staff' | 'desk') => void;
  dismissPasswordChange: () => void;
}

export { useUiStore } from './ui';

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      adminToken: null,
      adminUser: null,
      workMode: 'desk',
      passwordChangeDismissed: false,
      setAuth: (token, user) => {
        localStorage.setItem('access_token', token);
        set({ token, user, adminToken: null, adminUser: null, workMode: 'desk', passwordChangeDismissed: false });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        set({ token: null, user: null, adminToken: null, adminUser: null, workMode: 'desk', passwordChangeDismissed: false });
      },
      startImpersonation: (targetToken, targetUser) => {
        const currentToken = get().token;
        const currentUser = get().user;
        if (!currentToken || !currentUser || !targetUser) return;

        const nextState = {
          token: targetToken,
          user: {
            id: targetUser.id,
            role: targetUser.role,
            name: targetUser.name || targetUser.username || '',
            username: targetUser.username,
            employee_id: targetUser.employee_id,
            emp_code: targetUser.emp_code,
            must_change_password: false,
          },
          adminToken: currentToken,
          adminUser: currentUser,
          workMode: 'desk' as const,
          passwordChangeDismissed: true,
        };
        set(nextState);
        flushAuthPersistence(nextState);
      },
      stopImpersonation: () => {
        const { adminToken, adminUser } = get();
        if (!adminToken || !adminUser) return;

        const nextState = {
          token: adminToken,
          user: adminUser,
          adminToken: null,
          adminUser: null,
          workMode: 'desk' as const,
          passwordChangeDismissed: false,
        };
        set(nextState);
        flushAuthPersistence(nextState);
      },
      dismissPasswordChange: () => {
        const user = get().user;
        if (!user) return;
        set({
          passwordChangeDismissed: true,
          user: { ...user, must_change_password: false },
        });
      },
      setWorkMode: (mode) => set({ workMode: mode }),
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