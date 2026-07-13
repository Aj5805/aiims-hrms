import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { departmentsApi, designationsApi, employeesApi } from '../api/endpoints';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { SearchableSelect } from '../components/SearchableSelect';
import { formatHttpError } from '../constants/roles';

export type LifecycleAction = 'deactivate' | 'reactivate' | 'change_designation' | 'transfer';

type EmployeeOption = {
  id: string;
  emp_code: string;
  name: string;
  is_active: boolean;
  category_code?: string;
  category_name?: string;
  department_code?: string;
  department_name?: string;
  designation_name?: string;
  user_id?: string;
};

type DesignationOption = { name: string; category_code?: string };
type DepartmentOption = { code: string; name: string };

const ACTION_COPY: Record<
  LifecycleAction,
  { title: string; submit: string; activeOnly: boolean; hint?: string }
> = {
  deactivate: {
    title: 'Resign / deactivate employee',
    submit: 'Deactivate & disable login',
    activeOnly: true,
    hint: 'Separation from service — sets last working day, deactivates login, and removes HOD assignment if applicable.',
  },
  reactivate: {
    title: 'Rejoin employee',
    submit: 'Reactivate & enable login',
    activeOnly: false,
    hint: 'Re-employment — restores login access and creates any missing leave balances for the current year.',
  },
  change_designation: {
    title: 'Promotion / designation change',
    submit: 'Save designation',
    activeOnly: true,
    hint: 'Updates designation and staff category (promotion or demotion). Leave balances for newly entitled types are bootstrapped.',
  },
  transfer: {
    title: 'Transfer department',
    submit: 'Transfer',
    activeOnly: true,
    hint: 'Moves the employee to another department. Staff number prefix may update when rules require it.',
  },
};

type Props = {
  action: LifecycleAction;
  preselectedEmployeeId?: string;
};

