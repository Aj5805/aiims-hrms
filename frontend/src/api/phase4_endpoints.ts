import api from './client';

export const leaveAppApi = {
  submit: (data: Record<string, unknown>) => api.post('/leave-applications', data),
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
  availabilityForecast: (params: Record<string, string>) => api.get('/leave-approvals/availability-forecast', { params }),
};

export const leaveFormTemplatesApi = {
  list: (params?: Record<string, string>) => api.get('/leave-form-templates', { params }),
};
