import apiClient from './apiClient.js';

export async function getCurrentTermsManifest() {
  const response = await apiClient.get('/terms/current', { cache: 'no-store' });
  const manifest = response?.data?.version ? response.data : response;
  if (!manifest || typeof manifest.version !== 'string' || !Array.isArray(manifest.languages)) {
    throw new Error('The agreement response is invalid.');
  }
  return manifest;
}

export async function getTermsApplication(applicationId) {
  const result = await apiClient.get(`/membership/applications/${encodeURIComponent(applicationId)}`);
  return result.data;
}

export async function saveTermsConsent(applicationId, consent) {
  const result = await apiClient.post(
    `/membership/applications/${encodeURIComponent(applicationId)}/terms-consent`,
    consent,
  );
  return result.data;
}
