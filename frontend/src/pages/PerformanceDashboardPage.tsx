import { Link } from 'react-router-dom';

export default function PerformanceDashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Performance & Appraisals</h1>
          <p className="text-sm text-slate-500">Manage your APAR and mandatory training logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <Link to={to} className="flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all p-4">
      <div className="shrink-0 h-10 w-10 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center group-hover:bg-purple-100 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-purple-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
