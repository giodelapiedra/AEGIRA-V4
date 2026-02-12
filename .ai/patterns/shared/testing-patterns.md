# Testing Patterns
> Vitest + Testing Library + MSW patterns for backend repos/services and frontend hooks/components

## When to Use
- Every new repository needs unit tests
- Every new service needs unit tests
- Complex business logic needs edge case coverage
- Frontend hooks need integration tests with MSW
- Page components need render + interaction tests

## Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Test Runner | Vitest | Fast, ESM-native test runner |
| Frontend Testing | Testing Library | React component testing |
| API Mocking | MSW (Mock Service Worker) | Mock API responses |
| Assertions | Vitest built-in | expect, describe, it |

## Canonical Implementation

### Backend: Repository Unit Test

```typescript
// src/modules/team/__tests__/team.repository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TeamRepository } from '../team.repository';
import { prismaMock } from '../../../test/prisma-mock';

describe('TeamRepository', () => {
  const companyId = 'company-123';
  let repository: TeamRepository;

  beforeEach(() => {
    repository = new TeamRepository(prismaMock, companyId);
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated teams for company', async () => {
      const mockTeams = [
        { id: 'team-1', name: 'Team A', company_id: companyId },
        { id: 'team-2', name: 'Team B', company_id: companyId },
      ];

      prismaMock.team.findMany.mockResolvedValue(mockTeams);
      prismaMock.team.count.mockResolvedValue(2);

      const result = await repository.findAll(1, 20);

      expect(result.items).toEqual(mockTeams);
      expect(result.total).toBe(2);
      expect(prismaMock.team.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ company_id: companyId }),
        })
      );
    });
  });

  describe('findById', () => {
    it('should return team if found', async () => {
      const mockTeam = { id: 'team-1', name: 'Team A', company_id: companyId };
      prismaMock.team.findFirst.mockResolvedValue(mockTeam);

      const result = await repository.findById('team-1');
      expect(result).toEqual(mockTeam);
    });

    it('should return null if not found', async () => {
      prismaMock.team.findFirst.mockResolvedValue(null);
      const result = await repository.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create team with company_id', async () => {
      const input = { name: 'New Team', leader_id: 'leader-1' };
      const mockCreated = { id: 'team-new', ...input, company_id: companyId };

      prismaMock.team.create.mockResolvedValue(mockCreated);

      const result = await repository.create(input);

      expect(result).toEqual(mockCreated);
      expect(prismaMock.team.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ company_id: companyId }),
      });
    });
  });
});
```

### Backend: Service Unit Test

```typescript
// src/modules/check-in/__tests__/check-in.service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckInService } from '../check-in.service';
import { prismaMock } from '../../../test/prisma-mock';

describe('CheckInService', () => {
  const companyId = 'company-123';
  const timezone = 'Asia/Manila';
  let service: CheckInService;

  beforeEach(() => {
    service = new CheckInService(prismaMock, companyId, timezone);
    vi.clearAllMocks();
  });

  describe('submitCheckIn', () => {
    it('should create check-in with calculated readiness', async () => {
      prismaMock.checkIn.findFirst.mockResolvedValue(null);
      prismaMock.checkIn.create.mockResolvedValue({
        id: 'checkin-new',
        person_id: 'person-123',
        readiness_level: 'GREEN',
        readiness_score: 85,
      });

      const result = await service.submitCheckIn('person-123', {
        sleepHours: 7,
        stressLevel: 3,
        physicalCondition: 4,
      });

      expect(result.readiness_level).toBe('GREEN');
    });

    it('should throw if already checked in today', async () => {
      prismaMock.checkIn.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(
        service.submitCheckIn('person-123', { sleepHours: 7, stressLevel: 3, physicalCondition: 4 })
      ).rejects.toThrow('ALREADY_CHECKED_IN');
    });
  });
});
```

### Frontend: Hook Test with MSW

```typescript
// src/features/team/hooks/__tests__/useTeams.test.ts
import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTeams } from '../useTeams';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTeams', () => {
  it('should fetch teams successfully', async () => {
    server.use(
      http.get('*/teams', () => {
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: '1', name: 'Team A' }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        });
      })
    );

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  it('should handle error', async () => {
    server.use(
      http.get('*/teams', () => {
        return HttpResponse.json(
          { success: false, error: { code: 'ERROR', message: 'Failed' } },
          { status: 500 }
        );
      })
    );

    const { result } = renderHook(() => useTeams(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
```

### Frontend: Component Test

```typescript
// src/features/team/pages/__tests__/TeamsPage.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamsPage } from '../TeamsPage';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{component}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('TeamsPage', () => {
  it('should render teams table', async () => {
    server.use(
      http.get('*/teams', () => {
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: '1', name: 'Alpha Team', member_count: 5 }],
            pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
          },
        });
      })
    );

    renderWithProviders(<TeamsPage />);
    await waitFor(() => expect(screen.getByText('Alpha Team')).toBeInTheDocument());
  });
});
```

### MSW Setup

```typescript
// src/test/mocks/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';
export const server = setupServer(...handlers);

// src/test/setup.ts
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from './mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Prisma Mock Setup

```typescript
// src/test/prisma-mock.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;
export const prismaMock = mockDeep<PrismaClient>();
```

## Test File Naming

| Type | Pattern | Example |
|------|---------|---------|
| Repository test | `<name>.repository.test.ts` | `team.repository.test.ts` |
| Service test | `<name>.service.test.ts` | `check-in.service.test.ts` |
| Controller test | `<name>.controller.test.ts` | `team.controller.test.ts` |
| Hook test | `use<Name>.test.ts` | `useTeams.test.ts` |
| Component test | `<Name>.test.tsx` | `TeamsPage.test.tsx` |

## Rules
- ✅ DO use `vi.clearAllMocks()` in `beforeEach`
- ✅ DO use `prismaMock` for backend repository/service tests
- ✅ DO use MSW `server.use()` for per-test API overrides
- ✅ DO use `renderHook` with QueryClientProvider wrapper for hook tests
- ✅ DO use `waitFor` for async assertions
- ✅ DO test error cases (not found, validation, duplicates)
- ✅ DO verify company_id filtering in repository tests
- ❌ NEVER use real database in unit tests
- ❌ NEVER forget `retry: false` in test QueryClient
- ❌ NEVER test implementation details (test behavior)
- ❌ NEVER use vague test descriptions ("should work")

## Test Commands

```bash
# Backend
cd aegira-backend
npm test              # Watch mode
npm run test:run      # Run once

# Frontend
cd aegira-frontend
npm test              # Watch mode
npm run test:run      # Run once
```
