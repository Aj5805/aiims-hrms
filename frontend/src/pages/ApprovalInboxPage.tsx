import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { approvalsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { LeaveStatusBadge } from '../components/LeaveStatusBadge';
import { ApprovalTrailPanel } from '../components/ApprovalTrailPanel';

export function ApprovalInboxPage() {
  const [searchParams] = useSearchParams();
  const focusAppId = searchParams.get('app');
  const focusRef = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    if (focusAppId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusAppId, items]);

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
        breadcrumbs={[{ label: 'Home', to: '/hod' }, { label: 'Nodal Desk', to: '/hod' }, { label: 'Approval Inbox' }]}
        hideTitle
      />
      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">{error}</div>}
      <div className="space-y-4">
        {items.map((a) => {
          const pendingHours = parseFloat(String(a.hours_pending));
          const slaColor = pendingHours > (a.sla_hours as number) * 0.8 ? 'text-red-600' : 'text-slate-500';
          const kind = (a.application_kind as string) || 'NEW';
          return (
            <div
              key={a.id as string}
              ref={focusAppId === a.id ? focusRef : undefined}
              className={`card p-5 hover:shadow-md transition-shadow ${focusAppId === a.id ? 'ring-2 ring-indigo-300' : ''}`}
            >
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <h3 className="font-semibold text-slate-800 text-base">{a.emp_name as string}</h3>
                    <span className="badge badge-slate font-mono">{a.emp_code as string}</span>
                    <LeaveStatusBadge status={a.status as string} />
                    {kind !== 'NEW' && <span className="badge badge-purple">{kind}</span>}
                  </div>
                  <div className="text-sm text-slate-600 mb-2">
                    <span className="font-semibold text-slate-700">{a.leave_type_code as string}</span> â€” {a.from_date as string} to {a.to_date as string}
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
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <ApprovalTrailPanel applicationId={a.id as string} compact />
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
