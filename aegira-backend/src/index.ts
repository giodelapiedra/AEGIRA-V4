// Load environment variables first
import 'dotenv/config';

// AEGIRA Backend - Entry Point
import { serve } from '@hono/node-server';
import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initializeScheduler } from './jobs/scheduler';

const port = env.PORT;

logger.info(`Starting AEGIRA Backend on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

// Start scheduled jobs (cron)
initializeScheduler();

logger.info(`Server running at http://localhost:${port}`);
