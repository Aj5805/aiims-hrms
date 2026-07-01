export interface AddressParts {
  flat: string;
  street: string;
  city: string;
  state: string;
  pin: string;
}

export const EMPTY_ADDRESS: AddressParts = {
  flat: '',
  street: '',
  city: '',
  state: '',
  pin: '',
};

export const INDIAN_STATES = [
  'ANDAMAN AND NICOBAR ISLANDS',
  'ANDHRA PRADESH',
  'ARUNACHAL PRADESH',
  'ASSAM',
  'BIHAR',
  'CHANDIGARH',
  'CHHATTISGARH',
  'DADRA AND NAGAR HAVELI AND DAMAN AND DIU',
  'DELHI',
  'GOA',
  'GUJARAT',
  'HARYANA',
  'HIMACHAL PRADESH',
  'JAMMU AND KASHMIR',
  'JHARKHAND',
  'KARNATAKA',
  'KERALA',
  'LADAKH',
  'LAKSHADWEEP',
  'MADHYA PRADESH',
  'MAHARASHTRA',
  'MANIPUR',
  'MEGHALAYA',
  'MIZORAM',
  'NAGALAND',
  'ODISHA',
  'PUDUCHERRY',
  'PUNJAB',
  'RAJASTHAN',
  'SIKKIM',
  'TAMIL NADU',
  'TELANGANA',
  'TRIPURA',
  'UTTAR PRADESH',
  'UTTARAKHAND',
  'WEST BENGAL',
] as const;

const ADDRESS_KEYS: (keyof AddressParts)[] = ['flat', 'street', 'city', 'state', 'pin'];

/** Strip invalid email characters; allow at most one @ while typing. */
export function filterEmailInput(value: string): string {
  const cleaned = value.replace(/[^\w.@+-]/gi, '');
  const at = cleaned.indexOf('@');
  if (at === -1) return cleaned;
  return cleaned.slice(0, at + 1) + cleaned.slice(at + 1).replace(/@/g, '');
}

export function upperText(value: string): string {
  return value.toUpperCase();
}

export function filterName(value: string): string {
  return upperText(value.replace(/[^A-Za-z\s.]/g, ''));
}

export function filterAlphanumUpper(value: string, maxLen: number): string {
  return upperText(value.replace(/[^A-Za-z0-9]/g, '')).slice(0, maxLen);
}

export function filterDigits(value: string, maxLen: number): string {
  return value.replace(/\D/g, '').slice(0, maxLen);
}

export function serializeAddress(parts: AddressParts): string {
  const payload: AddressParts = {
    flat: upperText(parts.flat),
    street: upperText(parts.street),
    city: upperText(parts.city),
    state: upperText(parts.state),
    pin: filterDigits(parts.pin, 6),
  };
  if (!ADDRESS_KEYS.some((k) => k === 'pin' ? payload.pin : payload[k])) {
    return '';
  }
  return JSON.stringify(payload);
}

export function parseAddress(raw: string | null | undefined): AddressParts {
  if (!raw?.trim()) return { ...EMPTY_ADDRESS };
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    try {
      const data = JSON.parse(trimmed) as Partial<AddressParts>;
      return {
        flat: data.flat || '',
        street: data.street || '',
        city: data.city || '',
        state: data.state || '',
        pin: data.pin || '',
      };
    } catch {
      return { flat: trimmed, street: '', city: '', state: '', pin: '' };
    }
  }
  return { flat: trimmed, street: '', city: '', state: '', pin: '' };
}

export function formatAddressDisplay(raw: string | null | undefined): string {
  const parts = parseAddress(raw);
  const lines = [
    parts.flat,
    parts.street,
    [parts.city, parts.state].filter(Boolean).join(', '),
    parts.pin ? `PIN ${parts.pin}` : '',
  ].filter(Boolean);
  return lines.join(' · ') || '—';
}

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v) return true;
  const atParts = v.split('@');
  if (atParts.length !== 2) return false;
  const [local, domain] = atParts;
  if (!local || !domain || domain.includes('@')) return false;
  const dot = domain.indexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

/** Returns ISO date string or empty if the calendar date is invalid. */
export function normalizeIsoDate(value: string): string {
  if (!value) return '';
  const parsed = parseIsoDate(value);
  return parsed ? value : '';
}

export function isValidIsoDateString(value: string): boolean {
  if (!value) return true;
  return parseIsoDate(value) !== null;
}

export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

export interface DateValidationResult {
  ok: boolean;
  message?: string;
}

export function validateEmployeeDates(input: {
  dob?: string;
  doj?: string;
  next_increment_date?: string;
}): DateValidationResult {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dob = input.dob ? parseIsoDate(input.dob) : null;
  const doj = input.doj ? parseIsoDate(input.doj) : null;
  const nextInc = input.next_increment_date ? parseIsoDate(input.next_increment_date) : null;

  if (input.dob && !dob) return { ok: false, message: 'Date of birth is not a valid calendar date.' };
  if (input.doj && !doj) return { ok: false, message: 'Date of joining is not a valid calendar date.' };
  if (input.next_increment_date && !nextInc) {
    return { ok: false, message: 'Next increment date is not a valid calendar date.' };
  }

  if (dob && dob > today) return { ok: false, message: 'Date of birth cannot be in the future.' };
  if (doj && doj > today) return { ok: false, message: 'Date of joining cannot be in the future.' };
  if (dob && doj && dob >= doj) {
    return { ok: false, message: 'Date of birth must be before date of joining.' };
  }
  if (doj && nextInc && nextInc < doj) {
    return { ok: false, message: 'Next increment cannot be before date of joining.' };
  }

  return { ok: true };
}

export function validateAddressParts(parts: AddressParts, label: string): string | null {
  if (parts.pin && parts.pin.length !== 6) {
    return `${label}: PIN must be exactly 6 digits.`;
  }
  const hasContent = ADDRESS_KEYS.some((k) => (k === 'pin' ? parts.pin : parts[k]));
  if (!hasContent) return null;
  if (!parts.city.trim()) return `${label}: Village/Town/City is required when address is entered.`;
  if (!parts.state.trim()) return `${label}: State is required when address is entered.`;
  return null;
}

export function isValidPan(value: string): boolean {
  if (!value) return true;
  return /^[A-Z]{5}\d{4}[A-Z]$/.test(value);
}

export function isValidIfsc(value: string): boolean {
  if (!value) return true;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value);
}

export function isValidMobile(value: string): boolean {
  if (!value) return true;
  return /^\d{10}$/.test(value);
}
