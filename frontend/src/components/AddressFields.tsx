import type { ReactNode } from 'react';
import type { AddressParts } from '../utils/employeeForm';
import { filterDigits, INDIAN_STATES, upperText } from '../utils/employeeForm';

const inputCls = 'dense-field-input';
const labelCls = 'dense-field-label';

const FIELDS: { key: keyof AddressParts; label: string; pin?: boolean; state?: boolean }[] = [
  { key: 'flat', label: 'D No / H No / Flat No' },
  { key: 'street', label: 'Building / Street Name' },
  { key: 'city', label: 'Village / Town / City' },
  { key: 'state', label: 'State', state: true },
  { key: 'pin', label: 'PIN', pin: true },
];

type AddressFieldsProps = {
  permanent: AddressParts;
  present: AddressParts;
  sameAsPermanent: boolean;
  onPermanentChange: (parts: AddressParts) => void;
  onPresentChange: (parts: AddressParts) => void;
  onSameToggle: (checked: boolean) => void;
};

function updatePart(
  parts: AddressParts,
  key: keyof AddressParts,
  value: string,
  pin?: boolean,
): AddressParts {
  return {
    ...parts,
    [key]: pin ? filterDigits(value, 6) : upperText(value),
  };
}

function FieldCell({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {children}
    </div>
  );
}

function ColumnFields({
  parts,
  onChange,
  disabled,
}: {
  parts: AddressParts;
  onChange: (parts: AddressParts) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {FIELDS.map(({ key, label, pin, state }) => (
        <FieldCell key={key} label={label}>
          {state ? (
            <select
              value={parts.state}
              onChange={(e) => onChange({ ...parts, state: e.target.value })}
              disabled={disabled}
              className={`${inputCls}${disabled ? ' opacity-60' : ''}`}
            >
              <option value="">Select state…</option>
              {INDIAN_STATES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          ) : (
            <input
              value={parts[key]}
              onChange={(e) => onChange(updatePart(parts, key, e.target.value, pin))}
              disabled={disabled}
              className={`${inputCls}${disabled ? ' opacity-60' : ''}`}
              maxLength={pin ? 6 : undefined}
              placeholder={pin ? '6-digit PIN' : undefined}
              inputMode={pin ? 'numeric' : undefined}
            />
          )}
        </FieldCell>
      ))}
    </div>
  );
}

/**
 * Side-by-side columns; DOM order is permanent column then present column
 * so Tab moves vertically down permanent, then vertically down present.
 */
export default function AddressFields({
  permanent,
  present,
  sameAsPermanent,
  onPermanentChange,
  onPresentChange,
  onSameToggle,
}: AddressFieldsProps) {
  const presentParts = sameAsPermanent ? permanent : present;

  return (
    <div className="col-span-2 md:col-span-6 xl:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3 items-start">
      <div>
        <div className="mb-1.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
          Permanent Address
        </div>
        <ColumnFields parts={permanent} onChange={onPermanentChange} />
      </div>

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Present Address</span>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sameAsPermanent}
              onChange={(e) => onSameToggle(e.target.checked)}
              className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded"
            />
            <span className="text-[11px] text-slate-600">Same as permanent</span>
          </label>
        </div>
        <ColumnFields
          parts={presentParts}
          onChange={onPresentChange}
          disabled={sameAsPermanent}
        />
      </div>
    </div>
  );
}
