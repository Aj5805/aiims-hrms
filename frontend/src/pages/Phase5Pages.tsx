import { useMemo, useState } from 'react';
import api from '../api/client';
import { useAuthStore } from '../stores';

type EmployeeOption = {
  id: string;
  emp_code: string;
  name: string;
  department_name?: string;
};

type BalanceRow = {
  id: string;
  leave_type_id: string;
  leave_type_code: string;
  leave_type_name: string;
  leave_year: number;
  opening_balance: number | string;
  credited: number | string;
  availed: number | string;
  closing_balance: number | string;
  max_accumulation?: number | string | null;
};

type LedgerEntry = {
  entry_type: string;
  event_date?: string | null;
  leave_year?: number;
  days?: number;
  delta?: number;
  reason?: string;
  field?: string;
  app_number?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
};

type LedgerResponse = {
  employee_id: string;
  leave_type_id: string;
  balances: BalanceRow[];
  transactions: LedgerEntry[];
};

const balApi = {
  get: (eid: string) => api.get(`/leave-balances/${eid}`),
  ledger: (eid: string, lid: string) => api.get(`/leave-balances/${eid}/ledger/${lid}`),
  project: (eid: string, p: Record<string, string>) => api.get(`/leave-balances/${eid}/project`, { params: p }),
  annualCredit: (data: Record<string, unknown>) => api.post('/leave-balances/credit/annual', data),
  carryForward: (data: Record<string, unknown>) => api.post('/leave-balances/carryforward', data),
  manualAdjust: (bid: string, data: Record<string, unknown>) => api.put(`/leave-balances/${bid}/manual-adjust`, data),
};

const employeeApi = {
  search: (query: string) => api.get('/employees', { params: { search: query, limit: 10 } }),
};

function asNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return value.slice(0, 10);
}

function entryLabel(entry: LedgerEntry): string {
  if (entry.entry_type === 'application') {
    return `${entry.status === 'RECALLED' ? 'Recall' : 'Leave'} ${entry.app_number ?? ''}`.trim();
  }
  if (entry.entry_type === 'manual_adjustment') {
    return `Manual adjust (${entry.field ?? 'field'})`;
  }
  if (entry.entry_type === 'annual_credit') {
    return `Annual credit ${entry.leave_year ?? ''}`.trim();
  }
  if (entry.entry_type === 'opening_balance') {
    return `Opening balance ${entry.leave_year ?? ''}`.trim();
  }
  return entry.entry_type;
}

