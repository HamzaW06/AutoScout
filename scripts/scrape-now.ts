import { initDatabase } from '../src/db/schema.js';
import { createConfiguredScraperManager } from '../src/scrapers/registry.js';
import { logger } from '../src/logger.js';

async function main() {
  await initDatabase();
  const manager = createConfiguredScraperManager();

  logger.info('Running full scrape now...');
  await manager.runFullScrape();
  logger.info('Full scrape completed');
}

main().catch((err) => {
  logger.error(err, 'scrape-now failed');
  process.exit(1);
});
