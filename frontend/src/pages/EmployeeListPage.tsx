import { useState, useEffect } from 'react';

import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';

import { employeesApi } from '../api/endpoints';

import { useAuthStore } from '../stores';

import AddStaffForm from '../components/AddStaffForm';

import EmployeeLifecyclePanel, {
  isLifecycleTab,
  lifecycleTabToAction,
  type LifecycleTabId,
} from '../components/EmployeeLifecyclePanel';
import { PageHeader } from '../components/PageHeader';

import { hasSystemRole, HR_EDITOR_ROLES } from '../constants/roles';



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

}



type EmployeeTab = 'directory' | 'onboard' | LifecycleTabId;



const DIRECTORY_TAB: EmployeeTab = 'directory';

const ONBOARD_TAB: EmployeeTab = 'onboard';



const TAB_LABELS: Record<EmployeeTab, string> = {

  directory: 'Directory',

  onboard: 'Onboard',

  deactivate: 'Resign / deactivate',

  reactivate: 'Rejoin',

  designation: 'Promotion',

  transfer: 'Transfer',

};



export default function EmployeeListPage() {

  const [employees, setEmployees] = useState<Employee[]>([]);

  const [search, setSearch] = useState('');

  const [loading, setLoading] = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();

  const rawTab = searchParams.get('tab');

  const activeTab: EmployeeTab = (() => {

    if (rawTab === 'lifecycle' || rawTab === 'bulk') return 'deactivate';

    if (rawTab && rawTab in TAB_LABELS) return rawTab as EmployeeTab;

    return DIRECTORY_TAB;

  })();

  const setActiveTab = (tab: EmployeeTab) => setSearchParams({ tab });

  const [onboardDirty, setOnboardDirty] = useState(false);

  const user = useAuthStore((s) => s.user);

  const navigate = useNavigate();
  const location = useLocation();
  const canEdit = hasSystemRole(user?.role, HR_EDITOR_ROLES);
  const preselectedEmployeeId = (location.state as { employeeId?: string } | null)?.employeeId;



  const handleOnboardCancel = () => {

    if (onboardDirty && !window.confirm('You have unsaved onboarding data. Leave without saving?')) return;

    setOnboardDirty(false);

    setActiveTab(DIRECTORY_TAB);

  };



  useEffect(() => {

    if (rawTab === 'lifecycle' || rawTab === 'bulk') {

      setSearchParams({ tab: rawTab === 'bulk' ? 'directory' : 'deactivate' }, { replace: true });

    }

  }, [rawTab, setSearchParams]);



  const fetchEmployees = async () => {

    setLoading(true);

    try {

      const { data } = await employeesApi.list({ search, limit: '200' });

      setEmployees(data);

    } catch (err) {

      console.error(err);

    } finally {

      setLoading(false);

    }

  };



  useEffect(() => {

    if (!user) { navigate('/login'); return; }

    if (activeTab === DIRECTORY_TAB) {

      fetchEmployees();

    }

  }, [search, activeTab]);



  const breadcrumbLabel = TAB_LABELS[activeTab];

  const showLifecycle = isLifecycleTab(activeTab) && canEdit;



  return (

    <div className="page">

      <PageHeader

        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'HR Operations' }, { label: breadcrumbLabel }]}

        hideTitle

      />

      <div className="card overflow-hidden">

        <div className="p-3 sm:p-4">

          {activeTab === DIRECTORY_TAB && (

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



          {activeTab === ONBOARD_TAB && (

            <AddStaffForm

              onDirtyChange={setOnboardDirty}

              onSaved={(employeeId) => {

                setOnboardDirty(false);

                if (employeeId) {

                  navigate(`/employees/${employeeId}`);

                } else {

                  setActiveTab(DIRECTORY_TAB);

                  setSearch('');

                  fetchEmployees();

                }

              }}

              onCancel={handleOnboardCancel}

            />

          )}



          {showLifecycle && (

            <EmployeeLifecyclePanel

              action={lifecycleTabToAction(activeTab)}

              preselectedEmployeeId={preselectedEmployeeId}

            />

          )}

        </div>

      </div>

    </div>

  );

}

