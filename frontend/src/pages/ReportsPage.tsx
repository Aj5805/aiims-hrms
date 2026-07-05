import { useEffect, useMemo, useState } from 'react';
import type { AxiosResponse } from 'axios';
import { departmentsApi, designationsApi, reportsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { formatHttpError, PAYROLL_EXPORT_ROLES } from '../constants/roles';

type DepartmentOption = { id: string; code: string; name: string };
type DesignationOption = { id: string; name: string };

type ReportPreview = {
  title: string;
  headers: string[];
  rows: string[][];
  count: number;
};

type ReportId =
  | 'leave-register'
  | 'category-summary'
  | 'pending'
  | 'balance'
  | 'calendar'
  | 'payroll';

type ExportFormat = 'xlsx' | 'pdf' | 'csv';

type ReportDef = {
  id: ReportId;
  label: string;
  description: string;
  exports: ExportFormat[];
};

const REPORTS: ReportDef[] = [
  {
    id: 'leave-register',
    label: 'Leave Register',
    description: 'All leave applications in the selected date range.',
    exports: ['xlsx', 'pdf'],
  },
  {
    id: 'category-summary',
    label: 'Category Summary',
    description: 'Staff category totals and approved leave days by type.',
    exports: ['xlsx'],
  },
  {
    id: 'pending',
    label: 'Pending (Aged)',
    description: 'Applications still awaiting approval, sorted by age.',
    exports: ['pdf'],
  },
  {
    id: 'balance',
    label: 'Balance Summary',
    description: 'Opening, credit, availed, and closing balances for the year.',
    exports: ['xlsx'],
  },
  {
    id: 'calendar',
    label: 'Leave Calendar',
    description: 'Approved leave rows for a department and month.',
    exports: ['xlsx'],
  },
  {
    id: 'payroll',
    label: 'Payroll (LOP)',
    description: 'Approved EOL/LOP rows for finance handoff (NIC mapping placeholder).',
    exports: ['csv'],
  },
];

function monthBounds(): { from: string; to: string; month: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    month,
  };
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
  return fallbackBase;
}

function exportLabel(format: ExportFormat): string {
  if (format === 'xlsx') return 'Export Excel';
  if (format === 'pdf') return 'Export PDF';
  return 'Export CSV';
}

