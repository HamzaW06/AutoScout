import cron from 'node-cron';
import { logger } from './logger.js';
import { getDb } from './db/database.js';
import { nightlyAuditSweep } from './audit/sweep.js';
import { sendDailyDigest, sendWeeklyReport } from './notifications/digest.js';
import { getActiveDealers, getDealersNeedingAlert } from './db/queries.js';
import { sendDiscordAlert } from './notifications/discord.js';
import { createConfiguredScraperManager } from './scrapers/registry.js';
import { resetDailyBudget } from './scrapers/marketcheck.js';
import { syncMarketCheckListings } from './scrapers/marketcheck-sync.js';
import { fetchMarketCheckListings } from './scrapers/sources/marketcheck-source.js';
import { CraigslistScraper } from './scrapers/craigslist.js';
import { processListings } from './enrichment/pipeline.js';

/** Run MarketCheck inventory fetch + Craigslist scrape. Called on startup and by the manual trigger. */
export async function runListingFetch(): Promise<void> {
  logger.info('runListingFetch: starting MarketCheck + Craigslist fetch');

  // MarketCheck — broad location-based fetch (no search configs needed)
  try {
    const result = await fetchMarketCheckListings();
    logger.info(
      { inserted: result.inserted, updated: result.updated, errors: result.errors.length },
      'runListingFetch: MarketCheck complete',
    );
  } catch (err) {
    logger.error({ err }, 'runListingFetch: MarketCheck failed');
  }

  // Craigslist
  try {
    const scraper = new CraigslistScraper();
    const clResult = await scraper.scrape({ maxDetailFetches: 30 });
    if (clResult.listings.length > 0) {
      const raw = clResult.listings.map((l) => ({ ...l } as unknown as Record<string, unknown>));
      const pipeResult = await processListings(raw, 'craigslist');
      logger.info(
        { inserted: pipeResult.inserted, updated: pipeResult.updated },
        'runListingFetch: Craigslist complete',
      );
    } else {
      logger.info('runListingFetch: Craigslist returned 0 listings');
    }
  } catch (err) {
    logger.error({ err }, 'runListingFetch: Craigslist failed');
  }
}

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
    resetDailyBudget();
  });

  // MarketCheck inventory sync: every 2 hours at minute 15
  cron.schedule('15 */2 * * *', async () => {
    logger.info('Running MarketCheck inventory sync (every 2 hours)...');
    try {
      const result = await syncMarketCheckListings({
        maxConfigs: 6,
        maxPagesPerConfig: 2,
        rowsPerPage: 50,
      });
      logger.info({ result }, 'MarketCheck inventory sync complete');
    } catch (err) {
      logger.error(err, 'MarketCheck inventory sync failed');
    }
  });

  // Craigslist scrape: every 2 hours
  cron.schedule('0 */2 * * *', async () => {
    logger.info('Scheduled Craigslist scrape starting...');
    try {
      const scraper = new CraigslistScraper();
      const clResult = await scraper.scrape({ maxDetailFetches: 30 });
      if (clResult.listings.length > 0) {
        const raw = clResult.listings.map((l) => ({ ...l } as unknown as Record<string, unknown>));
        const pipeResult = await processListings(raw, 'craigslist');
        logger.info(
          { inserted: pipeResult.inserted, updated: pipeResult.updated },
          'Scheduled Craigslist scrape complete',
        );
      } else {
        logger.info('Scheduled Craigslist scrape: no listings returned');
      }
    } catch (err) {
      logger.error(err, 'Scheduled Craigslist scrape failed');
    }
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

  logger.info('Scheduler started with 11 cron jobs');
}
