import { useState, useEffect } from 'react';
import { entitlementRulesApi } from '../api/endpoints';

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
