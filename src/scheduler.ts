import cron from 'node-cron';
import { logger } from './logger.js';
import { getDb } from './db/database.js';
import { nightlyAuditSweep } from './audit/sweep.js';
import { sendDailyDigest, sendWeeklyReport } from './notifications/digest.js';
import { getActiveDealers, getDealersNeedingAlert } from './db/queries.js';
import { sendDiscordAlert } from './notifications/discord.js';
import { createConfiguredScraperManager } from './scrapers/registry.js';

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

  // ── Tiered scrape schedules ───────────────────────────────────────

  // High-priority dealers (critical/high): every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('Running high-priority dealer scrape (every 4 hours)...');
    try {
      const dealers = getActiveDealers().filter(
        (d) => d.scrape_priority === 'critical' || d.scrape_priority === 'high',
      );
      if (dealers.length === 0) {
        logger.info('No critical/high priority dealers to scrape');
        return;
      }
      const manager = createConfiguredScraperManager();
      for (const dealer of dealers) {
        try {
          await manager.scrapeDealer(dealer.id);
        } catch (err) {
          logger.error({ dealerId: dealer.id, err }, 'High-priority scrape failed for dealer');
        }
      }
    } catch (err) {
      logger.error(err, 'High-priority scrape schedule failed');
    }
  });

  // Medium-priority dealers: every 12 hours (6 AM and 6 PM)
  cron.schedule('0 6,18 * * *', async () => {
    logger.info('Running medium-priority dealer scrape (every 12 hours)...');
    try {
      const dealers = getActiveDealers().filter(
        (d) => d.scrape_priority === 'medium',
      );
      if (dealers.length === 0) {
        logger.info('No medium priority dealers to scrape');
        return;
      }
      const manager = createConfiguredScraperManager();
      for (const dealer of dealers) {
        try {
          await manager.scrapeDealer(dealer.id);
        } catch (err) {
          logger.error({ dealerId: dealer.id, err }, 'Medium-priority scrape failed for dealer');
        }
      }
    } catch (err) {
      logger.error(err, 'Medium-priority scrape schedule failed');
    }
  });

  // Low-priority dealers: daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running low-priority dealer scrape (daily at 3 AM)...');
    try {
      const dealers = getActiveDealers().filter(
        (d) => d.scrape_priority === 'low',
      );
      if (dealers.length === 0) {
        logger.info('No low priority dealers to scrape');
        return;
      }
      const manager = createConfiguredScraperManager();
      for (const dealer of dealers) {
        try {
          await manager.scrapeDealer(dealer.id);
        } catch (err) {
          logger.error({ dealerId: dealer.id, err }, 'Low-priority scrape failed for dealer');
        }
      }
    } catch (err) {
      logger.error(err, 'Low-priority scrape schedule failed');
    }
  });

  // Dead dealer check: every 6 hours — alert via Discord if any dealers are dead
  cron.schedule('0 */6 * * *', async () => {
    logger.info('Running dead dealer check (every 6 hours)...');
    try {
      const deadDealers = getDealersNeedingAlert();
      if (deadDealers.length === 0) return;

      const names = deadDealers.map((d) => `• ${d.name} (id: ${d.id})`).join('\n');
      const message = `⚠️ **Dead Dealer Alert** — ${deadDealers.length} dealer(s) require attention:\n${names}`;
      await sendDiscordAlert(message, []);
      logger.warn({ count: deadDealers.length }, 'Dead dealer alert sent');
    } catch (err) {
      logger.error(err, 'Dead dealer check failed');
    }
  });

  logger.info('Scheduler started with 9 cron jobs');
}
