import { useEffect, useMemo, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { adminApi, authApi, usersApi } from '../api/endpoints';
import { entitlementRulesApi, leaveTypesApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { SYSTEM_ROLES } from '../constants/roles';

type LeaveTypeOption = { id: string; code: string; name: string; scheme?: string | null; is_accumulating?: boolean; max_accumulation?: number | null; requires_mc?: boolean; min_days_for_mc?: number | null; count_holidays?: boolean; is_half_day_allowed?: boolean; carry_forward?: boolean };
type UserOption = { id: string; username: string; role: string; is_active?: boolean; must_change_password?: boolean; employee_id?: string | null; last_login?: string | null; emp_code?: string | null; name?: string | null; department_name?: string | null; designation_name?: string | null; };
type AuditLogItem = { id: string; entity_type?: string | null; entity_id?: string | null; actor_id?: string | null; action?: string | null; created_at?: string | null };
type HealthDashboard = { queue_depth?: number; recent_errors_24h?: number; db_pool_size?: number; db_pool_checked_in?: number; last_backup?: string | null; error_rate?: number | null };
type EntitlementRule = { id: string; category_code: string; leave_type_code: string; year_ref?: string | null; credit_frequency?: string | null; days_per_year?: number | null; prorata_rate?: number | null; year1_days?: number | null; year2_plus_days?: number | null; max_at_a_stretch?: number | null; max_in_tenure?: number | null; carry_forward?: boolean };

type PolicyRowDraft = { annualCredit: string; creditFrequency: string; maxAtATime: string; maxInTenure: string; maxAccumulation: string };
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

function MetricCard({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'amber' | 'green' | 'red' }) {
  const colors = {
    default: 'bg-slate-50 text-slate-700 border-slate-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 shadow-sm shadow-amber-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm shadow-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-200 shadow-sm shadow-red-100'
  };
  return (
    <div className={`p-5 rounded-2xl border-2 flex flex-col ${colors[tone]}`}>
      <div className="text-xs font-bold uppercase tracking-wider mb-2 opacity-70">{label}</div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
}

export function AdminDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const role = useAuthStore((s) => s.user?.role);
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
  const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [entitlementRules, setEntitlementRules] = useState<EntitlementRule[]>([]);
  const [policyDraftEligibility, ] = useState<Record<string, EligibilityOption>>({});
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
        usersApi.list(),
        leaveTypesApi.list({ include_inactive: true }),
        entitlementRulesApi.list(),
        adminApi.auditLog({ skip: 0, limit: 50 }),
      ]);
      const [dashboardResult, usersResult, leaveTypesResult, rulesResult, auditResult] = results;
      if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value.data || {});
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

  const adminSummary = useMemo(() => {
    const activeUsers = users.filter((user) => user.is_active !== false).length;
    const adminUsers = users.filter((user) => user.role === 'ADMIN' && user.is_active !== false).length;
    const resetUsers = users.filter((user) => user.must_change_password).length;
    const unmappedUsers = users.filter((user) => !user.employee_id).length;
    return {
      activeUsers, adminUsers, resetUsers, unmappedUsers,
      queueDepth: dashboard?.queue_depth ?? 0,
      recentErrors: dashboard?.recent_errors_24h ?? 0,
    };
  }, [users, dashboard]);

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

  const entitlementRuleMap = useMemo(() => {
    const entries: Array<[string, EntitlementRule]> = entitlementRules.map((rule) => [`${rule.category_code}::${rule.leave_type_code}`, rule]);
    return new Map<string, EntitlementRule>(entries);
  }, [entitlementRules]);

  const ensurePolicyDraft = (leaveType: LeaveTypeOption, rule?: EntitlementRule): PolicyRowDraft => ({
    annualCredit: String(rule?.days_per_year ?? rule?.year1_days ?? ''),
    creditFrequency: rule?.credit_frequency || 'ANNUAL',
    maxAtATime: String(rule?.max_at_a_stretch ?? ''),
    maxInTenure: String(rule?.max_in_tenure ?? ''),
    maxAccumulation: String(leaveType.max_accumulation ?? ''),
  });

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
      const fallback = leaveType ? ensurePolicyDraft(leaveType, rule) : { annualCredit: '', creditFrequency: 'ANNUAL', maxAtATime: '', maxInTenure: '', maxAccumulation: '' };
      return { ...current, [draftKey]: updater(current[draftKey] || fallback) };
    });
  };

  const policyRows = useMemo(() => leaveTypes.map((leaveType) => {
    const rule = entitlementRuleMap.get(`${activePolicyCategory}::${leaveType.code}`);
    return {
      id: leaveType.id, code: leaveType.code, name: leaveType.name, scheme: leaveType.scheme || '-',
      eligibility: policyDraftEligibility[`${activePolicyCategory}::${leaveType.code}`] || 'ALL',
      status: rule ? 'Configured' : 'Missing', statusTone: rule ? 'ok' : 'warn'
    };
  }), [activePolicyCategory, entitlementRuleMap, leaveTypes, policyDraftEligibility]);

  const savePolicyRow = async (rowCode: string) => {
    const draftKey = `${activePolicyCategory}::${rowCode}`;
    const leaveType = leaveTypes.find((item) => item.code === rowCode);
    const rule = entitlementRuleMap.get(draftKey);
    if (!leaveType || !rule) { setMessage(`No rule exists for ${rowCode}.`); return; }

    const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
    setSavingPolicyKey(draftKey);
    try {
      await entitlementRulesApi.update(rule.id, {
        days_per_year: parseOptionalNumber(draft.annualCredit),
        credit_frequency: draft.creditFrequency,
        max_at_a_stretch: parseOptionalNumber(draft.maxAtATime),
        max_in_tenure: parseOptionalNumber(draft.maxInTenure),
      });
      await leaveTypesApi.update(leaveType.id, { max_accumulation: parseOptionalNumber(draft.maxAccumulation) });
      const [rulesRes, ltRes] = await Promise.all([entitlementRulesApi.list(), leaveTypesApi.list()]);
      setEntitlementRules(rulesRes.data || []); setLeaveTypes(ltRes.data || []);
      setMessage(`Saved ${rowCode}.`);
      setTimeout(() => setMessage(''), 3000);
    } catch (err: any) {
      setMessage('Failed to save policy.');
    } finally {
      setSavingPolicyKey('');
    }
  };

  if (role !== 'ADMIN' || adminToken) return <Navigate to="/" replace />;

  const currentModuleDef = MODULES.find(m => m.id === activeModule) || MODULES[0];

  return (
    <div className="space-y-6">
      <PageHeader 
        title={currentModuleDef.label}
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
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Active Accounts" value={String(adminSummary.activeUsers)} />
                  <MetricCard label="Users Requiring Reset" value={String(adminSummary.resetUsers)} tone={adminSummary.resetUsers > 0 ? 'amber' : 'green'} />
                  <MetricCard label="Unmapped Users" value={String(adminSummary.unmappedUsers)} tone={adminSummary.unmappedUsers > 0 ? 'amber' : 'green'} />
                  <MetricCard label="Recent API Errors" value={String(adminSummary.recentErrors)} tone={adminSummary.recentErrors > 0 ? 'red' : 'green'} />
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-3xl border-2 border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Icons.Workflow className="w-5 h-5 text-indigo-500"/> System Health</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-sm font-medium text-slate-600">Queue Depth</span>
                        <span className="text-sm font-bold text-slate-900 px-3 py-1 bg-slate-100 rounded-lg">{dashboard?.queue_depth ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-sm font-medium text-slate-600">DB Pool Usage</span>
                        <span className="text-sm font-bold text-slate-900 px-3 py-1 bg-slate-100 rounded-lg">{dashboard?.db_pool_checked_in ?? 0} / {dashboard?.db_pool_size ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-sm font-medium text-slate-600">Last Backup</span>
                        <span className="text-xs font-bold text-slate-900 px-3 py-1 bg-slate-100 rounded-lg">{dashboard?.last_backup ? formatDateTime(dashboard.last_backup) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl border-2 border-slate-100 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Icons.Dashboard className="w-5 h-5 text-rose-500"/> Emergency Actions</h3>
                    <div className="p-5 bg-rose-50 border border-rose-100 rounded-2xl space-y-4">
                      <p className="text-sm font-medium text-rose-800">Immediately invalidate all sessions for a compromised user account.</p>
                      <div className="flex gap-3">
                        <select value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} className="flex-1 rounded-xl border border-rose-200 px-4 py-2 text-sm focus:ring-rose-500">
                          <option value="">Select user...</option>
                          {users.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                        </select>
                        <button onClick={() => void runForceLogout()} disabled={!forceLogoutUserId} className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm px-5 py-2 rounded-xl disabled:opacity-50">
                          Force Logout
                        </button>
                      </div>
                    </div>
                  </div>
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
                        <th className="px-6 py-4 border-b-2 border-slate-200">Leave Type</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Days / Year</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Credit Frequency</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Max At A Time</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Max In Tenure</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Max Accumulation</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200">Status</th>
                        <th className="px-6 py-4 border-b-2 border-slate-200 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {policyRows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-bold text-slate-900">{row.code}</div>
                            <div className="text-xs font-medium text-slate-500 mt-1">{row.name}</div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number" step="0.5"
                              value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find(item => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).annualCredit}
                              onChange={(e) => updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, annualCredit: e.target.value }))}
                              className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find(item => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).creditFrequency}
                              onChange={(e) => updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, creditFrequency: e.target.value }))}
                              className="rounded-lg border-2 border-slate-200 px-2 py-2 text-xs focus:border-indigo-500 font-medium min-w-[9rem]"
                            >
                              <option value="ANNUAL">Annual</option>
                              <option value="HALF_YEARLY">Half-yearly</option>
                              <option value="MONTHLY">Monthly</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find(item => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxAtATime}
                              onChange={(e) => updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxAtATime: e.target.value }))}
                              className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number" step="0.5"
                              value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find(item => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxInTenure}
                              onChange={(e) => updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxInTenure: e.target.value }))}
                              className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="number"
                              value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find(item => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxAccumulation}
                              onChange={(e) => updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxAccumulation: e.target.value }))}
                              className="w-24 rounded-lg border-2 border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 font-medium"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${row.statusTone === 'ok' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {row.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              disabled={row.statusTone !== 'ok' || savingPolicyKey === `${activePolicyCategory}::${row.code}`}
                              onClick={() => void savePolicyRow(row.code)}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition-all active:scale-95"
                            >
                              {savingPolicyKey === `${activePolicyCategory}::${row.code}` ? 'Saving...' : 'Save Row'}
                            </button>
                          </td>
                        </tr>
                      ))}
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
                              <span className="font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{user.role}</span>
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
