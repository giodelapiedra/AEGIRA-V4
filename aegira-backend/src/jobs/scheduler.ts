// Job Scheduler - Central cron setup
import cron from 'node-cron';
import { logger } from '../config/logger';
import { detectMissedCheckIns } from './missed-check-in-detector';
import { runDailyReminder } from './daily-reminder';
import { runCleanup } from './cleanup';

/**
 * Initialize all scheduled jobs.
 * Call once from index.ts after server starts.
 */
export function initializeScheduler(): void {
  // Missed check-in detection - every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await detectMissedCheckIns();
    } catch (error) {
      logger.error({ error }, 'Missed check-in detector failed');
    }
  });

  // Daily check-in reminder - 5:30 AM server time
  cron.schedule('30 5 * * *', async () => {
    try {
      await runDailyReminder();
    } catch (error) {
      logger.error({ error }, 'Daily reminder failed');
    }
  });

  // Weekly cleanup - Sunday 2:00 AM server time
  cron.schedule('0 2 * * 0', async () => {
    try {
      await runCleanup();
    } catch (error) {
      logger.error({ error }, 'Weekly cleanup failed');
    }
  });

  logger.info('Job scheduler initialized');
}
