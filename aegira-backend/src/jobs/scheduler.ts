// Job Scheduler - Central cron setup
import cron from 'node-cron';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { detectMissedCheckIns } from './missed-check-in-detector';
import { runCleanup } from './cleanup';

/**
 * Cron trigger timezone (server time).
 * Note: This only controls WHEN cron fires. Each job processes
 * companies individually using their own company.timezone.
 */
const CRON_TIMEZONE = 'Asia/Manila';

/**
 * Initialize all scheduled jobs.
 * Call once from index.ts after server starts.
 * Respects ENABLE_SCHEDULER env variable — disabled in dev/staging by default.
 */
export function initializeScheduler(): void {
  if (!env.ENABLE_SCHEDULER) {
    logger.info('Scheduler disabled via ENABLE_SCHEDULER=false');
    return;
  }

  const tzOptions = { timezone: CRON_TIMEZONE };

  // Missed check-in detection — fires every 15 min, processes each company in its own timezone
  cron.schedule('*/15 * * * *', async () => {
    try {
      await detectMissedCheckIns();
    } catch (error) {
      logger.error({ error }, 'Missed check-in detector failed');
    }
  }, tzOptions);

  // Weekly cleanup — Sunday 2:00 AM server time
  cron.schedule('0 2 * * 0', async () => {
    try {
      await runCleanup();
    } catch (error) {
      logger.error({ error }, 'Weekly cleanup failed');
    }
  }, tzOptions);

  logger.info({ timezone: CRON_TIMEZONE }, 'Job scheduler initialized');
}
