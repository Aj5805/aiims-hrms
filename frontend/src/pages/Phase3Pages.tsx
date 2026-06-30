import { useState, useEffect } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import {
  entitlementRulesApi,
  holidayApi,
  balancesApi,
} from '../api/phase3_endpoints';
import { LeaveTypesPanel } from './LeaveTypesPanel';
import { WorkflowPanel } from './WorkflowPanel';
import { PageHeader } from '../components/PageHeader';

export { LeaveTypesPanel } from './LeaveTypesPanel';
export { WorkflowPanel } from './WorkflowPanel';

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

const CREDIT_FREQUENCY_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual (once per year)' },
  { value: 'HALF_YEARLY', label: 'Half-yearly (each calendar half)' },
  { value: 'MONTHLY', label: 'Monthly (prorata)' },
] as const;

export function EntitlementRulesPanel() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const { data } = await entitlementRulesApi.list();
    setItems(data);
  };
  useEffect(() => { void load(); }, []);

  const categories = [...new Set(items.map((r) => r.category_code as string))].sort();
  const filtered = categoryFilter
    ? items.filter((r) => r.category_code === categoryFilter)
    : items;

  const saveFrequency = async (ruleId: string, credit_frequency: string) => {
    try {
      await entitlementRulesApi.update(ruleId, { credit_frequency });
      setMessage('Credit frequency saved.');
      await load();
      setTimeout(() => setMessage(''), 2500);
    } catch {
      setMessage('Could not save credit frequency.');
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">{message}</div>
      )}
      <p className="text-sm text-slate-600">
        Defines how leave is credited to balances. Example: <strong>EL</strong> is typically{' '}
        <strong>half-yearly</strong> — 15 days at the start of January and 15 days at the start of July (30 days per calendar year).
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm text-slate-600">Category</label>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="form-select w-44">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Leave Type</th>
                <th>Credit Frequency</th>
                <th className="text-center">Days/Yr</th>
                <th className="text-center">Per Month</th>
                <th className="text-center">Max/Stretch</th>
                <th className="text-center">Max/Tenure</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id as string}>
                  <td className="font-mono text-xs">{r.category_code as string}</td>
                  <td className="font-mono text-xs">{r.leave_type_code as string}</td>
                  <td>
                    <select
                      value={(r.credit_frequency as string) || 'ANNUAL'}
                      onChange={(e) => void saveFrequency(r.id as string, e.target.value)}
                      className="form-select text-xs py-1.5 min-w-[10rem]"
                    >
                      {CREDIT_FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {(r.credit_frequency as string) === 'HALF_YEARLY' && r.days_per_year != null && (
                      <div className="text-[11px] text-slate-500 mt-1">
                        {Number(r.days_per_year) / 2} days per half
                      </div>
                    )}
                  </td>
                  <td className="text-right">{r.days_per_year != null ? String(r.days_per_year) : '—'}</td>
                  <td className="text-right">{r.prorata_rate != null ? String(r.prorata_rate) : '—'}</td>
                  <td className="text-right">{r.max_at_a_stretch != null ? String(r.max_at_a_stretch) : '—'}</td>
                  <td className="text-right">{r.max_in_tenure != null ? String(r.max_in_tenure) : '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-400">No entitlement rules configured.</td></tr>
              )}
            </tbody>
          </table>
        </div>
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

type HolidayTypeFilter = 'GAZETTED' | 'RESTRICTED' | 'ALL';

function holidayTypeLabel(type: string): string {
  if (type === 'GAZETTED') return 'Closed';
  if (type === 'RESTRICTED') return 'Restricted (RH)';
  return type;
}

export function HolidayPanel() {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [typeFilter, setTypeFilter] = useState<HolidayTypeFilter>('GAZETTED');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('GAZETTED');

  const load = async () => {
    const { data } = await holidayApi.list(year);
    setItems(data);
  };
  useEffect(() => { void load(); }, [year]);

  const visibleItems = typeFilter === 'ALL'
    ? items
    : items.filter((h) => h.holiday_type === typeFilter);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    await holidayApi.create({ year, holiday_date: date, holiday_name: name, holiday_type: type });
    setName(''); setDate('');
    setShowAddForm(false);
    load();
  };

  const del = async (id: string) => {
    if (!confirm('Delete this holiday?')) return;
    await holidayApi.delete(id);
    load();
  };

  const closedCount = items.filter((h) => h.holiday_type === 'GAZETTED').length;
  const rhCount = items.filter((h) => h.holiday_type === 'RESTRICTED').length;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 space-y-1">
        <p><strong>Closed holidays</strong> — institute is closed; applies to all staff.</p>
        <p><strong>Restricted holidays (RH)</strong> — each employee may avail <strong>any two</strong> from the RH list in a calendar year (subject to approval).</p>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {([
            ['GAZETTED', `Closed (${closedCount})`],
            ['RESTRICTED', `Restricted (${rhCount})`],
            ['ALL', `All (${items.length})`],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition ${
                typeFilter === value
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={year}
            onChange={(e) => setYear(+e.target.value)}
            className="form-select w-28"
          >
            {[2025, 2026, 2027, 2028].map((y) => <option key={y}>{y}</option>)}
          </select>
          <button type="button" onClick={() => setShowAddForm((v) => !v)} className="btn-primary btn-sm">
            {showAddForm ? 'Cancel' : '+ Add Holiday'}
          </button>
        </div>
      </div>

      {showAddForm && (
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
              <option value="GAZETTED">Closed</option>
              <option value="RESTRICTED">Restricted (RH)</option>
            </select>
          </div>
          <button type="submit" className="btn-primary btn-sm self-end mb-0.5">Save Holiday</button>
        </form>
      )}

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
            {visibleItems.map((h) => (
              <tr key={h.id as string}>
                <td className="font-mono">{h.holiday_date as string}</td>
                <td>{h.holiday_name as string}</td>
                <td>
                  <span className={`badge ${h.holiday_type === 'GAZETTED' ? 'badge-blue' : 'badge-amber'}`}>
                    {holidayTypeLabel(h.holiday_type as string)}
                  </span>
                </td>
                <td className="text-slate-500">{h.applicable_to as string}</td>
                <td className="text-right">
                  <button onClick={() => del(h.id as string)} className="text-red-500 text-xs hover:text-red-700 font-medium">Delete</button>
                </td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr><td colSpan={5} className="py-10 text-center text-slate-400">No {typeFilter === 'ALL' ? '' : holidayTypeLabel(typeFilter).toLowerCase()} holidays for {year}</td></tr>
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
