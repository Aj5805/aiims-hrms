/**
 * StaffProfilePage — Personal profile view for any logged-in user.
 *
 * Shows:
 *  • Identity hero card (name, emp code, dept, designation, role badge)
 *  • Leave balance pills (all leave types at a glance)
 *  • Recent leave applications table
 *  • Quick actions: Apply Leave, View Full Account
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

/* ─── Types ─────────────────────────────────────────────────────────────── */

type EmployeeDetail = {
  id: string;
  emp_code: string;
  name: string;
  gender: string;
  dob?: string | null;
  doj?: string | null;
  email?: string | null;
  has_institutional_email?: boolean;
  is_active: boolean;
  category_code: string;
  category_name: string;
  department_code: string;
  department_name: string;
  designation_name: string;
};

type BalanceRow = {
  leave_type_code: string;
  leave_type_name?: string;
  leave_year: number;
  opening_balance: number;
  credited: number;
  availed: number;
  closing_balance: number;
};

type LeaveApp = {
  id: string;
  app_number: string;
  leave_type_code?: string;
  from_date?: string;
  to_date?: string;
  applied_days?: number;
  status: string;
  submitted_at?: string;
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function fmt(d?: string | null) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return d;
  }
}

function num(v: number | string | null | undefined) {
  return Number(v ?? 0);
}

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED:    'bg-blue-100 text-blue-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  APPROVED:     'bg-emerald-100 text-emerald-700',
  REJECTED:     'bg-red-100 text-red-700',
  WITHDRAWN:    'bg-gray-100 text-gray-500',
  RECALLED:     'bg-purple-100 text-purple-700',
};

const ROLE_COLOR: Record<string, string> = {
  STAFF:                'bg-blue-600',
  HOD:                  'bg-violet-600',
  NODAL_OFFICER:        'bg-teal-600',
  ESTABLISHMENT_OFFICER:'bg-orange-600',
  REGISTRAR:            'bg-rose-600',
  DEAN_ACADEMIC:        'bg-indigo-600',
  DIRECTOR:             'bg-slate-700',
  ADMIN:                'bg-gray-900',
};

/* ─── Sub-components ─────────────────────────────────────────────────────── */


function BalancePill({ row }: { row: BalanceRow }) {
  const avail = num(row.closing_balance);
  const total = num(row.opening_balance) + num(row.credited);
  const pct   = total > 0 ? Math.min(100, (avail / total) * 100) : 0;
  const color  = avail <= 3 ? '#ef4444' : avail <= 7 ? '#f59e0b' : '#10b981';

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {row.leave_type_code}
          </div>
          {row.leave_type_name && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[110px]">{row.leave_type_name}</div>
          )}
        </div>
        <span
          className="text-lg font-bold"
          style={{ color }}
        >
          {avail.toFixed(1)}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>Availed {num(row.availed).toFixed(1)}</span>
        <span>of {total.toFixed(1)}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLE[status] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */

export default function LeaveDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const employeeId = user?.employee_id;

  const [emp, setEmp]         = useState<EmployeeDetail | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [apps, setApps]       = useState<LeaveApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [activeTab, setActiveTab] = useState<'balances' | 'history'>('balances');

  useEffect(() => {
    if (!employeeId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      api.get(`/employees/${employeeId}`),
      api.get(`/leave-balances/${employeeId}`),
      api.get(`/leave-applications`, { params: { employee_id: employeeId, limit: 10 } }).catch(() => ({ data: [] })),
    ])
      .then(([empRes, balRes, appsRes]) => {
        setEmp(empRes.data);
        // balance endpoint returns list of balances
        const raw: BalanceRow[] = Array.isArray(balRes.data) ? balRes.data : (balRes.data?.balances ?? []);
        // keep only latest year per leave type
        const latestMap = new Map<string, BalanceRow>();
        raw.forEach((b) => {
          const existing = latestMap.get(b.leave_type_code);
          if (!existing || b.leave_year > existing.leave_year) latestMap.set(b.leave_type_code, b);
        });
        setBalances(Array.from(latestMap.values()));
        setApps(Array.isArray(appsRes.data) ? appsRes.data : (appsRes.data?.items ?? []));
      })
      .catch(() => setError('Failed to load profile data.'))
      .finally(() => setLoading(false));
  }, [employeeId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-800">
        <p className="text-lg font-semibold">No employee profile linked</p>
        <p className="text-sm mt-1">This account ({user?.role}) is not associated with an employee record.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-red-700">
        {error}
      </div>
    );
  }

  if (!emp) return null;

  const roleColor = ROLE_COLOR[user?.role ?? ''] ?? 'bg-slate-600';
  const totalAvailed = balances.reduce((s, b) => s + num(b.availed), 0);
  const totalAvailable = balances.reduce((s, b) => s + num(b.closing_balance), 0);

  return (
    <div className="space-y-6">

      {/* ── Hero Card ─────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Leave & Attendance' }
        ]}
        icon={emp.name.charAt(0).toUpperCase()}
        title={
          <div className="flex items-center gap-2">
            {emp.name}
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${roleColor}`}>
              {(user?.role ?? '').replace('_', ' ')}
            </span>
            {!emp.is_active && (
              <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-semibold">Inactive</span>
            )}
          </div>
        }
        description={
          <>
            <div className="text-slate-600 mb-0.5">{emp.designation_name}</div>
            <div className="text-slate-400">{emp.department_name} · {emp.category_name}</div>
          </>
        }
        rightContent={
          <div className="flex gap-6 text-center sm:text-right">
            <div>
              <div className="text-2xl font-bold text-emerald-600">{totalAvailable.toFixed(0)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-500">{totalAvailed.toFixed(0)}</div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Availed</div>
            </div>
          </div>
        }
      />

      {/* ── Quick Actions ──────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          to="/apply"
          id="profile-apply-leave-btn"
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Apply for Leave
        </Link>
        <Link
          to="/my-apps"
          id="profile-my-apps-btn"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          My Applications
        </Link>
        <Link
          to="/leave-account"
          id="profile-account-btn"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
          </svg>
          Full Leave Account
        </Link>
      </div>

      {/* ── Tabbed Section ────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Tab headers */}
        <div className="flex border-b border-slate-200">
          {(['balances', 'history'] as const).map((tab) => (
            <button
              key={tab}
              id={`profile-tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3.5 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/60'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab === 'balances' ? `Leave Balances (${balances.length})` : `Recent Applications (${apps.length})`}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">
          {activeTab === 'balances' && (
            balances.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No leave balances found.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {balances.map((b) => (
                  <BalancePill key={b.leave_type_code} row={b} />
                ))}
              </div>
            )
          )}

          {activeTab === 'history' && (
            apps.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-8">No applications yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      {['App No.', 'Leave Type', 'From', 'To', 'Days', 'Status', 'Applied On'].map((h) => (
                        <th key={h} className="pb-3 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {apps.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors defer-render">
                        <td className="py-3 pr-4 font-mono text-xs text-slate-600">{a.app_number}</td>
                        <td className="py-3 pr-4 font-medium text-slate-800">{a.leave_type_code ?? '—'}</td>
                        <td className="py-3 pr-4 text-slate-600">{fmt(a.from_date)}</td>
                        <td className="py-3 pr-4 text-slate-600">{fmt(a.to_date)}</td>
                        <td className="py-3 pr-4 text-center font-semibold text-slate-700">{a.applied_days ?? '—'}</td>
                        <td className="py-3 pr-4"><StatusBadge status={a.status} /></td>
                        <td className="py-3 text-slate-500 whitespace-nowrap">{fmt(a.submitted_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
