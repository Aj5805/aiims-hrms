import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi, departmentsApi, designationsApi, employeesApi, nodalAssignmentsApi, hodAssignmentsApi, reportsApi, usersApi } from '../api/endpoints';
import { approvalsApi } from '../api/endpoints';
import api from '../api/client';
import { useAuthStore } from '../stores';
import { PageHeader } from '../components/PageHeader';

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
        description="Recent sign-ins to your account."
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
        description="Dates as rows, designations as columns — see who is available on future dates."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Nodal Desk', to: '/hod' }, { label: 'Forecast' }]}
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
        description="View leave balances across your mapped departments. Filter by department and designation."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'HR Operations' }, { label: 'Balance Overview' }]}
        rightContent={
          <Link to="/reports" className="text-xs font-bold text-blue-600 hover:underline">Export reports →</Link>
        }
      />
      <div className="card p-4 mb-3 flex flex-wrap gap-3">
        <label className="text-xs font-semibold text-slate-600">
          Department
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="form-input block mt-1 text-xs min-w-[160px]">
            <option value="ALL">All mapped</option>
            {departments.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Designation
          <select value={desgFilter} onChange={(e) => setDesgFilter(e.target.value)} className="form-input block mt-1 text-xs min-w-[160px]">
            <option value="ALL">All</option>
            {designations.map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
          </select>
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

type Assignment = {
  id: string;
  department_code: string;
  department_name: string;
  nodal_username: string;
  nodal_role: string;
  nodal_employee_name?: string;
  is_active: boolean;
};

export function NodalAssignmentsPanel() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [departments, setDepartments] = useState<{ id: string; code: string; name: string }[]>([]);
  const [nodalUsers, setNodalUsers] = useState<{ id: string; username: string; role: string; employee_name?: string }[]>([]);
  const [deptId, setDeptId] = useState('');
  const [nodalUserId, setNodalUserId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [aRes, dRes, nRes] = await Promise.all([
      nodalAssignmentsApi.list({ active_only: false }),
      departmentsApi.list(),
      nodalAssignmentsApi.nodalUsers(),
    ]);
    setAssignments(aRes.data || []);
    setDepartments(dRes.data || []);
    setNodalUsers(nRes.data || []);
  };

  useEffect(() => { void load(); }, []);

  const assign = async () => {
    if (!deptId || !nodalUserId) {
      setMessage('Select department and nodal user.');
      return;
    }
    try {
      await nodalAssignmentsApi.create({ department_id: deptId, nodal_user_id: nodalUserId });
      setMessage('Assignment created.');
      setDeptId('');
      setNodalUserId('');
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Failed to create assignment.');
    }
  };

  const toggle = async (id: string, isActive: boolean) => {
    await nodalAssignmentsApi.update(id, { is_active: !isActive });
    void load();
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Map nodal officers and nodal office staff to departments. This controls approval routing and data access.</p>
      <NodalOfficeLoginsPanel />
      {message && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{message}</p>}
      <div className="flex flex-wrap gap-3 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
        <label className="text-xs font-semibold text-slate-600">
          Department
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="form-input block mt-1 text-xs min-w-[200px]">
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Nodal user
          <select value={nodalUserId} onChange={(e) => setNodalUserId(e.target.value)} className="form-input block mt-1 text-xs min-w-[200px]">
            <option value="">Select…</option>
            {nodalUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.username} ({u.role.replace('_', ' ')}){u.employee_name ? ` — ${u.employee_name}` : ''}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void assign()} className="btn-sm bg-emerald-600 text-white rounded-md px-4 py-2 text-xs font-bold">Assign</button>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="data-table data-table-compact w-full text-xs">
          <thead>
            <tr><th>Department</th><th>Nodal user</th><th>Role</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td>{a.department_name}</td>
                <td>{a.nodal_username}{a.nodal_employee_name ? ` (${a.nodal_employee_name})` : ''}</td>
                <td>{a.nodal_role.replace('_', ' ')}</td>
                <td>{a.is_active ? <span className="text-emerald-700 font-bold">Active</span> : <span className="text-slate-400">Inactive</span>}</td>
                <td>
                  <button type="button" onClick={() => void toggle(a.id, a.is_active)} className="text-blue-600 font-bold hover:underline">
                    {a.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {assignments.length === 0 && (
              <tr><td colSpan={5} className="text-center py-6 text-slate-400 italic">No assignments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type HodAssignment = {
  id: string;
  department_name: string;
  hod_username: string;
  hod_employee_name?: string;
  is_active: boolean;
};

export function HodAssignmentsPanel() {
  const [assignments, setAssignments] = useState<HodAssignment[]>([]);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [hodUsers, setHodUsers] = useState<{ id: string; username: string; employee_name?: string }[]>([]);
  const [deptId, setDeptId] = useState('');
  const [hodUserId, setHodUserId] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [aRes, dRes, hRes] = await Promise.all([
      hodAssignmentsApi.list({ active_only: false }),
      departmentsApi.list({ include_inactive: false }),
      hodAssignmentsApi.hodUsers(),
    ]);
    setAssignments(aRes.data || []);
    setDepartments(dRes.data || []);
    setHodUsers(hRes.data || []);
  };

  useEffect(() => { void load(); }, []);

  const assign = async () => {
    if (!deptId || !hodUserId) {
      setMessage('Select department and HOD user.');
      return;
    }
    try {
      await hodAssignmentsApi.create({ department_id: deptId, hod_user_id: hodUserId });
      setMessage('HOD assigned to department.');
      setDeptId('');
      setHodUserId('');
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Failed to assign HOD.');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">One active HOD per department. Approval routing uses this assignment first.</p>
      {message && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{message}</p>}
      <div className="flex flex-wrap gap-3 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
        <label className="text-xs font-semibold text-slate-600">
          Department
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="form-input block mt-1 text-xs min-w-[200px]">
            <option value="">Select…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          HOD user
          <select value={hodUserId} onChange={(e) => setHodUserId(e.target.value)} className="form-input block mt-1 text-xs min-w-[200px]">
            <option value="">Select…</option>
            {hodUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.username}{u.employee_name ? ` — ${u.employee_name}` : ''}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => void assign()} className="btn-sm bg-emerald-600 text-white rounded-md px-4 py-2 text-xs font-bold">Assign HOD</button>
      </div>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="data-table data-table-compact w-full text-xs">
          <thead><tr><th>Department</th><th>HOD</th><th>Status</th></tr></thead>
          <tbody>
            {assignments.filter((a) => a.is_active).map((a) => (
              <tr key={a.id}>
                <td>{a.department_name}</td>
                <td>{a.hod_username}{a.hod_employee_name ? ` (${a.hod_employee_name})` : ''}</td>
                <td><span className="text-emerald-700 font-bold">Active</span></td>
              </tr>
            ))}
            {assignments.filter((a) => a.is_active).length === 0 && (
              <tr><td colSpan={3} className="text-center py-6 text-slate-400 italic">No HOD assignments yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NodalOfficeLoginsPanel() {
  const [nodalOfficers, setNodalOfficers] = useState<{ id: string; username: string }[]>([]);
  const [officeUsers, setOfficeUsers] = useState<{ id: string; username: string; parent_nodal_username?: string }[]>([]);
  const [parentId, setParentId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    const [officers, offices] = await Promise.all([
      nodalAssignmentsApi.nodalUsers(),
      usersApi.list('NODAL_OFFICE'),
    ]);
    setNodalOfficers((officers.data || []).filter((u: { role: string }) => u.role === 'NODAL_OFFICER'));
    setOfficeUsers(offices.data || []);
  };

  useEffect(() => { void load(); }, []);

  const createLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !parentId) {
      setMessage('Username and parent nodal officer are required.');
      return;
    }
    try {
      await usersApi.create({
        username,
        password: password || username,
        role: 'NODAL_OFFICE',
        parent_nodal_user_id: parentId,
        must_change_password: true,
      });
      setMessage(`Created nodal office login: ${username}`);
      setUsername('');
      setPassword('');
      void load();
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setMessage(detail || 'Failed to create login.');
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Create view-only nodal office staff logins under a primary nodal officer.</p>
      {message && <p className="text-sm text-blue-700 bg-blue-50 border border-blue-100 rounded px-3 py-2">{message}</p>}
      <form onSubmit={(e) => void createLogin(e)} className="flex flex-wrap gap-3 items-end p-3 bg-slate-50 rounded-lg border border-slate-200">
        <label className="text-xs font-semibold text-slate-600">
          Parent nodal officer
          <select value={parentId} onChange={(e) => setParentId(e.target.value)} className="form-input block mt-1 text-xs min-w-[180px]" required>
            <option value="">Select…</option>
            {nodalOfficers.map((u) => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Username
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="form-input block mt-1 text-xs" required />
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Temp password
          <input value={password} onChange={(e) => setPassword(e.target.value)} className="form-input block mt-1 text-xs" placeholder="defaults to username" />
        </label>
        <button type="submit" className="btn-sm bg-indigo-600 text-white rounded-md px-4 py-2 text-xs font-bold">Create login</button>
      </form>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="data-table data-table-compact w-full text-xs">
          <thead><tr><th>Username</th><th>Under nodal officer</th></tr></thead>
          <tbody>
            {officeUsers.map((u) => (
              <tr key={u.id}>
                <td>{u.username}</td>
                <td>{u.parent_nodal_username || '—'}</td>
              </tr>
            ))}
            {officeUsers.length === 0 && (
              <tr><td colSpan={2} className="text-center py-6 text-slate-400 italic">No nodal office logins yet.</td></tr>
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

  useEffect(() => {
    void employeesApi.list({ search, limit: '100' }).then((res) => setEmployees(res.data || []));
  }, [search]);

  const selected = useMemo(() => employees.find((e) => e.id === selectedId), [employees, selectedId]);

  useEffect(() => {
    if (!selectedId) { setBalances([]); return; }
    void api.get(`/leave-balances/${selectedId}`).then((res) => setBalances(res.data.balances || []));
  }, [selectedId]);

  const title = user?.role === 'HOD' ? 'Team Leave Balances' : 'Department Leave Balances';

  return (
    <div className="page">
      <PageHeader
        title={title}
        description="View leave balances for staff in your department or mapped departments."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Nodal Desk', to: '/hod' }, { label: title }]}
        rightContent={<Link to="/leave-account" className="text-xs font-bold text-blue-600 hover:underline">Open full ledger →</Link>}
      />
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4 md:col-span-1 space-y-2">
          <input type="text" placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} className="form-input w-full text-xs" />
          <div className="max-h-96 overflow-y-auto border border-slate-200 rounded-lg divide-y">
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
              <h3 className="font-bold text-slate-900 mb-1">{selected.name}</h3>
              <p className="text-xs text-slate-500 mb-3">{selected.department_name} · {selected.designation_name}</p>
              <table className="data-table data-table-compact w-full text-xs">
                <thead><tr><th>Leave type</th><th>Year</th><th>Closing balance</th></tr></thead>
                <tbody>
                  {balances.map((b, i) => (
                    <tr key={i}>
                      <td>{b.leave_type_name} ({b.leave_type_code})</td>
                      <td>{b.leave_year}</td>
                      <td className="font-bold">{b.closing_balance}</td>
                    </tr>
                  ))}
                  {balances.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-slate-400 italic">No balances.</td></tr>}
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
