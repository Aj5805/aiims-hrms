import { useState } from 'react';
import { useAuthStore } from '../stores';
import { usersApi, authApi } from '../api/endpoints';

export function ImpersonationFab() {
  const role = useAuthStore((s) => s.user?.role);
  const adminToken = useAuthStore((s) => s.adminToken);
  const startImpersonation = useAuthStore((s) => s.startImpersonation);
  const [isOpen, setIsOpen] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  // Only render for ADMIN users who are NOT currently impersonating
  if (role !== 'ADMIN' || adminToken) return null;

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await usersApi.list();
      setUsers(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    fetchUsers();
  };

  const handleImpersonate = async (userId: string) => {
    try {
      const res = await authApi.impersonate(userId);
      startImpersonation(res.data.access_token, res.data.user);
      setIsOpen(false);
      window.location.href = '/';
    } catch (err) {
      alert('Failed to impersonate user.');
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
      <button
        onClick={handleOpen}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300"
        title="Login As..."
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">Login As User</h2>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <input
                type="text"
                placeholder="Search by name, username, or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="p-6 text-center text-sm text-slate-500">Loading users...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500">No active non-admin users found.</div>
              ) : (
                <ul className="space-y-1">
                  {filteredUsers.map((u) => (
                    <li key={u.id}>
                      <button
                        onClick={() => handleImpersonate(u.id)}
                        className="w-full text-left px-4 py-3 rounded-lg hover:bg-indigo-50 flex items-center justify-between transition-colors"
                      >
                        <div>
                          <div className="font-semibold text-slate-800 text-sm">
                            {u.employee ? `${u.employee.first_name} ${u.employee.last_name}` : u.username}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">{u.username} • {u.role}</div>
                        </div>
                        <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-100 px-2 py-1 rounded">Login</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
