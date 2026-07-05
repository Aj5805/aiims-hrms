import { describe, expect, it } from 'vitest';

import { filterEmailInput, filterName, ifscValidationMessage } from '../utils/employeeForm';

describe('employeeForm helpers', () => {
  it('filters email to one @ symbol', () => {
    expect(filterEmailInput('a@@b.com')).toBe('a@b.com');
  });

  it('uppercases and strips invalid name chars', () => {
    expect(filterName('dr. ananya123')).toBe('DR. ANANYA');
  });

  it('validates IFSC length and format', () => {
    expect(ifscValidationMessage('SBIN0001234')).toBeNull();
    expect(ifscValidationMessage('SHORT')).toContain('11 characters');
  });
});