function BalanceCard({
  balance,
  expanded,
  onToggle,
  ledger,
  onSelectAdjust,
  canAdjust,
  selectedForAdjust,
}: {
  balance: BalanceRow;
  expanded: boolean;
  onToggle: () => void;
  ledger?: LedgerResponse | null;
  onSelectAdjust?: () => void;
  canAdjust: boolean;
  selectedForAdjust: boolean;
}) {
  const opening = asNumber(balance.opening_balance);
  const credited = asNumber(balance.credited);
  const availed = asNumber(balance.availed);
  const available = asNumber(balance.closing_balance);
  const usedBase = Math.max(opening + credited, availed + available);
  const max = Math.max(asNumber(balance.max_accumulation), usedBase || available || 1);
  const usedPct = Math.min(100, (availed / max) * 100);
  const availPct = Math.min(100 - usedPct, (available / max) * 100);

  return (
    <div className={`rounded-xl border bg-white shadow-sm ${selectedForAdjust ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'}`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{balance.leave_type_code}</div>
            <div className="text-xs text-slate-500">{balance.leave_type_name}</div>
          </div>
          <div className="rounded-full bg-slate-100 px-2 py-1 text-[11px] text-slate-600">FY {balance.leave_year}</div>
        </div>

        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="text-3xl font-bold text-slate-900">{available.toFixed(1)}</div>
            <div className="text-xs text-slate-500">available days</div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>Used {availed.toFixed(1)}</div>
            <div>Credited {credited.toFixed(1)}</div>
            <div>Max {max.toFixed(1)}</div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-full bg-slate-200">
          <div className="flex h-3 w-full">
            <div className="bg-rose-500" style={{ width: `${usedPct}%` }} />
            <div className="bg-emerald-500" style={{ width: `${availPct}%` }} />
          </div>
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-slate-500">
          <span>Used</span>
          <span>Available</span>
          <span>Cap</span>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onToggle} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            {expanded ? 'Hide Ledger' : 'Show Ledger'}
          </button>
          {canAdjust && onSelectAdjust && (
            <button onClick={onSelectAdjust} className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700">
              {selectedForAdjust ? 'Adjusting' : 'Manual Adjust'}
            </button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 text-sm font-semibold text-slate-800">Ledger</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-2 pr-3">Date</th>
                  <th className="pb-2 pr-3">Event</th>
                  <th className="pb-2 pr-3">Delta</th>
                  <th className="pb-2 pr-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {(ledger?.transactions ?? []).map((entry, index) => (
                  <tr key={`${entry.entry_type}-${entry.event_date ?? 'na'}-${index}`} className="border-t border-slate-200">
                    <td className="py-2 pr-3 text-slate-600">{formatDate(entry.event_date)}</td>
                    <td className="py-2 pr-3 font-medium text-slate-800">{entryLabel(entry)}</td>
                    <td className={`py-2 pr-3 font-mono ${asNumber(entry.delta) < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {asNumber(entry.delta) >= 0 ? '+' : ''}
                      {asNumber(entry.delta).toFixed(1)}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {entry.reason || (entry.from_date && entry.to_date ? `${formatDate(entry.from_date)} to ${formatDate(entry.to_date)}` : '—')}
                    </td>
                  </tr>
                ))}
                {(!ledger || ledger.transactions.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      No ledger entries found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function MyLeaveAccountPage() {
  const user = useAuthStore((state) => state.user);
  const canAdminView = user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER';
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, LedgerResponse>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [projection, setProjection] = useState<Record<string, unknown> | null>(null);
  const [message, setMessage] = useState('');
  const [selectedBalanceId, setSelectedBalanceId] = useState('');
  const [adjustField, setAdjustField] = useState('credited');
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');

  const targetEmployeeId = selectedEmployee?.id ?? user?.employee_id ?? '';
  const selectedBalance = useMemo(
    () => balances.find((item) => item.id === selectedBalanceId) ?? null,
    [balances, selectedBalanceId]
  );

  const loadBalances = async (employeeId = targetEmployeeId) => {
    if (!employeeId) {
      setMessage('Select an employee first.');
      return;
    }
    const { data } = await balApi.get(employeeId);
    setBalances(data.balances || []);
    setLedgerMap({});
    setExpandedIds({});
    setProjection(null);
    setSelectedBalanceId((data.balances || [])[0]?.id ?? '');
    setMessage('');
  };

  const searchEmployees = async () => {
    if (!employeeQuery.trim()) {
      setEmployeeOptions([]);
      return;
    }
    const { data } = await employeeApi.search(employeeQuery.trim());
    setEmployeeOptions(data || []);
  };

  const toggleLedger = async (balance: BalanceRow) => {
    const next = !expandedIds[balance.leave_type_id];
    setExpandedIds((current) => ({ ...current, [balance.leave_type_id]: next }));
    if (next && !ledgerMap[balance.leave_type_id]) {
      const { data } = await balApi.ledger(targetEmployeeId, balance.leave_type_id);
      setLedgerMap((current) => ({ ...current, [balance.leave_type_id]: data }));
    }
  };

  const runProjection = async () => {
    const fromDate = (document.getElementById('proj-from') as HTMLInputElement).value;
    const toDate = (document.getElementById('proj-to') as HTMLInputElement).value;
    const leaveType = (document.getElementById('proj-lt') as HTMLInputElement).value;
    if (!targetEmployeeId || !fromDate || !toDate || !leaveType) {
      setMessage('Projection needs employee, leave type, from date, and to date.');
      return;
    }
    const { data } = await balApi.project(targetEmployeeId, {
      from_date: fromDate,
      to_date: toDate,
      leave_type_code: leaveType,
    });
    setProjection(data);
    setMessage('');
  };

  const runManualAdjust = async () => {
    if (!selectedBalance) {
      setMessage('Choose a leave balance to adjust.');
      return;
    }
    await balApi.manualAdjust(selectedBalance.id, {
      field: adjustField,
      amount: Number(adjustAmount),
      reason: adjustReason,
    });
    setMessage(`Manual adjustment applied to ${selectedBalance.leave_type_code}.`);
    setAdjustReason('');
    await loadBalances(targetEmployeeId);
  };

  return (
    <div className="space-y-6">
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {canAdminView && (
            <>
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Employee Lookup</label>
                <div className="flex gap-2">
                  <input
                    value={employeeQuery}
                    onChange={(e) => setEmployeeQuery(e.target.value)}
                    placeholder="Search by employee code or name"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button onClick={searchEmployees} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
                    Search
                  </button>
                </div>
              </div>
              <div className="min-w-[260px] flex-1">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Selected Employee</label>
                <select
                  value={selectedEmployee?.id ?? ''}
                  onChange={(e) => {
                    const next = employeeOptions.find((item) => item.id === e.target.value) ?? null;
                    setSelectedEmployee(next);
                  }}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Choose employee</option>
                  {employeeOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.emp_code} - {item.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!canAdminView && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</div>
              <div className="mt-1 text-sm text-slate-700">{user?.emp_code ?? user?.username}</div>
            </div>
          )}
          <button onClick={() => void loadBalances()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Load Account
          </button>
        </div>
      </div>

      {balances.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {balances.map((balance) => (
            <BalanceCard
              key={balance.id}
              balance={balance}
              expanded={!!expandedIds[balance.leave_type_id]}
              onToggle={() => void toggleLedger(balance)}
              ledger={ledgerMap[balance.leave_type_id]}
              canAdjust={canAdminView}
              selectedForAdjust={selectedBalanceId === balance.id}
              onSelectAdjust={() => setSelectedBalanceId(balance.id)}
            />
          ))}
        </div>
      )}

      {canAdminView && balances.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-lg font-semibold text-slate-900">Manual Adjustment</div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={selectedBalanceId}
              onChange={(e) => setSelectedBalanceId(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Choose leave balance</option>
              {balances.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.leave_type_code} - FY {item.leave_year}
                </option>
              ))}
            </select>
            <select value={adjustField} onChange={(e) => setAdjustField(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="credited">credited</option>
              <option value="opening_balance">opening_balance</option>
              <option value="availed">availed</option>
              <option value="lop_days">lop_days</option>
            </select>
            <input value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} type="number" step="0.5" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Reason" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <button onClick={() => void runManualAdjust()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              Apply Adjustment
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-lg font-semibold text-slate-900">Balance Projection</div>
        <div className="flex flex-wrap gap-2">
          <input id="proj-lt" placeholder="Leave type code" defaultValue="EL" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input id="proj-from" type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input id="proj-to" type="date" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={() => void runProjection()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Project
          </button>
        </div>
        {projection && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center gap-4">
              <span>Current: <strong>{String(projection.current_balance)}</strong></span>
              <span>Requested: <strong>{String(projection.requested_days)}</strong></span>
              <span>Projected: <strong>{String(projection.projected_balance)}</strong></span>
              <span className="text-xs text-slate-500">
                {projection.cached ? 'Cached result' : 'Fresh result'} · TTL {String(projection.cache_ttl_seconds)}s
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function YearEndProcessingPage() {
  const user = useAuthStore((state) => state.user);
  const canRun = user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER';
  const [message, setMessage] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [manualEmployees, setManualEmployees] = useState<EmployeeOption[]>([]);
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [manualBalances, setManualBalances] = useState<BalanceRow[]>([]);
  const [manualBalanceId, setManualBalanceId] = useState('');
  const [manualField, setManualField] = useState('credited');
  const [manualAmount, setManualAmount] = useState('0');
  const [manualReason, setManualReason] = useState('');

  if (!canRun) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Only `ADMIN` and `ESTABLISHMENT_OFFICER` can run year-end or manual account actions.
      </div>
    );
  }

  const runCarryForward = async () => {
    try {
      const { data } = await balApi.carryForward({ source_year: 2026, target_year: 2027, year_start: '2027-04-01' });
      setMessage(`Carry-forward complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Carry-forward failed');
    }
  };

  const runAnnualCredit = async () => {
    try {
      const { data } = await balApi.annualCredit({ year_start: '2027-04-01', leave_year: 2027 });
      setMessage(`Annual credit complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Annual credit failed');
    }
  };

  const searchManualEmployees = async () => {
    const { data } = await employeeApi.search(manualSearch.trim());
    setManualEmployees(data || []);
  };

  const loadManualBalances = async () => {
    if (!manualEmployeeId) {
      setMessage('Choose an employee for manual adjustment.');
      return;
    }
    const { data } = await balApi.get(manualEmployeeId);
    setManualBalances(data.balances || []);
    setManualBalanceId((data.balances || [])[0]?.id ?? '');
  };

  const runManualAdjust = async () => {
    if (!manualBalanceId) {
      setMessage('Choose a leave balance to adjust.');
      return;
    }
    await balApi.manualAdjust(manualBalanceId, {
      field: manualField,
      amount: Number(manualAmount),
      reason: manualReason,
    });
    setMessage('Manual adjustment applied.');
    setManualReason('');
    await loadManualBalances();
  };

  return (
    <div className="max-w-5xl space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Year-End / Account Processing</h2>
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Carry-Forward</h3>
          <p className="mt-2 text-sm text-slate-600">
            Creates next-year carry-forward rows for leave types flagged as carry-forward eligible. EL is capped at 300 days by policy.
          </p>
          <button onClick={() => void runCarryForward()} className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700">
            Execute Carry-Forward
          </button>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Annual Credit</h3>
          <p className="mt-2 text-sm text-slate-600">
            Applies the configured financial-year EL/HPL credits. If an EL carry-forward row already exists for the target year, the credit is added onto that row instead of being skipped.
          </p>
          <button onClick={() => void runAnnualCredit()} className="mt-4 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
            Execute Annual Credit
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Manual Adjustment</h3>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} placeholder="Search employee" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <button onClick={() => void searchManualEmployees()} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Search
          </button>
          <select value={manualEmployeeId} onChange={(e) => setManualEmployeeId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Choose employee</option>
            {manualEmployees.map((item) => (
              <option key={item.id} value={item.id}>
                {item.emp_code} - {item.name}
              </option>
            ))}
          </select>
          <button onClick={() => void loadManualBalances()} className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700">
            Load Balances
          </button>
          <select value={manualBalanceId} onChange={(e) => setManualBalanceId(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">Choose balance</option>
            {manualBalances.map((item) => (
              <option key={item.id} value={item.id}>
                {item.leave_type_code} - FY {item.leave_year}
              </option>
            ))}
          </select>
          <select value={manualField} onChange={(e) => setManualField(e.target.value)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="credited">credited</option>
            <option value="opening_balance">opening_balance</option>
            <option value="availed">availed</option>
            <option value="lop_days">lop_days</option>
          </select>
          <input value={manualAmount} onChange={(e) => setManualAmount(e.target.value)} type="number" step="0.5" className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="Reason" className="rounded-md border border-slate-300 px-3 py-2 text-sm xl:col-span-2" />
          <button onClick={() => void runManualAdjust()} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            Apply Manual Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}
