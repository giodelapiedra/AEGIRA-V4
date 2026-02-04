import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { AdminWorkersPage } from './AdminWorkersPage';
import { setAuthenticatedUser, clearAuth } from '@/test/test-utils';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('AdminWorkersPage', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  it('renders page header correctly', async () => {
    render(<AdminWorkersPage />);

    await waitFor(() => {
      expect(screen.getByText('Worker Management')).toBeInTheDocument();
    });
  });

  it('displays workers list after loading', async () => {
    render(<AdminWorkersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('displays worker emails', async () => {
    render(<AdminWorkersPage />);

    await waitFor(() => {
      expect(screen.getByText('worker1@demo.com')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('worker2@demo.com')).toBeInTheDocument();
  });

  it('shows active status badges', async () => {
    render(<AdminWorkersPage />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    }, { timeout: 5000 });

    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it('has add worker button', async () => {
    render(<AdminWorkersPage />);

    await waitFor(() => {
      const addButtons = screen.getAllByRole('link');
      const addWorkerLink = addButtons.find(btn => btn.getAttribute('href')?.includes('/create'));
      expect(addWorkerLink).toBeTruthy();
    });
  });
});
