import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, Navigate, useNavigate, Link } from 'react-router-dom';
import { adminApi, authApi, usersApi } from '../api/endpoints';
import { entitlementRulesApi, leaveTypesApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { SYSTEM_ROLES, roleLabel } from '../constants/roles';

type LeaveTypeOption = { id: string; code: string; name: string; scheme?: string | null; is_active?: boolean; is_accumulating?: boolean; max_accumulation?: number | null; requires_mc?: boolean; min_days_for_mc?: number | null; count_holidays?: boolean; is_half_day_allowed?: boolean; carry_forward?: boolean };
type UserOption = { id: string; username: string; role: string; is_active?: boolean; must_change_password?: boolean; employee_id?: string | null; last_login?: string | null; emp_code?: string | null; name?: string | null; department_name?: string | null; designation_name?: string | null; };
type AuditLogItem = { id: string; entity_type?: string | null; entity_id?: string | null; actor_id?: string | null; action?: string | null; created_at?: string | null };
type HealthDashboard = { queue_depth?: number; recent_errors_24h?: number; db_pool_size?: number; db_pool_checked_in?: number; last_backup?: string | null; error_rate?: number | null };
type MasterCounts = { active: number; inactive: number; total: number };
type AdminSummary = {
  employees: { total: number; active: number };
  users: {
    active: number;
    inactive: number;
    unmapped: number;
    reset_pending: number;
    by_role: Record<string, number>;
  };
  workflow: { pending_applications: number };
  hod: { departments_without_hod: number };
  policy: { missing_rules: number };
  masters: {
    departments: MasterCounts;
    designations: MasterCounts;
    leave_types: MasterCounts;
    nodal_offices: MasterCounts;
    nodal_by_scheme: Record<string, number>;
  };
  maintenance_mode: boolean;
  attention_items: number;
};
type EntitlementRule = {
  id: string;
  category_code: string;
  leave_type_code: string;
  year_ref?: string | null;
  credit_frequency?: string | null;
  days_per_year?: number | null;
  prorata_rate?: number | null;
  year1_days?: number | null;
  year2_plus_days?: number | null;
  max_at_a_stretch?: number | null;
  max_in_tenure?: number | null;
  carry_forward?: boolean;
  special_rules?: Record<string, unknown> | null;
};

type PolicyRowDraft = {
  annualCredit: string;
  creditFrequency: string;
  yearRef: string;
  maxAtATime: string;
  maxInTenure: string;
  maxAccumulation: string;
  eligibility: EligibilityOption;
  maxTimesInService: string;
};
type AdminModuleId = 'dashboard' | 'policy' | 'users' | 'audit';
const VALID_MODULES = new Set<AdminModuleId>(['dashboard', 'policy', 'users', 'audit']);
const POLICY_CATEGORY_CODES = ['FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'] as const;
type PolicyCategoryCode = (typeof POLICY_CATEGORY_CODES)[number];
const ELIGIBILITY_OPTIONS = ['ALL', 'NONE', 'MALE_ONLY', 'FEMALE_ONLY'] as const;
type EligibilityOption = (typeof ELIGIBILITY_OPTIONS)[number];

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'
  }).format(parsed);
}

const Icons = {
  Dashboard: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  Policy: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Workflow: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  Users: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Audit: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
};

const MODULES: { id: AdminModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'policy', label: 'Leave Policy Matrix' },
  { id: 'users', label: 'Users & Roles' },
  { id: 'audit', label: 'Audit & Health' },
];

