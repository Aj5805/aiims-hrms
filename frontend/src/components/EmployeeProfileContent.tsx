import { useEffect, useState } from 'react';
import { departmentsApi, designationsApi, employeesApi } from '../api/endpoints';
import { formatHttpError } from '../constants/roles';
import { PageHeader } from './PageHeader';
import AddressFields from './AddressFields';
import { ValidatedDateInput } from './ValidatedDateInput';
import {
  type AddressParts,
  EMPTY_ADDRESS,
  BLOOD_GROUP_OPTIONS,
  CASTE_CATEGORY_OPTIONS,
  MARITAL_STATUS_OPTIONS,
  filterAlphanumUpper,
  filterDigits,
  filterEmailInput,
  filterName,
  formatAddressDisplay,
  formatIndianDate,
  parseAddress,
  serializeAddress,
  suggestNextIncrementDate,
  upperText,
  validateRegistrationFields,
} from '../utils/employeeForm';

export type EmployeeRecord = {
  id: string;
  emp_code: string;
  name: string;
  gender: string;
  dob?: string | null;
  doj: string;
  email?: string | null;
  personal_email?: string | null;
  is_active: boolean;
  category_name: string;
  category_code?: string;
  department_name: string;
  department_code: string;
  designation_name: string;
  initial?: string | null;
  address?: string | null;
  permanent_address?: string | null;
  marital_status?: string | null;
  father_name?: string | null;
  blood_group?: string | null;
  mobile?: string | null;
  alt_mobile?: string | null;
  last_qualification?: string | null;
  next_increment_date?: string | null;
  dol_last_working?: string | null;
  staff_group?: string | null;
  is_physically_handicapped?: boolean;
  caste_category?: string | null;
  religion?: string | null;
  bank_account_no?: string | null;
  bank_name?: string | null;
  ifsc_code?: string | null;
  pan?: string | null;
  aadhaar?: string | null;
  nps_or_gpf_no?: string | null;
  pfms_code?: string | null;
  grade?: string | null;
  pay_level?: string | null;
};

export type ProfileEditMode = 'none' | 'self' | 'full';

type Breadcrumb = { label: string; to?: string };

type Props = {
  emp: EmployeeRecord;
  editMode: ProfileEditMode;
  breadcrumbs: Breadcrumb[];
  description?: string;
  hrToolbar?: React.ReactNode;
  onUpdated: (emp: EmployeeRecord) => void;
};

const INITIALS = ['', 'Dr.', 'Shri.', 'Smt.', 'Mr.', 'Mrs.', 'Ms.', 'Prof.'] as const;
const PAY_GROUPS = ['A', 'B', 'C'] as const;
const CATEGORY_CODES = [
  { code: 'FACULTY', label: 'Faculty' },
  { code: 'NURSING', label: 'Nursing' },
  { code: 'ADMIN', label: 'Administration' },
  { code: 'JR_ACAD', label: 'Junior Resident (Academic)' },
  { code: 'SR_ACAD', label: 'Senior Resident (Academic)' },
  { code: 'JR_NA', label: 'Junior Resident (Non-Academic)' },
  { code: 'SR_NA', label: 'Senior Resident (Non-Academic)' },
] as const;

function fmtDate(value?: string | null) {
  if (!value) return '—';
  const iso = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return formatIndianDate(iso);
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-medium text-slate-900 mt-0.5 break-words">{value || '—'}</div>
    </div>
  );
}

function AddressBlock({ label, raw }: { label: string; raw?: string | null }) {
  const parts = parseAddress(raw);
  const hasStructured = raw?.trim().startsWith('{');
  return (
    <div className="bg-slate-50 rounded-lg border border-slate-200 p-4">
      <h3 className="text-xs font-bold text-slate-600 uppercase mb-3">{label}</h3>
      {hasStructured ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <Detail label="D No / Flat" value={parts.flat} />
          <Detail label="Building / Street" value={parts.street} />
          <Detail label="Village / Town / City" value={parts.city} />
          <Detail label="State" value={parts.state} />
          <Detail label="PIN" value={parts.pin} />
        </div>
      ) : (
        <p className="text-sm text-slate-800">{formatAddressDisplay(raw)}</p>
      )}
    </div>
  );
}

