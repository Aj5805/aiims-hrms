import React, { useState, useEffect } from 'react';
import { employeesApi, departmentsApi, designationsApi } from '../api/endpoints';
import { formatApiError } from '../constants/roles';
import { useAuthStore } from '../stores';

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
  onSaved: () => void;
  onCancel: () => void;
}

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
  address: '',
  permanent_address: '',
  mobile: '',
  alt_mobile: '',
  email: '',
  personal_email: '',
  has_institutional_email: false,
  doj: '',
  doj_actual: '',
  dol_last_working: '',
  next_increment_date: '',
  department_code: '',
  designation_name: '',
  staff_group: '',
  type_of_flat: '',
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
  photo: '',
};

/** 12-column spans: sm (2-col) · md (6-col) · xl (12-col) */
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
  children,
}: {
  label: string;
  required?: boolean;
  cols?: ColSpan;
  children: React.ReactNode;
}) {
  return (
    <div className={COL[cols]}>
      <label className={labelCls}>
        {label}{required && <span className="text-red-500"> *</span>}
      </label>
      {children}
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

export default function AddStaffForm({ onSaved, onCancel }: AddStaffFormProps) {
  const token = useAuthStore((s) => s.token);
  const userRole = useAuthStore((s) => s.user?.role);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [staffGroups, setStaffGroups] = useState<StaffGroupOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [manualEmpCode, setManualEmpCode] = useState(false);
  const [previewCode, setPreviewCode] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  const set = (key: keyof typeof EMPTY_FORM, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
        const detail = formatApiError(data?.detail);
        setError(detail || 'Failed to load master data. Check that the backend is running and you are logged in with an HR role.');
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
      // suggestion is optional
    }
  };

  const refreshPreviewCode = async () => {
    if (manualEmpCode) return;
    setPreviewLoading(true);
    try {
      const { data } = await employeesApi.nextStaffNumber();
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
    if (manualEmpCode) return;
    void refreshPreviewCode();
  }, [manualEmpCode]);

  const handleDesignationChange = async (name: string) => {
    const desig = designations.find((d) => d.name === name);
    setForm((prev) => ({
      ...prev,
      designation_name: name,
    }));
    if (desig && form.department_code) {
      await refreshStaffGroupSuggestion(name, form.department_code, desig.category_code);
    }
  };

  const handleDepartmentChange = async (code: string) => {
    setForm((prev) => ({ ...prev, department_code: code }));
    if (form.designation_name && code) {
      await refreshStaffGroupSuggestion(
        form.designation_name,
        code,
        selectedDesig?.category_code,
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

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

    try {
      const payload: Record<string, unknown> = {
        ...emptyToNull(form),
        category_code,
        has_institutional_email: form.has_institutional_email,
        is_physically_handicapped: form.is_physically_handicapped,
      };
      if (!manualEmpCode) {
        delete payload.emp_code;
      }
      await employeesApi.create(payload);
      onSaved();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
      setError(formatApiError(data?.detail) || 'Failed to create employee');
      setSaving(false);
    }
  };

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
        Staff numbers are unique 7-digit codes starting at 1000001. Staff group classifies the role and can change later; the number stays the same.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="dense-form">
          <Section title="Personal Identity" />
          <Field label="Initial" cols={1}>
            <input value={form.initial} onChange={(e) => set('initial', e.target.value)} className={inputCls} placeholder="Dr." maxLength={8} />
          </Field>
          <Field label="Full Name" required cols={6}>
            <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Gender" required cols={2}>
            <select required value={form.gender} onChange={(e) => set('gender', e.target.value)} className={inputCls}>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
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
          <Field label="Father's Name" cols={5}>
            <input value={form.father_name} onChange={(e) => set('father_name', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date of Birth" cols={3}>
            <input type="date" value={form.dob} onChange={(e) => set('dob', e.target.value)} className={inputCls} />
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
          <Field label="Religion" cols={3}>
            <input value={form.religion} onChange={(e) => set('religion', e.target.value)} className={inputCls} />
          </Field>
          <Field label="PwD" cols={2}>
            <label className="flex items-center gap-2 h-[34px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_physically_handicapped}
                onChange={(e) => set('is_physically_handicapped', e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
              />
              <span className="text-xs text-slate-600">Yes</span>
            </label>
          </Field>
          <Field label="Photo Ref" cols={4}>
            <input value={form.photo} onChange={(e) => set('photo', e.target.value)} className={inputCls} placeholder="File path or reference" />
          </Field>

          <Section title="Address & Contact" />
          <Field label="Present Address" cols={6}>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Permanent Address" cols={6}>
            <input value={form.permanent_address} onChange={(e) => set('permanent_address', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Flat / Quarters" cols={3}>
            <input value={form.type_of_flat} onChange={(e) => set('type_of_flat', e.target.value)} className={inputCls} placeholder="Type-IV" />
          </Field>
          <Field label="Mobile" cols={3}>
            <input type="tel" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} className={codeCls} placeholder="10-digit" maxLength={10} />
          </Field>
          <Field label="Alt Mobile" cols={3}>
            <input type="tel" value={form.alt_mobile} onChange={(e) => set('alt_mobile', e.target.value)} className={codeCls} maxLength={10} />
          </Field>
          <Field label="Inst. Email Active" cols={3}>
            <label className="flex items-center gap-2 h-[34px] cursor-pointer">
              <input
                type="checkbox"
                checked={form.has_institutional_email}
                onChange={(e) => set('has_institutional_email', e.target.checked)}
                className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
              />
              <span className="text-xs text-slate-600">Verified</span>
            </label>
          </Field>
          <Field label="Official Email" cols={6}>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inputCls} placeholder="name@aiims.edu" />
          </Field>
          <Field label="Personal Email" cols={6}>
            <input type="email" value={form.personal_email} onChange={(e) => set('personal_email', e.target.value)} className={inputCls} placeholder="personal@email.com" />
          </Field>

          <Section title="Employment" />
          <Field label="Staff Group" required cols={4}>
            <select
              required
              value={form.staff_group}
              onChange={(e) => set('staff_group', e.target.value)}
              className={inputCls}
            >
              <option value="">Select staff group…</option>
              {staffGroups.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-[11px] text-slate-500">
              For classification and leave rules — does not change the staff number.
            </p>
          </Field>
          <Field label="Staff Number" required cols={4}>
            <input
              required
              readOnly={!manualEmpCode}
              value={manualEmpCode ? form.emp_code : (previewCode || form.emp_code)}
              onChange={(e) => set('emp_code', e.target.value)}
              className={codeCls}
              placeholder={previewLoading ? 'Loading…' : 'Auto-assigned'}
            />
            <label className="mt-1 flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={manualEmpCode}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setManualEmpCode(checked);
                  if (!checked) {
                    void refreshPreviewCode();
                  }
                }}
                className="h-3.5 w-3.5 text-indigo-600 border-slate-300 rounded"
              />
              <span className="text-[11px] text-slate-500">Enter code manually (legacy / migration)</span>
            </label>
          </Field>
          <Field label="Grade" cols={2}>
            <input value={form.grade} onChange={(e) => set('grade', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Pay Level" cols={2}>
            <input value={form.pay_level} onChange={(e) => set('pay_level', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Date of Joining" required cols={2}>
            <input required type="date" value={form.doj} onChange={(e) => set('doj', e.target.value)} className={inputCls} />
          </Field>
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
            {selectedDesig && (
              <p className="mt-0.5 text-[11px] text-indigo-600 font-medium">
                {selectedDesig.category_code}
              </p>
            )}
          </Field>
          <Field label="Actual DOJ" cols={3}>
            <input type="date" value={form.doj_actual} onChange={(e) => set('doj_actual', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Last Working Day" cols={3}>
            <input type="date" value={form.dol_last_working} onChange={(e) => set('dol_last_working', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Next Increment" cols={3}>
            <input type="date" value={form.next_increment_date} onChange={(e) => set('next_increment_date', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Last Qualification" cols={3}>
            <input value={form.last_qualification} onChange={(e) => set('last_qualification', e.target.value)} className={inputCls} placeholder="MD, M.Sc…" />
          </Field>

          <Section title="IDs & Banking" />
          <Field label="PAN" cols={3}>
            <input value={form.pan} onChange={(e) => set('pan', e.target.value.toUpperCase())} className={codeCls} maxLength={10} placeholder="ABCDE1234F" />
          </Field>
          <Field label="Aadhaar" cols={3}>
            <input value={form.aadhaar} onChange={(e) => set('aadhaar', e.target.value.replace(/\D/g, '').slice(0, 12))} className={codeCls} maxLength={12} />
          </Field>
          <Field label="IFSC" cols={3}>
            <input value={form.ifsc_code} onChange={(e) => set('ifsc_code', e.target.value.toUpperCase())} className={codeCls} maxLength={11} />
          </Field>
          <Field label="NPS / GPF" cols={3}>
            <input value={form.nps_or_gpf_no} onChange={(e) => set('nps_or_gpf_no', e.target.value)} className={inputCls} />
          </Field>
          <Field label="PFMS Code" cols={3}>
            <input value={form.pfms_code} onChange={(e) => set('pfms_code', e.target.value)} className={inputCls} />
          </Field>
          <Field label="Bank A/C" cols={4}>
            <input value={form.bank_account_no} onChange={(e) => set('bank_account_no', e.target.value)} className={codeCls} />
          </Field>
          <Field label="Bank Name" cols={5}>
            <input value={form.bank_name} onChange={(e) => set('bank_name', e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="sticky bottom-0 -mx-4 sm:-mx-6 mt-4 px-4 sm:px-6 py-2.5 flex justify-end gap-2 bg-white/95 backdrop-blur border-t border-slate-200">
          <button type="button" onClick={onCancel} className="btn-secondary btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving || !selectedDesig} className="btn-primary btn-sm">
            {saving ? 'Saving…' : 'Onboard Staff'}
          </button>
        </div>
      </form>
    </div>
  );
}
