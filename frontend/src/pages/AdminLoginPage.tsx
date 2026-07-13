import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/endpoints';
import { useAuthStore } from '../stores';

export default function AdminLoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await authApi.login(username, password);
      
      // Strict role validation for Admin Login
      if (data.user.role !== 'ADMIN') {
        // Log them out immediately if they aren't an admin
        await authApi.logout().catch(() => {});
        clearAuth();
        setError('Unauthorized: Admin access required.');
        setLoading(false);
        return;
      }

      localStorage.setItem('access_token', data.access_token);
      setAuth(data.access_token, data.user);
      
      if (data.user.must_change_password) {
        navigate('/change-password');
      } else {
        navigate('/admin');
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4 relative overflow-hidden">
      {/* Decorative background grids and blurs for a stark "Admin" feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-red-900/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-indigo-900/20 rounded-full blur-[100px]" />
      
      <div className="w-full max-w-md relative z-10">
        <div className="bg-zinc-900/80 backdrop-blur-2xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-800 ring-1 ring-white/5">
          <div className="bg-black/60 p-8 text-center border-b border-zinc-800">
            <div className="w-16 h-16 bg-red-950/50 rounded-xl flex items-center justify-center mx-auto mb-4 border border-red-900/50 shadow-inner rotate-3">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-wide">HRMS</h1>
            <p className="text-red-500 text-xs mt-2 font-bold tracking-[0.2em] uppercase">System Administration</p>
          </div>
          
          <div className="p-8 bg-zinc-900/60">
            <h2 className="text-lg font-medium text-zinc-300 mb-6 text-center tracking-wide">Secure Admin Portal</h2>
            
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-200 p-4 rounded-xl mb-6 text-sm flex items-start shadow-sm backdrop-blur-md">
                <svg className="w-5 h-5 mr-2 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="username" className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Admin ID</label>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none transition-all shadow-inner text-white placeholder-zinc-600"
                  required
                  autoFocus
                  placeholder="Enter admin username"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/50 border border-zinc-800 rounded-xl px-4 py-3 focus:ring-2 focus:ring-red-500/50 focus:border-red-500/50 outline-none transition-all shadow-inner text-white placeholder-zinc-600"
                  required
                  placeholder="••••••••"
                />
              </div>
              
              <div className="pt-4">
                <button
                  id="login-submit"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-zinc-100 hover:bg-white text-zinc-900 py-3 rounded-xl font-bold transition-all duration-300 shadow-lg hover:shadow-white/20 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 flex justify-center items-center"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Authenticating...
                    </>
                  ) : 'Enter Console'}
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-black/80 py-4 text-center border-t border-zinc-800">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 text-red-500/80" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Protected • Monitored
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
