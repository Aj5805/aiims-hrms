export type LeaveBalanceRow = {
  leave_type_code: string;
  leave_type_id?: string;
  leave_year: number;
  closing_balance: number | string;
  leave_type_name?: string;
};

/** Calendar-year leave bucket (matches backend `leave_year_for_date`). */
export function currentLeaveYear(asOf: Date = new Date()): number {
  return asOf.getFullYear();
}

export function balancesForLeaveYear<T extends { leave_year: number }>(
  raw: T[],
  year: number = currentLeaveYear(),
): T[] {
  return raw.filter((row) => row.leave_year === year);
}

export function dedupeLatestPerLeaveType<T extends { leave_type_code: string; leave_year: number }>(
  raw: T[],
  maxYear: number = currentLeaveYear(),
): T[] {
  const latest = new Map<string, T>();
  raw.forEach((row) => {
    if (row.leave_year > maxYear) return;
    const existing = latest.get(row.leave_type_code);
    if (!existing || row.leave_year > existing.leave_year) {
      latest.set(row.leave_type_code, row);
    }
  });
  return Array.from(latest.values());
}

export function balanceLink(leaveTypeCode: string): string {
  return `/leave-account?ledger=${encodeURIComponent(leaveTypeCode)}`;
}

/** Desk route — full leave ledger for a mapped staff member (HOD / Nodal Officer). */
export function staffLedgerLink(employeeId?: string, year?: number): string {
  const params = new URLSearchParams();
  if (employeeId) params.set('employee', employeeId);
  if (year) params.set('year', String(year));
  const query = params.toString();
  return query ? `/staff-ledger?${query}` : '/staff-ledger';
}
