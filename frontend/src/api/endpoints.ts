import api from './client';

export const systemApi = {
  time: () => api.get<{ server_time: string; timezone: string; unix_ms: number }>('/system/time'),
};

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  myLoginActivity: (limit = 20) => api.get('/auth/my-login-activity', { params: { limit } }),
  changePassword: (userId: string, newPassword: string) =>
    api.post('/auth/change-password', { user_id: userId, new_password: newPassword }),
  changeMyPassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-my-password', { current_password: currentPassword, new_password: newPassword }),
  impersonate: (userId: string) =>
    api.post(`/auth/impersonate/${userId}`),
};

export const employeesApi = {
  list: (params: Record<string, string | boolean>) =>
    api.get('/employees', { params }),
  get: (id: string) => api.get(`/employees/${id}`),
  staffGroups: () => api.get('/employees/staff-groups'),
  suggestStaffGroup: (params: {
    designation_name: string;
    department_code?: string;
    category_code?: string;
  }) => api.get('/employees/suggest-staff-group', { params }),
  nextStaffNumber: (staff_group: string) =>
    api.get('/employees/next-staff-number', { params: { staff_group } }),
  checkStaffNumber: (params: {
    emp_code: string;
    staff_group?: string;
    exclude_employee_id?: string;
  }) => api.get('/employees/check-staff-number', { params }),
  onboardingLeaveCredits: (params: { category_code: string; doj: string; gender?: string }) =>
    api.get('/employees/onboarding-leave-credits', { params }),
  eligibleLeaveTypes: (id: string) => api.get(`/employees/${id}/eligible-leave-types`),
  bootstrapLeaveBalances: (id: string) => api.post(`/employees/${id}/bootstrap-leave-balances`),
  create: (data: Record<string, unknown>) => api.post('/employees', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/employees/${id}`, data),
  updateSelf: (data: Record<string, unknown>) => api.patch('/employees/me', data),
  lifecycle: (id: string, data: Record<string, unknown>) => api.post(`/employees/${id}/lifecycle`, data),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/employees/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export const departmentsApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/departments', { params }),
  create: (data: Record<string, unknown>) => api.post('/departments', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/departments/${id}`, data),
};

export const designationsApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/designations', { params }),
  create: (data: Record<string, unknown>) => api.post('/designations', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/designations/${id}`, data),
};

export const usersApi = {
  list: (role?: string) => api.get('/users', { params: role ? { role } : {} }),
  create: (data: Record<string, unknown>) => api.post('/users', data),
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
  leaveRegisterPreview: (params: Record<string, string>) =>
    api.get('/reports/leave-register', { params: { ...params, format: 'json' } }),
  leaveAbstract: (params: Record<string, string>) =>
    api.get('/reports/leave-abstract', { params, responseType: 'blob' }),
  leaveAbstractPreview: (params: Record<string, string>) =>
    api.get('/reports/leave-abstract', { params: { ...params, format: 'json' } }),
  leaveAbstractDepartment: (params: Record<string, string>) =>
    api.get('/reports/leave-abstract-department', { params }),
  pendingApplications: (params?: Record<string, string>) =>
    api.get('/reports/pending-applications', { params, responseType: 'blob' }),
  pendingApplicationsPreview: () =>
    api.get('/reports/pending-applications', { params: { format: 'json' } }),
  balanceSummary: (params: Record<string, string>) =>
    api.get('/reports/balance-summary', { params, responseType: 'blob' }),
  balanceOverview: (params: Record<string, string>) =>
    api.get('/reports/balance-overview', { params }),
  sanctionPdf: (applicationId: string) =>
    api.get(`/reports/sanction-pdf/${applicationId}`, { responseType: 'blob' }),
  leaveCalendar: (params: Record<string, string>) =>
    api.get('/reports/leave-calendar', { params, responseType: 'blob' }),
  leaveCalendarPreview: (params: Record<string, string>) =>
    api.get('/reports/leave-calendar', { params: { ...params, format: 'json' } }),
  payrollExport: (params: Record<string, string>) =>
    api.get('/reports/payroll-export', { params, responseType: 'blob' }),
  payrollExportPreview: (params: Record<string, string>) =>
    api.get('/reports/payroll-export', { params: { ...params, format: 'json' } }),
};

export const attendanceApi = {
  report: (params: Record<string, string | boolean>) => api.get('/attendance/report', { params }),
  syncFromLeave: (data: Record<string, unknown>) => api.post('/attendance/sync-from-leave', data),
  pipelineStatus: () => api.get('/attendance/pipeline-status'),
};

export const adminApi = {
  auditLog: (params: Record<string, string | number>) =>
    api.get('/admin/audit-log', { params }),
  healthDashboard: () => api.get('/admin/health-dashboard'),
  summary: () => api.get('/admin/summary'),
  forceLogout: (userId: string) => api.post(`/admin/force-logout/${userId}`),
  getMaintenanceMode: () => api.get('/admin/maintenance-mode'),
  toggleMaintenanceMode: (enable: boolean) => api.post(`/admin/maintenance-mode?enable=${enable}`),
  getEmailSettings: () => api.get('/admin/email-settings'),
  updateEmailSettings: (data: Record<string, unknown>) => api.put('/admin/email-settings', data),
  getWorkflowDiagnostics: (leaveId: string) => api.get(`/admin/workflow/${leaveId}`),
  overrideWorkflow: (leaveId: string) => api.post(`/admin/workflow/${leaveId}/override`),
  bulkRoles: (assignments: any[]) => api.put('/admin/bulk-roles', { assignments }),
};

export const broadcastsApi = {
  getActive: () => api.get('/broadcasts/active'),
  getAll: () => api.get('/broadcasts/'),
  create: (data: any) => api.post('/broadcasts/', data),
  update: (id: string, data: any) => api.put(`/broadcasts/${id}`, data),
};

export const nodalOfficesApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/nodal-offices', { params }),
  create: (data: Record<string, unknown>) => api.post('/nodal-offices', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/nodal-offices/${id}`, data),
  eligibleStaff: (params?: Record<string, string>) => api.get('/nodal-offices/eligible-staff', { params }),
  eligibleOfficers: () => api.get('/nodal-offices/eligible-officers'),
  clericalLogins: (officeId: string) => api.get(`/nodal-offices/${officeId}/clerical-logins`),
  assignOfficeStaff: (officeId: string, data: { employee_id: string }) =>
    api.post(`/nodal-offices/${officeId}/clerical-logins`, data),
  removeOfficeStaff: (officeId: string, userId: string) =>
    api.delete(`/nodal-offices/${officeId}/office-staff/${userId}`),
  /** @deprecated Prefer assignOfficeStaff with employee_id */
  createClericalLogin: (officeId: string, data: Record<string, unknown>) =>
    api.post(`/nodal-offices/${officeId}/clerical-logins`, data),
};

