import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { holidayApi } from '../api/endpoints';

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
