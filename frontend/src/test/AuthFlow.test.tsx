import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import App from '../App';
import { useAuthStore } from '../stores';
import api from '../api/client';

// Mock server setup
const server = setupServer(
  http.post('*/api/v1/auth/login', async ({ request }) => {
    const body = await request.json() as any;
    if (body.username === 'HRMS001') {
      return HttpResponse.json({
        access_token: 'fake-token-123',
        user: { id: 'uuid-1', username: 'HRMS001', role: 'STAFF', must_change_password: true }
      });
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 });
  }),
  http.post('*/api/v1/auth/change-my-password', async () => {
    return HttpResponse.json({
      access_token: 'fake-token-123',
      user: {
        id: 'uuid-1',
        username: 'HRMS001',
        role: 'STAFF',
        name: 'HRMS001',
        must_change_password: false,
      },
    });
  }),
  http.get('*/api/v1/auth/me', () => {
    return HttpResponse.json({ id: 'uuid-1', username: 'HRMS001', role: 'STAFF', must_change_password: false });
  }),
  http.get('*/api/v1/broadcasts/active', () => HttpResponse.json([])),
  http.get('*/api/v1/notifications/unread-count', () => HttpResponse.json({ count: 0 })),
  http.get('*/api/v1/employees', () => {
    // Return 403 to trigger interceptor
    return HttpResponse.json({ detail: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
  })
);

beforeAll(() => {
  server.listen();
  delete (window as any).location;
  window.location = { href: 'http://localhost/' } as any;
});
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clearAuth();
  localStorage.clear();
  window.location.href = 'http://localhost/';
});
afterAll(() => server.close());

describe('Auth Flow & forced password change', () => {
  it('(a) login returning must_change_password=true routes to /change-password', async () => {
    const queryClient = new QueryClient();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Enter credentials
    fireEvent.change(screen.getByLabelText(/Username/i), { target: { value: 'HRMS001' } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: 'temp_pass' } });
    fireEvent.click(screen.getByRole('button', { name: /Sign In/i }));

    // Wait for redirect to /change-password
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Update Password/i })).toBeInTheDocument();
    });
    
    // Check auth store is populated
    const state = useAuthStore.getState();
    expect(state.token).toBe('fake-token-123');
    expect(state.user?.must_change_password).toBe(true);
  });

  it('(b) a 403 with detail PASSWORD_CHANGE_REQUIRED triggers the redirect', async () => {
    // Call the API endpoint that returns 403 directly via axios
    try {
      await api.get('/employees');
    } catch {
      // ignore
    }
    // interceptor should have updated window.location.href
    expect(window.location.href).toContain('/change-password');
  });

  it('(c) successful changeMyPassword clears the flag in the store and routes to /', async () => {
    const queryClient = new QueryClient();
    
    // Pre-populate store
    useAuthStore.getState().setAuth('fake-token', {
      id: 'uuid-1', role: 'STAFF', name: 'Test', must_change_password: true
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/change-password']}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(screen.getByRole('heading', { name: /Update Password/i })).toBeInTheDocument();

    // Fill form
    fireEvent.change(screen.getByLabelText(/Current Password/i), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'NewPass123!' } });
    fireEvent.change(screen.getByLabelText(/Confirm New Password/i), { target: { value: 'NewPass123!' } });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Update Password/i }));

    // Wait for redirect to '/' (EmployeeListPage will render "Employees" header or similar)
    await waitFor(() => {
      // In Layout, 'Config' or other elements might be present, but EmployeeListPage shows a search input.
      // We can check if the must_change_password flag is false.
      const state = useAuthStore.getState();
      expect(state.user?.must_change_password).toBe(false);
    });
    
    // We can also check if we're not on the change password page anymore
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /Update Password/i })).not.toBeInTheDocument();
    });
  });
});
