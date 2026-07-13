import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { leaveBalancesApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

type OpeningResultRow = {
  emp_code: string;
  leave_type?: string;
  status: string;
  message?: string;
};

type OpeningResponse = {
  processed?: number;
  results?: OpeningResultRow[];
};

function parseOpeningResponse(data: unknown): OpeningResponse | null {
  if (!data || typeof data !== 'object') return null;
  return data as OpeningResponse;
}

export function OpeningBalancePage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState<OpeningResponse | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const placeholder = `[\n  {"emp_code": "EMP001", "leave_type_code": "EL", "opening_balance": 30}\n]`;

  const showResult = (data: unknown, err?: string) => {
    if (err) {
      setError(err);
      setResult(null);
      return;
    }
    setError('');
    setResult(parseOpeningResponse(data));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = JSON.parse(jsonText);
      const { data } = await leaveBalancesApi.opening(payload);
      showResult(data);
    } catch {
      showResult(null, 'Invalid JSON — check the format in Advanced entry.');
    } finally {
      setBusy(false);
    }
  };

  const importExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    try {
      const { data } = await leaveBalancesApi.importExcel(f);
      showResult(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      showResult(null, typeof detail === 'string' ? detail : 'Import failed — check file columns and try again.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const rows = result?.results ?? [];
  const okCount = rows.filter((r) => r.status === 'ok').length;
  const errCount = rows.filter((r) => r.status !== 'ok').length;

  return (
    <div className="page space-y-4">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports & Data', to: '/reports' }, { label: 'Opening Balances' }]}
        title="Opening Balances"
      />

      <p className="text-sm text-slate-600 max-w-2xl">
        Import day-zero leave balances when the system goes live or when migrating historical data.
        Use an Excel file with three columns: <strong>emp_code</strong>, <strong>leave_type_code</strong>, and <strong>opening_balance</strong>.
        Re-importing the same employee and leave type updates the opening balance (idempotent).
      </p>

      <div className="card p-5 max-w-xl">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Excel import</h3>
        <p className="text-xs text-slate-500 mb-3">
          Download a template, fill in staff numbers and balances, then upload the .xlsx file.
        </p>
        <label className={`btn-primary cursor-pointer inline-flex ${busy ? 'opacity-50 pointer-events-none' : ''}`}>
          {busy ? 'Processing…' : 'Upload Excel (.xlsx)'}
          <input id="excel-import" type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" disabled={busy} />
        </label>
        <p className="text-[11px] text-slate-500 mt-2">
          Example row: <span className="font-mono">ADM001, EL, 30</span>
        </p>
      </div>

      <details className="card p-5 max-w-xl">
        <summary className="text-sm font-semibold text-slate-800 cursor-pointer">Advanced — paste JSON</summary>
        <p className="text-xs text-slate-500 mt-2 mb-3">For scripted migrations only. Same fields as the Excel columns.</p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={placeholder}
            className="form-input font-mono text-xs h-32 resize-none"
          />
          <button id="submit-balances-btn" type="submit" disabled={busy} className="btn-primary disabled:opacity-50">
            Submit JSON
          </button>
        </form>
      </details>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      )}

      {result && (
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="font-semibold text-slate-800">{result.processed ?? rows.length} rows processed</span>
            {okCount > 0 && <span className="text-emerald-700">{okCount} succeeded</span>}
            {errCount > 0 && <span className="text-rose-700">{errCount} failed</span>}
          </div>
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table data-table-compact">
                <thead>
                  <tr>
                    <th>Staff no.</th>
                    <th>Leave type</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={`${row.emp_code}-${row.leave_type ?? i}`}>
                      <td className="font-mono text-sm">{row.emp_code}</td>
                      <td>{row.leave_type ?? '—'}</td>
                      <td>
                        <span className={`text-[10px] font-bold uppercase ${row.status === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="text-xs text-slate-600">{row.message ?? (row.status === 'ok' ? 'Balance saved' : '—')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
