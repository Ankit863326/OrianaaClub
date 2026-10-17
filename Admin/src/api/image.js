const configuredApiUrl = import.meta.env.VITE_API_URL;

if (!configuredApiUrl) {
  throw new Error('VITE_API_URL must be configured for the current Vite mode.');
}

export const API_BASE_URL = new URL(configuredApiUrl, window.location.href)
  .toString()
  .replace(/\/+$/, '');

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
  return `${API_BASE_URL.replace(/\/api$/, '')}/${mediaPath.replace(/^\/+/, '')}`;
}
