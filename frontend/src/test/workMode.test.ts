import { describe, expect, it } from 'vitest';

import { canToggleWorkMode, effectiveWorkMode, homePathForWorkMode, isDeskPath, isStaffPersonalPath, isStaffPersonalView } from '../utils/workMode';

describe('workMode helpers', () => {
  it('allows desk toggle only for linked HOD/NODAL_OFFICER', () => {
    expect(canToggleWorkMode('HOD', 'emp-1')).toBe(true);
    expect(canToggleWorkMode('HOD', null)).toBe(false);
    expect(canToggleWorkMode('STAFF', 'emp-1')).toBe(false);
  });

  it('routes home by work mode', () => {
    expect(homePathForWorkMode('HOD', 'emp-1', 'desk')).toBe('/hod');
    expect(homePathForWorkMode('HOD', 'emp-1', 'staff')).toBe('/');
  });

  it('classifies staff vs desk paths', () => {
    expect(isStaffPersonalPath('/apply')).toBe(true);
    expect(isDeskPath('/reports')).toBe(true);
    expect(isDeskPath('/staff-ledger')).toBe(true);
    expect(effectiveWorkMode('ADMIN')).toBe('desk');
  });

  it('detects staff personal view for dual-role users', () => {
    expect(isStaffPersonalView('STAFF', 'emp-1', 'desk')).toBe(true);
    expect(isStaffPersonalView('NODAL_OFFICER', 'emp-1', 'staff')).toBe(true);
    expect(isStaffPersonalView('NODAL_OFFICER', 'emp-1', 'desk')).toBe(false);
    expect(isStaffPersonalView('HOD', 'emp-1', 'staff')).toBe(true);
  });
});
