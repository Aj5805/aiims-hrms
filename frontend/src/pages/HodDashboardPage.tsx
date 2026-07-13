import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { approvalsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { TEAM_VIEW_ROLES } from '../constants/roles';

type LeaveRow = {
  id: string;
  employee_name: string;
  emp_code: string;
  leave_type_code: string;
  from_date: string;
  to_date: string;
  applied_days: number;
};

export default function HodDashboardPage() {
  const role = useAuthStore((s) => s.user?.role ?? '');
  const isHod = role === 'HOD';
  const isNodal = role === 'NODAL_OFFICER';
  const showTeamTools = TEAM_VIEW_ROLES.includes(role as (typeof TEAM_VIEW_ROLES)[number]);

  const labels = useMemo(
    () => ({
      scope: isHod ? 'department' : isNodal ? 'nodal scheme' : 'team',
      onLeaveToday: isHod ? 'Dept on leave today' : isNodal ? 'Staff on leave today' : 'On leave today',
      upcoming: isHod ? 'Upcoming dept leave' : isNodal ? 'Upcoming approved leave' : 'Upcoming leave',
      balances: isHod ? 'Team balances' : 'Staff balances',
      forecast: isHod ? 'Team forecast' : 'Scheme forecast',
      availability: isHod ? 'Department availability' : 'Scheme availability',
    }),
    [isHod, isNodal],
  );

  const [inboxCount, setInboxCount] = useState(0);
  const [pendingApprovals, setPendingApprovals] = useState<LeaveRow[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<LeaveRow[]>([]);
  const [leavesToday, setLeavesToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const [inboxRes, teamRes] = await Promise.all([
          approvalsApi.inbox(),
          approvalsApi.teamAvailability(),
        ]);

        const inboxData = (inboxRes.data || []) as LeaveRow[];
        setInboxCount(inboxData.length);
        setPendingApprovals(inboxData.slice(0, 5));

        const teamData = (teamRes.data || []) as LeaveRow[];
        setUpcomingLeaves(teamData.slice(0, 6));

        const todayStr = new Date().toISOString().split('T')[0];
        let todayCount = 0;
        for (const leave of teamData) {
          if (leave.from_date <= todayStr && leave.to_date >= todayStr) {
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
        breadcrumbs={[
          { label: 'Desk', to: '/hod' },
          { label: 'Nodal Desk' },
        ]}
        title={isNodal ? 'Nodal Officer Desk' : isHod ? 'HOD Desk' : 'Approver Desk'}
        rightContent={
          <div className="flex flex-wrap gap-2">
            <Link to="/approvals" className="btn-sm bg-indigo-600 text-white rounded-md px-3 py-1.5 text-xs font-bold">
              Open inbox{inboxCount > 0 ? ` (${inboxCount})` : ''}
            </Link>
            {showTeamTools && (
              <>
                <Link to="/team-leave" className="btn-sm border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300">
                  {labels.balances}
                </Link>
                <Link to="/forecast" className="btn-sm border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300">
                  {labels.forecast}
                </Link>
              </>
            )}
            <Link to="/holidays-calendar" className="btn-sm border border-slate-300 rounded-md px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300">
              Holiday calendar
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <MetricCard label="Pending approvals" value={loading ? '—' : String(inboxCount)} />
        <MetricCard label={labels.onLeaveToday} value={loading ? '—' : String(leavesToday)} />
        <MetricCard label={labels.upcoming} value={loading ? '—' : String(upcomingLeaves.length)} helper={labels.scope} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Action required</h2>
              <p className="text-xs text-slate-500 mt-0.5">Items waiting in your approval inbox</p>
            </div>
            <Link to="/approvals" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
              View all →
            </Link>
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading inbox…</div>
            ) : pendingApprovals.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-600">All caught up</p>
                <p className="text-xs text-slate-400 mt-1">No pending approvals for your {labels.scope}.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {pendingApprovals.map((app) => (
                  <Link
                    key={app.id}
                    to={`/approvals?app=${app.id}`}
                    className="block p-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <div>
                        <div className="font-semibold text-slate-900 text-sm">{app.employee_name}</div>
                        <div className="text-xs font-mono text-slate-500 mt-0.5">{app.emp_code}</div>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded shrink-0">
                        {app.leave_type_code}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                      <span><span className="font-medium">Dates:</span> {app.from_date} to {app.to_date}</span>
                      <span><span className="font-medium">Days:</span> {app.applied_days}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-full">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">{labels.availability}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Approved leave coming up in your scope</p>
            </div>
            {showTeamTools && (
              <Link to="/forecast" className="text-sm font-medium text-indigo-600 hover:text-indigo-800">
                {labels.forecast} →
              </Link>
            )}
          </div>

          <div className="flex-1">
            {loading ? (
              <div className="p-8 text-center text-slate-500 text-sm">Loading availability…</div>
            ) : upcomingLeaves.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm font-medium text-slate-600">No upcoming leave</p>
                <p className="text-xs text-slate-400 mt-1">
                  {isNodal
                    ? 'No approved leave found for staff under your nodal office. Check that your office assignment is saved in Masters → Nodal Offices.'
                    : 'No approved leave scheduled in your scope.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {upcomingLeaves.map((app) => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const isToday = app.from_date <= todayStr && app.to_date >= todayStr;
                  return (
                    <div key={app.id} className="p-3">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 text-sm">{app.employee_name}</div>
                          <div className="text-xs font-mono text-slate-500 mt-0.5">{app.emp_code}</div>
                        </div>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded shrink-0 ${
                            isToday
                              ? 'bg-amber-50 text-amber-700 border border-amber-100'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {isToday ? 'Away today' : 'Upcoming'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span><span className="font-medium">Dates:</span> {app.from_date} to {app.to_date}</span>
                        <span><span className="font-medium">Type:</span> {app.leave_type_code}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
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
