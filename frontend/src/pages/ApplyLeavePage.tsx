import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { leaveAppApi, employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { isStaffPersonalView } from '../utils/workMode';

type LeaveTypeRow = Record<string, unknown>;
type EmployeeProfile = {
  emp_code: string;
  name: string;
  designation_name: string;
  department_name: string;
  category_name: string;
  mobile?: string | null;
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function ReadOnlyField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900">{value || '—'}</dd>
    </div>
  );
}

export function ApplyLeavePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const workMode = useAuthStore((state) => state.workMode);
  const personalView = isStaffPersonalView(user?.role, user?.employee_id, workMode);
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
    is_commuted: false,
    emergency_regular_combo: false,
    single_day: true,
  });
  const [msg, setMsg] = useState('');
  const [msgTone, setMsgTone] = useState<'ok' | 'err'>('ok');
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeRow[]>([]);
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [projection, setProjection] = useState<Record<string, unknown> | null>(null);
  const [loadingLeaveTypes, setLoadingLeaveTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedType = leaveTypes.find((lt) => lt.code === form.leave_type_code);
  const isCl = form.leave_type_code === 'CL';
  const isHpl = form.leave_type_code === 'HPL';
  const isRegularLeave = ['EL', 'HPL', 'EOL'].includes(form.leave_type_code);
  const halfDayAllowed = Boolean(selectedType?.is_half_day_allowed) && !form.is_commuted;
  const applicationDate = useMemo(() => new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  }), []);

  const computedDays = useMemo(() => {
    if (!form.from_date || !form.to_date) return null;
    if (form.is_half_day) return 0.5;
    if (form.from_date === form.to_date) return 1;
    const from = new Date(`${form.from_date}T12:00:00`);
    const to = new Date(`${form.to_date}T12:00:00`);
    if (to < from) return null;
    return Math.round((to.getTime() - from.getTime()) / 86400000) + 1;
  }, [form.from_date, form.to_date, form.is_half_day]);

  const loadEmployee = useCallback(async (employeeId: string) => {
    if (!employeeId) {
      setEmployee(null);
      return;
    }
    try {
      const { data } = await employeesApi.get(employeeId);
      setEmployee({
        emp_code: data.emp_code,
        name: data.name,
        designation_name: data.designation_name,
        department_name: data.department_name,
        category_name: data.category_name,
        mobile: data.mobile,
      });
    } catch {
      setEmployee(null);
    }
  }, []);

  const loadEligibleTypes = useCallback(async (employeeId: string) => {
    if (!employeeId) {
      setLeaveTypes([]);
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
    } catch (err) {
      console.error(err);
      setLeaveTypes([]);
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
    void loadEmployee(form.employee_id);
  }, [form.employee_id, loadEligibleTypes, loadEmployee]);

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
            is_commuted: form.is_commuted,
            is_half_day: form.is_half_day,
          },
        });
        setProjection(data);
      } catch {
        setProjection(null);
      }
    };
    void loadProjection();
  }, [form.employee_id, form.leave_type_code, form.from_date, form.to_date, form.is_commuted, form.is_half_day]);

  const patchForm = (partial: Partial<typeof form>) => {
    setForm((current) => {
      const next = { ...current, ...partial };
      if (partial.single_day === true || (partial.from_date && next.single_day)) {
        next.to_date = partial.from_date ?? next.from_date;
      }
      if (partial.from_date && next.single_day) {
        next.to_date = partial.from_date;
      }
      return next;
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employee_id) {
      setMsgTone('err');
      setMsg('Your login is not linked to an employee record. Contact HR to apply for leave.');
      return;
    }
    if (form.is_commuted && !form.mc_attached) {
      setMsgTone('err');
      setMsg('Medical certificate is required for commuted HPL.');
      return;
    }
    setSubmitting(true);
    setMsg('');
    try {
      const toDate = form.single_day ? form.from_date : form.to_date;
      const payload: Record<string, unknown> = {
        ...form,
        employee_id: user.employee_id,
        to_date: toDate,
      };
      delete payload.single_day;
      if (!form.is_half_day) delete payload.half_day_session;
      if (!form.is_commuted) delete payload.is_commuted;
      if (form.emergency_regular_combo && !form.reason.includes('[Emergency continuation]')) {
        payload.reason = `[Emergency continuation] ${form.reason}`;
      }
      const { data } = await leaveAppApi.submit(payload);
      navigate(`/my-apps?app=${data.id}`);
    } catch (err: unknown) {
      setMsgTone('err');
      setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Submission failed. Check dates and balance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Apply for Leave' }]}
        hideTitle
      />

      {msg && (
        <div className={`px-4 py-3 rounded-lg mb-4 text-sm border ${
          msgTone === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'
        }`}>{msg}</div>
      )}

      {!user?.employee_id && personalView && (
        <div className="px-4 py-3 rounded-lg mb-4 text-sm border bg-amber-50 border-amber-200 text-amber-900">
          Your account is not linked to an employee profile, so leave cannot be applied online. Contact HR.
        </div>
      )}

      <form onSubmit={submit} className="space-y-5">
        {user?.role === 'ADMIN' && (
          <div className="card card-body">
            <label className="form-label">Employee ID (UUID)</label>
            <input
              value={form.employee_id}
              onChange={(e) => patchForm({ employee_id: e.target.value })}
              className="form-input"
              required
            />
          </div>
        )}

        <FormSection title="1. Applicant particulars">
          {employee ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              <ReadOnlyField label="Name" value={employee.name} />
              <ReadOnlyField label="Staff number" value={employee.emp_code} />
              <ReadOnlyField label="Designation" value={employee.designation_name} />
              <ReadOnlyField label="Department" value={employee.department_name} />
              <ReadOnlyField label="Category" value={employee.category_name} />
              <ReadOnlyField label="Date of application" value={applicationDate} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Loading applicant details…</p>
          )}
        </FormSection>

        <FormSection title="2. Nature and period of leave">
          <div>
            <label className="form-label">Nature of leave *</label>
            <select
              value={form.leave_type_code}
              onChange={(e) => patchForm({ leave_type_code: e.target.value, emergency_regular_combo: false })}
              className="form-select"
            >
              {loadingLeaveTypes && <option value="">Loading...</option>}
              {!loadingLeaveTypes && leaveTypes.length === 0 && <option value="">No leave types available</option>}
              {leaveTypes.map((lt) => (
                <option key={lt.code as string} value={lt.code as string}>{lt.name as string} ({lt.code as string})</option>
              ))}
            </select>
            {selectedType?.year_ref === 'TENURE' && (
              <p className="text-xs text-slate-500 mt-1">Tenure pool — fixed occasions over service.</p>
            )}
          </div>

          {isHpl && (
            <div className="rounded-lg border border-violet-100 bg-violet-50/60 p-3 space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_commuted}
                  onChange={(e) => patchForm({ is_commuted: e.target.checked, is_half_day: false })}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  <span className="font-medium text-violet-900">Commute HPL to full pay (medical certificate required)</span>
                  <span className="block text-xs text-slate-600 mt-0.5">
                    Whole days only. 2× HPL debit; 180-day lifetime cap.
                  </span>
                </span>
              </label>
            </div>
          )}

          {isCl && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-slate-600">
              <span className="font-medium text-indigo-900">CL (DoPT):</span> weekends/holidays free; 8-day span cap; no EL/HPL sandwich.
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={form.single_day}
              onChange={(e) => patchForm({ single_day: e.target.checked, to_date: form.from_date })}
              className="h-4 w-4 rounded border-slate-300"
            />
            Single-day leave
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="form-label">{form.single_day ? 'Date of absence *' : 'From *'}</label>
              <input
                type="date"
                value={form.from_date}
                onChange={(e) => patchForm({ from_date: e.target.value })}
                className="form-input"
                required
              />
            </div>
            {!form.single_day && (
              <div>
                <label className="form-label">To *</label>
                <input
                  type="date"
                  value={form.to_date}
                  min={form.from_date || undefined}
                  onChange={(e) => patchForm({ to_date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>
            )}
            <div>
              <label className="form-label">Total days</label>
              <div className="form-input bg-slate-50 text-slate-700">
                {computedDays != null ? computedDays : '—'}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_half_day}
                onChange={(e) => patchForm({ is_half_day: e.target.checked })}
                disabled={!halfDayAllowed}
                className="h-4 w-4 rounded border-slate-300 disabled:opacity-40"
              />
              Half-day leave
            </label>
            {form.is_half_day && (
              <select
                value={form.half_day_session}
                onChange={(e) => patchForm({ half_day_session: e.target.value as 'FN' | 'AN' })}
                className="form-select text-sm max-w-[10rem]"
              >
                <option value="FN">Forenoon (FN)</option>
                <option value="AN">Afternoon (AN)</option>
              </select>
            )}
          </div>

          {(isRegularLeave || (isCl && form.is_half_day)) && (
            <label className="flex items-start gap-2 text-sm text-slate-700 cursor-pointer rounded-lg border border-amber-100 bg-amber-50/40 p-3">
              <input
                type="checkbox"
                checked={form.emergency_regular_combo}
                onChange={(e) => patchForm({ emergency_regular_combo: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              <span>
                <span className="font-medium">Emergency continuation on regular leave</span>
                <span className="block text-xs text-slate-500 mt-0.5">Half-day CL + EL/HPL from next day.</span>
              </span>
            </label>
          )}

        </FormSection>

        <FormSection title="3. Leave account">
          {projection ? (
            <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Balance at credit</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{String(projection.effective_balance)} days</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Days applied for</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">
                  {String(projection.requested_days ?? computedDays ?? '—')}
                  {form.is_commuted && (
                    <span className="block text-xs font-normal text-violet-800">
                      {String(projection.balance_debit_days)} HPL days debited
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Balance after sanction</dt>
                <dd className="mt-0.5 font-semibold text-slate-900">{String(projection.projected_balance)} days</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-500">Select leave type and dates to see your leave balance.</p>
          )}
          {isCl && projection?.absence_span_days != null && (
            <p className="text-xs text-slate-600">
              Absence span: {String(projection.absence_span_days)} day(s)
              {projection.max_absence_span != null && ` · limit ${String(projection.max_absence_span)}`}
            </p>
          )}
          {Array.isArray(projection?.warnings) && projection.warnings.length > 0 && (
            <div className="text-xs text-amber-800 font-medium rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              {(projection.warnings as string[]).join(' ')}
            </div>
          )}
        </FormSection>

        <FormSection title="4. Purpose and contact during leave">
          <div>
            <label className="form-label">Purpose of leave *</label>
            <textarea
              placeholder="State the purpose for which leave is required…"
              value={form.reason}
              onChange={(e) => patchForm({ reason: e.target.value })}
              className="form-input h-24 resize-none"
              required
            />
          </div>

          <div>
            <label className="form-label">Address during leave</label>
            <textarea
              placeholder="Full postal address and contact number while on leave"
              value={form.address_during_leave}
              onChange={(e) => patchForm({ address_during_leave: e.target.value })}
              className="form-input h-20 resize-none"
            />
            {employee?.mobile && !form.address_during_leave && (
              <p className="text-xs text-slate-500 mt-1">Registered mobile: {employee.mobile}</p>
            )}
          </div>
        </FormSection>

        <FormSection title="5. Supporting documents">
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${form.is_commuted ? 'text-violet-900 font-medium' : 'text-slate-700'}`}>
            <input
              type="checkbox"
              checked={form.mc_attached}
              onChange={(e) => patchForm({ mc_attached: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300"
              required={form.is_commuted}
            />
            Medical certificate enclosed{form.is_commuted ? ' (required for commuted HPL)' : ' (if applicable)'}
          </label>
        </FormSection>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={submitting || !form.leave_type_code || !user?.employee_id} className="btn-primary">
            {submitting ? 'Submitting…' : 'Submit application'}
          </button>
          <p className="text-xs text-slate-500">
            Submission routes to HOD, then Nodal Officer for sanction.
          </p>
        </div>
      </form>
    </div>
  );
}
