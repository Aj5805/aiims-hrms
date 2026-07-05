import { useEffect, useRef, useState } from 'react';

const inputCls = 'dense-field-input';
const codeCls = 'dense-field-input--code';

type ValidatedTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  validate: (value: string) => string | null;
  filter?: (value: string) => string;
  required?: boolean;
  className?: string;
  code?: boolean;
  onInvalid?: (message: string | null) => void;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'className'
>;

export function ValidatedTextInput({
  value,
  onChange,
  validate,
  filter,
  required,
  className,
  code,
  onInvalid,
  onBlur,
  onFocus,
  ...inputProps
}: ValidatedTextInputProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      const msg = value ? validate(value) : null;
      setFieldError(msg);
    }
  }, [value, validate]);

  const runValidation = (raw: string) => {
    if (!raw) {
      setFieldError(null);
      onInvalid?.(null);
      return;
    }
    const msg = validate(raw);
    setFieldError(msg);
    onInvalid?.(msg);
  };

  const handleChange = (raw: string) => {
    onChange(filter ? filter(raw) : raw);
    if (fieldError) {
      setFieldError(null);
      onInvalid?.(null);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    focusedRef.current = false;
    runValidation(e.target.value);
    onBlur?.(e);
  };

  const cls = `${code ? codeCls : (className || inputCls)}${fieldError ? ' border-red-400 ring-1 ring-red-200' : ''}`;

  return (
    <div>
      <input
        {...inputProps}
        required={required}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className={cls}
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
