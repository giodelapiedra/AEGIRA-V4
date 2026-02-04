import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth.store';
import { mockUser } from './mocks/handlers';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Don't retry failed queries in tests
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: ReactNode;
}

// All providers wrapper
function AllProviders({ children }: WrapperProps) {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
}

// Custom render with providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(ui, { wrapper: AllProviders, ...options });
}

// Set authenticated user in store
export function setAuthenticatedUser(user = mockUser) {
  useAuthStore.getState().setAuth(user);
}

// Clear auth state
export function clearAuth() {
  useAuthStore.getState().clearAuth();
}

// Wait for loading to finish
export async function waitForLoadingToFinish() {
  // Give React Query time to settle
  await new Promise((resolve) => setTimeout(resolve, 100));
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Export custom render as default render
export { customRender as render };
