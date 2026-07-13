import type { ChangeEvent } from 'react';

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

export const MARITAL_STATUS_OPTIONS = ['SINGLE', 'MARRIED', 'WIDOWED', 'DIVORCED'] as const;
export const BLOOD_GROUP_OPTIONS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] as const;
export const CASTE_CATEGORY_OPTIONS = ['GEN', 'OBC', 'SC', 'ST', 'EWS'] as const;

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

/** Map a caret position through a filter so selection stays stable after transforms. */
export function mapCaretThroughFilter(
  raw: string,
  caret: number,
  filter: (value: string) => string,
): number {
  if (caret <= 0) return 0;
  return filter(raw.slice(0, caret)).length;
}

/** Apply a filter on change while preserving the text cursor position. */
export function commitFilteredInputChange(
  e: ChangeEvent<HTMLInputElement>,
  filter: (value: string) => string,
  commit: (filtered: string) => void,
): void {
  const el = e.target;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const filtered = filter(el.value);
  const newStart = mapCaretThroughFilter(el.value, start, filter);
  const newEnd = mapCaretThroughFilter(el.value, end, filter);
  commit(filtered);
  requestAnimationFrame(() => {
    if (document.activeElement === el) {
      el.setSelectionRange(newStart, newEnd);
    }
  });
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
  return emailValidationMessage(value) === null;
}

export function emailValidationMessage(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const atParts = v.split('@');
  if (atParts.length !== 2) {
    return 'Email must have exactly one @ and at least one . in the domain.';
  }
  const [local, domain] = atParts;
  if (!local || !domain || domain.includes('@')) {
    return 'Email must have exactly one @ and at least one . in the domain.';
  }
  const dot = domain.indexOf('.');
  if (dot <= 0 || dot >= domain.length - 1) {
    return 'Email must have exactly one @ and at least one . in the domain.';
  }
  return null;
}

export const MIN_DATE_YEAR = 1900;
export const MAX_DATE_YEAR = 2099;
export const ISO_DATE_MIN = '1900-01-01';
export const ISO_DATE_MAX = '2099-12-31';

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True when the string is exactly YYYY-MM-DD (not necessarily a valid calendar date). */
export function isCompleteIsoDateString(value: string): boolean {
  return ISO_DATE_RE.test(value);
}

/** Strip to digits and insert dashes while typing (max 8 digits → YYYY-MM-DD). */
export function formatIsoDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
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

export function isoDateValidationMessage(value: string): string | null {
  if (!value) return null;
  if (!ISO_DATE_RE.test(value)) {
    return 'Date must be in YYYY-MM-DD format.';
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (year < MIN_DATE_YEAR || year > MAX_DATE_YEAR) {
    return `Year must be between ${MIN_DATE_YEAR} and ${MAX_DATE_YEAR}.`;
  }
  if (month < 1 || month > 12) {
    return 'Month must be between 01 and 12.';
  }
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return 'Not a valid calendar date (e.g. 30 Feb is not allowed).';
  }
  return null;
}

export function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  return isoDateValidationMessage(value) === null ? new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  ) : null;
}

export interface DateValidationResult {
  ok: boolean;
  message?: string;
}

/** Jul 2–Dec 31 and 1 Jan → July increment cycle. */
function isJulyIncrementCycle(month: number, day: number): boolean {
  if (month === 1 && day === 1) return true;
  if (month === 7 && day >= 2) return true;
  return month >= 8;
}

/**
 * Government increment cycle: DOJ Jul 2–Jan 1 → upcoming 1 Jul; DOJ Jan 2–Jul 1 → upcoming 1 Jan.
 * Returns ISO date string or empty when DOJ is invalid/incomplete.
 */
export function suggestNextIncrementDate(dojIso: string): string {
  if (!dojIso || !isCompleteIsoDateString(dojIso) || isoDateValidationMessage(dojIso)) return '';
  const year = Number(dojIso.slice(0, 4));
  const month = Number(dojIso.slice(5, 7));
  const day = Number(dojIso.slice(8, 10));
  if (isJulyIncrementCycle(month, day)) {
    if (month === 1) return `${year}-07-01`;
    return `${year + 1}-07-01`;
  }
  return `${year + 1}-01-01`;
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

  if (input.dob && !dob) {
    return { ok: false, message: `Date of birth: ${isoDateValidationMessage(input.dob) ?? 'invalid date.'}` };
  }
  if (input.doj && !doj) {
    return { ok: false, message: `Date of joining: ${isoDateValidationMessage(input.doj) ?? 'invalid date.'}` };
  }
  if (input.next_increment_date && !nextInc) {
    return {
      ok: false,
      message: `Next increment date: ${isoDateValidationMessage(input.next_increment_date) ?? 'invalid date.'}`,
    };
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

export function filterPanInput(value: string): string {
  return upperText(value.replace(/[^A-Za-z0-9]/g, '')).slice(0, 10);
}

export function isValidPan(value: string): boolean {
  return panValidationMessage(value) === null;
}

export function panValidationMessage(value: string): string | null {
  if (!value) return null;
  if (value.length !== 10) {
    return 'PAN must be exactly 10 characters (e.g. ABCDE1234F).';
  }
  if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(value)) {
    return 'PAN must be in format ABCDE1234F (5 letters, 4 digits, 1 letter).';
  }
  return null;
}

/** Strip spaces/special chars; auto-correct letter O in 5th position to zero. */
export function filterIfscInput(value: string): string {
  let code = upperText(value.replace(/[^A-Za-z0-9]/g, '')).slice(0, 11);
  if (code.length >= 5 && code[4] === 'O') {
    code = `${code.slice(0, 4)}0${code.slice(5)}`;
  }
  return code;
}

export function isValidIfsc(value: string): boolean {
  return ifscValidationMessage(value) === null;
}

export function ifscValidationMessage(value: string): string | null {
  const code = filterIfscInput(value);
  if (!code) return null;
  if (code.length !== 11) {
    return 'IFSC must be exactly 11 characters (e.g. SBIN0001234).';
  }
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
    return 'IFSC format: 4-letter bank code + 0 + 6-character branch code.';
  }
  return null;
}

