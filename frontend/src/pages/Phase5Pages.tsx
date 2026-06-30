import { useMemo, useState, useEffect } from 'react';
import api from '../api/client';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

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
  approval_chains?: { config_name: string; min_days: number; max_days: number | null; steps: string[] }[];
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

function BalanceTableRow({
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

  return (
    <>
      <tr className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedForAdjust ? 'bg-blue-50/50' : ''}`}>
        <td className="py-3 px-4">
          <div className="text-sm font-semibold text-slate-900">{balance.leave_type_code}</div>
          <div className="text-[11px] text-slate-500 max-w-[150px] truncate">{balance.leave_type_name}</div>
        </td>
        <td className="py-3 px-4 text-sm text-slate-600">{opening.toFixed(1)}</td>
        <td className="py-3 px-4 text-sm text-emerald-600 font-medium">+{credited.toFixed(1)}</td>
        <td className="py-3 px-4 text-sm text-amber-600 font-medium">-{availed.toFixed(1)}</td>
        <td className="py-3 px-4 text-sm text-slate-900 font-bold">{available.toFixed(1)}</td>
        <td className="py-3 px-4 text-sm text-slate-400">{max.toFixed(1)}</td>
        <td className="py-3 px-4 text-sm flex items-center gap-2">
          <button onClick={onToggle} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
            {expanded ? 'Hide Ledger' : 'Ledger'}
          </button>
          {canAdjust && onSelectAdjust && (
            <button onClick={onSelectAdjust} className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 hover:bg-blue-100 font-medium">
              {selectedForAdjust ? 'Selected' : 'Adjust'}
            </button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="p-0 border-b border-slate-200">
            <div className="bg-slate-50/80 p-4 shadow-inner">
              {ledger?.approval_chains && ledger.approval_chains.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Approval Chain</div>
                  <div className="flex flex-col gap-2">
                    {ledger.approval_chains.map((chain, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{chain.config_name}</span>
                        <span className="text-xs text-slate-500">({chain.max_days ? `${chain.min_days}-${chain.max_days} days` : `> ${chain.min_days} days`})</span>
                        <span className="text-slate-400">→</span>
                        <div className="flex items-center gap-1">
                          {chain.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">{step}</span>
                              {sIdx < chain.steps.length - 1 && <span className="text-slate-400">→</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Ledger Details</div>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="py-2 px-3 font-semibold text-slate-600">Date</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Type</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Delta</th>
                      <th className="py-2 px-3 font-semibold text-slate-600">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledger?.transactions ?? []).map((entry, index) => (
                      <tr key={`${entry.entry_type}-${entry.event_date ?? 'na'}-${index}`} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{formatDate(entry.event_date)}</td>
                        <td className="py-2 px-3 font-medium text-slate-800">{entryLabel(entry)}</td>
                        <td className={`py-2 px-3 font-mono font-medium ${asNumber(entry.delta) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          {asNumber(entry.delta) >= 0 ? '+' : ''}
                          {asNumber(entry.delta).toFixed(1)}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {entry.reason || (entry.from_date && entry.to_date ? `${formatDate(entry.from_date)} to ${formatDate(entry.to_date)}` : '—')}
                        </td>
                      </tr>
                    ))}
                    {(!ledger || ledger.transactions.length === 0) && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400 italic">
                          No ledger entries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function MyLeaveAccountPage() {
  const user = useAuthStore((state) => state.user);
  const canTeamView = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'HOD', 'NODAL_OFFICER'].includes(user?.role ?? '');
  const canAdjust = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'NODAL_OFFICER'].includes(user?.role ?? '');
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, LedgerResponse>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [selectedBalanceId, setSelectedBalanceId] = useState('');
  const [adjustField, setAdjustField] = useState('credited');
  const [adjustAmount, setAdjustAmount] = useState('0');
  const [adjustReason, setAdjustReason] = useState('');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const targetEmployeeId = selectedEmployee?.id ?? user?.employee_id ?? '';
  const selectedBalance = useMemo(
    () => balances.find((item) => item.id === selectedBalanceId) ?? null,
    [balances, selectedBalanceId]
  );

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(balances.map(b => b.leave_year))).sort((a, b) => b - a);
    return years;
  }, [balances]);

  useEffect(() => {
    if (uniqueYears.length > 0 && (!selectedYear || !uniqueYears.includes(selectedYear))) {
      setSelectedYear(uniqueYears[0]);
    }
  }, [uniqueYears, selectedYear]);

  const filteredBalances = useMemo(() => {
    if (!selectedYear) return [];
    return balances.filter(b => b.leave_year === selectedYear);
  }, [balances, selectedYear]);

  useEffect(() => {
    if (targetEmployeeId) {
      void loadBalances(targetEmployeeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEmployeeId]);

  const loadBalances = async (employeeId = targetEmployeeId) => {
    if (!employeeId) {
      setMessage('Select an employee first.');
      return;
    }
    const { data } = await balApi.get(employeeId);
    setBalances(data.balances || []);
    setLedgerMap({});
    setExpandedIds({});
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
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Leave Ledger' }]}
        title="Full Leave Account"
      />
      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {canTeamView && (
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
          {!canTeamView && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</div>
              <div className="mt-1 text-sm text-slate-700">{user?.emp_code ?? user?.username}</div>
            </div>
          )}
        </div>
      </div>

      {balances.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
          <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700">Leave Balances</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-sm font-medium text-slate-600">Leave Year:</label>
              <select
                id="year-select"
                value={selectedYear || ''}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm bg-white font-medium text-slate-700 shadow-sm"
              >
                {uniqueYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Leave Type</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Opening</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Credited</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Used</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-900">Available</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Max</th>
                <th className="py-3 px-4 text-xs font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredBalances.map((balance) => (
                <BalanceTableRow
                  key={balance.id}
                  balance={balance}
                  expanded={!!expandedIds[balance.leave_type_id]}
                  onToggle={() => void toggleLedger(balance)}
                  ledger={ledgerMap[balance.leave_type_id]}
                  canAdjust={canAdjust}
                  selectedForAdjust={selectedBalanceId === balance.id}
                  onSelectAdjust={() => setSelectedBalanceId(balance.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canAdjust && balances.length > 0 && (
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
      const { data } = await balApi.carryForward({ source_year: 2026, target_year: 2027, year_start: '2027-01-01' });
      setMessage(`Carry-forward complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Carry-forward failed');
    }
  };

  const runAnnualCredit = async () => {
    try {
      const { data } = await balApi.annualCredit({ year_start: '2027-01-01', leave_year: 2027 });
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
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports & Data', to: '/reports' }, { label: 'Year-End Processing' }]}
        title="Year-End / Account Processing"
      />
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
            Applies calendar-year credits for all entitled leave types (regular staff EL/HPL/CL and resident ANNUAL_RES). Join-year staff receive pro-rata credit. Skips rows that already have credit.
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