type DraftState = Record<string, unknown> & {
  permanentParts?: AddressParts;
  presentParts?: AddressParts;
  sameAsPermanent?: boolean;
};

function buildSelfDraft(emp: EmployeeRecord): DraftState {
  return {
    email: emp.email || '',
    personal_email: emp.personal_email || '',
    mobile: emp.mobile || '',
    alt_mobile: emp.alt_mobile || '',
    father_name: emp.father_name || '',
    religion: emp.religion || '',
    last_qualification: emp.last_qualification || '',
    marital_status: emp.marital_status || '',
    blood_group: emp.blood_group || '',
    initial: emp.initial || '',
    permanentParts: parseAddress(emp.permanent_address),
    presentParts: parseAddress(emp.address),
    sameAsPermanent: false,
  };
}

function buildFullDraft(emp: EmployeeRecord): DraftState {
  return {
    ...buildSelfDraft(emp),
    name: emp.name || '',
    gender: emp.gender || 'MALE',
    dob: emp.dob || '',
    doj: emp.doj || '',
    department_code: emp.department_code || '',
    designation_name: emp.designation_name || '',
    category_code: emp.category_code || '',
    grade: emp.grade || '',
    pay_level: emp.pay_level || '',
    next_increment_date: emp.next_increment_date || '',
    caste_category: emp.caste_category || '',
    is_physically_handicapped: emp.is_physically_handicapped ?? false,
    pan: emp.pan || '',
    aadhaar: emp.aadhaar || '',
    nps_or_gpf_no: emp.nps_or_gpf_no || '',
    pfms_code: emp.pfms_code || '',
    bank_account_no: emp.bank_account_no || '',
    bank_name: emp.bank_name || '',
    ifsc_code: emp.ifsc_code || '',
  };
}

function selfPayload(draft: DraftState) {
  const permanent = draft.permanentParts as AddressParts;
  const present = draft.sameAsPermanent
    ? permanent
    : (draft.presentParts as AddressParts);
  return {
    email: draft.email || null,
    personal_email: draft.personal_email || null,
    mobile: draft.mobile || null,
    alt_mobile: draft.alt_mobile || null,
    father_name: draft.father_name || null,
    religion: draft.religion || null,
    last_qualification: draft.last_qualification || null,
    marital_status: draft.marital_status || null,
    blood_group: draft.blood_group || null,
    initial: draft.initial || null,
    permanent_address: serializeAddress(permanent) || null,
    address: serializeAddress(present) || null,
  };
}

function fullPayload(draft: DraftState) {
  return {
    ...selfPayload(draft),
    name: draft.name || null,
    gender: draft.gender || null,
    dob: draft.dob || null,
    doj: draft.doj || null,
    department_code: draft.department_code || null,
    designation_name: draft.designation_name || null,
    category_code: draft.category_code || null,
    grade: draft.grade || null,
    pay_level: draft.pay_level || null,
    next_increment_date: draft.next_increment_date || null,
    caste_category: draft.caste_category || null,
    is_physically_handicapped: draft.is_physically_handicapped ?? false,
    pan: draft.pan || null,
    aadhaar: draft.aadhaar || null,
    nps_or_gpf_no: draft.nps_or_gpf_no || null,
    pfms_code: draft.pfms_code || null,
    bank_account_no: draft.bank_account_no || null,
    bank_name: draft.bank_name || null,
    ifsc_code: draft.ifsc_code || null,
  };
}

