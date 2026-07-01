import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import { departmentsApi, leaveTypesApi, reportsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

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
        description="Download institutional leave and payroll reports from the backend."
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
