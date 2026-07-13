import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { leaveAppApi, approvalsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { LeaveStatusBadge } from '../components/LeaveStatusBadge';
import { ApprovalTrailPanel } from '../components/ApprovalTrailPanel';

import { formatHttpError, hasSystemRole, HR_EDITOR_ROLES } from '../constants/roles';
import { isStaffPersonalView } from '../utils/workMode';

export function MyApplicationsPage() {
  const user = useAuthStore((state) => state.user);
  const workMode = useAuthStore((state) => state.workMode);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedAppId = searchParams.get('app');
  const detailRef = useRef<HTMLDivElement | null>(null);
  const canRecall = hasSystemRole(user?.role, HR_EDITOR_ROLES);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');
  const [changeForm, setChangeForm] = useState<Record<string, string>>({});
  const [activeChange, setActiveChange] = useState<{ id: string; kind: string } | null>(null);
  const [error, setError] = useState('');

  const personalView = isStaffPersonalView(user?.role, user?.employee_id, workMode);

  const load = async () => {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (personalView && user?.employee_id) params.employee_id = user.employee_id;
    const { data } = await leaveAppApi.list(params);
    setApps(data);
  };
  useEffect(() => { load(); }, [status, personalView, user?.employee_id]);

  useEffect(() => {
    if (selectedAppId && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedAppId, apps]);

  const selectedApp = apps.find((a) => a.id === selectedAppId);

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
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Leave & Attendance', to: '/leave-dashboard' },
          { label: 'My Applications' },
        ]}
        hideTitle
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
                <tr
                  key={a.id as string}
                  className={selectedAppId === a.id ? 'bg-indigo-50/60' : ''}
                  onClick={() => setSearchParams({ app: a.id as string })}
                  style={{ cursor: 'pointer' }}
                >
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

      {selectedApp && (
        <div ref={detailRef} className="card card-body max-w-2xl mt-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-slate-900">Application {selectedApp.app_number as string}</h3>
            <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setSearchParams({})}>Close</button>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-slate-500">Leave type</span><div className="font-medium">{selectedApp.leave_type_code as string}</div></div>
            <div><span className="text-slate-500">Status</span><div><LeaveStatusBadge status={selectedApp.status as string} /></div></div>
            <div><span className="text-slate-500">From</span><div className="font-medium">{selectedApp.from_date as string}</div></div>
            <div><span className="text-slate-500">To</span><div className="font-medium">{selectedApp.to_date as string}</div></div>
            <div><span className="text-slate-500">Days</span><div className="font-medium">{String(selectedApp.applied_days)}</div></div>
            <div><span className="text-slate-500">Kind</span><div className="font-medium">{(selectedApp.application_kind as string) || 'NEW'}</div></div>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <ApprovalTrailPanel applicationId={selectedApp.id as string} />
          </div>
        </div>
      )}

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
              <p className="text-xs text-slate-500 mt-1">First day back at work.</p>
            </div>
          )}
          {activeChange.kind === 'MODIFICATION' && (
            <>
              <p className="text-xs text-slate-500">Extend dates only. Early return → Rejoin.</p>
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
            <p className="text-xs text-slate-500">Cancel unused approved leave (needs approval).</p>
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
