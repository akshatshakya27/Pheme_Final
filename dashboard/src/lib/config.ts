const DEFAULT_API_BASE_URL = 'https://pheme-final.onrender.com';

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || DEFAULT_API_BASE_URL;
