// Phase 5b: Keep public content and enquiry requests in one small API wrapper.
import apiClient from './apiClient.js';

export const contentApi = {
  posts: (filters = {}) => apiClient.get(`/posts${queryString(filters)}`),
  events: (filters = {}) => apiClient.get(`/events${queryString(filters)}`),
  submitEnquiry: (body) => apiClient.post('/enquiries', body),
};

function queryString(values) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  return query.size ? `?${query.toString()}` : '';
}
