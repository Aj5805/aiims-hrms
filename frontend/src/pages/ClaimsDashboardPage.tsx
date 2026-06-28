import { Link } from 'react-router-dom';
import { PageHeader } from '../components/PageHeader';

export default function ClaimsDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Claims & Advances' }
        ]}
        title="Claims & Advances"
        description="Manage your financial claims, reimbursements, and allowances."
        rightContent={
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl border border-amber-200 text-sm font-semibold">
            0 Pending
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <DashboardCard 
          title="LTC Claim" 
          desc="Leave Travel Concession advance and final claim submissions." 
          icon="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          to="/claims/ltc" 
        />
        <DashboardCard 
          title="Children Education" 
          desc="CEA claims for school fees and hostel subsidies." 
          icon="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
          to="/claims/cea" 
        />
        <DashboardCard 
          title="EHS Reimbursement" 
          desc="Employee Health Scheme medical reimbursement claims." 
          icon="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          to="/claims/ehs" 
        />
        <DashboardCard 
          title="TA / DA" 
          desc="Travelling Allowance and Daily Allowance claims." 
          icon="M13 10V3L4 14h7v7l9-11h-7z"
          to="/claims/ta" 
        />
        <DashboardCard 
          title="Telephone & Briefcase" 
          desc="Reimbursements for contingent expenses." 
          icon="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          to="/claims/telephone" 
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
