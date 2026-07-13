import { useCallback, useEffect, useMemo, useState } from 'react';
import { attendanceApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { isStaffPersonalView } from '../utils/workMode';

type AttendanceRow = {
  attendance_date: string;
  emp_code: string;
  employee_name: string;
  department_name?: string;
  leave_derived_status?: string;
  leave_type_code?: string;
  is_commuted?: boolean;
  biometric_status?: string;
  review_status?: string;
  final_status: string;
};

type PipelineStage = {
  order: number;
  key: string;
  label: string;
  status: string;
  description: string;
};

function monthBounds(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}

export function AttendancePage() {
  const user = useAuthStore((s) => s.user);
  const workMode = useAuthStore((s) => s.workMode);
  const bounds = useMemo(() => monthBounds(), []);
  const [fromDate, setFromDate] = useState(bounds.from);
  const [toDate, setToDate] = useState(bounds.to);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const isPersonalView = isStaffPersonalView(user?.role, user?.employee_id, workMode);
  const canSync = !isPersonalView && ['ADMIN', 'NODAL_OFFICER', 'NODAL_OFFICE'].includes(user?.role || '');
  const isStaffView = isPersonalView;
  const showPipeline = !isStaffView;

  const load = useCallback(async (sync = true) => {
    setLoading(true);
    setError('');
    try {
      const reportParams: Record<string, string | boolean> = {
        from_date: fromDate,
        to_date: toDate,
        sync,
      };
      if (isPersonalView && user?.employee_id) {
        reportParams.employee_id = user.employee_id;
      }
      const [reportRes, pipelineRes] = await Promise.all([
        attendanceApi.report(reportParams),
        attendanceApi.pipelineStatus(),
      ]);
      setRows(reportRes.data.rows || []);
      setStages(pipelineRes.data.stages || []);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Could not load attendance.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, isPersonalView, user?.employee_id]);

  useEffect(() => {
    void load(true);
  }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await attendanceApi.syncFromLeave({ from_date: fromDate, to_date: toDate });
      await load(false);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const statusClass = (status: string) => {
    if (status === 'ON_LEAVE') return 'text-amber-700 bg-amber-50';
    if (status === 'ON_DUTY' || status === 'PRESENT') return 'text-emerald-700 bg-emerald-50';
    if (status === 'WEEKEND' || status === 'HOLIDAY') return 'text-slate-600 bg-slate-100';
    return 'text-slate-700 bg-slate-50';
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'My Attendance' }]}
        hideTitle
      />

      <div className="space-y-4">
        {showPipeline && stages.length > 0 && (
          <div className="card card-body">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Attendance pipeline</h3>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-xs">
              {stages.map((stage) => (
                <li key={stage.key} className="rounded-lg border border-slate-200 p-3 bg-slate-50/60">
                  <div className="font-medium text-slate-800">{stage.order}. {stage.label}</div>
                  <div className={`mt-1 inline-block px-1.5 py-0.5 rounded ${stage.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                    {stage.status}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="card card-body flex flex-wrap gap-3 items-end">
          <div>
            <label className="form-label">From</label>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input" />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} className="form-input" />
          </div>
          <button type="button" onClick={() => void load(true)} className="btn-secondary" disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
          {canSync && (
            <button type="button" onClick={() => void handleSync()} className="btn-primary" disabled={syncing}>
              {syncing ? 'Syncing…' : 'Sync from leave'}
            </button>
          )}
        </div>

        {error && <div className="px-4 py-3 rounded-lg text-sm bg-rose-50 border border-rose-200 text-rose-800">{error}</div>}

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  {!isStaffView && <th className="text-left px-4 py-2 font-medium">Employee</th>}
                  {!isStaffView && <th className="text-left px-4 py-2 font-medium">Department</th>}
                  <th className="text-left px-4 py-2 font-medium">Leave</th>
                  {!isStaffView && <th className="text-left px-4 py-2 font-medium">Biometric</th>}
                  {!isStaffView && <th className="text-left px-4 py-2 font-medium">Review</th>}
                  <th className="text-left px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={isStaffView ? 3 : 7} className="px-4 py-8 text-center text-slate-400">
                      No attendance rows for this period.
                    </td>
                  </tr>
                )}
                {rows.map((row, idx) => (
                  <tr key={`${row.attendance_date}-${row.emp_code}-${idx}`} className="border-t border-slate-100">
                    <td className="px-4 py-2 whitespace-nowrap">{row.attendance_date}</td>
                    {!isStaffView && (
                      <td className="px-4 py-2">
                        <div className="font-medium text-slate-800">{row.employee_name}</div>
                        <div className="text-xs text-slate-500">{row.emp_code}</div>
                      </td>
                    )}
                    {!isStaffView && <td className="px-4 py-2 text-slate-600">{row.department_name || '—'}</td>}
                    <td className="px-4 py-2">
                      {row.leave_type_code ? (
                        <span>
                          {row.leave_type_code}
                          {row.is_commuted ? ' (commuted)' : ''}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    {!isStaffView && <td className="px-4 py-2 text-slate-500">{row.biometric_status || '—'}</td>}
                    {!isStaffView && <td className="px-4 py-2 text-slate-500">{row.review_status || 'PENDING'}</td>}
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass(row.final_status)}`}>
                        {row.final_status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
