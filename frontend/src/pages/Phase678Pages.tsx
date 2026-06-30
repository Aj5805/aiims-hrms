// @ts-nocheck
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
    <section className={`rounded-3xl border p-4 shadow-sm ${toneClass}`}>
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
    <div className={`rounded-2xl border p-4 shadow-sm ${toneClass}`}>
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
