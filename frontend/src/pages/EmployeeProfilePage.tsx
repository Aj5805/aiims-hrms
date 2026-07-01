import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { employeesApi } from '../api/endpoints';
import { formatApiError } from '../constants/roles';
import { PageHeader } from '../components/PageHeader';
import { useAuthStore } from '../stores';
import { formatAddressDisplay, parseAddress } from '../utils/employeeForm';

type EmployeeRecord = {
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

const EDITOR_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'NODAL_OFFICER'];

function fmtDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

export default function EmployeeProfilePage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canEdit = EDITOR_ROLES.includes(user?.role ?? '');
  const [emp, setEmp] = useState<EmployeeRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<Partial<EmployeeRecord>>({});

  useEffect(() => {
    if (!employeeId) return;
    setLoading(true);
    employeesApi.get(employeeId)
      .then((res) => setEmp(res.data))
      .catch(() => setEmp(null))
      .finally(() => setLoading(false));
  }, [employeeId]);

  const handleExport = () => {
    if (!emp) return;
    const blob = new Blob([JSON.stringify(emp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${emp.emp_code}_profile.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const startEdit = () => {
    if (!emp) return;
    setDraft({
      email: emp.email || '',
      personal_email: emp.personal_email || '',
      mobile: emp.mobile || '',
      alt_mobile: emp.alt_mobile || '',
      father_name: emp.father_name || '',
      religion: emp.religion || '',
      last_qualification: emp.last_qualification || '',
      pay_level: emp.pay_level || '',
      grade: emp.grade || '',
    });
    setEditing(true);
    setError('');
  };

  const saveEdit = async () => {
    if (!emp) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await employeesApi.update(emp.id, draft);
      setEmp(data);
      setEditing(false);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
      setError(formatApiError(data?.detail) || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="page py-12 text-center text-slate-500">Loading profile…</div>;
  if (!emp) return <div className="page py-12 text-center text-red-600">Employee not found.</div>;

  return (
    <div className="page employee-profile-print">
      <div className="no-print">
        <PageHeader
          breadcrumbs={[
            { label: 'Home', to: '/' },
            { label: 'HR Operations' },
            { label: 'Employee Directory', to: '/employees?tab=directory' },
            { label: emp.emp_code },
          ]}
          title={emp.name}
          description={`${emp.designation_name} · ${emp.department_name}`}
          icon={emp.name.charAt(0)}
          rightContent={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => navigate('/employees?tab=directory')} className="btn-secondary btn-sm">
                Back
              </button>
              <button type="button" onClick={handleExport} className="btn-secondary btn-sm">Export</button>
              <button type="button" onClick={handlePrint} className="btn-secondary btn-sm">Print</button>
              {canEdit && !editing && (
                <button type="button" onClick={startEdit} className="btn-primary btn-sm">Edit</button>
              )}
              {canEdit && editing && (
                <>
                  <button type="button" onClick={() => setEditing(false)} className="btn-secondary btn-sm">Cancel</button>
                  <button type="button" onClick={() => void saveEdit()} disabled={saving} className="btn-primary btn-sm">
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
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
            <Detail label="Designation" value={emp.designation_name} />
            <Detail label="Department" value={emp.department_name} />
            <Detail label="Category" value={emp.category_name} />
            <Detail label="Grade (A/B/C)" value={emp.grade} />
            <Detail label="Pay Level" value={editing ? (
              <input
                className="form-input py-1 text-sm w-full"
                value={draft.pay_level || ''}
                onChange={(e) => setDraft((d) => ({ ...d, pay_level: e.target.value.toUpperCase() }))}
              />
            ) : emp.pay_level} />
            <Detail label="Date of Joining" value={fmtDate(emp.doj)} />
            <Detail label="Next Increment" value={fmtDate(emp.next_increment_date)} />
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
            <Detail label="Initial" value={emp.initial} />
            <Detail label="Full Name" value={emp.name} />
            <Detail label="Father's Name" value={editing ? (
              <input className="form-input py-1 text-sm w-full" value={draft.father_name || ''} onChange={(e) => setDraft((d) => ({ ...d, father_name: e.target.value.toUpperCase() }))} />
            ) : emp.father_name} />
            <Detail label="Date of Birth" value={fmtDate(emp.dob)} />
            <Detail label="Gender" value={emp.gender} />
            <Detail label="Blood Group" value={emp.blood_group} />
            <Detail label="Marital Status" value={emp.marital_status} />
            <Detail label="Caste Category" value={emp.caste_category} />
            <Detail label="Religion" value={editing ? (
              <input className="form-input py-1 text-sm w-full" value={draft.religion || ''} onChange={(e) => setDraft((d) => ({ ...d, religion: e.target.value.toUpperCase() }))} />
            ) : emp.religion} />
            <Detail label="PwD" value={emp.is_physically_handicapped ? 'Yes' : 'No'} />
            <Detail label="Qualification" value={editing ? (
              <input className="form-input py-1 text-sm w-full" value={draft.last_qualification || ''} onChange={(e) => setDraft((d) => ({ ...d, last_qualification: e.target.value.toUpperCase() }))} />
            ) : emp.last_qualification} />
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">Contact</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <Detail label="Mobile" value={editing ? (
              <input className="form-input py-1 text-sm w-full" maxLength={10} value={draft.mobile || ''} onChange={(e) => setDraft((d) => ({ ...d, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
            ) : emp.mobile} />
            <Detail label="Alt Mobile" value={editing ? (
              <input className="form-input py-1 text-sm w-full" maxLength={10} value={draft.alt_mobile || ''} onChange={(e) => setDraft((d) => ({ ...d, alt_mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
            ) : emp.alt_mobile} />
            <Detail label="Email" value={editing ? (
              <input className="form-input py-1 text-sm w-full" value={draft.email || ''} onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))} />
            ) : emp.email} />
            <Detail label="Alt Email" value={editing ? (
              <input className="form-input py-1 text-sm w-full" value={draft.personal_email || ''} onChange={(e) => setDraft((d) => ({ ...d, personal_email: e.target.value }))} />
            ) : emp.personal_email} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <AddressBlock label="Permanent Address" raw={emp.permanent_address} />
            <AddressBlock label="Present Address" raw={emp.address} />
          </div>
        </section>

        <section className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-bold text-slate-800 border-b pb-2 mb-4">IDs & Banking</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Detail label="PAN" value={emp.pan} />
            <Detail label="Aadhaar" value={emp.aadhaar} />
            <Detail label="NPS" value={emp.nps_or_gpf_no} />
            <Detail label="PFMS" value={emp.pfms_code} />
            <Detail label="Bank A/C" value={emp.bank_account_no} />
            <Detail label="Bank Name" value={emp.bank_name} />
            <Detail label="IFSC" value={emp.ifsc_code} />
          </div>
        </section>
      </div>

      <p className="no-print mt-4 text-xs text-slate-500">
        Need full record changes (department, designation, address lines)? Use{' '}
        <Link to="/employees?tab=onboard" className="text-indigo-600 hover:underline">onboard corrections</Link>{' '}
        or contact establishment section.
      </p>
    </div>
  );
}
