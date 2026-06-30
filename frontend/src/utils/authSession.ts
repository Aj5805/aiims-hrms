/** Detect admin impersonation from store or JWT claim (survives partial rehydration). */
export function tokenHasImpersonationClaim(token: string | null): boolean {
  if (!token) return false;
  try {
    const segment = token.split('.')[1];
    if (!segment) return false;
    const payload = JSON.parse(atob(segment.replace(/-/g, '+').replace(/_/g, '/'))) as {
      impersonated_by?: string;
    };
    return Boolean(payload.impersonated_by);
  } catch {
    return false;
  }
}

export function isImpersonatingSession(adminToken: string | null): boolean {
  if (adminToken) return true;
  return tokenHasImpersonationClaim(
    typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null,
  );
}

/** Write auth state synchronously before a full page navigation. */
export function flushAuthPersistence(state: {
  token: string | null;
  user: unknown;
  adminToken: string | null;
  adminUser: unknown;
  passwordChangeDismissed: boolean;
}): void {
  localStorage.setItem(
    'auth-storage',
    JSON.stringify({
      state: {
        token: state.token,
        user: state.user,
        adminToken: state.adminToken,
        adminUser: state.adminUser,
        passwordChangeDismissed: state.passwordChangeDismissed,
      },
      version: 0,
    }),
  );
  if (state.token) {
    localStorage.setItem('access_token', state.token);
  }
}
