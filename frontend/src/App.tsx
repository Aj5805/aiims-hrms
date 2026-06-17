import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores';
import LoginPage from './pages/LoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import MastersPage from './pages/MastersPage';
import { LeaveTypesPage, EntitlementRulesPage, HolidayPage, WorkflowPage, OpeningBalancePage } from './pages/Phase3Pages';
import { ApplyLeavePage, MyApplicationsPage, ApprovalInboxPage } from './pages/Phase4Pages';
import { MyLeaveAccountPage, YearEndProcessingPage } from './pages/Phase5Pages';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { authApi } from './api/endpoints';

function Layout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user?.must_change_password && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API failures; client-side logout should still proceed.
    }
    localStorage.removeItem('access_token');
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-blue-800">AIIMS HRMS</h1>
            {user && (
              <nav className="flex gap-3 text-sm flex-wrap items-center">
                <Link to="/" className="text-gray-600 hover:text-blue-600">Employees</Link>
                <Link to="/masters" className="text-gray-600 hover:text-blue-600">Masters</Link>
                <span className="text-gray-300">|</span>
                <Link to="/apply" className="text-gray-600 hover:text-blue-600 font-medium">Apply</Link>
                <Link to="/my-apps" className="text-gray-600 hover:text-blue-600">Apps</Link>
                <Link to="/inbox" className="text-orange-600 hover:text-orange-800 font-medium">Inbox</Link>
                <span className="text-gray-300">|</span>
                <Link to="/leave-account" className="text-green-600 hover:text-green-800 font-medium">Account</Link>
                <Link to="/year-end" className="text-gray-600 hover:text-blue-600">Year-End</Link>
                <span className="text-gray-300">|</span>
                <div className="group relative">
                  <span className="text-gray-600 cursor-pointer hover:text-blue-600">Config &darr;</span>
                  <div className="absolute hidden group-hover:block bg-white border shadow-lg mt-1 rounded py-2 w-32 z-50">
                    <Link to="/leave-types" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Types</Link>
                    <Link to="/entitlements" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Rules</Link>
                    <Link to="/holidays" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Holidays</Link>
                    <Link to="/workflows" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Workflows</Link>
                    <Link to="/balances" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Opening Bal</Link>
                  </div>
                </div>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {user && <span className="text-sm text-gray-500">{(user as any).username} ({(user as any).role})</span>}
            <span className="text-sm text-gray-400">v0.5.0</span>
            {user && <button onClick={logout} className="text-sm text-red-600">Logout</button>}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={<EmployeeListPage />} />
            <Route path="/masters" element={<MastersPage />} />
            <Route path="/apply" element={<ApplyLeavePage />} />
            <Route path="/my-apps" element={<MyApplicationsPage />} />
            <Route path="/inbox" element={<ApprovalInboxPage />} />
            <Route path="/leave-account" element={<MyLeaveAccountPage />} />
            <Route path="/year-end" element={<YearEndProcessingPage />} />
            <Route path="/leave-types" element={<LeaveTypesPage />} />
            <Route path="/entitlements" element={<EntitlementRulesPage />} />
            <Route path="/holidays" element={<HolidayPage />} />
            <Route path="/workflows" element={<WorkflowPage />} />
            <Route path="/balances" element={<OpeningBalancePage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
