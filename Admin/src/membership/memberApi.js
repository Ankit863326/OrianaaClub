import api from '../api/client.js';

const data = (request) => request.then((response) => response.data.data);

function membershipListParams(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => (
    value !== null && value !== undefined
    && (typeof value !== 'string' || value.trim() !== '')
  )));
}

export const membershipMembersApi = {
  list: (filters) => data(api.get('/admin/memberships', { params: membershipListParams(filters) })),
  details: (id) => data(api.get(`/admin/memberships/${encodeURIComponent(id)}/details`)),
  qr: (id) => api.get(`/admin/memberships/${encodeURIComponent(id)}/card-qr`, { responseType: 'blob' }),
  plans: () => data(api.get('/admin/membership-plans')),
  deactivate: (id, reason) => data(api.patch(`/admin/memberships/${encodeURIComponent(id)}/deactivate`, { reason })),
  renew: (id, values) => data(api.post(`/admin/memberships/${encodeURIComponent(id)}/renew`, values)),
  transferToNominee: (id, reason, document) => {
    const body = new FormData();
    body.append('reason', reason);
    body.append('document', document);
    return data(api.post(`/admin/memberships/${encodeURIComponent(id)}/transfer-to-nominee`, body));
  },
};
