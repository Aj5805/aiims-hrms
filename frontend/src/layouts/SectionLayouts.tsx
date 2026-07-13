import { SectionLayout } from './SectionLayout';
import { useAuthStore } from '../stores';
import { canToggleWorkMode, effectiveWorkMode } from '../utils/workMode';

export function LeaveAttendanceLayout() {
  return <SectionLayout sectionId="leave-attendance" />;
}

export function ProfileSectionLayout() {
  return <SectionLayout sectionId="profile" />;
}

export function ClaimsSectionLayout() {
  return <SectionLayout sectionId="claims" />;
}

export function PayrollSectionLayout() {
  return <SectionLayout sectionId="payroll" />;
}

export function PerformanceSectionLayout() {
  return <SectionLayout sectionId="performance" />;
}

export function NodalDeskLayout() {
  return <SectionLayout sectionId="nodal-desk" />;
}

export function HrOperationsLayout() {
  return <SectionLayout sectionId="hr-operations" />;
}

export function ReportsDataLayout() {
  return <SectionLayout sectionId="reports-data" />;
}

export function AdminConsoleLayout() {
  return <SectionLayout sectionId="admin-console" />;
}

export function AdminToolsLayout() {
  return <SectionLayout sectionId="admin-tools" />;
}

export function MastersSectionLayout() {
  return <SectionLayout sectionId="masters" />;
}

/** Holiday calendar is shared — show Nodal Desk tabs in desk mode, Leave tabs in staff mode. */
export function HolidaySectionLayout() {
  const role = useAuthStore((s) => s.user?.role);
  const workMode = useAuthStore((s) => s.workMode);
  const employeeId = useAuthStore((s) => s.user?.employee_id);
  const sectionId =
    canToggleWorkMode(role, employeeId) && effectiveWorkMode(role, employeeId, workMode) === 'desk'
      ? 'nodal-desk'
      : 'leave-attendance';
  return <SectionLayout sectionId={sectionId} />;
}
