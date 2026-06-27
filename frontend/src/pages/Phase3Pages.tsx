import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import {
  leaveTypesApi,
  entitlementRulesApi,
  holidayApi,
  workflowApi,
  balancesApi,
} from '../api/phase3_endpoints';
import { PageHeader } from '../components/PageHeader';

// ── Leave Types ────────────────────────────────────────────────────────────

export function LeaveTypesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await leaveTypesApi.list();
    setItems(data);
  };
  useEffect(() => { load(); }, []);
  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'System Config', to: '/admin' }, { label: 'Leave Types' }]}
        title="Leave Types Master"
        description="Core definitions for all available leave types across the institution."
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Scheme</th>
                <th className="px-4 py-3 font-semibold text-center">Half-Day</th>
                <th className="px-4 py-3 font-semibold text-center">MC Req.</th>
                <th className="px-4 py-3 font-semibold text-center">Carry Fwd</th>
                <th className="px-4 py-3 font-semibold text-center">Encashable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((lt) => (
                <tr key={lt.id as string} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-mono font-medium">{lt.code as string}</td>
                <td className="px-3 py-2">{lt.name as string}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">{lt.scheme as string}</span>
                </td>
                <td className="px-3 py-2 text-center">{lt.is_half_day_allowed ? '✅' : '—'}</td>
                <td className="px-3 py-2 text-center">{lt.requires_mc ? '✅' : '—'}</td>
                <td className="px-3 py-2 text-center">{lt.carry_forward ? '✅' : '—'}</td>
                <td className="px-3 py-2 text-center">{lt.encashable ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ── Entitlement Rules ──────────────────────────────────────────────────────

export function EntitlementRulesPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await entitlementRulesApi.list();
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'System Config', to: '/admin' }, { label: 'Entitlement Rules' }]}
        title="Entitlement Rules Master"
        description="Defines annual credit and limits for each category and leave type."
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Leave Type</th>
                <th className="px-4 py-3 font-semibold text-center">Days/Yr</th>
                <th className="px-4 py-3 font-semibold text-center">Yr 1 Days</th>
                <th className="px-4 py-3 font-semibold text-center">Max/Stretch</th>
                <th className="px-4 py-3 font-semibold text-center">Max/Tenure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((r) => (
                <tr key={r.id as string} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-mono text-xs">{r.category_code as string}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.leave_type_code as string}</td>
                <td className="px-3 py-2 text-right">{r.days_per_year != null ? String(r.days_per_year) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.year1_days != null ? String(r.year1_days) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.year2_plus_days != null ? String(r.year2_plus_days) : '—'}</td>
                <td className="px-3 py-2 text-right">{r.max_in_tenure != null ? String(r.max_in_tenure) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}

// ── Holiday Master ─────────────────────────────────────────────────────────

export function HolidayPage() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('GAZETTED');

  const load = async () => {
    const { data } = await holidayApi.list(year);
    setItems(data);
  };
  useEffect(() => { load(); }, [year]);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    await holidayApi.create({ year, holiday_date: date, holiday_name: name, holiday_type: type });
    setName(''); setDate('');
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    await holidayApi.delete(id);
    load();
  };

  return (
    <div>
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'System Config', to: '/admin' }, { label: 'Holiday Master' }]}
        title="Holiday Master"
        rightContent={
          <select
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="border border-slate-300 rounded-md px-3 py-1.5 text-sm bg-white shadow-sm"
          >
            {[2025, 2026, 2027, 2028].map((y) => <option key={y}>{y}</option>)}
          </select>
        }
      />
      <form onSubmit={add} className="flex gap-2 mb-4 bg-white p-4 rounded-lg border border-slate-200">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-3 py-2" required />
        <input placeholder="Holiday name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded px-3 py-2 flex-1" required />
        <select value={type} onChange={(e) => setType(e.target.value)} className="border rounded px-3 py-2">
          <option>GAZETTED</option><option>RESTRICTED</option><option>OPTIONAL</option>
        </select>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add</button>
      </form>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Scope</th>
              <th className="px-4 py-3 font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((h) => (
              <tr key={h.id as string} className="hover:bg-slate-50 transition-colors">
                <td className="px-3 py-2 font-mono text-sm">{h.holiday_date as string}</td>
                <td className="px-3 py-2">{h.holiday_name as string}</td>
                <td className="px-3 py-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700">{h.holiday_type as string}</span>
                </td>
                <td className="px-3 py-2 text-gray-500 text-xs">{h.applicable_to as string}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => del(h.id as string)} className="text-red-500 text-xs hover:text-red-700 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400">No holidays for {year}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Workflow Configurator ──────────────────────────────────────────────────

