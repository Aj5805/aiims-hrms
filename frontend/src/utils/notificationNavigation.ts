import { APPROVER_ROLES } from '../constants/roles';

type NotificationItem = {
  application_id?: string | null;
  subject?: string | null;
};

export type NotificationNavTarget = {
  path: string;
  workMode: 'staff' | 'desk';
};

/** Map in-app notification to the route + work mode the user should land on. */
export function resolveNotificationNavigation(
  item: NotificationItem,
  role: string,
): NotificationNavTarget | null {
  if (!item.application_id) return null;

  const subject = (item.subject || '').toLowerCase();
  const isApprover = APPROVER_ROLES.includes(role as (typeof APPROVER_ROLES)[number]);
  const needsApproval =
    subject.includes('approval') ||
    subject.includes('sla overdue') ||
    subject.includes('action needed');

  if (isApprover && needsApproval) {
    return { path: `/approvals?app=${item.application_id}`, workMode: 'desk' };
  }

  return { path: `/my-apps?app=${item.application_id}`, workMode: 'staff' };
}
