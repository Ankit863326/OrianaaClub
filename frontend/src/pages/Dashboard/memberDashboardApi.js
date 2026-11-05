import { API_BASE_URL } from '../../config/api.js';
import apiClient, { ApiClientError } from '../../lib/apiClient.js';

function data(result) {
  return result?.data;
}

export async function getMyMembership() {
  return data(await apiClient.get('/me/membership'));
}

export async function getMyReview() {
  return data(await apiClient.get('/member/review'));
}

export async function saveMyReview(review) {
  return data(await apiClient.put('/member/review', review));
}

export async function getMyPayments() {
  return data(await apiClient.get('/me/payments'));
}

export async function downloadMyPaymentReceipt(paymentId) {
  const url = `${API_BASE_URL}/me/payments/${encodeURIComponent(paymentId)}/receipt`;
  let response = await fetch(url, { credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (refreshed.ok) response = await fetch(url, { credentials: 'include' });
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // Keep the HTTP status message when a non-JSON error body is returned.
    }
    throw new ApiClientError(message, response.status);
  }
  const disposition = response.headers.get('content-disposition') || '';
  const encodedFilename = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
  const plainFilename = /filename="?([^";]+)"?/i.exec(disposition)?.[1];
  const filename = encodedFilename
    ? decodeURIComponent(encodedFilename)
    : plainFilename || 'Receipt.pdf';
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export async function getMyRedemptions(filters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return data(await apiClient.get(`/me/redemptions?${query.toString()}`));
}

export async function getMyPointsHistory(filters) {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return data(await apiClient.get(`/me/points-history?${query.toString()}`));
}

export async function getMyMembershipQr() {
  const url = `${API_BASE_URL}/me/membership/qr`;
  let response = await fetch(url, { credentials: 'include' });
  if (response.status === 401) {
    const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (refreshed.ok) response = await fetch(url, { credentials: 'include' });
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    try {
      const payload = await response.json();
      message = payload?.message || message;
    } catch {
      // Keep the HTTP status message when a non-JSON error body is returned.
    }
    throw new ApiClientError(message, response.status);
  }
  return URL.createObjectURL(await response.blob());
}
