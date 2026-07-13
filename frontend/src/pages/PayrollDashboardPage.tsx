import { PageHeader } from '../components/PageHeader';

const PAYROLL_ROWS = [
  { item: 'Latest salary slip', value: '—' },
  { item: 'FY summary', value: '—' },
  { item: 'Form 16', value: '—' },
] as const;

export default function PayrollDashboardPage() {
  return (
    <div className="page">
      <PageHeader
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance' }]}
        hideTitle
      />
      <div className="card overflow-hidden">
        <div className="card-header">
          <span className="card-title">Payroll snapshot</span>
        </div>
        <table className="data-table data-table-compact">
          <thead>
            <tr>
              <th>Item</th>
              <th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {PAYROLL_ROWS.map((row) => (
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
