import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { Dashboard } from './Dashboard';
import { useAuthStore } from '@/stores/auth.store';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/mocks/server';

const API_URL = 'http://localhost:3000/api/v1';

// Mock users for each role
const createMockUser = (role: 'ADMIN' | 'SUPERVISOR' | 'TEAM_LEAD' | 'WORKER') => ({
  id: `user-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@demo.com`,
  firstName: role.charAt(0) + role.slice(1).toLowerCase(),
  lastName: 'User',
  gender: null as 'MALE' | 'FEMALE' | null,
  dateOfBirth: null as string | null,
  profilePictureUrl: null as string | null,
  role,
  companyId: 'company-1',
  companyName: 'Demo Company',
  companyTimezone: 'Asia/Manila',
});

// Mock dashboard API responses
const mockAdminDashboardStats = {
  totalTeams: 4,
  activeTeams: 3,
  inactiveTeams: 1,
  totalWorkers: 25,
  totalTeamLeads: 4,
  totalSupervisors: 2,
  unassignedWorkers: 3,
};

const mockWorkerDashboardStats = {
  streak: 5,
  avgReadiness: 82,
  completionRate: 90,
  todayCheckIn: null,
  weeklyTrend: [],
};

const mockTeamLeadDashboardStats = {
  teamId: 'team-1',
  teamName: 'Team Alpha',
  teamSize: 8,
  todaySubmissions: 6,
  expectedCheckIns: 7,
  pendingCheckIns: 2,
  missedCheckIns: 0,
  complianceRate: 86,
  newlyAssigned: 1,
  teamAvgReadiness: 75,
  memberStatuses: [
    { personId: 'p1', fullName: 'John Doe', submitted: true, status: 'submitted', readinessCategory: 'ready' },
    { personId: 'p2', fullName: 'Jane Smith', submitted: false, status: 'pending', readinessCategory: null },
  ],
};

const mockSupervisorDashboardStats = {
  totalTeams: 4,
  totalWorkers: 32,
  totalCheckIns: 28,
  totalPending: 4,
  overallAvgReadiness: 80,
  overallComplianceRate: 87,
  teams: [
    {
      teamId: 'team-1',
      teamName: 'Team Alpha',
      leaderId: 'lead-1',
      leaderName: 'Team Lead A',
      workerCount: 8,
      todayCheckIns: 7,
      pendingCheckIns: 1,
      avgReadiness: 82,
      complianceRate: 87,
    },
  ],
};

