import { useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { leaveBalancesApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

export function OpeningBalancePage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState('');
  const placeholder = `[\n  {"emp_code": "EMP001", "leave_type_code": "EL", "opening_balance": 30},\n  {"emp_code": "EMP001", "leave_type_code": "HPL", "opening_balance": 20}\n]`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(jsonText);
      const { data } = await leaveBalancesApi.opening(payload);
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult('Invalid JSON');
    }
  };

  const importExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const { data } = await leaveBalancesApi.importExcel(f);
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports & Data', to: '/reports' }, { label: 'Opening Balances' }]}
        title="Opening Balances"
        description="Manual management of leave balances."
      />
      <div className="grid gap-5 md:grid-cols-2">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">JSON Entry</h3>
          <p className="text-xs text-slate-500 mb-3">Fields: emp_code, leave_type_code, opening_balance</p>
          <form onSubmit={submit} className="flex flex-col gap-3">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={placeholder}
              className="form-input font-mono text-xs h-40 resize-none"
            />
            <button id="submit-balances-btn" type="submit" className="btn-primary">Submit</button>
          </form>
        </div>
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-1">Excel Import</h3>
          <p className="text-sm text-slate-500 mb-3">Upload an Excel file with columns:</p>
          <ol className="text-sm text-slate-600 list-decimal list-inside mb-5 space-y-1">
            <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">emp_code</code></li>
            <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">leave_type_code</code></li>
            <li><code className="text-xs bg-slate-100 px-1 py-0.5 rounded">opening_balance</code></li>
          </ol>
          <label className="btn-primary cursor-pointer inline-flex">
            Upload Excel (.xlsx)
            <input id="excel-import" type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
          </label>
        </div>
      </div>
      {result && (
        <pre className="card p-4 bg-slate-900 text-emerald-400 text-xs overflow-auto max-h-60">{result}</pre>
      )}
    </div>
  );
}
