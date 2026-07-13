import type { Location } from 'react-router-dom';
import {
  CONFIG_ROLES,
  EMPLOYEE_MASTER_ROLES,
  hasSystemRole,
  HR_EDITOR_ROLES,
  REPORT_ROLES,
  TEAM_VIEW_ROLES,
} from '../constants/roles';

export type NavTab = {
  label: string;
  path: string;
  match?: (location: Location) => boolean;
};

export type NavSectionId =
  | 'profile'
  | 'leave-attendance'
  | 'claims'
  | 'payroll'
  | 'performance'
  | 'nodal-desk'
  | 'hr-operations'
  | 'reports-data'
  | 'admin-console'
  | 'admin-tools'
  | 'masters';

export type NavSectionDef = {
  id: NavSectionId;
  title: string;
  landingPath: string;
  getTabs: (role?: string) => NavTab[];
};

function hasRole(role: string | undefined, allowed: readonly string[]) {
  return !!role && allowed.includes(role);
}

function canEditHrLifecycle(role?: string) {
  return hasSystemRole(role, HR_EDITOR_ROLES);
}

function parsePath(path: string) {
  const q = path.indexOf('?');
  if (q === -1) return { pathname: path, search: '' };
  return { pathname: path.slice(0, q), search: path.slice(q) };
}

export function isTabActive(tab: NavTab, location: Location): boolean {
  if (tab.match) return tab.match(location);
  const { pathname, search } = parsePath(tab.path);
  if (search) {
    return location.pathname === pathname && location.search === search;
  }
  return location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
}

export function resolveSectionId(pathname: string, search: string): NavSectionId | null {
  const loc = { pathname, search, hash: '', state: null, key: 'default' } as Location;
  for (const section of NAV_SECTIONS) {
    if (section.getTabs().some((tab) => isTabActive(tab, loc))) return section.id;
  }
  return null;
}

export const NAV_SECTIONS: NavSectionDef[] = [
  {
    id: 'profile',
    title: 'My Profile',
    landingPath: '/profile-dashboard',
    getTabs: () => [
      { label: 'Overview', path: '/profile-dashboard' },
      { label: 'View profile', path: '/profile' },
      { label: 'Login activity', path: '/login-activity' },
      { label: 'Family & dependents', path: '/dependents' },
      { label: 'Service record', path: '/service-record' },
    ],
  },
  {
    id: 'leave-attendance',
    title: 'Leave & Attendance',
    landingPath: '/leave-dashboard',
    getTabs: () => [
      { label: 'Overview', path: '/leave-dashboard' },
      { label: 'Apply for leave', path: '/apply' },
      { label: 'My applications', path: '/my-apps' },
      { label: 'Leave ledger', path: '/leave-account' },
      { label: 'My attendance', path: '/attendance' },
      { label: 'Holiday calendar', path: '/holidays-calendar' },
      { label: 'Punch history', path: '/punches' },
    ],
  },
  {
    id: 'claims',
    title: 'Claims & Advances',
    landingPath: '/claims',
    getTabs: () => [
      { label: 'Overview', path: '/claims' },
      { label: 'LTC claim', path: '/claims/ltc' },
      { label: 'CEA (education)', path: '/claims/cea' },
      { label: 'EHS reimbursement', path: '/claims/ehs' },
      { label: 'TA / DA', path: '/claims/ta' },
      { label: 'Telephone', path: '/claims/telephone' },
    ],
  },
  {
    id: 'payroll',
    title: 'Payroll & Finance',
    landingPath: '/payroll',
    getTabs: () => [
      { label: 'Overview', path: '/payroll' },
      { label: 'Salary slips', path: '/payroll/slips' },
      { label: 'Annual summary', path: '/payroll/summary' },
      { label: 'Form 16 & tax', path: '/payroll/form16' },
    ],
  },
  {
    id: 'performance',
    title: 'Performance',
    landingPath: '/performance',
    getTabs: () => [
      { label: 'Overview', path: '/performance' },
      { label: 'My APAR', path: '/performance/apar' },
      { label: 'Training logs', path: '/performance/training' },
    ],
  },
  {
    id: 'nodal-desk',
    title: 'Nodal Desk',
    landingPath: '/hod',
    getTabs: (role) => {
      const isHod = role === 'HOD';
      return [
        { label: 'Dashboard', path: '/hod' },
        { label: 'Approval inbox', path: '/approvals' },
        ...(hasRole(role, TEAM_VIEW_ROLES)
          ? [
              { label: isHod ? 'Team balances' : 'Staff balances', path: '/team-leave' },
              { label: isHod ? 'Team ledger' : 'Staff ledger', path: '/staff-ledger' },
              { label: isHod ? 'Team forecast' : 'Scheme forecast', path: '/forecast' },
            ]
          : []),
        { label: 'Holiday calendar', path: '/holidays-calendar' },
      ];
    },
  },
  {
    id: 'hr-operations',
    title: 'HR Operations',
    landingPath: '/employees?tab=directory',
    getTabs: (role) => {
      if (!hasRole(role, EMPLOYEE_MASTER_ROLES)) return [];
      const lifecycleTabs = canEditHrLifecycle(role)
        ? [
            { label: 'Resign / deactivate', path: '/employees?tab=deactivate' },
            { label: 'Rejoin', path: '/employees?tab=reactivate' },
            { label: 'Promotion', path: '/employees?tab=designation' },
            { label: 'Transfer', path: '/employees?tab=transfer' },
          ]
        : [];
      return [
        { label: 'Directory', path: '/employees?tab=directory' },
        ...(canEditHrLifecycle(role) ? [{ label: 'Onboard', path: '/employees?tab=onboard' }] : []),
        ...lifecycleTabs,
        ...(hasRole(role, REPORT_ROLES) ? [{ label: 'Balance overview', path: '/balance-overview' }] : []),
      ];
    },
  },
  {
    id: 'reports-data',
    title: 'Reports & Data',
    landingPath: '/reports',
    getTabs: (role) => {
      if (!hasRole(role, EMPLOYEE_MASTER_ROLES)) return [];
      return [
        ...(hasRole(role, REPORT_ROLES) ? [{ label: 'Reports', path: '/reports' }] : []),
        ...(hasRole(role, CONFIG_ROLES)
          ? [
              {
                label: 'Year-end',
                path: '/year-end',
                match: (loc) => loc.pathname === '/year-end',
              },
            ]
          : []),
        ...(hasRole(role, CONFIG_ROLES) ? [{ label: 'Opening balances', path: '/balances' }] : []),
      ];
    },
  },
  {
    id: 'admin-console',
    title: 'Admin Console',
    landingPath: '/admin',
    getTabs: () => [
      {
        label: 'Dashboard',
        path: '/admin',
        match: (loc) => loc.pathname === '/admin' && (!loc.search || loc.search === '?module=dashboard'),
      },
      { label: 'Users & roles', path: '/admin?module=users' },
      { label: 'Audit & health', path: '/admin?module=audit' },
    ],
  },
  {
    id: 'admin-tools',
    title: 'Admin Tools',
    landingPath: '/admin/tools/maintenance',
    getTabs: () => [
      { label: 'Maintenance', path: '/admin/tools/maintenance' },
      { label: 'Broadcasts', path: '/admin/tools/broadcast' },
      { label: 'Email settings', path: '/admin/tools/email' },
      { label: 'Workflow diagnostics', path: '/admin/tools/workflow' },
      { label: 'Bulk roles', path: '/admin/tools/roles' },
    ],
  },
  {
    id: 'masters',
    title: 'Masters',
    landingPath: '/masters',
    getTabs: () => [
      { label: 'Departments', path: '/masters?tab=dept' },
      { label: 'Designations', path: '/masters?tab=desg' },
      { label: 'Nodal offices', path: '/masters?tab=assignments' },
      { label: 'HOD assignments', path: '/masters?tab=hod-assignments' },
      { label: 'Leave types', path: '/masters?tab=leave-types' },
      { label: 'Leave policy', path: '/masters?tab=entitlements' },
      { label: 'Holidays', path: '/masters?tab=holidays' },
      { label: 'Workflows', path: '/masters?tab=workflows' },
    ],
  },
];

