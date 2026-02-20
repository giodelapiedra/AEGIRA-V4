import { http, HttpResponse } from 'msw';

const API_URL = 'http://localhost:3000/api/v1';

// Mock data
export const mockUser = {
  id: 'user-1',
  email: 'admin@demo.com',
  firstName: 'Admin',
  lastName: 'User',
  gender: null as 'MALE' | 'FEMALE' | null,
  dateOfBirth: null as string | null,
  profilePictureUrl: null as string | null,
  contactNumber: null as string | null,
  emergencyContactName: null as string | null,
  emergencyContactPhone: null as string | null,
  emergencyContactRelationship: null as string | null,
  role: 'ADMIN' as const,
  companyId: 'company-1',
  companyName: 'Demo Company',
  companyTimezone: 'Asia/Manila',
};

export const mockPersons = [
  {
    id: 'person-1',
    company_id: 'company-1',
    email: 'worker1@demo.com',
    first_name: 'John',
    last_name: 'Doe',
    role: 'WORKER',
    team_id: 'team-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    team: { id: 'team-1', name: 'Team Alpha' },
  },
  {
    id: 'person-2',
    company_id: 'company-1',
    email: 'worker2@demo.com',
    first_name: 'Jane',
    last_name: 'Smith',
    role: 'SUPERVISOR',
    team_id: 'team-1',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    team: { id: 'team-1', name: 'Team Alpha' },
  },
];

export const mockTeams = [
  {
    id: 'team-1',
    company_id: 'company-1',
    name: 'Team Alpha',
    description: 'First team',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    _count: { members: 5 },
  },
  {
    id: 'team-2',
    company_id: 'company-1',
    name: 'Team Beta',
    description: 'Second team',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    _count: { members: 3 },
  },
];

export const mockCheckIn = {
  id: 'checkin-1',
  person_id: 'person-1',
  company_id: 'company-1',
  check_in_date: new Date().toISOString().split('T')[0],
  hours_slept: 7,
  sleep_quality: 8,
  stress_level: 3,
  physical_condition: 8,
  mental_state: 7,
  hydration_level: 8,
  nutrition_quality: 7,
  exercise_yesterday: true,
  notes: 'Feeling good',
  readiness_score: 85,
  readiness_category: 'ready',
  created_at: new Date().toISOString(),
};

