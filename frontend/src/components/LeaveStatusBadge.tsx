export function LeaveStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    DRAFT: 'badge-slate',
    SUBMITTED: 'badge-blue',
    UNDER_REVIEW: 'badge-amber',
    APPROVED: 'badge-green',
    REJECTED: 'badge-red',
    WITHDRAWN: 'badge-slate',
    RECALLED: 'badge-purple',
    CANCELLED: 'badge-red',
  };
  return <span className={`badge ${cls[status] || 'badge-slate'}`}>{status}</span>;
}
