// This shared Axios client sends admin cookies and safely renews an expired session once.
import axios from 'axios';
import { API_BASE_URL } from './image.js';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'X-Admin-Request': '1' },
});

api.interceptors.request.use((request) => {
  if (typeof request.headers.set === 'function') request.headers.set('X-Admin-Request', '1');
  else request.headers['X-Admin-Request'] = '1';
  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const authRequest = request?.url?.startsWith('/admin/auth/');
    if (
      typeof Blob !== 'undefined'
      && error.response?.data instanceof Blob
      && error.response.headers?.['content-type']?.includes('application/json')
    ) {
      const body = await error.response.data.text();
      try {
        error.response.data = JSON.parse(body);
      } catch {
        error.response.data = { message: body || error.message };
      }
    }
    let url = request?.url || '(unknown URL)';
    try {
      url = new URL(url, request?.baseURL || window.location.origin).pathname;
    } catch {
      url = url.split(/[?#]/, 1)[0];
    }
    console.error(
      `[admin-api] ${request?.method?.toUpperCase() || 'REQUEST'} ${url} failed (status ${error.response?.status ?? 'unavailable'}).`,
    );
    if (
      error.response?.status === 401
      && request
      && !request._retried
      && request.url !== '/admin/auth/login'
      && request.url !== '/admin/auth/refresh'
      && request.url !== '/admin/auth/forgot-password'
      && request.url !== '/admin/auth/reset-password'
    ) {
      request._retried = true;
      try {
        await api.post('/admin/auth/refresh', {});
        return api(request);
      } catch (refreshError) {
        if (request.url !== '/admin/auth/me') window.location.assign('/login');
        return Promise.reject(refreshError);
      }
    }
    if (error.response?.status === 401 && !authRequest) {
      window.location.assign('/login');
    }
    return Promise.reject(error);
  },
);

export function errorMessage(error, fallback = 'The request could not be completed.') {
  const status = error.response?.status ?? 'unavailable';
  const message = error.response?.data?.message || error.message || fallback;
  return `Request failed (status ${status}): ${message}`;
}

export default api;
