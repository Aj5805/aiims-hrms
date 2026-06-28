import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  const [activeTab, setActiveTab] = useState<'directory' | 'onboard'>('directory');
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
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin/Estab', to: '/admin' }, { label: 'Employees Directory' }]}
        title="Staff Management Console"
        description="Manage personnel, onboarding, and directory."
        rightContent={
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setActiveTab('directory')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${activeTab === 'directory' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Staff Directory
            </button>
            <button
              onClick={() => setActiveTab('onboard')}
              className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${activeTab === 'onboard' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Onboard Staff
            </button>
          </div>
        }
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">

        <div className="p-6">
          {activeTab === 'directory' && (
            <div>
              <div className="flex flex-wrap gap-4 items-center justify-between mb-4">
                <input
                  type="text"
                  placeholder="Search by name or employee code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="form-input w-full md:w-80"
                />
                
                {user?.role !== 'NODAL_OFFICER' && (
                  <label className="px-4 py-2 bg-green-600 text-white rounded-lg cursor-pointer hover:bg-green-700 text-sm font-medium transition shadow-sm">
                    Bulk Import (CSV)
                    <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
                  </label>
                )}
              </div>

              {loading ? (
                <div className="py-12 text-center text-gray-500">Loading directory...</div>
              ) : (
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Designation & Category</th>
                        <th className="text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                       {employees.map((emp) => (
                        <tr key={emp.id} className="cursor-pointer defer-render">
                          <td>
                            <div className="font-medium text-slate-900">{emp.name}</div>
                            <div className="font-mono text-xs text-slate-500 mt-0.5">{emp.emp_code}</div>
                          </td>
                          <td className="text-slate-700">{emp.department_name}</td>
                          <td>
                            <div className="text-slate-900">{emp.designation_name}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{emp.category_name}</div>
                          </td>
                          <td className="text-center">
                            <span className={`badge ${emp.is_active ? 'badge-green' : 'badge-red'}`}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {employees.length === 0 && (
                        <tr><td colSpan={4} className="py-12 text-center text-slate-400">No employees found matching your criteria.</td></tr>
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
                setSearch(''); // clear search to show new employee
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