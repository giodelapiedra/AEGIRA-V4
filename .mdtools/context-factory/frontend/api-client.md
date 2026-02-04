---
description: API Client Pattern for AEGIRA Frontend
globs: ["aegira-frontend/src/lib/api/**/*.ts"]
alwaysApply: false
---
# API Client

Centralized HTTP client that handles auth, timeouts, error handling, and response unwrapping.

## Location

```
lib/api/
├── client.ts       # APIClient class (single exported instance)
└── endpoints.ts    # ENDPOINTS constant with all route paths
```

## APIClient Implementation

```typescript
import { API_CONFIG } from '@/config/api.config';
import { useAuthStore } from '@/stores/auth.store';

const AUTH_ENDPOINTS = ['/auth/login', '/auth/signup', '/auth/session'];

class APIClient {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);

    try {
      const isFormData = options.body instanceof FormData;

      const response = await fetch(`${API_CONFIG.baseURL}${endpoint}`, {
        ...options,
        credentials: 'include',  // Send httpOnly cookies
        signal: controller.signal,
        headers: isFormData
          ? { ...options.headers }
          : { 'Content-Type': 'application/json', ...options.headers },
      });

      // 401 handling - redirect to login (except on auth endpoints)
      if (response.status === 401) {
        const isAuthEndpoint = AUTH_ENDPOINTS.some((e) => endpoint.includes(e));
        if (!isAuthEndpoint) {
          useAuthStore.getState().clearAuth();
          window.location.href = '/login';
          throw new Error('Session expired');
        }
      }

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error?.message || `Request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.data;  // Unwrap { success: true, data: ... }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
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
      body: JSON.stringify(body),
    });
  }

  async patch<T>(endpoint: string, body: unknown): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  async upload<T>(endpoint: string, formData: FormData): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: formData,
      headers: {},  // Let browser set multipart/form-data boundary
    });
  }
}

export const apiClient = new APIClient();
```

## Key Behaviors

| Behavior                | Detail                                                    |
| ----------------------- | --------------------------------------------------------- |
| Auth                    | `credentials: 'include'` sends httpOnly cookies           |
| Timeout                 | AbortController with 30s timeout (`API_CONFIG.timeout`)   |
| Response unwrapping     | Returns `data.data` (strips `{ success, data }` wrapper)  |
| 401 handling            | Clears Zustand auth, hard redirects to `/login`           |
| 401 exception           | Auth endpoints (`/auth/*`) are exempt from redirect       |
| FormData                | Skips `Content-Type` header (browser sets boundary)       |
| Error format            | Extracts `error.message` from backend error response      |

## ENDPOINTS Constant

```typescript
// lib/api/endpoints.ts
export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    SESSION: '/auth/session',
    LOGOUT: '/auth/logout',
  },
  CHECK_IN: {
    SUBMIT: '/check-ins',
    STATUS: '/check-ins/status',
    TODAY: '/check-ins/today',
    HISTORY: '/check-ins/history',
  },
  PERSON: {
    LIST: '/persons',
    CREATE: '/persons',
    UPDATE: '/persons',    // + /:id
    DELETE: '/persons',    // + /:id
    DETAIL: '/persons',    // + /:id
  },
  TEAM: {
    LIST: '/teams',
    CREATE: '/teams',
    // ... etc
  },
  DASHBOARD: {
    STATS: '/dashboard/stats',
  },
  // ... more endpoints
} as const;
```

## API Config

```typescript
// config/api.config.ts
export const API_CONFIG = {
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
};
```

## Rules

- ALWAYS use `apiClient` singleton (never raw `fetch`)
- ALWAYS use `ENDPOINTS` constants (never inline URL strings)
- ALWAYS use `credentials: 'include'` (cookie-based auth)
- NEVER set Authorization headers manually (cookies handle auth)
- NEVER store tokens in localStorage or Zustand
- Use `upload()` method for FormData (profile pictures, file uploads)
- API calls: `apiClient` + `ENDPOINTS` constants (dynamic endpoints are functions: `ENDPOINTS.PERSON.BY_ID(id)`)
- Query hooks: `useQuery` + `STALE_TIMES` (REALTIME 30s, STANDARD 2m, STATIC 10m, IMMUTABLE 30m)
- Mutations: `useMutation` + invalidate ALL affected query keys in `onSuccess`
- Pages: wrap in `<PageLoader isLoading error skeleton="type">` — never manual if/else
- Tables: `DataTable` from `@/components/ui/data-table` — never custom pagination
- Forms: React Hook Form + Zod (`zodResolver`) — never manual useState for form fields
- State: TanStack Query (server), Zustand (auth only), React Hook Form (forms)
- Page index: 0-indexed in frontend (`pageIndex`), 1-indexed in API (`page`)
- Types: import from `@/types/`, re-export from hooks
