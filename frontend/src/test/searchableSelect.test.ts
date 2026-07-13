import { describe, expect, it } from 'vitest';
import type { SearchableOption } from '../components/SearchableSelect';

function filterOptions(options: SearchableOption[], query: string): SearchableOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return options;
  return options.filter((o) => {
    const haystack = `${o.label} ${o.sublabel ?? ''} ${o.searchText ?? ''}`.toLowerCase();
    return haystack.includes(q);
  });
}

describe('searchable select filtering', () => {
  const options: SearchableOption[] = [
    { value: '1', label: 'ADM001 — Alice', searchText: 'active' },
    { value: '2', label: 'FAC002 — Bob', sublabel: 'Professor · Medicine' },
  ];

  it('returns all options when query is empty', () => {
    expect(filterOptions(options, '')).toHaveLength(2);
  });

  it('matches staff number in label', () => {
    expect(filterOptions(options, 'adm001')).toHaveLength(1);
    expect(filterOptions(options, 'adm001')[0].value).toBe('1');
  });

  it('matches sublabel text', () => {
    expect(filterOptions(options, 'medicine')).toHaveLength(1);
    expect(filterOptions(options, 'medicine')[0].value).toBe('2');
  });
});
