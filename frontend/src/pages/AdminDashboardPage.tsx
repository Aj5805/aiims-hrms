import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, Navigate, useNavigate, Link } from 'react-router-dom';
import { adminApi, authApi, usersApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { SearchableSelect } from '../components/SearchableSelect';
import { useAuthStore } from '../stores';
import { SYSTEM_ROLES, roleLabel } from '../constants/roles';

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
type AdminModuleId = 'dashboard' | 'users' | 'audit';
const VALID_MODULES = new Set<AdminModuleId>(['dashboard', 'users', 'audit']);

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
  Users: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Workflow: (props: any) => <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
};

const MODULES: { id: AdminModuleId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
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
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">{label}</div>
      <div className={`text-xl font-black mt-0.5 ${valueColors[tone]}`}>{value}</div>
      {tone !== 'green' && hint && (
        <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">{hint}</p>
      )}
    </>
  );
  const className = `p-2 rounded-md border text-left transition-colors ${colors[tone]} ${to || onClick ? 'cursor-pointer' : ''}`;
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
    <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-black text-slate-900 mt-0.5">{value}</div>
      {sub && <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{sub}</p>}
    </div>
  );
}

function QuickActionLink({ to, children, primary }: { to: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`block rounded-md px-2.5 py-1.5 text-xs font-bold transition-colors text-center ${
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

export function AdminDashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const role = useAuthStore((s) => s.user?.role);
  const adminUser = useAuthStore((s) => s.user);
  const adminToken = useAuthStore((s) => s.adminToken);
  
  const rawModule = new URLSearchParams(location.search).get('module');

  useEffect(() => {
    if (rawModule === 'policy') {
      navigate('/masters?tab=entitlements', { replace: true });
    }
  }, [rawModule, navigate]);

  const activeModule: AdminModuleId =
    rawModule && VALID_MODULES.has(rawModule as AdminModuleId)
      ? (rawModule as AdminModuleId)
      : 'dashboard';

  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [message, setMessage] = useState('');
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
      const results = await Promise.allSettled([
        adminApi.healthDashboard(),
        adminApi.summary(),
        usersApi.list(),
      ]);
      const [dashboardResult, summaryResult, usersResult] = results;
      if (dashboardResult.status === 'fulfilled') setDashboard(dashboardResult.value.data || {});
      if (summaryResult.status === 'fulfilled') setSummary(summaryResult.value.data || null);
      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value.data || []);
        setUsersLoadError('');
      } else {
        setUsersLoadError('Could not load users. Run `cd backend && alembic upgrade head`, then refresh this page.');
      }
      setSummaryLoading(false);
    };
    void bootstrap();
  }, []);

  useEffect(() => {
    if (activeModule === 'users') void loadUsers();
    if (activeModule === 'audit') void loadAudit();
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

  const institution = useMemo(() => {
    const activeUsers = users.filter((user) => user.is_active !== false).length;
    const inactiveUsers = users.filter((user) => user.is_active === false).length;
    const adminUsers = users.filter((user) => user.role === 'ADMIN' && user.is_active !== false).length;
    const resetUsers = users.filter((user) => user.must_change_password).length;
    const unmappedUsers = users.filter((user) => !user.employee_id).length;
    const policyGaps = summary?.policy.missing_rules ?? 0;
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
      policyGaps,
      pendingLeaves: summary?.workflow.pending_applications ?? 0,
      departmentsWithoutHod: summary?.hod.departments_without_hod ?? 0,
      employeesTotal: summary?.employees.total ?? 0,
      employeesActive: summary?.employees.active ?? 0,
      maintenanceMode: summary?.maintenance_mode ?? false,
      masters: summary?.masters ?? null,
      attentionItems: summary?.attention_items ?? (unmappedUsers + resetUsers + policyGaps),
    };
  }, [users, summary]);

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

  const forceLogoutOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: `${u.username} (${u.role})`,
        searchText: `${u.name ?? ''} ${u.emp_code ?? ''}`,
      })),
    [users],
  );

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
    <div className="space-y-3">
      <PageHeader
        title={activeModule === 'dashboard' ? `${greeting}, ${displayName}` : currentModuleDef.label}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin', to: '/admin' }, { label: currentModuleDef.label }]}
        hideTitle={activeModule !== 'dashboard'}
      />

      {message && (
        <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 text-sm font-medium flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="text-indigo-400 hover:text-indigo-600">&times;</button>
        </div>
      )}

      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="p-4 sm:p-5 flex-1 bg-white">
            {activeModule === 'dashboard' && (
              <div className="space-y-5">
                {showAllClear && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 font-medium">
                    All clear — no setup gaps flagged.
                  </div>
                )}

                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Needs attention</h3>
                  <div className="grid gap-1.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                    <AttentionCard
                      label="Unmapped users"
                      value={summaryLoading ? '…' : institution.unmappedUsers}
                      hint="No employee linked"
                      tone={institution.unmappedUsers > 0 ? 'amber' : 'green'}
                      to="/admin?module=users"
                    />
                    <AttentionCard
                      label="Password resets"
                      value={summaryLoading ? '…' : institution.resetUsers}
                      hint="Must change password"
                      tone={institution.resetUsers > 0 ? 'amber' : 'green'}
                      to="/admin?module=users"
                    />
                    <AttentionCard
                      label="Policy gaps"
                      value={summaryLoading ? '…' : institution.policyGaps}
                      hint="Missing entitlement rules"
                      tone={institution.policyGaps > 0 ? 'amber' : 'green'}
                      to="/masters?tab=entitlements"
                    />
                    <AttentionCard
                      label="Pending leave apps"
                      value={summaryLoading ? '…' : institution.pendingLeaves}
                      hint="Awaiting approval"
                      tone={institution.pendingLeaves > 0 ? 'amber' : 'green'}
                      to="/reports"
                    />
                    <AttentionCard
                      label="Depts without HOD"
                      value={summaryLoading ? '…' : institution.departmentsWithoutHod}
                      hint="No HOD assigned"
                      tone={institution.departmentsWithoutHod > 0 ? 'amber' : 'green'}
                      to="/masters?tab=hod-assignments"
                    />
                    <AttentionCard
                      label="Maintenance mode"
                      value={summaryLoading ? '…' : (institution.maintenanceMode ? 'ON' : 'Off')}
                      hint={institution.maintenanceMode ? 'Staff logins blocked' : 'Normal operation'}
                      tone={institution.maintenanceMode ? 'red' : 'green'}
                      to="/admin/tools/maintenance"
                    />
                  </div>
                </section>

                <section>
                  <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Institution snapshot</h3>
                  <div className="grid gap-1.5 grid-cols-2 md:grid-cols-4">
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
                      value={institution.masters ? String(institution.masters.leave_types.active) : '—'}
                      sub={institution.masters ? `${institution.masters.designations.active} designations` : undefined}
                    />
                  </div>

                  <div className="mt-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Users by role</div>
                    <div className="flex flex-wrap gap-1">
                      {SYSTEM_ROLES.map((r) => {
                        const count = roleBreakdown[r.code] ?? 0;
                        return (
                          <span key={r.code} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                            <span>{r.label}</span>
                            <span className="rounded bg-white px-1 py-px font-black text-slate-900">{count}</span>
                          </span>
                        );
                      })}
                    </div>
                    {institution.masters && (
                      <p className="text-[10px] text-slate-500 mt-1.5">
                        Nodal offices: {institution.masters.nodal_offices.active} active
                        {institution.masters.nodal_by_scheme.CCS != null && ` · Establishment/CCS: ${institution.masters.nodal_by_scheme.CCS ?? 0}`}
                        {institution.masters.nodal_by_scheme.RESIDENCY != null && ` · Registrar/Residents: ${institution.masters.nodal_by_scheme.RESIDENCY ?? 0}`}
                      </p>
                    )}
                  </div>
                </section>

                <div className="grid gap-3 lg:grid-cols-2">
                  <section className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-bold text-slate-800 mb-2">Quick actions</h3>
                    <div className="grid grid-cols-2 gap-1.5">
                      <QuickActionLink to="/masters" primary>Masters hub</QuickActionLink>
                      <QuickActionLink to="/admin?module=users">Users &amp; roles</QuickActionLink>
                      <QuickActionLink to="/masters?tab=entitlements">Leave policy</QuickActionLink>
                      <QuickActionLink to="/reports">Reports</QuickActionLink>
                      <QuickActionLink to="/admin/tools/maintenance">Admin tools</QuickActionLink>
                      <QuickActionLink to="/employees?tab=onboard">Onboard employee</QuickActionLink>
                      <QuickActionLink to="/employees?tab=deactivate">Resign / deactivate</QuickActionLink>
                      <QuickActionLink to="/admin?module=audit">Audit &amp; health</QuickActionLink>
                    </div>
                  </section>

                  <section className="rounded-lg border border-slate-200 p-3">
                    <h3 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                      <Icons.Workflow className="w-4 h-4 text-indigo-500" />
                      System health
                    </h3>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center py-1 border-b border-slate-50 text-sm">
                        <span className="text-slate-600">Failed notifications (24h)</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded-lg ${recentErrors > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {recentErrors}
                          {dashboard?.error_rate != null && recentErrors > 0 ? ` (${errorRatePct}%)` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50 text-sm">
                        <span className="text-slate-600">Notification queue</span>
                        <span className="text-sm font-bold text-slate-900">{dashboard?.queue_depth ?? 0} pending</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50 text-sm">
                        <span className="text-slate-600">DB connection pool</span>
                        <span className="text-sm font-bold text-slate-900">{dashboard?.db_pool_checked_in ?? 0} / {dashboard?.db_pool_size ?? 0}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50 text-sm">
                        <span className="text-slate-600">Last backup</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${backupAge.stale ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'}`}>
                          {dashboard?.last_backup ? backupAge.text : 'N/A'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 text-sm">
                        <span className="text-slate-600">Maintenance</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${institution.maintenanceMode ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {institution.maintenanceMode ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </div>

                    <details className="mt-3 rounded-md border border-rose-100 bg-rose-50/50">
                      <summary className="cursor-pointer px-3 py-2 text-xs font-bold text-rose-800">Emergency: force logout</summary>
                      <div className="px-3 pb-3 space-y-2">
                        <p className="text-xs text-rose-700">Invalidate all sessions for a compromised account.</p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <SearchableSelect
                            options={forceLogoutOptions}
                            value={forceLogoutUserId}
                            onChange={setForceLogoutUserId}
                            placeholder="Search or select user…"
                            className="flex-1"
                          />
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

            {activeModule === 'users' && (
              <div className="space-y-3">
                {usersLoadError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex items-center justify-between gap-3">
                    <span>{usersLoadError}</span>
                    <button type="button" onClick={() => void loadUsers()} className="shrink-0 text-xs font-bold underline">Retry</button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">{impersonatableUsers.length}</span> impersonatable
                    {usersLoading ? '…' : ` of ${users.length}`} ·{' '}
                    <details className="inline">
                      <summary className="cursor-pointer text-indigo-600 font-medium">Role reference</summary>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {SYSTEM_ROLES.map((r) => (
                          <div key={r.code} className="rounded border border-slate-200 bg-white p-2 text-left">
                            <div className="font-mono text-[10px] font-bold text-indigo-700">{r.code}</div>
                            <div className="text-xs font-semibold text-slate-800">{r.label}</div>
                            <p className="text-[10px] text-slate-500 mt-0.5">{r.description}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                  </p>
                  <input
                    type="text"
                    placeholder="Search Staff No, Name, Dept…"
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="w-full sm:w-56 px-3 py-1.5 rounded-md border border-slate-300 text-sm focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table data-table-compact whitespace-nowrap">
                      <thead>
                        <tr>
                          <th>User Account</th>
                          <th>Employee Details</th>
                          <th>System Role</th>
                          <th>Status</th>
                          <th>Last Login</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersLoading && (
                          <tr><td colSpan={6} className="text-center text-slate-500 py-4">Loading users…</td></tr>
                        )}
                        {!usersLoading && filteredUsers.length === 0 && (
                          <tr><td colSpan={6} className="text-center text-slate-500 py-4">No users found{userSearchTerm.trim() ? ' for this search' : ''}.</td></tr>
                        )}
                        {!usersLoading && filteredUsers.map((user) => (
                          <tr key={user.id}>
                            <td>
                              <div className="font-medium text-slate-900">{user.username}</div>
                              <div className="text-[10px] mt-0.5">
                                {user.employee_id ? (
                                  <span className="text-emerald-700">Linked</span>
                                ) : (
                                  <span className="text-amber-700">Unmapped</span>
                                )}
                              </div>
                            </td>
                            <td>
                              {user.employee_id ? (
                                <div>
                                  <div className="font-medium text-slate-800">{user.name} <span className="text-slate-500 font-normal">({user.emp_code})</span></div>
                                  <div className="text-[10px] text-slate-500">{user.designation_name} · {user.department_name}</div>
                                </div>
                              ) : (
                                <span className="text-slate-400 italic">No employee record</span>
                              )}
                            </td>
                            <td>
                              <div className="font-medium text-slate-700">{roleLabel(user.role)}</div>
                              <div className="text-[10px] font-mono text-slate-400">{user.role}</div>
                            </td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase ${user.is_active === false ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {user.is_active === false ? 'Inactive' : 'Active'}
                              </span>
                            </td>
                            <td className="text-slate-500">
                              {formatDateTime(user.last_login)}
                            </td>
                            <td className="text-right">
                              {user.is_active !== false && user.role !== 'ADMIN' && (
                                <button
                                  onClick={() => handleImpersonate(user.id)}
                                  className="btn btn-sm bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-600 hover:text-white"
                                >
                                  Login as
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
              <div className="space-y-3">
                 <div className="flex justify-between items-center gap-2">
                  <p className="text-xs text-slate-600">System audit log</p>
                  <button onClick={() => void loadAudit()} className="bg-white border border-slate-200 rounded-md px-3 py-1.5 text-xs font-bold hover:border-slate-400">Refresh</button>
                </div>

                <div className="card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="data-table data-table-compact whitespace-nowrap">
                      <thead>
                        <tr>
                          <th>Date & Time</th>
                          <th>Actor</th>
                          <th>Action Type</th>
                          <th>Target Entity</th>
                        </tr>
                      </thead>
                      <tbody>
                        {auditRows.map((row) => (
                          <tr key={row.id}>
                            <td className="text-slate-500">
                              {formatDateTime(row.created_at)}
                            </td>
                            <td className="font-medium text-slate-900">
                              {row.actor_id?.substring(0, 8) || 'SYSTEM'}…
                            </td>
                            <td>
                              <span className={`text-[10px] font-semibold uppercase ${
                                row.action?.includes('OVERRIDE') ? 'text-rose-700' : 'text-slate-600'
                              }`}>
                                {row.action}
                              </span>
                            </td>
                            <td>
                              <div className="font-medium text-slate-800">{row.entity_type}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {row.entity_id?.substring(0, 8)}…
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