export default function EmployeeProfileContent({
  emp,
  editMode,
  breadcrumbs,
  description,
  hrToolbar,
  onUpdated,
}: Props) {
  const canEdit = editMode !== 'none';
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<DraftState>({});
  const [departments, setDepartments] = useState<{ code: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ name: string }[]>([]);

  useEffect(() => {
    if (!editing || editMode !== 'full') return;
    void Promise.all([departmentsApi.list({ is_active: true }), designationsApi.list({ is_active: true })])
      .then(([deptRes, desgRes]) => {
        setDepartments(deptRes.data || []);
        setDesignations(desgRes.data || []);
      })
      .catch(() => {
        setDepartments([]);
        setDesignations([]);
      });
  }, [editing, editMode]);

  const startEdit = () => {
    setDraft(editMode === 'full' ? buildFullDraft(emp) : buildSelfDraft(emp));
    setEditing(true);
    setError('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setError('');
  };

  const validateDraft = (): string | null => {
    const permanent = (draft.permanentParts as AddressParts) || EMPTY_ADDRESS;
    const present = draft.sameAsPermanent
      ? permanent
      : ((draft.presentParts as AddressParts) || EMPTY_ADDRESS);
    const common = {
      email: String(draft.email || ''),
      personal_email: String(draft.personal_email || ''),
      mobile: String(draft.mobile || ''),
      alt_mobile: String(draft.alt_mobile || ''),
      permanentAddress: permanent,
      presentAddress: present,
    };
    if (editMode === 'self') {
      return validateRegistrationFields({
        ...common,
        includeIdsAndBanking: false,
        includeDates: false,
      });
    }
    return validateRegistrationFields({
      ...common,
      pan: String(draft.pan || ''),
      aadhaar: String(draft.aadhaar || ''),
      nps_or_gpf_no: String(draft.nps_or_gpf_no || ''),
      pfms_code: String(draft.pfms_code || ''),
      bank_account_no: String(draft.bank_account_no || ''),
      ifsc_code: String(draft.ifsc_code || ''),
      dob: String(draft.dob || ''),
      doj: String(draft.doj || ''),
      next_increment_date: String(draft.next_increment_date || ''),
    });
  };

  const saveEdit = async () => {
    const validationError = validateDraft();
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { data } = editMode === 'self'
        ? await employeesApi.updateSelf(selfPayload(draft))
        : await employeesApi.update(emp.id, fullPayload(draft));
      onUpdated(data);
      setEditing(false);
    } catch (err: unknown) {
      setError(formatHttpError(err, 'Failed to save changes'));
    } finally {
      setSaving(false);
    }
  };

  const setField = (key: string, value: unknown) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'doj' && typeof value === 'string') {
        const suggested = suggestNextIncrementDate(value);
        if (suggested) next.next_increment_date = suggested;
      }
      return next;
    });
  };

  const isSelfField = (section: 'contact' | 'personal' | 'address' | 'critical') => {
    if (editMode === 'full') return editing;
    if (editMode === 'self') {
      return editing && section !== 'critical';
    }
    return false;
  };

  const editToolbar = canEdit ? (
    !editing ? (
      <button type="button" onClick={startEdit} className="btn-primary btn-sm">
        Edit
      </button>
    ) : (
      <>
        <button type="button" onClick={cancelEdit} className="btn-secondary btn-sm">
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void saveEdit()}
          disabled={saving}
          className="btn-primary btn-sm"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </>
    )
  ) : null;

  return (
    <div className="employee-profile-print">
      <div className="no-print">
        <PageHeader
          breadcrumbs={breadcrumbs}
          title={emp.name}
          description={description ?? `${emp.designation_name} · ${emp.department_name}`}
          icon={emp.name.charAt(0)}
          rightContent={
            (hrToolbar || editToolbar) ? (
              <div className="flex flex-wrap items-center gap-2">
                {hrToolbar}
                {editToolbar}
              </div>
            ) : undefined
          }
        />
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded text-sm">{error}</div>
        )}
      </div>

      <div className="print-only hidden print:block mb-4">
        <h1 className="text-xl font-bold">{emp.name}</h1>
        <p className="text-sm text-slate-600">{emp.emp_code} · {emp.designation_name}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">Service Record</h2>
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Staff Number" value={emp.emp_code} />
            <Detail label="Staff Group" value={emp.staff_group} />
            {isSelfField('critical') && editMode === 'full' ? (
              <>
                <div className="col-span-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Department</div>
                  <select
                    className="form-input py-1 text-sm w-full"
                    value={String(draft.department_code || '')}
                    onChange={(e) => setField('department_code', e.target.value)}
                  >
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d.code} value={d.code}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Designation</div>
                  <select
                    className="form-input py-1 text-sm w-full"
                    value={String(draft.designation_name || '')}
                    onChange={(e) => setField('designation_name', e.target.value)}
                  >
                    <option value="">Select designation</option>
                    {designations.map((d) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <Detail label="Designation" value={emp.designation_name} />
                <Detail label="Department" value={emp.department_name} />
              </>
            )}
            <Detail label="Category" value={isSelfField('critical') ? (
              <select
                className="form-input py-1 text-sm w-full"
                value={String(draft.category_code || '')}
                onChange={(e) => setField('category_code', e.target.value)}
              >
                <option value="">Select category</option>
                {CATEGORY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            ) : emp.category_name} />
            <Detail label="Grade (A/B/C)" value={isSelfField('critical') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.grade || '')} onChange={(e) => setField('grade', e.target.value)}>
                <option value="">—</option>
                {PAY_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            ) : emp.grade} />
            <Detail label="Pay Level" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.pay_level || '')} onChange={(e) => setField('pay_level', upperText(e.target.value))} />
            ) : emp.pay_level} />
            <Detail label="Date of Joining" value={isSelfField('critical') ? (
              <ValidatedDateInput value={String(draft.doj || '')} onChange={(v) => setField('doj', v)} className="form-input py-1 text-sm w-full" />
            ) : fmtDate(emp.doj)} />
            <Detail label="Next Increment" value={isSelfField('critical') ? (
              <ValidatedDateInput value={String(draft.next_increment_date || '')} onChange={(v) => setField('next_increment_date', v)} className="form-input py-1 text-sm w-full" />
            ) : fmtDate(emp.next_increment_date)} />
            <Detail label="Last Working Day" value={fmtDate(emp.dol_last_working)} />
            <Detail label="Status" value={
              <span className={emp.is_active ? 'text-emerald-700' : 'text-slate-500'}>
                {emp.is_active ? 'Active' : 'Inactive'}
              </span>
            } />
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">Personal Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <Detail label="Initial" value={isSelfField('personal') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.initial || '')} onChange={(e) => setField('initial', e.target.value)}>
                {INITIALS.map((i) => <option key={i || 'none'} value={i}>{i || '—'}</option>)}
              </select>
            ) : emp.initial} />
            <Detail label="Full Name" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.name || '')} onChange={(e) => setField('name', filterName(e.target.value))} />
            ) : emp.name} />
            <Detail label="Father's Name" value={isSelfField('personal') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.father_name || '')} onChange={(e) => setField('father_name', filterName(e.target.value))} />
            ) : emp.father_name} />
            <Detail label="Date of Birth" value={isSelfField('critical') ? (
              <ValidatedDateInput value={String(draft.dob || '')} onChange={(v) => setField('dob', v)} className="form-input py-1 text-sm w-full" />
            ) : fmtDate(emp.dob)} />
            <Detail label="Gender" value={isSelfField('critical') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.gender || 'MALE')} onChange={(e) => setField('gender', e.target.value)}>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            ) : emp.gender} />
            <Detail label="Blood Group" value={isSelfField('personal') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.blood_group || '')} onChange={(e) => setField('blood_group', e.target.value)}>
                <option value="">—</option>
                {BLOOD_GROUP_OPTIONS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            ) : emp.blood_group} />
            <Detail label="Marital Status" value={isSelfField('personal') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.marital_status || '')} onChange={(e) => setField('marital_status', e.target.value)}>
                <option value="">—</option>
                {MARITAL_STATUS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt.charAt(0) + opt.slice(1).toLowerCase()}</option>
                ))}
              </select>
            ) : emp.marital_status} />
            <Detail label="Caste Category" value={isSelfField('critical') ? (
              <select className="form-input py-1 text-sm w-full" value={String(draft.caste_category || '')} onChange={(e) => setField('caste_category', e.target.value)}>
                <option value="">—</option>
                {CASTE_CATEGORY_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
            ) : emp.caste_category} />
            <Detail label="Religion" value={isSelfField('personal') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.religion || '')} onChange={(e) => setField('religion', upperText(e.target.value))} />
            ) : emp.religion} />
            <Detail label="PwD" value={isSelfField('critical') ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(draft.is_physically_handicapped)} onChange={(e) => setField('is_physically_handicapped', e.target.checked)} />
                Yes
              </label>
            ) : (emp.is_physically_handicapped ? 'Yes' : 'No')} />
            <Detail label="Qualification" value={isSelfField('personal') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.last_qualification || '')} onChange={(e) => setField('last_qualification', upperText(e.target.value))} />
            ) : emp.last_qualification} />
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">Contact</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Detail label="Mobile" value={isSelfField('contact') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={10} value={String(draft.mobile || '')} onChange={(e) => setField('mobile', filterDigits(e.target.value, 10))} />
            ) : emp.mobile} />
            <Detail label="Alt Mobile" value={isSelfField('contact') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={10} value={String(draft.alt_mobile || '')} onChange={(e) => setField('alt_mobile', filterDigits(e.target.value, 10))} />
            ) : emp.alt_mobile} />
            <Detail label="Email" value={isSelfField('contact') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.email || '')} onChange={(e) => setField('email', filterEmailInput(e.target.value))} />
            ) : emp.email} />
            <Detail label="Alt Email" value={isSelfField('contact') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.personal_email || '')} onChange={(e) => setField('personal_email', filterEmailInput(e.target.value))} />
            ) : emp.personal_email} />
          </div>
          {isSelfField('address') ? (
            <AddressFields
              permanent={(draft.permanentParts as AddressParts) || EMPTY_ADDRESS}
              present={(draft.presentParts as AddressParts) || EMPTY_ADDRESS}
              sameAsPermanent={Boolean(draft.sameAsPermanent)}
              onPermanentChange={(parts) => setField('permanentParts', parts)}
              onPresentChange={(parts) => setField('presentParts', parts)}
              onSameToggle={(checked) => setField('sameAsPermanent', checked)}
            />
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <AddressBlock label="Permanent Address" raw={emp.permanent_address} />
              <AddressBlock label="Present Address" raw={emp.address} />
            </div>
          )}
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">IDs & Banking</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Detail label="PAN" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={10} value={String(draft.pan || '')} onChange={(e) => setField('pan', filterAlphanumUpper(e.target.value, 10))} />
            ) : emp.pan} />
            <Detail label="Aadhaar" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={12} value={String(draft.aadhaar || '')} onChange={(e) => setField('aadhaar', filterDigits(e.target.value, 12))} />
            ) : emp.aadhaar} />
            <Detail label="NPS" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={12} inputMode="numeric" value={String(draft.nps_or_gpf_no || '')} onChange={(e) => setField('nps_or_gpf_no', filterDigits(e.target.value, 12))} />
            ) : emp.nps_or_gpf_no} />
            <Detail label="PFMS" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={14} value={String(draft.pfms_code || '')} onChange={(e) => setField('pfms_code', filterAlphanumUpper(e.target.value, 14))} />
            ) : emp.pfms_code} />
            <Detail label="Bank A/C" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.bank_account_no || '')} onChange={(e) => setField('bank_account_no', filterDigits(e.target.value, 18))} />
            ) : emp.bank_account_no} />
            <Detail label="Bank Name" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" value={String(draft.bank_name || '')} onChange={(e) => setField('bank_name', upperText(e.target.value))} />
            ) : emp.bank_name} />
            <Detail label="IFSC" value={isSelfField('critical') ? (
              <input className="form-input py-1 text-sm w-full" maxLength={11} value={String(draft.ifsc_code || '')} onChange={(e) => setField('ifsc_code', filterAlphanumUpper(e.target.value, 11))} />
            ) : emp.ifsc_code} />
          </div>
        </section>
      </div>

      {editMode === 'self' && !editing && (
        <p className="no-print mt-4 text-xs text-slate-500">
          Service record changes (department, designation, IDs) are maintained by the establishment section.
          Tap Edit to update contact details and address.
        </p>
      )}
    </div>
  );
}