export function WorkflowPage() {
  const [configs, setConfigs] = useState<Record<string, unknown>[]>([]);
  const [simResult, setSimResult] = useState<Record<string, unknown> | null>(null);
  const [name, setName] = useState('');

  const load = async () => {
    const { data } = await workflowApi.list();
    setConfigs(data);
  };
  useEffect(() => { load(); }, []);

  const createCfg = async () => {
    if (!name.trim()) return;
    await workflowApi.create({ config_name: name });
    setName('');
    load();
  };

  const simulate = async () => {
    const cat = (document.getElementById('sim-cat') as HTMLInputElement).value;
    const lt = (document.getElementById('sim-lt') as HTMLInputElement).value;
    const days = +(document.getElementById('sim-days') as HTMLInputElement).value || 1;
    const { data } = await workflowApi.simulate({ category_code: cat, leave_type_code: lt, days });
    setSimResult(data);
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'System Config', to: '/admin' }, { label: 'Workflow Configurator' }]}
        title="Workflow Configurator"
        description="Define approval hierarchies and escalation logic."
      />
      <div className="flex gap-2 mb-4 bg-white p-4 rounded-lg border border-slate-200">
        <input
          id="wf-new-name"
          placeholder="New workflow config name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border rounded px-3 py-2 flex-1"
        />
        <button onClick={createCfg} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Create</button>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold mb-4 text-slate-800">Existing Workflow Chains</h3>
          {configs.map((c) => (
            <details key={c.id as string} className="mb-2 border border-slate-200 rounded-lg group">
              <summary className="px-4 py-3 cursor-pointer font-medium text-sm flex justify-between group-open:border-b">
                <span>{c.config_name as string}</span>
                <span className="text-slate-400">{(c.steps as unknown[])?.length || 0} steps</span>
              </summary>
              <div className="px-4 py-3 text-xs space-y-2">
                {((c.steps as Record<string, unknown>[]) || []).map((s) => (
                  <div key={s.id as string} className="flex gap-3 text-slate-600 items-center">
                    <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-mono text-[10px]">{s.step_order as number}</span>
                    <span className="font-medium flex-1">{s.approver_role as string}</span>
                    <span className="text-slate-400">{s.sla_hours as number}h</span>
                    {Boolean(s.is_final_authority) && <span className="text-emerald-600 font-bold uppercase tracking-wider text-[9px]">Final</span>}
                  </div>
                ))}
              </div>
            </details>
          ))}
          {configs.length === 0 && <p className="text-slate-400 text-sm">No workflows configured.</p>}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="font-semibold mb-4 text-slate-800">Simulate Routing</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input id="sim-cat" placeholder="Category" className="border rounded px-3 py-2 text-sm" />
            <input id="sim-lt" placeholder="Leave Type" className="border rounded px-3 py-2 text-sm" />
            <input id="sim-days" type="number" defaultValue={3} min={1} className="border rounded px-3 py-2 text-sm" />
          </div>
          <button id="simulate-btn" onClick={simulate} className="w-full bg-slate-800 text-white px-3 py-2 rounded text-sm hover:bg-slate-900 transition-colors">Run Simulation</button>
          {simResult && (
            <div className="mt-4 text-sm border-t pt-4">
              {simResult.matched ? (
                <div>
                  <p className="text-emerald-700 font-medium mb-3">
                    Matched: {(simResult.config as Record<string, unknown>).config_name as string}
                  </p>
                  <div className="space-y-2">
                  {((simResult.config as Record<string, unknown>).steps as Record<string, unknown>[])?.map((s) => (
                    <div key={s.id as string} className="flex gap-3 text-slate-600">
                      <span className="font-mono text-slate-400">Step {s.step_order as number}</span>
                      <span className="font-medium">{s.approver_role as string}</span>
                    </div>
                  ))}
                  </div>
                </div>
              ) : (
                <p className="text-red-600">No workflow matched for the given inputs.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Opening Balances ───────────────────────────────────────────────────────

export function OpeningBalancePage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState('');
  const placeholder = `[
  {"emp_code": "EMP001", "leave_type_code": "EL", "opening_balance": 30},
  {"emp_code": "EMP001", "leave_type_code": "HPL", "opening_balance": 20}
]`;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = JSON.parse(jsonText);
      const { data } = await balancesApi.opening(payload);
      setResult(JSON.stringify(data, null, 2));
    } catch {
      setResult('Invalid JSON');
    }
  };

  const importExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const { data } = await balancesApi.importExcel(f);
    setResult(JSON.stringify(data, null, 2));
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'System Config', to: '/admin' }, { label: 'Opening Balances' }]}
        title="Opening Balances"
        description="Manual management of leave balances."
      />
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden p-6">
        <form onSubmit={submit} className="flex flex-col gap-2 max-w-2xl">
          <h3 className="font-semibold text-slate-800">JSON Entry</h3>
          <p className="text-xs text-slate-500">Fields: emp_code, leave_type_code, opening_balance</p>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            placeholder={placeholder}
            className="w-full border rounded px-3 py-2 text-sm font-mono h-40 resize-none"
          />
          <button id="submit-balances-btn" onClick={submit} className="mt-2 w-full bg-blue-600 text-white px-4 py-2 rounded text-sm">Submit</button>
        </form>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2 text-gray-700">Excel Import</h3>
          <p className="text-sm text-gray-500 mb-3">Upload an Excel file with columns:</p>
          <ol className="text-sm text-gray-600 list-decimal list-inside mb-4 space-y-1">
            <li><code>emp_code</code></li>
            <li><code>leave_type_code</code></li>
            <li><code>opening_balance</code></li>
          </ol>
          <label className="inline-block px-4 py-2 bg-green-600 text-white rounded cursor-pointer text-sm hover:bg-green-700">
            Upload Excel (.xlsx)
            <input id="excel-import" type="file" accept=".xlsx,.xls" onChange={importExcel} className="hidden" />
          </label>
        </div>
      </div>
      {result && (
        <pre className="mt-4 bg-gray-900 text-green-400 p-4 rounded text-xs overflow-auto max-h-60">{result}</pre>
      )}
    </div>
  );
}