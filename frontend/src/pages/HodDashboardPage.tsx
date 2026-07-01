import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

export default function HodDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [inboxCount, setInboxCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<any[]>([]);
  const [leavesToday, setLeavesToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [inboxRes, teamRes] = await Promise.all([
          approvalsApi.inbox(),
          approvalsApi.teamAvailability()
        ]);
        
        const inboxData = inboxRes.data || [];
        setInboxCount(inboxData.length);
        setPendingApprovals(inboxData.slice(0, 3)); 

        const teamData = teamRes.data || [];
        setUpcomingLeaves(teamData.slice(0, 5)); // Show up to 5 upcoming
        
        // Calculate leaves today
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        for (const l of teamData) {
          if (l.from_date <= todayStr && l.to_date >= todayStr) {
            todayCount++;
          }
        }
        setLeavesToday(todayCount);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    void fetchDashboardData();
  }, []);

  return (
    <div className="page">
      <PageHeader
        title={user?.role === 'HOD' ? 'HOD Dashboard' : user?.role === 'NODAL_OFFICER' ? 'Nodal Officer Dashboard' : 'Approver Dashboard'}
        description="Command center for department availability and pending approval tasks."
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Nodal Desk' }
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

      {/* Quick Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard 
          label="Pending Approvals" 
          value={loading ? '-' : String(inboxCount)} 
        />
        <MetricCard 
          label="Staff On Leave Today" 
          value={loading ? '-' : String(leavesToday)} 
        />
        <MetricCard 
          label="Upcoming Leaves" 
          value={loading ? '-' : String(upcomingLeaves.length)} 
          helper="Next 5 approved leaves"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Pending Approvals Preview */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Action Required</h2>
              <p className="text-xs text-slate-500 mt-0.5">Oldest pending applications</p>
            </div>
            <Link to="/approvals" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              View All &rarr;
            </Link>
            <Link to="/team-leave" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors ml-3">
              Team balances &rarr;
            </Link>
          </div>
          
          <div className="p-0 flex-1 flex flex-col">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading inbox...</div>
            ) : pendingApprovals.length === 0 ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">No pending applications to review.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 flex-1">
                {pendingApprovals.map((app) => (
                  <div key={app.id} className="p-3 hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{app.employee_name}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">{app.emp_code}</div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded">
                        {app.leave_type_code}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-600">
                      <div>
                        <span className="font-medium">Dates:</span> {app.from_date} to {app.to_date}
                      </div>
                      <div>
                        <span className="font-medium">Days:</span> {app.applied_days}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {pendingApprovals.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center rounded-b-xl">
              <Link to="/approvals" className="text-xs font-semibold text-indigo-700 hover:text-indigo-800">
                Process {inboxCount} pending requests in Inbox
              </Link>
            </div>
          )}
        </div>

        {/* Team Availability Snapshot */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full transition-all duration-300 hover:shadow-md">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Team Availability</h2>
              <p className="text-xs text-slate-500 mt-0.5">Upcoming approved leaves</p>
            </div>
            <Link to="/forecast" className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
              Full forecast &rarr;
            </Link>
          </div>
          
          <div className="p-0 flex-1 flex flex-col">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading availability...</div>
            ) : upcomingLeaves.length === 0 ? (
              <div className="p-8 text-center flex-1 flex flex-col items-center justify-center">
                <div className="h-12 w-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-600">No upcoming leaves</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Everyone is present and accounted for.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 flex-1">
                {upcomingLeaves.map((app) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isToday = app.from_date <= todayStr && app.to_date >= todayStr;
                  return (
                    <div key={app.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{app.employee_name}</div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">{app.emp_code}</div>
                        </div>
                        {isToday ? (
                          <span className="text-xs font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 rounded">
                            AWAY TODAY
                          </span>
                        ) : (
                          <span className="text-xs font-semibold px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded">
                            UPCOMING
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <div>
                          <span className="font-medium">Dates:</span> {app.from_date} to {app.to_date}
                        </div>
                        <div>
                          <span className="font-medium">Type:</span> {app.leave_type_code}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="card p-4 hover:shadow hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 group">
      <div className="text-2xl font-black tracking-tight text-slate-900 group-hover:text-indigo-700 transition-colors leading-none">{value}</div>
      <div className="mt-1 text-sm font-semibold text-slate-700">{label}</div>
      {helper && <div className="mt-1 text-xs text-slate-400 uppercase tracking-wide font-medium">{helper}</div>}
    </div>
  );
}
