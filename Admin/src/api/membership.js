import api from './client.js';

const query = (values = {}) => {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  });
  return params.size ? `?${params}` : '';
};
const data = (request) => request.then((response) => response.data.data);

export const membershipApi = {
  plans: () => data(api.get('/admin/membership-plans')),
  updatePlan: (id, body) => data(api.patch(`/admin/membership-plans/${id}`, body)),
  members: (filters = {}) => data(api.get(`/admin/memberships${query(filters)}`)),
  member: (id) => data(api.get(`/admin/memberships/${id}/details`)),
  resendActivation: async (userId) => {
    const response = await api.post(`/admin/members/${encodeURIComponent(userId)}/resend-activation`, {});
    return { ...response.data.data, message: response.data.message };
  },
  memberQr: (id) => api.get(`/admin/memberships/${id}/card-qr`, { responseType: 'blob' }),
  renew: (id, body) => data(api.post(`/admin/memberships/${id}/renew`, body)),
  deactivate: (id, reason) => data(api.patch(`/admin/memberships/${id}/deactivate`, { reason })),
  transfer: (id, reason, file) => {
    const body = new FormData();
    body.append('reason', reason);
    body.append('document', file);
    return data(api.post(`/admin/memberships/${id}/transfer-to-nominee`, body));
  },
  family: (id) => data(api.get(`/admin/memberships/${id}/family`)),
  addFamily: (id, values) => data(api.post(`/admin/memberships/${id}/family`, values)),
  updateFamily: (id, values) => data(api.patch(`/admin/family/${id}`, values)),
  removeFamily: (id, reason) => data(api.delete(`/admin/family/${id}`, { data: { reason } })),
  setNominee: (id, familyMemberId) => data(api.patch(`/admin/memberships/${id}/nominee`, { familyMemberId })),
  familyRequests: (filters = {}) => data(api.get(`/admin/family-requests${query(filters)}`)),
  decideFamilyRequest: (id, approve, reason = '') => data(api.patch(
    `/admin/family-requests/${id}/${approve ? 'approve' : 'reject'}`,
    { reason },
  )),
  ledger: (id, filters = {}) => data(api.get(`/admin/memberships/${id}/ledger${query(filters)}`)),
  lookup: (value) => data(api.get(`/admin/memberships/lookup${query({ q: value })}`)),
  adjustPoints: (id, body) => data(api.post(`/admin/memberships/${id}/adjust-points`, body)),
  bills: (filters = {}) => data(api.get(`/admin/membership-bills${query(filters)}`)),
  cancelBill: (id) => data(api.post(`/admin/membership-bills/${id}/cancel`, {})),
  payments: (filters = {}) => data(api.get(`/admin/payments${query(filters)}`)),
  paymentReceipt: (paymentId) => api.get(
    `/admin/payments/${encodeURIComponent(paymentId)}/receipt`,
    { responseType: 'blob' },
  ),
  recordPayment: (body) => data(api.post('/admin/payments', body)),
  confirmPayment: (id) => data(api.patch(`/admin/payments/${id}/confirm`, {})),
  approveVerification: (id) => data(api.patch(`/admin/memberships/${id}/approve-verification`, {})),
  rejectVerification: (id, reason) => data(api.patch(`/admin/memberships/${id}/reject-verification`, { reason })),
  verificationDocument: (id, documentId) => api.get(
    `/admin/memberships/${id}/verification-documents/${documentId}`,
    { responseType: 'blob' },
  ),
  identityVerification: (id) => data(api.get(`/admin/memberships/${id}/identity-verification`)),
  identityDocument: (id, documentId) => api.get(
    `/admin/memberships/${id}/identity-documents/${documentId}`,
    { responseType: 'blob' },
  ),
  reviewIdentity: (id, status, reason = '') => data(api.patch(
    `/admin/memberships/${id}/identity-verification`,
    { status, ...(status === 'rejected' ? { reason } : {}) },
  )),
  settings: () => data(api.get('/admin/membership-settings')),
  updateSettings: (body) => data(api.patch('/admin/membership-settings', body)),
  apiKeys: () => data(api.get('/admin/api-keys')),
  createApiKey: (name) => data(api.post('/admin/api-keys', { name })),
  revokeApiKey: (id) => data(api.patch(`/admin/api-keys/${id}/revoke`, {})),
  queue: (filters = {}) => data(api.get(`/admin/membership-queue${query(filters)}`)),
  reports: () => data(api.get('/admin/membership-reports')),
  audit: (filters = {}) => data(api.get(`/admin/audit-logs${query(filters)}`)),
};

export async function downloadPaymentReceipt(paymentId) {
  const response = await membershipApi.paymentReceipt(paymentId);
  const disposition = response.headers['content-disposition'] || '';
  const encodedFilename = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plainFilename = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const filename = encodedFilename
    ? decodeURIComponent(encodedFilename)
    : plainFilename || 'Receipt.pdf';
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function downloadMembershipBills(filters = {}) {
  const response = await api.get(`/admin/membership-bills/export${query(filters)}`, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'membership-bills.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export async function fetchPrivateFile(request) {
  const response = await request;
  return URL.createObjectURL(response.data);
}
