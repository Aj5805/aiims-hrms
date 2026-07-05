import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { employeesApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import EmployeeProfileContent, { type EmployeeRecord } from '../components/EmployeeProfileContent';

import { hasSystemRole, HR_EDITOR_ROLES } from '../constants/roles';

const FULL_EDITOR_ROLES = HR_EDITOR_ROLES;

export default function EmployeeProfilePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = hasSystemRole(user?.role, FULL_EDITOR_ROLES);
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    employeesApi.get(employeeId)
      .then((res) => setEmp(res.data))
      .catch(() => setEmp(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const handleExport = () => {
    if (!emp) return;
    const blob = new Blob([JSON.stringify(emp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.emp_code}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page py-12 text-center text-slate-500">Loading profile…</div>;
  if (!emp) return <div className="page py-12 text-center text-red-600">Employee not found.</div>;

  return (
    <div className="page">
      <EmployeeProfileContent
        emp={emp}
        editMode={canEdit ? 'full' : 'none'}
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'HR Operations' },
          { label: 'Employee Directory', to: '/employees?tab=directory' },
          { label: emp.emp_code },
        ]}
        onUpdated={setEmp}
        hrToolbar={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => navigate('/employees?tab=directory')} className="btn-secondary btn-sm">
              Back
            </button>
            <button type="button" onClick={handleExport} className="btn-secondary btn-sm">Export</button>
            <button type="button" onClick={() => window.print()} className="btn-secondary btn-sm">Print</button>
          </div>
        }
      />
    </div>
  );
}
