import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuthStore } from './stores';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import MastersPage from './pages/MastersPage';
import { OpeningBalancePage } from './pages/Phase3Pages';
import { MastersRedirect } from './components/MastersRedirect';
import { ApplyLeavePage, MyApplicationsPage, ApprovalInboxPage } from './pages/Phase4Pages';
import { MyLeaveAccountPage, YearEndProcessingPage } from './pages/Phase5Pages';
import { NotificationBell, ReportsPage } from './pages/Phase678Pages';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import StaffProfilePage from './pages/StaffProfilePage';
import ProfileDashboardPage from './pages/ProfileDashboardPage';
import LeaveDashboardPage from './pages/LeaveDashboardPage';
import ClaimsDashboardPage from './pages/ClaimsDashboardPage';
import PayrollDashboardPage from './pages/PayrollDashboardPage';
import PerformanceDashboardPage from './pages/PerformanceDashboardPage';
import HomeDashboardPage from './pages/HomeDashboardPage';
import HodDashboardPage from './pages/HodDashboardPage';
import ApproverDashboardPage from './pages/ApproverDashboardPage';
import { LoginActivityPage, ForecastingPage, BalanceOverviewPage, TeamLeavePage } from './pages/RoleFeaturePages';
import { authApi } from './api/endpoints';
import { PageHeader } from './components/PageHeader';
import AdminToolsPage from './pages/AdminToolsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { BroadcastBanner } from './components/BroadcastBanner';
const REPORT_ROLES = ['ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'NODAL_OFFICER', 'NODAL_OFFICE'] as const;
const ADMIN_ROLES = ['ADMIN'] as const;
const CONFIG_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR'] as const;
const EMPLOYEE_MASTER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'NODAL_OFFICER', 'NODAL_OFFICE'] as const;
const APPROVER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'HOD', 'DEAN_ACADEMIC', 'NODAL_OFFICER'] as const;
const TEAM_VIEW_ROLES = ['HOD', 'NODAL_OFFICER', 'ADMIN', 'ESTABLISHMENT_OFFICER'] as const;

function hasRole(role: string | undefined, allowed: readonly string[]) {
  return !!role && allowed.includes(role);
}

function UnderConstructionPage({ title, breadcrumbs }: { title: string, breadcrumbs: { label: string, to?: string }[] }) {
  return (
    <div className="space-y-6">
      <PageHeader 
        breadcrumbs={breadcrumbs}
        title={title}
      />
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-xl shadow-sm border border-slate-200">
        <svg className="w-16 h-16 text-amber-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">{title}</h2>
        <p className="text-slate-500 max-w-md">This module is currently under development as per CCS / AIIMS HMIS scope. Check back in a future update!</p>
      </div>
    </div>
  );
}

