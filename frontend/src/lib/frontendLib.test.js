import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import apiClient, { ApiClientError } from './apiClient.js';
import { API_BASE_URL, apiFileUrl, getImageUrl } from '../config/api.js';
import { contentApi } from './contentApi.js';
import { formatPoints, formatRupees } from './formatters.js';
import { getPlans } from './plansApi.js';
import {
  addFamilyMember,
  createPaymentOrder,
  getMember,
  getPaymentMembership,
  getMembershipCheckoutQuote,
  listFamily,
  savePlan,
  saveProfile,
  startMembershipPayment,
  updateFamilyMember,
  deleteFamilyMember,
  verifyPayment,
} from './memberApi.js';
import { getPoints } from './pointsApi.js';
import { lockPageScroll, unlockPageScroll } from './scrollLock.js';
import { cn } from './utils.js';
import { mapPlanToCard } from './planCardData.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

describe('formatting and display helpers', () => {
  test('formats rupees and points using Indian digit grouping', () => {
    expect(formatRupees(125000)).toBe('₹1,25,000');
    expect(formatPoints('25000')).toBe('25,000');
    expect(formatRupees(null)).toBe('₹0');
  });

  test('maps both current and legacy plan benefit shapes into card content', () => {
    const mapped = mapPlanToCard({
      name: 'Signature',
      price: 125000,
      termYears: 10,
      benefitsCohorts: [{ points: 25000, label: 'Adults' }],
    });
    expect(mapped.title).toBe('Signature');
    expect(mapped.subtitle).toBe('10 year membership');
    expect(mapped.priceLabel).toBe('₹1,25,000');
    expect(mapped.cohorts).toEqual([{ displayAmount: '25,000', label: 'Adults' }]);
    expect(mapPlanToCard({ title: 'Legacy', cohorts: [{ amount: 500, label: 'Child' }] }).cohorts[0])
      .toEqual({ displayAmount: '500', label: 'Child' });
  });

  test('prefers canonical points tiers and formats member ranges', () => {
    const mapped = mapPlanToCard({
      pointsTiers: [
        { points: 600000, label: 'First 1,000 members', fromMember: 1, toMember: 1000 },
        { points: 480000, label: 'Next members only', fromMember: 1001, toMember: null },
        { points: 420000, fromMember: 1001 },
      ],
      benefitsCohorts: [{ points: 1, label: 'Stale cohort' }],
    });
    expect(mapped.cohorts).toEqual([
      { displayAmount: '6,00,000', label: 'First 1,000 members' },
      { displayAmount: '4,80,000', label: 'Next members only' },
      { displayAmount: '4,20,000', label: 'Members 1,001 onwards' },
    ]);
    expect(mapPlanToCard({ pointsTiers: [] }).cohorts).toEqual([]);
  });

  test('joins conditional classes and builds upload URLs safely', () => {
    expect(cn('base', false, { active: true })).toBe('base active');
    expect(apiFileUrl('/uploads/photo.jpg')).toBe('http://localhost:5000/media/photo.jpg');
    expect(getImageUrl('uploads\\photo.jpg')).toBe('http://localhost:5000/media/photo.jpg');
    expect(getImageUrl('C:\\legacy\\uploads\\photo.jpg')).toBe('http://localhost:5000/media/photo.jpg');
    expect(getImageUrl('photo.jpg')).toBe('http://localhost:5000/media/photo.jpg');
    expect(apiFileUrl('https://cdn.example/photo.jpg')).toBe('https://cdn.example/photo.jpg');
    expect(apiFileUrl(undefined)).toBe('');
    expect(API_BASE_URL).toBe('http://localhost:5000/api');
  });
});

