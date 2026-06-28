import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export default function PayrollDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Payroll & Finance' }
        ]}
        title="Payroll & Finance"
        description="Access your salary slips, annual summaries, and tax documents."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard 
          title="Salary Slips" 
          desc="Download monthly payslips and earning statements." 
          icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          to="/payroll/slips" 
        />
        <DashboardCard 
          title="Annual Summary" 
          desc="Financial year overview of all earnings and deductions." 
          icon="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          to="/payroll/summary" 
        />
        <DashboardCard 
          title="Form 16 & Tax" 
          desc="IT declarations, Section 80C, and Form 16 downloads." 
          icon="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
          to="/payroll/form16" 
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to }: { title: string, desc: string, icon: string, to: string }) {
  return (
    <Link to={to} className="flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all p-4">
      <div className="shrink-0 h-10 w-10 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-0.5 group-hover:text-emerald-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
    </Link>
  );
}
