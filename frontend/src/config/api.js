// Phase 1: Keep the browser's API origin configurable without exposing secrets.
const configuredApiUrl = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? '/api' : undefined);

if (!configuredApiUrl) {
  throw new Error('VITE_API_URL must be configured for production builds.');
}

function getApiBaseUrl() {
  const apiUrl = new URL(configuredApiUrl, window.location.href);
  return apiUrl.toString().replace(/\/+$/, '');
}

export const API_BASE_URL = getApiBaseUrl();

export function apiResourceUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return '';
  const value = path.trim();
  if (/^https?:\/\//i.test(value)) return value;
  return `${API_BASE_URL.replace(/\/api$/, '')}/${value.replace(/^\/+/, '')}`;
}

export function getImageUrl(path) {
  if (typeof path !== 'string' || !path.trim()) return '';
  const value = path.trim();
  if (/^https?:\/\//i.test(value)) return value;

  const normalized = value.replace(/\\/g, '/');
  const mediaIndex = normalized.toLowerCase().lastIndexOf('media/');
  const uploadIndex = normalized.toLowerCase().lastIndexOf('uploads/');
  const mediaPath = mediaIndex >= 0
    ? normalized.slice(mediaIndex)
    : uploadIndex >= 0
      ? `media/${normalized.slice(uploadIndex + 'uploads/'.length)}`
      : `media/${normalized.replace(/^\/+/, '')}`;
  const pathFromApi = `/${mediaPath.replace(/^\/+/, '')}`;
  return apiResourceUrl(pathFromApi);
}

export const apiFileUrl = getImageUrl;