export function ReportsPage() {
  const user = useAuthStore((s) => s.user);
  const bounds = useMemo(() => monthBounds(), []);
  const canExportPayroll = PAYROLL_EXPORT_ROLES.includes(user?.role as (typeof PAYROLL_EXPORT_ROLES)[number]);

  const visibleReports = useMemo(
    () => (canExportPayroll ? REPORTS : REPORTS.filter((r) => r.id !== 'payroll')),
    [canExportPayroll],
  );

  const [activeReport, setActiveReport] = useState<ReportId>('leave-register');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [filters, setFilters] = useState({
    from_date: bounds.from,
    to_date: bounds.to,
    department_code: '',
    as_of_date: '',
    month: bounds.month,
    designation_name: '',
  });
  const [preview, setPreview] = useState<ReportPreview | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadingView, setLoadingView] = useState(false);
  const [loadingExport, setLoadingExport] = useState('');

  const report = visibleReports.find((r) => r.id === activeReport) ?? visibleReports[0];

  useEffect(() => {
    const loadFilters = async () => {
      const [deptResponse, desgResponse] = await Promise.all([departmentsApi.list(), designationsApi.list()]);
      setDepartments(deptResponse.data || []);
      setDesignations(desgResponse.data || []);
    };
    void loadFilters();
  }, []);

  useEffect(() => {
    setPreview(null);
    setMessage('');
    setError('');
  }, [activeReport]);

  const dateRangeParams = () => ({
    from_date: filters.from_date,
    to_date: filters.to_date,
  });

  const deptParam = (): Record<string, string> =>
    filters.department_code ? { department_code: filters.department_code } : {};

  const balanceParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filters.as_of_date) params.as_of_date = filters.as_of_date;
    if (filters.department_code) params.department_code = filters.department_code;
    if (filters.designation_name) params.designation_name = filters.designation_name;
    return params;
  };

  const calendarParams = (): Record<string, string> => ({
    ...deptParam(),
    ...(filters.month ? { month: filters.month } : {}),
  });

  const loadPreview = async () => {
    setLoadingView(true);
    setError('');
    setMessage('');
    try {
      if (activeReport === 'leave-register') {
        const { data } = await reportsApi.leaveRegisterPreview({ ...dateRangeParams(), ...deptParam() });
        setPreview(data);
      } else if (activeReport === 'category-summary') {
        const { data } = await reportsApi.leaveAbstractPreview(dateRangeParams());
        setPreview(data);
      } else if (activeReport === 'pending') {
        const { data } = await reportsApi.pendingApplicationsPreview();
        setPreview(data);
      } else if (activeReport === 'balance') {
        const { data } = await reportsApi.balanceOverview(balanceParams());
        const rows = (data.rows || []).map((row: Record<string, unknown>) => [
          String(row.emp_code ?? ''),
          String(row.name ?? ''),
          String(row.dept ?? ''),
          String(row.leave_type ?? ''),
          String(row.opening_balance ?? ''),
          String(row.credited ?? ''),
          String(row.availed ?? ''),
          String(row.closing_balance ?? ''),
        ]);
        setPreview({
          title: 'Balance Summary',
          headers: ['Emp Code', 'Name', 'Dept', 'Leave Type', 'Opening', 'Credited', 'Availed', 'Closing'],
          rows,
          count: rows.length,
        });
      } else if (activeReport === 'calendar') {
        const { data } = await reportsApi.leaveCalendarPreview(calendarParams());
        setPreview(data);
      } else if (activeReport === 'payroll') {
        const { data } = await reportsApi.payrollExportPreview({
          ...dateRangeParams(),
          export_type: 'LOP',
        });
        setPreview(data);
      }
    } catch (err: unknown) {
      setError(formatHttpError(err, 'Failed to load report preview'));
      setPreview(null);
    } finally {
      setLoadingView(false);
    }
  };

  const runExport = async (format: ExportFormat) => {
    const key = `${activeReport}-${format}`;
    setLoadingExport(key);
    setError('');
    setMessage('');
    try {
      let response: AxiosResponse<Blob>;
      let fallback = activeReport;

      if (activeReport === 'leave-register') {
        response = await reportsApi.leaveRegister({ ...dateRangeParams(), ...deptParam(), format });
      } else if (activeReport === 'category-summary') {
        response = await reportsApi.leaveAbstract(dateRangeParams());
      } else if (activeReport === 'pending') {
        response = await reportsApi.pendingApplications();
      } else if (activeReport === 'balance') {
        response = await reportsApi.balanceSummary(balanceParams());
      } else if (activeReport === 'calendar') {
        response = await reportsApi.leaveCalendar(calendarParams());
      } else {
        response = await reportsApi.payrollExport({ ...dateRangeParams(), export_type: 'LOP' });
      }

      const filename = inferFilename(response, fallback);
      saveBlob(response.data, filename);
      setMessage(`Downloaded ${filename}.`);
    } catch (err: unknown) {
      setError(formatHttpError(err, 'Export failed'));
    } finally {
      setLoadingExport('');
    }
  };

  const needsDateRange = ['leave-register', 'category-summary', 'payroll'].includes(activeReport);
  const needsDepartment = ['leave-register', 'calendar', 'balance'].includes(activeReport);
  const needsMonth = activeReport === 'calendar';
  const needsAsOf = activeReport === 'balance';
  const needsDesignation = activeReport === 'balance';

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports & Data' }, { label: 'Reports' }]}
        title="Reports"
        description="Preview leave and payroll reports on screen, then export when ready."
      />

      <div className="max-w-6xl space-y-4">
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
          {visibleReports.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveReport(item.id)}
              className={`rounded-t-lg px-3 py-2 text-sm font-medium transition ${
                item.id === activeReport
                  ? 'bg-white border border-b-white border-slate-200 text-indigo-700 -mb-px'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="card card-body space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">{report.label}</h3>
            <p className="mt-1 text-sm text-slate-600">{report.description}</p>
          </div>

          {(needsDateRange || needsDepartment || needsMonth || needsAsOf || needsDesignation) && (
            <div className="flex flex-wrap gap-4 items-end">
              {needsDateRange && (
                <>
                  <div>
                    <label className="form-label">From date</label>
                    <input
                      type="date"
                      value={filters.from_date}
                      onChange={(e) => setFilters({ ...filters, from_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label">To date</label>
                    <input
                      type="date"
                      value={filters.to_date}
                      min={filters.from_date}
                      onChange={(e) => setFilters({ ...filters, to_date: e.target.value })}
                      className="form-input"
                    />
                  </div>
                </>
              )}
              {needsAsOf && (
                <div>
                  <label className="form-label">As of date</label>
                  <input
                    type="date"
                    value={filters.as_of_date}
                    onChange={(e) => setFilters({ ...filters, as_of_date: e.target.value })}
                    className="form-input"
                  />
                </div>
              )}
              {needsMonth && (
                <div>
                  <label className="form-label">Month</label>
                  <input
                    type="month"
                    value={filters.month}
                    onChange={(e) => setFilters({ ...filters, month: e.target.value })}
                    className="form-input"
                  />
                </div>
              )}
              {needsDepartment && (
                <div>
                  <label className="form-label">Department</label>
                  <select
                    value={filters.department_code}
                    onChange={(e) => setFilters({ ...filters, department_code: e.target.value })}
                    className="form-select min-w-[200px]"
                  >
                    <option value="">All departments</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.code}>
                        {dept.code} — {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {needsDesignation && (
                <div>
                  <label className="form-label">Designation</label>
                  <select
                    value={filters.designation_name}
                    onChange={(e) => setFilters({ ...filters, designation_name: e.target.value })}
                    className="form-select min-w-[200px]"
                  >
                    <option value="">All designations</option>
                    {designations.map((desg) => (
                      <option key={desg.id} value={desg.name}>
                        {desg.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={() => void loadPreview()} disabled={loadingView} className="btn-primary">
              {loadingView ? 'Loading…' : 'View report'}
            </button>
            {report.exports.map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => void runExport(format)}
                disabled={!!loadingExport}
                className="btn-secondary"
              >
                {loadingExport === `${activeReport}-${format}` ? 'Exporting…' : exportLabel(format)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
        )}

        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-800">{preview?.title ?? 'Preview'}</h3>
            {preview && (
              <span className="text-xs text-slate-500">{preview.count} row{preview.count === 1 ? '' : 's'}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table data-table-compact min-w-full">
              <thead>
                <tr>
                  {(preview?.headers ?? []).map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                  {!preview && (
                    <th className="text-slate-400 font-normal italic">Run “View report” to load data here</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {loadingView ? (
                  <tr>
                    <td colSpan={preview?.headers.length || 1} className="text-center py-8 text-slate-400">
                      Loading…
                    </td>
                  </tr>
                ) : preview && preview.rows.length > 0 ? (
                  preview.rows.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex}>{cell}</td>
                      ))}
                    </tr>
                  ))
                ) : preview ? (
                  <tr>
                    <td colSpan={preview.headers.length} className="text-center py-8 text-slate-400 italic">
                      No rows match the selected filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
