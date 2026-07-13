export const APPROVER_DESK_ROLES = ['HOD', 'NODAL_OFFICER'] as const;

export function canToggleWorkMode(role?: string, employeeId?: string | null) {
  return !!role && !!employeeId && APPROVER_DESK_ROLES.includes(role as (typeof APPROVER_DESK_ROLES)[number]);
}

export function isDeskModeAllowed(role?: string) {
  return !!role && ['HOD', 'NODAL_OFFICER', 'ADMIN', 'DIRECTOR'].includes(role);
}

export function effectiveWorkMode(role?: string, employeeId?: string | null, workMode?: 'staff' | 'desk'): 'staff' | 'desk' {
  return canToggleWorkMode(role, employeeId) ? (workMode ?? 'desk') : 'desk';
}

/** True when viewing personal staff pages (own attendance, apply leave, my apps). */
export function isStaffPersonalView(
  role?: string,
  employeeId?: string | null,
  workMode?: 'staff' | 'desk',
): boolean {
  if (role === 'STAFF') return true;
  return canToggleWorkMode(role, employeeId) && effectiveWorkMode(role, employeeId, workMode) === 'staff';
}

/** Read-only pages reachable in both Staff and Desk view (e.g. nodal officer checking holidays). */
export const DUAL_MODE_PATHS = ['/holidays-calendar'] as const;

const STAFF_PERSONAL_PREFIXES = [
  '/profile-dashboard',
  '/profile',
  '/apply',
  '/my-apps',
  '/leave-account',
  '/login-activity',
  '/leave-dashboard',
  '/claims',
  '/payroll',
  '/performance',
  '/dependents',
  '/service-record',
  '/holidays-calendar',
  '/attendance',
  '/punches',
] as const;

const DESK_PREFIXES = [
  '/hod',
  '/approvals',
  '/team-leave',
  '/staff-ledger',
  '/forecast',
  '/employees',
  '/reports',
  '/balance-overview',
  '/year-end',
  '/balances',
  '/team-calendar',
  '/delegation',
  '/admin',
] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function isStaffPersonalPath(pathname: string) {
  return matchesPrefix(pathname, STAFF_PERSONAL_PREFIXES);
}

export function isDeskPath(pathname: string) {
  return matchesPrefix(pathname, DESK_PREFIXES);
}

export function isDualModePath(pathname: string) {
  return matchesPrefix(pathname, DUAL_MODE_PATHS);
}

export function homePathForWorkMode(role?: string, employeeId?: string | null, workMode?: 'staff' | 'desk') {
  return effectiveWorkMode(role, employeeId, workMode) === 'desk' ? '/hod' : '/';
}
