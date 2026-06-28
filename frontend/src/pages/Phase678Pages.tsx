import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { adminApi, authApi, departmentsApi, notificationsApi, reportsApi, usersApi } from '../api/endpoints';
import { entitlementRulesApi, leaveTypesApi } from '../api/phase3_endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';

type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  scheme?: string | null;
  is_accumulating?: boolean;
  max_accumulation?: number | null;
  requires_mc?: boolean;
  min_days_for_mc?: number | null;
  count_holidays?: boolean;
  is_half_day_allowed?: boolean;
  carry_forward?: boolean;
  validation_rules?: Record<string, unknown> | null;
};

type UserOption = {
  id: string;
  username: string;
  role: string;
  is_active?: boolean;
  must_change_password?: boolean;
  employee_id?: string | null;
  last_login?: string | null;
};

type NotificationItem = {
  id: string;
  subject?: string | null;
  body?: string | null;
  app_number?: string | null;
  created_at?: string | null;
  status?: string | null;
};

type AuditLogItem = {
  id: string;
  entity_type?: string | null;
  entity_id?: string | null;
  actor_id?: string | null;
  action?: string | null;
  created_at?: string | null;
};

type HealthDashboard = {
  queue_depth?: number;
  recent_errors_24h?: number;
  db_pool_size?: number;
  db_pool_checked_in?: number;
  last_backup?: string | null;
  error_rate?: number | null;
};

type EntitlementRule = {
  id: string;
  category_code: string;
  leave_type_code: string;
  year_ref?: string | null;
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
  maxAtATime: string;
  maxInTenure: string;
  maxAccumulation: string;
};

type AdminModuleId =
  | 'dashboard'
  | 'policy'
  | 'workflow'
  | 'employees'
  | 'users'
  | 'calendar'
  | 'balances'
  | 'audit';

type AdminModule = {
  id: AdminModuleId;
  label: string;
  blurb: string;
};

const ADMIN_MODULES: AdminModule[] = [
  { id: 'dashboard', label: 'Dashboard', blurb: 'Control center and alerts' },
  { id: 'policy', label: 'Leave Policy Matrix', blurb: 'Category-wise policy control' },
  { id: 'workflow', label: 'Workflow Policy', blurb: 'Chains, routing, and simulation' },
  { id: 'employees', label: 'Employees', blurb: 'Master data and mapping health' },
  { id: 'users', label: 'Users & Roles', blurb: 'Access, reset, and activation' },
  { id: 'calendar', label: 'Calendars & Holidays', blurb: 'Holiday master and leave view' },
  { id: 'balances', label: 'Balances & Credits', blurb: 'Opening, year-end, and exceptions' },
  { id: 'audit', label: 'Audit & Health', blurb: 'Audit trail and system health' },
];

const POLICY_CATEGORY_CODES = ['FACULTY', 'NURSING', 'ADMIN', 'JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA'] as const;
type PolicyCategoryCode = (typeof POLICY_CATEGORY_CODES)[number];

const ELIGIBILITY_OPTIONS = ['ALL', 'NONE', 'MALE_ONLY', 'FEMALE_ONLY'] as const;
type EligibilityOption = (typeof ELIGIBILITY_OPTIONS)[number];

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

