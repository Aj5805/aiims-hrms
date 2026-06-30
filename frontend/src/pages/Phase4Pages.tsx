import { useState, useEffect, useCallback } from 'react';
import api from '../api/client';
import { leaveAppApi, approvalsApi, leaveFormTemplatesApi } from '../api/phase4_endpoints';
import { employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

type LeaveTypeRow = Record<string, unknown>;
type FormTemplate = { id: string; title: string; url: string; format: string; notes?: string };

export function ApplyLeavePage() {
  const user = useAuthStore((state) => state.user);
  const [form, setForm] = useState({
    employee_id: user?.employee_id || '',
    leave_type_code: '',
    from_date: '',
    to_date: '',
    reason: '',
    address_during_leave: '',
    is_half_day: false,
    mc_attached: false,
  });
  const [msg, setMsg] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [projection, setProjection] = useState<Record<string, number> | null>(null);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);

  const selectedType = leaveTypes.find((lt) => lt.code === form.leave_type_code);
  const mcRequired = Boolean(
    selectedType?.requires_mc && selectedType?.min_days_for_mc != null
  );

  const loadEligibleTypes = useCallback(async (employeeId: string) => {
    if (!employeeId) {
      setLeaveTypes([]);
      setFormTemplates([]);
      setForm((f) => ({ ...f, leave_type_code: '' }));
      setLoadingLeaveTypes(false);
      return;
    }
    setLoadingLeaveTypes(true);
    try {
      const { data } = await employeesApi.eligibleLeaveTypes(employeeId);
      setLeaveTypes(data);
      const firstCode = data.length > 0 ? (data[0].code as string) : '';
      setForm((f) => ({ ...f, leave_type_code: firstCode }));
      if (firstCode) {
        const cat = data[0].category_code as string;
        const tpl = await leaveFormTemplatesApi.list({ category_code: cat, leave_type_code: firstCode, purpose: 'APPLY' });
        setFormTemplates(tpl.data.templates || []);
      }
    } catch (err) {
      console.error(err);
      setLeaveTypes([]);
      setFormTemplates([]);
      setForm((f) => ({ ...f, leave_type_code: '' }));
    } finally {
      setLoadingLeaveTypes(false);
    }
  }, []);

  useEffect(() => {
    if (user?.employee_id && !form.employee_id) {
      setForm((f) => ({ ...f, employee_id: user.employee_id || '' }));
    }
  }, [user?.employee_id, form.employee_id]);

  useEffect(() => {
    void loadEligibleTypes(form.employee_id);
  }, [form.employee_id, loadEligibleTypes]);

  useEffect(() => {
    const loadTemplates = async () => {
      if (!form.leave_type_code || !selectedType?.category_code) {
        setFormTemplates([]);
        return;
      }
      const { data } = await leaveFormTemplatesApi.list({
        category_code: selectedType.category_code as string,
        leave_type_code: form.leave_type_code,
        purpose: 'APPLY',
      });
      setFormTemplates(data.templates || []);
    };
    void loadTemplates();
  }, [form.leave_type_code, selectedType?.category_code]);

  useEffect(() => {
    const loadProjection = async () => {
      if (!form.employee_id || !form.leave_type_code || !form.from_date || !form.to_date) {
        setProjection(null);
        return;
      }
      try {
        const { data } = await api.get(`/leave-balances/${form.employee_id}/project`, {
          params: {
            leave_type_code: form.leave_type_code,
            from_date: form.from_date,
            to_date: form.to_date,
          },
        });
        setProjection(data);
      } catch {
        setProjection(null);
      }
    };
    void loadProjection();
  }, [form.employee_id, form.leave_type_code, form.from_date, form.to_date]);

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

      {formTemplates.length > 0 && (
        <div className="card card-body max-w-3xl mb-4 text-sm">
          <h3 className="font-semibold text-slate-800 mb-2">Official application forms (AIIMS Bibinagar)</h3>
          <p className="text-slate-500 mb-2">Download and fill the institutional proforma for your category, then submit here for workflow tracking.</p>
          <ul className="space-y-1">
            {formTemplates.map((t) => (
              <li key={t.id}>
                {t.url ? (
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{t.title}</a>
                ) : (
                  <span>{t.title}</span>
                )}
                {t.notes && <span className="text-slate-400 ml-2">— {t.notes}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} className="card card-body space-y-4 max-w-3xl">
        {(user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER') && (
          <div>
            <label className="form-label">Employee ID (UUID)</label>
            <input
              value={form.employee_id}
              onChange={(e) => setForm({ ...form, employee_id: e.target.value })}
              className="form-input"
              required
            />
          </div>
        )}

        <div>
          <label className="form-label">Leave Type *</label>
          <select value={form.leave_type_code} onChange={(e) => setForm({ ...form, leave_type_code: e.target.value })} className="form-select">
            {loadingLeaveTypes && <option value="">Loading...</option>}
            {!loadingLeaveTypes && leaveTypes.length === 0 && <option value="">No leave types available</option>}
            {leaveTypes.map((lt) => (
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

        {projection && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            <span className="font-medium">Balance check:</span>{' '}
            {projection.requested_days} day(s) requested ·{' '}
            {projection.effective_balance} available after pending ·{' '}
            projected {projection.projected_balance} remaining
            {(projection.pending_commitments ?? 0) > 0 && (
              <span className="text-amber-700"> ({projection.pending_commitments} days in other pending applications)</span>
            )}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="half-day"
            checked={form.is_half_day}
            onChange={(e) => setForm({ ...form, is_half_day: e.target.checked })}
            disabled={!selectedType?.is_half_day_allowed}
            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded disabled:opacity-40"
          />
          <label htmlFor="half-day" className="text-sm font-medium text-slate-700">Apply for Half Day</label>
        </div>

        {mcRequired && (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="mc-attached"
              checked={form.mc_attached}
              onChange={(e) => setForm({ ...form, mc_attached: e.target.checked })}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded"
            />
            <label htmlFor="mc-attached" className="text-sm font-medium text-slate-700">
              Medical certificate attached (required when exceeding {String(selectedType?.min_days_for_mc)} days)
            </label>
          </div>
        )}

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
  const user = useAuthStore((state) => state.user);
  const [apps, setApps] = useState<Record<string, unknown>[]>([]);
  const [status, setStatus] = useState('');
  const [changeForm, setChangeForm] = useState<Record<string, string>>({});
  const [activeChange, setActiveChange] = useState<{ id: string; kind: string } | null>(null);

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
    if (!confirm('Recall approved leave and restore balance?')) return;
    await approvalsApi.recall(id);
    load();
  };

  const submitChange = async (app: Record<string, unknown>) => {
    const id = app.id as string;
    const kind = activeChange?.kind || 'CANCELLATION';
    const payload: Record<string, unknown> = {
      employee_id: user?.employee_id || app.employee_id,
      parent_application_id: id,
      request_kind: kind,
      reason: changeForm[id] || '',
    };
    if (kind === 'MODIFICATION') {
      payload.from_date = changeForm[`${id}_from`] || app.from_date;
      payload.to_date = changeForm[`${id}_to`] || app.to_date;
    }
    await leaveAppApi.changeRequest(payload);
    setActiveChange(null);
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
                  <td className="text-xs">{a.from_date as string} → {a.to_date as string}</td>
                  <td>{String(a.applied_days)}</td>
                  <td className="text-xs">{(a.application_kind as string) || 'NEW'}</td>
                  <td><StatusBadge status={a.status as string} /></td>
                  <td className="space-x-2 whitespace-nowrap">
                    {['SUBMITTED', 'UNDER_REVIEW'].includes(a.status as string) && (
                      <button onClick={() => withdraw(a.id as string)} className="text-red-500 text-xs font-medium">Withdraw</button>
                    )}
                    {(a.status as string) === 'APPROVED' && (a.application_kind as string || 'NEW') === 'NEW' && (
                      <>
                        <button onClick={() => setActiveChange({ id: a.id as string, kind: 'CANCELLATION' })} className="text-amber-600 text-xs font-medium">Cancel</button>
                        <button onClick={() => setActiveChange({ id: a.id as string, kind: 'MODIFICATION' })} className="text-indigo-600 text-xs font-medium">Modify</button>
                        <button onClick={() => recall(a.id as string)} className="text-purple-600 text-xs font-medium">Recall</button>
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
          <h3 className="font-semibold">{activeChange.kind === 'CANCELLATION' ? 'Request cancellation' : 'Request modification'}</h3>
          {activeChange.kind === 'MODIFICATION' && (
            <div className="grid grid-cols-2 gap-3">
              <input type="date" className="form-input" placeholder="From"
                value={changeForm[`${activeChange.id}_from`] || ''}
                onChange={(e) => setChangeForm({ ...changeForm, [`${activeChange.id}_from`]: e.target.value })} />
              <input type="date" className="form-input" placeholder="To"
                value={changeForm[`${activeChange.id}_to`] || ''}
                onChange={(e) => setChangeForm({ ...changeForm, [`${activeChange.id}_to`]: e.target.value })} />
            </div>
          )}
          <textarea className="form-input h-20" placeholder="Reason for change..."
            value={changeForm[activeChange.id] || ''}
            onChange={(e) => setChangeForm({ ...changeForm, [activeChange.id]: e.target.value })} />
          <div className="flex gap-2">
            <button className="btn-primary btn-sm" onClick={() => {
              const app = apps.find((x) => x.id === activeChange.id);
              if (app) void submitChange(app);
            }}>Submit request</button>
            <button className="btn btn-sm" onClick={() => setActiveChange(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ApprovalInboxPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [remark, setRemark] = useState<Record<string, string>>({});
  const [modifyOpen, setModifyOpen] = useState<Record<string, boolean>>({});
  const [modifyDates, setModifyDates] = useState<Record<string, { from: string; to: string }>>({});
  const [error, setError] = useState('');

  const load = async () => {
    const { data } = await approvalsApi.inbox();
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const act = async (id: string, action: string, extra: Record<string, unknown> = {}) => {
    setError('');
    try {
      await approvalsApi.action(id, { action, remarks: remark[id] || '', ...extra });
      load();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Action failed');
    }
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Approvals', to: '/approver-dashboard' }, { label: 'Approval Inbox' }]}
        title="Approval Inbox"
        description="Balance is re-checked at every stage including pending applications."
      />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      <div className="space-y-4">
        {items.map((a) => {
          const pendingHours = parseFloat(String(a.hours_pending));
          const slaColor = pendingHours > (a.sla_hours as number) * 0.8 ? 'text-red-600' : 'text-slate-500';
          const kind = (a.application_kind as string) || 'NEW';
          return (
            <div key={a.id as string} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-base">{a.emp_name as string}</h3>
                    <span className="badge badge-slate font-mono">{a.emp_code as string}</span>
                    <StatusBadge status={a.status as string} />
                    {kind !== 'NEW' && <span className="badge badge-purple">{kind}</span>}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <span className="font-semibold text-slate-700">{a.leave_type_code as string}</span> — {a.from_date as string} to {a.to_date as string}
                    <span className="ml-2 badge badge-blue">{String(a.applied_days)} Days</span>
                  </div>
                  {a.effective_balance != null && (
                    <div className="text-xs text-emerald-700 font-medium mb-1">
                      Effective balance (after pending): {String(a.effective_balance)} days
                    </div>
                  )}
                  <div className={`text-xs font-medium flex items-center gap-1 ${slaColor}`}>
                    Pending: {pendingHours.toFixed(1)}h (SLA: {a.sla_hours as number}h)
                  </div>
                </div>
                <div className="w-full sm:w-80 flex flex-col gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-4">
                  <textarea
                    placeholder="Remarks (required for rejection)..."
                    value={remark[a.id as string] || ''}
                    onChange={(e) => setRemark({ ...remark, [a.id as string]: e.target.value })}
                    className="form-input h-16 resize-none"
                  />
                  {modifyOpen[a.id as string] && (
                    <div className="grid grid-cols-2 gap-2">
                      <input type="date" className="form-input text-xs"
                        value={modifyDates[a.id as string]?.from || (a.from_date as string)}
                        onChange={(e) => setModifyDates({ ...modifyDates, [a.id as string]: { ...modifyDates[a.id as string], from: e.target.value } })} />
                      <input type="date" className="form-input text-xs"
                        value={modifyDates[a.id as string]?.to || (a.to_date as string)}
                        onChange={(e) => setModifyDates({ ...modifyDates, [a.id as string]: { ...modifyDates[a.id as string], to: e.target.value } })} />
                      <button className="col-span-2 btn btn-sm bg-indigo-600 text-white"
                        onClick={() => act(a.id as string, 'MODIFIED', {
                          modified_from_date: modifyDates[a.id as string]?.from || a.from_date,
                          modified_to_date: modifyDates[a.id as string]?.to || a.to_date,
                          modified_days: a.applied_days,
                        })}>Apply modified dates</button>
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => act(a.id as string, 'APPROVED')} className="flex-1 btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 min-w-[4rem]">Approve</button>
                    <button onClick={() => act(a.id as string, 'FORWARDED')} className="flex-1 btn btn-sm bg-blue-600 text-white hover:bg-blue-700 min-w-[4rem]">Forward</button>
                    <button onClick={() => act(a.id as string, 'REJECTED')} className="flex-1 btn btn-sm bg-red-600 text-white hover:bg-red-700 min-w-[4rem]">Reject</button>
                    <button onClick={() => setModifyOpen({ ...modifyOpen, [a.id as string]: !modifyOpen[a.id as string] })} className="btn btn-sm border border-slate-300">Modify</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="card p-12 text-center">
            <h3 className="text-sm font-semibold text-slate-700">All caught up!</h3>
            <p className="mt-1 text-sm text-slate-400">No pending applications.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    DRAFT: 'badge-slate',
    SUBMITTED: 'badge-blue',
    UNDER_REVIEW: 'badge-amber',
    APPROVED: 'badge-green',
    REJECTED: 'badge-red',
    WITHDRAWN: 'badge-slate',
    RECALLED: 'badge-purple',
    CANCELLED: 'badge-red',
  };
  return <span className={`badge ${cls[status] || 'badge-slate'}`}>{status}</span>;
}
