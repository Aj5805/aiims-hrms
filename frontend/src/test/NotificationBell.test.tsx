import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from '../components/NotificationBell';

vi.mock('../stores', () => {
  const authState = {
    token: 'test-token',
    user: { id: 'user-1', role: 'HOD', employee_id: 'emp-1' },
    setWorkMode: vi.fn(),
  };
  const useAuthStore = Object.assign(
    (selector: (state: typeof authState) => unknown) => selector(authState),
    { getState: () => authState },
  );
  return { useAuthStore };
});

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

let unreadCount = 2;
let notifications = [
  {
    id: 'notif-1',
    application_id: 'app-1',
    subject: 'Approval needed — HRMS/2026/0001',
    body: 'EL 2026-01-10–2026-01-12 (3d) pending.',
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
beforeEach(() => {
  localStorage.setItem('access_token', 'test-token');
});
afterEach(() => {
  server.resetHandlers();
  unreadCount = 2;
  notifications = [
    {
      id: 'notif-1',
      application_id: 'app-1',
      subject: 'Approval needed — HRMS/2026/0001',
      body: 'EL 2026-01-10–2026-01-12 (3d) pending.',
      app_number: 'HRMS/2026/0001',
      created_at: '2026-01-01T00:00:00.000Z',
      status: 'PENDING',
    },
  ];
  navigate.mockReset();
});
afterAll(() => server.close());

describe('NotificationBell', () => {
  it('shows the unread count and concise notification items when opened', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(await screen.findByText('2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

    expect(await screen.findByText('Approval needed — HRMS/2026/0001')).toBeInTheDocument();
    expect(screen.getByText('HRMS/2026/0001')).toBeInTheDocument();
  });

  it('refreshes the unread count when auth becomes available', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    expect(await screen.findByText('2')).toBeInTheDocument();
  });

  it('opens the approval inbox in desk mode when an approver clicks a notification', async () => {
    const { useAuthStore } = await import('../stores');
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
    expect(await screen.findByText('Approval needed — HRMS/2026/0001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /approval needed/i }));

    await waitFor(() => {
      expect(useAuthStore.getState().setWorkMode).toHaveBeenCalledWith('desk');
      expect(navigate).toHaveBeenCalledWith('/approvals?app=app-1');
      expect(screen.queryByText('Approval needed — HRMS/2026/0001')).not.toBeInTheDocument();
    });
  });
});
