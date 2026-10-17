// Phase 1: Send credentialed JSON requests and refresh an expired session once.
import { API_BASE_URL } from '../config/api.js';

export class ApiClientError extends Error {
  constructor(message, status, retryAfterSeconds) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function readResponse(response) {
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function request(path, options = {}, retried = false) {
  const headers = new Headers(options.headers || {});
  const isFormData = options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
    credentials: 'include',
  });
  const payload = await readResponse(response);

  if (response.status === 401 && !retried && path !== '/auth/refresh') {
    try {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (refreshResponse.ok) return request(path, options, true);
    } catch {
      // The original unauthorized response is more useful to the caller.
    }
  }

  if (!response.ok) {
    throw new ApiClientError(
      payload?.message || `Request failed with status ${response.status}.`,
      response.status,
      payload?.retryAfterSeconds,
    );
  }

  return payload;
}

const jsonRequest = (method) => (path, body) => request(path, {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

const apiClient = {
  get: (path) => request(path),
  post: jsonRequest('POST'),
  patch: jsonRequest('PATCH'),
  put: jsonRequest('PUT'),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData }),
  putForm: (path, formData) => request(path, { method: 'PUT', body: formData }),
  patchForm: (path, formData) => request(path, { method: 'PATCH', body: formData }),
};

export default apiClient;
