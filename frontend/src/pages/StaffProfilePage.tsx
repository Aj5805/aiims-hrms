import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import EmployeeProfileContent, { type EmployeeRecord } from '../components/EmployeeProfileContent';

export default function StaffProfilePage() {
  const user = useAuthStore((s) => s.user);
  const employeeId = user?.employee_id;
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    employeesApi.get(employeeId)
      .then((res) => setEmp(res.data))
      .catch(() => setEmp(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) return <div className="page py-12 text-center text-slate-500">Loading profile…</div>;
  if (!emp) {
    return (
      <div className="page py-12 text-center text-red-600">
        Profile not found. No employee record is linked to this login.
      </div>
    );
  }

  return (
    <div className="page space-y-6">
      <EmployeeProfileContent
        emp={emp}
        editMode="self"
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'My Profile', to: '/profile-dashboard' },
          { label: 'View Profile' },
        ]}
        onUpdated={setEmp}
      />

      <div className="card p-6">
        <div className="flex items-center justify-between border-b pb-2 mb-4">
          <h2 className="text-lg font-bold text-slate-800">Family & Dependents (EHS/LTC)</h2>
          <Link to="/dependents" className="text-sm font-semibold text-blue-600 hover:text-blue-800">+ Add Dependent</Link>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-slate-500">No dependents yet.</p>
        </div>
      </div>
    </div>
  );
}