// API Handlers
export const handlers = [
  // Auth handlers
  http.post(`${API_URL}/auth/login`, async ({ request }) => {
    const body = await request.json() as { email: string; password: string };

    if (body.email === 'admin@demo.com' && body.password === 'demo123') {
      return HttpResponse.json({
        success: true,
        data: {
          user: mockUser,
          token: 'mock-jwt-token',
        },
      });
    }

    return HttpResponse.json(
      { success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
      { status: 401 }
    );
  }),

  http.get(`${API_URL}/auth/me`, () => {
    return HttpResponse.json({
      success: true,
      data: mockUser,
    });
  }),

  // Persons handlers
  http.get(`${API_URL}/persons`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 20);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const filtered = includeInactive
      ? mockPersons
      : mockPersons.filter((p) => p.is_active);

    return HttpResponse.json({
      success: true,
      data: {
        items: filtered,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      },
    });
  }),

  http.get(`${API_URL}/persons/:id`, ({ params }) => {
    const person = mockPersons.find((p) => p.id === params.id);

    if (!person) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Person not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json({ success: true, data: person });
  }),

  http.post(`${API_URL}/persons`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newPerson = {
      id: `person-${Date.now()}`,
      company_id: 'company-1',
      email: body.email as string,
      first_name: body.firstName as string,
      last_name: body.lastName as string,
      role: (body.role as string) || 'WORKER',
      team_id: body.teamId as string | null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({ success: true, data: newPerson }, { status: 201 });
  }),

  http.patch(`${API_URL}/persons/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const person = mockPersons.find((p) => p.id === params.id);

    if (!person) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Person not found' } },
        { status: 404 }
      );
    }

    const updated = {
      ...person,
      first_name: (body.firstName as string) || person.first_name,
      last_name: (body.lastName as string) || person.last_name,
      is_active: body.isActive !== undefined ? body.isActive : person.is_active,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({ success: true, data: updated });
  }),

  // Teams handlers
  http.get(`${API_URL}/teams`, ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Number(url.searchParams.get('limit') || 20);
    const includeInactive = url.searchParams.get('includeInactive') === 'true';

    const filtered = includeInactive
      ? mockTeams
      : mockTeams.filter((t) => t.is_active);

    return HttpResponse.json({
      success: true,
      data: {
        items: filtered,
        pagination: {
          page,
          limit,
          total: filtered.length,
          totalPages: Math.ceil(filtered.length / limit),
        },
      },
    });
  }),

  http.get(`${API_URL}/teams/:id`, ({ params }) => {
    const team = mockTeams.find((t) => t.id === params.id);

    if (!team) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    return HttpResponse.json({ success: true, data: team });
  }),

  http.post(`${API_URL}/teams`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newTeam = {
      id: `team-${Date.now()}`,
      company_id: 'company-1',
      name: body.name as string,
      description: body.description as string | undefined,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      _count: { members: 0 },
    };

    return HttpResponse.json({ success: true, data: newTeam }, { status: 201 });
  }),

  http.patch(`${API_URL}/teams/:id`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    const team = mockTeams.find((t) => t.id === params.id);

    if (!team) {
      return HttpResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Team not found' } },
        { status: 404 }
      );
    }

    const updated = {
      ...team,
      name: (body.name as string) || team.name,
      description: body.description !== undefined ? body.description : team.description,
      is_active: body.isActive !== undefined ? body.isActive : team.is_active,
      updated_at: new Date().toISOString(),
    };

    return HttpResponse.json({ success: true, data: updated });
  }),

  // Check-in handlers
  http.get(`${API_URL}/check-ins/today`, () => {
    return HttpResponse.json({ success: true, data: null }); // No check-in today
  }),

  http.get(`${API_URL}/check-ins/status`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        isWorkDay: true,
        isWithinWindow: true,
        canCheckIn: true,
        hasCheckedInToday: false,
        schedule: {
          checkInStart: '06:00',
          checkInEnd: '10:00',
          workDays: ['1', '2', '3', '4', '5'],
        },
        team: {
          id: 'team-1',
          name: 'Team Alpha',
        },
        message: 'You can check in now',
      },
    });
  }),

  http.post(`${API_URL}/check-ins`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newCheckIn = {
      id: `checkin-${Date.now()}`,
      person_id: 'person-1',
      company_id: 'company-1',
      check_in_date: new Date().toISOString().split('T')[0],
      hours_slept: body.hoursSlept,
      sleep_quality: body.sleepQuality,
      stress_level: body.stressLevel,
      physical_condition: body.physicalCondition,
      pain_level: body.painLevel,
      pain_location: body.painLocation,
      physical_condition_notes: body.physicalConditionNotes,
      mental_state: body.mentalState,
      hydration_level: body.hydrationLevel,
      nutrition_quality: body.nutritionQuality,
      exercise_yesterday: body.exerciseYesterday,
      notes: body.notes,
      readiness_score: 75,
      readiness_category: 'ready',
      created_at: new Date().toISOString(),
    };

    return HttpResponse.json({ success: true, data: newCheckIn }, { status: 201 });
  }),

  // Dashboard handlers
  http.get(`${API_URL}/dashboard/admin`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        totalWorkers: 25,
        activeToday: 20,
        avgReadiness: 78,
        checkInRate: 80,
        teamStats: [
          { teamId: 'team-1', teamName: 'Team Alpha', checkInRate: 90, avgReadiness: 82 },
          { teamId: 'team-2', teamName: 'Team Beta', checkInRate: 75, avgReadiness: 74 },
        ],
      },
    });
  }),

  http.get(`${API_URL}/dashboard/worker`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        hasCheckedInToday: false,
        currentStreak: 5,
        weeklyAvgReadiness: 78,
        recentCheckIns: [],
      },
    });
  }),
];