describe('credentialed API client', () => {
  beforeEach(() => fetch.mockReset());

  test('sends JSON with cookies and returns the decoded payload', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await expect(apiClient.post('/login', { email: 'member@example.test' })).resolves.toEqual({ ok: true });
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:5000/api/login');
    expect(options).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'member@example.test' }),
    });
    expect(options.headers.get('Content-Type')).toBe('application/json');
  });

  test('handles empty responses and plain text errors', async () => {
    fetch.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(apiClient.delete('/resource')).resolves.toBeNull();
    fetch.mockResolvedValueOnce(new Response('Not found', { status: 404 }));
    await expect(apiClient.get('/missing')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Not found',
      status: 404,
    });
  });

  test('shows the server message from JSON errors even when content type is incorrect', async () => {
    fetch.mockResolvedValueOnce(new Response(JSON.stringify({
      message: 'Identity document encryption is not configured.',
    }), { status: 503, headers: { 'content-type': 'text/plain' } }));
    await expect(apiClient.get('/member/identity-verification')).rejects.toMatchObject({
      name: 'ApiClientError',
      message: 'Identity document encryption is not configured.',
      status: 503,
    });
  });

  test('refreshes an expired session once, then retries the original request', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ refreshed: true }))
      .mockResolvedValueOnce(jsonResponse({ user: 'member' }));
    await expect(apiClient.get('/member/me')).resolves.toEqual({ user: 'member' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[1][0]).toBe('http://localhost:5000/api/auth/refresh');
  });

  test('does not recurse when refresh itself fails and carries the HTTP status', async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse({ message: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: 'no refresh' }, 401));
    await expect(apiClient.get('/auth/me')).rejects.toBeInstanceOf(ApiClientError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  test('uploads FormData without forcing a JSON content type', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ stored: true }));
    const formData = new FormData();
    formData.append('displayName', 'A Member');
    await apiClient.putForm('/member/profile', formData);
    const [, options] = fetch.mock.calls[0];
    expect(options.body).toBe(formData);
    expect(options.headers.has('Content-Type')).toBe(false);
  });
});

describe('API wrappers', () => {
  beforeEach(() => fetch.mockReset());

  test('loads and normalizes the public plan catalog', async () => {
    fetch.mockResolvedValueOnce(jsonResponse({ data: [{ _id: 'plan-1', name: 'Gold', price: 999, benefits: [{ amount: 20 }] }] }));
    await expect(getPlans()).resolves.toEqual([expect.objectContaining({
      id: 'plan-1',
      title: 'Gold',
      priceLabel: '₹999',
      benefits: [expect.objectContaining({ points: 20, displayPoints: '20' })],
    })]);
  });

  test('encodes query parameters and calls content, member, family, payment, and points endpoints', async () => {
    fetch.mockImplementation(async () => jsonResponse({ data: { ok: true } }));
    await contentApi.posts({ category: 'club stories', page: 2, empty: '' });
    expect(fetch.mock.calls[0][0]).toContain('/posts?category=club+stories&page=2');
    await contentApi.events({});
    await contentApi.submitEnquiry({ name: 'Sam' });
    await getMember();
    await saveProfile({ displayName: 'Sam', omitted: undefined });
    const formOptions = fetch.mock.calls[4][1];
    expect(formOptions.body.get('displayName')).toBe('Sam');
    expect(formOptions.body.has('omitted')).toBe(false);
    await saveProfile({}, new File(['image'], 'avatar.png', { type: 'image/png' }));
    expect(fetch.mock.calls[5][1].body.get('photo')).toBeInstanceOf(File);
    await savePlan('p1');
    await startMembershipPayment('p1');
    await getMembershipCheckoutQuote('p1');
    await getPaymentMembership('id/with space');
    await createPaymentOrder('membership-1', 'razorpay');
    await verifyPayment({ signature: 'test' });
    await listFamily();
    await addFamilyMember({ name: 'Jo' });
    await updateFamilyMember('family/id', { name: 'Jo' });
    await deleteFamilyMember('family/id');
    await getPoints({ page: 2, search: 'visit here' });
    expect(fetch.mock.calls.at(-1)[0]).toContain('/member/points?page=2&search=visit+here');
    expect(fetch.mock.calls.some(([url]) => url.includes('/payments/memberships/id%2Fwith%20space'))).toBe(true);
    expect(fetch.mock.calls.some(([url]) => url.includes('/member/family/family%2Fid'))).toBe(true);
  });
});

describe('page scroll locking', () => {
  let fixedNode;

  beforeEach(() => {
    document.body.innerHTML = '<nav class="home-nav is-scrolled"></nav><button class="back-to-top"></button>';
    fixedNode = document.querySelector('nav');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, value: 980 });
    document.body.style.overflow = 'auto';
    fixedNode.style.paddingRight = '4px';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('restores the original page and fixed-element styles after a lock', () => {
    const snapshot = lockPageScroll();
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.paddingRight).toBe('20px');
    expect(fixedNode.style.paddingRight).toBe('20px');
    unlockPageScroll(snapshot);
    expect(document.body.style.overflow).toBe('auto');
    expect(fixedNode.style.paddingRight).toBe('4px');
    expect(() => unlockPageScroll(null)).not.toThrow();
  });
});
