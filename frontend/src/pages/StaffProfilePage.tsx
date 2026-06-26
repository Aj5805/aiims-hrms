import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../stores';

type EmployeeDetail = {
  id: string;
  emp_code: string;
  name: string;
  gender: string;
  dob?: string | null;
  doj?: string | null;
  email?: string | null;
  is_active: boolean;
  category_name: string;
  department_name: string;
  designation_name: string;
};

export default function StaffProfilePage() {
  const user = useAuthStore((s) => s.user);
  const employeeId = user?.employee_id;
  const [emp, setEmp] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    api.get(`/employees/${employeeId}`)
      .then((res) => setEmp(res.data))
      .catch(() => setEmp(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <div className="p-12 text-center text-slate-500">Loading e-Service Book...</div>;
  if (!emp) return <div className="p-12 text-center text-red-500">Profile not found.</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">My e-Service Book</h1>
          <p className="text-sm text-slate-500">Official Profile & Service Records (Part I & II)</p>
        </div>
        <div className="h-16 w-16 bg-blue-100 text-blue-700 flex items-center justify-center rounded-full text-2xl font-bold border-2 border-white shadow-sm ring-1 ring-slate-200">
          {emp.name.charAt(0)}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Professional Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Service Details</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Employee Code</div>
                <div className="text-sm font-medium text-slate-900">{emp.emp_code}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Designation</div>
                <div className="text-sm font-medium text-slate-900">{emp.designation_name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Department</div>
                <div className="text-sm font-medium text-slate-900">{emp.department_name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Scheme / Category</div>
                <div className="text-sm font-medium text-slate-900">{emp.category_name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Date of Joining</div>
                <div className="text-sm font-medium text-slate-900">{emp.doj ? new Date(emp.doj).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Status</div>
                <div className="text-sm font-medium text-emerald-600">{emp.is_active ? 'Active in Service' : 'Inactive'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Personal Details */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-shadow">
          <h2 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Personal Bio-Data</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <div className="text-xs font-semibold text-slate-400 uppercase">Full Name</div>
                <div className="text-sm font-medium text-slate-900">{emp.name}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Date of Birth</div>
                <div className="text-sm font-medium text-slate-900">{emp.dob ? new Date(emp.dob).toLocaleDateString() : '—'}</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-400 uppercase">Gender</div>
                <div className="text-sm font-medium text-slate-900">{emp.gender}</div>
              </div>
              <div className="col-span-2">
                <div className="text-xs font-semibold text-slate-400 uppercase">Official Email</div>
                <div className="text-sm font-medium text-slate-900">{emp.email || '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Family & Dependents Section (For EHS) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Family & Dependents (EHS/LTC)</h2>
          <Link to="/dependents" className="text-sm font-semibold text-blue-600 hover:text-blue-800">+ Add Dependent</Link>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-slate-500 mb-2">No dependents added to your service record yet.</p>
          <p className="text-xs text-slate-400">Dependent records are mandatory for processing EHS health cards and LTC claims.</p>
        </div>
      </div>
    </div>
  );
}
