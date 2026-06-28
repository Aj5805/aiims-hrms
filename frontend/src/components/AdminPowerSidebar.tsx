import { useState } from 'react';
import { useAuthStore } from '../stores';
import { usersApi, authApi, adminApi, broadcastsApi } from '../api/endpoints';
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

export function AdminPowerSidebar() {
  const role = useAuthStore((s) => s.user?.role);
  const adminToken = useAuthStore((s) => s.adminToken);
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'impersonate' | 'maintenance' | 'broadcast'>('impersonate');

  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [newBroadcastMsg, setNewBroadcastMsg] = useState('');
  const [newBroadcastType, setNewBroadcastType] = useState('info');
  const [broadcastLoading, setBroadcastLoading] = useState(false);

  // Only render for ADMIN users who are NOT currently impersonating
  if (role !== 'ADMIN' || adminToken) return null;

  const fetchUsers = async () => {
    try {
      setLoadingUsers(true);
      const res = await usersApi.list();
      setUsers(res.data || []);
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

  const handleOpen = () => {
    setIsOpen(true);
    fetchUsers();
    fetchMaintenance();
    fetchBroadcasts();
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await authApi.impersonate(userId);
      startImpersonation(res.data.access_token, res.data.user);
      setIsOpen(false);
      setTimeout(() => {
        window.location.href = '/';
      }, 100);
    } catch (err) {
      alert('Failed to impersonate user.');
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

  const filteredUsers = users.filter((u) => {
    const s = search.toLowerCase();
    return (
      (u.username && u.username.toLowerCase().includes(s)) ||
      (u.employee?.first_name && u.employee.first_name.toLowerCase().includes(s)) ||
      (u.employee?.last_name && u.employee.last_name.toLowerCase().includes(s)) ||
      (u.role && u.role.toLowerCase().includes(s))
    );
  }).filter(u => u.role !== 'ADMIN' && u.is_active !== false);

  return (
    <>
      <div className="mt-4 pt-4 border-t border-slate-800 space-y-1">
        <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Admin Powers</div>
        <button
          onClick={() => { setActiveTab('impersonate'); handleOpen(); }}
          className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          Impersonate
        </button>
        <button
          onClick={() => { setActiveTab('maintenance'); handleOpen(); }}
          className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Maintenance Mode
        </button>
        <button
          onClick={() => { setActiveTab('broadcast'); handleOpen(); }}
          className="w-full text-left flex items-center px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white rounded-md transition-colors"
        >
          <svg className="w-4 h-4 mr-2 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          Broadcasts
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
          <div className="flex h-full max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {activeTab === 'impersonate' && 'Login As User'}
                  {activeTab === 'maintenance' && 'System Maintenance'}
                  {activeTab === 'broadcast' && 'Broadcast Manager'}
                </h2>
                <p className="text-sm text-slate-500 mt-1">Superuser actions and system overrides</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap border-b border-slate-100 px-2 bg-slate-50 shrink-0">
              <button
                onClick={() => setActiveTab('impersonate')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'impersonate' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Impersonate
              </button>
              <button
                onClick={() => setActiveTab('maintenance')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'maintenance' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Maintenance Mode
              </button>
              <button
                onClick={() => setActiveTab('broadcast')}
                className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'broadcast' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
              >
                Broadcasts
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50/30 p-6">
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
            </div>
          </div>
        </div>
      )}
    </>
  );
}
