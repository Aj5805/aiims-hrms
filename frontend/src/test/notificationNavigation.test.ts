import { describe, expect, it } from 'vitest';
import { resolveNotificationNavigation } from '../utils/notificationNavigation';

describe('resolveNotificationNavigation', () => {
  it('routes approvers to the inbox in desk mode for approval requests', () => {
    expect(
      resolveNotificationNavigation(
        { application_id: 'app-1', subject: 'Approval needed — HRMS/2026/0001' },
        'NODAL_OFFICER',
      ),
    ).toEqual({ path: '/approvals?app=app-1', workMode: 'desk' });
  });

  it('routes SLA alerts to the inbox for HOD', () => {
    expect(
      resolveNotificationNavigation(
        { application_id: 'app-2', subject: 'SLA overdue — HRMS/2026/0002' },
        'HOD',
      ),
    ).toEqual({ path: '/approvals?app=app-2', workMode: 'desk' });
  });

  it('routes decision notifications to my applications in staff mode', () => {
    expect(
      resolveNotificationNavigation(
        { application_id: 'app-3', subject: 'Leave approved — HRMS/2026/0003' },
        'NODAL_OFFICER',
      ),
    ).toEqual({ path: '/my-apps?app=app-3', workMode: 'staff' });
  });

  it('returns null when there is no linked application', () => {
    expect(resolveNotificationNavigation({ subject: 'Low EL balance' }, 'HOD')).toBeNull();
  });
});
