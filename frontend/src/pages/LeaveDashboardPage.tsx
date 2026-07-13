/**
 * Leave hub — per-type balances and recent applications.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { balanceLink, dedupeLatestPerLeaveType } from '../utils/leaveBalances';

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

function BalancePill({ row }: { row: BalanceRow }) {
  const avail = num(row.closing_balance);
  const total = num(row.opening_balance) + num(row.credited);
  const pct   = total > 0 ? Math.min(100, (avail / total) * 100) : 0;
  const color  = avail <= 3 ? '#ef4444' : avail <= 7 ? '#f59e0b' : '#10b981';

  return (
    <Link
      to={balanceLink(row.leave_type_code)}
      className="block rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {row.leave_type_code}
          </div>
          {row.leave_type_name && (
            <div className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[110px]">{row.leave_type_name}</div>
          )}
        </div>
        <span className="text-lg font-bold" style={{ color }}>
          {avail.toFixed(1)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400">
        <span>Availed {num(row.availed).toFixed(1)}</span>
        <span>View ledger →</span>
      </div>
    </Link>
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

export default function LeaveDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const employeeId = user?.employee_id;

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
      api.get(`/leave-balances/${employeeId}`),
      api.get(`/leave-applications`, { params: { employee_id: employeeId, limit: 10 } }).catch(() => ({ data: [] })),
    ])
      .then(([balRes, appsRes]) => {
        const raw: BalanceRow[] = Array.isArray(balRes.data) ? balRes.data : (balRes.data?.balances ?? []);
        setBalances(dedupeLatestPerLeaveType(raw));
        setApps(Array.isArray(appsRes.data) ? appsRes.data : (appsRes.data?.items ?? []));
      })
      .catch(() => setError('Failed to load leave data.'))
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

  return (
    <div className="space-y-3">
      <PageHeader
        breadcrumbs={[
          { label: 'Home', to: '/' },
          { label: 'Leave & Attendance', to: '/leave-dashboard' },
        ]}
        hideTitle
      />

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200">
          {(['balances', 'history'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'border-b-2 border-blue-600 text-blue-700 bg-blue-50/60'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab === 'balances' ? `Balances (${balances.length})` : `Applications (${apps.length})`}
            </button>
          ))}
        </div>

        <div className="p-4">
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
                      <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 pr-4">
                          <Link to={`/my-apps?app=${a.id}`} className="font-mono text-xs text-indigo-700 hover:underline">
                            {a.app_number}
                          </Link>
                        </td>
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
