import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import { adminApi, departmentsApi, notificationsApi, reportsApi, usersApi } from '../api/endpoints';
import { leaveTypesApi } from '../api/phase3_endpoints';

type DepartmentOption = {
  id: string;
  code: string;
  name: string;
};

type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
};

type UserOption = {
  id: string;
  username: string;
  role: string;
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
  before_state?: unknown;
  after_state?: unknown;
};

type HealthDashboard = {
  queue_depth?: number;
  recent_errors_24h?: number;
  db_pool_size?: number;
  db_pool_checked_in?: number;
  last_backup?: string | null;
  error_rate?: number | null;
};

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
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
  return <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{children}</div>;
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
                      <div className="mt-1 text-xs text-slate-600">{item.body || 'No message body provided.'}</div>
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Reports & Payroll Export</h2>
        <p className="mt-1 text-sm text-slate-600">
          Phase 7 report downloads now stream the locked file formats from the backend.
        </p>
      </div>

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
  const [dashboard, setDashboard] = useState<HealthDashboard | null>(null);
  const [auditRows, setAuditRows] = useState<AuditLogItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
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
      const [dashboardResponse, usersResponse] = await Promise.all([adminApi.healthDashboard(), usersApi.list()]);
      setDashboard(dashboardResponse.data || {});
      setUsers(usersResponse.data || []);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Admin Dashboard</h2>
        <p className="mt-1 text-sm text-slate-600">
          Health metrics, audit review, and session invalidation using the current Phase 8 backend routes.
        </p>
      </div>

      {message && <PageNotice>{message}</PageNotice>}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Queue Depth" value={String(dashboard?.queue_depth ?? '-')} />
        <MetricCard
          label="DB Pool"
          value={dashboard ? `${dashboard.db_pool_checked_in ?? '-'} / ${dashboard.db_pool_size ?? '-'}` : '-'}
          helper="checked-in / size"
        />
        <MetricCard
          label="Error Rate"
          value={dashboard?.error_rate != null ? String(dashboard.error_rate) : String(dashboard?.recent_errors_24h ?? '-')}
          helper={dashboard?.error_rate != null ? 'reported by API' : 'current API returns 24h failed count'}
        />
        <MetricCard label="Last Backup" value={dashboard?.last_backup ? formatDateTime(dashboard.last_backup) : 'Not exposed'} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Force Logout</div>
            <div className="text-sm text-slate-500">Invalidate all sessions for a selected user.</div>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <select value={forceLogoutUserId} onChange={(e) => setForceLogoutUserId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Choose user</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username} ({user.role})
              </option>
            ))}
          </select>
          <button onClick={() => void runForceLogout()} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">
            Force Logout
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Audit Log</div>
            <div className="text-sm text-slate-500">Filter by entity, actor, action, and date range.</div>
          </div>
          <button onClick={() => void loadAudit()} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            Refresh
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <input
            value={auditFilters.entity_type}
            onChange={(e) => setAuditFilters({ ...auditFilters, entity_type: e.target.value })}
            placeholder="Entity"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={auditFilters.actor_id}
            onChange={(e) => setAuditFilters({ ...auditFilters, actor_id: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={auditFilters.from_date}
            onChange={(e) => setAuditFilters({ ...auditFilters, from_date: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={auditFilters.to_date}
            onChange={(e) => setAuditFilters({ ...auditFilters, to_date: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3">
          <button onClick={() => void loadAudit()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
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
                <tr key={row.id} className="border-b border-slate-100">
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
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-3 text-3xl font-bold text-slate-900">{value}</div>
      {helper && <div className="mt-2 text-xs text-slate-400">{helper}</div>}
    </div>
  );
}
