import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { leaveBalancesApi } from '../api/endpoints';
import { EmployeeSearchSelect } from '../components/EmployeeSearchSelect';
import { PageHeader } from '../components/PageHeader';
import { SearchableSelect } from '../components/SearchableSelect';
import { useAuthStore } from '../stores';

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

const YEAR_END_TABS = [
  { id: 'carryforward', label: 'Carry-forward' },
  { id: 'calendar-credit', label: 'Calendar credit' },
  { id: 'manual', label: 'Manual adjustment' },
] as const;

type YearEndTabId = (typeof YEAR_END_TABS)[number]['id'];

function isYearEndTab(tab: string | null): tab is YearEndTabId {
  return YEAR_END_TABS.some((t) => t.id === tab);
}

const MANUAL_FIELDS = [
  { value: 'credited', label: 'Credited' },
  { value: 'opening_balance', label: 'Opening balance' },
  { value: 'availed', label: 'Availed' },
  { value: 'lop_days', label: 'LOP days' },
];

export function YearEndProcessingPage() {
  const user = useAuthStore((state) => state.user);
  const canRun = user?.role === 'ADMIN';
  const [searchParams] = useSearchParams();
  const rawTab = searchParams.get('tab');
  const activeTab: YearEndTabId = isYearEndTab(rawTab) ? rawTab : 'carryforward';

  const [message, setMessage] = useState('');
  const [manualEmployeeId, setManualEmployeeId] = useState('');
  const [manualBalances, setManualBalances] = useState<BalanceRow[]>([]);
  const [manualBalanceId, setManualBalanceId] = useState('');
  const [manualField, setManualField] = useState('credited');
  const [manualAmount, setManualAmount] = useState('0');
  const [manualReason, setManualReason] = useState('');

  const balanceOptions = useMemo(
    () =>
      manualBalances.map((item) => ({
        value: item.id,
        label: `${item.leave_type_code} — FY ${item.leave_year}`,
        sublabel: `Closing: ${item.closing_balance}`,
        searchText: `${item.leave_type_name} ${item.leave_type_code}`,
      })),
    [manualBalances],
  );

  if (!canRun) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Only Super Admin can run year-end or manual account actions.
      </div>
    );
  }

  const runCarryForward = async () => {
    try {
      const { data } = await leaveBalancesApi.carryForward({ source_year: 2026, target_year: 2027, year_start: '2027-01-01' });
      setMessage(`Carry-forward complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Carry-forward failed');
    }
  };

  const runAnnualCredit = async (creditPeriod?: number) => {
    try {
      const yearStart = creditPeriod === 2 ? '2027-07-01' : '2027-01-01';
      const { data } = await leaveBalancesApi.annualCredit({
        year_start: yearStart,
        leave_year: 2027,
        ...(creditPeriod ? { credit_period: creditPeriod } : {}),
      });
      setMessage(`${creditPeriod === 2 ? 'July' : 'January'} credit complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Annual credit failed');
    }
  };

  const loadManualBalances = async () => {
    if (!manualEmployeeId) {
      setMessage('Choose an employee for manual adjustment.');
      return;
    }
    const { data } = await leaveBalancesApi.get(manualEmployeeId);
    const rows = data.balances || [];
    setManualBalances(rows);
    setManualBalanceId(rows[0]?.id ?? '');
  };

  const runManualAdjust = async () => {
    if (!manualBalanceId) {
      setMessage('Choose a leave balance to adjust.');
      return;
    }
    await leaveBalancesApi.manualAdjust(manualBalanceId, {
      field: manualField,
      amount: Number(manualAmount),
      reason: manualReason,
    });
    setMessage('Manual adjustment applied.');
    setManualReason('');
    await loadManualBalances();
  };

  return (
    <div className="max-w-5xl space-y-4">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports & Data', to: '/reports' }, { label: 'Year-End Processing' }]}
        title="Year-End / Account Processing"
      />

      <nav className="submenu-tabs flex flex-nowrap gap-0.5 overflow-x-auto max-w-full rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm" aria-label="Year-end actions">
        {YEAR_END_TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Link
              key={tab.id}
              to={`/year-end?tab=${tab.id}`}
              className={`rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
                active ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {message && <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">{message}</div>}

      {activeTab === 'carryforward' && (
        <div className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Carry-forward</h3>
          <p className="mt-2 text-sm text-slate-600">
            Rolls closing balances from the current leave year into the next year. Earned leave (EL) is capped at 300 days.
          </p>
          <button
            type="button"
            onClick={() => void runCarryForward()}
            className="mt-4 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Execute carry-forward (2026 → 2027)
          </button>
        </div>
      )}

      {activeTab === 'calendar-credit' && (
        <div className="rounded-xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Calendar credit (January / July)</h3>
          <p className="mt-2 text-sm text-slate-600">
            Posts half-year credits for leave types that accrue on the calendar (e.g. CL). Already-credited rows are skipped.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runAnnualCredit()}
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Run January credit (H1)
            </button>
            <button
              type="button"
              onClick={() => void runAnnualCredit(2)}
              className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Run July credit (H2)
            </button>
          </div>
        </div>
      )}

      {activeTab === 'manual' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Manual adjustment</h3>
            <p className="mt-1 text-sm text-slate-600">
              Correct a single balance field for one employee. All changes are logged in the leave ledger.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="form-label">Employee</label>
              <EmployeeSearchSelect
                value={manualEmployeeId}
                onChange={setManualEmployeeId}
                placeholder="Search staff number or name…"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => void loadManualBalances()}
                disabled={!manualEmployeeId}
                className="btn-primary disabled:opacity-50"
              >
                Load balances
              </button>
            </div>
          </div>

          {manualBalances.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="form-label">Leave balance</label>
                <SearchableSelect
                  options={balanceOptions}
                  value={manualBalanceId}
                  onChange={setManualBalanceId}
                  placeholder="Select balance row…"
                />
              </div>
              <div>
                <label className="form-label">Field to adjust</label>
                <SearchableSelect
                  options={MANUAL_FIELDS}
                  value={manualField}
                  onChange={setManualField}
                  placeholder="Select field…"
                />
              </div>
              <div>
                <label className="form-label">Amount (+/−)</label>
                <input
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  type="number"
                  step="0.5"
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">Reason</label>
                <input
                  value={manualReason}
                  onChange={(e) => setManualReason(e.target.value)}
                  placeholder="Why this correction is needed"
                  className="form-input"
                />
              </div>
            </div>
          )}

          {manualBalances.length > 0 && (
            <button
              type="button"
              onClick={() => void runManualAdjust()}
              disabled={!manualBalanceId}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Apply manual adjustment
            </button>
          )}
        </div>
      )}
    </div>
  );
}
