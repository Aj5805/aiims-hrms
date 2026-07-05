import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { useAuthStore } from './stores';
import { isImpersonatingSession } from './utils/authSession';
import LoginPage from './pages/LoginPage';
import AdminLoginPage from './pages/AdminLoginPage';
import EmployeeListPage from './pages/EmployeeListPage';
import EmployeeProfilePage from './pages/EmployeeProfilePage';
import MastersPage from './pages/MastersPage';
import { OpeningBalancePage } from './pages/OpeningBalancePage';
import { MastersRedirect } from './components/MastersRedirect';
import { ApplyLeavePage } from './pages/ApplyLeavePage';
import { AttendancePage } from './pages/AttendancePage';
import { MyApplicationsPage } from './pages/MyApplicationsPage';
import { ApprovalInboxPage } from './pages/ApprovalInboxPage';
import { MyLeaveAccountPage } from './pages/MyLeaveAccountPage';
import { YearEndProcessingPage } from './pages/YearEndProcessingPage';
import { NotificationBell } from './components/NotificationBell';
import { usePageMetaStore } from './stores/pageMeta';
import { Breadcrumbs } from './components/PageHeader';
import { ReportsPage } from './pages/ReportsPage';
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
import { ToastContainer } from './components/ToastContainer';
import {
  APPROVER_ROLES,
  CONFIG_ROLES,
  EMPLOYEE_MASTER_ROLES,
  hasSystemRole,
  HR_EDITOR_ROLES,
  REPORT_ROLES,
  TEAM_VIEW_ROLES,
} from './constants/roles';
import {
  canToggleWorkMode,
  effectiveWorkMode,
  homePathForWorkMode,
  isDeskPath,
  isStaffPersonalPath,
} from './utils/workMode';
const ADMIN_ROLES = ['ADMIN'] as const;

function hasRole(role: string | undefined, allowed: readonly string[]) {
  return !!role && allowed.includes(role);
}

