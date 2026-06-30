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

export function LeaveTypesPanel() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await leaveTypesApi.list({ include_inactive: true });
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const toggleActive = async (lt: Record<string, unknown>) => {
    await leaveTypesApi.update(lt.id as string, { is_active: !lt.is_active });
    load();
  };

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Scheme</th>
              <th className="text-center">Half-Day</th>
              <th className="text-center">MC Req.</th>
              <th className="text-center">Carry Fwd</th>
              <th className="text-center">Encashable</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((lt) => (
              <tr key={lt.id as string} className={lt.is_active === false ? 'opacity-60' : ''}>
                <td className="font-mono font-medium">{lt.code as string}</td>
                <td>{lt.name as string}</td>
                <td>
                  <span className="badge badge-blue">{lt.scheme as string}</span>
                </td>
                <td className="text-center">{lt.is_half_day_allowed ? '✓' : '—'}</td>
                <td className="text-center">{lt.requires_mc ? '✓' : '—'}</td>
                <td className="text-center">{lt.carry_forward ? '✓' : '—'}</td>
                <td className="text-center">{lt.encashable ? '✓' : '—'}</td>
                <td>{lt.is_active !== false ? <span className="text-emerald-700 font-bold text-xs">Active</span> : <span className="text-slate-400 text-xs">Inactive</span>}</td>
                <td>
                  <button type="button" onClick={() => void toggleActive(lt)} className="text-xs font-bold text-blue-600 hover:underline">
                    {lt.is_active !== false ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={9} className="py-10 text-center text-slate-400">No leave types configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LeaveTypesPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters', to: '/masters' }, { label: 'Leave Types' }]}
        title="Leave Types Master"
        description="Core definitions for all available leave types across the institution."
      />
      <div className="card overflow-hidden">
        <LeaveTypesPanel />
      </div>
    </div>
  );
}

// ── Entitlement Rules ──────────────────────────────────────────────────────

export function EntitlementRulesPanel() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const load = async () => {
    const { data } = await entitlementRulesApi.list();
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Leave Type</th>
              <th>Year Ref</th>
              <th className="text-center">Days/Yr</th>
              <th className="text-center">Per Month</th>
              <th className="text-center">Max/Stretch</th>
              <th className="text-center">Max/Tenure</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id as string}>
                <td className="font-mono text-xs">{r.category_code as string}</td>
                <td className="font-mono text-xs">{r.leave_type_code as string}</td>
                <td className="text-xs">{r.year_ref != null ? String(r.year_ref) : '—'}</td>
                <td className="text-right">{r.days_per_year != null ? String(r.days_per_year) : '—'}</td>
                <td className="text-right">{r.prorata_rate != null ? String(r.prorata_rate) : '—'}</td>
                <td className="text-right">{r.max_at_a_stretch != null ? String(r.max_at_a_stretch) : '—'}</td>
                <td className="text-right">{r.max_in_tenure != null ? String(r.max_in_tenure) : '—'}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={7} className="py-10 text-center text-slate-400">No entitlement rules configured.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EntitlementRulesPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters', to: '/masters' }, { label: 'Entitlement Rules' }]}
        title="Entitlement Rules Master"
        description="Defines annual credit and limits for each category and leave type."
      />
      <div className="card overflow-hidden">
        <EntitlementRulesPanel />
      </div>
    </div>
  );
}

// ── Holiday Master ─────────────────────────────────────────────────────────

