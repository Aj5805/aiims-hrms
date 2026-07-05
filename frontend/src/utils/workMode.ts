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

const STAFF_PERSONAL_PREFIXES = [
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
  '/holidays-calendar',
  '/attendance',
  '/punches',
] as const;

const DESK_PREFIXES = [
  '/hod',
  '/approvals',
  '/team-leave',
  '/forecast',
  '/employees',
  '/reports',
  '/balance-overview',
  '/team-calendar',
  '/delegation',
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

export function homePathForWorkMode(role?: string, employeeId?: string | null, workMode?: 'staff' | 'desk') {
  return effectiveWorkMode(role, employeeId, workMode) === 'desk' ? '/hod' : '/';
}
