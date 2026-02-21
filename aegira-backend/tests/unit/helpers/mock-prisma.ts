import { vi } from 'vitest';

export interface MockPrismaClient {
  incident: {
    groupBy: ReturnType<typeof vi.fn>;
  };
  case: {
    count: ReturnType<typeof vi.fn>;
  };
  team: {
    findMany: ReturnType<typeof vi.fn>;
  };
  $queryRaw: ReturnType<typeof vi.fn>;
}

export function createMockPrisma(): MockPrismaClient {
  return {
    incident: {
      groupBy: vi.fn(),
    },
    case: {
      count: vi.fn(),
    },
    team: {
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
}

