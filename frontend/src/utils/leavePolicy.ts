export const POLICY_CATEGORY_CODES = [
  'FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA',
] as const;

export type PolicyCategoryCode = (typeof POLICY_CATEGORY_CODES)[number];

export const ELIGIBILITY_OPTIONS = ['ALL', 'NONE', 'MALE_ONLY', 'FEMALE_ONLY'] as const;
export type EligibilityOption = (typeof ELIGIBILITY_OPTIONS)[number];

export type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  scheme?: string | null;
  is_active?: boolean;
  max_accumulation?: number | null;
};

export type EntitlementRule = {
  id: string;
  category_code: string;
  leave_type_code: string;
  year_ref?: string | null;
  credit_frequency?: string | null;
  days_per_year?: number | null;
  max_at_a_stretch?: number | null;
  max_in_tenure?: number | null;
  special_rules?: Record<string, unknown> | null;
};

export type PolicyRowDraft = {
  annualCredit: string;
  creditFrequency: string;
  yearRef: string;
  maxAtATime: string;
  maxInTenure: string;
  maxAccumulation: string;
  eligibility: EligibilityOption;
  maxTimesInService: string;
};

export function isPolicyCategoryCode(value: string | null | undefined): value is PolicyCategoryCode {
  return Boolean(value && (POLICY_CATEGORY_CODES as readonly string[]).includes(value));
}

export function categoryScheme(code: PolicyCategoryCode): 'CCS' | 'RESIDENCY' {
  return ['JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'].includes(code) ? 'RESIDENCY' : 'CCS';
}

export function leaveTypeAppliesToCategory(leaveType: LeaveTypeOption, category: PolicyCategoryCode): boolean {
  const scheme = leaveType.scheme || 'CCS';
  return scheme === 'BOTH' || scheme === categoryScheme(category);
}

export function countPolicyGaps(
  leaveTypes: LeaveTypeOption[],
  ruleMap: Map<string, EntitlementRule>,
): number {
  let gaps = 0;
  for (const category of POLICY_CATEGORY_CODES) {
    for (const leaveType of leaveTypes) {
      if (!leaveTypeAppliesToCategory(leaveType, category)) continue;
      if (!ruleMap.has(`${category}::${leaveType.code}`)) gaps += 1;
    }
  }
  return gaps;
}

export function parseSpecialRules(raw: EntitlementRule['special_rules']): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  return {};
}

export function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ensurePolicyDraft(leaveType: LeaveTypeOption, rule?: EntitlementRule): PolicyRowDraft {
  const special = parseSpecialRules(rule?.special_rules);
  const elig = String(special.gender_eligibility || 'ALL').toUpperCase() as EligibilityOption;
  const isTenure = rule?.year_ref === 'TENURE';
  return {
    annualCredit: String(rule?.days_per_year ?? ''),
    creditFrequency: isTenure ? 'NONE' : (rule?.credit_frequency || 'ANNUAL'),
    yearRef: rule?.year_ref || 'CALENDAR',
    maxAtATime: String(rule?.max_at_a_stretch ?? ''),
    maxInTenure: String(rule?.max_in_tenure ?? ''),
    maxAccumulation: String(leaveType.max_accumulation ?? ''),
    eligibility: ELIGIBILITY_OPTIONS.includes(elig) ? elig : 'ALL',
    maxTimesInService: special.max_times_in_service != null ? String(special.max_times_in_service) : '',
  };
}

export function buildSpecialRules(draft: PolicyRowDraft): Record<string, unknown> | null {
  const rules: Record<string, unknown> = {};
  if (draft.eligibility && draft.eligibility !== 'ALL') {
    rules.gender_eligibility = draft.eligibility;
  }
  const maxTimes = parseOptionalNumber(draft.maxTimesInService);
  if (maxTimes != null) rules.max_times_in_service = maxTimes;
  return Object.keys(rules).length > 0 ? rules : null;
}
