import { describe, expect, it } from 'vitest';

import { filterEmailInput, filterName, ifscValidationMessage, mapCaretThroughFilter, roundLeaveDays } from '../utils/employeeForm';

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

  it('preserves caret position through uppercase filter', () => {
    expect(mapCaretThroughFilter('hello', 3, (v) => v.toUpperCase())).toBe(3);
    expect(mapCaretThroughFilter('Jo@hn', 4, filterName)).toBe(3);
  });

  it('rounds leave day suggestions to whole numbers', () => {
    expect(roundLeaveDays(12.5)).toBe(13);
    expect(roundLeaveDays(15)).toBe(15);
  });
});