/** Strip HTML tags and decode entities for plain-text notification previews. */
function stripHtml(html: string): string {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return (tmp.textContent ?? tmp.innerText ?? '').trim();
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function inferFilename(response: AxiosResponse<Blob>, fallbackBase: string): string {
  const disposition = response.headers['content-disposition'] as string | undefined;
  const contentType = String(response.headers['content-type'] || '');
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  if (match?.[1]) return match[1];
  if (contentType.includes('pdf')) return `${fallbackBase}.pdf`;
  if (contentType.includes('csv')) return `${fallbackBase}.csv`;
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return `${fallbackBase}.xlsx`;
  if (contentType.includes('json')) return `${fallbackBase}.json`;
  return fallbackBase;
}

function PageNotice({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">{children}</div>;
}

function SectionCard({
  title,
  subtitle,
  children,
  actions,
  tone = 'default',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  actions?: ReactNode;
  tone?: 'default' | 'warm' | 'cool';
}) {
  const toneClass =
    tone === 'warm'
      ? 'border-amber-200 bg-amber-50/60'
      : tone === 'cool'
        ? 'border-sky-200 bg-sky-50/60'
        : 'border-slate-200 bg-white';
  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${toneClass}`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = 'default',
}: {
  label: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'amber' | 'red' | 'green';
}) {
  const toneClass =
    tone === 'amber'
      ? 'border-amber-200 bg-amber-50'
      : tone === 'red'
        ? 'border-rose-200 bg-rose-50'
        : tone === 'green'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white';
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
      {helper && <div className="mt-2 text-xs text-slate-500">{helper}</div>}
    </div>
  );
}

function QuickLink({
  title,
  blurb,
  to,
  badge,
}: {
  title: string;
  blurb: string;
  to?: string;
  badge?: string;
}) {
  const content = (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-900">{title}</div>
        {badge && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{badge}</span>}
      </div>
      <p className="mt-2 text-sm text-slate-600">{blurb}</p>
    </div>
  );
  return to ? <Link to={to}>{content}</Link> : content;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const loadUnreadCount = async () => {
    const { data } = await notificationsApi.unreadCount();
    setUnreadCount(Number(data.count || 0));
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const { data } = await notificationsApi.list();
      setItems(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadUnreadCount();
    const timer = window.setInterval(() => void loadUnreadCount(), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id);
    setUnreadCount((current) => Math.max(0, current - 1));
    await loadItems();
  };

  const markAllRead = async () => {
    await notificationsApi.markAllRead();
    setUnreadCount(0);
    await loadItems();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((current) => !current)}
        className="relative rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:border-blue-300 hover:text-blue-700"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-red-600 px-1.5 text-center text-[11px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-96 rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Notifications</div>
              <div className="text-xs text-slate-500">{unreadCount} unread</div>
            </div>
            <button onClick={() => void markAllRead()} className="text-xs font-medium text-blue-700 hover:text-blue-900">
              Mark all read
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && <div className="px-4 py-6 text-sm text-slate-500">Loading...</div>}
            {!loading && items.length === 0 && <div className="px-4 py-6 text-sm text-slate-500">No notifications.</div>}
            {!loading &&
              items.map((item) => (
                <div key={item.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{item.subject || 'HRMS notification'}</div>
                      <div className="mt-1 text-xs text-slate-600">{item.body ? stripHtml(item.body) : 'No message body provided.'}</div>
                      {item.app_number && <div className="mt-1 text-xs text-slate-500">Application: {item.app_number}</div>}
                      <div className="mt-1 text-[11px] text-slate-400">{formatDateTime(item.created_at)}</div>
                    </div>
                    {(item.status || '').toUpperCase() === 'PENDING' && (
                      <button onClick={() => void markRead(item.id)} className="text-xs font-medium text-blue-700 hover:text-blue-900">
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReportsPage() {
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [message, setMessage] = useState('');
  const [loadingKey, setLoadingKey] = useState('');
  const [shared, setShared] = useState({
    from_date: '',
    to_date: '',
    department_code: '',
    leave_type_code: '',
    as_of_date: '',
    month: '',
  });

  useEffect(() => {
    const loadFilters = async () => {
      const [deptResponse, leaveTypeResponse] = await Promise.all([departmentsApi.list(), leaveTypesApi.list()]);
      setDepartments(deptResponse.data || []);
      setLeaveTypes(leaveTypeResponse.data || []);
    };
    void loadFilters();
  }, []);

  const runDownload = async (key: string, fallbackBase: string, call: () => Promise<AxiosResponse<Blob>>) => {
    setLoadingKey(key);
    setMessage('');
    try {
      const response = await call();
      const filename = inferFilename(response, fallbackBase);
      saveBlob(response.data, filename);
      setMessage(`Downloaded ${filename}.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Download failed');
    } finally {
      setLoadingKey('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin', to: '/admin' }, { label: 'Reports' }]}
        title="Reports & Payroll Export"
        description="Phase 7 report downloads now stream the locked file formats from the backend."
      />

      {message && <PageNotice>{message}</PageNotice>}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
          <div className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Shared Filters</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input type="date" value={shared.from_date} onChange={(e) => setShared({ ...shared, from_date: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={shared.to_date} onChange={(e) => setShared({ ...shared, to_date: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <select value={shared.department_code} onChange={(e) => setShared({ ...shared, department_code: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All departments</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.code}>
                  {dept.code} - {dept.name}
                </option>
              ))}
            </select>
            <select value={shared.leave_type_code} onChange={(e) => setShared({ ...shared, leave_type_code: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">All leave types</option>
              {leaveTypes.map((leaveType) => (
                <option key={leaveType.id} value={leaveType.code}>
                  {leaveType.code} - {leaveType.name}
                </option>
              ))}
            </select>
            <input type="date" value={shared.as_of_date} onChange={(e) => setShared({ ...shared, as_of_date: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input type="month" value={shared.month} onChange={(e) => setShared({ ...shared, month: e.target.value })} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <ReportCard
          title="Leave Register"
          description="Locked columns with both XLSX and PDF exports."
          controls={['Emp Code', 'Name', 'Dept', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Approval Date']}
          actions={[
            {
              label: 'Download XLSX',
              key: 'leave-register-xlsx',
              pending: loadingKey === 'leave-register-xlsx',
              onClick: () =>
                runDownload(
                  'leave-register-xlsx',
                  'leave-register',
                  () => reportsApi.leaveRegister({
                    from_date: shared.from_date,
                    to_date: shared.to_date,
                    format: 'xlsx',
                    ...(shared.department_code ? { department_code: shared.department_code } : {}),
                  })
                ),
            },
            {
              label: 'Download PDF',
              key: 'leave-register-pdf',
              pending: loadingKey === 'leave-register-pdf',
              onClick: () =>
                runDownload(
                  'leave-register-pdf',
                  'leave-register',
                  () => reportsApi.leaveRegister({
                    from_date: shared.from_date,
                    to_date: shared.to_date,
                    format: 'pdf',
                    ...(shared.department_code ? { department_code: shared.department_code } : {}),
                  })
                ),
            },
          ]}
        />

        <ReportCard
          title="Category-wise Summary"
          description="Locked category-wise leave summary in Excel."
          controls={['Category', 'Total Staff', 'Total Leave Days by type', 'Avg per staff']}
          actions={[
            {
              label: 'Download XLSX',
              key: 'leave-abstract',
              pending: loadingKey === 'leave-abstract',
              onClick: () =>
                runDownload(
                  'leave-abstract',
                  'leave-abstract',
                  () => reportsApi.leaveAbstract({
                    from_date: shared.from_date,
                    to_date: shared.to_date,
                  })
                ),
            },
          ]}
        />

        <ReportCard
          title="Pending Applications (Aged)"
          description="Locked aged-pending report in PDF."
          controls={['App #', 'Employee', 'Leave Type', 'Submitted Date', 'Days Pending', 'Current Approver']}
          actions={[
            {
              label: 'Download PDF',
              key: 'pending',
              pending: loadingKey === 'pending',
              onClick: () => runDownload('pending', 'pending-applications', () => reportsApi.pendingApplications()),
            },
          ]}
        />

        <ReportCard
          title="Payroll Export (LOP)"
          description="CSV export for approved EOL/LOP rows. The locked NIC mapping remains a backend placeholder until Finance shares the real spec."
          controls={['Emp Code', 'Name', 'Dept', 'Month', 'LOP Days', 'Reason']}
          actions={[
            {
              label: 'Download CSV',
              key: 'payroll',
              pending: loadingKey === 'payroll',
              onClick: () =>
                runDownload(
                  'payroll',
                  'payroll-export',
                  () => reportsApi.payrollExport({
                    from_date: shared.from_date,
                    to_date: shared.to_date,
                    export_type: 'LOP',
                  })
                ),
            },
          ]}
        />

        <ReportCard
          title="Balance Summary"
          description="Current leave balance workbook for the selected year."
          controls={['Emp Code', 'Name', 'Dept', 'Leave Type', 'Opening', 'Credited', 'Availed', 'Closing']}
          actions={[
            {
              label: 'Download XLSX',
              key: 'balance-summary',
              pending: loadingKey === 'balance-summary',
              onClick: () =>
                runDownload(
                  'balance-summary',
                  'balance-summary',
                  () => reportsApi.balanceSummary(shared.as_of_date ? { as_of_date: shared.as_of_date } : {})
                ),
            },
          ]}
        />

        <ReportCard
          title="Leave Calendar"
          description="Department-wise approved leave calendar workbook for the selected month."
          controls={['Emp Code', 'Name', 'From', 'To', 'Leave Type']}
          actions={[
            {
              label: 'Download XLSX',
              key: 'leave-calendar',
              pending: loadingKey === 'leave-calendar',
              onClick: () =>
                runDownload(
                  'leave-calendar',
                  'leave-calendar',
                  () => reportsApi.leaveCalendar({
                    ...(shared.department_code ? { department_code: shared.department_code } : {}),
                    ...(shared.month ? { month: shared.month } : {}),
                  })
                ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  controls,
  actions,
}: {
  title: string;
  description: string;
  controls: string[];
  actions: { label: string; key: string; pending: boolean; onClick: () => void }[];
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {controls.map((control) => (
          <span key={control} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
            {control}
          </span>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.key}
            onClick={action.onClick}
            disabled={action.pending}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {action.pending ? 'Working...' : action.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  
  const queryModule = new URLSearchParams(location.search).get('module') as AdminModuleId | null;
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
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeOption[]>([]);
  const [entitlementRules, setEntitlementRules] = useState<EntitlementRule[]>([]);
  const [policyDraftEligibility, setPolicyDraftEligibility] = useState<Record<string, EligibilityOption>>({});
  const [policyDrafts, setPolicyDrafts] = useState<Record<string, PolicyRowDraft>>({});
  const [savingPolicyKey, setSavingPolicyKey] = useState('');
  const [message, setMessage] = useState('');
  const [auditFilters, setAuditFilters] = useState({
    entity_type: '',
    actor_id: '',
    action: '',
    from_date: '',
    to_date: '',
  });
  const [forceLogoutUserId, setForceLogoutUserId] = useState('');

  const loadDashboard = async () => {
    const { data } = await adminApi.healthDashboard();
    setDashboard(data || {});
  };

  const loadAudit = async () => {
    const { data } = await adminApi.auditLog({
      ...(auditFilters.entity_type ? { entity_type: auditFilters.entity_type } : {}),
      ...(auditFilters.actor_id ? { actor_id: auditFilters.actor_id } : {}),
      ...(auditFilters.action ? { action: auditFilters.action } : {}),
      ...(auditFilters.from_date ? { from_date: auditFilters.from_date } : {}),
      ...(auditFilters.to_date ? { to_date: auditFilters.to_date } : {}),
      skip: 0,
      limit: 50,
    });
    setAuditRows(data || []);
  };

  useEffect(() => {
    const bootstrap = async () => {
      const [dashboardResponse, usersResponse, departmentsResponse, leaveTypesResponse, entitlementRulesResponse] = await Promise.all([
        adminApi.healthDashboard(),
        usersApi.list(),
        departmentsApi.list(),
        leaveTypesApi.list(),
        entitlementRulesApi.list(),
      ]);
      setDashboard(dashboardResponse.data || {});
      setUsers(usersResponse.data || []);
      setDepartments(departmentsResponse.data || []);
      setLeaveTypes(leaveTypesResponse.data || []);
      setEntitlementRules(entitlementRulesResponse.data || []);
      const { data } = await adminApi.auditLog({ skip: 0, limit: 50 });
      setAuditRows(data || []);
    };
    void bootstrap();
  }, []);

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
      navigate('/');
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
      activeUsers,
      adminUsers,
      resetUsers,
      unmappedUsers,
      queueDepth: dashboard?.queue_depth ?? 0,
      recentErrors: dashboard?.recent_errors_24h ?? 0,
    };
  }, [users, dashboard]);

  const entitlementRuleMap = useMemo(() => {
    const entries: Array<[string, EntitlementRule]> = entitlementRules.map((rule) => [
      `${rule.category_code}::${rule.leave_type_code}`,
      rule,
    ]);
    return new Map<string, EntitlementRule>(entries);
  }, [entitlementRules]);

  const workflowByLeaveType = useMemo(() => {
    const residentCodes = new Set(['JR_ACAD', 'SR_ACAD', 'JR_NA', 'SR_NA']);
    return (leaveTypeCode: string, categoryCode: PolicyCategoryCode) => {
      if (leaveTypeCode === 'ANNUAL_RES') return 'Resident chain';
      if (residentCodes.has(categoryCode)) return 'Resident / special chain';
      return 'Default chain';
    };
  }, []);

  const inferEligibility = (leaveTypeCode: string): EligibilityOption => {
    if (leaveTypeCode === 'ML') return 'FEMALE_ONLY';
    if (leaveTypeCode === 'PL') return 'MALE_ONLY';
    return 'ALL';
  };

  const toDraftString = (value?: number | null): string => (value == null ? '' : String(value));

  const ensurePolicyDraft = (leaveType: LeaveTypeOption, rule?: EntitlementRule | undefined): PolicyRowDraft => ({
    annualCredit: toDraftString(rule?.days_per_year ?? rule?.year1_days),
    maxAtATime: toDraftString(rule?.max_at_a_stretch),
    maxInTenure: toDraftString(rule?.max_in_tenure),
    maxAccumulation: toDraftString(leaveType.max_accumulation),
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
      const fallback = leaveType ? ensurePolicyDraft(leaveType, rule) : { annualCredit: '', maxAtATime: '', maxInTenure: '', maxAccumulation: '' };
      return {
        ...current,
        [draftKey]: updater(current[draftKey] || fallback),
      };
    });
  };

  const policyRows = useMemo(
    () =>
      leaveTypes.map((leaveType) => {
        const rule = entitlementRuleMap.get(`${activePolicyCategory}::${leaveType.code}`);
        const draftKey = `${activePolicyCategory}::${leaveType.code}`;
        const specialRuleFlags = Object.keys(rule?.special_rules || {});
        return {
          id: leaveType.id,
          code: leaveType.code,
          name: leaveType.name,
          scheme: leaveType.scheme || '-',
          eligibility: policyDraftEligibility[draftKey] || inferEligibility(leaveType.code),
          creditFrequency: rule?.prorata_rate ? 'MONTHLY' : rule?.days_per_year != null || rule?.year1_days != null || rule?.year2_plus_days != null ? 'YEARLY' : 'NONE',
          creditQty:
            rule?.days_per_year != null
              ? String(rule.days_per_year)
              : rule?.prorata_rate != null
                ? `${rule.prorata_rate}/month`
                : rule?.year1_days != null
                  ? `Y1 ${rule.year1_days}${rule.year2_plus_days != null ? ` | Y2+ ${rule.year2_plus_days}` : ''}`
                  : '-',
          maxAtATime: rule?.max_at_a_stretch != null ? String(rule.max_at_a_stretch) : '-',
          carryForward: (rule?.carry_forward ?? leaveType.carry_forward) ? 'Yes' : 'No',
          workflow: workflowByLeaveType(leaveType.code, activePolicyCategory),
          status: rule ? (specialRuleFlags.length > 0 ? `Bound with ${specialRuleFlags.length} special rule${specialRuleFlags.length > 1 ? 's' : ''}` : 'Bound') : 'Missing rule',
          statusTone: rule ? 'ok' : 'warn',
          yearRef: rule?.year_ref || '-',
          mcRule: leaveType.requires_mc ? `MC from ${leaveType.min_days_for_mc || 0}+ days` : 'No MC rule',
          halfDay: leaveType.is_half_day_allowed ? 'Allowed' : 'Not allowed',
          maxAccumulation: leaveType.max_accumulation != null ? String(leaveType.max_accumulation) : '-',
        };
      }),
    [activePolicyCategory, entitlementRuleMap, leaveTypes, policyDraftEligibility, workflowByLeaveType]
  );

  const activeCategoryStats = useMemo(() => {
    const boundRows = policyRows.filter((row) => row.statusTone === 'ok').length;
    const missingRows = policyRows.length - boundRows;
    return {
      total: policyRows.length,
      boundRows,
      missingRows,
    };
  }, [policyRows]);

  const savePolicyRow = async (rowCode: string) => {
    const draftKey = `${activePolicyCategory}::${rowCode}`;
    const leaveType = leaveTypes.find((item) => item.code === rowCode);
    const rule = entitlementRuleMap.get(draftKey);
    if (!leaveType || !rule) {
      setMessage(`No persisted entitlement rule exists yet for ${activePolicyCategory} / ${rowCode}.`);
      return;
    }

    const draft = policyDrafts[draftKey] || ensurePolicyDraft(leaveType, rule);
    setSavingPolicyKey(draftKey);
    setMessage('');
    try {
      await entitlementRulesApi.update(rule.id, {
        days_per_year: parseOptionalNumber(draft.annualCredit),
        year1_days: parseOptionalNumber(draft.annualCredit),
        max_at_a_stretch: parseOptionalNumber(draft.maxAtATime),
        max_in_tenure: parseOptionalNumber(draft.maxInTenure),
      });

      await leaveTypesApi.update(leaveType.id, {
        max_accumulation: parseOptionalNumber(draft.maxAccumulation),
      });

      const [rulesResponse, leaveTypesResponse] = await Promise.all([entitlementRulesApi.list(), leaveTypesApi.list()]);
      setEntitlementRules(rulesResponse.data || []);
      setLeaveTypes(leaveTypesResponse.data || []);
      setMessage(`Saved ${rowCode} policy for ${activePolicyCategory}.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || `Failed to save ${rowCode} policy.`);
    } finally {
      setSavingPolicyKey('');
    }
  };

  const currentModule = ADMIN_MODULES.find((module) => module.id === activeModule) || ADMIN_MODULES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin Workspace' }]}
        title="Control center for policy, workflow, and governance"
        description="The admin area is now structured around stable work modules. Use the horizontal strip to move between operations without losing context."
        rightContent={
          <div className="flex items-center gap-3">
            <MetricCard label="Active Users" value={String(adminSummary.activeUsers)} />
            <MetricCard label="Notifications" value={String(adminSummary.queueDepth)} tone={adminSummary.queueDepth > 0 ? 'amber' : 'green'} />
          </div>
        }
      />
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto px-3 py-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex min-w-max gap-2">
            {ADMIN_MODULES.map((module) => {
              const active = module.id === activeModule;
              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => setActiveModule(module.id)}
                  className={`rounded-2xl px-4 py-3 text-left transition ${
                    active
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                      : 'bg-white/80 text-slate-700 hover:bg-white hover:text-slate-900'
                  }`}
                >
                  <div className="text-sm font-semibold">{module.label}</div>
                  <div className={`mt-1 text-xs ${active ? 'text-slate-200' : 'text-slate-500'}`}>{module.blurb}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {message && <PageNotice>{message}</PageNotice>}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div>
          <div className="text-base font-semibold text-slate-900">{currentModule.label}</div>
          <div className="text-sm text-slate-500">{currentModule.blurb}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {activeModule === 'dashboard' && (
            <>
              <button onClick={() => void loadDashboard()} className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Refresh Health
              </button>
              <button onClick={() => void loadAudit()} className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Refresh Audit
              </button>
            </>
          )}
          {activeModule === 'policy' && (
            <>
              <button className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Copy From Category</button>
              <button className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Compare Leave Type</button>
              <span className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-600">Row-level save enabled</span>
            </>
          )}
          {activeModule === 'workflow' && (
            <>
              <Link to="/workflows" className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Open Current Workflow Page
              </Link>
              <button className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Simulate Routing</button>
            </>
          )}
          {activeModule === 'employees' && (
            <>
              <Link to="/" className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Open Employee Master
              </Link>
              <button className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Import Employees</button>
            </>
          )}
          {activeModule === 'users' && (
            <button className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">Create User</button>
          )}
          {activeModule === 'calendar' && (
            <Link to="/holidays" className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Open Holiday Master
            </Link>
          )}
          {activeModule === 'balances' && (
            <Link to="/balances" className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              Open Balances
            </Link>
          )}
        </div>
      </div>

      {activeModule === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Users Requiring Reset" value={String(adminSummary.resetUsers)} helper="must_change_password = true" tone={adminSummary.resetUsers > 0 ? 'amber' : 'green'} />
            <MetricCard label="Unmapped Users" value={String(adminSummary.unmappedUsers)} helper="user exists without employee link" tone={adminSummary.unmappedUsers > 0 ? 'amber' : 'default'} />
            <MetricCard label="Admin Accounts" value={String(adminSummary.adminUsers)} helper="active ADMIN role holders" />
            <MetricCard label="Recent Notification Errors" value={String(adminSummary.recentErrors)} helper="failed in last 24h" tone={adminSummary.recentErrors > 0 ? 'red' : 'green'} />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.4fr_0.9fr]">
            <SectionCard
              title="Policy Control"
              subtitle="Primary entry points for leave policy, workflow structure, holidays, and balances."
              actions={<span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Top priority</span>}
            >
              <div className="grid gap-3 md:grid-cols-2">
                <QuickLink title="Leave Policy Matrix" blurb="Category-first control panel for leave eligibility, credit, and carry-forward logic." badge={`${leaveTypes.length} leave types`} />
                <QuickLink title="Workflow Policy" blurb="Manage approval ladders, simulate routing, and identify missing approvers." to="/workflows" />
                <QuickLink title="Calendars & Holidays" blurb="Holiday master plus institution and department leave visibility." to="/holidays" />
                <QuickLink title="Balances & Credits" blurb="Opening balances, year-end processing, and balance exception review." to="/balances" />
              </div>
            </SectionCard>

            <SectionCard title="Risk & Alerts" subtitle="What should pull admin attention before routine edits." tone="warm">
              <div className="space-y-3">
                <RiskRow label="Notification queue depth" value={String(adminSummary.queueDepth)} severity={adminSummary.queueDepth > 0 ? 'warn' : 'ok'} />
                <RiskRow label="Users requiring password change" value={String(adminSummary.resetUsers)} severity={adminSummary.resetUsers > 0 ? 'warn' : 'ok'} />
                <RiskRow label="Unmapped user accounts" value={String(adminSummary.unmappedUsers)} severity={adminSummary.unmappedUsers > 0 ? 'warn' : 'ok'} />
                <RiskRow label="Recent notification failures" value={String(adminSummary.recentErrors)} severity={adminSummary.recentErrors > 0 ? 'error' : 'ok'} />
              </div>
            </SectionCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <SectionCard
              title="Force Logout"
              subtitle="Invalidate all sessions for a selected user."
              actions={
                <button onClick={() => void runForceLogout()} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700">
                  Force Logout
                </button>
              }
            >
              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <select value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-3 text-sm">
                  <option value="">Choose user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                  Use only for compromised or misbehaving sessions.
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Recent Audit Activity" subtitle="Latest changes visible from the audit trail." actions={<button onClick={() => setActiveModule('audit')} className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">Open Audit Module</button>}>
              <div className="space-y-3">
                {auditRows.slice(0, 5).map((row) => (
                  <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-sm font-medium text-slate-900">
                        {row.entity_type || 'entity'} · {row.action || 'action'}
                      </div>
                      <div className="text-xs text-slate-500">{formatDateTime(row.created_at)}</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Actor: {row.actor_id || '-'} · Entity: {row.entity_id || '-'}</div>
                  </div>
                ))}
                {auditRows.length === 0 && <div className="text-sm text-slate-500">No audit rows returned.</div>}
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {activeModule === 'policy' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard label="Active Category" value={activePolicyCategory} helper="selected policy scope" />
            <MetricCard label="Bound Rules" value={String(activeCategoryStats.boundRows)} helper={`${activeCategoryStats.total} leave types in view`} tone={activeCategoryStats.missingRows > 0 ? 'amber' : 'green'} />
            <MetricCard label="Missing Rules" value={String(activeCategoryStats.missingRows)} helper="rows without entitlement binding" tone={activeCategoryStats.missingRows > 0 ? 'amber' : 'green'} />
          </div>

          <SectionCard title="Category-first Leave Policy Matrix" subtitle="This matrix now reads real leave-type and entitlement data. Numeric policy fields save immediately per row; eligibility remains view-only draft for now." tone="cool">
            <div className="mb-4 flex flex-wrap gap-2">
              {POLICY_CATEGORY_CODES.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActivePolicyCategory(category)}
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    activePolicyCategory === category ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 pr-3">Leave Type</th>
                    <th className="pb-3 pr-3">Eligibility</th>
                    <th className="pb-3 pr-3">Scheme</th>
                    <th className="pb-3 pr-3">Annual Credit</th>
                    <th className="pb-3 pr-3">Max At A Time</th>
                    <th className="pb-3 pr-3">Max In Tenure</th>
                    <th className="pb-3 pr-3">Max Accumulation</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {policyRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 align-top defer-render">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">{row.code}</div>
                        <div className="text-xs text-slate-500">{row.name}</div>
                      </td>
                      <td className="py-3 pr-3">
                        <select
                          value={row.eligibility}
                          onChange={(e) =>
                            setPolicyDraftEligibility((current) => ({
                              ...current,
                              [`${activePolicyCategory}::${row.code}`]: e.target.value as EligibilityOption,
                            }))
                          }
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        >
                          {ELIGIBILITY_OPTIONS.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                        <div className="mt-2 text-[11px] text-slate-400">not saved yet</div>
                      </td>
                      <td className="py-3 pr-3 text-slate-700">{row.scheme}</td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          step="0.5"
                          value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find((item) => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).annualCredit}
                          onChange={(e) =>
                            updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, annualCredit: e.target.value }))
                          }
                          className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find((item) => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxAtATime}
                          onChange={(e) =>
                            updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxAtATime: e.target.value }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          step="0.5"
                          value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find((item) => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxInTenure}
                          onChange={(e) =>
                            updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxInTenure: e.target.value }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <input
                          type="number"
                          value={(policyDrafts[`${activePolicyCategory}::${row.code}`] || ensurePolicyDraft(leaveTypes.find((item) => item.code === row.code)!, entitlementRuleMap.get(`${activePolicyCategory}::${row.code}`))).maxAccumulation}
                          onChange={(e) =>
                            updatePolicyDraft(`${activePolicyCategory}::${row.code}`, (current) => ({ ...current, maxAccumulation: e.target.value }))
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                        />
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            row.statusTone === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {row.status}
                        </span>
                        <div className="mt-2 text-xs text-slate-500">
                          {row.yearRef} · {row.creditFrequency} · {row.halfDay} · {row.mcRule} · {row.workflow} · Carry forward {row.carryForward}
                        </div>
                      </td>
                      <td className="py-3 pr-3">
                        <button
                          type="button"
                          disabled={row.statusTone !== 'ok' || savingPolicyKey === `${activePolicyCategory}::${row.code}`}
                          onClick={() => void savePolicyRow(row.code)}
                          className="rounded-full bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                          {savingPolicyKey === `${activePolicyCategory}::${row.code}` ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {activeCategoryStats.missingRows > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                {activeCategoryStats.missingRows} leave type(s) in {activePolicyCategory} do not yet have an entitlement-rule binding.
              </div>
            )}
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-3">
            <SectionCard title="What this page should become" subtitle="The matrix is now grounded in real data, but it still needs a purpose-built policy resource to become authoritative.">
              <ul className="space-y-2 text-sm text-slate-600">
                <li>One row per leave type for the active category.</li>
                <li>Inline edits for simple fields like eligibility and credit.</li>
                <li>Advanced drawer for validation, workflow, and publish history.</li>
                <li>Versioned draft/publish flow instead of ad-hoc edits across pages.</li>
              </ul>
            </SectionCard>
            <SectionCard title="Gaps to resolve" subtitle="These are the remaining blockers beneath the now data-backed matrix." tone="warm">
              <ul className="space-y-2 text-sm text-slate-600">
                <li>No unified backend resource currently combines category, leave type, credit, workflow, and publish state.</li>
                <li>Eligibility is still frontend-draft only and is not persisted by the backend.</li>
                <li>Workflow is still inferred, not joined from workflow configs.</li>
                <li>Publish/version semantics are not implemented.</li>
              </ul>
            </SectionCard>
            <SectionCard title="Immediate next page-level actions" subtitle="Next useful increments on top of this real matrix slice.">
              <ul className="space-y-2 text-sm text-slate-600">
                <li>Promote this matrix into its own route and full-width workspace.</li>
                <li>Persist selected category in URL or local route state.</li>
                <li>Wire a row drawer for rule detail and workflow resolution.</li>
                <li>Add save/create behavior on top of `entitlementRulesApi` for editable fields that already exist.</li>
              </ul>
            </SectionCard>
          </div>
        </div>
      )}

      {activeModule === 'workflow' && (
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard title="Workflow Policy" subtitle="Separate the routing engine from raw leave types so approver chains remain understandable." tone="cool">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="text-sm font-semibold text-slate-900">Recommended chain editor</div>
                <div className="mt-3 space-y-3">
                  {[
                    { step: '1', role: 'HOD', note: 'Department-level first approver' },
                    { step: '2', role: 'ESTABLISHMENT_OFFICER', note: 'Operational review' },
                    { step: '3', role: 'REGISTRAR', note: 'Final sanction authority' },
                  ].map((step) => (
                    <div key={step.step} className="flex items-center gap-4 rounded-2xl border border-slate-200 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-sm font-semibold text-white">{step.step}</div>
                      <div>
                        <div className="text-sm font-medium text-slate-900">{step.role}</div>
                        <div className="text-xs text-slate-500">{step.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <PageNotice>Self-applicant skip, acting arrangement routing, and department/designation-aware routing still require backend correction.</PageNotice>
            </div>
          </SectionCard>

          <SectionCard title="Workflow actions" subtitle="Current and planned workflow operations.">
            <div className="grid gap-3">
              <QuickLink title="Open existing workflow page" blurb="Current route for workflow configs and simulation." to="/workflows" />
              <QuickLink title="Simulate routing" blurb="Should accept category, leave type, days, and applicant context." badge="planned" />
              <QuickLink title="Detect broken chains" blurb="Missing approver, self-approval risk, no final authority." badge="planned" />
            </div>
          </SectionCard>
        </div>
      )}

      {activeModule === 'employees' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Departments" value={String(departments.length)} helper="available master records" />
            <MetricCard label="Leave Types" value={String(leaveTypes.length)} helper="visible policy inventory" />
            <MetricCard label="Linked Users" value={String(users.filter((user) => !!user.employee_id).length)} helper="accounts tied to employees" />
            <MetricCard label="Users Missing Mapping" value={String(adminSummary.unmappedUsers)} helper="requires cleanup" tone={adminSummary.unmappedUsers > 0 ? 'amber' : 'green'} />
          </div>

          <SectionCard title="Employee administration should become its own work area" subtitle="The admin workspace now frames the expected operating model even before the dedicated employee UI is rebuilt.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <QuickLink title="Employee Master" blurb="List, search, add, and edit employee records with role-safe controls." to="/" />
              <QuickLink title="Department Master" blurb="Departments should stay editable but scoped to admin operations, not general users." to="/masters" />
              <QuickLink title="Designation Master" blurb="Designation cleanup and category mapping should be grouped with employee admin." to="/masters" />
              <QuickLink title="Import Employees" blurb="CSV import should live as a local action under Employees, not as a globally visible affordance." badge="ux fix" />
            </div>
          </SectionCard>
        </div>
      )}

      {activeModule === 'users' && (
        <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <SectionCard title="Users & Roles" subtitle="Access management should be governance-first and clearly separated from employee CRUD.">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-3 pr-3">User</th>
                    <th className="pb-3 pr-3">Role</th>
                    <th className="pb-3 pr-3">Status</th>
                    <th className="pb-3 pr-3">Reset</th>
                    <th className="pb-3 pr-3">Last Login</th>
                    <th className="pb-3 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 10).map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 defer-render">
                      <td className="py-3 pr-3">
                        <div className="font-medium text-slate-900">{user.username}</div>
                        <div className="text-xs text-slate-500">{user.employee_id ? 'Employee linked' : 'No employee link'}</div>
                      </td>
                      <td className="py-3 pr-3">{user.role}</td>
                      <td className="py-3 pr-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.is_active === false ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {user.is_active === false ? 'Inactive' : 'Active'}
                        </span>
                      </td>
                      <td className="py-3 pr-3">{user.must_change_password ? 'Required' : 'Clear'}</td>
                      <td className="py-3 pr-3 text-slate-500">{formatDateTime(user.last_login)}</td>
                      <td className="py-3 pr-3">
                        {user.is_active !== false && user.role !== 'ADMIN' && (
                          <button
                            onClick={() => handleImpersonate(user.id)}
                            className="text-xs font-bold uppercase tracking-wider text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1.5 rounded"
                          >
                            Login As
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title="Role hygiene" subtitle="Use this surface for risky governance actions, not generic CRUD." tone="warm">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Role changes should ask for reason and elevated confirmation.</li>
              <li>ADMIN assignment should be treated as sensitive.</li>
              <li>Inactive employee linked to active user should surface as warning.</li>
              <li>Password-reset and force-logout should be obvious local actions.</li>
            </ul>
          </SectionCard>
        </div>
      )}

      {activeModule === 'calendar' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Calendars & Holidays" subtitle="Combine Holiday Master with leave visibility instead of isolating holiday setup as a narrow config page." tone="cool">
            <div className="grid gap-3 md:grid-cols-2">
              <QuickLink title="Holiday Master" blurb="Year-wise holiday list with add, edit, and delete controls." to="/holidays" />
              <QuickLink title="Institution Calendar" blurb="Monthly approved-leave calendar with conflict highlights." badge="planned" />
              <QuickLink title="Department Calendar" blurb="Department filter for overlap and operational absence visibility." badge="planned" />
              <QuickLink title="Restricted/Optional Days" blurb="Keep holiday types visible in one coherent place." badge="planned" />
            </div>
          </SectionCard>
          <SectionCard title="Why this matters" subtitle="Approvers and admins need calendar visibility, not just master-data maintenance.">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Holiday setup and leave visibility belong close together.</li>
              <li>Department clash visibility should be visible without opening reports first.</li>
              <li>Calendar should highlight concentration risk, not just approved rows.</li>
            </ul>
          </SectionCard>
        </div>
      )}

      {activeModule === 'balances' && (
        <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <SectionCard title="Balances & Credits" subtitle="Setup, validation, and exception handling should live in one admin work area.">
            <div className="grid gap-3 md:grid-cols-2">
              <QuickLink title="Opening Balances" blurb="Initial balance load and manual corrections." to="/balances" />
              <QuickLink title="Year-End Processing" blurb="Run carry-forward and close the year with validation." to="/year-end" />
              <QuickLink title="Credit Exceptions" blurb="Show employees missing credit or failing validation." badge="planned" />
              <QuickLink title="Balance Integrity" blurb="Expose inconsistent or negative balances for repair." badge="planned" />
            </div>
          </SectionCard>
          <SectionCard title="Recommended behavior" subtitle="This module should become validation-first, not blind import-first." tone="warm">
            <ul className="space-y-2 text-sm text-slate-600">
              <li>Preview before commit for opening balances.</li>
              <li>Visible exception list before year-end changes are applied.</li>
              <li>Exportable issue lists for cleanup and reconciliation.</li>
            </ul>
          </SectionCard>
        </div>
      )}

      {activeModule === 'audit' && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Queue Depth" value={String(dashboard?.queue_depth ?? '-')} />
            <MetricCard label="DB Pool" value={dashboard ? `${dashboard.db_pool_checked_in ?? '-'} / ${dashboard.db_pool_size ?? '-'}` : '-'} helper="checked-in / size" />
            <MetricCard label="Error Rate" value={dashboard?.error_rate != null ? String(dashboard.error_rate) : String(dashboard?.recent_errors_24h ?? '-')} helper={dashboard?.error_rate != null ? 'reported by API' : 'fallback to failed count'} />
            <MetricCard label="Last Backup" value={dashboard?.last_backup ? formatDateTime(dashboard.last_backup) : 'Not exposed'} />
          </div>

          <SectionCard
            title="Audit Log"
            subtitle="Filter by entity, actor, action, and date range."
            actions={
              <button onClick={() => void loadAudit()} className="rounded-full border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                Refresh
              </button>
            }
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <input
                value={auditFilters.entity_type}
                onChange={(e) => setAuditFilters({ ...auditFilters, entity_type: e.target.value })}
                placeholder="Entity"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={auditFilters.actor_id}
                onChange={(e) => setAuditFilters({ ...auditFilters, actor_id: e.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All actors</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username}
                  </option>
                ))}
              </select>
              <input
                value={auditFilters.action}
                onChange={(e) => setAuditFilters({ ...auditFilters, action: e.target.value })}
                placeholder="Action"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={auditFilters.from_date}
                onChange={(e) => setAuditFilters({ ...auditFilters, from_date: e.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={auditFilters.to_date}
                onChange={(e) => setAuditFilters({ ...auditFilters, to_date: e.target.value })}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="mt-3">
              <button onClick={() => void loadAudit()} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                Apply Filters
              </button>
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-3">Timestamp</th>
                    <th className="pb-2 pr-3">Entity</th>
                    <th className="pb-2 pr-3">Action</th>
                    <th className="pb-2 pr-3">Actor</th>
                    <th className="pb-2 pr-3">Entity ID</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100 defer-render">
                      <td className="py-2 pr-3 text-slate-600">{formatDateTime(row.created_at)}</td>
                      <td className="py-2 pr-3 font-medium text-slate-800">{row.entity_type || '-'}</td>
                      <td className="py-2 pr-3 text-slate-700">{row.action || '-'}</td>
                      <td className="py-2 pr-3 text-slate-600">{row.actor_id || '-'}</td>
                      <td className="py-2 pr-3 font-mono text-xs text-slate-500">{row.entity_id || '-'}</td>
                    </tr>
                  ))}
                  {auditRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No audit rows returned.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}

function RiskRow({
  label,
  value,
  severity,
}: {
  label: string;
  value: string;
  severity: 'ok' | 'warn' | 'error';
}) {
  const tone =
    severity === 'error'
      ? 'bg-rose-100 text-rose-700'
      : severity === 'warn'
        ? 'bg-amber-100 text-amber-800'
        : 'bg-emerald-100 text-emerald-700';
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/70 px-4 py-3">
      <div className="text-sm text-slate-700">{label}</div>
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
