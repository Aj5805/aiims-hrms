import { useEffect, useRef, useState } from 'react';
import {
  formatIsoDateInput,
  isCompleteIsoDateString,
  isoDateValidationMessage,
} from '../utils/employeeForm';
import { focusNextField } from '../utils/focusNavigation';

const inputCls = 'dense-field-input';

type ValidatedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
  /** Called when invalid (message) or accepted (null). */
  onInvalid?: (message: string | null) => void;
};

export function ValidatedDateInput({
  value,
  onChange,
  required,
  className = inputCls,
  onInvalid,
}: ValidatedDateInputProps) {
  const [draft, setDraft] = useState(value);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(value);
    }
  }, [value]);

  const reject = (message: string) => {
    setFieldError(message);
    onInvalid?.(message);
    setDraft('');
    onChange('');
  };

  const accept = (raw: string) => {
    setFieldError(null);
    onInvalid?.(null);
    setDraft(raw);
    onChange(raw);
    return true;
  };

  /** Validate a complete YYYY-MM-DD string. Returns true when accepted. */
  const finalize = (raw: string): boolean => {
    if (!raw) {
      accept('');
      return true;
    }
    if (!isCompleteIsoDateString(raw)) {
      return false;
    }
    const dateError = isoDateValidationMessage(raw);
    if (dateError) {
      reject(dateError);
      return false;
    }
    accept(raw);
    return true;
  };

  const applyInput = (raw: string) => {
    const formatted = formatIsoDateInput(raw);
    setDraft(formatted);
    if (isCompleteIsoDateString(formatted)) {
      finalize(formatted);
    } else {
      setFieldError(null);
      onChange('');
    }
  };

  const handleFocus = () => {
    focusedRef.current = true;
    setFieldError(null);
  };

  const handleBlur = (raw: string) => {
    focusedRef.current = false;
    if (!raw) {
      accept('');
      return;
    }
    if (!isCompleteIsoDateString(raw)) {
      reject('Date must be in YYYY-MM-DD format.');
      return;
    }
    finalize(raw);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const raw = e.currentTarget.value;
    if (!finalize(raw)) return;
    const form = e.currentTarget.closest('form');
    focusNextField(form, e.currentTarget);
  };

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        data-date-field="true"
        required={required}
        placeholder="YYYY-MM-DD"
        maxLength={10}
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onFocus={handleFocus}
        onChange={(e) => applyInput(e.target.value)}
        onBlur={(e) => handleBlur(e.target.value)}
        onKeyDown={handleKeyDown}
        className={`${className}${fieldError ? ' border-red-400 ring-1 ring-red-200' : ''}`}
        aria-invalid={fieldError ? true : undefined}
      />
      {fieldError && (
        <p className="mt-0.5 text-[11px] leading-snug text-red-600" role="alert">
          {fieldError}
        </p>
      )}
    </div>
  );
}
