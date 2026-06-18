import api from './client';

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (userId: string, newPassword: string) =>
    api.post('/auth/change-password', { user_id: userId, new_password: newPassword }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-my-password', { current_password: currentPassword, new_password: newPassword }),
};

export const employeesApi = {
  list: (params: Record<string, string | boolean>) =>
    api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  create: (data: Record<string, unknown>) => api.post('/employees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/employees/${id}`, data),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/employees/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const departmentsApi = {
  list: () => api.get('/departments'),
  create: (data: Record<string, unknown>) => api.post('/departments', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/departments/${id}`, data),
};

export const designationsApi = {
  list: () => api.get('/designations'),
  create: (data: Record<string, unknown>) => api.post('/designations', data),
};

export const usersApi = {
  list: (role?: string) => api.get('/users', { params: role ? { role } : {} }),
  update: (id: string, data: Record<string, unknown>) => api.put(`/users/${id}`, data),
};

export const notificationsApi = {
  list: () => api.get('/notifications'),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id: string) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  emailLog: () => api.get('/notifications/email-log'),
  retryEmail: (id: string) => api.post(`/notifications/email-log/${id}/retry`),
};

export const reportsApi = {
  leaveRegister: (params: Record<string, string>) =>
    api.get('/reports/leave-register', { params, responseType: 'blob' }),
  leaveAbstract: (params: Record<string, string>) =>
    api.get('/reports/leave-abstract', { params, responseType: 'blob' }),
  leaveAbstractDepartment: (params: Record<string, string>) =>
    api.get('/reports/leave-abstract-department', { params, responseType: 'blob' }),
  pendingApplications: () =>
    api.get('/reports/pending-applications', { responseType: 'blob' }),
  balanceSummary: (params: Record<string, string>) =>
    api.get('/reports/balance-summary', { params, responseType: 'blob' }),
  sanctionPdf: (applicationId: string) =>
    api.get(`/reports/sanction-pdf/${applicationId}`, { responseType: 'blob' }),
  leaveCalendar: (params: Record<string, string>) =>
    api.get('/reports/leave-calendar', { params, responseType: 'blob' }),
  payrollExport: (params: Record<string, string>) =>
    api.get('/reports/payroll-export', { params, responseType: 'blob' }),
};

export const adminApi = {
  auditLog: (params: Record<string, string | number>) => api.get('/admin/audit-log', { params }),
  healthDashboard: () => api.get('/admin/health-dashboard'),
  forceLogout: (userId: string) => api.post(`/admin/force-logout/${userId}`),
};
