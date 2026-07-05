import { useState, useEffect } from 'react';
import { leaveAppApi, approvalsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { LeaveStatusBadge } from '../components/LeaveStatusBadge';

import { formatHttpError, hasSystemRole, HR_EDITOR_ROLES } from '../constants/roles';

export function MyApplicationsPage() {
  const user = useAuthStore((state) => state.user);
  const canRecall = hasSystemRole(user?.role, HR_EDITOR_ROLES);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');
  const [changeForm, setChangeForm] = useState<Record<string, string>>({});
  const [activeChange, setActiveChange] = useState<{ id: string; kind: string } | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await leaveAppApi.list(status ? { status } : {});
    setApps(data);
  };
  useEffect(() => { load(); }, [status]);

  const withdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return;
    await leaveAppApi.withdraw(id);
    load();
  };

  const recall = async (id: string) => {
    if (!confirm('Recall approved leave and restore balance? This is for nodal/admin correction only.')) return;
    try {
      await approvalsApi.recall(id);
      setError('');
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Recall failed');
    }
  };

  const submitChange = async (app: Record<string, unknown>) => {
    const id = app.id as string;
    const kind = activeChange?.kind || 'CANCELLATION';
    const payload: Record<string, unknown> = {
      employee_id: user?.employee_id || app.employee_id,
      parent_application_id: id,
      request_kind: kind === 'REJOIN' ? 'MODIFICATION' : kind,
      reason: changeForm[id] || '',
    };
    if (kind === 'MODIFICATION') {
      payload.from_date = changeForm[`${id}_from`] || app.from_date;
      payload.to_date = changeForm[`${id}_to`] || app.to_date;
    }
    if (kind === 'REJOIN') {
      payload.rejoin_date = changeForm[`${id}_rejoin`];
    }
    try {
      await leaveAppApi.changeRequest(payload);
      setError('');
      setActiveChange(null);
      load();
    } catch (err: unknown) {
      setError(formatHttpError(err, 'Could not submit change request'));
    }
  };

  const changeTitle = (kind: string) => {
    if (kind === 'CANCELLATION') return 'Request cancellation';
    if (kind === 'REJOIN') return 'Report rejoin (cut leave short)';
    return 'Request modification (extend or change dates)';
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'My Applications' }]}
        title="My Applications"
      />
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm max-w-3xl">{error}</div>
      )}
      <div className="flex items-center gap-3 mb-1">
        <label className="form-label mb-0">Filter by status:</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="form-select w-48">
          <option value="">All</option>
          <option>SUBMITTED</option><option>UNDER_REVIEW</option><option>APPROVED</option>
          <option>REJECTED</option><option>WITHDRAWN</option><option>CANCELLED</option><option>RECALLED</option>
        </select>
      </div>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>App #</th>
                <th>Type</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Kind</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id as string}>
                  <td className="font-mono text-xs">{a.app_number as string}</td>
                  <td><span className="badge badge-blue">{a.leave_type_code as string}</span></td>
                  <td className="text-xs">
                    {a.from_date as string} → {a.to_date as string}
                    {a.actual_rejoin_date ? (
                      <span className="block text-emerald-700">Rejoined {String(a.actual_rejoin_date)}</span>
                    ) : null}
                  </td>
                  <td>{String(a.applied_days)}</td>
                  <td className="text-xs">{(a.application_kind as string) || 'NEW'}</td>
                  <td><LeaveStatusBadge status={a.status as string} /></td>
                  <td className="space-x-2 whitespace-nowrap">
                    {['SUBMITTED', 'UNDER_REVIEW'].includes(a.status as string) && (
                      <button onClick={() => withdraw(a.id as string)} className="text-red-500 text-xs font-medium">Withdraw</button>
                    )}
                    {(a.status as string) === 'APPROVED' && (a.application_kind as string || 'NEW') === 'NEW' && (
                      <>
                        <button onClick={() => setActiveChange({ id: a.id as string, kind: 'CANCELLATION' })} className="text-amber-600 text-xs font-medium">Cancel</button>
                        <button onClick={() => setActiveChange({ id: a.id as string, kind: 'REJOIN' })} className="text-emerald-600 text-xs font-medium">Rejoin</button>
                        <button onClick={() => setActiveChange({ id: a.id as string, kind: 'MODIFICATION' })} className="text-indigo-600 text-xs font-medium">Modify</button>
                        {canRecall && (
                          <button onClick={() => recall(a.id as string)} className="text-purple-600 text-xs font-medium">Recall</button>
                        )}
                      </>
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

      {activeChange && (
        <div className="card card-body max-w-lg mt-4 space-y-3">
          <h3 className="font-semibold">{changeTitle(activeChange.kind)}</h3>
          {activeChange.kind === 'REJOIN' && (
            <div>
              <label className="form-label">Date you rejoined duty *</label>
              <input
                type="date"
                className="form-input"
                value={changeForm[`${activeChange.id}_rejoin`] || ''}
                onChange={(e) => setChangeForm({ ...changeForm, [`${activeChange.id}_rejoin`]: e.target.value })}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                Enter the first day you were back at work. Unused leave days will be credited after approval.
              </p>
            </div>
          )}
          {activeChange.kind === 'MODIFICATION' && (
            <>
              <p className="text-xs text-slate-500">Change dates to extend leave or adjust the period. For early return, use Rejoin instead.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">From</label>
                  <input type="date" className="form-input"
                    value={changeForm[`${activeChange.id}_from`] || ''}
                    onChange={(e) => setChangeForm({ ...changeForm, [`${activeChange.id}_from`]: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">To</label>
                  <input type="date" className="form-input"
                    value={changeForm[`${activeChange.id}_to`] || ''}
                    onChange={(e) => setChangeForm({ ...changeForm, [`${activeChange.id}_to`]: e.target.value })} />
                </div>
              </div>
            </>
          )}
          {activeChange.kind === 'CANCELLATION' && (
            <p className="text-xs text-slate-500">Cancel approved leave you have not taken (or will not take). Requires HOD and nodal approval.</p>
          )}
          <textarea className="form-input h-20" placeholder="Reason for change..."
            value={changeForm[activeChange.id] || ''}
            onChange={(e) => setChangeForm({ ...changeForm, [activeChange.id]: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => {
              const app = apps.find((x) => x.id === activeChange.id);
              if (app) void submitChange(app);
            }}>Submit request</button>
            <button className="btn btn-sm" onClick={() => setActiveChange(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
