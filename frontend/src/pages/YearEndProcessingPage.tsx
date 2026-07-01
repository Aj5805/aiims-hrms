import { useState } from 'react';
import { employeesApi, leaveBalancesApi } from '../api/endpoints';
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
      const { data } = await leaveBalancesApi.carryForward({ source_year: 2026, target_year: 2027, year_start: '2027-01-01' });
      setMessage(`Carry-forward complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Carry-forward failed');
    }
  };

  const runAnnualCredit = async () => {
    try {
      const { data } = await leaveBalancesApi.annualCredit({ year_start: '2027-01-01', leave_year: 2027 });
      setMessage(`Annual credit complete. ${data.rows_affected} balance rows processed.`);
    } catch (err: unknown) {
      setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Annual credit failed');
    }
  };

  const searchManualEmployees = async () => {
    const { data } = await employeesApi.list({ search: manualSearch.trim(), limit: '10' });
    setManualEmployees(data || []);
  };

  const loadManualBalances = async () => {
    if (!manualEmployeeId) {
      setMessage('Choose an employee for manual adjustment.');
      return;
    }
    const { data } = await leaveBalancesApi.get(manualEmployeeId);
    setManualBalances(data.balances || []);
    setManualBalanceId((data.balances || [])[0]?.id ?? '');
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
          <h3 className="text-lg font-semibold text-slate-900">Calendar Credit (Jan / Jul)</h3>
          <p className="mt-2 text-sm text-slate-600">
            Runs leave credits for the current calendar half. EL uses half-yearly frequency (15 days in January, 15 in July). HPL and other annual types credit once in January. Skips rows already credited for that half.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button onClick={() => void runAnnualCredit()} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Run Jan Credit (H1)
            </button>
            <button
              onClick={async () => {
                try {
                  const { data } = await leaveBalancesApi.annualCredit({ year_start: '2027-07-01', leave_year: 2027, credit_period: 2 });
                  setMessage(`Jul credit complete. ${data.rows_affected} balance rows processed.`);
                } catch (err: unknown) {
                  setMessage((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Jul credit failed');
                }
              }}
              className="rounded-md border border-emerald-600 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Run Jul Credit (H2)
            </button>
          </div>
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
