import { useState, useEffect } from 'react';
import { leaveAppApi, approvalsApi } from '../api/phase4_endpoints';
import { leaveTypesApi } from '../api/phase3_endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

export function ApplyLeavePage() {
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState({
    employee_id: user?.employee_id || '', leave_type_code: 'EL', from_date: '', to_date: '',
    reason: '', address_during_leave: '', is_half_day: false
  });
  const [msg, setMsg] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<Record<string, unknown>[]>([]);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);

  useEffect(() => {
    leaveTypesApi.list().then(res => {
      setLeaveTypes(res.data);
      if (res.data.length > 0) {
        setForm(f => ({ ...f, leave_type_code: res.data[0].code as string }));
      }
    }).catch(console.error).finally(() => setLoadingLeaveTypes(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { data } = await leaveAppApi.submit(form);
      setMsg(`Submitted! App #: ${data.app_number}, Days: ${data.applied_days}`);
    } catch (err: unknown) {
      setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed');
    }
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Apply for Leave' }]}
        title="Apply for Leave"
      />
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg mb-4 text-sm max-w-3xl">{msg}</div>}
      <form onSubmit={submit} className="card card-body space-y-4 max-w-3xl">
        {(user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER') && (
          <div>
            <label className="form-label">Employee ID (UUID)</label>
            <input value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="form-input" required />
          </div>
        )}

        <div>
          <label className="form-label">Leave Type *</label>
          <select value={form.leave_type_code} onChange={(e) => setForm({ ...form, leave_type_code: e.target.value })} className="form-select">
            {loadingLeaveTypes && <option value="">Loading...</option>}
            {!loadingLeaveTypes && leaveTypes.length === 0 && <option value="">No Leave Types configured</option>}
            {leaveTypes.map(lt => (
              <option key={lt.code as string} value={lt.code as string}>{lt.name as string} ({lt.code as string})</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">From Date *</label>
            <input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} className="form-input" required />
          </div>
          <div>
            <label className="form-label">To Date *</label>
            <input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} className="form-input" required />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="half-day" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })} className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded" />
          <label htmlFor="half-day" className="text-sm font-medium text-slate-700">Apply for Half Day</label>
        </div>

        <div>
          <label className="form-label">Reason *</label>
          <textarea placeholder="Enter a detailed reason for leave..." value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="form-input h-24 resize-none" required />
        </div>

        <div>
          <label className="form-label">Address during leave (optional)</label>
          <input placeholder="Station address..." value={form.address_during_leave} onChange={(e) => setForm({ ...form, address_during_leave: e.target.value })} className="form-input" />
        </div>

        <div className="pt-1">
          <button type="submit" className="btn-primary">Submit Application</button>
        </div>
      </form>
    </div>
  );
}

export function MyApplicationsPage() {
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    const { data } = await leaveAppApi.list(status ? { status } : {});
    setApps(data);
  };
  useEffect(() => { load(); }, [status]);

  const withdraw = async (id: string) => {
    if (!confirm('Withdraw?')) return;
    await leaveAppApi.withdraw(id);
    load();
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'My Applications' }]}
        title="My Applications"
      />
      <div className="flex items-center gap-3 mb-1">
        <label className="form-label mb-0">Filter by status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select w-48">
          <option value="">All</option>
          <option>SUBMITTED</option><option>UNDER_REVIEW</option><option>APPROVED</option>
          <option>REJECTED</option><option>WITHDRAWN</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>App #</th>
                <th>Employee</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a: Record<string, unknown>) => (
                <tr key={a.id as string}>
                  <td className="font-mono text-xs">{a.app_number as string}</td>
                  <td>{a.emp_name as string}</td>
                  <td><span className="badge badge-blue">{a.leave_type_code as string}</span></td>
                  <td className="text-xs">{a.from_date as string} → {a.to_date as string}</td>
                  <td>{String(a.applied_days)}</td>
                  <td><StatusBadge status={a.status as string} /></td>
                  <td>
                    {(a.status as string) === 'SUBMITTED' && (
                      <button onClick={() => withdraw(a.id as string)} className="text-red-500 text-xs hover:text-red-700 font-medium">Withdraw</button>
                    )}
                  </td>
                </tr>
              ))}
              {apps.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No applications found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ApprovalInboxPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [remark, setRemark] = useState<Record<string, string>>({});

  const load = async () => {
    const { data } = await approvalsApi.inbox();
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: string) => {
    await approvalsApi.action(id, { action, remarks: remark[id] || '' });
    load();
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Approvals', to: '/approver-dashboard' }, { label: 'Approval Inbox' }]}
        title="Approval Inbox"
        description="Review and action pending leave applications."
      />
      <div className="space-y-4">
        {items.map((a: Record<string, unknown>) => {
          const pendingHours = parseFloat(String(a.hours_pending));
          const slaColor = pendingHours > (a.sla_hours as number) * 0.8 ? 'text-red-600' : 'text-slate-500';
          return (
            <div key={a.id as string} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <h3 className="font-semibold text-slate-800 text-base">{a.emp_name as string}</h3>
                    <span className="badge badge-slate font-mono">{a.emp_code as string}</span>
                    <StatusBadge status={a.status as string} />
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <span className="font-semibold text-slate-700">{a.leave_type_code as string}</span> — {a.from_date as string} to {a.to_date as string}
                    <span className="ml-2 badge badge-blue">{String(a.applied_days)} Days</span>
                  </div>
                  <div className={`text-xs font-medium flex items-center gap-1 ${slaColor}`}>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Pending: {pendingHours.toFixed(1)}h (SLA: {a.sla_hours as number}h)
                  </div>
                </div>
                <div className="w-full sm:w-72 flex flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-4">
                  <textarea
                    placeholder="Add remarks (required for rejection)..."
                    value={remark[a.id as string] || ''}
                    onChange={(e) => setRemark({ ...remark, [a.id as string]: e.target.value })}
                    className="form-input h-16 resize-none"
                  />
                  <div className="flex gap-2">
                    <button onClick={() => act(a.id as string, 'APPROVED')} className="flex-1 btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700">Approve</button>
                    <button onClick={() => act(a.id as string, 'FORWARDED')} className="flex-1 btn btn-sm bg-blue-600 text-white hover:bg-blue-700">Forward</button>
                    <button onClick={() => act(a.id as string, 'REJECTED')} className="flex-1 btn btn-sm bg-red-600 text-white hover:bg-red-700">Reject</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="card p-12 text-center">
            <svg className="mx-auto h-10 w-10 text-slate-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
            </svg>
            <h3 className="text-sm font-semibold text-slate-700">All caught up!</h3>
            <p className="mt-1 text-sm text-slate-400">You have no pending applications to review.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    DRAFT:        'badge-slate',
    SUBMITTED:    'badge-blue',
    UNDER_REVIEW: 'badge-amber',
    APPROVED:     'badge-green',
    REJECTED:     'badge-red',
    WITHDRAWN:    'badge-slate',
    RECALLED:     'badge-purple',
  };
  return <span className={`badge ${cls[status] || 'badge-slate'}`}>{status}</span>;
}