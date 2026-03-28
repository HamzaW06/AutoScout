import cron from 'node-cron';
import { logger } from './logger.js';
import { getDb } from './db/database.js';
import { nightlyAuditSweep } from './audit/sweep.js';
import { sendDailyDigest, sendWeeklyReport } from './notifications/digest.js';

export function startScheduler(): void {
  logger.info('Starting scheduler...');

  // Database backup: daily at 1:55 AM
  cron.schedule('55 1 * * *', () => {
    logger.info('Running database backup...');
    try {
      const db = getDb();
      db.saveToFile();
      logger.info('Database backup completed');
    } catch (err) {
      logger.error(err, 'Database backup failed');
    }
  });

  // Audit sweep: daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Running nightly audit sweep...');
    try {
      await nightlyAuditSweep();
    } catch (err) {
      logger.error(err, 'Audit sweep failed');
    }
  });

  // Daily digest: 7:00 AM
  cron.schedule('0 7 * * *', async () => {
    logger.info('Sending daily digest...');
    try {
      await sendDailyDigest();
    } catch (err) {
      logger.error(err, 'Daily digest failed');
    }
  });

  // Weekly report: Monday 8:00 AM
  cron.schedule('0 8 * * 1', async () => {
    logger.info('Sending weekly report...');
    try {
      await sendWeeklyReport();
    } catch (err) {
      logger.error(err, 'Weekly report failed');
    }
  });

  // MarketCheck budget reset: midnight
  cron.schedule('0 0 * * *', () => {
    logger.info('Daily API budget reset');
    // When the marketcheck module exposes a resetDailyBudget(), call it here.
  });

  logger.info('Scheduler started with 5 cron jobs');
}