/** @deprecated Use nodalOfficesApi — kept for any stale imports */
export const nodalAssignmentsApi = nodalOfficesApi;

export const hodAssignmentsApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/hod-assignments', { params }),
  create: (data: Record<string, unknown>) => api.post('/hod-assignments', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/hod-assignments/${id}`, data),
  eligibleStaff: (params?: Record<string, string>) => api.get('/hod-assignments/eligible-staff', { params }),
  hodUsers: () => api.get('/hod-assignments/hod-users'),
};

export const leaveTypesApi = {
  list: (params?: Record<string, string | boolean>) => api.get('/leave-types', { params }),
  create: (data: Record<string, unknown>) => api.post('/leave-types', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leave-types/${id}`, data),
};

export const entitlementRulesApi = {
  list: () => api.get('/leave-entitlement-rules'),
  create: (data: Record<string, unknown>) => api.post('/leave-entitlement-rules', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/leave-entitlement-rules/${id}`, data),
};

export const holidayApi = {
  list: (year?: number) => api.get('/holiday-master', { params: year ? { year } : {} }),
  create: (data: Record<string, unknown>) => api.post('/holiday-master', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/holiday-master/${id}`, data),
  delete: (id: string) => api.delete(`/holiday-master/${id}`),
};

export const workflowApi = {
  list: () => api.get('/workflow-configs'),
  create: (data: Record<string, unknown>) => api.post('/workflow-configs', data),
  update: (id: string, data: Record<string, unknown>) => api.put(`/workflow-configs/${id}`, data),
  addStep: (configId: string, data: Record<string, unknown>) =>
    api.post(`/workflow-configs/${configId}/steps`, data),
  updateStep: (configId: string, stepId: string, data: Record<string, unknown>) =>
    api.put(`/workflow-configs/${configId}/steps/${stepId}`, data),
  deleteStep: (configId: string, stepId: string) =>
    api.delete(`/workflow-configs/${configId}/steps/${stepId}`),
  simulate: (data: Record<string, unknown>) => api.post('/workflow-configs/simulate', data),
};

export const leaveBalancesApi = {
  get: (employeeId: string) => api.get(`/leave-balances/${employeeId}`),
  ledger: (employeeId: string, leaveTypeId: string, leaveYear?: number) =>
    api.get(`/leave-balances/${employeeId}/ledger/${leaveTypeId}`, {
      params: leaveYear != null ? { leave_year: String(leaveYear) } : undefined,
    }),
  project: (employeeId: string, params: Record<string, string>) =>
    api.get(`/leave-balances/${employeeId}/project`, { params }),
  opening: (data: Record<string, unknown>[]) => api.post('/leave-balances/opening', data),
  importExcel: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/leave-balances/opening/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  annualCredit: (data: Record<string, unknown>) => api.post('/leave-balances/credit/annual', data),
  carryForward: (data: Record<string, unknown>) => api.post('/leave-balances/carryforward', data),
  manualAdjust: (balanceId: string, data: Record<string, unknown>) =>
    api.put(`/leave-balances/${balanceId}/manual-adjust`, data),
};

export const leaveAppApi = {
  deskEntry: (data: Record<string, unknown>) => api.post('/leave-applications/desk-entry', data),
  changeRequest: (data: Record<string, unknown>) => api.post('/leave-applications/change-request', data),
  list: (params?: Record<string, string>) => api.get('/leave-applications', { params }),
  get: (id: string) => api.get(`/leave-applications/${id}`),
  withdraw: (id: string) => api.put(`/leave-applications/${id}/withdraw`),
  trail: (id: string) => api.get(`/leave-applications/${id}/approval-trail`),
};

export const approvalsApi = {
  inbox: () => api.get('/leave-approvals/inbox'),
  action: (id: string, data: Record<string, unknown>) => api.post(`/leave-approvals/${id}/action`, data),
  recall: (id: string) => api.post(`/leave-approvals/${id}/recall`),
  teamAvailability: () => api.get('/leave-approvals/team-availability'),
  availabilityForecast: (params: Record<string, string>) =>
    api.get('/leave-approvals/availability-forecast', { params }),
};
