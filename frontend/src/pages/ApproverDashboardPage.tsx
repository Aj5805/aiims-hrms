import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { useEffect, useState } from 'react';
import { approvalsApi } from '../api/phase4_endpoints';

export default function ApproverDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Quick fetch to get pending count
    approvalsApi.inbox().then((res: any) => setPendingCount(res.data.length)).catch(() => {});
  }, []);

  return (
    <div className="page">
      <PageHeader
        title={`Approver Workspace`}
        description="Manage your department's leave requests and team availability."
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Approvals' }
        ]}
        rightContent={
          <div className="hidden sm:block text-right">
            <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Acting As</div>
            <div className="inline-block bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-sm font-bold border border-indigo-100 whitespace-nowrap">
              {(user?.role ?? '').replace('_', ' ')}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <DashboardCard 
          title="Approval Inbox" 
          desc="Review and action pending leave applications." 
          icon="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          to="/approvals"
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
        <DashboardCard 
          title="Team Calendar" 
          desc="View upcoming leaves across your department." 
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          to="/team-calendar"
        />
        <DashboardCard 
          title="Delegation" 
          desc="Delegate your approval authority while on leave." 
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          to="/delegation"
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to, badge }: { title: string, desc: string, icon: string, to: string, badge?: number }) {
  return (
    <Link to={to} className="relative flex items-start gap-3 group rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 p-3">
      <div className="shrink-0 h-8 w-8 bg-slate-50 text-slate-500 rounded flex items-center justify-center group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-0.5 group-hover:text-indigo-700 transition-colors">{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
      {badge !== undefined && (
        <span className="absolute top-2 right-2 bg-rose-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm">
          {badge}
        </span>
      )}
    </Link>
  );
}
