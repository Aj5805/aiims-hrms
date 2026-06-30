import api from './client';

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

export const balancesApi = {
  opening: (data: Record<string, unknown>[]) => api.post('/leave-balances/opening', data),
  importExcel: (file: File) => {
    const f = new FormData();
    f.append('file', file);
    return api.post('/leave-balances/opening/import', f, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};