function AttentionCard({
  label,
  value,
  hint,
  tone = 'default',
  to,
  onClick,
}: {
  label: string;
  value: number | string;
  hint: string;
  tone?: 'default' | 'amber' | 'green' | 'red';
  to?: string;
  onClick?: () => void;
}) {
  const colors = {
    default: 'border-slate-200 bg-white hover:border-slate-300',
    amber: 'border-amber-200 bg-amber-50 hover:border-amber-300',
    green: 'border-emerald-200 bg-emerald-50 hover:border-emerald-300',
    red: 'border-red-200 bg-red-50 hover:border-red-300',
  };
  const valueColors = {
    default: 'text-slate-900',
    amber: 'text-amber-800',
    green: 'text-emerald-800',
    red: 'text-red-800',
  };
  const inner = (
    <>
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-3xl font-black mt-1 ${valueColors[tone]}`}>{value}</div>
      <p className="text-xs text-slate-500 mt-2 leading-snug">{hint}</p>
    </>
  );
  const className = `p-5 rounded-2xl border-2 text-left transition-colors ${colors[tone]} ${to || onClick ? 'cursor-pointer' : ''}`;
  if (to) {
    return <Link to={to} className={className}>{inner}</Link>;
  }
  if (onClick) {
    return <button type="button" onClick={onClick} className={`${className} w-full`}>{inner}</button>;
  }
  return <div className={className}>{inner}</div>;
}

function SnapshotTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-2xl font-black text-slate-900 mt-1">{value}</div>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
}

function QuickActionLink({ to, children, primary }: { to: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`block rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300 hover:text-indigo-700'
      }`}
    >
      {children}
    </Link>
  );
}

function backupAgeLabel(iso?: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'No backup found', stale: true };
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return { text: 'Unknown', stale: true };
  const days = Math.floor((Date.now() - parsed.getTime()) / 86_400_000);
  if (days === 0) return { text: 'Today', stale: false };
  if (days === 1) return { text: '1 day ago', stale: false };
  return { text: `${days} days ago`, stale: days > 7 };
}

function countPolicyGaps(
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

function categoryScheme(code: PolicyCategoryCode): 'CCS' | 'RESIDENCY' {
  return ['JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'].includes(code) ? 'RESIDENCY' : 'CCS';
}

function leaveTypeAppliesToCategory(leaveType: LeaveTypeOption, category: PolicyCategoryCode): boolean {
  const scheme = leaveType.scheme || 'CCS';
  const catScheme = categoryScheme(category);
  return scheme === 'BOTH' || scheme === catScheme;
}

export function AdminDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const role = useAuthStore((s) => s.user?.role);
  const adminUser = useAuthStore((s) => s.user);
  const adminToken = useAuthStore((s) => s.adminToken);
  
  const rawModule = new URLSearchParams(location.search).get('module');
  const queryModule = rawModule && VALID_MODULES.has(rawModule as AdminModuleId)
    ? (rawModule as AdminModuleId)
    : null;
  const [activeModule, setActiveModule] = useState<AdminModuleId>(queryModule || 'dashboard');

  useEffect(() => {
    if (queryModule && queryModule !== activeModule) {
      setActiveModule(queryModule);
    }
  }, [queryModule]);

  const [activePolicyCategory, setActivePolicyCategory] = useState<PolicyCategoryCode>('FACULTY');
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [entitlementRules, setEntitlementRules] = useState<EntitlementRule[]>([]);
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyRowDraft>>({});
  const [savingPolicyKey, setSavingPolicyKey] = useState('');
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState('');
  const [usersLoadError, setUsersLoadError] = useState('');
  const [usersLoading, setUsersLoading] = useState(false);
  const [forceLogoutUserId, setForceLogoutUserId] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');

  const loadDashboard = async () => {
    const { data } = await adminApi.healthDashboard();
    setDashboard(data || {});
  };

  const loadAudit = async () => {
    const { data } = await adminApi.auditLog({ skip: 0, limit: 50 });
    setAuditRows(data || []);
  };

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersLoadError('');
    try {
      const { data } = await usersApi.list();
      setUsers(data || []);
    } catch (e: unknown) {
      setUsers([]);
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setUsersLoadError(
        typeof detail === 'string'
          ? detail
          : 'Could not load users. Ensure database migrations are applied (`alembic upgrade head`) and you are logged in as ADMIN.',
      );
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoadError('');
      const results = await Promise.allSettled([
        adminApi.healthDashboard(),
        adminApi.summary(),
        usersApi.list(),
        leaveTypesApi.list({ include_inactive: true }),
        entitlementRulesApi.list(),
        adminApi.auditLog({ skip: 0, limit: 50 }),
      ]);
      const [dashboardResult, summaryResult, usersResult, leaveTypesResult, rulesResult, auditResult] = results;
      if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value.data || {});
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data || null);
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.data || []);
        setUsersLoadError('');
      } else {
        setUsersLoadError('Could not load users. Run `cd backend && alembic upgrade head`, then refresh this page.');
      }
      if (leaveTypesResult.status === 'fulfilled') {
        setLeaveTypes(leaveTypesResult.value.data || []);
      } else {
        setLoadError('Could not load leave types. Check that the backend is running and leave types are seeded (`python seeds/run.py`).');
      }
      if (rulesResult.status === 'fulfilled') {
        setEntitlementRules(rulesResult.value.data || []);
      } else if (leaveTypesResult.status === 'fulfilled') {
        setLoadError((prev) => prev || 'Could not load entitlement rules. Run seeds 003 and 004 to populate the policy matrix.');
      }
      if (auditResult.status === 'fulfilled') setAuditRows(auditResult.value.data || []);
      setSummaryLoading(false);
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (activeModule === 'users') void loadUsers();
  }, [activeModule]);

  const runForceLogout = async () => {
    if (!forceLogoutUserId) {
      setMessage('Choose a user to force logout.');
      return;
    }
    await adminApi.forceLogout(forceLogoutUserId);
    setMessage('Force logout request submitted.');
    await loadDashboard();
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const { data } = await authApi.impersonate(userId);
      startImpersonation(data.access_token, data.user);
      navigate('/', { replace: true });
    } catch (e: any) {
      setMessage(e.response?.data?.detail || 'Failed to impersonate user');
    }
  };

  const entitlementRuleMap = useMemo(() => {
    const entries: Array<[string, EntitlementRule]> = entitlementRules.map((rule) => [`${rule.category_code}::${rule.leave_type_code}`, rule]);
    return new Map<string, EntitlementRule>(entries);
  }, [entitlementRules]);

  const localPolicyGaps = useMemo(
    () => countPolicyGaps(leaveTypes, entitlementRuleMap),
    [leaveTypes, entitlementRuleMap],
  );

  const institution = useMemo(() => {
    const activeUsers = users.filter((user) => user.is_active !== false).length;
    const inactiveUsers = users.filter((user) => user.is_active === false).length;
    const adminUsers = users.filter((user) => user.role === 'ADMIN' && user.is_active !== false).length;
    const resetUsers = users.filter((user) => user.must_change_password).length;
    const unmappedUsers = users.filter((user) => !user.employee_id).length;
    const byRole: Record<string, number> = {};
    users.filter((u) => u.is_active !== false).forEach((u) => {
      byRole[u.role] = (byRole[u.role] || 0) + 1;
    });
    return {
      activeUsers,
      inactiveUsers,
      adminUsers,
      resetUsers,
      unmappedUsers,
      byRole,
      policyGaps: summary?.policy.missing_rules ?? localPolicyGaps,
      pendingLeaves: summary?.workflow.pending_applications ?? 0,
      departmentsWithoutHod: summary?.hod.departments_without_hod ?? 0,
      employeesTotal: summary?.employees.total ?? 0,
      employeesActive: summary?.employees.active ?? 0,
      maintenanceMode: summary?.maintenance_mode ?? false,
      masters: summary?.masters ?? null,
      attentionItems: summary?.attention_items ?? (
        unmappedUsers + resetUsers + localPolicyGaps
      ),
    };
  }, [users, summary, localPolicyGaps]);

  const filteredUsers = useMemo(() => {
    if (!userSearchTerm.trim()) return users;
    const term = userSearchTerm.toLowerCase();
    return users.filter(u => 
      u.username.toLowerCase().includes(term) ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      (u.emp_code && u.emp_code.toLowerCase().includes(term)) ||
      (u.department_name && u.department_name.toLowerCase().includes(term)) ||
      (u.designation_name && u.designation_name.toLowerCase().includes(term))
    );
  }, [users, userSearchTerm]);

  const impersonatableUsers = useMemo(
    () => filteredUsers.filter((u) => u.is_active !== false && u.role !== 'ADMIN'),
    [filteredUsers],
  );

  const parseSpecialRules = (raw: EntitlementRule['special_rules']): Record<string, unknown> => {
    if (!raw) return {};
    if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
    return {};
  };

  const ensurePolicyDraft = (leaveType: LeaveTypeOption, rule?: EntitlementRule): PolicyRowDraft => {
    const special = parseSpecialRules(rule?.special_rules);
    const elig = String(special.gender_eligibility || 'ALL').toUpperCase() as EligibilityOption;
    const isTenure = rule?.year_ref === 'TENURE';
    return {
      annualCredit: String(rule?.days_per_year ?? rule?.year1_days ?? ''),
      creditFrequency: isTenure ? 'NONE' : (rule?.credit_frequency || 'ANNUAL'),
      yearRef: rule?.year_ref || 'CALENDAR',
      maxAtATime: String(rule?.max_at_a_stretch ?? ''),
      maxInTenure: String(rule?.max_in_tenure ?? ''),
      maxAccumulation: String(leaveType.max_accumulation ?? ''),
      eligibility: ELIGIBILITY_OPTIONS.includes(elig) ? elig : 'ALL',
      maxTimesInService: special.max_times_in_service != null ? String(special.max_times_in_service) : '',
    };
  };

  const parseOptionalNumber = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const updatePolicyDraft = (draftKey: string, updater: (current: PolicyRowDraft) => PolicyRowDraft) => {
    setPolicyDrafts((current) => {
      const leaveType = leaveTypes.find((item) => `${activePolicyCategory}::${item.code}` === draftKey);
      const rule = entitlementRuleMap.get(draftKey);
      const fallback = leaveType ? ensurePolicyDraft(leaveType, rule) : {
        annualCredit: '', creditFrequency: 'ANNUAL', yearRef: 'CALENDAR',
        maxAtATime: '', maxInTenure: '', maxAccumulation: '',
        eligibility: 'ALL' as EligibilityOption, maxTimesInService: '',
      };
      return { ...current, [draftKey]: updater(current[draftKey] || fallback) };
    });
  };

  const policyRows = useMemo(() => leaveTypes
    .filter((leaveType) => leaveTypeAppliesToCategory(leaveType, activePolicyCategory))
    .map((leaveType) => {
    const rule = entitlementRuleMap.get(`${activePolicyCategory}::${leaveType.code}`);
    return {
      id: leaveType.id, code: leaveType.code, name: leaveType.name, scheme: leaveType.scheme || '-',
      status: rule ? 'Configured' : 'Missing', statusTone: rule ? 'ok' as const : 'warn' as const,
    };
  }), [activePolicyCategory, entitlementRuleMap, leaveTypes]);

  const buildSpecialRules = (draft: PolicyRowDraft): Record<string, unknown> | null => {
    const rules: Record<string, unknown> = {};
    if (draft.eligibility && draft.eligibility !== 'ALL') {
      rules.gender_eligibility = draft.eligibility;
    }
    const maxTimes = parseOptionalNumber(draft.maxTimesInService);
    if (maxTimes != null) rules.max_times_in_service = maxTimes;
    return Object.keys(rules).length > 0 ? rules : null;
  };

  const initializePolicyRow = async (rowCode: string) => {
    const leaveType = leaveTypes.find((item) => item.code === rowCode);
    if (!leaveType) return;
    setSavingPolicyKey(`${activePolicyCategory}::${rowCode}`);
    try {
      await entitlementRulesApi.create({
        category_code: activePolicyCategory,
        leave_type_code: rowCode,
        year_ref: 'CALENDAR',
        credit_frequency: 'ANNUAL',
      });
      const rulesRes = await entitlementRulesApi.list();
      setEntitlementRules(rulesRes.data || []);
      setMessage(`Initialized ${rowCode} for ${activePolicyCategory}. Configure and save.`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage(`Could not initialize ${rowCode}.`);
    } finally {
      setSavingPolicyKey('');
    }
  };

  const savePolicyRow = async (rowCode: string) => {
    const draftKey = `${activePolicyCategory}::${rowCode}`;
    const leaveType = leaveTypes.find((item) => item.code === rowCode);
    const rule = entitlementRuleMap.get(draftKey);
    if (!leaveType || !rule) { setMessage(`No rule exists for ${rowCode}. Click Initialize first.`); return; }

    const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
    setSavingPolicyKey(draftKey);
    try {
      const isTenure = draft.yearRef === 'TENURE';
      await entitlementRulesApi.update(rule.id, {
        year_ref: draft.yearRef,
        days_per_year: isTenure ? null : parseOptionalNumber(draft.annualCredit),
        credit_frequency: isTenure ? 'NONE' : draft.creditFrequency,
        max_at_a_stretch: parseOptionalNumber(draft.maxAtATime),
        max_in_tenure: parseOptionalNumber(draft.maxInTenure),
        special_rules: buildSpecialRules(draft),
      });
      await leaveTypesApi.update(leaveType.id, { max_accumulation: parseOptionalNumber(draft.maxAccumulation) });
      const [rulesRes, ltRes] = await Promise.all([entitlementRulesApi.list(), leaveTypesApi.list({ include_inactive: true })]);
      setEntitlementRules(rulesRes.data || []); setLeaveTypes(ltRes.data || []);
      setMessage(`Saved ${rowCode}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch {
      setMessage('Failed to save policy.');
    } finally {
      setSavingPolicyKey('');
    }
  };

  if (role !== 'ADMIN' || adminToken) return <Navigate to="/" replace />;

  const currentModuleDef = MODULES.find(m => m.id === activeModule) || MODULES[0];
  const displayName = adminUser?.name || adminUser?.username || 'Admin';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();
  const backupAge = backupAgeLabel(dashboard?.last_backup);
  const roleBreakdown = summary?.users.by_role ?? institution.byRole;
  const recentErrors = dashboard?.recent_errors_24h ?? 0;
  const errorRatePct = dashboard?.error_rate != null ? Math.round(dashboard.error_rate * 1000) / 10 : 0;
  const showAllClear = !summaryLoading && institution.attentionItems === 0 && recentErrors === 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={activeModule === 'dashboard' ? `${greeting}, ${displayName}` : currentModuleDef.label}
        description={activeModule === 'dashboard' ? 'Institution overview, items needing attention, and quick admin shortcuts.' : undefined}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin', to: '/admin' }, { label: currentModuleDef.label }]}
      />

      {message && (
        <div className="px-5 py-3 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm font-medium shadow-sm flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-indigo-400 hover:text-indigo-600">&times;</button>
        </div>
      )}

      <div className="w-full bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden min-h-[700px] flex flex-col">
        <div className="p-8 flex-1 bg-white">
            {activeModule === 'dashboard' && (
              <div className="space-y-8">
                {showAllClear && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 font-medium">
                    All clear — no setup gaps or workflow backlogs flagged right now.
                  </div>
                )}

                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Needs attention</h3>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <AttentionCard
                      label="Unmapped users"
                      value={summaryLoading ? '…' : institution.unmappedUsers}
                      hint="Login exists but no employee record — link before leave can work."
                      tone={institution.unmappedUsers > 0 ? 'amber' : 'green'}
                      to="/admin?module=users"
                    />
                    <AttentionCard
                      label="Password resets"
                      value={summaryLoading ? '…' : institution.resetUsers}
                      hint="Accounts that must change password on next login."
                      tone={institution.resetUsers > 0 ? 'amber' : 'green'}
                      to="/admin?module=users"
                    />
                    <AttentionCard
                      label="Policy gaps"
                      value={summaryLoading ? '…' : institution.policyGaps}
                      hint="Category × leave type pairs missing entitlement rules."
                      tone={institution.policyGaps > 0 ? 'amber' : 'green'}
                      to="/admin?module=policy"
                    />
                    <AttentionCard
                      label="Pending leave apps"
                      value={summaryLoading ? '…' : institution.pendingLeaves}
                      hint="Applications waiting in the approval workflow."
                      tone={institution.pendingLeaves > 0 ? 'amber' : 'green'}
                      to="/reports"
                    />
                    <AttentionCard
                      label="Depts without HOD"
                      value={summaryLoading ? '…' : institution.departmentsWithoutHod}
                      hint="Active departments with no head assigned — step 1 approvals may stall."
                      tone={institution.departmentsWithoutHod > 0 ? 'amber' : 'green'}
                      to="/masters?tab=hod-assignments"
                    />
                    <AttentionCard
                      label="Maintenance mode"
                      value={summaryLoading ? '…' : (institution.maintenanceMode ? 'ON' : 'Off')}
                      hint={institution.maintenanceMode ? 'Staff logins may be blocked — review immediately.' : 'System is open for normal use.'}
                      tone={institution.maintenanceMode ? 'red' : 'green'}
                      to="/admin/tools/maintenance"
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 mb-4">Institution snapshot</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SnapshotTile
                      label="Employees"
                      value={summaryLoading ? '…' : String(institution.employeesActive)}
                      sub={institution.employeesTotal ? `${institution.employeesTotal} total on record` : 'Counts load from summary API'}
                    />
                    <SnapshotTile
                      label="Active logins"
                      value={String(institution.activeUsers)}
                      sub={institution.inactiveUsers > 0 ? `${institution.inactiveUsers} inactive` : `${institution.adminUsers} admin account(s)`}
                    />
                    <SnapshotTile
                      label="Departments"
                      value={institution.masters ? String(institution.masters.departments.active) : '—'}
                      sub={institution.masters ? `${institution.masters.departments.inactive} inactive` : undefined}
                    />
                    <SnapshotTile
                      label="Leave types"
                      value={institution.masters ? String(institution.masters.leave_types.active) : String(leaveTypes.filter((lt) => lt.is_active !== false).length)}
                      sub={institution.masters ? `${institution.masters.designations.active} designations` : undefined}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Users by role</div>
                    <div className="flex flex-wrap gap-2">
                      {SYSTEM_ROLES.map((r) => {
                        const count = roleBreakdown[r.code] ?? 0;
                        return (
                          <span key={r.code} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            <span>{r.label}</span>
                            <span className="rounded-md bg-white px-1.5 py-0.5 font-black text-slate-900">{count}</span>
                          </span>
                        );
                      })}
                    </div>
                    {institution.masters && (
                      <p className="text-xs text-slate-500 mt-3">
                        Nodal offices: {institution.masters.nodal_offices.active} active
                        {institution.masters.nodal_by_scheme.CCS != null && ` · Establishment/CCS: ${institution.masters.nodal_by_scheme.CCS ?? 0}`}
                        {institution.masters.nodal_by_scheme.RESIDENCY != null && ` · Registrar/Residents: ${institution.masters.nodal_by_scheme.RESIDENCY ?? 0}`}
                      </p>
                    )}
                  </div>
                </section>

                <div className="grid gap-6 xl:grid-cols-3">
                  <section className="xl:col-span-1 rounded-3xl border-2 border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Quick actions</h3>
                    <div className="space-y-2">
                      <QuickActionLink to="/masters" primary>Masters hub</QuickActionLink>
                      <QuickActionLink to="/admin?module=users">Users &amp; roles</QuickActionLink>
                      <QuickActionLink to="/admin?module=policy">Leave policy matrix</QuickActionLink>
                      <QuickActionLink to="/reports">Reports</QuickActionLink>
                      <QuickActionLink to="/admin/tools/maintenance">Admin tools</QuickActionLink>
                      <QuickActionLink to="/employees?tab=onboard">Onboard employee</QuickActionLink>
                    </div>
                  </section>

                  <section className="xl:col-span-1 rounded-3xl border-2 border-slate-100 p-6 flex flex-col">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Icons.Audit className="w-5 h-5 text-indigo-500" />
                        Recent audit
                      </h3>
                      <Link to="/admin?module=audit" className="text-xs font-bold text-indigo-600 hover:underline">View all</Link>
                    </div>
                    <div className="flex-1 divide-y divide-slate-100 -mx-2">
                      {auditRows.length === 0 ? (
                        <p className="px-2 py-6 text-sm text-slate-400 text-center">No audit entries yet.</p>
                      ) : (
                        auditRows.slice(0, 8).map((row) => (
                          <div key={row.id} className="px-2 py-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                row.action?.includes('OVERRIDE') ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'
                              }`}>
                                {row.action?.replace(/_/g, ' ') ?? 'ACTION'}
                              </span>
                              <span className="text-[10px] text-slate-400 shrink-0">{formatDateTime(row.created_at)}</span>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">
                              {row.entity_type ?? 'record'}
                              {row.entity_id ? ` · ${row.entity_id.substring(0, 8)}…` : ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  <section className="xl:col-span-1 rounded-3xl border-2 border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Icons.Workflow className="w-5 h-5 text-indigo-500" />
                      System health
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-600">Failed notifications (24h)</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${recentErrors > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {recentErrors}
                          {dashboard?.error_rate != null && recentErrors > 0 ? ` (${errorRatePct}%)` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-600">Notification queue</span>
                        <span className="text-sm font-bold text-slate-900">{dashboard?.queue_depth ?? 0} pending</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-600">DB connection pool</span>
                        <span className="text-sm font-bold text-slate-900">{dashboard?.db_pool_checked_in ?? 0} / {dashboard?.db_pool_size ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-sm text-slate-600">Last backup</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${backupAge.stale ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                          {dashboard?.last_backup ? backupAge.text : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-slate-600">Maintenance</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${institution.maintenanceMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {institution.maintenanceMode ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <details className="mt-5 rounded-2xl border border-rose-100 bg-rose-50/50">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-rose-800">Emergency: force logout</summary>
                      <div className="px-4 pb-4 space-y-3">
                        <p className="text-xs text-rose-700">Invalidate all sessions for a compromised account.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} className="flex-1 rounded-xl border border-rose-200 px-3 py-2 text-sm bg-white">
                            <option value="">Select user…</option>
                            {users.map((u) => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                          </select>
                          <button type="button" onClick={() => void runForceLogout()} disabled={!forceLogoutUserId} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-4 py-2 rounded-xl disabled:opacity-50">
                            Force logout
                          </button>
                        </div>
                      </div>
                    </details>
                  </section>
                </div>
              </div>
            )}

            {activeModule === 'policy' && (
              <div className="space-y-6">
                {loadError && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{loadError}</div>
                )}
                {leaveTypes.length === 0 && !loadError && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    No leave types found. Run <code className="text-xs bg-white px-1 py-0.5 rounded">cd backend && python seeds/run.py</code> to load leave types and entitlement rules, then refresh this page.
                  </div>
                )}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 space-y-1">
                  <p><strong>EL</strong> and <strong>HPL</strong> are credited <strong>half-yearly</strong> (15+15 and 10+10 days). <strong>ML / PL / CCL</strong> use a <strong>tenure pool</strong> (total days in service) with optional <strong>max times</strong> and <strong>gender</strong> rules (e.g. CCL female only, PL male only).</p>
                </div>
                <div className="flex flex-wrap gap-2 mb-6 p-2 bg-slate-50 rounded-2xl inline-flex border border-slate-200">
                  {POLICY_CATEGORY_CODES.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActivePolicyCategory(category)}
                      className={`rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${
                        activePolicyCategory === category ? 'bg-slate-900 text-white shadow-md' : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {category.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-3xl border-2 border-slate-200 shadow-sm">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-xs">
                      <tr>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Leave Type</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Year Basis</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Days / Yr</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Credit Freq.</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Max Stretch</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Max Tenure</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Max Times</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Eligibility</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200">Status</th>
                        <th className="px-4 py-4 border-b-2 border-slate-200 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {policyRows.map((row) => {
                        const draftKey = `${activePolicyCategory}::${row.code}`;
                        const rule = entitlementRuleMap.get(draftKey);
                        const leaveType = leaveTypes.find((item) => item.code === row.code)!;
                        const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
                        const isTenure = draft.yearRef === 'TENURE';
                        return (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900">{row.code}</div>
                            <div className="text-xs font-medium text-slate-500 mt-0.5 max-w-[140px] whitespace-normal">{row.name}</div>
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={draft.yearRef}
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, yearRef: e.target.value }))}
                              disabled={!rule}
                              className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-xs font-medium min-w-[6.5rem] disabled:opacity-50"
                            >
                              <option value="CALENDAR">Calendar</option>
                              <option value="TENURE">Tenure / service</option>
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="number" step="0.5"
                              value={isTenure ? '' : draft.annualCredit}
                              disabled={!rule || isTenure}
                              placeholder={isTenure ? '—' : '30'}
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, annualCredit: e.target.value }))}
                              className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm font-medium disabled:bg-slate-100"
                            />
                            {draft.creditFrequency === 'HALF_YEARLY' && draft.annualCredit && !isTenure && (
                              <div className="text-[10px] text-slate-500 mt-0.5">{Number(draft.annualCredit) / 2}/half</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isTenure ? (
                              <span className="text-xs text-slate-600">Tenure pool</span>
                            ) : (
                              <select
                                value={draft.creditFrequency}
                                disabled={!rule}
                                onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, creditFrequency: e.target.value }))}
                                className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-xs font-medium min-w-[7rem] disabled:opacity-50"
                              >
                                <option value="ANNUAL">Annual</option>
                                <option value="HALF_YEARLY">Half-yearly</option>
                                <option value="MONTHLY">Monthly</option>
                              </select>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={draft.maxAtATime} disabled={!rule}
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxAtATime: e.target.value }))}
                              className="w-16 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" step="0.5" value={draft.maxInTenure} disabled={!rule}
                              placeholder={isTenure ? '180' : '—'}
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxInTenure: e.target.value }))}
                              className="w-20 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" value={draft.maxTimesInService} disabled={!rule}
                              placeholder="2"
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, maxTimesInService: e.target.value }))}
                              className="w-14 rounded-lg border-2 border-slate-200 px-2 py-1.5 text-sm disabled:opacity-50" />
                          </td>
                          <td className="px-4 py-3">
                            <select value={draft.eligibility} disabled={!rule}
                              onChange={(e) => updatePolicyDraft(draftKey, (c) => ({ ...c, eligibility: e.target.value as EligibilityOption }))}
                              className="rounded-lg border-2 border-slate-200 px-2 py-1.5 text-xs font-medium min-w-[6.5rem] disabled:opacity-50"
                            >
                              {ELIGIBILITY_OPTIONS.map((opt) => (
                                <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase ${row.statusTone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {row.statusTone === 'ok' ? (
                              <button
                                disabled={savingPolicyKey === draftKey}
                                onClick={() => void savePolicyRow(row.code)}
                                className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                              >
                                {savingPolicyKey === draftKey ? 'Saving...' : 'Save'}
                              </button>
                            ) : (
                              <button
                                disabled={savingPolicyKey === draftKey}
                                onClick={() => void initializePolicyRow(row.code)}
                                className="rounded-xl border-2 border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white disabled:opacity-50"
                              >
                                Initialize
                              </button>
                            )}
                          </td>
                        </tr>
                      );})}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeModule === 'users' && (
              <div className="space-y-6">
                {usersLoadError && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 flex items-center justify-between gap-3">
                    <span>{usersLoadError}</span>
                    <button type="button" onClick={() => void loadUsers()} className="shrink-0 text-xs font-bold underline">Retry</button>
                  </div>
                )}

                <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-sm text-indigo-900">
                  <span className="font-bold">{impersonatableUsers.length}</span> account(s) available for Login As
                  {usersLoading ? ' — loading…' : userSearchTerm.trim() ? ` (filtered from ${users.length} total)` : ` of ${users.length} total users`}.
                  Only active non-admin accounts can be impersonated.
                </div>

                <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-slate-700">
                    System roles reference ({SYSTEM_ROLES.length} roles)
                  </summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {SYSTEM_ROLES.map((r) => (
                      <div key={r.code} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="font-mono text-xs font-bold text-indigo-700">{r.code}</div>
                        <div className="text-sm font-semibold text-slate-800 mt-0.5">{r.label}</div>
                        <p className="text-xs text-slate-500 mt-1">{r.description}</p>
                      </div>
                    ))}
                  </div>
                </details>

                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-sm font-medium text-slate-600">Manage user access, roles, and impersonate accounts for troubleshooting.</p>
                  <input 
                    type="text" 
                    placeholder="Search Staff No, Name, Dept..." 
                    value={userSearchTerm} 
                    onChange={(e) => setUserSearchTerm(e.target.value)} 
                    className="w-full sm:w-64 px-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500 shadow-sm"
                  />
                </div>
                
                <div className="rounded-3xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-xs">
                        <tr>
                          <th className="px-6 py-4 border-b-2 border-slate-200">User Account</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Employee Details</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">System Role</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Status</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Last Login</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {usersLoading && (
                          <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">Loading users…</td></tr>
                        )}
                        {!usersLoading && filteredUsers.length === 0 && (
                          <tr><td colSpan={6} className="px-6 py-10 text-center text-slate-500">No users found{userSearchTerm.trim() ? ' for this search' : ''}.</td></tr>
                        )}
                        {!usersLoading && filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-900">{user.username}</div>
                              <div className="text-xs font-medium mt-1 flex items-center gap-2">
                                {user.employee_id ? (
                                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Linked</span>
                                ) : (
                                  <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md">Unmapped Account</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {user.employee_id ? (
                                <div>
                                  <div className="font-bold text-slate-800">{user.name} <span className="text-slate-500 font-normal">({user.emp_code})</span></div>
                                  <div className="text-xs text-slate-500 mt-1">{user.designation_name} &bull; {user.department_name}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No Employee Record</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 inline-block">
                                {roleLabel(user.role)}
                              </div>
                              <div className="text-[10px] font-mono text-slate-400 mt-1">{user.role}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase ${user.is_active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                {user.is_active === false ? 'Inactive' : 'Active'}
                              </span>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-500">
                              {formatDateTime(user.last_login)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              {user.is_active !== false && user.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleImpersonate(user.id)}
                                  className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                >
                                  Login As User
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeModule === 'audit' && (
              <div className="space-y-6">
                 <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <p className="text-sm font-medium text-slate-600">Complete immutable record of all system modifications and access events.</p>
                  <button onClick={() => void loadAudit()} className="bg-white border-2 border-slate-200 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm hover:border-slate-400">Refresh Audit Trail</button>
                </div>

                <div className="rounded-3xl border-2 border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider text-xs">
                        <tr>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Date & Time</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Actor</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Action Type</th>
                          <th className="px-6 py-4 border-b-2 border-slate-200">Target Entity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {auditRows.map((row) => (
                          <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-slate-500 font-medium">
                              {formatDateTime(row.created_at)}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-900">
                              {row.actor_id?.substring(0, 8) || 'SYSTEM'}...
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border ${
                                row.action?.includes('OVERRIDE') ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                'bg-slate-50 text-slate-700 border-slate-200'
                              }`}>
                                {row.action}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800">{row.entity_type}</div>
                              <div className="text-xs text-slate-400 font-mono mt-1 bg-slate-100 px-2 py-0.5 rounded-md inline-block">
                                {row.entity_id?.substring(0, 8)}...
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

        </div>
      </div>
    </div>
  );
}
