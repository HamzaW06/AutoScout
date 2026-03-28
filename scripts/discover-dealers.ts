import { initDatabase } from '../src/db/schema.js';
import { detectPlatform } from '../src/scrapers/detector.js';
import { logger } from '../src/logger.js';

async function main() {
  await initDatabase();

  const url = process.argv[2];
  if (!url) {
    console.error('Usage: npm run discover-dealers -- <dealer_website_url>');
    process.exit(1);
  }

  const result = await detectPlatform(url);
  logger.info({ url, ...result }, 'Dealer platform discovery result');
  console.log(JSON.stringify({ url, ...result }, null, 2));
}

main().catch((err) => {
  logger.error(err, 'discover-dealers failed');
  process.exit(1);
});