export default function EmployeeLifecyclePanel({ action, preselectedEmployeeId }: Props) {
  const copy = ACTION_COPY[action];
  const [employeeId, setEmployeeId] = useState(preselectedEmployeeId || '');
  const [selectedDetail, setSelectedDetail] = useState<EmployeeOption | null>(null);
  const [dol, setDol] = useState('');
  const [rejoinDoj, setRejoinDoj] = useState('');
  const [designationName, setDesignationName] = useState('');
  const [payLevel, setPayLevel] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [designations, setDesignations] = useState<DesignationOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadEmployee = useCallback(async (id: string) => {
    if (!id) {
      setSelectedDetail(null);
      return;
    }
    try {
      const { data } = await employeesApi.get(id);
      setSelectedDetail(data);
    } catch {
      setSelectedDetail(null);
    }
  }, []);

  useEffect(() => {
    if (preselectedEmployeeId) setEmployeeId(preselectedEmployeeId);
  }, [preselectedEmployeeId]);

  useEffect(() => {
    void loadEmployee(employeeId);
  }, [employeeId, loadEmployee]);

  useEffect(() => {
    if (action === 'transfer') {
      void departmentsApi.list({ is_active: true }).then((res) => setDepartments(res.data || []));
    }
    if (action === 'change_designation') {
      void designationsApi.list().then((res) => setDesignations(res.data || []));
    }
  }, [action]);

  const selected = selectedDetail;

  const filteredDesignations = useMemo(() => {
    if (!selected?.category_code) return designations;
    const sameCategory = designations.filter((d) => !d.category_code || d.category_code === selected.category_code);
    return sameCategory.length > 0 ? sameCategory : designations;
  }, [designations, selected?.category_code]);

  const designationOptions = useMemo(
    () => filteredDesignations.map((d) => ({ value: d.name, label: d.name })),
    [filteredDesignations],
  );

  const departmentOptions = useMemo(
    () => departments.map((d) => ({ value: d.code, label: d.name, searchText: d.code })),
    [departments],
  );

  useEffect(() => {
    if (selected && action === 'change_designation') {
      setDesignationName(selected.designation_name || '');
      setPayLevel('');
    }
    if (selected && action === 'transfer') {
      setDepartmentCode(selected.department_code || '');
    }
  }, [selected, action]);

  const resetFields = () => {
    setEmployeeId('');
    setSelectedDetail(null);
    setDol('');
    setRejoinDoj('');
    setDesignationName('');
    setPayLevel('');
    setDepartmentCode('');
    setError('');
  };

  const submit = async () => {
    if (!selected) return;
    setError('');
    setMessage('');

    if (action === 'deactivate') {
      const ok = window.confirm(
        `Deactivate ${selected.name}? Their login will be disabled${selected.user_id ? '' : ' (no login on file)'}.`,
      );
      if (!ok) return;
    }
    if (action === 'reactivate') {
      const ok = window.confirm(`Reactivate ${selected.name} and restore login access?`);
      if (!ok) return;
    }

    const payload: Record<string, unknown> = { action };
    if (action === 'deactivate' && dol) payload.dol_last_working = dol;
    if (action === 'reactivate' && rejoinDoj) payload.doj = rejoinDoj;
    if (action === 'change_designation') {
      if (!designationName.trim()) {
        setError('Select a designation.');
        return;
      }
      payload.designation_name = designationName.trim();
      if (payLevel.trim()) payload.pay_level = payLevel.trim();
    }
    if (action === 'transfer') {
      if (!departmentCode) {
        setError('Select a department.');
        return;
      }
      if (departmentCode === selected.department_code) {
        setError('Employee is already in that department.');
        return;
      }
      payload.department_code = departmentCode;
    }

    setBusy(true);
    try {
      await employeesApi.lifecycle(selected.id, payload);
      setMessage(`${selected.emp_code} — ${copy.title.toLowerCase()} completed.`);
      resetFields();
    } catch (err) {
      setError(formatHttpError(err, 'Lifecycle action failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl space-y-4">
      {copy.hint && (
        <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{copy.hint}</p>
      )}

      <div>
        <label className="form-label">Employee</label>
        <EmployeeSearchSelect
          value={employeeId}
          onChange={setEmployeeId}
          activeOnly={copy.activeOnly}
          placeholder="Type staff number or name, or pick from list…"
        />
      </div>

      {selected && (
        <div className="text-xs text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-1">
          <div>{selected.designation_name} · {selected.department_name}</div>
          <div className="text-slate-500">{selected.category_name}</div>
        </div>
      )}

      {action === 'deactivate' && selected && (
        <div>
          <label className="form-label">Last working day</label>
          <input type="date" value={dol} onChange={(e) => setDol(e.target.value)} className="form-input" />
          <p className="text-[11px] text-slate-500 mt-1">Leave blank to use today.</p>
        </div>
      )}

      {action === 'reactivate' && selected && (
        <div>
          <label className="form-label">Rejoin date (optional)</label>
          <input type="date" value={rejoinDoj} onChange={(e) => setRejoinDoj(e.target.value)} className="form-input" />
          <p className="text-[11px] text-slate-500 mt-1">Set only when re-employment should update date of joining.</p>
        </div>
      )}

      {action === 'change_designation' && selected && (
        <>
          <div>
            <label className="form-label">New designation</label>
            <SearchableSelect
              options={designationOptions}
              value={designationName}
              onChange={setDesignationName}
              placeholder="Search or select designation…"
            />
          </div>
          <div>
            <label className="form-label">Pay level (optional)</label>
            <input
              type="text"
              value={payLevel}
              onChange={(e) => setPayLevel(e.target.value.toUpperCase())}
              className="form-input uppercase"
              placeholder="e.g. L10"
            />
          </div>
        </>
      )}

      {action === 'transfer' && selected && (
        <div>
          <label className="form-label">New department</label>
          <SearchableSelect
            options={departmentOptions}
            value={departmentCode}
            onChange={setDepartmentCode}
            placeholder="Search or select department…"
          />
        </div>
      )}

      {error && <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded px-3 py-2">{error}</p>}
      {message && <p className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">{message}</p>}

      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          disabled={!selected || busy}
          onClick={() => void submit()}
          className="btn-primary disabled:opacity-50"
        >
          {busy ? 'Processing…' : copy.submit}
        </button>
        {selected && (
          <Link to={`/employees/${selected.id}`} className="text-xs font-medium text-indigo-600 hover:underline">
            View profile
          </Link>
        )}
      </div>
    </div>
  );
}

export const LIFECYCLE_TABS = [
  { id: 'deactivate', label: 'Resign / deactivate' },
  { id: 'reactivate', label: 'Rejoin' },
  { id: 'designation', label: 'Promotion' },
  { id: 'transfer', label: 'Transfer' },
] as const;

export type LifecycleTabId = (typeof LIFECYCLE_TABS)[number]['id'];

export function isLifecycleTab(tab: string | null): tab is LifecycleTabId {
  return LIFECYCLE_TABS.some((t) => t.id === tab);
}

export function lifecycleTabToAction(tab: LifecycleTabId): LifecycleAction {
  if (tab === 'designation') return 'change_designation';
  return tab;
}
