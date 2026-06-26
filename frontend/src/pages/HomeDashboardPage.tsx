import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

export default function HomeDashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-6xl mx-auto space-y-6 py-6">
      <PageHeader
        title={`Welcome, ${user?.username}`}
        description="Centralized Human Resources Management System"
        rightContent={
          <div className="hidden sm:block text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Current Role</div>
            <div className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-sm font-bold border border-blue-100">
              {(user?.role ?? '').replace('_', ' ')}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard 
          title="My Profile" 
          desc="Service book and dependent details." 
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          to="/profile-dashboard"
          color="blue"
        />
        <DashboardCard 
          title="Leave & Attendance" 
          desc="Apply for leave, view balances, and track attendance." 
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          to="/leave-dashboard"
          color="teal"
        />
        <DashboardCard 
          title="Claims & Advances" 
          desc="LTC, CEA, EHS, TA, and Telephone claims." 
          icon="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          to="/claims"
          color="amber"
        />
        <DashboardCard 
          title="Payroll & Finance" 
          desc="Salary slips, Form 16, and annual summary." 
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          to="/payroll"
          color="emerald"
        />
        <DashboardCard 
          title="Performance" 
          desc="APAR submission and mandatory training logs." 
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          to="/performance"
          color="purple"
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to, color }: { title: string, desc: string, icon: string, to: string, color: 'blue' | 'teal' | 'amber' | 'emerald' | 'purple' }) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100 group-hover:text-blue-700 hover:border-blue-300',
    teal: 'text-teal-600 bg-teal-50 group-hover:bg-teal-100 group-hover:text-teal-700 hover:border-teal-300',
    amber: 'text-amber-600 bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-700 hover:border-amber-300',
    emerald: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100 group-hover:text-emerald-700 hover:border-emerald-300',
    purple: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100 group-hover:text-purple-700 hover:border-purple-300',
  };

  const c = colorMap[color];

  return (
    <Link to={to} className={`flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 ${c.split(' ').slice(-1)[0]}`}>
      <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${c.split(' ').slice(0, 3).join(' ')}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className={`text-sm font-bold text-slate-800 mb-0.5 transition-colors ${c.split(' ')[3]}`}>{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
