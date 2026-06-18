import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from './stores';
import LoginPage from './pages/LoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import MastersPage from './pages/MastersPage';
import { LeaveTypesPage, EntitlementRulesPage, HolidayPage, WorkflowPage, OpeningBalancePage } from './pages/Phase3Pages';
import { ApplyLeavePage, MyApplicationsPage, ApprovalInboxPage } from './pages/Phase4Pages';
import { MyLeaveAccountPage, YearEndProcessingPage } from './pages/Phase5Pages';
import { AdminDashboardPage, NotificationBell, ReportsPage } from './pages/Phase678Pages';
import ChangePasswordPage from './pages/ChangePasswordPage';
import { authApi } from './api/endpoints';

const REPORT_ROLES = ['ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR'] as const;
const ADMIN_ROLES = ['ADMIN'] as const;
const CONFIG_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER'] as const;

function hasRole(role: string | undefined, allowed: readonly string[]) {
  return !!role && allowed.includes(role);
}

function RouteDenied({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
      {message}
    </div>
  );
}

function RoleRoute({
  allowedRoles,
  children,
  fallback,
}: {
  allowedRoles: readonly string[];
  children: ReactNode;
  fallback: string;
}) {
  const role = useAuthStore((s) => s.user?.role);
  if (!hasRole(role, allowedRoles)) {
    return <RouteDenied message={fallback} />;
  }
  return <>{children}</>;
}

function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const navigate = useNavigate();
  const location = useLocation();
  const role = user?.role;
  const showNotificationBell = !!user && !user.must_change_password && location.pathname !== '/change-password';

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
                {hasRole(role, REPORT_ROLES) && <Link to="/reports" className="text-gray-600 hover:text-blue-600">Reports</Link>}
                {hasRole(role, ADMIN_ROLES) && <Link to="/admin" className="text-gray-600 hover:text-blue-600">Admin</Link>}
                <span className="text-gray-300">|</span>
                {hasRole(role, CONFIG_ROLES) && (
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
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-4">
            {showNotificationBell && <NotificationBell />}
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
            <Route path="/reports" element={<RoleRoute allowedRoles={REPORT_ROLES} fallback="Reports are limited to ESTABLISHMENT_OFFICER, REGISTRAR, and DIRECTOR."><ReportsPage /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminDashboardPage /></RoleRoute>} />
            <Route path="/leave-types" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><LeaveTypesPage /></RoleRoute>} />
            <Route path="/entitlements" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><EntitlementRulesPage /></RoleRoute>} />
            <Route path="/holidays" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><HolidayPage /></RoleRoute>} />
            <Route path="/workflows" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><WorkflowPage /></RoleRoute>} />
            <Route path="/balances" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><OpeningBalancePage /></RoleRoute>} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