function NavDropdown({ title, landingPath, items }: { title: string, landingPath?: string, items: { label: string, path: string }[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [top, setTop] = useState(0);

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (window.innerWidth >= 768) {
      const rect = e.currentTarget.getBoundingClientRect();
      setTop(rect.top);
      setIsOpen(true);
    }
  };

  return (
    <>
      {/* Desktop Flyout */}
      <div
        className="hidden md:block"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setIsOpen(false)}
      >
        <div className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-800 hover:text-white rounded-md transition-colors">
          {landingPath ? (
            <Link to={landingPath} className="flex-1 truncate">{title}</Link>
          ) : (
            <span className="flex-1 truncate">{title}</span>
          )}
          <svg className="w-3 h-3 ml-1 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </div>

        {isOpen && (
          <div className="fixed z-50" style={{ top: top, left: '14rem' }}>
            {/* Invisible hover bridge */}
            <div className="absolute inset-y-0 right-full w-4 bg-transparent" />
            <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl py-2 w-52 animate-in fade-in slide-in-from-left-1 duration-150">
              {/* Invisible hover bridge */}
              <div className="absolute inset-y-0 right-full w-4 bg-transparent" />
              {items.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mobile Accordion */}
      <details className="md:hidden group [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-800 hover:text-white rounded-md transition-colors list-none">
          {landingPath ? (
            <Link to={landingPath} className="flex-1 truncate" onClick={(e) => e.stopPropagation()}>{title}</Link>
          ) : (
            <span className="flex-1 truncate">{title}</span>
          )}
          <svg className="w-3 h-3 ml-1 opacity-50 transition-transform group-open:rotate-90 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </summary>
        <div className="pl-5 pr-2 py-1 space-y-0.5">
          {items.map(item => (
            <Link key={item.path} to={item.path} className="block px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
              {item.label}
            </Link>
          ))}
        </div>
      </details>
    </>
  );
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
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(user.role, allowedRoles)) return <RouteDenied message={fallback} />;
  return <>{children}</>;
}

function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const adminToken = useAuthStore((s) => s.adminToken);
  const adminUser = useAuthStore((s) => s.adminUser);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const role = user?.role;
  const showNotificationBell = !!user && !user.must_change_password && location.pathname !== '/change-password';

  useEffect(() => {
    if (user?.must_change_password && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
    }
  }, [user, location.pathname, navigate]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      // ignore
    }
    clearAuth();
    navigate('/login');
  };

  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden flex-col">
      <BroadcastBanner />
      
      {/* Impersonation Banner */}
      {adminToken && adminUser && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between shadow-md z-50 shrink-0">
          <div className="flex items-center gap-2 text-sm font-bold">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>You are impersonating {user?.username} ({user?.role})</span>
          </div>
          <button
            onClick={() => {
              stopImpersonation();
              setTimeout(() => {
                window.location.href = '/admin';
              }, 100);
            }}
            className="bg-amber-950 text-amber-400 hover:bg-amber-900 px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Return to Admin
          </button>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-20 md:hidden backdrop-blur-sm"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:static md:translate-x-0 shadow-xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo Area */}
        <div className="h-14 flex items-center px-5 border-b border-slate-800 shrink-0">
          <Link to="/" className="text-sm font-bold text-white tracking-tight truncate">
            {isAdminRoute ? 'HRMS (Admin)' : 'HRMS'}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {isAdminRoute && role !== 'ADMIN' ? (
            <Link to="/" className="flex items-center px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white rounded-md transition-colors">
              ← Exit Admin
            </Link>
          ) : user && (
            <>
              {role !== 'ADMIN' && (
                <>
                  <NavDropdown title="My Profile" landingPath="/profile-dashboard" items={[
                    { label: 'e-Service Book', path: '/profile' },
                    { label: 'Login Activity', path: '/login-activity' },
                    { label: 'Family & Dependents', path: '/dependents' }
                  ]} />
                  <NavDropdown title="Leave & Attendance" landingPath="/leave-dashboard" items={[
                    { label: 'Apply for Leave', path: '/apply' },
                    { label: 'My Applications', path: '/my-apps' },
                    { label: 'Leave Ledger', path: '/leave-account' },
                    { label: 'Holiday Calendar', path: '/holidays-calendar' },
                    { label: 'My Attendance', path: '/attendance' },
                    { label: 'Punch History', path: '/punches' }
                  ]} />
                  <NavDropdown title="Claims & Advances" landingPath="/claims" items={[
                    { label: 'LTC Claim', path: '/claims/ltc' },
                    { label: 'CEA (Education)', path: '/claims/cea' },
                    { label: 'EHS Reimbursement', path: '/claims/ehs' },
                    { label: 'TA/DA', path: '/claims/ta' },
                    { label: 'Telephone', path: '/claims/telephone' }
                  ]} />
                  <NavDropdown title="Payroll & Finance" landingPath="/payroll" items={[
                    { label: 'Salary Slips', path: '/payroll/slips' },
                    { label: 'Annual Summary', path: '/payroll/summary' },
                    { label: 'Form 16 & Tax', path: '/payroll/form16' }
                  ]} />
                  <NavDropdown title="Performance" landingPath="/performance" items={[
                    { label: 'My APAR', path: '/performance/apar' },
                    { label: 'Training Logs', path: '/performance/training' }
                  ]} />
                </>
              )}

              {role !== 'STAFF' && role !== 'ADMIN' && (
                <NavDropdown title="Nodal Desk" landingPath="/hod" items={[
                  { label: 'HOD Dashboard', path: '/hod' },
                  { label: 'Approval Inbox', path: '/approvals' },
                  ...(hasRole(role, TEAM_VIEW_ROLES) ? [
                    { label: 'Team Balances', path: '/team-leave' },
                    { label: 'Availability Forecast', path: '/forecast' },
                  ] : []),
                  { label: 'Team Calendar', path: '/team-calendar' },
                  { label: 'Delegation', path: '/delegation' }
                ]} />
              )}

              {/* Divider */}
              {hasRole(role, EMPLOYEE_MASTER_ROLES) && role !== 'ADMIN' && <div className="border-t border-slate-800 my-1.5" />}

              {hasRole(role, ADMIN_ROLES) && role === 'ADMIN' && (
                <NavDropdown title="Admin Console" landingPath="/admin" items={[
                  { label: 'Dashboard', path: '/admin' },
                  { label: 'Leave Policy Matrix', path: '/admin?module=policy' },
                  { label: 'Users & Roles', path: '/admin?module=users' },
                  { label: 'Audit & Health', path: '/admin?module=audit' },
                ]} />
              )}

              {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
                <NavDropdown title="HR Operations" items={[
                  { label: 'Employee Directory', path: '/employees?tab=directory' },
                  { label: 'Onboard Employee', path: '/employees?tab=onboard' },
                  ...(hasRole(role, REPORT_ROLES) ? [{ label: 'Balance Overview', path: '/balance-overview' }] : []),
                ]} />
              )}

              {hasRole(role, CONFIG_ROLES) && (
                <NavDropdown title="Masters" landingPath="/masters" items={[
                  { label: 'Departments', path: '/masters?tab=dept' },
                  { label: 'Designations', path: '/masters?tab=desg' },
                  { label: 'Nodal Assignments', path: '/masters?tab=assignments' },
                  { label: 'HOD Assignments', path: '/masters?tab=hod-assignments' },
                  { label: 'Leave Types', path: '/masters?tab=leave-types' },
                  { label: 'Entitlements', path: '/masters?tab=entitlements' },
                  { label: 'Holidays', path: '/masters?tab=holidays' },
                  { label: 'Workflows', path: '/masters?tab=workflows' },
                ]} />
              )}

              {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
                <NavDropdown title="Reports & Data" items={[
                  { label: 'Reports', path: '/reports' },
                  ...(hasRole(role, CONFIG_ROLES) ? [
                    { label: 'Year-End', path: '/year-end' },
                    { label: 'Opening Balances', path: '/balances' },
                  ] : []),
                ]} />
              )}

              {hasRole(role, ADMIN_ROLES) && role === 'ADMIN' && (
                <>
                  <div className="border-t border-slate-800 my-1.5" />
                  <NavDropdown title="Admin Tools" items={[
                    { label: 'Maintenance Mode', path: '/admin/tools/maintenance' },
                    { label: 'Broadcasts', path: '/admin/tools/broadcast' },
                    { label: 'Workflow Diagnostics', path: '/admin/tools/workflow' },
                    { label: 'Bulk Roles', path: '/admin/tools/roles' },
                  ]} />
                </>
              )}
            </>
          )}
        </nav>

        {/* Bottom Actions */}
        <div className="p-4 shrink-0 space-y-3 border-t border-slate-800">

          {user && (
            <button onClick={logout} className="flex items-center justify-center gap-2 w-full rounded-lg bg-slate-800 border border-slate-700 hover:bg-rose-600 hover:border-rose-500 px-3 py-2 text-sm font-medium text-slate-400 hover:text-white transition-all" title="Logout">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-5 shrink-0 z-10 sticky top-0 shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 hover:text-slate-800 md:hidden transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            <span className="font-bold text-slate-800 text-sm md:hidden">{isAdminRoute ? 'Admin Console' : 'HRMS'}</span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {showNotificationBell && <NotificationBell />}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-800 leading-none">{(user as any).username}</p>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">{(user as any).role?.replace(/_/g, ' ')}</p>
                </div>
                <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                  {((user as any).username || 'U')[0].toUpperCase()}
                </div>
                <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors" title="Logout">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Page Content — single consistent wrapper, no per-page overrides */}
        <main className="flex-1 overflow-y-auto">
          <div className="w-full max-w-screen-xl mx-auto px-5 py-6 md:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  </div>
);
}

