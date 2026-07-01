/** Canonical system roles — keep in sync with backend users.py allowed_roles and RBAC. */
export const SYSTEM_ROLES = [
  { code: 'ADMIN', label: 'Super Admin', description: 'Full system access, admin console, impersonation' },
  { code: 'DIRECTOR', label: 'Director', description: 'Read-only institutional view across the hospital' },
  { code: 'ESTABLISHMENT_OFFICER', label: 'Establishment Officer', description: 'CCS staff HR, leave config, reports' },
  { code: 'REGISTRAR', label: 'Registrar', description: 'Resident HR, reports, employee master access' },
  { code: 'NODAL_OFFICER', label: 'Nodal Officer', description: 'Final leave approver for assigned departments' },
  { code: 'NODAL_OFFICE', label: 'Nodal Office (Clerical)', description: 'Onboarding, directory, reports, manual leave entries — no leave approval' },
  { code: 'DEAN_ACADEMIC', label: 'Dean Academic', description: 'Resident leave final approver' },
  { code: 'HOD', label: 'Head of Department', description: 'First-stage leave approver for own department' },
  { code: 'STAFF', label: 'Staff', description: 'Apply leave, view own balances and profile' },
] as const;

export const ASSIGNABLE_ROLES = SYSTEM_ROLES.map((r) => r.code);

export function formatApiError(detail: unknown): string {
  if (!detail) return 'Request failed';
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
