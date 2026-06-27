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
    <div className="max-w-6xl mx-auto space-y-6 py-6">
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
            <div className="inline-block bg-purple-50 text-purple-700 px-3 py-1 rounded-lg text-sm font-bold border border-purple-100 whitespace-nowrap">
              {(user?.role ?? '').replace('_', ' ')}
            </div>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <DashboardCard 
          title="Approval Inbox" 
          desc="Review and action pending leave applications." 
          icon="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          to="/approvals"
          color="blue"
          badge={pendingCount > 0 ? pendingCount : undefined}
        />
        <DashboardCard 
          title="Team Calendar" 
          desc="View upcoming leaves across your department." 
          icon="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          to="/team-calendar"
          color="teal"
        />
        <DashboardCard 
          title="Delegation" 
          desc="Delegate your approval authority while on leave." 
          icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          to="/delegation"
          color="amber"
        />
      </div>
    </div>
  );
}

function DashboardCard({ title, desc, icon, to, color, badge }: { title: string, desc: string, icon: string, to: string, color: 'blue' | 'teal' | 'amber' | 'emerald' | 'purple', badge?: number }) {
  const colorMap = {
    blue: 'text-blue-600 bg-blue-50 group-hover:bg-blue-100 group-hover:text-blue-700 hover:border-blue-300',
    teal: 'text-teal-600 bg-teal-50 group-hover:bg-teal-100 group-hover:text-teal-700 hover:border-teal-300',
    amber: 'text-amber-600 bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-700 hover:border-amber-300',
    emerald: 'text-emerald-600 bg-emerald-50 group-hover:bg-emerald-100 group-hover:text-emerald-700 hover:border-emerald-300',
    purple: 'text-purple-600 bg-purple-50 group-hover:bg-purple-100 group-hover:text-purple-700 hover:border-purple-300',
  };

  const c = colorMap[color];

  return (
    <Link to={to} className={`relative flex items-start gap-4 group rounded-xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all p-4 ${c.split(' ').slice(-1)[0]}`}>
      <div className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${c.split(' ').slice(0, 3).join(' ')}`}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={icon} />
        </svg>
      </div>
      <div>
        <h3 className={`text-sm font-bold text-slate-800 mb-0.5 transition-colors ${c.split(' ')[3]}`}>{title}</h3>
        <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
      </div>
      {badge !== undefined && (
        <span className="absolute top-4 right-4 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
          {badge}
        </span>
      )}
    </Link>
  );
}
