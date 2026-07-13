import { useMemo, useState, useEffect, useRef, Fragment } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { employeesApi, leaveBalancesApi, leaveAppApi } from '../api/endpoints';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { ValidatedDateInput } from '../components/ValidatedDateInput';
import { ApprovalTrailPanel } from '../components/ApprovalTrailPanel';
import { hasSystemRole, HR_EDITOR_ROLES, TEAM_VIEW_ROLES, formatHttpError } from '../constants/roles';
import { balancesForLeaveYear, currentLeaveYear } from '../utils/leaveBalances';

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
  application_id?: string | null;
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

function asNumber(value: number | string | null | undefined): number {
  return Number(value ?? 0);
}

function formatDate(value?: string | null): string {
  if (!value) return 'â€”';
  return value.slice(0, 10);
}

function entryLabel(entry: LedgerEntry): string {
  if (entry.entry_type === 'pending_application') {
    return `Pending ${entry.app_number ?? ''} (${entry.status ?? 'in process'})`.trim();
  }
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

function LedgerTransactionsTable({
  transactions,
  compact = false,
}: {
  transactions: LedgerEntry[];
  compact?: boolean;
}) {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const nestedCellPad = compact ? 'py-1 px-2' : 'py-2 px-3';

  return (
    <table className={`w-full text-left ${compact ? 'data-table data-table-compact' : 'text-sm'}`}>
      <thead className="bg-slate-50">
        <tr>
          <th className={`${nestedCellPad} font-semibold text-slate-600`}>Date</th>
          <th className={`${nestedCellPad} font-semibold text-slate-600`}>Type</th>
          <th className={`${nestedCellPad} font-semibold text-slate-600`}>Delta</th>
          <th className={`${nestedCellPad} font-semibold text-slate-600`}>Details</th>
        </tr>
      </thead>
      <tbody>
        {transactions.map((entry, index) => {
          const appId = entry.application_id ?? null;
          const isSelected = Boolean(appId && selectedAppId === appId);
          return (
            <Fragment key={`${entry.entry_type}-${entry.event_date ?? 'na'}-${index}`}>
              <tr
                className={`border-t border-slate-100 ${
                  appId ? 'cursor-pointer hover:bg-blue-50/60' : 'hover:bg-slate-50'
                } ${isSelected ? 'bg-blue-50/40' : ''}`}
                onClick={() => {
                  if (!appId) return;
                  setSelectedAppId(isSelected ? null : appId);
                }}
              >
                <td className={`${nestedCellPad} text-slate-600 whitespace-nowrap`}>{formatDate(entry.event_date)}</td>
                <td className={`${nestedCellPad} font-medium text-slate-800`}>
                  {entryLabel(entry)}
                  {appId && (
                    <span className="ml-1.5 text-[10px] font-normal text-blue-600">
                      {isSelected ? 'Hide trail' : 'View trail'}
                    </span>
                  )}
                </td>
                <td className={`${nestedCellPad} font-mono font-medium ${asNumber(entry.delta) < 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {asNumber(entry.delta) >= 0 ? '+' : ''}
                  {asNumber(entry.delta).toFixed(1)}
                </td>
                <td className={`${nestedCellPad} text-slate-600`}>
                  {entry.reason || (entry.from_date && entry.to_date ? `${formatDate(entry.from_date)} to ${formatDate(entry.to_date)}` : '—')}
                </td>
              </tr>
              {isSelected && appId && (
                <tr>
                  <td colSpan={4} className={`${nestedCellPad} bg-white border-t border-slate-100`}>
                    <ApprovalTrailPanel applicationId={appId} compact />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
        {transactions.length === 0 && (
          <tr>
            <td colSpan={4} className="py-4 text-center text-slate-400 italic">
              No ledger entries found.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function BalanceTableRow({
  balance,
  expanded,
  onToggle,
  ledger,
  compact = false,
}: {
  balance: BalanceRow;
  expanded: boolean;
  onToggle: () => void;
  ledger?: LedgerResponse | null;
  compact?: boolean;
}) {
  const cellPad = compact ? 'py-1 px-1.5' : 'py-3 px-4';
  const opening = asNumber(balance.opening_balance);
  const credited = asNumber(balance.credited);
  const availed = asNumber(balance.availed);
  const available = asNumber(balance.closing_balance);
  const usedBase = Math.max(opening + credited, availed + available);
  const max = Math.max(asNumber(balance.max_accumulation), usedBase || available || 1);

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
        <td className={cellPad}>
          <div className={compact ? 'text-xs font-semibold text-slate-900' : 'text-sm font-semibold text-slate-900'}>{balance.leave_type_code}</div>
          <div className="text-[10px] text-slate-500 max-w-[150px] truncate">{balance.leave_type_name}</div>
        </td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'} text-slate-600`}>{opening.toFixed(1)}</td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'} text-emerald-600 font-medium`}>+{credited.toFixed(1)}</td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'} text-amber-600 font-medium`}>-{availed.toFixed(1)}</td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'} text-slate-900 font-bold`}>{available.toFixed(1)}</td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'} text-slate-400`}>{max.toFixed(1)}</td>
        <td className={`${cellPad} ${compact ? 'text-xs' : 'text-sm'}`}>
          <button onClick={onToggle} className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100">
            {expanded ? 'Hide Ledger' : 'Ledger'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="p-0 border-b border-slate-200">
            <div className={compact ? 'bg-slate-50/80 p-2 shadow-inner' : 'bg-slate-50/80 p-4 shadow-inner'}>
              {ledger?.approval_chains && ledger.approval_chains.length > 0 && (
                <div className="mb-4">
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Approval Chain</div>
                  <div className="flex flex-col gap-2">
                    {ledger.approval_chains.map((chain, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700 bg-white px-2 py-1 rounded border border-slate-200 shadow-sm">{chain.config_name}</span>
                        <span className="text-xs text-slate-500">({chain.max_days ? `${chain.min_days}-${chain.max_days} days` : `> ${chain.min_days} days`})</span>
                        <span className="text-slate-400">â†’</span>
                        <div className="flex items-center gap-1">
                          {chain.steps.map((step, sIdx) => (
                            <div key={sIdx} className="flex items-center gap-1">
                              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">{step}</span>
                              {sIdx < chain.steps.length - 1 && <span className="text-slate-400">â†’</span>}
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
                <LedgerTransactionsTable transactions={ledger?.transactions ?? []} compact={compact} />
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
  const location = useLocation();
  const deskLedger = location.pathname === '/staff-ledger';
  const canTeamView = deskLedger
    || hasSystemRole(user?.role, TEAM_VIEW_ROLES)
    || user?.role === 'NODAL_OFFICE';
  const canAdjust = hasSystemRole(user?.role, HR_EDITOR_ROLES);
  const isHodDesk = deskLedger && user?.role === 'HOD';
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [employeeOptions, setEmployeeOptions] = useState<EmployeeOption[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOption | null>(null);
  const [balances, setBalances] = useState<BalanceRow[]>([]);
  const [ledgerMap, setLedgerMap] = useState<Record<string, LedgerResponse>>({});
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState('');
  const [entryLeaveTypeCode, setEntryLeaveTypeCode] = useState('');
  const [entryFromDate, setEntryFromDate] = useState('');
  const [entryToDate, setEntryToDate] = useState('');
  const [entryReason, setEntryReason] = useState('');
  const [entrySubmitting, setEntrySubmitting] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const ledgerCodeParam = searchParams.get('ledger');
  const employeeParam = searchParams.get('employee');
  const yearParam = searchParams.get('year');
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const targetEmployeeId = selectedEmployee?.id ?? user?.employee_id ?? '';
  const ledgerYear = deskLedger ? currentLeaveYear() : (selectedYear ?? currentLeaveYear());
  const entryLeaveYear = ledgerYear;
  const entryLeaveOptions = useMemo(
    () => balancesForLeaveYear(balances, entryLeaveYear),
    [balances, entryLeaveYear],
  );

  useEffect(() => {
    if (!entryLeaveTypeCode && entryLeaveOptions.length > 0) {
      setEntryLeaveTypeCode(entryLeaveOptions[0].leave_type_code);
    } else if (entryLeaveTypeCode && !entryLeaveOptions.some((b) => b.leave_type_code === entryLeaveTypeCode)) {
      setEntryLeaveTypeCode(entryLeaveOptions[0]?.leave_type_code ?? '');
    }
  }, [entryLeaveOptions, entryLeaveTypeCode]);

  const uniqueYears = useMemo(() => {
    const years = Array.from(new Set(balances.map(b => b.leave_year))).sort((a, b) => b - a);
    return years;
  }, [balances]);

  useEffect(() => {
    if (deskLedger || uniqueYears.length === 0) return;
    const parsedYear = yearParam ? Number(yearParam) : NaN;
    const preferredYear = !Number.isNaN(parsedYear) && uniqueYears.includes(parsedYear)
      ? parsedYear
      : uniqueYears.includes(currentLeaveYear())
        ? currentLeaveYear()
        : uniqueYears.find((year) => year <= currentLeaveYear()) ?? uniqueYears[0];
    if (!selectedYear || !uniqueYears.includes(selectedYear)) {
      setSelectedYear(preferredYear);
    }
  }, [deskLedger, uniqueYears, yearParam, selectedYear]);

  useEffect(() => {
    if (!employeeParam || !canTeamView) return;
    void employeesApi.get(employeeParam).then((res) => {
      const emp = res.data;
      const option: EmployeeOption = {
        id: emp.id,
        emp_code: emp.emp_code,
        name: emp.name,
        department_name: emp.department_name,
      };
      setSelectedEmployee(option);
      setEmployeeOptions([option]);
    }).catch(() => setMessage('Could not load the selected employee.'));
  }, [employeeParam, canTeamView]);

  const selectDeskEmployee = (employeeId: string) => {
    if (!employeeId) {
      setSelectedEmployee(null);
      setBalances([]);
      if (deskLedger) {
        setSearchParams((current) => {
          const next = new URLSearchParams(current);
          next.delete('employee');
          return next;
        }, { replace: true });
      }
      return;
    }
    void employeesApi.get(employeeId).then((res) => {
      const option: EmployeeOption = {
        id: res.data.id,
        emp_code: res.data.emp_code,
        name: res.data.name,
        department_name: res.data.department_name,
      };
      setSelectedEmployee(option);
      setEmployeeOptions([option]);
      setMessage('');
    }).catch(() => setMessage('Could not load the selected employee.'));
    if (deskLedger) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.set('employee', employeeId);
        next.delete('year');
        return next;
      }, { replace: true });
    }
  };

  const filteredBalances = useMemo(
    () => balancesForLeaveYear(balances, ledgerYear),
    [balances, ledgerYear],
  );

  useEffect(() => {
    if (targetEmployeeId) {
      void loadBalances(targetEmployeeId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetEmployeeId]);

  useEffect(() => {
    setLedgerMap({});
    setExpandedIds({});
  }, [ledgerYear, targetEmployeeId]);

  const autoOpenedLedger = useRef(false);

  useEffect(() => {
    if (!ledgerCodeParam || balances.length === 0 || autoOpenedLedger.current) return;
    const match = balancesForLeaveYear(balances, ledgerYear).find(
      (b) => b.leave_type_code.toUpperCase() === ledgerCodeParam.toUpperCase(),
    );
    if (!match) return;
    autoOpenedLedger.current = true;
    void (async () => {
      setExpandedIds((current) => ({ ...current, [match.leave_type_id]: true }));
      const { data } = await leaveBalancesApi.ledger(targetEmployeeId, match.leave_type_id, ledgerYear);
      setLedgerMap((current) => ({ ...current, [match.leave_type_id]: data }));
    })();
  }, [ledgerCodeParam, balances, targetEmployeeId, ledgerYear]);

  const fetchLedger = async (leaveTypeId: string) => {
    const { data } = await leaveBalancesApi.ledger(targetEmployeeId, leaveTypeId, ledgerYear);
    setLedgerMap((current) => ({ ...current, [leaveTypeId]: data }));
  };

  const loadBalances = async (employeeId = targetEmployeeId) => {
    if (!employeeId) {
      setMessage('Select an employee first.');
      return;
    }
    const { data } = await leaveBalancesApi.get(employeeId);
    setBalances(data.balances || []);
    setLedgerMap({});
    setExpandedIds({});
    setMessage('');
  };

  const searchEmployees = async () => {
    if (!employeeQuery.trim()) {
      setEmployeeOptions([]);
      return;
    }
    const { data } = await employeesApi.list({ search: employeeQuery.trim(), limit: '10' });
    setEmployeeOptions(data || []);
  };

  const toggleLedger = async (balance: BalanceRow) => {
    const next = !expandedIds[balance.leave_type_id];
    setExpandedIds((current) => ({ ...current, [balance.leave_type_id]: next }));
    if (next && !ledgerMap[balance.leave_type_id]) {
      await fetchLedger(balance.leave_type_id);
    }
  };

  const runDeskEntry = async () => {
    if (!targetEmployeeId) {
      setMessage('Select an employee first.');
      return;
    }
    if (!entryLeaveTypeCode || !entryFromDate || !entryToDate || !entryReason.trim()) {
      setMessage('Leave type, dates, and reason are all required.');
      return;
    }
    setEntrySubmitting(true);
    setMessage('');
    try {
      const { data } = await leaveAppApi.deskEntry({
        employee_id: targetEmployeeId,
        leave_type_code: entryLeaveTypeCode,
        from_date: entryFromDate,
        to_date: entryToDate,
        reason: entryReason.trim(),
      });
      setMessage(`Leave recorded as approved — ${data.app_number} (${data.applied_days} day(s)).`);
      setEntryReason('');
      setEntryFromDate('');
      setEntryToDate('');
      await loadBalances(targetEmployeeId);
    } catch (err: unknown) {
      setMessage(formatHttpError(err, 'Could not record leave at desk.'));
    } finally {
      setEntrySubmitting(false);
    }
  };

  const focusedBalance = useMemo(() => {
    if (!ledgerCodeParam) return null;
    return balancesForLeaveYear(balances, ledgerYear).find(
      (b) => b.leave_type_code.toUpperCase() === ledgerCodeParam.toUpperCase(),
    ) ?? null;
  }, [ledgerCodeParam, balances, ledgerYear]);

  const showFocusedLedger = Boolean(ledgerCodeParam && !canTeamView && focusedBalance);
  const focusedLedger = focusedBalance ? ledgerMap[focusedBalance.leave_type_id] : null;

  const deskLedgerTitle = isHodDesk ? 'Team Leave Ledger' : 'Staff Leave Ledger';
  const canShowDeskEntry = canAdjust
    && targetEmployeeId
    && (!canTeamView || selectedEmployee)
    && entryLeaveOptions.length > 0;

  return (
    <div className={deskLedger ? 'page' : 'space-y-6'}>
      <PageHeader
        breadcrumbs={
          deskLedger
            ? [
                { label: 'Desk', to: '/hod' },
                { label: 'Nodal Desk', to: '/hod' },
                { label: deskLedgerTitle },
              ]
            : [
                { label: 'Home', to: '/' },
                { label: 'Leave & Attendance', to: '/leave-dashboard' },
                { label: showFocusedLedger ? `${focusedBalance!.leave_type_code} Ledger` : 'Leave Ledger' },
              ]
        }
        title={
          deskLedger
            ? deskLedgerTitle
            : showFocusedLedger
              ? `${focusedBalance!.leave_type_code} — Leave Ledger`
              : 'Full Leave Account'
        }
        hideTitle={deskLedger}
        rightContent={
          deskLedger ? (
            <Link to="/team-leave" className="text-xs font-bold text-blue-600 hover:underline">
              ← Staff balances
            </Link>
          ) : undefined
        }
      />
      {message && (
        <div className={`rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-700 ${deskLedger ? 'px-3 py-2' : 'px-4 py-3'}`}>
          {message}
        </div>
      )}

      {deskLedger && !showFocusedLedger ? (
        <div className="card overflow-hidden">
          <div className="card-header flex-wrap">
            <div className="min-w-[220px] flex-1">
              <EmployeeSearchSelect
                value={selectedEmployee?.id ?? ''}
                onChange={selectDeskEmployee}
                activeOnly
                placeholder="Search staff by code or name…"
              />
            </div>
            {selectedEmployee && (
              <span className="text-xs text-slate-500 whitespace-nowrap">
                {selectedEmployee.emp_code} · {selectedEmployee.name} · FY {ledgerYear}
              </span>
            )}
          </div>
          {!selectedEmployee ? (
            <p className="px-3 py-5 text-center text-xs text-slate-500">
              Select a staff member to view balances and per-type ledger entries.
            </p>
          ) : filteredBalances.length === 0 ? (
            <p className="px-3 py-5 text-center text-xs text-slate-400 italic">No leave balances for FY {ledgerYear}.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table data-table-compact w-full">
                <thead>
                  <tr>
                    <th>Leave type</th>
                    <th>Opening</th>
                    <th>Credited</th>
                    <th>Used</th>
                    <th>Available</th>
                    <th>Max</th>
                    <th>Actions</th>
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
                      compact
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <>
          {!showFocusedLedger && (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-end gap-3">
                {canTeamView ? (
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
                ) : (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Employee</div>
                    <div className="mt-1 text-sm text-slate-700">{user?.emp_code ?? user?.username}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {balances.length > 0 && showFocusedLedger && focusedBalance && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Opening', value: asNumber(focusedBalance.opening_balance) },
              { label: 'Credited', value: asNumber(focusedBalance.credited), positive: true },
              { label: 'Used', value: asNumber(focusedBalance.availed), negative: true },
              { label: 'Available', value: asNumber(focusedBalance.closing_balance), highlight: true },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</div>
                <div className={`mt-1 text-2xl font-bold ${item.highlight ? 'text-slate-900' : item.negative ? 'text-amber-600' : item.positive ? 'text-emerald-600' : 'text-slate-700'}`}>
                  {item.negative ? '-' : item.positive ? '+' : ''}{item.value.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Transaction ledger — FY {focusedBalance.leave_year}</h3>
              <Link to="/leave-account" className="text-xs font-medium text-indigo-600 hover:underline">View all leave types</Link>
            </div>
            <div className="p-2">
              <LedgerTransactionsTable transactions={focusedLedger?.transactions ?? []} />
            </div>
          </div>
        </div>
      )}

          {balances.length > 0 && !showFocusedLedger && (
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
                    {uniqueYears.map((year) => (
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {canShowDeskEntry && (
        <div className={deskLedger ? 'card p-3' : 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'}>
          <div className={deskLedger ? 'mb-2 text-sm font-semibold text-slate-900' : 'mb-1 text-lg font-semibold text-slate-900'}>
            Record leave at desk
          </div>
          <p className="mb-3 text-xs text-slate-600">
            Use when staff could not apply online. Leave is saved as approved, balance is debited, and the ledger shows the application with dates.
          </p>
          <div className={`grid gap-2 ${deskLedger ? 'md:grid-cols-2 xl:grid-cols-6' : 'gap-3 md:grid-cols-2 xl:grid-cols-6'}`}>
            <div>
              <label className="form-label">Leave type (FY {entryLeaveYear})</label>
              <select
                value={entryLeaveTypeCode}
                onChange={(e) => setEntryLeaveTypeCode(e.target.value)}
                className="form-input text-sm"
              >
                {entryLeaveOptions.map((item) => (
                  <option key={item.id} value={item.leave_type_code}>
                    {item.leave_type_code} — {item.leave_type_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">From date</label>
              <ValidatedDateInput
                value={entryFromDate}
                onChange={setEntryFromDate}
                className="form-input text-sm"
                required
              />
            </div>
            <div>
              <label className="form-label">To date</label>
              <ValidatedDateInput
                value={entryToDate}
                onChange={setEntryToDate}
                className="form-input text-sm"
                required
              />
            </div>
            <div className="md:col-span-2 xl:col-span-2">
              <label className="form-label">Reason (why recorded at desk)</label>
              <input
                value={entryReason}
                onChange={(e) => setEntryReason(e.target.value)}
                placeholder="e.g. staff on field duty, no HRMS access"
                className="form-input text-sm w-full"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                disabled={entrySubmitting}
                onClick={() => void runDeskEntry()}
                className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {entrySubmitting ? 'Saving…' : 'Record approved leave'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
