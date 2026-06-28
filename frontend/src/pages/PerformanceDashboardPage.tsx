import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export default function PerformanceDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Performance & Appraisals' }
        ]}
        title="Performance & Appraisals"
        description="Manage your APAR and mandatory training logs."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard 
          title="My APAR" 
          desc="Annual Performance Assessment Report submissions and history." 
          icon="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          to="/performance/apar" 
        />
        <DashboardCard 
          title="Training Logs" 
          desc="Certifications, workshops, and mandatory training hours." 
          icon="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          to="/performance/training" 
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to }: { title: string, desc: string, icon: string, to: string }) {
  return (
    <Link to={to} className="flex items-start gap-3 group rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 p-3">
      <div className="shrink-0 h-8 w-8 bg-slate-50 text-slate-500 rounded flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-indigo-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
