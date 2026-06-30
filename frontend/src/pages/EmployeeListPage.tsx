import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { employeesApi } from '../api/endpoints';
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

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'directory' | 'onboard') || 'directory';
  const setActiveTab = (tab: 'directory' | 'onboard') => setSearchParams({ tab });
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

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
    if (activeTab === 'directory') {
      fetchEmployees();
    }
  }, [search, activeTab]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { data } = await employeesApi.importCsv(file);
      alert(`Import done: ${data.success_count} success, ${data.error_count} errors`);
      fetchEmployees();
    } catch {
      alert('Import failed');
    }
  };

  return (
    <div className="page">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'HR Operations' }, { label: activeTab === 'directory' ? 'Employees Directory' : 'Onboard Employee' }]}
        title={activeTab === 'directory' ? "Staff Directory" : "Onboard New Staff"}
        description={activeTab === 'directory' ? "View and manage staff directory." : "Onboard a new employee into the system."}
      />
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg w-fit mb-3">
        <button
          type="button"
          onClick={() => setActiveTab('directory')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'directory' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Directory
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('onboard')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${activeTab === 'onboard' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          Onboard
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className={activeTab === 'onboard' ? 'p-4 sm:p-6' : 'p-4'}>
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

                {!['NODAL_OFFICER', 'NODAL_OFFICE'].includes(user?.role ?? '') && (
                  <label className="btn-sm bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer rounded-md px-3 py-1.5 text-xs font-semibold">
                    Import CSV
                    <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                  </label>
                )}
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
                        <tr key={emp.id} className="defer-render">
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
              onSaved={() => {
                setActiveTab('directory');
                setSearch('');
                fetchEmployees();
              }}
              onCancel={() => setActiveTab('directory')}
            />
          )}
        </div>
      </div>
    </div>
  );
}