import { useCallback, useEffect, useMemo, useState } from 'react';
import { employeesApi } from '../api/endpoints';
import { SearchableSelect, type SearchableOption } from './SearchableSelect';

type EmployeeRow = {
  id: string;
  emp_code: string;
  name: string;
  is_active?: boolean;
  department_name?: string;
  designation_name?: string;
};

type Props = {
  value: string;
  onChange: (employeeId: string) => void;
  /** When true, only active employees; when false, only inactive; omit for all. */
  activeOnly?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function EmployeeSearchSelect({
  value,
  onChange,
  activeOnly,
  placeholder = 'Type staff number or name…',
  disabled = false,
  className = '',
}: Props) {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchEmployees = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params: Record<string, string | boolean> = {
        search: search.trim(),
        limit: '200',
      };
      if (activeOnly !== undefined) params.is_active = activeOnly;
      const { data } = await employeesApi.list(params);
      setEmployees(data || []);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [activeOnly]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchEmployees(query);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, fetchEmployees]);

  const options: SearchableOption[] = useMemo(
    () =>
      employees.map((emp) => {
        const meta = [emp.designation_name, emp.department_name].filter(Boolean).join(' · ');
        const status = emp.is_active === false ? 'inactive' : '';
        return {
          value: emp.id,
          label: `${emp.emp_code} — ${emp.name}`,
          sublabel: meta || undefined,
          searchText: `${emp.emp_code} ${emp.name} ${meta} ${status}`.trim(),
        };
      }),
    [employees],
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      emptyMessage="No matching employees"
      className={className}
      onQueryChange={setQuery}
    />
  );
}