export function HolidayPanel() {
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
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          value={year}
          onChange={(e) => setYear(+e.target.value)}
          className="form-select w-28"
        >
          {[2025, 2026, 2027, 2028].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>
      <form onSubmit={add} className="flex flex-wrap gap-3 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
        <div className="flex-1 min-w-32">
          <label className="form-label">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-input" required />
        </div>
        <div className="flex-[3] min-w-48">
          <label className="form-label">Holiday Name</label>
          <input placeholder="e.g. Republic Day" value={name} onChange={(e) => setName(e.target.value)} className="form-input" required />
        </div>
        <div className="flex-1 min-w-36">
          <label className="form-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="form-select">
            <option>GAZETTED</option><option>RESTRICTED</option><option>OPTIONAL</option>
          </select>
        </div>
        <button type="submit" className="btn-primary btn-sm self-end mb-0.5">Add Holiday</button>
      </form>
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Name</th>
              <th>Type</th>
              <th>Scope</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((h) => (
              <tr key={h.id as string}>
                <td className="font-mono">{h.holiday_date as string}</td>
                <td>{h.holiday_name as string}</td>
                <td>
                  <span className="badge badge-amber">{h.holiday_type as string}</span>
                </td>
                <td className="text-slate-500">{h.applicable_to as string}</td>
                <td className="text-right">
                  <button onClick={() => del(h.id as string)} className="text-red-500 text-xs hover:text-red-700 font-medium">Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400">No holidays for {year}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function HolidayPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters', to: '/masters' }, { label: 'Holiday Master' }]}
        title="Holiday Master"
      />
      <div className="card p-5">
        <HolidayPanel />
      </div>
    </div>
  );
}

// ── Workflow Configurator ──────────────────────────────────────────────────

export function WorkflowPanel() {
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
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          id="wf-new-name"
          placeholder="New workflow config name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="form-input flex-1"
        />
        <button onClick={createCfg} className="btn-primary">Create</button>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Existing Workflow Chains</h3>
          {configs.map((c) => (
            <details key={c.id as string} className="mb-2 border border-slate-200 rounded-lg group">
              <summary className="px-4 py-3 cursor-pointer font-medium text-sm flex justify-between items-center group-open:border-b border-slate-100">
                <span>{c.config_name as string}</span>
                <span className="text-slate-400 text-xs">{(c.steps as unknown[])?.length || 0} steps</span>
              </summary>
              <div className="px-4 py-3 text-xs space-y-2">
                {((c.steps as Record<string, unknown>[]) || []).map((s) => (
                  <div key={s.id as string} className="flex gap-3 text-slate-600 items-center">
                    <span className="w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-mono text-xs shrink-0">{s.step_order as number}</span>
                    <span className="font-medium flex-1">{s.approver_role as string}</span>
                    <span className="text-slate-400">{s.sla_hours as number}h</span>
                    {Boolean(s.is_final_authority) && <span className="badge badge-green text-[10px]">Final</span>}
                  </div>
                ))}
              </div>
            </details>
          ))}
          {configs.length === 0 && <p className="text-slate-400 text-sm">No workflows configured.</p>}
        </div>
        <div className="border border-slate-200 rounded-lg p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Simulate Routing</h3>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <input id="sim-cat" placeholder="Category" className="form-input" />
            <input id="sim-lt" placeholder="Leave Type" className="form-input" />
            <input id="sim-days" type="number" defaultValue={3} min={1} className="form-input" />
          </div>
          <button id="simulate-btn" onClick={simulate} className="btn-secondary w-full">Run Simulation</button>
          {simResult && (
            <div className="mt-4 text-sm border-t border-slate-100 pt-4">
              {simResult.matched ? (
                <div>
                  <p className="text-emerald-700 font-semibold mb-3">
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

export function WorkflowPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Masters', to: '/masters' }, { label: 'Workflow Configurator' }]}
        title="Workflow Configurator"
        description="Define approval hierarchies and escalation logic."
      />
      <div className="card p-5">
        <WorkflowPanel />
      </div>
    </div>
  );
}

// ── Opening Balances (transactional — not a reference master) ──────────────

export function OpeningBalancePage() {
  const [jsonText, setJsonText] = useState('');
  const [result, setResult] = useState('');
  const placeholder = `[\n  {"emp_code": "EMP001", "leave_type_code": "EL", "opening_balance": 30},\n  {"emp_code": "EMP001", "leave_type_code": "HPL", "opening_balance": 20}\n]`;

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
