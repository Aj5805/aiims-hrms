import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { holidayApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';
import { CONFIG_ROLES, hasSystemRole } from '../constants/roles';
import { useAuthStore } from '../stores';
import { canToggleWorkMode, effectiveWorkMode } from '../utils/workMode';

type HolidayRow = {
  id: string;
  holiday_date: string;
  holiday_name: string;
  holiday_type: string;
};

function holidayTypeLabel(type: string): string {
  if (type === 'GAZETTED') return 'Closed';
  if (type === 'RESTRICTED') return 'Restricted (RH)';
  return type;
}

function yearOptions(anchor: number) {
  return [anchor - 1, anchor, anchor + 1, anchor + 2];
}

export default function HolidayCalendarPage() {
  const role = useAuthStore((s) => s.user?.role);
  const workMode = useAuthStore((s) => s.workMode);
  const employeeId = useAuthStore((s) => s.user?.employee_id);
  const canManageHolidays = hasSystemRole(role, CONFIG_ROLES);
  const inDeskMode = canToggleWorkMode(role, employeeId) && effectiveWorkMode(role, employeeId, workMode) === 'desk';

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [items, setItems] = useState<HolidayRow[]>([]);
  const [typeFilter, setTypeFilter] = useState<'GAZETTED' | 'RESTRICTED' | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    holidayApi.list(year)
      .then((res) => {
        setItems(res.data || []);
        setError('');
      })
      .catch(() => {
        setItems([]);
        setError('Could not load holiday calendar. Check that you are logged in and the server is running.');
      })
      .finally(() => setLoading(false));
  }, [year]);

  const visible = useMemo(() => {
    const sorted = [...items].sort((a, b) => a.holiday_date.localeCompare(b.holiday_date));
    if (typeFilter === 'ALL') return sorted;
    return sorted.filter((h) => h.holiday_type === typeFilter);
  }, [items, typeFilter]);

  const closedCount = items.filter((h) => h.holiday_type === 'GAZETTED').length;
  const rhCount = items.filter((h) => h.holiday_type === 'RESTRICTED').length;

  const breadcrumbs = inDeskMode
    ? [{ label: 'Desk', to: '/hod' }, { label: 'Nodal Desk', to: '/hod' }, { label: 'Holiday Calendar' }]
    : [{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Holiday Calendar' }];

  return (
    <div className="page space-y-4">
      <PageHeader breadcrumbs={breadcrumbs} title="Holiday Calendar" />

      <div className="flex flex-wrap gap-2 items-center">
        <select value={year} onChange={(e) => setYear(+e.target.value)} className="form-select w-28">
          {yearOptions(currentYear).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        {([
          ['ALL', `All (${items.length})`],
          ['GAZETTED', `Closed (${closedCount})`],
          ['RESTRICTED', `Restricted (${rhCount})`],
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

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="card overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-slate-500">Loading holidays…</p>
        ) : items.length === 0 ? (
          <div className="p-6 text-sm text-slate-600 space-y-2">
            <p>No holidays are loaded for {year}.</p>
            <p className="text-slate-500">
              {canManageHolidays ? (
                <>
                  Add holidays under{' '}
                  <Link to="/masters?tab=holidays" className="font-semibold text-indigo-600 hover:underline">
                    Masters → Holidays
                  </Link>
                  .
                </>
              ) : (
                'Ask your Super Admin to configure the holiday list for this year.'
              )}
            </p>
          </div>
        ) : visible.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No holidays match this filter for {year}.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Holiday</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((h) => (
                <tr key={h.id}>
                  <td className="whitespace-nowrap font-medium">{h.holiday_date}</td>
                  <td>{h.holiday_name}</td>
                  <td>
                    <span className={`badge ${h.holiday_type === 'GAZETTED' ? 'badge-blue' : 'badge-amber'}`}>
                      {holidayTypeLabel(h.holiday_type)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Closed holidays are institution-wide offs. Restricted holidays (RH) are optional — staff may avail up to the institutional limit.
      </p>
    </div>
  );
}
