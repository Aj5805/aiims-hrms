import { useEffect, useRef, useState } from 'react';
import {
  formatIndianDate,
  formatIsoDateInput,
  isCompleteIsoDateString,
  isValidIsoDateString,
  isoDateValidationMessage,
  ISO_DATE_MAX,
  ISO_DATE_MIN,
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

function CalendarIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

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
  const pickerRef = useRef<HTMLInputElement>(null);

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

  const handlePickerChange = (raw: string) => {
    if (!raw) return;
    setDraft(raw);
    finalize(raw);
  };

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === 'function') {
      picker.showPicker();
    } else {
      picker.focus();
      picker.click();
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

  const storedHint = value && isValidIsoDateString(value) ? formatIndianDate(value) : null;

  return (
    <div>
      <div className="relative flex items-stretch">
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
          className={`${className} flex-1 pr-9${fieldError ? ' border-red-400 ring-1 ring-red-200' : ''}`}
          aria-invalid={fieldError ? true : undefined}
        />
        <button
          type="button"
          onClick={openPicker}
          className="absolute right-0 top-0 flex h-full w-9 items-center justify-center rounded-r-md text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
          title="Open calendar"
          tabIndex={-1}
        >
          <CalendarIcon />
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={value || ''}
          min={ISO_DATE_MIN}
          max={ISO_DATE_MAX}
          onChange={(e) => handlePickerChange(e.target.value)}
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>
      {fieldError && (
        <p className="mt-0.5 text-[11px] leading-snug text-red-600" role="alert">
          {fieldError}
        </p>
      )}
      {!fieldError && storedHint && (
        <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
          Stored as {storedHint}
        </p>
      )}
    </div>
  );
}
