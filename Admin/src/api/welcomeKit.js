import api from './client.js';

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return params.size ? `?${params}` : '';
};
const data = (request) => request.then((response) => response.data.data);

export const welcomeKitApi = {
  list: (filters = {}) => data(api.get(`/admin/welcome-kits${query(filters)}`)),
  dispatch: (id, staff) => data(api.patch(`/admin/welcome-kits/${encodeURIComponent(id)}/dispatch`, { staff })),
  notHome: (id, note) => data(api.patch(`/admin/welcome-kits/${encodeURIComponent(id)}/not-home`, { note })),
  deliver: (id, code) => data(api.post(`/admin/welcome-kits/${encodeURIComponent(id)}/deliver`, { code })),
};
