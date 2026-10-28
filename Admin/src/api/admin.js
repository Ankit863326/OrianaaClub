// These small helpers keep API paths and query strings consistent across pages.
import api from './client.js';

function query(values = {}) {
  const params = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && !(typeof value === 'string' && value.trim() === '')) {
      params.set(key, value);
    }
  });
  return params.size ? `?${params}` : '';
}

const data = (request) => request.then((response) => response.data.data);

export const adminApi = {
  dashboard: () => data(api.get('/admin/dashboard')),
  members: (filters = {}) => data(api.get(`/admin/members${query(filters)}`)),
  drafts: (filters = {}) => data(api.get(`/admin/drafts${query(filters)}`)),
  resendDraftLink: (id) => data(api.post(`/admin/drafts/${encodeURIComponent(id)}/resend-link`, {})),
  markDraftPaid: (id, body) => data(api.post(`/admin/drafts/${encodeURIComponent(id)}/mark-paid`, body)),
  setDraftTemporaryPassword: (id) => data(api.post(`/admin/drafts/${encodeURIComponent(id)}/set-temp-password`, {})),
  updateDraft: (id, body) => data(api.patch(`/admin/drafts/${encodeURIComponent(id)}`, body)),
  activateDraftMember: (id) => data(api.post(`/admin/drafts/${encodeURIComponent(id)}/activate`, {})),
  deleteDraft: (id) => data(api.delete(`/admin/drafts/${encodeURIComponent(id)}`)),
  member: (id) => data(api.get(`/admin/members/${encodeURIComponent(id)}`)),
  createMember: (body) => data(api.post('/admin/members', body)),
  updateMember: (id, body) => data(api.patch(`/admin/members/${encodeURIComponent(id)}`, body)),
  memberAction: (id, action) => data(api.post(`/admin/members/${encodeURIComponent(id)}/${action}`, {})),
  deleteMember: (id) => data(api.delete(`/admin/members/${encodeURIComponent(id)}`)),
  updateFamily: (userId, familyId, body) => data(api.patch(`/admin/members/${userId}/family/${familyId}`, body)),
  deleteFamily: (userId, familyId) => data(api.delete(`/admin/members/${userId}/family/${familyId}`)),
  memberPoints: (id, filters = {}) => data(api.get(`/admin/members/${id}/points${query(filters)}`)),
  plans: (filters = {}) => data(api.get(`/admin/plans${query(filters)}`)),
  createPlan: (body) => data(api.post('/admin/plans', body)),
  updatePlan: (id, body) => data(api.patch(`/admin/plans/${id}`, body)),
  points: (body) => data(api.post(`/admin/points/${body.filter || body.membershipIds ? 'bulk-credit' : body.type}`, body)),
  payments: (filters = {}) => data(api.get(`/admin/payments${query(filters)}`)),
  recordOfflinePayment: (body) => data(api.post('/admin/payments', body)),
  changePaymentMethod: (id, body) => data(api.patch(`/admin/payments/${encodeURIComponent(id)}/method`, body)),
  confirmOfflinePayment: (id) => data(api.patch(`/admin/payments/${encodeURIComponent(id)}/confirm`, {})),
  approveMembershipVerification: (id) => data(api.patch(`/admin/memberships/${encodeURIComponent(id)}/approve-verification`, {})),
  payment: (id) => data(api.get(`/admin/payments/${id}`)),
  paymentAction: (id, action, body = {}) => data(api.post(`/admin/payments/${id}/${action}`, body)),
  content: (type, filters = {}) => data(api.get(`/admin/${type}${query(filters)}`)),
  createContent: (type, body) => data(api.post(`/admin/${type}`, body)),
  updateContent: (type, id, body) => data(api.patch(`/admin/${type}/${id}`, body)),
  deleteContent: (type, id) => data(api.delete(`/admin/${type}/${id}`)),
  admins: (filters = {}) => data(api.get(`/admin/admins${query(filters)}`)),
  createAdmin: (body) => data(api.post('/admin/admins', body)),
  setAdminStatus: (id, status) => data(api.patch(`/admin/admins/${id}`, { status })),
  enquiries: (filters = {}) => data(api.get(`/admin/enquiries${query(filters)}`)),
  setEnquiryStatus: (id, status) => data(api.patch(`/admin/enquiries/${id}/status`, { status })),
  addEnquiryNote: (id, note) => data(api.post(`/admin/enquiries/${id}/notes`, { note })),
  audit: (filters = {}) => data(api.get(`/admin/audit-logs${query(filters)}`)),
  emails: (filters = {}) => data(api.get(`/admin/email-logs${query(filters)}`)),
  reports: (filters = {}) => data(api.get(`/admin/reports${query(filters)}`)),
};

export async function downloadCsv(path, filters = {}) {
  const response = await api.get(`${path}${query(filters)}`, { responseType: 'blob' });
  const objectUrl = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = response.headers['content-disposition']?.match(/filename="([^"]+)"/)?.[1]
    || 'orianaaclub-export.csv';
  link.click();
  URL.revokeObjectURL(objectUrl);
}
