import { useAuthStore } from '@/stores/auth.store';
import { API_CONFIG } from '@/config/api.config';
import { ENDPOINTS } from './endpoints';
import { ROUTES } from '@/config/routes.config';

/**
 * Structured API error with code and status from backend.
 * Extends Error so `error instanceof Error` checks still work.
 */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Auth endpoints that should not trigger hard redirect on 401
const AUTH_ENDPOINTS = [
  ENDPOINTS.AUTH.LOGIN,
  ENDPOINTS.AUTH.SIGNUP,
  ENDPOINTS.AUTH.ME,
  ENDPOINTS.AUTH.LOGOUT,
];

class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    try {
      const isFormData = options.body instanceof FormData;

      const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
        ...options,
        credentials: 'include',
        signal: controller.signal,
        headers: isFormData
          ? { ...options.headers }
          : { 'Content-Type': 'application/json', ...options.headers },
      });

      // Handle 401 - but NOT for auth endpoints (login/signup/me)
      if (response.status === 401) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => endpoint.includes(e));

        if (!isAuthEndpoint) {
          // Only redirect for non-auth endpoints (session expired)
          useAuthStore.getState().clearAuth();
          window.location.href = ROUTES.LOGIN;
          throw new ApiError('SESSION_EXPIRED', 'Session expired', 401);
        }
      }

      if (!response.ok) {
        const errorBody: { error?: { code?: string; message?: string } } = await response.json().catch((parseError) => {
          if (import.meta.env.DEV) {
            console.error('[APIClient] Failed to parse error response:', parseError);
          }
          return { error: { code: 'NETWORK_ERROR', message: response.statusText } };
        });
        throw new ApiError(
          errorBody.error?.code || 'UNKNOWN_ERROR',
          errorBody.error?.message || `Request failed: ${response.statusText}`,
          response.status,
        );
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('TIMEOUT', 'Request timed out. Please try again.', 408);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...(body instanceof FormData ? { headers: {} } : {}),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
      ...(body instanceof FormData ? { headers: {} } : {}),
    });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set multipart/form-data boundary
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new APIClient();