export default function App() {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  
  useEffect(() => {
    if (token) {
      authApi.me().catch(() => {
        clearAuth();
      });
    }
  }, [token, clearAuth]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/*" element={
        token ? (
          <Layout>
            <Routes>
            <Route path="/" element={role === 'ADMIN' ? <Navigate to="/admin" replace /> : <HomeDashboardPage />} />
            <Route path="/employees" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} fallback="Access restricted."><EmployeeListPage /></RoleRoute>} />
            <Route path="/masters" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><MastersPage /></RoleRoute>} />
            <Route path="/apply" element={<ApplyLeavePage />} />
            <Route path="/my-apps" element={<MyApplicationsPage />} />
            <Route path="/approver-dashboard" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Approver Dashboard."><ApproverDashboardPage /></RoleRoute>} />
            <Route path="/hod" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have a Nodal Dashboard."><HodDashboardPage /></RoleRoute>} />
            <Route path="/approvals" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Inbox."><ApprovalInboxPage /></RoleRoute>} />
            <Route path="/leave-account" element={<MyLeaveAccountPage />} />
            <Route path="/login-activity" element={<LoginActivityPage />} />
            <Route path="/team-leave" element={<RoleRoute allowedRoles={TEAM_VIEW_ROLES} fallback="Team balances are for HOD and Nodal Officer roles."><TeamLeavePage /></RoleRoute>} />
            <Route path="/forecast" element={<RoleRoute allowedRoles={TEAM_VIEW_ROLES} fallback="Forecast is for HOD and Nodal Officer roles."><ForecastingPage /></RoleRoute>} />
            <Route path="/balance-overview" element={<RoleRoute allowedRoles={REPORT_ROLES} fallback="Balance overview requires report access."><BalanceOverviewPage /></RoleRoute>} />
            <Route path="/year-end" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Year-End processing is limited to ADMIN and ESTABLISHMENT_OFFICER."><YearEndProcessingPage /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute allowedRoles={REPORT_ROLES} fallback="Reports are limited to ESTABLISHMENT_OFFICER, REGISTRAR, and DIRECTOR."><ReportsPage /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminDashboardPage /></RoleRoute>} />
            <Route path="/admin/tools/:tool" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminToolsPage /></RoleRoute>} />
            <Route path="/leave-types" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><MastersRedirect tab="leave-types" /></RoleRoute>} />
            <Route path="/entitlements" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><MastersRedirect tab="entitlements" /></RoleRoute>} />
            <Route path="/holidays" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><MastersRedirect tab="holidays" /></RoleRoute>} />
            <Route path="/workflows" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><MastersRedirect tab="workflows" /></RoleRoute>} />
            <Route path="/balances" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Opening balances are limited to ADMIN, ESTABLISHMENT_OFFICER, and REGISTRAR."><OpeningBalancePage /></RoleRoute>} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/profile-dashboard" element={<ProfileDashboardPage />} />
            <Route path="/profile" element={<StaffProfilePage />} />
            <Route path="/leave-dashboard" element={<LeaveDashboardPage />} />
            
            {/* Future HMIS Modules Placeholders */}
            <Route path="/claims" element={<ClaimsDashboardPage />} />
            <Route path="/payroll" element={<PayrollDashboardPage />} />
            <Route path="/performance" element={<PerformanceDashboardPage />} />
            
            <Route path="/dependents" element={<UnderConstructionPage title="Family & Dependents" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Profile', to: '/profile-dashboard' }, { label: 'Family & Dependents' }]} />} />
            <Route path="/holidays-calendar" element={<UnderConstructionPage title="Holiday Calendar" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Holiday Calendar' }]} />} />
            <Route path="/attendance" element={<UnderConstructionPage title="My Attendance" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'My Attendance' }]} />} />
            <Route path="/punches" element={<UnderConstructionPage title="Punch History" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Punch History' }]} />} />
            
            {/* Claims & Advances */}
            <Route path="/claims/ltc" element={<UnderConstructionPage title="LTC Claim" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'LTC Claim' }]} />} />
            <Route path="/claims/cea" element={<UnderConstructionPage title="CEA (Education)" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'CEA (Education)' }]} />} />
            <Route path="/claims/ehs" element={<UnderConstructionPage title="EHS Reimbursement" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'EHS Reimbursement' }]} />} />
            <Route path="/claims/ta" element={<UnderConstructionPage title="TA/DA" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'TA/DA' }]} />} />
            <Route path="/claims/telephone" element={<UnderConstructionPage title="Telephone & Internet" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'Telephone & Internet' }]} />} />

            {/* Payroll & Finance */}
            <Route path="/payroll/slips" element={<UnderConstructionPage title="Salary Slips" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Salary Slips' }]} />} />
            <Route path="/payroll/summary" element={<UnderConstructionPage title="Annual Summary" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Annual Summary' }]} />} />
            <Route path="/payroll/form16" element={<UnderConstructionPage title="Form 16 & Tax" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Form 16 & Tax' }]} />} />

            {/* Performance */}
            <Route path="/performance/apar" element={<UnderConstructionPage title="My APAR" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Performance', to: '/performance' }, { label: 'My APAR' }]} />} />
            <Route path="/performance/training" element={<UnderConstructionPage title="Training Logs" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Performance', to: '/performance' }, { label: 'Training Logs' }]} />} />
            
            <Route path="/team-calendar" element={<Navigate to="/forecast" replace />} />
            <Route path="/delegation" element={<UnderConstructionPage title="Delegation" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Approvals', to: '/approver-dashboard' }, { label: 'Delegation' }]} />} />
          </Routes>
          </Layout>
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
  );
}
