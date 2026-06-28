import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

export default function HomeDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="page">
      <PageHeader
        title={`Welcome back, ${user?.username}`}
        description="AIIMS Bibinagar — Human Resources Management System"
        rightContent={
          <div className="hidden sm:block text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-medium mb-1">Current Role</div>
            <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-semibold border border-indigo-100">
              {(user?.role ?? '').replace(/_/g, ' ')}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard
          title="My Profile"
          desc="Service book, personal details and dependent records."
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          to="/profile-dashboard"
        />
        <DashboardCard
          title="Leave & Attendance"
          desc="Apply for leave, view balances, and track attendance."
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          to="/leave-dashboard"
        />
        <DashboardCard
          title="Claims & Advances"
          desc="LTC, CEA, EHS, TA and Telephone claims."
          icon="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          to="/claims"
        />
        <DashboardCard
          title="Payroll & Finance"
          desc="Salary slips, Form 16, and annual summary."
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          to="/payroll"
        />
        <DashboardCard
          title="Performance"
          desc="APAR submission and mandatory training logs."
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          to="/performance"
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to }: { title: string; desc: string; icon: string; to: string }) {
  return (
    <Link
      to={to}
      className="group flex items-start gap-4 card p-4 hover:border-indigo-200 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="shrink-0 h-10 w-10 bg-slate-50 text-slate-500 rounded-lg flex items-center justify-center border border-slate-200 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-slate-800 mb-1 group-hover:text-indigo-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
