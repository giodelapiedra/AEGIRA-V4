import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { AdminTeamsPage } from './AdminTeamsPage';
import { setAuthenticatedUser, clearAuth } from '@/test/test-utils';

// Mock useNavigate
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('AdminTeamsPage', () => {
  beforeEach(() => {
    setAuthenticatedUser();
  });

  afterEach(() => {
    clearAuth();
  });

  it('renders page header correctly', async () => {
    render(<AdminTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText('Team Management')).toBeInTheDocument();
    });
  });

  it('displays teams list after loading', async () => {
    render(<AdminTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('Team Beta')).toBeInTheDocument();
  });

  it('displays team descriptions', async () => {
    render(<AdminTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    }, { timeout: 5000 });

    expect(screen.getByText('First team')).toBeInTheDocument();
    expect(screen.getByText('Second team')).toBeInTheDocument();
  });

  it('shows active status badges', async () => {
    render(<AdminTeamsPage />);

    await waitFor(() => {
      expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    }, { timeout: 5000 });

    const activeBadges = screen.getAllByText('Active');
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it('has add team link', async () => {
    render(<AdminTeamsPage />);

    await waitFor(() => {
      const addLinks = screen.getAllByRole('link');
      const addTeamLink = addLinks.find(link => link.getAttribute('href')?.includes('/create'));
      expect(addTeamLink).toBeTruthy();
    });
  });
});
