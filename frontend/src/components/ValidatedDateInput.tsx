import { isValidIsoDateString, normalizeIsoDate } from '../utils/employeeForm';

const inputCls = 'dense-field-input';

type ValidatedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  onInvalid?: (message: string) => void;
};

export function ValidatedDateInput({
  value,
  onChange,
  required,
  className = inputCls,
  onInvalid,
}: ValidatedDateInputProps) {
  const handleChange = (raw: string) => {
    if (!raw) {
      onChange('');
      return;
    }
    if (!isValidIsoDateString(raw)) {
      onInvalid?.('Not a valid calendar date (e.g. 30 Feb is not allowed).');
      onChange('');
      return;
    }
    onChange(normalizeIsoDate(raw));
  };

  return (
    <input
      type="date"
      required={required}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={(e) => handleChange(e.target.value)}
      className={className}
    />
  );
}
