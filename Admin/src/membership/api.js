import api from '../api/client.js';

const data = (request) => request.then((response) => response.data.data);

export const membershipAdminApi = {
  plans: () => data(api.get('/admin/membership-plans')),
  updatePlan: (id, values) => data(api.patch(`/admin/membership-plans/${encodeURIComponent(id)}`, values)),
  earlyBirdCounter: () => data(api.get('/admin/early-bird-counter')),
};
