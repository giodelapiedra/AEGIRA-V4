// Debug: Log the API URL to verify environment variable is set
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
if (typeof window !== 'undefined') {
  console.log('[API Config] VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('[API Config] Using baseURL:', apiUrl);
}

export const API_CONFIG = {
  baseURL: apiUrl,
  timeout: 30000,
};
