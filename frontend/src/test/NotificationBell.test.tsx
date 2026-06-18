import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from '../pages/Phase678Pages';

let unreadCount = 2;
let notifications = [
  {
    id: 'notif-1',
    subject: 'Leave submitted',
    body: 'Your leave application is under review.',
    app_number: 'HRMS/2026/0001',
    created_at: '2026-01-01T00:00:00.000Z',
    status: 'PENDING',
  },
];

const server = setupServer(
  http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: unreadCount })),
  http.get('*/api/v1/notifications', () => HttpResponse.json(notifications)),
  http.put('*/api/v1/notifications/notif-1/read', () => {
    unreadCount = 0;
    notifications = [];
    return HttpResponse.json({ message: 'Marked read' });
  }),
  http.put('*/api/v1/notifications/read-all', () => {
    unreadCount = 0;
    notifications = [];
    return HttpResponse.json({ message: 'All marked read' });
  })
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  unreadCount = 2;
  notifications = [
    {
      id: 'notif-1',
      subject: 'Leave submitted',
      body: 'Your leave application is under review.',
      app_number: 'HRMS/2026/0001',
      created_at: '2026-01-01T00:00:00.000Z',
      status: 'PENDING',
    },
  ];
  vi.restoreAllMocks();
});
afterAll(() => server.close());

describe('NotificationBell', () => {
  it('shows the unread count and loads notification items when opened', async () => {
    render(<NotificationBell />);

    expect(await screen.findByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('Leave submitted')).toBeInTheDocument();
    expect(screen.getByText('Your leave application is under review.')).toBeInTheDocument();
    expect(screen.getByText('Application: HRMS/2026/0001')).toBeInTheDocument();
  });

  it('refreshes the bell after marking notifications as read', async () => {
    render(<NotificationBell />);

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByText('Leave submitted')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /mark read/i }));

    await waitFor(() => {
      expect(screen.queryByText('Leave submitted')).not.toBeInTheDocument();
    });
  });
});
