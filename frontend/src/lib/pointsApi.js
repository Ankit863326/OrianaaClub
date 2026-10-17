// Phase 3: Fetch the signed-in member's points balance and paginated ledger.
import apiClient from './apiClient.js';

export async function getPoints(options = {}) {
  const query = new URLSearchParams();
  Object.entries(options).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  const suffix = query.size ? `?${query.toString()}` : '';
  const result = await apiClient.get(`/member/points${suffix}`);
  return result.data;
}
