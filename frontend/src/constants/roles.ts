/** Canonical system roles — keep in sync with backend app/auth/roles.py */

export const SYSTEM_ROLES = [
  { code: 'ADMIN', label: 'Super Admin', description: 'Full access' },
  { code: 'DIRECTOR', label: 'Executive Director', description: 'Read-only institution view' },
  { code: 'NODAL_OFFICER', label: 'Nodal Officer', description: 'Final leave approver (nodal office)' },
  { code: 'NODAL_OFFICE', label: 'Nodal Office (Clerical)', description: 'Onboarding, directory, reports; no approval' },
  { code: 'HOD', label: 'Head of Department', description: 'First-stage approver' },
  { code: 'STAFF', label: 'Staff', description: 'Apply leave, view profile' },
] as const;

export type SystemRoleCode = (typeof SYSTEM_ROLES)[number]['code'];

export const ASSIGNABLE_ROLES: SystemRoleCode[] = SYSTEM_ROLES.map((r) => r.code);

/** Workflow step approver roles (Masters → Workflows) */
export const WORKFLOW_APPROVER_ROLES = ['HOD', 'NODAL_OFFICER', 'SPECIFIC_USER'] as const;

export const REPORT_ROLES = ['ADMIN', 'DIRECTOR', 'NODAL_OFFICER', 'NODAL_OFFICE'] as const;
export const PAYROLL_EXPORT_ROLES = ['ADMIN', 'DIRECTOR', 'NODAL_OFFICER'] as const;
export const CONFIG_ROLES = ['ADMIN'] as const;
export const HR_EDITOR_ROLES = ['ADMIN', 'NODAL_OFFICER', 'NODAL_OFFICE'] as const;
export const EMPLOYEE_MASTER_ROLES = ['ADMIN', 'DIRECTOR', 'NODAL_OFFICER', 'NODAL_OFFICE'] as const;
export const APPROVER_ROLES = ['ADMIN', 'HOD', 'NODAL_OFFICER'] as const;
export const TEAM_VIEW_ROLES = ['HOD', 'NODAL_OFFICER', 'ADMIN'] as const;

const ROLE_BY_CODE = Object.fromEntries(SYSTEM_ROLES.map((r) => [r.code, r])) as Record<
  string,
  (typeof SYSTEM_ROLES)[number]
>;

export function hasSystemRole(role: string | undefined | null, allowed: readonly SystemRoleCode[]): boolean {
  return !!role && (allowed as readonly string[]).includes(role);
}

export function roleLabel(code: string | undefined | null): string {
  if (!code) return '—';
  return ROLE_BY_CODE[code]?.label ?? code;
}

export function roleDescription(code: string | undefined | null): string {
  if (!code) return '';
  return ROLE_BY_CODE[code]?.description ?? '';
}

export function formatApiError(detail: unknown): string | null {
  if (detail === null || detail === undefined || detail === '') return null;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const loc = 'loc' in item && Array.isArray(item.loc) ? item.loc.join(' → ') : '';
          return loc ? `${loc}: ${item.msg}` : String(item.msg);
        }
        return JSON.stringify(item);
      })
      .join('; ');
  }
  return String(detail);
}

/** Prefer API detail, then HTTP status, then a plain fallback (never raw axios boilerplate). */
export function formatHttpError(err: unknown, fallback: string): string {
  const ax = err as {
    message?: string;
    code?: string;
    response?: { status?: number; data?: { detail?: unknown; message?: string } };
  };
  const fromDetail = formatApiError(ax.response?.data?.detail);
  if (fromDetail) return fromDetail;
  const fromMessage = formatApiError(ax.response?.data?.message);
  if (fromMessage) return fromMessage;
  if (ax.response?.status) return `${fallback} (server returned ${ax.response.status})`;
  if (ax.message === 'Network Error' || ax.code === 'ERR_NETWORK') {
    return `${fallback} Check that the HRMS server is running and try again.`;
  }
  if (ax.message?.startsWith('Request failed with status code')) {
    return fallback;
  }
  if (ax.message && ax.message !== 'Network Error') return ax.message;
  return fallback;
}
