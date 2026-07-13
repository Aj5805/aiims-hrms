import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { approvalsApi, leaveAppApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { canToggleWorkMode, effectiveWorkMode } from '../utils/workMode';
import { balanceLink, dedupeLatestPerLeaveType } from '../utils/leaveBalances';

import { APPROVER_ROLES, EMPLOYEE_MASTER_ROLES as HR_ROLES } from '../constants/roles';

type BalanceRow = {
  leave_type_code: string;
  leave_type_name?: string;
  leave_year: number;
  closing_balance: number | string;
};

type LeaveApp = {
  id: string;
  app_number?: string;
  leave_type_code?: string;
  from_date?: string;
  to_date?: string;
  applied_days?: number;
  status: string;
  submitted_at?: string;
};

type InboxItem = {
  id: string;
  emp_name?: string;
  employee_name?: string;
  emp_code?: string;
  leave_type_code?: string;
  from_date?: string;
  to_date?: string;
  applied_days?: number;
};

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-red-100 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

function fmtDate(d?: string) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return d;
  }
}

function num(v: number | string | null | undefined) {
  return Number(v ?? 0);
}

export default function HomeDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const workMode = useAuthStore((s) => s.workMode);
  const role = user?.role ?? '';
  const employeeId = user?.employee_id;
  const inDeskMode = effectiveWorkMode(role, employeeId, workMode) === 'desk';
  const toggleEligible = canToggleWorkMode(role, employeeId);

  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [apps, setApps] = useState<LeaveApp[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  const isApprover = inDeskMode && !toggleEligible && APPROVER_ROLES.includes(role as (typeof APPROVER_ROLES)[number]);
  const isHr = inDeskMode && !toggleEligible && HR_ROLES.includes(role as (typeof HR_ROLES)[number]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tasks: Promise<void>[] = [];

        if (employeeId) {
          tasks.push(
            api.get(`/leave-balances/${employeeId}`).then((res) => {
              const raw: BalanceRow[] = Array.isArray(res.data) ? res.data : (res.data?.balances ?? []);
              setBalances(dedupeLatestPerLeaveType(raw));
            }),
            leaveAppApi.list({ limit: '8' }).then((res) => {
              setApps(res.data ?? []);
            }),
          );
        }

        if (isApprover) {
          tasks.push(
            approvalsApi.inbox().then((res) => setInbox(res.data ?? [])),
          );
        }

        await Promise.all(tasks);
      } catch {
        // partial data is fine on dashboard
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [employeeId, isApprover]);

  const stats = useMemo(() => {
    const pending = apps.filter((a) => ['SUBMITTED', 'UNDER_REVIEW'].includes(a.status)).length;
    const el = balances.find((b) => b.leave_type_code === 'EL');
    const cl = balances.find((b) => b.leave_type_code === 'CL');
    return { pending, el: num(el?.closing_balance), cl: num(cl?.closing_balance) };
  }, [apps, balances]);

  const displayName = user?.name || user?.username || 'there';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="page space-y-4">
      <PageHeader
        breadcrumbs={[{ label: 'Home' }]}
        title={`${greeting}, ${displayName}`}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {employeeId && (
          <>
            <StatTile label="EL balance" value={loading ? '…' : String(stats.el)} to={balanceLink('EL')} />
            <StatTile label="CL balance" value={loading ? '…' : String(stats.cl)} to={balanceLink('CL')} />
            <StatTile
              label="My pending apps"
              value={loading ? '…' : String(stats.pending)}
              tone={stats.pending > 0 ? 'amber' : 'default'}
              to="/my-apps"
            />
            <StatTile label="Leave hub" value="→" to="/leave-dashboard" />
          </>
        )}
        {isApprover && (
          <StatTile
            label="Approvals waiting"
            value={loading ? '…' : String(inbox.length)}
            tone={inbox.length > 0 ? 'amber' : 'green'}
            to="/approvals"
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="card p-4 lg:col-span-1">
          <h2 className="text-sm font-bold text-slate-800 mb-3">Quick actions</h2>
          <div className="space-y-2">
            {employeeId && (
              <>
                <ActionLink to="/apply" primary>Apply for leave</ActionLink>
                <ActionLink to="/my-apps">My applications</ActionLink>
                <ActionLink to="/leave-account">Leave ledger</ActionLink>
              </>
            )}
            <ActionLink to="/profile-dashboard">View profile</ActionLink>
            {isApprover && <ActionLink to="/approvals" primary>Open approval inbox</ActionLink>}
            {isApprover && <ActionLink to="/hod">Nodal desk</ActionLink>}
            {isHr && <ActionLink to="/employees?tab=onboard">Onboard employee</ActionLink>}
            {isHr && <ActionLink to="/employees?tab=directory">Employee directory</ActionLink>}
            {role === 'ADMIN' && (
              <ActionLink to="/masters">Masters</ActionLink>
            )}
          </div>
        </section>

        {employeeId && (
          <section className="card p-0 lg:col-span-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">My leave activity</h2>
              <Link to="/my-apps" className="text-xs font-bold text-indigo-600 hover:underline">View all</Link>
            </div>
            <div className="flex-1 divide-y divide-slate-50">
              {loading ? (
                <p className="p-4 text-sm text-slate-400">Loading…</p>
              ) : apps.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-slate-500">No leave applications yet.</p>
                  <Link to="/apply" className="inline-block mt-2 text-xs font-bold text-indigo-600 hover:underline">Apply now →</Link>
                </div>
              ) : (
                apps.slice(0, 5).map((app) => (
                  <Link key={app.id} to={`/my-apps?app=${app.id}`} className="block px-4 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-semibold text-slate-700">{app.leave_type_code}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${STATUS_STYLE[app.status] ?? 'bg-slate-100 text-slate-600'}`}>
                        {app.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fmtDate(app.from_date)} – {fmtDate(app.to_date)} · {app.applied_days ?? '—'} day(s)
                    </p>
                  </Link>
                ))
              )}
            </div>
          </section>
        )}

        {isApprover && (
          <section className="card p-0 lg:col-span-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Needs your approval</h2>
              <Link to="/approvals" className="text-xs font-bold text-indigo-600 hover:underline">Inbox</Link>
            </div>
            <div className="flex-1 divide-y divide-slate-50">
              {loading ? (
                <p className="p-4 text-sm text-slate-400">Loading…</p>
              ) : inbox.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm font-medium text-slate-600">All caught up</p>
                  <p className="text-xs text-slate-400 mt-1">No pending approvals.</p>
                </div>
              ) : (
                inbox.slice(0, 5).map((item) => (
                  <Link key={item.id} to={`/approvals?app=${item.id}`} className="block px-4 py-2.5 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {item.emp_name || item.employee_name}
                      </span>
                      <span className="text-xs font-mono text-slate-500 shrink-0">{item.leave_type_code}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.emp_code} · {fmtDate(item.from_date)} – {fmtDate(item.to_date)}
                    </p>
                  </Link>
                ))
              )}
            </div>
            {inbox.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/80 text-center">
                <Link to="/approvals" className="text-xs font-bold text-indigo-700 hover:underline">
                  Review {inbox.length} pending →
                </Link>
              </div>
            )}
          </section>
        )}
      </div>

      <section>
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-400 mb-2">More modules</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          <ModuleChip title="Profile" to="/profile-dashboard" />
          <ModuleChip title="Leave" to="/leave-dashboard" />
          <ModuleChip title="Claims" to="/claims" />
          <ModuleChip title="Payroll" to="/payroll" />
          <ModuleChip title="Performance" to="/performance" />
        </div>
      </section>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone = 'default',
  to,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'amber' | 'green';
  to?: string;
}) {
  const tones = {
    default: 'border-slate-200 bg-white',
    amber: 'border-amber-200 bg-amber-50',
    green: 'border-emerald-200 bg-emerald-50',
  };
  const inner = (
    <div className={`rounded-xl border p-3 ${tones[tone]} ${to ? 'hover:border-indigo-200 hover:shadow-sm transition-all' : ''}`}>
      <div className="text-2xl font-black text-slate-900 leading-none">{value}</div>
      <div className="text-xs font-semibold text-slate-500 mt-1">{label}</div>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function ActionLink({ to, children, primary }: { to: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      to={to}
      className={`block w-full text-center rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
        primary
          ? 'bg-indigo-600 text-white hover:bg-indigo-700'
          : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-indigo-200 hover:text-indigo-700'
      }`}
    >
      {children}
    </Link>
  );
}

function ModuleChip({ title, to }: { title: string; to: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:border-indigo-200 hover:text-indigo-700 text-center transition-colors"
    >
      {title}
    </Link>
  );
}
