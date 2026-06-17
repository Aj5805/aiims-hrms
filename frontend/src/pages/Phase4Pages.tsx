import { useState, useEffect } from 'react';
import { leaveAppApi, approvalsApi } from '../api/phase4_endpoints';
import { useAuthStore } from '../stores';

export function ApplyLeavePage() {
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState({
    employee_id: user?.employee_id || '', leave_type_code: 'EL', from_date: '', to_date: '',
    reason: '', address_during_leave: '', is_half_day: false
  });
  const [msg, setMsg] = useState('');

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
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-gray-800 mb-4">Apply for Leave</h2>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4 text-sm">{msg}</div>}
      <form onSubmit={submit} className="bg-white rounded-lg shadow p-6 space-y-3">
        {(user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER') && (
          <input placeholder="Employee ID (UUID for now)" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} className="w-full border rounded px-3 py-2" required />
        )}
        <select value={form.leave_type_code} onChange={(e) => setForm({ ...form, leave_type_code: e.target.value })} className="w-full border rounded px-3 py-2">
          <option>EL</option><option>HPL</option><option>CL</option><option>ML</option><option>PL</option><option>CCL</option><option>EOL</option><option>OD</option><option>COMP_OFF</option><option>COMMUTED</option><option>ANNUAL_RES</option>
        </select>
        <div className="flex gap-2">
          <input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} className="flex-1 border rounded px-3 py-2" required />
          <input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} className="flex-1 border rounded px-3 py-2" required />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.is_half_day} onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })} /> Half Day
        </label>
        <textarea placeholder="Reason *" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full border rounded px-3 py-2 h-24" required />
        <input placeholder="Address during leave" value={form.address_during_leave} onChange={(e) => setForm({ ...form, address_during_leave: e.target.value })} className="w-full border rounded px-3 py-2" />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">Submit Application</button>
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
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">My Applications</h2>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="border rounded px-3 py-2 mb-4 text-sm">
        <option value="">All</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>APPROVED</option><option>REJECTED</option><option>WITHDRAWN</option>
      </select>
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left">App #</th>
              <th className="px-3 py-2 text-left">Employee</th>
              <th className="px-3 py-2 text-left">Type</th>
              <th className="px-3 py-2 text-left">Dates</th>
              <th className="px-3 py-2 text-left">Days</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a: Record<string, unknown>) => (
              <tr key={a.id as string} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">{a.app_number as string}</td>
                <td className="px-3 py-2">{a.emp_name as string}</td>
                <td className="px-3 py-2">{a.leave_type_code as string}</td>
                <td className="px-3 py-2 text-xs">{a.from_date as string} &rarr; {a.to_date as string}</td>
                <td className="px-3 py-2">{String(a.applied_days)}</td>
                <td className="px-3 py-2"><StatusBadge status={a.status as string} /></td>
                <td className="px-3 py-2">
                  {(a.status as string) === 'SUBMITTED' && (
                    <button onClick={() => withdraw(a.id as string)} className="text-red-600 text-xs">Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Approval Inbox</h2>
      <div className="space-y-3">
        {items.map((a: Record<string, unknown>) => (
          <div key={a.id as string} className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{a.emp_name as string} <span className="text-gray-400">({a.emp_code as string})</span></p>
                <p className="text-sm text-gray-600">{a.leave_type_code as string} &mdash; {a.from_date as string} &rarr; {a.to_date as string} ({String(a.applied_days)} days)</p>
                <p className="text-xs text-gray-400 mt-1">Pending: {parseFloat(String(a.hours_pending)).toFixed(1)}h | SLA: {a.sla_hours as number}h</p>
              </div>
              <StatusBadge status={a.status as string} />
            </div>
            <input placeholder="Remarks" value={remark[a.id as string] || ''} onChange={(e) => setRemark({ ...remark, [a.id as string]: e.target.value })} className="w-full border rounded px-3 py-2 mt-2 text-sm" />
            <div className="flex gap-2 mt-2">
              <button onClick={() => act(a.id as string, 'APPROVED')} className="px-3 py-1 bg-green-600 text-white rounded text-sm">Approve</button>
              <button onClick={() => act(a.id as string, 'REJECTED')} className="px-3 py-1 bg-red-600 text-white rounded text-sm">Reject</button>
              <button onClick={() => act(a.id as string, 'FORWARDED')} className="px-3 py-1 bg-gray-600 text-white rounded text-sm">Forward</button>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-gray-400 text-center py-8">No pending applications</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    UNDER_REVIEW: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
    WITHDRAWN: 'bg-gray-100 text-gray-500',
    RECALLED: 'bg-purple-100 text-purple-700'
  };
  return <span className={`text-xs px-2 py-1 rounded font-medium ${colors[status] || 'bg-gray-100'}`}>{status}</span>;
}