import api from '../api/client.js';

const data = (request) => request.then((response) => response.data.data);

export const membershipSettingsApi = {
  getSettings: () => data(api.get('/admin/settings')),
  updateSettings: (values) => data(api.patch('/admin/settings', values)),
  apiKeys: () => data(api.get('/admin/api-keys')),
  createApiKey: (name) => data(api.post('/admin/api-keys', { name })),
  revokeApiKey: (id) => data(api.patch(`/admin/api-keys/${encodeURIComponent(id)}/revoke`, {})),
};
