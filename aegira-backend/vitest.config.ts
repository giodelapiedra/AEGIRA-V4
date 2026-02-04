import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load environment variables
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000, // 60 second timeout for E2E tests
    hookTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.types.ts'],
    },
  },
});
