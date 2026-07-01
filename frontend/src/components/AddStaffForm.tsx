import React, { useState, useEffect, useRef } from 'react';
import { employeesApi, departmentsApi, designationsApi } from '../api/endpoints';
import { formatApiError } from '../constants/roles';
import { useAuthStore } from '../stores';
import AddressFields from './AddressFields';
import { ValidatedDateInput } from './ValidatedDateInput';
import {
  type AddressParts,
  EMPTY_ADDRESS,
  filterAlphanumUpper,
  filterDigits,
  filterEmailInput,
  filterName,
  isValidEmail,
  isValidIfsc,
  isValidMobile,
  isValidPan,
  serializeAddress,
  upperText,
  validateAddressParts,
  validateEmployeeDates,
} from '../utils/employeeForm';
import { handleFormEnterKey } from '../utils/focusNavigation';

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Designation {
  id: string;
  name: string;
  category_code: string;
  grade_pay_level?: string | null;
}

interface StaffGroupOption {
  code: string;
  label: string;
}

interface AddStaffFormProps {
  onSaved: (employeeId?: string) => void;
  onCancel: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const INITIALS = ['', 'Dr.', 'Shri.', 'Smt.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'] as const;
const PAY_GROUPS = ['A', 'B', 'C'] as const;

const EMPTY_FORM = {
  emp_code: '',
  name: '',
  initial: '',
  gender: 'MALE',
  dob: '',
  father_name: '',
  marital_status: '',
  blood_group: '',
  caste_category: '',
  religion: '',
  is_physically_handicapped: false,
  mobile: '',
  alt_mobile: '',
  email: '',
  personal_email: '',
  doj: '',
  next_increment_date: '',
  department_code: '',
  designation_name: '',
  staff_group: '',
  grade: '',
  pay_level: '',
  last_qualification: '',
  pan: '',
  aadhaar: '',
  nps_or_gpf_no: '',
  pfms_code: '',
  bank_account_no: '',
  bank_name: '',
  ifsc_code: '',
};

const COL = {
  1: 'col-span-1 md:col-span-1 xl:col-span-1',
  2: 'col-span-1 md:col-span-1 xl:col-span-2',
  3: 'col-span-2 md:col-span-2 xl:col-span-3',
  4: 'col-span-2 md:col-span-2 xl:col-span-4',
  5: 'col-span-2 md:col-span-3 xl:col-span-5',
  6: 'col-span-2 md:col-span-3 xl:col-span-6',
  7: 'col-span-2 md:col-span-4 xl:col-span-7',
  8: 'col-span-2 md:col-span-4 xl:col-span-8',
  9: 'col-span-2 md:col-span-6 xl:col-span-9',
  12: 'col-span-2 md:col-span-6 xl:col-span-12',
} as const;

type ColSpan = keyof typeof COL;

const inputCls = 'dense-field-input';
const codeCls = 'dense-field-input--code';
const labelCls = 'dense-field-label';

function Section({ title }: { title: string }) {
  return (
    <div className="dense-form-section">
      <span className="dense-form-section-label">{title}</span>
      <div className="dense-form-section-line" />
    </div>
  );
}

function Field({
  label,
  required,
  cols = 3,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  cols?: ColSpan;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={COL[cols]}>
      <label className={labelCls}>
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">{hint}</p>}
    </div>
  );
}

function emptyToNull<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === '' || v === undefined) {
      if (typeof v === 'boolean') out[k] = v;
      else out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export default function AddStaffForm({ onSaved, onCancel, onDirtyChange }: AddStaffFormProps) {
  const token = useAuthStore((s) => s.token);
  const userRole = useAuthStore((s) => s.user?.role);
  const dirtyRef = useRef(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [staffGroups, setStaffGroups] = useState<StaffGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [permanentAddress, setPermanentAddress] = useState<AddressParts>({ ...EMPTY_ADDRESS });
  const [presentAddress, setPresentAddress] = useState<AddressParts>({ ...EMPTY_ADDRESS });
  const [manualEmpCode, setManualEmpCode] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [presentSameAsPermanent, setPresentSameAsPermanent] = useState(false);

  const markDirty = () => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      onDirtyChange?.(true);
    }
  };

  const set = (key: keyof typeof EMPTY_FORM, value: string | boolean) => {
    markDirty();
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setText = (key: keyof typeof EMPTY_FORM, value: string) => {
    markDirty();
    setForm((prev) => ({ ...prev, [key]: upperText(value) }));
  };

  useEffect(() => {
    if (!token) return;
    const fetchData = async () => {
      try {
        const [deptRes, desigRes, groupsRes] = await Promise.all([
          departmentsApi.list(),
          designationsApi.list(),
          employeesApi.staffGroups(),
        ]);
        setDepartments(deptRes.data || []);
        setDesignations(desigRes.data || []);
        setStaffGroups(groupsRes.data || []);
      } catch (err: unknown) {
        const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
        setError(formatApiError(data?.detail) || 'Failed to load master data.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  const selectedDesig = designations.find((d) => d.name === form.designation_name);

  const refreshStaffGroupSuggestion = async (
    designationName: string,
    departmentCode: string,
    categoryCode?: string,
  ) => {
    if (!designationName || !departmentCode) return;
    try {
      const { data } = await employeesApi.suggestStaffGroup({
        designation_name: designationName,
        department_code: departmentCode,
        category_code: categoryCode,
      });
      if (data?.staff_group) {
        setForm((prev) => ({ ...prev, staff_group: data.staff_group }));
      }
    } catch {
      // optional
    }
  };

  const refreshPreviewCode = async (staffGroup: string) => {
    if (manualEmpCode || !staffGroup) return;
    setPreviewLoading(true);
    try {
      const { data } = await employeesApi.nextStaffNumber(staffGroup);
      const next = data?.next_emp_code || '';
      setPreviewCode(next);
      setForm((prev) => ({ ...prev, emp_code: next }));
    } catch {
      setPreviewCode('');
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (manualEmpCode || !form.staff_group) {
      if (!form.staff_group) setPreviewCode('');
      return;
    }
    void refreshPreviewCode(form.staff_group);
  }, [manualEmpCode, form.staff_group]);

  const handleDesignationChange = async (name: string) => {
    markDirty();
    const desig = designations.find((d) => d.name === name);
    setForm((prev) => ({
      ...prev,
      designation_name: name,
      pay_level: desig?.grade_pay_level || prev.pay_level,
    }));
    if (desig && form.department_code) {
      await refreshStaffGroupSuggestion(name, form.department_code, desig.category_code);
    }
  };

  const handleDepartmentChange = async (code: string) => {
    markDirty();
    setForm((prev) => ({ ...prev, department_code: code }));
    if (form.designation_name && code) {
      await refreshStaffGroupSuggestion(form.designation_name, code, selectedDesig?.category_code);
    }
  };

  const handlePermanentAddressChange = (parts: AddressParts) => {
    markDirty();
    setPermanentAddress(parts);
    if (presentSameAsPermanent) setPresentAddress(parts);
  };

  const handlePresentSameToggle = (checked: boolean) => {
    markDirty();
    setPresentSameAsPermanent(checked);
    if (checked) setPresentAddress(permanentAddress);
  };

  const validateForm = (): string | null => {
    if (!isValidEmail(form.email)) return 'Email must have exactly one @ and at least one . in the domain.';
    if (!isValidEmail(form.personal_email)) return 'Alt email must have exactly one @ and at least one . in the domain.';
    if (!isValidMobile(form.mobile)) return 'Mobile must be exactly 10 digits when entered.';
    if (!isValidMobile(form.alt_mobile)) return 'Alt mobile must be exactly 10 digits when entered.';
    if (!isValidPan(form.pan)) return 'PAN must be in format ABCDE1234F.';
    if (!isValidIfsc(form.ifsc_code)) return 'IFSC must be 11 characters (e.g. SBIN0001234).';
    if (form.aadhaar && form.aadhaar.length !== 12) return 'Aadhaar must be exactly 12 digits.';
    if (form.nps_or_gpf_no && form.nps_or_gpf_no.length !== 12) return 'NPS number must be exactly 12 digits.';
    if (form.pfms_code && form.pfms_code.length !== 14) return 'PFMS code must be exactly 14 characters.';

    const permErr = validateAddressParts(permanentAddress, 'Permanent address');
    if (permErr) return permErr;
    const presentParts = presentSameAsPermanent ? permanentAddress : presentAddress;
    const presErr = validateAddressParts(presentParts, 'Present address');
    if (presErr) return presErr;

    const dates = validateEmployeeDates({
      dob: form.dob,
      doj: form.doj,
      next_increment_date: form.next_increment_date,
    });
    if (!dates.ok) return dates.message || 'Invalid date.';

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSaving(false);
      return;
    }

    const category_code = selectedDesig?.category_code || '';
    if (!category_code) {
      setError('Please select a valid designation');
      setSaving(false);
      return;
    }
    if (!form.staff_group) {
      setError('Please select a staff group for employee number allotment');
      setSaving(false);
      return;
    }

    const presentParts = presentSameAsPermanent ? permanentAddress : presentAddress;

    try {
      const payload: Record<string, unknown> = {
        ...emptyToNull({
          ...form,
          permanent_address: serializeAddress(permanentAddress),
          address: serializeAddress(presentParts),
        }),
        category_code,
        has_institutional_email: false,
        is_physically_handicapped: form.is_physically_handicapped,
      };
      if (!manualEmpCode) delete payload.emp_code;

      const { data } = await employeesApi.create(payload);
      dirtyRef.current = false;
      onDirtyChange?.(false);
      onSaved(data?.id);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
      setError(formatApiError(data?.detail) || 'Failed to create employee');
      setSaving(false);
    }
  };

  const showDateError = (message: string | null) => setError(message ?? '');

  if (loading) return <div className="py-6 text-center text-slate-500 text-sm">Loading master data…</div>;

  return (
    <div>
      {error && (
        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded text-xs">{error}</div>
      )}

      {!error && !loading && departments.length === 0 && ['NODAL_OFFICER', 'NODAL_OFFICE'].includes(userRole ?? '') && (
        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 text-amber-800 rounded text-xs">
          No departments assigned to your nodal account. Ask an admin to link departments before onboarding staff.
        </div>
      )}

      <p className="text-xs text-slate-500 mb-3 leading-relaxed">
        Staff numbers use a group prefix and 4-digit sequence (e.g. FAC0001, NUR0002). The number stays with the employee for life.
      </p>

      <form
        onSubmit={handleSubmit}
        onKeyDown={(e) => handleFormEnterKey(e, e.currentTarget)}
      >
        <div className="dense-form">
          <Section title="Personal Identity" />
          <Field label="Initial" cols={2}>
            <select autoFocus value={form.initial} onChange={(e) => set('initial', e.target.value)} className={inputCls}>
              {INITIALS.map((opt) => (
                <option key={opt || 'none'} value={opt}>{opt || '—'}</option>
              ))}
            </select>
          </Field>
          <Field label="Full Name" required cols={6}>
            <input required value={form.name} onChange={(e) => set('name', filterName(e.target.value))} className={inputCls} />
          </Field>
          <Field label="Father's Name" cols={4}>
            <input value={form.father_name} onChange={(e) => setText('father_name', e.target.value.replace(/[^A-Za-z\s.]/g, ''))} className={inputCls} />
          </Field>
          <Field label="Date of Birth" cols={3}>
            <ValidatedDateInput value={form.dob} onChange={(v) => set('dob', v)} onInvalid={showDateError} />
          </Field>
          <Field label="Gender" required cols={2}>
            <select required value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="Marital Status" cols={2}>
            <select value={form.marital_status} onChange={(e) => set('marital_status', e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="SINGLE">Single</option>
              <option value="MARRIED">Married</option>
              <option value="WIDOWED">Widowed</option>
              <option value="DIVORCED">Divorced</option>
            </select>
          </Field>
          <Field label="Religion" cols={3}>
            <input value={form.religion} onChange={(e) => setText('religion', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Caste Category" cols={2}>
            <select value={form.caste_category} onChange={(e) => set('caste_category', e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="GEN">General</option>
              <option value="OBC">OBC</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="EWS">EWS</option>
            </select>
          </Field>
          <Field label="Blood Group" cols={2}>
            <select value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                <option key={bg} value={bg}>{bg}</option>
              ))}
            </select>
          </Field>
          <Field label="PwD" cols={2}>
            <label className="flex items-center gap-2 h-[34px] cursor-pointer">
              <input type="checkbox" checked={form.is_physically_handicapped} onChange={(e) => set('is_physically_handicapped', e.target.checked)} className="h-4 w-4 text-indigo-600 border-slate-300 rounded" />
              <span className="text-xs text-slate-600">Yes</span>
            </label>
          </Field>

          <Section title="Address & Contact" />
          <AddressFields
            permanent={permanentAddress}
            present={presentAddress}
            sameAsPermanent={presentSameAsPermanent}
            onPermanentChange={handlePermanentAddressChange}
            onPresentChange={(parts) => { markDirty(); setPresentAddress(parts); }}
            onSameToggle={handlePresentSameToggle}
          />
          <Field label="Mobile" cols={3}>
            <input type="tel" inputMode="numeric" autoComplete="tel" value={form.mobile} onChange={(e) => set('mobile', filterDigits(e.target.value, 10))} className={codeCls} placeholder="10-digit" maxLength={10} />
          </Field>
          <Field label="Alt Mobile" cols={3}>
            <input type="tel" inputMode="numeric" value={form.alt_mobile} onChange={(e) => set('alt_mobile', filterDigits(e.target.value, 10))} className={codeCls} maxLength={10} />
          </Field>
          <Field label="Email" cols={3}>
            <input type="email" autoComplete="email" value={form.email} onChange={(e) => set('email', filterEmailInput(e.target.value))} className={inputCls} placeholder="name@aiims.edu" />
          </Field>
          <Field label="Alt Email" cols={3}>
            <input type="email" autoComplete="email" value={form.personal_email} onChange={(e) => set('personal_email', filterEmailInput(e.target.value))} className={inputCls} placeholder="personal@email.com" />
          </Field>

          <Section title="Employment" />
          <Field label="Department" required cols={6}>
            <select required value={form.department_code} onChange={(e) => void handleDepartmentChange(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.code}>{d.name} ({d.code})</option>
              ))}
            </select>
          </Field>
          <Field label="Designation" required cols={6}>
            <select required value={form.designation_name} onChange={(e) => void handleDesignationChange(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {designations.map((d) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            {selectedDesig && <p className="mt-0.5 text-[11px] text-indigo-600 font-medium">{selectedDesig.category_code}</p>}
          </Field>
          <Field label="Staff Group" required cols={4}>
            <select required value={form.staff_group} onChange={(e) => set('staff_group', e.target.value)} className={inputCls}>
              <option value="">Select staff group…</option>
              {staffGroups.map((g) => (
                <option key={g.code} value={g.code}>{g.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Staff Number" required cols={4}>
            <input
              required
              readOnly={!manualEmpCode}
              tabIndex={manualEmpCode ? 0 : -1}
              value={manualEmpCode ? form.emp_code : (previewCode || form.emp_code)}
              onChange={(e) => set('emp_code', upperText(e.target.value))}
              className={codeCls}
              placeholder={previewLoading ? 'Loading…' : form.staff_group ? 'Auto-assigned' : 'Select staff group first'}
            />
            <label className="mt-1 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={manualEmpCode}
                onChange={(e) => {
                  markDirty();
                  const checked = e.target.checked;
                  setManualEmpCode(checked);
                  if (!checked && form.staff_group) void refreshPreviewCode(form.staff_group);
                }}
                className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded"
              />
              <span className="text-[11px] text-slate-500">Enter code manually (legacy / migration)</span>
            </label>
          </Field>
          <Field label="Date of Joining" required cols={4}>
            <ValidatedDateInput value={form.doj} onChange={(v) => set('doj', v)} required onInvalid={showDateError} />
          </Field>
          <Field label="Grade" cols={2}>
            <select value={form.grade} onChange={(e) => set('grade', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {PAY_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </Field>
          <Field
            label="Pay Level"
            cols={4}
            hint={selectedDesig?.grade_pay_level ? 'Default from designation — update on promotion/increment.' : undefined}
          >
            <input value={form.pay_level} onChange={(e) => setText('pay_level', e.target.value)} className={inputCls} placeholder="e.g. Level 12" />
          </Field>
          <Field label="Last Qualification" cols={6}>
            <input value={form.last_qualification} onChange={(e) => setText('last_qualification', e.target.value)} className={inputCls} placeholder="MD, M.SC…" />
          </Field>
          <Field label="Next Increment" cols={4}>
            <ValidatedDateInput value={form.next_increment_date} onChange={(v) => set('next_increment_date', v)} onInvalid={showDateError} />
          </Field>
          <Field label="Last Working Day" cols={4}>
            <input type="date" value="" disabled tabIndex={-1} className={`${inputCls} opacity-60 cursor-not-allowed`} title="Set via resignation workflow" />
          </Field>

          <Section title="IDs & Banking" />
          <Field label="PAN" cols={3}>
            <input value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} className={codeCls} maxLength={10} placeholder="ABCDE1234F" />
          </Field>
          <Field label="Aadhaar" cols={3}>
            <input inputMode="numeric" value={form.aadhaar} onChange={(e) => set('aadhaar', filterDigits(e.target.value, 12))} className={codeCls} maxLength={12} />
          </Field>
          <Field label="IFSC" cols={3}>
            <input value={form.ifsc_code} onChange={(e) => set('ifsc_code', e.target.value.toUpperCase())} className={codeCls} maxLength={11} />
          </Field>
          <Field label="NPS Number" cols={3}>
            <input inputMode="numeric" value={form.nps_or_gpf_no} onChange={(e) => set('nps_or_gpf_no', filterDigits(e.target.value, 12))} className={codeCls} maxLength={12} />
          </Field>
          <Field label="PFMS Code" cols={3}>
            <input value={form.pfms_code} onChange={(e) => set('pfms_code', filterAlphanumUpper(e.target.value, 14))} className={codeCls} maxLength={14} />
          </Field>
          <Field label="Bank A/C" cols={3}>
            <input inputMode="numeric" value={form.bank_account_no} onChange={(e) => set('bank_account_no', filterDigits(e.target.value, 20))} className={codeCls} />
          </Field>
          <Field label="Bank Name" cols={6}>
            <input value={form.bank_name} onChange={(e) => setText('bank_name', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-4 px-4 sm:px-6 py-2.5 flex justify-end gap-2 bg-white/95 backdrop-blur border-t border-slate-200">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">Cancel</button>
          <button type="submit" disabled={saving || !selectedDesig} className="btn-primary btn-sm">
            {saving ? 'Saving…' : 'Onboard Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}
