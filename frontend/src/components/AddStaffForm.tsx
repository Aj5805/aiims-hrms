import React, { useState, useEffect, useRef } from 'react';
import { employeesApi, departmentsApi, designationsApi } from '../api/endpoints';
import { formatHttpError } from '../constants/roles';
import { FALLBACK_STAFF_GROUPS, resolveStaffGroup } from '../constants/staffGroups';
import { useAuthStore } from '../stores';
import AddressFields from './AddressFields';
import { ValidatedDateInput } from './ValidatedDateInput';
import { ValidatedTextInput } from './ValidatedTextInput';
import {
  type AddressParts,
  EMPTY_ADDRESS,
  bankAccountValidationMessage,
  emailValidationMessage,
  commitFilteredInputChange,
  filterAlphanumUpper,
  filterBankAccountInput,
  filterDigits,
  filterEmailInput,
  filterIfscInput,
  filterName,
  filterPanInput,
  ifscValidationMessage,
  panValidationMessage,
  serializeAddress,
  upperText,
  BLOOD_GROUP_OPTIONS,
  CASTE_CATEGORY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  roundLeaveDays,
  suggestNextIncrementDate,
  validateRegistrationFields,
} from '../utils/employeeForm';
import { handleFormEnterKey } from '../utils/focusNavigation';
import { checkStaffNumberAvailable } from '../utils/staffNumberCheck';

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

