import { useState } from 'react';
import api from '../api/client';
import { useAuthStore } from '../stores';

const balApi = {
  get: (eid: string) => api.get(`/leave-balances/${eid}`),
  ledger: (eid: string, lid: string) => api.get(`/leave-balances/${eid}/ledger/${lid}`),
  project: (eid: string, p: Record<string, string>) => api.get(`/leave-balances/${eid}/project`, { params: p }),
  annualCredit: (data: Record<string, unknown>) => api.post('/leave-balances/credit/annual', data),
  carryForward: (data: Record<string, unknown>) => api.post('/leave-balances/carryforward', data),
  manualAdjust: (bid: string, data: Record<string, unknown>) => api.put(`/leave-balances/${bid}/manual-adjust`, data),
};

export function MyLeaveAccountPage() {
  const user = useAuthStore((state) => state.user);
  const [eid, setEid] = useState(user?.employee_id || '');
  const [balances, setBalances] = useState<Record<string, unknown>[]>([]);
  const [ledger, setLedger] = useState<Record<string, unknown> | null>(null);
  const [projection, setProjection] = useState<Record<string, unknown> | null>(null);

  const loadBalances = async () => {
    if (!eid) return;
    const { data } = await balApi.get(eid);
    setBalances(data.balances || []);
  };

  const showLedger = async (ltId: string) => {
    const { data } = await balApi.ledger(eid, ltId);
    setLedger(data);
  };

  const project = async () => {
    const fd = (document.getElementById('proj-from') as HTMLInputElement).value;
    const td = (document.getElementById('proj-to') as HTMLInputElement).value;
    const lt = (document.getElementById('proj-lt') as HTMLInputElement).value;
    if (!fd || !td || !lt) return;
    const { data } = await balApi.project(eid, { from_date: fd, to_date: td, leave_type_code: lt });
    setProjection(data);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {(user?.role === 'ADMIN' || user?.role === 'ESTABLISHMENT_OFFICER') && (
          <input placeholder="Employee ID (UUID)" value={eid} onChange={(e) => setEid(e.target.value)} className="border rounded px-3 py-2" />
        )}
        <button onClick={loadBalances} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Load Account</button>
      </div>

      {balances.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {balances.map((b: Record<string, unknown>) => {
            const avail = parseFloat(String(b.closing_balance || 0));
            const max = parseFloat(String(b.max_accumulation || avail + 50));
            const pct = Math.min(100, (avail / max) * 100);
            return (
              <div key={b.id as string} className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => showLedger(b.leave_type_id as string)}>
                <div className="flex justify-between items-center"><span className="font-semibold text-gray-800">{b.leave_type_code as string}</span><span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{b.leave_type_name as string}</span></div>
                <div className="text-2xl font-bold mt-2 text-blue-700">{avail.toFixed(1)} <span className="text-xs text-gray-400 font-normal">days</span></div>
                <div className="mt-2 bg-gray-200 rounded-full h-2"><div className="bg-blue-500 rounded-full h-2" style={{ width: `${pct}%` }} /></div>
                <div className="flex justify-between text-xs text-gray-500 mt-2"><span>Availed: {String(b.availed)}</span><span>Credited: {String(b.credited)}</span></div>
              </div>
            );
          })}
        </div>
      )}

      {ledger && (
        <div className="bg-white rounded-lg shadow p-4 border-t-4 border-blue-500">
          <h3 className="font-semibold mb-2 text-gray-800">Transaction Ledger</h3>
          <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">App #</th><th className="px-3 py-2 text-left">From</th><th className="px-3 py-2 text-left">To</th><th className="px-3 py-2 text-left">Days Deducted</th></tr></thead><tbody>
            {(ledger.transactions as Record<string, unknown>[])?.map((t: Record<string, unknown>) => (
              <tr key={t.app_number as string} className="border-t hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{t.app_number as string}</td>
                <td className="px-3 py-2">{t.from_date as string}</td>
                <td className="px-3 py-2">{t.to_date as string}</td>
                <td className="px-3 py-2 font-medium text-red-600">-{String(t.applied_days)}</td>
              </tr>
            ))}
            {(!ledger.transactions || (ledger.transactions as unknown[]).length === 0) && (
               <tr><td colSpan={4} className="px-3 py-4 text-center text-gray-400">No approved leave transactions found.</td></tr>
            )}
          </tbody></table>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold mb-3 text-gray-800">Balance Projection Tool</h3>
        <div className="flex flex-wrap gap-2 items-center">
          <input id="proj-lt" placeholder="Leave type (e.g. EL)" className="border rounded px-3 py-2 w-32 text-sm" defaultValue="EL" />
          <input id="proj-from" type="date" className="border rounded px-3 py-2 text-sm" />
          <input id="proj-to" type="date" className="border rounded px-3 py-2 text-sm" />
          <button onClick={project} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Project Future Balance</button>
        </div>
        {projection && (
          <div className="mt-4 text-sm bg-gray-50 p-3 rounded border">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Current Balance: <span className="font-mono font-medium">{String(projection.current_balance)}</span></span>
              <span className="text-gray-400">&rarr;</span>
              <span className="text-gray-600">Requested Days: <span className="font-mono font-medium text-red-600">-{String(projection.requested_days)}</span></span>
              <span className="text-gray-400">&rarr;</span>
              <span className={`font-bold text-lg ${(projection.projected_balance as number) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                Projected: {String(projection.projected_balance)}
              </span>
            </div>
            {(projection.projected_balance as number) < 0 && <p className="text-red-500 text-xs mt-2">Warning: Insufficient balance for this request.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export function YearEndProcessingPage() {
  const [msg, setMsg] = useState('');

  const runCarryForward = async () => {
    try {
      const { data } = await balApi.carryForward({ source_year: 2026, target_year: 2027 });
      setMsg(`Carry-forward done. ${data.rows_affected} records processed.`);
    } catch (err: unknown) { setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'); }
  };

  const runAnnualCredit = async () => {
    try {
      const { data } = await balApi.annualCredit({ year_start: '2027-04-01', leave_year: 2027 });
      setMsg(`Annual credit done. ${data.rows_affected} records processed.`);
    } catch (err: unknown) { setMsg((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-800">Year-End / Periodic Processing</h2>
      {msg && <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded text-sm">{msg}</div>}

      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
        <h3 className="font-semibold text-lg text-gray-800 mb-2">1. Carry-Forward (2026 &rarr; 2027)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Rolls over accumulated leave balances from the previous year to the next.
          <br/><strong>Rules enforced:</strong> Earned Leave (EL) is strictly capped at a maximum of 300 days.
        </p>
        <button onClick={runCarryForward} className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded text-sm font-medium">
          Execute Carry-Forward
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
        <h3 className="font-semibold text-lg text-gray-800 mb-2">2. Annual Leave Credit (2027)</h3>
        <p className="text-sm text-gray-600 mb-4">
          Credits the configured number of days (e.g., 30 EL, 20 HPL) to all eligible employees based on their category entitlement rules for the new financial year.
        </p>
        <button onClick={runAnnualCredit} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-medium">
          Execute Annual Credit Run
        </button>
      </div>
    </div>
  );
}