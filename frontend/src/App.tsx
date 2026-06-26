import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
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
import StaffProfilePage from './pages/StaffProfilePage';
import { authApi } from './api/endpoints';

const REPORT_ROLES = ['ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR'] as const;
const ADMIN_ROLES = ['ADMIN'] as const;
const CONFIG_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR'] as const;
const EMPLOYEE_MASTER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'HOD', 'DEAN_ACADEMIC'] as const;
const APPROVER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'HOD', 'DEAN_ACADEMIC', 'NODAL_OFFICER'] as const;

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

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#F0F4F8]">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold text-blue-800">
              {isAdminRoute ? 'AIIMS HRMS (Admin Console)' : 'AIIMS HRMS'}
            </h1>
            {user && (
              <nav className="flex gap-3 text-sm flex-wrap items-center">
                {isAdminRoute ? (
                  <Link to="/" className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1">
                    &larr; Exit Admin Console (Main Portal)
                  </Link>
                ) : (
                  <>
                    {hasRole(role, EMPLOYEE_MASTER_ROLES) && <Link to="/" className="text-gray-600 hover:text-blue-600 font-medium">Employees</Link>}
                    {hasRole(role, EMPLOYEE_MASTER_ROLES) && <Link to="/masters" className="text-gray-600 hover:text-blue-600 font-medium">Masters</Link>}
                    {hasRole(role, CONFIG_ROLES) && <Link to="/year-end" className="text-gray-600 hover:text-blue-600 font-medium">Year-End</Link>}
                    {hasRole(role, REPORT_ROLES) && <Link to="/reports" className="text-gray-600 hover:text-blue-600 font-medium">Reports</Link>}
                    {hasRole(role, ADMIN_ROLES) && <Link to="/admin" className="text-gray-600 hover:text-blue-600 font-medium">Admin</Link>}
                    
                    {hasRole(role, CONFIG_ROLES) && (
                      <div className="group relative">
                        <span className="text-gray-600 font-medium cursor-pointer hover:text-blue-600">Config &darr;</span>
                        <div className="absolute hidden group-hover:block bg-white border shadow-lg mt-1 rounded py-2 w-32 z-50">
                          <Link to="/leave-types" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Types</Link>
                          <Link to="/entitlements" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Rules</Link>
                          <Link to="/holidays" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Holidays</Link>
                          <Link to="/workflows" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Workflows</Link>
                          <Link to="/balances" className="block px-4 py-1 text-gray-600 hover:bg-gray-50">Opening Bal</Link>
                        </div>
                      </div>
                    )}

                    {role !== 'STAFF' && <Link to="/inbox" className="text-orange-600 hover:text-orange-800 font-bold ml-2">Inbox</Link>}

                    <div className="ml-auto flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                      <Link to="/apply" className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-700 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all">Apply for Leave</Link>
                      <Link to="/my-apps" className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-700 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all">My Applications</Link>
                      <Link to="/leave-account" className="px-3 py-1.5 text-sm font-semibold rounded-lg text-slate-700 hover:bg-white hover:text-blue-700 hover:shadow-sm transition-all">Leave Account</Link>
                      <div className="w-px h-4 bg-slate-300 mx-1"></div>
                      <Link to="/profile" className="px-4 py-1.5 text-sm font-bold rounded-lg bg-blue-600 text-white shadow-sm hover:bg-blue-700 transition-all flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Profile
                      </Link>
                    </div>
                  </>
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
  const role = useAuthStore((s) => s.user?.role);
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        <Layout>
          <Routes>
            <Route path="/" element={hasRole(role, EMPLOYEE_MASTER_ROLES) ? <EmployeeListPage /> : <Navigate to="/leave-account" replace />} />
            <Route path="/masters" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} fallback="Masters access is restricted."><MastersPage /></RoleRoute>} />
            <Route path="/apply" element={<ApplyLeavePage />} />
            <Route path="/my-apps" element={<MyApplicationsPage />} />
            <Route path="/inbox" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Inbox."><ApprovalInboxPage /></RoleRoute>} />
            <Route path="/leave-account" element={<MyLeaveAccountPage />} />
            <Route path="/year-end" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Year-End processing is limited to ADMIN and ESTABLISHMENT_OFFICER."><YearEndProcessingPage /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute allowedRoles={REPORT_ROLES} fallback="Reports are limited to ESTABLISHMENT_OFFICER, REGISTRAR, and DIRECTOR."><ReportsPage /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminDashboardPage /></RoleRoute>} />
            <Route path="/leave-types" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><LeaveTypesPage /></RoleRoute>} />
            <Route path="/entitlements" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><EntitlementRulesPage /></RoleRoute>} />
            <Route path="/holidays" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><HolidayPage /></RoleRoute>} />
            <Route path="/workflows" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><WorkflowPage /></RoleRoute>} />
            <Route path="/balances" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Configuration pages are limited to ADMIN and ESTABLISHMENT_OFFICER."><OpeningBalancePage /></RoleRoute>} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/profile" element={<StaffProfilePage />} />
          </Routes>
        </Layout>
      } />
    </Routes>
  );
}
