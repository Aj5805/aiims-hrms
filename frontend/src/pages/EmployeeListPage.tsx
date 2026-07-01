import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { employeesApi, designationsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import AddStaffForm from '../components/AddStaffForm';
import { PageHeader } from '../components/PageHeader';

interface Employee {
  id: string;
  emp_code: string;
  name: string;
  gender: string;
  doj: string;
  category_name: string;
  department_name: string;
  designation_name: string;
  email?: string;
  is_active: boolean;
  user_id?: string;
}

type EmployeeTab = 'directory' | 'onboard' | 'lifecycle';

const TAB_LABELS: Record<EmployeeTab, string> = {
  directory: 'Directory',
  onboard: 'Onboard',
  lifecycle: 'Lifecycle',
};

const LIFECYCLE_ACTIONS = [
  { value: 'resign', label: 'Resign / deactivate', activeOnly: true },
  { value: 'rejoin', label: 'Rejoin / reactivate', activeOnly: false },
  { value: 'promote', label: 'Promote (change designation)', activeOnly: true },
  { value: 'demote', label: 'Demote (change designation)', activeOnly: true },
  { value: 'assign_hod', label: 'Assign as HOD', activeOnly: true },
] as const;

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: EmployeeTab =
    rawTab && rawTab in TAB_LABELS ? (rawTab as EmployeeTab) : 'directory';
  const setActiveTab = (tab: EmployeeTab) => setSearchParams({ tab });
  const [onboardDirty, setOnboardDirty] = useState(false);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canEdit = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'NODAL_OFFICER'].includes(user?.role ?? '');
  const canOnboard = canEdit;

  const requestTab = (tab: EmployeeTab) => {
    if (activeTab === 'onboard' && onboardDirty && tab !== 'onboard') {
      if (!window.confirm('You have unsaved onboarding data. Leave without saving?')) return;
    }
    if (tab !== 'onboard') setOnboardDirty(false);
    setActiveTab(tab);
  };

  const handleOnboardCancel = () => {
    if (onboardDirty && !window.confirm('You have unsaved onboarding data. Leave without saving?')) return;
    setOnboardDirty(false);
    setActiveTab('directory');
  };

  const [lifecycleEmpId, setLifecycleEmpId] = useState('');
  const [lifecycleAction, setLifecycleAction] = useState('');
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  useEffect(() => {
    if (rawTab === 'bulk') {
      setSearchParams({ tab: 'directory' }, { replace: true });
    }
  }, [rawTab, setSearchParams]);

  const runLifecycle = async (emp: Employee, action: string) => {
    try {
      if (action === 'promote' || action === 'demote') {
        const { data: desgs } = await designationsApi.list();
        const names = (desgs || []).map((d: { name: string }) => d.name);
        const newDesg = window.prompt(`New designation for ${action}:\n${names.slice(0, 8).join(', ')}…`, emp.designation_name);
        if (!newDesg) return;
        await employeesApi.lifecycle(emp.id, { action, designation_name: newDesg });
      } else if (action === 'resign') {
        if (!window.confirm(`Mark ${emp.name} as resigned? Their login will be deactivated.`)) return;
        await employeesApi.lifecycle(emp.id, { action });
      } else if (action === 'assign_hod') {
        if (!emp.user_id) { alert('Employee has no login account.'); return; }
        if (!window.confirm(`Assign ${emp.name} as HOD?`)) return;
        await employeesApi.lifecycle(emp.id, { action });
      } else {
        await employeesApi.lifecycle(emp.id, { action });
      }
      alert('Done.');
      fetchEmployees();
    } catch {
      alert('Action failed.');
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data } = await employeesApi.list({ search });
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (activeTab === 'directory' || activeTab === 'lifecycle') {
      fetchEmployees();
    }
  }, [search, activeTab]);

  const selectedLifecycleEmp = employees.find((e) => e.id === lifecycleEmpId);
  const visibleTabs = (Object.keys(TAB_LABELS) as EmployeeTab[]).filter((tab) => {
    if (tab === 'onboard' && !canOnboard) return false;
    if (tab === 'lifecycle' && !canEdit) return false;
    return true;
  });

  const runSelectedLifecycle = async () => {
    if (!selectedLifecycleEmp || !lifecycleAction) return;
    setLifecycleBusy(true);
    try {
      await runLifecycle(selectedLifecycleEmp, lifecycleAction);
      setLifecycleEmpId('');
      setLifecycleAction('');
    } finally {
      setLifecycleBusy(false);
    }
  };

  const breadcrumbLabel =
    activeTab === 'directory' ? 'Employee Directory' :
    activeTab === 'onboard' ? 'Onboard Employee' :
    'Employee Lifecycle';

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'HR Operations' }, { label: breadcrumbLabel }]}
        title={breadcrumbLabel}
        description={
          activeTab === 'directory' ? 'View staff directory (read-only).' :
          activeTab === 'onboard' ? 'Onboard a new employee into the system.' :
          'Resign, rejoin, promote, demote, or assign HOD for one employee at a time.'
        }
      />
      <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-3">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => requestTab(tab)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 sm:p-6">
          {activeTab === 'directory' && (
            <div>
              <div className="flex flex-wrap gap-2 items-center justify-between mb-3">
                <input
                  type="text"
                  placeholder="Search name or emp code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input w-full md:w-72 py-1.5 text-xs"
                />
              </div>

              {loading ? (
                <div className="py-8 text-center text-slate-500 text-sm">Loading…</div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="data-table data-table-compact">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Name</th>
                        <th>Gender</th>
                        <th>DOJ</th>
                        <th>Designation</th>
                        <th>Department</th>
                        <th>Category</th>
                        <th>Email</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => (
                        <tr
                          key={emp.id}
                          className="defer-render cursor-pointer hover:bg-slate-50"
                          onClick={() => navigate(`/employees/${emp.id}`)}
                        >
                          <td className="font-mono text-slate-500">{emp.emp_code}</td>
                          <td className="font-medium text-slate-900 whitespace-nowrap">{emp.name}</td>
                          <td>{emp.gender?.charAt(0) || '—'}</td>
                          <td className="whitespace-nowrap">{emp.doj ? new Date(emp.doj).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</td>
                          <td>{emp.designation_name}</td>
                          <td>{emp.department_name}</td>
                          <td className="text-slate-500">{emp.category_name}</td>
                          <td className="text-slate-500 max-w-[140px] truncate">{emp.email || '—'}</td>
                          <td>
                            <span className={emp.is_active ? 'badge-green' : 'badge-slate'}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr><td colSpan={9} className="py-8 text-center text-slate-400 text-xs">No employees found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'onboard' && (
            <AddStaffForm
              onDirtyChange={setOnboardDirty}
              onSaved={(employeeId) => {
                setOnboardDirty(false);
                if (employeeId) {
                  navigate(`/employees/${employeeId}`);
                } else {
                  setActiveTab('directory');
                  setSearch('');
                  fetchEmployees();
                }
              }}
              onCancel={handleOnboardCancel}
            />
          )}

          {activeTab === 'lifecycle' && canEdit && (
            <div className="max-w-xl space-y-4">
              <p className="text-sm text-slate-600">Select one employee and the action to perform.</p>
              <div>
                <label className="form-label">Employee</label>
                <select
                  value={lifecycleEmpId}
                  onChange={(e) => { setLifecycleEmpId(e.target.value); setLifecycleAction(''); }}
                  className="form-select"
                >
                  <option value="">Select employee…</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.emp_code} — {emp.name} ({emp.is_active ? 'Active' : 'Inactive'})
                    </option>
                  ))}
                </select>
              </div>
              {selectedLifecycleEmp && (
                <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 border border-slate-200">
                  {selectedLifecycleEmp.designation_name} · {selectedLifecycleEmp.department_name}
                </div>
              )}
              <div>
                <label className="form-label">Action</label>
                <select
                  value={lifecycleAction}
                  onChange={(e) => setLifecycleAction(e.target.value)}
                  className="form-select"
                  disabled={!selectedLifecycleEmp}
                >
                  <option value="">Select action…</option>
                  {LIFECYCLE_ACTIONS.filter((a) => {
                    if (!selectedLifecycleEmp) return true;
                    if (a.value === 'assign_hod' && user?.role === 'NODAL_OFFICE') return false;
                    return a.activeOnly ? selectedLifecycleEmp.is_active : !selectedLifecycleEmp.is_active;
                  }).map((a) => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                disabled={!selectedLifecycleEmp || !lifecycleAction || lifecycleBusy}
                onClick={() => void runSelectedLifecycle()}
                className="btn-primary disabled:opacity-50"
              >
                {lifecycleBusy ? 'Processing…' : 'Run action'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
