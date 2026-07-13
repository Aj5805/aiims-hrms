import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, departmentsApi, designationsApi, employeesApi, nodalOfficesApi, hodAssignmentsApi, reportsApi } from '../api/endpoints';
import { approvalsApi } from '../api/endpoints';
import api from '../api/client';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';
import { SearchableSelect } from '../components/SearchableSelect';
import { balancesForLeaveYear, currentLeaveYear, staffLedgerLink } from '../utils/leaveBalances';

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function LoginActivityPage() {
  const [data, setData] = useState<{ last_login?: string | null; history: { logged_in_at: string; ip_address?: string; user_agent?: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void authApi.myLoginActivity().then((res) => setData(res.data)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Login Activity"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'My Profile', to: '/profile-dashboard' }, { label: 'Login Activity' }]}
      />
      <div className="card p-5 space-y-4">
        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">Last login</div>
          <div className="text-lg font-bold text-slate-900 mt-1">{loading ? '…' : formatDateTime(data?.last_login)}</div>
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="data-table data-table-compact w-full">
            <thead>
              <tr>
                <th>Date & time</th>
                <th>IP address</th>
                <th>Device / browser</th>
              </tr>
            </thead>
            <tbody>
              {(data?.history ?? []).map((row, i) => (
                <tr key={i}>
                  <td>{formatDateTime(row.logged_in_at)}</td>
                  <td className="font-mono text-xs">{row.ip_address || '—'}</td>
                  <td className="text-xs text-slate-600 max-w-md truncate" title={row.user_agent}>{row.user_agent || '—'}</td>
                </tr>
              ))}
              {!loading && (data?.history ?? []).length === 0 && (
                <tr><td colSpan={3} className="text-center py-6 text-slate-400 italic">No login history yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function ForecastingPage() {
  const today = new Date().toISOString().slice(0, 10);
  const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(inTwoWeeks);
  const [data, setData] = useState<{ dates: string[]; designations: string[]; cells: Record<string, Record<string, { total: number; on_leave: number; available: number }>> } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await approvalsApi.availabilityForecast({ from_date: fromDate, to_date: toDate });
      setData(res.data);
    } catch {
      setError('Could not load forecast.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div className="page">
      <PageHeader
        title="Staff Availability Forecast"
        breadcrumbs={[{ label: 'Desk', to: '/hod' }, { label: 'Nodal Desk', to: '/hod' }, { label: 'Forecast' }]}
      />
      <div className="card p-4 mb-3 flex flex-wrap gap-3 items-end">
        <label className="text-xs font-semibold text-slate-600">From<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-input block mt-1 text-xs" /></label>
        <label className="text-xs font-semibold text-slate-600">To<input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-input block mt-1 text-xs" /></label>
        <button type="button" onClick={() => void load()} className="btn-sm bg-blue-600 text-white rounded-md px-4 py-2 text-xs font-bold">Refresh</button>
      </div>
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}
      {loading ? (
        <p className="text-slate-500 text-sm">Loading…</p>
      ) : data && data.designations.length > 0 ? (
        <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
          <table className="data-table data-table-compact text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 bg-slate-50 z-10">Date</th>
                {data.designations.map((d) => <th key={d} className="whitespace-nowrap">{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.dates.map((dt) => (
                <tr key={dt}>
                  <td className="sticky left-0 bg-white font-mono whitespace-nowrap">{dt}</td>
                  {data.designations.map((desg) => {
                    const cell = data.cells[dt]?.[desg];
                    const avail = cell?.available ?? 0;
                    const total = cell?.total ?? 0;
                    const cls = avail === 0 ? 'bg-red-50 text-red-800' : avail < total ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-900';
                    return (
                      <td key={desg} className={`text-center font-bold ${cls}`} title={`${avail} of ${total} available`}>
                        {avail}/{total}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-500 text-sm">No staff data for forecast in your scope.</p>
      )}
    </div>
  );
}

type BalanceOverviewRow = {
  emp_code: string;
  name: string;
  department_code?: string;
  dept: string;
  designation_name?: string;
  leave_type: string;
  opening_balance: number;
  credited: number;
  availed: number;
  closing_balance: number;
};

export function BalanceOverviewPage() {
  const [departments, setDepartments] = useState<{ code: string; name: string }[]>([]);
  const [designations, setDesignations] = useState<{ name: string }[]>([]);
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [desgFilter, setDesgFilter] = useState('ALL');
  const [rows, setRows] = useState<BalanceOverviewRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void Promise.all([departmentsApi.list(), designationsApi.list()]).then(([dRes, desRes]) => {
      setDepartments(dRes.data || []);
      setDesignations(desRes.data || []);
    });
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (deptFilter !== 'ALL') params.department_code = deptFilter;
      if (desgFilter !== 'ALL') params.designation_name = desgFilter;
      const { data } = await reportsApi.balanceOverview(params);
      setRows(data.rows || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [deptFilter, desgFilter]);

  return (
    <div className="page">
      <PageHeader
        title="Leave Balance Overview"
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'HR Operations' }, { label: 'Balance Overview' }]}
        rightContent={
          <Link to="/reports" className="text-xs font-bold text-blue-600 hover:underline">Export reports →</Link>
        }
      />
      <div className="card p-4 mb-3 flex flex-wrap gap-3">
        <label className="text-xs font-semibold text-slate-600">
          Department
          <div className="mt-1">
            <SearchableSelect
              options={[
                { value: 'ALL', label: 'All mapped' },
                ...departments.map((d) => ({ value: d.code, label: d.name, searchText: d.code })),
              ]}
              value={deptFilter}
              onChange={setDeptFilter}
              placeholder="All mapped"
              className="min-w-[160px]"
            />
          </div>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Designation
          <div className="mt-1">
            <SearchableSelect
              options={[
                { value: 'ALL', label: 'All' },
                ...designations.map((d) => ({ value: d.name, label: d.name })),
              ]}
              value={desgFilter}
              onChange={setDesgFilter}
              placeholder="All"
              className="min-w-[160px]"
            />
          </div>
        </label>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
        <table className="data-table data-table-compact text-xs">
          <thead>
            <tr>
              <th>Code</th><th>Name</th><th>Dept</th><th>Designation</th><th>Leave</th>
              <th>Opening</th><th>Credited</th><th>Availed</th><th>Closing</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="text-center py-6 text-slate-400">Loading…</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i}>
                <td className="font-mono">{r.emp_code}</td>
                <td>{r.name}</td>
                <td>{r.dept}</td>
                <td>{r.designation_name || '—'}</td>
                <td className="font-mono">{r.leave_type}</td>
                <td>{r.opening_balance}</td>
                <td>{r.credited}</td>
                <td>{r.availed}</td>
                <td className="font-bold">{r.closing_balance}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={9} className="text-center py-6 text-slate-400 italic">No balances found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type NodalOffice = {
  id: string;
  code: string;
  name: string;
  leave_scheme: string;
  officer_user_id?: string | null;
  officer_employee_id?: string | null;
  officer_employee_name?: string | null;
  is_active: boolean;
  clerical_count?: number;
};

type AssignableStaff = {
  id: string;
  emp_code: string;
  name: string;
  department_name?: string;
  designation_name?: string;
  leave_scheme?: string;
  department_id?: string;
  user_role?: string;
};

const SCHEME_LABELS: Record<string, string> = {
  CCS: 'Regular staff',
  RESIDENCY: 'Residents',
};

function staffOptionLabel(s: AssignableStaff): string {
  const desg = s.designation_name ? ` · ${s.designation_name}` : '';
  return `${s.emp_code} — ${s.name}${desg}`;
}

function staffSelectOptions(staff: AssignableStaff[]) {
  return staff.map((s) => ({
    value: s.id,
    label: staffOptionLabel(s),
    searchText: `${s.emp_code} ${s.name} ${s.designation_name ?? ''}`,
  }));
}

type OfficeStaff = {
  id: string;
  username: string;
  is_active: boolean;
  employee_id?: string | null;
  emp_code?: string | null;
  employee_name?: string | null;
};

function officeStaffLabel(s: OfficeStaff): string {
  if (s.emp_code && s.employee_name) return `${s.emp_code} — ${s.employee_name}`;
  return s.employee_name || s.username;
}

export function NodalOfficesPanel() {
  const [offices, setOffices] = useState<NodalOffice[]>([]);
  const [eligibleStaff, setEligibleStaff] = useState<AssignableStaff[]>([]);
  const [message, setMessage] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newScheme, setNewScheme] = useState('CCS');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOfficerId, setEditOfficerId] = useState('');
  const [officeStaffByOffice, setOfficeStaffByOffice] = useState<Record<string, OfficeStaff[]>>({});
  const [staffPickId, setStaffPickId] = useState('');
  const [staffBusy, setStaffBusy] = useState(false);

  const load = async () => {
    const [oRes, staffRes] = await Promise.all([
      nodalOfficesApi.list({ include_inactive: true }),
      nodalOfficesApi.eligibleStaff(),
    ]);
    setOffices(oRes.data || []);
    setEligibleStaff(staffRes.data || []);
  };

  useEffect(() => { void load(); }, []);

  const needsOfficerCount = useMemo(
    () => offices.filter((o) => o.is_active !== false && !o.officer_employee_id && !o.officer_user_id).length,
    [offices],
  );

  const loadOfficeStaff = async (officeId: string) => {
    const res = await nodalOfficesApi.clericalLogins(officeId);
    setOfficeStaffByOffice((prev) => ({ ...prev, [officeId]: res.data || [] }));
  };

  const startEdit = (office: NodalOffice) => {
    setEditingId(office.id);
    setEditOfficerId(office.officer_employee_id || '');
    setStaffPickId('');
    setMessage('');
    void loadOfficeStaff(office.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditOfficerId('');
    setStaffPickId('');
  };

  const createOffice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    try {
      await nodalOfficesApi.create({ code: newCode.trim(), name: newName.trim(), leave_scheme: newScheme });
      setNewCode('');
      setNewName('');
      setShowAddForm(false);
      setMessage('');
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Could not add nodal office.');
    }
  };

  const saveOfficer = async (office: NodalOffice) => {
    if (!editOfficerId) {
      setMessage('Select a staff member for nodal officer.');
      return;
    }
    try {
      await nodalOfficesApi.update(office.id, { officer_employee_id: editOfficerId });
      setMessage('');
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Could not save nodal officer.');
    }
  };

  const assignOfficeStaff = async (office: NodalOffice) => {
    if (!staffPickId) {
      setMessage('Select a staff member for nodal office staff.');
      return;
    }
    if (!office.officer_user_id && !office.officer_employee_id) {
      setMessage('Assign a nodal officer first.');
      return;
    }
    setStaffBusy(true);
    try {
      await nodalOfficesApi.assignOfficeStaff(office.id, { employee_id: staffPickId });
      setStaffPickId('');
      setMessage('');
      void loadOfficeStaff(office.id);
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Could not assign office staff.');
    } finally {
      setStaffBusy(false);
    }
  };

  const removeOfficeStaff = async (officeId: string, userId: string) => {
    if (!window.confirm('Remove this staff member from nodal office desk role? They will revert to regular staff login.')) return;
    try {
      await nodalOfficesApi.removeOfficeStaff(officeId, userId);
      void loadOfficeStaff(officeId);
      void load();
    } catch {
      setMessage('Could not remove office staff.');
    }
  };

  const toggleActive = async (office: NodalOffice) => {
    try {
      await nodalOfficesApi.update(office.id, { is_active: !office.is_active });
      void load();
    } catch {
      setMessage('Could not update office status.');
    }
  };

  const pickableOfficeStaff = (office: NodalOffice) => {
    const assignedEmpIds = new Set(
      (officeStaffByOffice[office.id] || [])
        .map((s) => s.employee_id)
        .filter(Boolean),
    );
    return eligibleStaff.filter((s) => {
      if (s.id === office.officer_employee_id) return false;
      if (assignedEmpIds.has(s.id)) return false;
      const role = s.user_role || 'STAFF';
      return role === 'STAFF';
    });
  };

  return (
    <div className="space-y-6">
      {message && (
        <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{message}</p>
      )}

      {needsOfficerCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
          {needsOfficerCount} office{needsOfficerCount === 1 ? '' : 's'} without a nodal officer.
        </p>
      )}

      <div className="flex justify-end">
        <button type="button" onClick={() => setShowAddForm((v) => !v)} className="btn-primary btn-sm">
          {showAddForm ? 'Cancel' : '+ Add Nodal Office'}
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 rounded-lg border" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">New Nodal Office</h3>
          <form onSubmit={(e) => void createOffice(e)} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Code *</label>
              <input value={newCode} onChange={(e) => setNewCode(e.target.value)} className="form-input" placeholder="e.g. ESTABLISHMENT" required />
            </div>
            <div className="flex-[2] min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="form-input" placeholder="Establishment" required />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Staff type *</label>
              <select value={newScheme} onChange={(e) => setNewScheme(e.target.value)} className="form-select">
                <option value="CCS">Regular staff (CCS)</option>
                <option value="RESIDENCY">Residents</option>
              </select>
            </div>
            <button type="submit" className="btn-primary h-[38px]">Add</button>
          </form>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <table className="min-w-full text-sm data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Staff type</th>
              <th>Nodal officer</th>
              <th>Office staff</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {offices.map((office) => {
              const editing = editingId === office.id;
              const staffList = officeStaffByOffice[office.id];
              const staffNames = staffList
                ? staffList.filter((s) => s.is_active).map(officeStaffLabel)
                : null;
              const officerReady = Boolean(office.officer_employee_id || office.officer_user_id);
              const pickable = pickableOfficeStaff(office);

              return (
                <Fragment key={office.id}>
                  <tr className={office.is_active === false ? 'opacity-60' : ''}>
                    <td className="font-mono text-xs text-gray-600">{office.code}</td>
                    <td className="font-medium text-gray-900">{office.name}</td>
                    <td className="text-gray-500 text-xs">{SCHEME_LABELS[office.leave_scheme] || office.leave_scheme}</td>
                    <td>
                      {editing ? (
                        <SearchableSelect
                          options={staffSelectOptions(eligibleStaff)}
                          value={editOfficerId}
                          onChange={setEditOfficerId}
                          placeholder="Search or select staff…"
                          className="min-w-[220px]"
                        />
                      ) : (
                        <span className="text-gray-700">
                          {office.officer_employee_name || <span className="text-slate-400 italic">Not assigned</span>}
                        </span>
                      )}
                    </td>
                    <td className="text-gray-700 text-xs max-w-[200px]">
                      {staffNames === null && (office.clerical_count ?? 0) > 0 ? (
                        <span className="text-slate-400">{office.clerical_count} assigned</span>
                      ) : staffNames && staffNames.length > 0 ? (
                        <span>{staffNames.join(', ')}</span>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                    <td>
                      {office.is_active !== false
                        ? <span className="text-emerald-700 font-bold text-xs">Active</span>
                        : <span className="text-slate-400 text-xs">Inactive</span>}
                    </td>
                    <td className="text-right space-x-2 whitespace-nowrap">
                      {editing ? (
                        <>
                          <button type="button" onClick={() => void saveOfficer(office)} className="text-xs font-bold text-emerald-700 hover:underline">Save</button>
                          <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:underline">Done</button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEdit(office)} className="text-xs font-bold text-indigo-600 hover:underline">Manage</button>
                          <button type="button" onClick={() => void toggleActive(office)} className="text-xs font-bold text-blue-600 hover:underline">
                            {office.is_active !== false ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  {editing && (
                    <tr key={`${office.id}-staff`}>
                      <td colSpan={7} className="bg-slate-50 border-t border-slate-100 p-4">
                        <div className="max-w-2xl space-y-4">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">Nodal office staff</h4>
                            <p className="text-xs text-slate-500 mb-3">
                              Pick onboarded staff — same as HOD or nodal officer assignment. They use their existing login with desk permissions (onboarding, directory, leave entries — no approval).
                            </p>
                            {!officerReady && (
                              <p className="text-xs text-amber-700 mb-2">Save a nodal officer above before adding office staff.</p>
                            )}
                            <div className="flex flex-wrap gap-2 items-end">
                              <div className="flex-1 min-w-[240px]">
                                <label className="form-label">Staff member</label>
                                <SearchableSelect
                                  options={staffSelectOptions(pickable)}
                                  value={staffPickId}
                                  onChange={setStaffPickId}
                                  placeholder="Search or select staff…"
                                  disabled={!officerReady || staffBusy}
                                />
                              </div>
                              <button
                                type="button"
                                disabled={!officerReady || !staffPickId || staffBusy}
                                onClick={() => void assignOfficeStaff(office)}
                                className="btn-primary btn-sm disabled:opacity-50"
                              >
                                {staffBusy ? 'Assigning…' : 'Assign staff'}
                              </button>
                            </div>
                            {pickable.length === 0 && officerReady && (
                              <p className="text-xs text-amber-700 mt-2">
                                No eligible staff —{' '}
                                <Link to="/employees?tab=onboard" className="font-bold underline">onboard staff first</Link>.
                              </p>
                            )}
                          </div>
                          <table className="data-table data-table-compact w-full text-xs">
                            <thead>
                              <tr>
                                <th>Staff</th>
                                <th>Login</th>
                                <th>Status</th>
                                <th className="text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(officeStaffByOffice[office.id] || []).map((s) => (
                                <tr key={s.id}>
                                  <td className="font-medium">{officeStaffLabel(s)}</td>
                                  <td className="font-mono text-slate-500">{s.username}</td>
                                  <td>
                                    {s.is_active
                                      ? <span className="text-emerald-700 font-bold">Active</span>
                                      : <span className="text-slate-400">Inactive</span>}
                                  </td>
                                  <td className="text-right">
                                    <button
                                      type="button"
                                      onClick={() => void removeOfficeStaff(office.id, s.id)}
                                      className="text-xs font-bold text-red-600 hover:underline"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                              {(officeStaffByOffice[office.id] || []).length === 0 && (
                                <tr>
                                  <td colSpan={4} className="text-center py-4 text-slate-400 italic">
                                    No office staff assigned yet.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {offices.length === 0 && (
              <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-400">No nodal offices yet. Add Establishment and Registrar offices.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** @deprecated alias */
export const NodalAssignmentsPanel = NodalOfficesPanel;

type HodAssignment = {
  id: string;
  department_id: string;
  department_name: string;
  department_code?: string;
  hod_employee_id?: string;
  hod_employee_name?: string;
  hod_emp_code?: string;
  is_active: boolean;
};

type DeptRow = { id: string; name: string; code: string; is_active?: boolean };

export function HodAssignmentsPanel() {
  const [departments, setDepartments] = useState<DeptRow[]>([]);
  const [assignments, setAssignments] = useState<HodAssignment[]>([]);
  const [staffByDept, setStaffByDept] = useState<Record<string, AssignableStaff[]>>({});
  const [loadingDeptId, setLoadingDeptId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [dRes, aRes] = await Promise.all([
      departmentsApi.list({ include_inactive: false }),
      hodAssignmentsApi.list({ active_only: true }),
    ]);
    setDepartments(dRes.data || []);
    setAssignments(aRes.data || []);
  };

  useEffect(() => { void load(); }, []);

  const loadDeptStaff = async (departmentId: string) => {
    if (staffByDept[departmentId]) return;
    setLoadingDeptId(departmentId);
    try {
      const res = await hodAssignmentsApi.eligibleStaff({ department_id: departmentId });
      setStaffByDept((prev) => ({ ...prev, [departmentId]: res.data || [] }));
    } finally {
      setLoadingDeptId(null);
    }
  };

  const assignmentByDept = useMemo(() => {
    const map = new Map<string, HodAssignment>();
    assignments.filter((a) => a.is_active).forEach((a) => map.set(a.department_id, a));
    return map;
  }, [assignments]);

  const unassignedCount = departments.filter((d) => !assignmentByDept.has(d.id)).length;

  const startEdit = (dept: DeptRow) => {
    const current = assignmentByDept.get(dept.id);
    setEditingId(dept.id);
    setEditEmployeeId(current?.hod_employee_id || '');
    setMessage('');
    void loadDeptStaff(dept.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditEmployeeId('');
  };

  const saveHod = async (dept: DeptRow) => {
    if (!editEmployeeId) {
      setMessage('Select a staff member.');
      return;
    }
    try {
      await hodAssignmentsApi.create({ department_id: dept.id, employee_id: editEmployeeId });
      cancelEdit();
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Could not save HOD assignment.');
    }
  };

  return (
    <div className="space-y-6">
      {message && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{message}</p>}

      {unassignedCount > 0 && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
          {unassignedCount} dept(s) without HOD.
        </p>
      )}

      <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--color-border)' }}>
        <table className="min-w-full text-sm data-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Department</th>
              <th>HOD</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => {
              const current = assignmentByDept.get(dept.id);
              const deptStaff = staffByDept[dept.id] || [];
              return (
                <tr key={dept.id}>
                  <td className="font-mono text-xs text-gray-600">{dept.code}</td>
                  <td className="font-medium text-gray-900">{dept.name}</td>
                  {editingId === dept.id ? (
                    <td>
                      {loadingDeptId === dept.id ? (
                        <span className="text-xs text-slate-400">Loading staff…</span>
                      ) : (
                        <SearchableSelect
                          options={staffSelectOptions(deptStaff)}
                          value={editEmployeeId}
                          onChange={setEditEmployeeId}
                          placeholder="Search or select staff…"
                          className="min-w-[220px]"
                        />
                      )}
                      {deptStaff.length === 0 && (
                        <p className="text-xs text-amber-700 mt-1">No staff in this department yet — onboard someone first.</p>
                      )}
                    </td>
                  ) : (
                    <td className="text-gray-700">
                      {current?.hod_employee_name
                        ? `${current.hod_emp_code ? `${current.hod_emp_code} — ` : ''}${current.hod_employee_name}`
                        : <span className="text-slate-400 italic">Not assigned</span>}
                    </td>
                  )}
                  <td>
                    {current
                      ? <span className="text-emerald-700 font-bold text-xs">Assigned</span>
                      : <span className="text-amber-600 font-bold text-xs">Needs HOD</span>}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    {editingId === dept.id ? (
                      <span className="space-x-2">
                        <button type="button" onClick={() => void saveHod(dept)} className="text-xs font-bold text-emerald-700 hover:underline">Save</button>
                        <button type="button" onClick={cancelEdit} className="text-xs font-bold text-slate-500 hover:underline">Cancel</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => startEdit(dept)} className="text-xs font-bold text-indigo-600 hover:underline">Manage</button>
                    )}
                  </td>
                </tr>
              );
            })}
            {departments.length === 0 && (
              <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-400">No departments configured. Add departments first.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function TeamLeavePage() {
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [employees, setEmployees] = useState<{ id: string; emp_code: string; name: string; department_name: string; designation_name: string }[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [balances, setBalances] = useState<{ leave_type_code: string; leave_type_name: string; closing_balance: number | string; leave_year: number }[]>([]);
  const leaveYear = currentLeaveYear();

  useEffect(() => {
    void employeesApi.list({ search, limit: '100' }).then((res) => setEmployees(res.data || []));
  }, [search]);

  const selected = useMemo(() => employees.find((e) => e.id === selectedId), [employees, selectedId]);
  const currentBalances = useMemo(() => balancesForLeaveYear(balances, leaveYear), [balances, leaveYear]);

  useEffect(() => {
    if (!selectedId) { setBalances([]); return; }
    void api.get(`/leave-balances/${selectedId}`).then((res) => setBalances(res.data.balances || []));
  }, [selectedId]);

  const title = user?.role === 'HOD' ? 'Team Leave Balances' : 'Department Leave Balances';

  return (
    <div className="page">
      <PageHeader
        title={title}
        breadcrumbs={[{ label: 'Desk', to: '/hod' }, { label: 'Nodal Desk', to: '/hod' }, { label: title }]}
        hideTitle
      />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4 md:col-span-1 space-y-2">
          <input type="text" placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-full text-xs" />
          <div className="max-h-96 app-scroll-y border border-slate-200 rounded-lg divide-y">
            {employees.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${selectedId === e.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}
              >
                <div className="font-bold">{e.name}</div>
                <div className="text-slate-500">{e.emp_code} · {e.designation_name}</div>
              </button>
            ))}
            {employees.length === 0 && <p className="p-3 text-slate-400 text-xs italic">No staff found.</p>}
          </div>
        </div>
        <div className="card p-4 md:col-span-2">
          {selected ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h3 className="font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-xs text-slate-500">{selected.department_name} · {selected.designation_name} · FY {leaveYear}</p>
                </div>
                <Link
                  to={staffLedgerLink(selected.id, leaveYear)}
                  className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap"
                >
                  View full ledger →
                </Link>
              </div>
              <table className="data-table data-table-compact w-full text-xs">
                <thead><tr><th>Leave type</th><th>Closing balance</th></tr></thead>
                <tbody>
                  {currentBalances.map((b, i) => (
                    <tr key={i}>
                      <td>{b.leave_type_name} ({b.leave_type_code})</td>
                      <td className="font-bold">{b.closing_balance}</td>
                    </tr>
                  ))}
                  {currentBalances.length === 0 && <tr><td colSpan={2} className="text-center py-4 text-slate-400 italic">No balances for FY {leaveYear}.</td></tr>}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-slate-500 text-sm py-8 text-center">Select a staff member to view balances.</p>
          )}
        </div>
      </div>
    </div>
  );
}