export function getNavSection(id: NavSectionId): NavSectionDef | undefined {
  return NAV_SECTIONS.find((s) => s.id === id);
}

export function getSectionTabs(id: NavSectionId, role?: string): NavTab[] {
  const section = getNavSection(id);
  if (!section) return [];
  return section.getTabs(role);
}

export type SidebarNavItem = { label: string; path: string };

/** Sidebar dropdown groups for the left nav. */
export type SidebarNavGroup = { title: string; landingPath?: string; items: SidebarNavItem[] };

export function getSidebarNavGroups(
  role?: string,
  mode: 'staff' | 'desk' | 'combined' = 'combined',
): SidebarNavGroup[] {
  const groups: SidebarNavGroup[] = [];

  const pushSection = (id: NavSectionId) => {
    const section = getNavSection(id);
    if (!section) return;
    const tabs = section.getTabs(role);
    if (!tabs.length) return;
    groups.push({
      title: section.title,
      landingPath: section.landingPath,
      items: tabs.map((t) => ({ label: t.label, path: t.path })),
    });
  };

  if (mode === 'staff') {
    pushSection('profile');
    pushSection('leave-attendance');
    pushSection('claims');
    pushSection('payroll');
    pushSection('performance');
    return groups;
  }

  if (mode === 'desk') {
    pushSection('nodal-desk');
    pushSection('hr-operations');
    pushSection('reports-data');
  } else {
    pushSection('profile');
    pushSection('leave-attendance');
    pushSection('claims');
    pushSection('payroll');
    pushSection('performance');
    pushSection('nodal-desk');
    pushSection('hr-operations');
    pushSection('reports-data');
  }

  if (hasRole(role, ['ADMIN'])) pushSection('admin-console');
  if (hasRole(role, CONFIG_ROLES)) pushSection('masters');
  if (hasRole(role, ['ADMIN'])) pushSection('admin-tools');

  return groups;
}
