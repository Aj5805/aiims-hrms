/** Mirror of backend STAFF_NUMBER_GROUPS — used only when /employees/staff-groups is unreachable. */
export const FALLBACK_STAFF_GROUPS = [
  { code: 'FAC', label: 'Faculty' },
  { code: 'NUR', label: 'Nursing Officer' },
  { code: 'NFS', label: 'Senior Nursing Officer' },
  { code: 'DEP', label: 'Administration / Department' },
  { code: 'CON', label: 'College of Nursing' },
  { code: 'PGJR', label: 'Junior Resident (Academic)' },
  { code: 'PGNA', label: 'Junior Resident (Non-Academic)' },
  { code: 'SRAC', label: 'Senior Resident (Academic)' },
  { code: 'SRNA', label: 'Senior Resident (Non-Academic)' },
] as const;

/** Mirror of backend designation → staff group rules (onboard auto-suggest). */
const DESIGNATION_STAFF_GROUP: Record<string, string> = {
  'Junior Resident (Academic)': 'PGJR',
  'Junior Resident (Non-Academic)': 'PGNA',
  'Senior Resident (Academic)': 'SRAC',
  'Senior Resident (Non-Academic)': 'SRNA',
  'P.G. Student': 'PGJR',
  'Junior Resident': 'PGNA',
  'Senior Resident': 'SRAC',
  'SR (Academic)': 'SRAC',
  'Nursing Officer': 'NUR',
  'Senior Nursing Officer': 'NFS',
};

const CATEGORY_STAFF_GROUP: Record<string, string> = {
  FACULTY: 'FAC',
  NURSING: 'NUR',
  ADMIN: 'DEP',
  JR_ACAD: 'PGJR',
  SR_ACAD: 'SRAC',
  JR_NA: 'PGNA',
  SR_NA: 'SRNA',
};

const COLLEGE_OF_NURSING_DEPT_CODE = 'NURSCOLL';

export function resolveStaffGroup(params: {
  designationName?: string;
  categoryCode?: string | null;
  departmentCode?: string | null;
}): string | null {
  const { designationName, categoryCode, departmentCode } = params;
  if (designationName && DESIGNATION_STAFF_GROUP[designationName]) {
    if (designationName === 'Senior Resident' && categoryCode === 'SR_NA') return 'SRNA';
    return DESIGNATION_STAFF_GROUP[designationName];
  }
  if (departmentCode === COLLEGE_OF_NURSING_DEPT_CODE) return 'CON';
  if (categoryCode && CATEGORY_STAFF_GROUP[categoryCode]) return CATEGORY_STAFF_GROUP[categoryCode];
  return null;
}

export function staffGroupLabel(code: string): string | undefined {
  return FALLBACK_STAFF_GROUPS.find((g) => g.code === code)?.label;
}
