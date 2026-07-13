import { PageHeader } from '../components/PageHeader';

const PERF_ROWS = [
  { item: 'APAR cycle', value: '—' },
  { item: 'Training entries', value: '0' },
] as const;

export default function PerformanceDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Performance' }]}
        hideTitle
      />
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Performance snapshot</span>
        </div>
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              <th>Item</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {PERF_ROWS.map((row) => (
              <tr key={row.item}>
                <td className="font-medium">{row.item}</td>
                <td className="text-slate-500">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