describe('Dashboard Role-Based Routing', () => {
  beforeEach(() => {
    // Clear auth state before each test
    useAuthStore.getState().clearAuth();

    // Setup API mocks for all dashboard endpoints
    server.use(
      http.get(`${API_URL}/dashboard/admin`, () => {
        return HttpResponse.json({ success: true, data: mockAdminDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/worker`, () => {
        return HttpResponse.json({ success: true, data: mockWorkerDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/team-lead`, () => {
        return HttpResponse.json({ success: true, data: mockTeamLeadDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/supervisor`, () => {
        return HttpResponse.json({ success: true, data: mockSupervisorDashboardStats });
      })
    );
  });

  it('returns null when no user is authenticated', () => {
    const { container } = render(<Dashboard />);
    expect(container.firstChild).toBeNull();
  });

  it('renders AdminDashboard for ADMIN role', async () => {
    useAuthStore.getState().setAuth(createMockUser('ADMIN'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Verify admin-specific content
    expect(screen.getByText('Company-wide overview and management')).toBeInTheDocument();
    expect(screen.getByText('Total Workers')).toBeInTheDocument();
    expect(screen.getByText('Manage Teams')).toBeInTheDocument();
    expect(screen.getByText('Manage Workers')).toBeInTheDocument();
  });

  it('renders SupervisorDashboard for SUPERVISOR role', async () => {
    useAuthStore.getState().setAuth(createMockUser('SUPERVISOR'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Supervisor Dashboard')).toBeInTheDocument();
    });

    // Verify supervisor-specific content
    expect(screen.getByText('Overview of all teams')).toBeInTheDocument();
    expect(screen.getByText('Total Teams')).toBeInTheDocument();
    expect(screen.getByText('Team Overview')).toBeInTheDocument();
  });

  it('renders TeamLeadDashboard for TEAM_LEAD role', async () => {
    useAuthStore.getState().setAuth(createMockUser('TEAM_LEAD'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Team Dashboard')).toBeInTheDocument();
    });

    // Verify team lead-specific content
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('Team Size')).toBeInTheDocument();
    expect(screen.getByText("Today's Submissions")).toBeInTheDocument();
    expect(screen.getByText('Team Member Status')).toBeInTheDocument();
  });

  it('renders WorkerDashboard for WORKER role', async () => {
    useAuthStore.getState().setAuth(createMockUser('WORKER'));

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    // Verify worker-specific content
    expect(screen.getByText('Your daily readiness overview')).toBeInTheDocument();
    expect(screen.getByText('Check-in Streak')).toBeInTheDocument();
    expect(screen.getByText("Today's Check-In")).toBeInTheDocument();
  });

  it('renders WorkerDashboard as default for unknown roles', async () => {
    // Force an unknown role (type assertion for testing)
    const unknownUser = {
      ...createMockUser('WORKER'),
      role: 'UNKNOWN_ROLE' as 'WORKER',
    };
    useAuthStore.getState().setAuth(unknownUser);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Your daily readiness overview')).toBeInTheDocument();
  });

  it('handles case-insensitive role comparison', async () => {
    // Test lowercase role
    const lowerCaseUser = {
      ...createMockUser('ADMIN'),
      role: 'admin' as 'ADMIN',
    };
    useAuthStore.getState().setAuth(lowerCaseUser);

    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
  });
});

describe('Dashboard API Integration', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('AdminDashboard displays correct stats from API', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/admin`, () => {
        return HttpResponse.json({
          success: true,
          data: {
            totalTeams: 6,
            activeTeams: 5,
            inactiveTeams: 1,
            totalWorkers: 50,
            totalTeamLeads: 5,
            totalSupervisors: 3,
            unassignedWorkers: 4,
          },
        });
      })
    );

    useAuthStore.getState().setAuth(createMockUser('ADMIN'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });

    // Verify stats are displayed
    expect(screen.getByText('6')).toBeInTheDocument(); // Total teams
    expect(screen.getByText('50')).toBeInTheDocument(); // Total workers
    expect(screen.getByText('5')).toBeInTheDocument(); // Team leads
    expect(screen.getByText('3')).toBeInTheDocument(); // Supervisors
  });

  it('TeamLeadDashboard shows "No team assigned" when teamId is null', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/team-lead`, () => {
        return HttpResponse.json({
          success: true,
          data: { teamId: null, teamName: null },
        });
      })
    );

    useAuthStore.getState().setAuth(createMockUser('TEAM_LEAD'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('No team assigned')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Contact your administrator to be assigned as a team leader.')
    ).toBeInTheDocument();
  });

  it('SupervisorDashboard displays team overview', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/supervisor`, () => {
        return HttpResponse.json({
          success: true,
          data: {
            totalTeams: 3,
            totalWorkers: 24,
            totalCheckIns: 20,
            overallAvgReadiness: 78,
            overallComplianceRate: 83,
            teams: [
              {
                teamId: 'team-1',
                teamName: 'Engineering',
                leaderId: 'lead-1',
                leaderName: 'John Lead',
                workerCount: 10,
                todayCheckIns: 8,
                pendingCheckIns: 2,
                avgReadiness: 82,
                complianceRate: 80,
              },
              {
                teamId: 'team-2',
                teamName: 'Operations',
                leaderId: 'lead-2',
                leaderName: 'Jane Lead',
                workerCount: 14,
                todayCheckIns: 12,
                pendingCheckIns: 2,
                avgReadiness: 75,
                complianceRate: 86,
              },
            ],
          },
        });
      })
    );

    useAuthStore.getState().setAuth(createMockUser('SUPERVISOR'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Engineering')).toBeInTheDocument();
      expect(screen.getByText('Operations')).toBeInTheDocument();
    });

    expect(screen.getByText('Team Lead: John Lead')).toBeInTheDocument();
    expect(screen.getByText('Team Lead: Jane Lead')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/admin`, () => {
        return HttpResponse.json(
          { success: false, error: { message: 'Server error' } },
          { status: 500 }
        );
      })
    );

    useAuthStore.getState().setAuth(createMockUser('ADMIN'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});

describe('Dashboard Role Flow Scenarios', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();

    server.use(
      http.get(`${API_URL}/dashboard/admin`, () => {
        return HttpResponse.json({ success: true, data: mockAdminDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/worker`, () => {
        return HttpResponse.json({ success: true, data: mockWorkerDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/team-lead`, () => {
        return HttpResponse.json({ success: true, data: mockTeamLeadDashboardStats });
      }),
      http.get(`${API_URL}/dashboard/supervisor`, () => {
        return HttpResponse.json({ success: true, data: mockSupervisorDashboardStats });
      })
    );
  });

  it('Scenario: Admin creates team - Team lead views workers - Worker checks in', async () => {
    // Step 1: Admin sees company overview with team management
    useAuthStore.getState().setAuth(createMockUser('ADMIN'));
    const { unmount: unmountAdmin } = render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Manage Teams')).toBeInTheDocument();
    expect(screen.getByText('Manage Workers')).toBeInTheDocument();
    unmountAdmin();

    // Step 2: Team Lead sees their team's workers
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth(createMockUser('TEAM_LEAD'));
    const { unmount: unmountTeamLead } = render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Team Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Team Alpha')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument(); // Team member
    expect(screen.getByText('Jane Smith')).toBeInTheDocument(); // Team member
    unmountTeamLead();

    // Step 3: Worker sees their personal check-in dashboard
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth(createMockUser('WORKER'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Your daily readiness overview')).toBeInTheDocument();
    expect(screen.getByText('Daily Check-In')).toBeInTheDocument();
  });

  it('Supervisor can see all teams overview', async () => {
    useAuthStore.getState().setAuth(createMockUser('SUPERVISOR'));
    render(<Dashboard />);

    await waitFor(() => {
      expect(screen.getByText('Supervisor Dashboard')).toBeInTheDocument();
    });

    // Supervisor sees aggregate stats
    expect(screen.getByText('Total Teams')).toBeInTheDocument();
    expect(screen.getByText('Total Workers')).toBeInTheDocument();
    expect(screen.getByText("Today's Check-ins")).toBeInTheDocument();
    expect(screen.getByText('Avg Readiness')).toBeInTheDocument();
  });

  it('Role hierarchy displays correct dashboard content', async () => {
    const roles: Array<'ADMIN' | 'SUPERVISOR' | 'TEAM_LEAD' | 'WORKER'> = [
      'ADMIN',
      'SUPERVISOR',
      'TEAM_LEAD',
      'WORKER',
    ];

    const expectedContent: Record<string, string> = {
      ADMIN: 'Admin Dashboard',
      SUPERVISOR: 'Supervisor Dashboard',
      TEAM_LEAD: 'Team Dashboard',
      WORKER: 'Dashboard',
    };

    for (const role of roles) {
      useAuthStore.getState().clearAuth();
      useAuthStore.getState().setAuth(createMockUser(role));

      const { unmount } = render(<Dashboard />);

      await waitFor(() => {
        expect(screen.getByText(expectedContent[role])).toBeInTheDocument();
      });

      unmount();
    }
  });
});