export function filterBankAccountInput(value: string): string {
  return filterDigits(value, 18);
}

export function isValidBankAccount(value: string): boolean {
  return bankAccountValidationMessage(value) === null;
}

export function bankAccountValidationMessage(value: string): string | null {
  if (!value) return null;
  if (!/^\d+$/.test(value)) {
    return 'Bank account must contain numbers only (no spaces).';
  }
  if (value.length < 9 || value.length > 18) {
    return 'Bank account must be 9–18 digits.';
  }
  return null;
}

/** Display / report format: DD-MM-YYYY from ISO YYYY-MM-DD. */
export function formatIndianDate(iso: string): string {
  if (!iso || !isCompleteIsoDateString(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y}`;
}

/** Whole-day leave credits for onboarding display and defaults (no fractional days). */
export function roundLeaveDays(value: number): number {
  return Math.round(value);
}

export function isValidMobile(value: string): boolean {
  if (!value) return true;
  return /^\d{10}$/.test(value);
}

export interface RegistrationValidationInput {
  email?: string;
  personal_email?: string;
  mobile?: string;
  alt_mobile?: string;
  pan?: string;
  aadhaar?: string;
  nps_or_gpf_no?: string;
  pfms_code?: string;
  bank_account_no?: string;
  ifsc_code?: string;
  permanentAddress?: AddressParts;
  presentAddress?: AddressParts;
  dob?: string;
  doj?: string;
  next_increment_date?: string;
  /** When false, skip IDs & banking field checks (self-service edit). */
  includeIdsAndBanking?: boolean;
  /** When false, skip DOB/DOJ/next-increment checks. */
  includeDates?: boolean;
  /** When false, skip address checks. */
  includeAddress?: boolean;
}

/** Shared client-side validation for onboarding and profile edit. */
export function validateRegistrationFields(input: RegistrationValidationInput): string | null {
  const emailErr = emailValidationMessage(input.email ?? '');
  if (emailErr) return emailErr;
  const altEmailErr = emailValidationMessage(input.personal_email ?? '');
  if (altEmailErr) return `Alt email: ${altEmailErr.replace('Email', 'email')}`;
  if (!isValidMobile(input.mobile ?? '')) return 'Mobile must be exactly 10 digits when entered.';
  if (!isValidMobile(input.alt_mobile ?? '')) return 'Alt mobile must be exactly 10 digits when entered.';

  if (input.includeIdsAndBanking !== false) {
    const panErr = panValidationMessage(input.pan ?? '');
    if (panErr) return panErr;
    const ifscErr = ifscValidationMessage(input.ifsc_code ?? '');
    if (ifscErr) return ifscErr;
    const bankErr = bankAccountValidationMessage(input.bank_account_no ?? '');
    if (bankErr) return bankErr;
    const aadhaar = input.aadhaar ?? '';
    if (aadhaar && aadhaar.length !== 12) return 'Aadhaar must be exactly 12 digits.';
    const nps = input.nps_or_gpf_no ?? '';
    if (nps && nps.length !== 12) return 'NPS number must be exactly 12 digits.';
    const pfms = input.pfms_code ?? '';
    if (pfms && pfms.length !== 14) return 'PFMS code must be exactly 14 characters.';
  }

  if (input.includeAddress !== false && input.permanentAddress) {
    const permErr = validateAddressParts(input.permanentAddress, 'Permanent address');
    if (permErr) return permErr;
    if (input.presentAddress) {
      const presErr = validateAddressParts(input.presentAddress, 'Present address');
      if (presErr) return presErr;
    }
  }

  if (input.includeDates !== false) {
    const dates = validateEmployeeDates({
      dob: input.dob,
      doj: input.doj,
      next_increment_date: input.next_increment_date,
    });
    if (!dates.ok) return dates.message || 'Invalid date.';
  }

  return null;
}