interface LeaveCreditRow {
  leave_type_code: string;
  leave_type_name: string;
  credit_frequency?: string | null;
  suggested_credit: number;
  credited: number;
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
  const [leaveCredits, setLeaveCredits] = useState<LeaveCreditRow[]>([]);
  const [leaveCreditsLoading, setLeaveCreditsLoading] = useState(false);
  const [staffNumberError, setStaffNumberError] = useState('');
  const [staffNumberChecking, setStaffNumberChecking] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => setAuthHydrated(true));
    setAuthHydrated(useAuthStore.persist.hasHydrated());
    return unsub;
  }, []);

  const markDirty = () => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      onDirtyChange?.(true);
    }
  };

  const set = (key: keyof typeof EMPTY_FORM, value: string | boolean) => {
    markDirty();
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'doj' && typeof value === 'string') {
        const suggested = suggestNextIncrementDate(value);
        if (suggested) next.next_increment_date = suggested;
      }
      return next;
    });
  };

  const handleFiltered = (
    key: keyof typeof EMPTY_FORM,
    filter: (value: string) => string,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => {
    markDirty();
    commitFilteredInputChange(e, filter, (v) => set(key, v));
  };

  useEffect(() => {
    if (!authHydrated || !token) return;

    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      setError('');

      const [deptResult, desigResult, groupsResult] = await Promise.allSettled([
        departmentsApi.list(),
        designationsApi.list(),
        employeesApi.staffGroups(),
      ]);

      if (cancelled) return;

      const failures: string[] = [];

      if (deptResult.status === 'fulfilled') {
        setDepartments(deptResult.value.data || []);
      } else {
        failures.push(`departments: ${formatHttpError(deptResult.reason, 'unavailable')}`);
      }

      if (desigResult.status === 'fulfilled') {
        setDesignations(desigResult.value.data || []);
      } else {
        failures.push(`designations: ${formatHttpError(desigResult.reason, 'unavailable')}`);
      }

      if (groupsResult.status === 'fulfilled') {
        setStaffGroups(groupsResult.value.data || []);
      } else {
        setStaffGroups([...FALLBACK_STAFF_GROUPS]);
        failures.push(`staff groups: ${formatHttpError(groupsResult.reason, 'using built-in list')}`);
      }

      if (deptResult.status === 'rejected' || desigResult.status === 'rejected') {
        setError(`Failed to load master data (${failures.join('; ')}).`);
      } else if (groupsResult.status === 'rejected') {
        setError('');
      }

      setLoading(false);
    };

    void fetchData();
    return () => { cancelled = true; };
  }, [authHydrated, token]);

  const selectedDesig = designations.find((d) => d.name === form.designation_name);

  const resolvedStaffGroup = resolveStaffGroup({
    designationName: form.designation_name || undefined,
    categoryCode: selectedDesig?.category_code,
    departmentCode: form.department_code || undefined,
  });

  const staffGroupLocked = !manualEmpCode && Boolean(resolvedStaffGroup);

  const applyStaffGroup = (staffGroup: string | null | undefined) => {
    if (!staffGroup) return;
    setForm((prev) => (prev.staff_group === staffGroup ? prev : { ...prev, staff_group: staffGroup }));
  };

  const refreshStaffGroupSuggestion = async (
    designationName: string,
    departmentCode: string,
    categoryCode?: string,
  ) => {
    if (!designationName) return;

    applyStaffGroup(
      resolveStaffGroup({
        designationName,
        categoryCode,
        departmentCode: departmentCode || undefined,
      }),
    );

    try {
      const params: { designation_name: string; department_code?: string; category_code?: string } = {
        designation_name: designationName,
      };
      if (departmentCode) params.department_code = departmentCode;
      if (categoryCode) params.category_code = categoryCode;
      const { data } = await employeesApi.suggestStaffGroup(params);
      applyStaffGroup(data?.staff_group);
    } catch {
      // local resolve already applied
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
    if (manualEmpCode || !resolvedStaffGroup) return;
    applyStaffGroup(resolvedStaffGroup);
  }, [manualEmpCode, resolvedStaffGroup, form.designation_name, form.department_code]);

  useEffect(() => {
    if (!manualEmpCode) {
      setStaffNumberError('');
      setStaffNumberChecking(false);
      return;
    }
    const code = form.emp_code.trim();
    if (!code || !form.staff_group) {
      setStaffNumberError('');
      return;
    }
    let cancelled = false;
    setStaffNumberChecking(true);
    const timer = window.setTimeout(() => {
      void checkStaffNumberAvailable(code, { staff_group: form.staff_group })
        .then((result) => {
          if (cancelled) return;
          setStaffNumberError(result.available ? '' : (result.message || 'Staff number is not available'));
        })
        .catch(() => {
          if (!cancelled) setStaffNumberError('');
        })
        .finally(() => {
          if (!cancelled) setStaffNumberChecking(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [manualEmpCode, form.emp_code, form.staff_group]);

  useEffect(() => {
    if (manualEmpCode || !form.staff_group) {
      if (!form.staff_group) setPreviewCode('');
      return;
    }
    void refreshPreviewCode(form.staff_group);
  }, [manualEmpCode, form.staff_group]);

  useEffect(() => {
    const categoryCode = selectedDesig?.category_code;
    if (!categoryCode || !form.doj) {
      setLeaveCredits([]);
      return;
    }
    let cancelled = false;
    const loadCredits = async () => {
      setLeaveCreditsLoading(true);
      try {
        const { data } = await employeesApi.onboardingLeaveCredits({
          category_code: categoryCode,
          doj: form.doj,
          gender: form.gender,
        });
        if (cancelled) return;
        const rows = (data || []) as Array<{
          leave_type_code: string;
          leave_type_name: string;
          credit_frequency?: string | null;
          suggested_credit: number;
        }>;
        setLeaveCredits(rows.map((row) => ({
          ...row,
          suggested_credit: roundLeaveDays(Number(row.suggested_credit) || 0),
          credited: roundLeaveDays(Number(row.suggested_credit) || 0),
        })));
      } catch {
        if (!cancelled) setLeaveCredits([]);
      } finally {
        if (!cancelled) setLeaveCreditsLoading(false);
      }
    };
    void loadCredits();
    return () => { cancelled = true; };
  }, [selectedDesig?.category_code, form.doj, form.gender]);

  const handleDesignationChange = async (name: string) => {
    markDirty();
    const desig = designations.find((d) => d.name === name);
    setForm((prev) => ({
      ...prev,
      designation_name: name,
      pay_level: desig?.grade_pay_level || prev.pay_level,
    }));
    if (desig) {
      await refreshStaffGroupSuggestion(name, form.department_code, desig.category_code);
    }
  };

  const handleDepartmentChange = async (code: string) => {
    markDirty();
    setForm((prev) => ({ ...prev, department_code: code }));
    if (form.designation_name) {
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
    const presentParts = presentSameAsPermanent ? permanentAddress : presentAddress;
    return validateRegistrationFields({
      email: form.email,
      personal_email: form.personal_email,
      mobile: form.mobile,
      alt_mobile: form.alt_mobile,
      pan: form.pan,
      aadhaar: form.aadhaar,
      nps_or_gpf_no: form.nps_or_gpf_no,
      pfms_code: form.pfms_code,
      bank_account_no: form.bank_account_no,
      ifsc_code: form.ifsc_code,
      permanentAddress,
      presentAddress: presentParts,
      dob: form.dob,
      doj: form.doj,
      next_increment_date: form.next_increment_date,
    });
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
    if (manualEmpCode) {
      if (staffNumberChecking) {
        setError('Checking staff number availability…');
        setSaving(false);
        return;
      }
      if (staffNumberError) {
        setError(staffNumberError);
        setSaving(false);
        return;
      }
      const liveCheck = await checkStaffNumberAvailable(form.emp_code, { staff_group: form.staff_group });
      if (!liveCheck.available) {
        setError(liveCheck.message || 'Staff number is not available');
        setSaving(false);
        return;
      }
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
      if (leaveCredits.length > 0) {
        payload.onboarding_leave_credits = leaveCredits.map((row) => ({
          leave_type_code: row.leave_type_code,
          credited: Number(row.credited) || 0,
        }));
      }

      const { data } = await employeesApi.create(payload);
      dirtyRef.current = false;
      onDirtyChange?.(false);
      onSaved(data?.id);
      setSaving(false);
    } catch (err: unknown) {
      setError(formatHttpError(err, 'Failed to create employee'));
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

      <p className="text-xs text-slate-500 mb-3">Prefix + 4 digits (e.g. FAC0001). Permanent.</p>

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
            <input required value={form.name} onChange={handleFiltered('name', filterName)} className={`${inputCls} uppercase`} />
          </Field>
          <Field label="Father's Name" cols={4}>
            <input value={form.father_name} onChange={handleFiltered('father_name', filterName)} className={`${inputCls} uppercase`} />
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
              {MARITAL_STATUS_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt.charAt(0) + opt.slice(1).toLowerCase()}</option>
              ))}
            </select>
          </Field>
          <Field label="Religion" cols={3}>
            <input value={form.religion} onChange={handleFiltered('religion', upperText)} className={`${inputCls} uppercase`} />
          </Field>
          <Field label="Caste Category" cols={2}>
            <select value={form.caste_category} onChange={(e) => set('caste_category', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {CASTE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </Field>
          <Field label="Blood Group" cols={2}>
            <select value={form.blood_group} onChange={(e) => set('blood_group', e.target.value)} className={inputCls}>
              <option value="">—</option>
              {BLOOD_GROUP_OPTIONS.map((bg) => (
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
            <input type="tel" inputMode="numeric" autoComplete="tel" value={form.mobile} onChange={handleFiltered('mobile', (v) => filterDigits(v, 10))} className={codeCls} placeholder="10-digit" maxLength={10} />
          </Field>
          <Field label="Alt Mobile" cols={3}>
            <input type="tel" inputMode="numeric" value={form.alt_mobile} onChange={handleFiltered('alt_mobile', (v) => filterDigits(v, 10))} className={codeCls} maxLength={10} />
          </Field>
          <Field label="Email" cols={3}>
            <ValidatedTextInput
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={(v) => set('email', v)}
              filter={filterEmailInput}
              validate={emailValidationMessage}
              placeholder="name@aiims.edu"
            />
          </Field>
          <Field label="Alt Email" cols={3}>
            <ValidatedTextInput
              type="email"
              autoComplete="email"
              value={form.personal_email}
              onChange={(v) => set('personal_email', v)}
              filter={filterEmailInput}
              validate={emailValidationMessage}
              placeholder="personal@email.com"
            />
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
            <select
              required
              value={form.staff_group}
              disabled={staffGroupLocked}
              onChange={(e) => set('staff_group', e.target.value)}
              className={`${inputCls}${staffGroupLocked ? ' opacity-70 cursor-not-allowed' : ''}`}
            >
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
              onChange={handleFiltered('emp_code', upperText)}
              className={codeCls}
              placeholder={previewLoading ? 'Loading…' : form.staff_group ? 'Auto-assigned' : 'Select staff group first'}
            />
            {manualEmpCode && staffNumberChecking && (
              <p className="mt-0.5 text-[11px] text-slate-500">Checking availability…</p>
            )}
            {manualEmpCode && staffNumberError && (
              <p className="mt-0.5 text-[11px] text-red-600">{staffNumberError}</p>
            )}
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
            hint={selectedDesig?.grade_pay_level ? 'From designation' : undefined}
          >
            <input value={form.pay_level} onChange={handleFiltered('pay_level', upperText)} className={`${inputCls} uppercase`} placeholder="e.g. Level 12" />
          </Field>
          <Field label="Last Qualification" cols={6}>
            <input value={form.last_qualification} onChange={handleFiltered('last_qualification', upperText)} className={`${inputCls} uppercase`} placeholder="MD, M.SC…" />
          </Field>
          <Field label="Next Increment" cols={4} hint="Jul/Jan cycle by join date">
            <ValidatedDateInput value={form.next_increment_date} onChange={(v) => set('next_increment_date', v)} onInvalid={showDateError} />
          </Field>
          <Field label="Last Working Day" cols={4}>
            <input type="date" value="" disabled tabIndex={-1} className={`${inputCls} opacity-60 cursor-not-allowed`} title="Set via resignation workflow" />
          </Field>

          {(leaveCreditsLoading || leaveCredits.length > 0) && (
            <>
              <Section title="Opening Leave Credits" />
              <div className="col-span-2 md:col-span-6 xl:col-span-12">
                <p className="text-[11px] text-slate-500 mb-2">From join date & entitlements. Edit if needed.</p>
                {leaveCreditsLoading ? (
                  <p className="text-xs text-slate-400">Calculating leave credits…</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Leave type</th>
                          <th className="text-left px-3 py-2 font-medium">Credit cycle</th>
                          <th className="text-right px-3 py-2 font-medium w-28">Days to credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveCredits.map((row) => (
                          <tr key={row.leave_type_code} className="border-t border-slate-100">
                            <td className="px-3 py-2">
                              <span className="font-medium text-slate-800">{row.leave_type_code}</span>
                              <span className="text-slate-500"> — {row.leave_type_name}</span>
                            </td>
                            <td className="px-3 py-2 text-slate-500">
                              {row.credit_frequency
                                ? row.credit_frequency.replace(/_/g, ' ').toLowerCase()
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={row.credited}
                                onChange={(e) => {
                                  const value = e.target.value === '' ? 0 : roundLeaveDays(Number(e.target.value));
                                  markDirty();
                                  setLeaveCredits((prev) => prev.map((item) => (
                                    item.leave_type_code === row.leave_type_code
                                      ? { ...item, credited: value }
                                      : item
                                  )));
                                }}
                                className={`${codeCls} w-24 text-right ml-auto`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          <Section title="IDs & Banking" />
          <Field label="PAN" cols={3}>
            <ValidatedTextInput
              code
              value={form.pan}
              onChange={(v) => set('pan', v)}
              filter={filterPanInput}
              validate={panValidationMessage}
              maxLength={10}
              placeholder="ABCDE1234F"
            />
          </Field>
          <Field label="Aadhaar" cols={3}>
            <input inputMode="numeric" value={form.aadhaar} onChange={handleFiltered('aadhaar', (v) => filterDigits(v, 12))} className={codeCls} maxLength={12} />
          </Field>
          <Field label="IFSC" cols={3}>
            <ValidatedTextInput
              code
              value={form.ifsc_code}
              onChange={(v) => set('ifsc_code', v)}
              filter={filterIfscInput}
              validate={ifscValidationMessage}
              maxLength={11}
              placeholder="SBIN0001234"
            />
          </Field>
          <Field label="NPS Number" cols={3}>
            <input inputMode="numeric" value={form.nps_or_gpf_no} onChange={handleFiltered('nps_or_gpf_no', (v) => filterDigits(v, 12))} className={codeCls} maxLength={12} />
          </Field>
          <Field label="PFMS Code" cols={3}>
            <input value={form.pfms_code} onChange={handleFiltered('pfms_code', (v) => filterAlphanumUpper(v, 14))} className={`${codeCls} uppercase`} maxLength={14} />
          </Field>
          <Field label="Bank A/C" cols={3}>
            <ValidatedTextInput
              code
              inputMode="numeric"
              value={form.bank_account_no}
              onChange={(v) => set('bank_account_no', v)}
              filter={filterBankAccountInput}
              validate={bankAccountValidationMessage}
              maxLength={18}
              placeholder="9–18 digits"
            />
          </Field>
          <Field label="Bank Name" cols={6}>
            <input value={form.bank_name} onChange={handleFiltered('bank_name', upperText)} className={`${inputCls} uppercase`} />
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
