import { jest } from '@jest/globals';
import api, { errorMessage } from '../src/api/client.js';
import { adminApi } from '../src/api/admin.js';

// The shared Axios client is a local Jest stub, so these request checks never reach the network.
describe('admin API client', () => {
  test('configures the API base URL, credentials, and admin CSRF header', () => {
    expect(api.defaults).toEqual(expect.objectContaining({
      baseURL: 'http://localhost:5000/api',
      withCredentials: true,
      headers: { 'X-Admin-Request': '1' },
    }));
    const requestInterceptor = api.interceptors.request.use.mock.calls.at(-1)[0];
    const request = { headers: {} };
    expect(requestInterceptor(request)).toBe(request);
    expect(request.headers['X-Admin-Request']).toBe('1');
  });

  test('renews an expired session only once and retries the original request', async () => {
    const [, rejectResponse] = api.interceptors.response.use.mock.calls.at(-1);
    const original = { url: '/admin/members', method: 'get' };
    api.post.mockResolvedValueOnce({ data: {} });
    api.mockResolvedValueOnce({ data: 'retried' });
    const result = await rejectResponse({ config: original, response: { status: 401, data: {} } });
    expect(api.post).toHaveBeenCalledWith('/admin/auth/refresh', {});
    expect(original._retried).toBe(true);
    expect(result.data).toBe('retried');
  });

  test('normalizes JSON blob errors, preserves auth errors, and avoids repeated refresh attempts', async () => {
    const [, rejectResponse] = api.interceptors.response.use.mock.calls.at(-1);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const blobError = {
      config: { url: '/admin/reports/export', method: 'get' },
      response: {
        status: 500,
        headers: { 'content-type': 'application/json' },
        data: Object.assign(new Blob(['{"message":"Report failed"}'], { type: 'application/json' }), {
          text: async () => '{"message":"Report failed"}',
        }),
      },
    };
    await expect(rejectResponse(blobError)).rejects.toBe(blobError);
    expect(blobError.response.data).toEqual({ message: 'Report failed' });

    api.post.mockClear();
    const loginError = { config: { url: '/admin/auth/login' }, response: { status: 401 } };
    await expect(rejectResponse(loginError)).rejects.toBe(loginError);
    expect(api.post).not.toHaveBeenCalled();
    log.mockRestore();
  });

  test('handles malformed URLs and a failed session refresh without exposing query values', async () => {
    const [, rejectResponse] = api.interceptors.response.use.mock.calls.at(-1);
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const malformedUrlError = {
      config: { url: '/private?token=never-log-this', baseURL: 'http://[' },
      response: { status: 500, data: {} },
    };
    await expect(rejectResponse(malformedUrlError)).rejects.toBe(malformedUrlError);
    expect(log.mock.calls.flat().join(' ')).not.toContain('never-log-this');

    const refreshFailure = new Error('Refresh failed');
    api.post.mockRejectedValueOnce(refreshFailure);
    const authError = { config: { url: '/admin/auth/me' }, response: { status: 401 } };
    await expect(rejectResponse(authError)).rejects.toBe(refreshFailure);
    log.mockRestore();
  });

  test('maps API helper functions to data and reports visible API errors', async () => {
    api.get.mockResolvedValueOnce({ data: { data: { items: [{ id: 'member-1' }] } } });
    expect(await adminApi.members({ search: 'Asha', status: '', page: 2 })).toEqual({ items: [{ id: 'member-1' }] });
    expect(api.get).toHaveBeenCalledWith('/admin/members?search=Asha&page=2');
    expect(errorMessage({ response: { status: 403, data: { message: 'Forbidden' } } })).toContain('Request failed (status 403): Forbidden');
  });

  test('maps every admin operation to its route and HTTP method', async () => {
    api.get.mockResolvedValue({ data: { data: { items: [] } } });
    api.post.mockResolvedValue({ data: { data: {} } });
    api.patch.mockResolvedValue({ data: { data: {} } });
    api.delete.mockResolvedValue({ data: { data: {} } });

    await adminApi.dashboard();
    await adminApi.member('user/1');
    await adminApi.createMember({ firstName: 'Asha' });
    await adminApi.updateMember('user-1', { firstName: 'Mira' });
    await adminApi.memberAction('user-1', 'suspend');
    await adminApi.deleteMember('user-1');
    await adminApi.updateFamily('user-1', 'family-1', { fullName: 'Ravi' });
    await adminApi.deleteFamily('user-1', 'family-1');
    await adminApi.memberPoints('user-1', { page: 2 });
    await adminApi.plans({ limit: 10 });
    await adminApi.createPlan({ title: 'Gold' });
    await adminApi.updatePlan('plan-1', { title: 'Silver' });
    await adminApi.points({ type: 'debit', amount: 2 });
    await adminApi.points({ membershipIds: ['membership-1'], amount: 3 });
    await adminApi.payments({ status: 'paid' });
    await adminApi.payment('payment-1');
    await adminApi.paymentAction('payment-1', 'refund', { reason: 'request' });
    await adminApi.content('posts', { page: 1 });
    await adminApi.createContent('events', { title: 'Dinner' });
    await adminApi.updateContent('posts', 'post-1', { title: 'Edited' });
    await adminApi.deleteContent('events', 'event-1');
    await adminApi.admins({ page: 1 });
    await adminApi.createAdmin({ email: 'admin@example.invalid' });
    await adminApi.setAdminStatus('admin-1', 'suspended');
    await adminApi.enquiries({ status: 'new' });
    await adminApi.setEnquiryStatus('enquiry-1', 'closed');
    await adminApi.addEnquiryNote('enquiry-1', 'Follow-up');
    await adminApi.audit({ action: 'member.updated' });
    await adminApi.emails({ status: 'failed' });
    await adminApi.reports({ from: '2025-01-01' });

    expect(api.get).toHaveBeenCalledWith('/admin/dashboard');
    expect(api.get).toHaveBeenCalledWith('/admin/members/user%2F1');
    expect(api.post).toHaveBeenCalledWith('/admin/points/debit', expect.objectContaining({ type: 'debit' }));
    expect(api.post).toHaveBeenCalledWith('/admin/points/bulk-credit', expect.objectContaining({ membershipIds: ['membership-1'] }));
    expect(api.patch).toHaveBeenCalledWith('/admin/admins/admin-1', { status: 'suspended' });
    expect(api.post).toHaveBeenCalledWith('/admin/enquiries/enquiry-1/notes', { note: 'Follow-up' });
  });

  test('downloads a CSV response using a temporary browser link', async () => {
    api.get.mockResolvedValueOnce({
      data: { data: new Blob(['name\\nAsha']) },
      headers: { 'content-disposition': 'attachment; filename="members.csv"' },
    });
    const createDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const revokeDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    const create = jest.fn(() => 'blob:test-csv');
    const revoke = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revoke });
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { downloadCsv } = await import('../src/api/admin.js');
    await downloadCsv('/admin/members/export', { status: 'active' });
    expect(api.get).toHaveBeenCalledWith('/admin/members/export?status=active', { responseType: 'blob' });
    expect(click).toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:test-csv');
    if (createDescriptor) Object.defineProperty(URL, 'createObjectURL', createDescriptor);
    else delete URL.createObjectURL;
    if (revokeDescriptor) Object.defineProperty(URL, 'revokeObjectURL', revokeDescriptor);
    else delete URL.revokeObjectURL;
    click.mockRestore();
  });
});
