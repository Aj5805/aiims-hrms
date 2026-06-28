import { useState, useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useAuthStore } from '../stores';
import { usersApi, authApi, adminApi, broadcastsApi } from '../api/endpoints';
import { PageHeader } from '../components/PageHeader';

function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d);
}

export default function AdminToolsPage() {
  const { tool } = useParams<{ tool: string }>();
  const activeTab = tool || 'impersonate';

  const role = useAuthStore((s) => s.user?.role);
  const adminToken = useAuthStore((s) => s.adminToken);
  const startImpersonation = useAuthStore((s) => s.startImpersonation);

  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [roleAssignments, setRoleAssignments] = useState<Record<string, string>>({});
  const [savingRoles, setSavingRoles] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);

  const [workflowLeaveId, setWorkflowLeaveId] = useState('');
  const [workflowDiagnostics, setWorkflowDiagnostics] = useState<any>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [workflowError, setWorkflowError] = useState('');

  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [newBroadcastMsg, setNewBroadcastMsg] = useState('');
  const [newBroadcastType, setNewBroadcastType] = useState('info');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Fetch logic
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await usersApi.list();
      setUsers(res.data || []);
      const initRoles: Record<string, string> = {};
      (res.data || []).forEach((u: any) => {
        initRoles[u.id] = u.role;
      });
      setRoleAssignments(initRoles);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchMaintenance = async () => {
    try {
      const { data } = await adminApi.getMaintenanceMode();
      setMaintenanceMode(data?.maintenance_mode || false);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBroadcasts = async () => {
    try {
      const { data } = await broadcastsApi.getAll();
      setBroadcasts(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await adminApi.auditLog({ limit: 50 });
      setAuditLogs(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'impersonate' || activeTab === 'roles') fetchUsers();
    if (activeTab === 'maintenance') fetchMaintenance();
    if (activeTab === 'broadcast') fetchBroadcasts();
    if (activeTab === 'audit') fetchAuditLogs();
  }, [activeTab]);

  // Handlers
  const handleImpersonate = async (userId: string) => {
    try {
      const res = await authApi.impersonate(userId);
      startImpersonation(res.data.access_token, res.data.user);
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (err) {
      alert('Failed to impersonate user.');
    }
  };

  const handleSaveBulkRoles = async () => {
    try {
      setSavingRoles(true);
      const assignments = Object.entries(roleAssignments).map(([user_id, r]) => ({ user_id, role: r }));
      const changedAssignments = assignments.filter(a => {
        const original = users.find(u => u.id === a.user_id);
        return original && original.role !== a.role;
      });
      
      if (changedAssignments.length === 0) {
        alert('No changes to save.');
        return;
      }
      
      await adminApi.bulkRoles(changedAssignments);
      await fetchUsers();
      alert(`Successfully updated ${changedAssignments.length} roles!`);
    } catch (err) {
      alert('Failed to save roles.');
    } finally {
      setSavingRoles(false);
    }
  };

  const toggleMaintenance = async () => {
    try {
      setMaintenanceLoading(true);
      const nextState = !maintenanceMode;
      await adminApi.toggleMaintenanceMode(nextState);
      setMaintenanceMode(nextState);
    } catch (err) {
      alert('Failed to toggle maintenance mode.');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const handleCreateBroadcast = async () => {
    if (!newBroadcastMsg) return;
    try {
      setBroadcastLoading(true);
      await broadcastsApi.create({ message: newBroadcastMsg, type: newBroadcastType });
      setNewBroadcastMsg('');
      await fetchBroadcasts();
    } catch (err) {
      alert('Failed to create broadcast.');
    } finally {
      setBroadcastLoading(false);
    }
  };

  const toggleBroadcast = async (id: string, currentStatus: boolean) => {
    try {
      await broadcastsApi.update(id, { is_active: !currentStatus });
      await fetchBroadcasts();
    } catch (err) {
      alert('Failed to update broadcast.');
    }
  };

  const handleFetchWorkflow = async () => {
    if (!workflowLeaveId) return;
    try {
      setWorkflowLoading(true);
      setWorkflowError('');
      setWorkflowDiagnostics(null);
      const { data } = await adminApi.getWorkflowDiagnostics(workflowLeaveId);
      if (data.error) {
        setWorkflowError(data.error);
      } else {
        setWorkflowDiagnostics(data);
      }
    } catch (err) {
      setWorkflowError('Failed to fetch diagnostics.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleOverrideWorkflow = async () => {
    if (!workflowLeaveId) return;
    try {
      setWorkflowLoading(true);
      await adminApi.overrideWorkflow(workflowLeaveId);
      await handleFetchWorkflow();
      alert('Application forcefully approved.');
    } catch (err) {
      alert('Failed to override workflow.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.username && u.username.toLowerCase().includes(s)) ||
      (u.employee?.first_name && u.employee.first_name.toLowerCase().includes(s)) ||
      (u.employee?.last_name && u.employee.last_name.toLowerCase().includes(s)) ||
      (u.role && u.role.toLowerCase().includes(s))
    );
  }).filter(u => u.role !== 'ADMIN' && u.is_active !== false);

  if (role !== 'ADMIN' || adminToken) return <Navigate to="/" replace />;

  const titles: Record<string, string> = {
    impersonate: 'Login As User',
    maintenance: 'System Maintenance',
    broadcast: 'Broadcast Manager',
    workflow: 'Workflow Diagnostics',
    audit: 'Audit Log Explorer',
    roles: 'Bulk Role Matrix'
  };

  return (
    <div className="space-y-6">
      <PageHeader 
        title={titles[activeTab] || 'Admin Tools'}
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Admin Console', to: '/admin' }, { label: titles[activeTab] || 'Tool' }]}
      />
      
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden p-6 max-w-4xl mx-auto">
        {activeTab === 'impersonate' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">Select a user to temporarily log in as them without needing their password. All actions will be audited.</p>
            <input
              type="text"
              placeholder="Search users by name, username, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
            <div className="space-y-2">
              {loadingUsers ? (
                <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Loading users...</div>
              ) : (
                filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300"
                  >
                    <div>
                      <div className="font-medium text-slate-900">
                        {u.employee?.first_name} {u.employee?.last_name}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {u.username} &middot; {u.role}
                      </div>
                    </div>
                    <button
                      onClick={() => handleImpersonate(u.id)}
                      className="rounded-lg bg-indigo-50 px-4 py-2 text-xs font-bold uppercase tracking-wider text-indigo-600 transition-colors hover:bg-indigo-100 hover:text-indigo-800"
                    >
                      Login As
                    </button>
                  </div>
                ))
              )}
              {!loadingUsers && filteredUsers.length === 0 && (
                <div className="py-8 text-center text-sm text-slate-500">No active users found.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            <div className={`rounded-xl border px-5 py-4 ${maintenanceMode ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <h3 className={`font-semibold ${maintenanceMode ? 'text-red-900' : 'text-slate-800'}`}>
                {maintenanceMode ? 'Maintenance Mode is ACTIVE' : 'System is Operational'}
              </h3>
              <p className={`text-sm mt-2 ${maintenanceMode ? 'text-red-700' : 'text-slate-600'}`}>
                {maintenanceMode 
                  ? 'All non-admin users are currently locked out of the system. Active sessions will be interrupted and directed to the maintenance screen.'
                  : 'Users can log in and use the application normally.'}
              </p>
            </div>
            
            <button
              onClick={toggleMaintenance}
              disabled={maintenanceLoading}
              className={`w-full rounded-xl px-4 py-4 text-sm font-bold shadow-sm transition-colors ${
                maintenanceMode
                  ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                  : 'bg-slate-800 text-white hover:bg-slate-900'
              }`}
            >
              {maintenanceLoading ? 'Processing...' : (maintenanceMode ? 'DISABLE MAINTENANCE MODE' : 'ENABLE MAINTENANCE MODE')}
            </button>
          </div>
        )}

        {activeTab === 'broadcast' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-900 mb-3 text-sm">Publish New Broadcast</h3>
              <div className="grid gap-3">
                <input
                  type="text"
                  placeholder="Enter announcement text..."
                  value={newBroadcastMsg}
                  onChange={(e) => setNewBroadcastMsg(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <div className="flex gap-3">
                  <select
                    value={newBroadcastType}
                    onChange={(e) => setNewBroadcastType(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="info">Info (Blue)</option>
                    <option value="warning">Warning (Amber)</option>
                    <option value="error">Error (Red)</option>
                  </select>
                  <button
                    onClick={() => void handleCreateBroadcast()}
                    disabled={broadcastLoading || !newBroadcastMsg}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-medium text-slate-900 text-sm">Broadcast History</h3>
              {broadcasts.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-xl">No broadcasts found.</div>
              ) : (
                broadcasts.map((b) => (
                  <div key={b.id} className={`flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${!b.is_active ? 'opacity-60' : ''}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        {b.is_active ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        ) : (
                          <span className="inline-flex h-2 w-2 rounded-full bg-slate-300" />
                        )}
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          b.type === 'error' ? 'bg-red-100 text-red-800' :
                          b.type === 'warning' ? 'bg-amber-100 text-amber-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {b.type}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-900 font-medium">{b.message}</div>
                      <div className="mt-1 text-xs text-slate-500">{formatDateTime(b.created_at)}</div>
                    </div>
                    <button
                      onClick={() => void toggleBroadcast(b.id, b.is_active)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {b.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'workflow' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="font-medium text-slate-900 mb-3 text-sm">Fetch Leave Application</h3>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter Leave Application ID (UUID)"
                  value={workflowLeaveId}
                  onChange={(e) => setWorkflowLeaveId(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
                <button
                  onClick={() => void handleFetchWorkflow()}
                  disabled={workflowLoading || !workflowLeaveId}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  Fetch
                </button>
              </div>
              {workflowError && <p className="text-red-600 text-sm mt-3">{workflowError}</p>}
            </div>

            {workflowDiagnostics && (
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-xs text-slate-500 font-medium uppercase">App Number</p>
                    <p className="font-bold text-slate-900">{workflowDiagnostics.application.app_number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 font-medium uppercase">Status</p>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                      workflowDiagnostics.application.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                      workflowDiagnostics.application.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {workflowDiagnostics.application.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-slate-200">
                  {workflowDiagnostics.steps.map((step: any) => (
                    <div key={step.step_id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 ${
                        step.action === 'APPROVED' ? 'bg-emerald-500' : 
                        step.action === 'REJECTED' ? 'bg-red-500' : 'bg-slate-300'
                      }`}>
                        <span className="text-white text-xs font-bold">{step.step_order}</span>
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded border border-slate-200 bg-slate-50 shadow-sm">
                        <h4 className="font-semibold text-slate-800 text-sm">{step.approver_role}</h4>
                        <p className="text-xs text-slate-500 mb-2">Office: {step.approver_office || 'N/A'}</p>
                        {step.action ? (
                          <div className="text-xs text-slate-700 bg-white p-2 border border-slate-200 rounded">
                            <span className="font-medium">{step.first_name} {step.last_name}</span> 
                            <span className="text-slate-400 mx-1">&middot;</span> 
                            <span className={step.action === 'APPROVED' ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>{step.action}</span>
                            {step.remarks && <p className="italic text-slate-500 mt-1">"{step.remarks}"</p>}
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-1 bg-slate-200 text-slate-600 text-[10px] rounded font-medium">PENDING</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {workflowDiagnostics.application.status !== 'APPROVED' && workflowDiagnostics.application.status !== 'REJECTED' && (
                  <div className="pt-4 border-t border-slate-100">
                    <button
                      onClick={() => void handleOverrideWorkflow()}
                      disabled={workflowLoading}
                      className="w-full rounded-lg bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      {workflowLoading ? 'Processing...' : 'FORCE APPROVE WORKFLOW'}
                    </button>
                    <p className="text-center text-xs text-slate-500 mt-2">This will bypass remaining steps and record an Admin Override in the Audit Log.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-600">Recent system actions and overrides.</p>
              <button
                onClick={() => void fetchAuditLogs()}
                disabled={auditLoading}
                className="text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded px-2 py-1 flex items-center bg-white shadow-sm"
              >
                <svg className={`w-3 h-3 mr-1 ${auditLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>
            
            {auditLoading && auditLogs.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Loading audit logs...</div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-200">Date/Time</th>
                        <th className="px-4 py-3 border-b border-slate-200">Actor</th>
                        <th className="px-4 py-3 border-b border-slate-200">Action</th>
                        <th className="px-4 py-3 border-b border-slate-200">Entity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-8 text-center text-slate-500">No logs found.</td>
                        </tr>
                      ) : (
                        auditLogs.map((log, i) => (
                          <tr key={log.id || i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(log.created_at)}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{log.actor_id?.substring(0, 8) || 'System'}...</div>
                              {log.impersonated_by && (
                                <div className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded inline-block mt-0.5">
                                  Impersonated
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                                log.action.includes('OVERRIDE') ? 'bg-red-100 text-red-800' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-slate-900">{log.entity_type}</div>
                              <div className="text-xs text-slate-400 font-mono mt-0.5">{log.entity_id?.substring(0, 8)}...</div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <p className="text-sm text-slate-600">Quickly assign roles to multiple users at once.</p>
              <button
                onClick={() => void handleSaveBulkRoles()}
                disabled={savingRoles}
                className="text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded px-4 py-2 shadow-sm transition-colors disabled:opacity-50"
              >
                {savingRoles ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            />

            {loadingUsers ? (
              <div className="py-8 text-center text-sm text-slate-500 animate-pulse">Loading users...</div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3 border-b border-slate-200">User</th>
                        <th className="px-4 py-3 border-b border-slate-200">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredUsers.map((u) => {
                        const originalRole = u.role;
                        const currentAssignedRole = roleAssignments[u.id] || originalRole;
                        const isChanged = currentAssignedRole !== originalRole;
                        
                        return (
                          <tr key={u.id} className={`transition-colors ${isChanged ? 'bg-indigo-50/50' : 'hover:bg-slate-50'}`}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-900">{u.employee?.first_name} {u.employee?.last_name}</div>
                              <div className="text-xs text-slate-500 mt-0.5">{u.username}</div>
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={currentAssignedRole}
                                onChange={(e) => setRoleAssignments(prev => ({ ...prev, [u.id]: e.target.value }))}
                                className={`rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-900 ${
                                  isChanged ? 'border-indigo-300 bg-indigo-50 text-indigo-900 font-medium' : 'border-slate-200 bg-white'
                                }`}
                              >
                                {['STAFF', 'HOD', 'DEAN_ACADEMIC', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'ADMIN'].map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              {isChanged && <span className="ml-2 text-[10px] text-indigo-600 font-bold uppercase">Modified</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