function canEditHrLifecycle(role: string | undefined) {
  return hasSystemRole(role, HR_EDITOR_ROLES);
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

type NavItem = { label: string; path: string };

function NavDropdown({ title, landingPath, items }: { title: string, landingPath?: string, items: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const updateFlyoutPosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setFlyoutPos({ top: rect.top, left: rect.right });
  }, []);

  const cancelClose = () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimerRef.current = setTimeout(() => setIsOpen(false), 120);
  };

  const openFlyout = () => {
    if (window.innerWidth < 768) return;
    cancelClose();
    updateFlyoutPosition();
    setIsOpen(true);
  };

  useEffect(() => {
    return () => cancelClose();
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onReposition = () => updateFlyoutPosition();
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [isOpen, updateFlyoutPosition]);

  const flyoutPanel = isOpen && flyoutPos ? (
    <div
      className="fixed z-[60]"
      style={{ top: flyoutPos.top, left: flyoutPos.left }}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="absolute inset-y-0 right-full w-3 bg-transparent" />
      <div className="relative bg-slate-900 border border-slate-700 shadow-2xl rounded-xl py-2 w-52">
        {items.map(item => (
          <Link
            key={item.path}
            to={item.path}
            className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
            onClick={() => setIsOpen(false)}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  ) : null;

  return (
    <>
      {/* Desktop Flyout */}
      <div
        ref={triggerRef}
        className="hidden md:block"
        onMouseEnter={openFlyout}
        onMouseLeave={scheduleClose}
      >
        <div className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-800 hover:text-white rounded-md transition-colors whitespace-nowrap">
          {landingPath ? (
            <Link to={landingPath} className="flex-1 truncate">{title}</Link>
          ) : (
            <span className="flex-1 truncate">{title}</span>
          )}
          <svg className="w-3 h-3 ml-1 opacity-50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
        </div>
        {flyoutPanel && createPortal(flyoutPanel, document.body)}
      </div>

      {/* Mobile Accordion */}
      <details className="md:hidden group [&_summary::-webkit-details-marker]:hidden">
        <summary className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer hover:bg-slate-800 hover:text-white rounded-md transition-colors list-none whitespace-nowrap">
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
  requireDeskMode = false,
  requireStaffMode = false,
}: {
  allowedRoles: readonly string[];
  children: ReactNode;
  fallback: string;
  requireDeskMode?: boolean;
  requireStaffMode?: boolean;
}) {
  const user = useAuthStore((s) => s.user);
  const workMode = useAuthStore((s) => s.workMode);
  if (!user) return <Navigate to="/login" replace />;
  if (!hasRole(user.role, allowedRoles)) return <RouteDenied message={fallback} />;
  if (requireDeskMode && canToggleWorkMode(user.role, user.employee_id) && workMode !== 'desk') {
    return <RouteDenied message="Switch to Desk View to access approver pages." />;
  }
  if (requireStaffMode && canToggleWorkMode(user.role, user.employee_id) && workMode !== 'staff') {
    return <RouteDenied message="Switch to Staff View to access personal pages." />;
  }
  return <>{children}</>;
}

function StaffPersonalNav() {
  return (
    <>
      <NavDropdown title="My Profile" landingPath="/profile-dashboard" items={[
        { label: 'View Profile', path: '/profile' },
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
  );
}

function DeskNav({ role }: { role: string }) {
  return (
    <>
      <NavDropdown title="Nodal Desk" landingPath="/hod" items={[
        { label: 'Desk Dashboard', path: '/hod' },
        { label: 'Approval Inbox', path: '/approvals' },
        ...(hasRole(role, TEAM_VIEW_ROLES) ? [
          { label: 'Team Balances', path: '/team-leave' },
          { label: 'Availability Forecast', path: '/forecast' },
        ] : []),
        { label: 'Team Calendar', path: '/team-calendar' },
        { label: 'Delegation', path: '/delegation' }
      ]} />
      {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
        <NavDropdown title="HR Operations" items={[
          { label: 'Employee Directory', path: '/employees?tab=directory' },
          { label: 'Onboard Employee', path: '/employees?tab=onboard' },
          ...(canEditHrLifecycle(role) ? [
            { label: 'Employee Lifecycle', path: '/employees?tab=lifecycle' },
          ] : []),
          ...(hasRole(role, REPORT_ROLES) ? [{ label: 'Balance Overview', path: '/balance-overview' }] : []),
        ]} />
      )}
      {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
        <NavDropdown title="Reports & Data" items={[
          { label: 'Reports', path: '/reports' },
        ]} />
      )}
    </>
  );
}

function StaffPersonalRoute({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const workMode = useAuthStore((s) => s.workMode);
  if (!user) return <Navigate to="/login" replace />;
  if (canToggleWorkMode(user.role, user.employee_id) && workMode !== 'staff') {
    return <RouteDenied message="Switch to Staff View to access personal pages." />;
  }
  return <>{children}</>;
}

function HomeRoute() {
  const user = useAuthStore((s) => s.user);
  const workMode = useAuthStore((s) => s.workMode);
  const role = user?.role;
  if (role === 'ADMIN') return <Navigate to="/admin" replace />;
  if (effectiveWorkMode(role, user?.employee_id, workMode) === 'desk' && canToggleWorkMode(role, user?.employee_id)) {
    return <Navigate to="/hod" replace />;
  }
  return <HomeDashboardPage />;
}

function Layout({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const adminToken = useAuthStore((s) => s.adminToken);
  const adminUser = useAuthStore((s) => s.adminUser);
  const passwordChangeDismissed = useAuthStore((s) => s.passwordChangeDismissed);
  const stopImpersonation = useAuthStore((s) => s.stopImpersonation);
  const workMode = useAuthStore((s) => s.workMode);
  const setWorkMode = useAuthStore((s) => s.setWorkMode);
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const role = user?.role;
  const toggleEligible = canToggleWorkMode(role, user?.employee_id);
  const effectiveMode = effectiveWorkMode(role, user?.employee_id, workMode);
  const inDeskMode = effectiveMode === 'desk';
  const inStaffPersonalMode = toggleEligible && effectiveMode === 'staff';
  const showNotificationBell = !!user && !user.must_change_password && location.pathname !== '/change-password';
  const headerBreadcrumbs = usePageMetaStore((s) => s.breadcrumbs);

  const switchWorkMode = (mode: 'staff' | 'desk') => {
    if (!toggleEligible || mode === workMode) return;
    setWorkMode(mode);
    navigate(homePathForWorkMode(role, user?.employee_id, mode), { replace: true });
  };

  useEffect(() => {
    const impersonating = isImpersonatingSession(adminToken);
    const forced =
      user?.must_change_password
      && !passwordChangeDismissed
      && !impersonating;
    if (forced && location.pathname !== '/change-password') {
      navigate('/change-password', { replace: true });
    }
  }, [user, passwordChangeDismissed, adminToken, location.pathname, navigate]);

  useEffect(() => {
    setIsSidebarOpen(false);
    usePageMetaStore.getState().setFormMessage(null, 0);
  }, [location.pathname]);

  useEffect(() => {
    if (!toggleEligible) return;
    if (workMode === 'desk' && isStaffPersonalPath(location.pathname)) {
      navigate('/hod', { replace: true });
      return;
    }
    if (workMode === 'staff' && isDeskPath(location.pathname)) {
      navigate('/', { replace: true });
    }
  }, [toggleEligible, workMode, location.pathname, navigate]);

  useEffect(() => {
    if (!toggleEligible && workMode !== 'desk') {
      setWorkMode('desk');
    }
  }, [toggleEligible, workMode, setWorkMode]);

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
    <div className="flex h-screen overflow-hidden flex-col" style={{ background: 'var(--color-bg)' }}>
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
              navigate('/admin', { replace: true });
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
      <aside className={`fixed inset-y-0 left-0 z-30 w-56 bg-slate-900 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:static md:transform-none shadow-xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo Area */}
        <div className="h-14 flex items-center px-5 border-b border-slate-800 shrink-0">
          <Link to={toggleEligible && inDeskMode ? '/hod' : '/'} className="text-sm font-bold text-white tracking-tight truncate">
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
              {toggleEligible ? (
                inStaffPersonalMode ? (
                  <StaffPersonalNav />
                ) : (
                  <DeskNav role={role ?? ''} />
                )
              ) : (
                <>
                  {role !== 'ADMIN' && <StaffPersonalNav />}

                  {inDeskMode && role !== 'STAFF' && role !== 'ADMIN' && (
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

                  {hasRole(role, EMPLOYEE_MASTER_ROLES) && role !== 'ADMIN' && <div className="border-t border-slate-800 my-1.5" />}

                  {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
                    <NavDropdown title="HR Operations" items={[
                      { label: 'Employee Directory', path: '/employees?tab=directory' },
                      { label: 'Onboard Employee', path: '/employees?tab=onboard' },
                      ...(canEditHrLifecycle(role) ? [
                        { label: 'Employee Lifecycle', path: '/employees?tab=lifecycle' },
                      ] : []),
                      ...(hasRole(role, REPORT_ROLES) ? [{ label: 'Balance Overview', path: '/balance-overview' }] : []),
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
                </>
              )}

              {hasRole(role, ADMIN_ROLES) && role === 'ADMIN' && (
                <NavDropdown title="Admin Console" landingPath="/admin" items={[
                  { label: 'Dashboard', path: '/admin' },
                  { label: 'Leave Policy Matrix', path: '/admin?module=policy' },
                  { label: 'Users & Roles', path: '/admin?module=users' },
                  { label: 'Login As User', path: '/admin?module=users' },
                  { label: 'Audit & Health', path: '/admin?module=audit' },
                ]} />
              )}

              {!toggleEligible && hasRole(role, EMPLOYEE_MASTER_ROLES) && (
                <NavDropdown title="HR Operations" items={[
                  { label: 'Employee Directory', path: '/employees?tab=directory' },
                  { label: 'Onboard Employee', path: '/employees?tab=onboard' },
                  ...(canEditHrLifecycle(role) ? [
                    { label: 'Employee Lifecycle', path: '/employees?tab=lifecycle' },
                  ] : []),
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

              {!toggleEligible && hasRole(role, EMPLOYEE_MASTER_ROLES) && (
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
        <header className="h-12 border-b flex items-center justify-between px-4 md:px-5 shrink-0 z-10 sticky top-0 shadow-sm gap-3" style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)' }}>
          <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0">
            <button onClick={() => setIsSidebarOpen(true)} className="text-slate-500 hover:text-slate-800 md:hidden transition-colors shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
            </button>
            {headerBreadcrumbs.length > 0 ? (
              <Breadcrumbs items={headerBreadcrumbs} className="hidden sm:flex" />
            ) : (
              <span className="font-semibold text-slate-700 text-sm truncate hidden sm:block">
                {isAdminRoute ? 'Admin Console' : 'HRMS'}
              </span>
            )}
            <span className="font-semibold text-slate-700 text-sm truncate sm:hidden">
              {headerBreadcrumbs.length > 0
                ? headerBreadcrumbs[headerBreadcrumbs.length - 1]?.label
                : (isAdminRoute ? 'Admin' : 'HRMS')}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {toggleEligible && (
              <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => switchWorkMode('staff')}
                  className={`px-2 py-1 rounded ${!inDeskMode ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Staff View
                </button>
                <button
                  type="button"
                  onClick={() => switchWorkMode('desk')}
                  className={`px-2 py-1 rounded ${inDeskMode ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  Desk View
                </button>
              </div>
            )}
            {showNotificationBell && <NotificationBell />}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-800 leading-none">{(user as any).username}</p>
                  <p className="text-xs text-slate-500 mt-0.5 uppercase tracking-wide">
                    {(user as any).role?.replace(/_/g, ' ')}{toggleEligible ? ` · ${inDeskMode ? 'DESK VIEW' : 'STAFF VIEW'}` : ''}
                  </p>
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
          <div className="w-full max-w-screen-xl mx-auto px-4 py-4 md:px-6 md:py-5">
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
  const clearAuth = useAuthStore((s) => s.clearAuth);
  
  useEffect(() => {
    if (token) {
      authApi.me().catch(() => {
        clearAuth();
      });
    }
  }, [token, clearAuth]);

  return (
    <>
      <ToastContainer />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin-login" element={<AdminLoginPage />} />
      <Route path="/maintenance" element={<MaintenancePage />} />
      <Route path="/*" element={
        token ? (
          <Layout>
            <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/employees" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} requireDeskMode fallback="Access restricted."><EmployeeListPage /></RoleRoute>} />
            <Route path="/employees/:employeeId" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} requireDeskMode fallback="Access restricted."><EmployeeProfilePage /></RoleRoute>} />
            <Route path="/masters" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to Super Admin."><MastersPage /></RoleRoute>} />
            <Route path="/apply" element={<StaffPersonalRoute><ApplyLeavePage /></StaffPersonalRoute>} />
            <Route path="/my-apps" element={<StaffPersonalRoute><MyApplicationsPage /></StaffPersonalRoute>} />
            <Route path="/approver-dashboard" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Approver Dashboard."><ApproverDashboardPage /></RoleRoute>} />
            <Route path="/hod" element={<RoleRoute allowedRoles={APPROVER_ROLES} requireDeskMode fallback="Only approvers have a Nodal Dashboard."><HodDashboardPage /></RoleRoute>} />
            <Route path="/approvals" element={<RoleRoute allowedRoles={APPROVER_ROLES} requireDeskMode fallback="Only approvers have an Inbox."><ApprovalInboxPage /></RoleRoute>} />
            <Route path="/leave-account" element={<StaffPersonalRoute><MyLeaveAccountPage /></StaffPersonalRoute>} />
            <Route path="/login-activity" element={<StaffPersonalRoute><LoginActivityPage /></StaffPersonalRoute>} />
            <Route path="/team-leave" element={<RoleRoute allowedRoles={TEAM_VIEW_ROLES} requireDeskMode fallback="Team balances are for HOD and Nodal Officer roles."><TeamLeavePage /></RoleRoute>} />
            <Route path="/forecast" element={<RoleRoute allowedRoles={TEAM_VIEW_ROLES} requireDeskMode fallback="Forecast is for HOD and Nodal Officer roles."><ForecastingPage /></RoleRoute>} />
            <Route path="/balance-overview" element={<RoleRoute allowedRoles={REPORT_ROLES} requireDeskMode fallback="Balance overview requires report access."><BalanceOverviewPage /></RoleRoute>} />
            <Route path="/year-end" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Year-End processing is limited to Super Admin."><YearEndProcessingPage /></RoleRoute>} />
            <Route path="/reports" element={<RoleRoute allowedRoles={REPORT_ROLES} requireDeskMode fallback="Reports require HR or admin access."><ReportsPage /></RoleRoute>} />
            <Route path="/admin" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminDashboardPage /></RoleRoute>} />
            <Route path="/admin/tools/:tool" element={<RoleRoute allowedRoles={ADMIN_ROLES} fallback="Admin dashboard access is limited to ADMIN."><AdminToolsPage /></RoleRoute>} />
            <Route path="/leave-types" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to Super Admin."><MastersRedirect tab="leave-types" /></RoleRoute>} />
            <Route path="/entitlements" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to Super Admin."><MastersRedirect tab="entitlements" /></RoleRoute>} />
            <Route path="/holidays" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to Super Admin."><MastersRedirect tab="holidays" /></RoleRoute>} />
            <Route path="/workflows" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Masters access is limited to Super Admin."><MastersRedirect tab="workflows" /></RoleRoute>} />
            <Route path="/balances" element={<RoleRoute allowedRoles={CONFIG_ROLES} fallback="Opening balances are limited to Super Admin."><OpeningBalancePage /></RoleRoute>} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
            <Route path="/profile-dashboard" element={<StaffPersonalRoute><ProfileDashboardPage /></StaffPersonalRoute>} />
            <Route path="/profile" element={<StaffPersonalRoute><StaffProfilePage /></StaffPersonalRoute>} />
            <Route path="/leave-dashboard" element={<StaffPersonalRoute><LeaveDashboardPage /></StaffPersonalRoute>} />
            
            {/* Future HMIS Modules Placeholders */}
            <Route path="/claims" element={<StaffPersonalRoute><ClaimsDashboardPage /></StaffPersonalRoute>} />
            <Route path="/payroll" element={<StaffPersonalRoute><PayrollDashboardPage /></StaffPersonalRoute>} />
            <Route path="/performance" element={<StaffPersonalRoute><PerformanceDashboardPage /></StaffPersonalRoute>} />
            
            <Route path="/dependents" element={<StaffPersonalRoute><UnderConstructionPage title="Family & Dependents" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Profile', to: '/profile-dashboard' }, { label: 'Family & Dependents' }]} /></StaffPersonalRoute>} />
            <Route path="/holidays-calendar" element={<StaffPersonalRoute><UnderConstructionPage title="Holiday Calendar" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Holiday Calendar' }]} /></StaffPersonalRoute>} />
            <Route path="/attendance" element={<StaffPersonalRoute><AttendancePage /></StaffPersonalRoute>} />
            <Route path="/punches" element={<StaffPersonalRoute><UnderConstructionPage title="Punch History" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Leave & Attendance', to: '/leave-dashboard' }, { label: 'Punch History' }]} /></StaffPersonalRoute>} />
            
            {/* Claims & Advances */}
            <Route path="/claims/ltc" element={<StaffPersonalRoute><UnderConstructionPage title="LTC Claim" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'LTC Claim' }]} /></StaffPersonalRoute>} />
            <Route path="/claims/cea" element={<StaffPersonalRoute><UnderConstructionPage title="CEA (Education)" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'CEA (Education)' }]} /></StaffPersonalRoute>} />
            <Route path="/claims/ehs" element={<StaffPersonalRoute><UnderConstructionPage title="EHS Reimbursement" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'EHS Reimbursement' }]} /></StaffPersonalRoute>} />
            <Route path="/claims/ta" element={<StaffPersonalRoute><UnderConstructionPage title="TA/DA" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'TA/DA' }]} /></StaffPersonalRoute>} />
            <Route path="/claims/telephone" element={<StaffPersonalRoute><UnderConstructionPage title="Telephone & Internet" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Claims & Advances', to: '/claims' }, { label: 'Telephone & Internet' }]} /></StaffPersonalRoute>} />

            {/* Payroll & Finance */}
            <Route path="/payroll/slips" element={<StaffPersonalRoute><UnderConstructionPage title="Salary Slips" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Salary Slips' }]} /></StaffPersonalRoute>} />
            <Route path="/payroll/summary" element={<StaffPersonalRoute><UnderConstructionPage title="Annual Summary" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Annual Summary' }]} /></StaffPersonalRoute>} />
            <Route path="/payroll/form16" element={<StaffPersonalRoute><UnderConstructionPage title="Form 16 & Tax" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Payroll & Finance', to: '/payroll' }, { label: 'Form 16 & Tax' }]} /></StaffPersonalRoute>} />

            {/* Performance */}
            <Route path="/performance/apar" element={<StaffPersonalRoute><UnderConstructionPage title="My APAR" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Performance', to: '/performance' }, { label: 'My APAR' }]} /></StaffPersonalRoute>} />
            <Route path="/performance/training" element={<StaffPersonalRoute><UnderConstructionPage title="Training Logs" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Performance', to: '/performance' }, { label: 'Training Logs' }]} /></StaffPersonalRoute>} />
            
            <Route path="/team-calendar" element={<Navigate to="/forecast" replace />} />
            <Route path="/delegation" element={<RoleRoute allowedRoles={APPROVER_ROLES} requireDeskMode fallback="Delegation is available in Desk View."><UnderConstructionPage title="Delegation" breadcrumbs={[{ label: 'Home', to: '/hod' }, { label: 'Nodal Desk' }, { label: 'Delegation' }]} /></RoleRoute>} />
          </Routes>
          </Layout>
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
    </>
  );
}
