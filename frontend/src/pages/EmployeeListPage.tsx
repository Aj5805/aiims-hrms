import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';

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
  const [showForm, setShowForm] = useState(false);
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
    fetchEmployees();
  }, [search]);

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800">Employee Master</h2>
        <div className="flex gap-2">
          <label className="px-3 py-2 bg-green-600 text-white rounded cursor-pointer hover:bg-green-700 text-sm">
            Import CSV
            <input id="csv-import" type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button
            id="add-employee-btn"
            onClick={() => setShowForm(true)}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            + Add Employee
          </button>
        </div>
      </div>

      <input
        id="employee-search"
        type="text"
        placeholder="Search by name or emp_code..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-300 rounded-md px-3 py-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left">Code</th>
                <th className="px-4 py-2 text-left">Name</th>
                <th className="px-4 py-2 text-left">Dept</th>
                <th className="px-4 py-2 text-left">Designation</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-center">Active</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((emp) => (
                <tr key={emp.id} className="border-t hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono">{emp.emp_code}</td>
                  <td className="px-4 py-2">{emp.name}</td>
                  <td className="px-4 py-2">{emp.department_name}</td>
                  <td className="px-4 py-2">{emp.designation_name}</td>
                  <td className="px-4 py-2">{emp.category_name}</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`text-xs px-2 py-1 rounded ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No employees found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showForm && <EmployeeFormModal onClose={() => setShowForm(false)} onSaved={fetchEmployees} />}
    </div>
  );
}

function EmployeeFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    emp_code: '', name: '', gender: 'MALE', doj: '',
    category_code: '', department_code: '', designation_name: '', email: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await employeesApi.create(form);
      onSaved();
      onClose();
    } catch {
      alert('Failed to create employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-lg font-bold mb-4">Add Employee</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input placeholder="Emp Code *" value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="w-full border rounded px-3 py-2">
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
          <input type="date" value={form.doj} onChange={(e) => setForm({ ...form, doj: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Category Code *" value={form.category_code} onChange={(e) => setForm({ ...form, category_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Department Code *" value={form.department_code} onChange={(e) => setForm({ ...form, department_code: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input placeholder="Designation *" value={form.designation_name} onChange={(e) => setForm({ ...form, designation_name: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border rounded px-3 py-2" />
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={saving} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button type="button" onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded hover:bg-gray-300">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}