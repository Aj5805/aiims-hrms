import api from './client';

export const leaveAppApi = {
  submit: (data: Record<string, unknown>) => api.post('/leave-applications', data),
  list: (params?: Record<string, string>) => api.get('/leave-applications', { params }),
  get: (id: string) => api.get(`/leave-applications/${id}`),
  withdraw: (id: string) => api.put(`/leave-applications/${id}/withdraw`),
  trail: (id: string) => api.get(`/leave-applications/${id}/approval-trail`),
};

export const approvalsApi = {
  inbox: () => api.get('/leave-approvals/inbox'),
  action: (id: string, data: Record<string, unknown>) => api.post(`/leave-approvals/${id}/action`, data),
  recall: (id: string) => api.post(`/leave-approvals/${id}/recall`),
};