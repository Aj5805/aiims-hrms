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
import ProfileDashboardPage from './pages/ProfileDashboardPage';
import LeaveDashboardPage from './pages/LeaveDashboardPage';
import ClaimsDashboardPage from './pages/ClaimsDashboardPage';
import PayrollDashboardPage from './pages/PayrollDashboardPage';
import PerformanceDashboardPage from './pages/PerformanceDashboardPage';
import HomeDashboardPage from './pages/HomeDashboardPage';
import ApproverDashboardPage from './pages/ApproverDashboardPage';
import { authApi } from './api/endpoints';
import { PageHeader } from './components/PageHeader';

const REPORT_ROLES = ['ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR'] as const;
const ADMIN_ROLES = ['ADMIN'] as const;
const CONFIG_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR'] as const;
const EMPLOYEE_MASTER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR'] as const;
const APPROVER_ROLES = ['ADMIN', 'ESTABLISHMENT_OFFICER', 'REGISTRAR', 'DIRECTOR', 'HOD', 'DEAN_ACADEMIC', 'NODAL_OFFICER'] as const;

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
  const triggerClasses = "text-sm font-semibold text-slate-700 cursor-pointer hover:text-blue-600 px-2 py-1 flex items-center gap-1 whitespace-nowrap";
  const triggerContent = <>{title} <span className="text-[10px] opacity-60">▼</span></>;
  
  const trigger = landingPath 
    ? <Link to={landingPath} className={triggerClasses}>{triggerContent}</Link>
    : <span className={triggerClasses}>{triggerContent}</span>;
  
  return (
    <div className="group relative">
      <div className="py-2">
        {trigger}
      </div>
      <div className="absolute hidden group-hover:block top-[100%] left-0 -mt-2 pt-2 z-50">
        <div className="bg-white border border-slate-200 shadow-xl rounded-lg py-2 w-48 overflow-hidden">
          {items.map(item => (
            <Link key={item.path} to={item.path} className="block px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
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
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold text-blue-800 hover:text-blue-900 transition-colors whitespace-nowrap">
              {isAdminRoute ? 'AIIMS HRMS (Admin Console)' : 'AIIMS HRMS'}
            </Link>
            {user && (
              <nav className="flex gap-2 text-sm flex-nowrap items-center">
                {isAdminRoute ? (
                  <Link to="/" className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1 whitespace-nowrap">
                    &larr; Exit Admin Console (Main Portal)
                  </Link>
                ) : (
                  <>
                    <NavDropdown title="My Profile" landingPath="/profile-dashboard" items={[
                      { label: 'e-Service Book', path: '/profile' },
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
                      { label: 'Telephone & Internet', path: '/claims/telephone' }
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

                    {role !== 'STAFF' && (
                      <NavDropdown title="Approvals" landingPath="/approver-dashboard" items={[
                        { label: 'Approval Inbox', path: '/approvals' },
                        { label: 'Team Calendar', path: '/team-calendar' },
                        { label: 'Delegation', path: '/delegation' }
                      ]} />
                    )}

                    {/* Admin & Config Grouping */}
                    {hasRole(role, EMPLOYEE_MASTER_ROLES) && (
                      <NavDropdown title="Admin/Estab" items={[
                        { label: 'Employees Directory', path: '/employees' },
                        { label: 'Master Settings', path: '/masters' },
                        { label: 'Reports', path: '/reports' },
                        ...(hasRole(role, CONFIG_ROLES) ? [{ label: 'Year-End Processing', path: '/year-end' }] : []),
                        ...(hasRole(role, ADMIN_ROLES) ? [{ label: 'System Admin Console', path: '/admin' }] : []),
                      ]} />
                    )}
                    {hasRole(role, CONFIG_ROLES) && (
                      <NavDropdown title="System Config" items={[
                        { label: 'Leave Types', path: '/leave-types' },
                        { label: 'Entitlement Rules', path: '/entitlements' },
                        { label: 'Holidays setup', path: '/holidays' },
                        { label: 'Workflows', path: '/workflows' },
                        { label: 'Opening Balances', path: '/balances' },
                      ]} />
                    )}
                  </>
                )}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3 flex-nowrap shrink-0">
            {showNotificationBell && <NotificationBell />}
            {user && <span className="text-sm text-gray-500 whitespace-nowrap">{(user as any).username} ({(user as any).role?.replace('_', ' ')})</span>}
            <span className="text-sm text-gray-400 whitespace-nowrap">v0.5.0</span>
            {user && <button onClick={logout} className="text-sm text-red-600 whitespace-nowrap">Logout</button>}
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
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
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/*" element={
        token ? (
          <Layout>
            <Routes>
            <Route path="/" element={<HomeDashboardPage />} />
            <Route path="/employees" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} fallback="Access restricted."><EmployeeListPage /></RoleRoute>} />
            <Route path="/masters" element={<RoleRoute allowedRoles={EMPLOYEE_MASTER_ROLES} fallback="Masters access is restricted."><MastersPage /></RoleRoute>} />
            <Route path="/apply" element={<ApplyLeavePage />} />
            <Route path="/my-apps" element={<MyApplicationsPage />} />
            <Route path="/approver-dashboard" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Approver Dashboard."><ApproverDashboardPage /></RoleRoute>} />
            <Route path="/approvals" element={<RoleRoute allowedRoles={APPROVER_ROLES} fallback="Only approvers have an Inbox."><ApprovalInboxPage /></RoleRoute>} />
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
            
            <Route path="/team-calendar" element={<UnderConstructionPage title="Team Calendar" breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Approvals', to: '/approver-dashboard' }, { label: 'Team Calendar' }]} />} />
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
