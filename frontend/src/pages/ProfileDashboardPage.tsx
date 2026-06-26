import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';
import api from '../api/client';

export default function ProfileDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [empName, setEmpName] = useState(user?.username || 'Employee');
  const [empDept, setEmpDept] = useState('Loading details...');

  useEffect(() => {
    if (user?.employee_id) {
      api.get(`/employees/${user.employee_id}`).then(res => {
        setEmpName(res.data.name);
        setEmpDept(`${res.data.designation_name} · ${res.data.department_name}`);
      }).catch(() => setEmpDept('Details unavailable'));
    } else {
      setEmpDept('No employee record linked');
    }
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6">
      <div className="rounded-xl bg-white border border-slate-200 shadow-sm p-6 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xl font-bold">
          {empName.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">{empName}</h1>
          <p className="text-sm text-slate-500">{empDept}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <DashboardCard 
          title="e-Service Book" 
          desc="View your official personal and professional details, including joining date, designation, and scheme." 
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          to="/profile" 
        />
        <DashboardCard 
          title="Family & Dependents" 
          desc="Manage your dependents for Employee Health Scheme (EHS) and LTC claims." 
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          to="/dependents" 
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to }: { title: string, desc: string, icon: string, to: string }) {
  return (
    <Link to={to} className="flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all p-4">
      <div className="shrink-0 h-10 w-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:bg-blue-100 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-blue-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
