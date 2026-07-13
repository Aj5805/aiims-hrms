import { describe, expect, it } from 'vitest';
import { balancesForLeaveYear, currentLeaveYear, dedupeLatestPerLeaveType, staffLedgerLink } from '../utils/leaveBalances';

describe('leaveBalances', () => {
  const rows = [
    { leave_type_code: 'CL', leave_year: 2025, closing_balance: 5 },
    { leave_type_code: 'CL', leave_year: 2026, closing_balance: 8 },
    { leave_type_code: 'CL', leave_year: 2027, closing_balance: 12 },
    { leave_type_code: 'EL', leave_year: 2026, closing_balance: 100 },
    { leave_type_code: 'EL', leave_year: 2027, closing_balance: 300 },
  ];

  it('filters to a single leave year', () => {
    expect(balancesForLeaveYear(rows, 2026)).toEqual([
      { leave_type_code: 'CL', leave_year: 2026, closing_balance: 8 },
      { leave_type_code: 'EL', leave_year: 2026, closing_balance: 100 },
    ]);
  });

  it('dedupes by leave type without picking a future year', () => {
    expect(dedupeLatestPerLeaveType(rows, 2026)).toEqual([
      { leave_type_code: 'CL', leave_year: 2026, closing_balance: 8 },
      { leave_type_code: 'EL', leave_year: 2026, closing_balance: 100 },
    ]);
  });

  it('uses calendar year for current leave year', () => {
    expect(currentLeaveYear(new Date('2026-07-06'))).toBe(2026);
  });

  it('builds desk staff ledger links with employee and year', () => {
    expect(staffLedgerLink()).toBe('/staff-ledger');
    expect(staffLedgerLink('emp-1')).toBe('/staff-ledger?employee=emp-1');
    expect(staffLedgerLink('emp-1', 2026)).toBe('/staff-ledger?employee=emp-1&year=2026');
  });
});
