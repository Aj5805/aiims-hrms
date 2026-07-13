import { PageHeader } from '../components/PageHeader';

const CLAIM_ROWS = [
  { type: 'LTC', status: '—', last: '—' },
  { type: 'CEA', status: '—', last: '—' },
  { type: 'EHS', status: '—', last: '—' },
  { type: 'TA / DA', status: '—', last: '—' },
  { type: 'Telephone', status: '—', last: '—' },
] as const;

export default function ClaimsDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances' }]}
        hideTitle
      />
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Claims summary</span>
          <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">0 pending</span>
        </div>
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              <th>Type</th>
              <th>Status</th>
              <th>Last submitted</th>
            </tr>
          </thead>
          <tbody>
            {CLAIM_ROWS.map((row) => (
              <tr key={row.type}>
                <td className="font-medium">{row.type}</td>
                <td>{row.status}</td>
                <td className="text-slate-500">{row.last}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
