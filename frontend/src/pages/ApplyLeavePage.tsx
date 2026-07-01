import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { leaveAppApi, leaveFormTemplatesApi, employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

type LeaveTypeRow = Record<string, unknown>;
type FormTemplate = {
  id: string;
  title: string;
  url: string;
  format: string;
  notes?: string;
  categories?: string[];
  leave_types?: string[];
  purposes?: string[];
  employee_groups?: string[];
};

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
    half_day_session: 'AN' as 'FN' | 'AN',
    mc_attached: false,
    emergency_regular_combo: false,
  });
  const [msg, setMsg] = useState('');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [projection, setProjection] = useState<Record<string, unknown> | null>(null);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);

  const selectedType = leaveTypes.find((lt) => lt.code === form.leave_type_code);
  const isCl = form.leave_type_code === 'CL';
  const isRegularLeave = ['EL', 'HPL', 'COMMUTED', 'EOL'].includes(form.leave_type_code);
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
      const payload: Record<string, unknown> = { ...form };
      if (!form.is_half_day) {
        delete payload.half_day_session;
      }
      if (form.emergency_regular_combo && !form.reason.includes('[Emergency continuation]')) {
        payload.reason = `[Emergency continuation] ${form.reason}`;
      }
      const { data } = await leaveAppApi.submit(payload);
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

      <div className="card card-body max-w-3xl mb-4 text-sm">
        <h3 className="font-semibold text-slate-800 mb-2">Official application forms (AIIMS Bibinagar)</h3>
        <p className="text-slate-500 mb-2">
          Download and fill the institutional proforma for your category, then submit here for workflow tracking.{' '}
          <Link to="/leave-forms" className="text-indigo-600 font-medium hover:underline">Browse all leave forms â†’</Link>
        </p>
        {formTemplates.length > 0 ? (
          <ul className="space-y-1">
            {formTemplates.map((t) => (
              <li key={t.id}>
                {t.url ? (
                  <a href={t.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">{t.title}</a>
                ) : (
                  <span>{t.title}</span>
                )}
                {t.notes && <span className="text-slate-400 ml-2">â€” {t.notes}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-slate-400 text-xs">No specific form for this leave type â€” see the full catalogue for related proformas.</p>
        )}
      </div>

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
          <select value={form.leave_type_code} onChange={(e) => setForm({ ...form, leave_type_code: e.target.value, emergency_regular_combo: false })} className="form-select">
            {loadingLeaveTypes && <option value="">Loading...</option>}
            {!loadingLeaveTypes && leaveTypes.length === 0 && <option value="">No leave types available</option>}
            {leaveTypes.map((lt) => (
              <option key={lt.code as string} value={lt.code as string}>{lt.name as string} ({lt.code as string})</option>
            ))}
          </select>
        </div>

        {isCl && (
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-slate-700 space-y-1">
            <p className="font-medium text-indigo-900">Casual Leave (DoPT rules)</p>
            <ul className="list-disc list-inside text-xs text-slate-600 space-y-0.5">
              <li>Weekends, public holidays, and restricted holidays before/after CL are <strong>not debited</strong> from your balance.</li>
              <li>Total absence (including attached non-working days) should not exceed 8 calendar days at one time.</li>
              <li>CL cannot be combined with EL/HPL across weekends or holidays only (sandwich rule).</li>
              <li>Exception: half-day CL followed by EL/HPL from the next day when illness/emergency â€” note this in your reason.</li>
            </ul>
          </div>
        )}

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
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 space-y-1">
            <div>
              <span className="font-medium">Balance check:</span>{' '}
              {String(projection.requested_days)} day(s) debited Â·{' '}
              {String(projection.effective_balance)} available after pending Â·{' '}
              projected {String(projection.projected_balance)} remaining
              {Number(projection.pending_commitments ?? 0) > 0 && (
                <span className="text-amber-700"> ({String(projection.pending_commitments)} days in other pending applications)</span>
              )}
            </div>
            {isCl && projection.absence_span_days != null && (
              <div className="text-xs text-slate-600">
                Calendar absence span: {String(projection.absence_span_days)} day(s)
                {typeof projection.absence_span_start === 'string' && typeof projection.absence_span_end === 'string' && (
                  <span> ({projection.absence_span_start} â†’ {projection.absence_span_end})</span>
                )}
                {projection.max_absence_span != null && (
                  <span> Â· limit {String(projection.max_absence_span)} days</span>
                )}
              </div>
            )}
            {Array.isArray(projection.warnings) && projection.warnings.length > 0 && (
              <div className="text-xs text-amber-800 font-medium">
                {(projection.warnings as string[]).join(' ')}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3">
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

        {form.is_half_day && (
          <div className="max-w-xs">
            <label className="form-label">Half-day session</label>
            <select
              value={form.half_day_session}
              onChange={(e) => setForm({ ...form, half_day_session: e.target.value as 'FN' | 'AN' })}
              className="form-select"
            >
              <option value="FN">Forenoon (FN)</option>
              <option value="AN">Afternoon (AN)</option>
            </select>
          </div>
        )}
        </div>

        {(isRegularLeave || (isCl && form.is_half_day)) && (
          <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.emergency_regular_combo}
                onChange={(e) => setForm({ ...form, emergency_regular_combo: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="font-medium">Emergency continuation on regular leave</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Check only when half-day CL (afternoon) is followed by EL/HPL from the next calendar day due to sudden illness or emergency. Approver will verify.
                </span>
              </span>
            </label>
          </div>
        )}

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
