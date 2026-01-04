const DEFAULT_DEV_API_BASE_URL = 'http://localhost:3001';

export const apiBaseUrl = (() => {
  const envBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
  if (envBase) {
    return envBase.replace(/\/+$/, '');
  }
  if (!import.meta.env.PROD) {
    return DEFAULT_DEV_API_BASE_URL;
  }
  return '';
})();

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (!apiBaseUrl) {
    return normalizedPath;
  }
  return `${apiBaseUrl}${normalizedPath}`;
}
