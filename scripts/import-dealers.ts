import { initDatabase } from '../src/db/schema.js';
import { insertDealer } from '../src/db/queries.js';
import { bulkOnboard } from '../src/scrapers/onboard.js';
import { logger } from '../src/logger.js';

function normalizePlatform(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.toLowerCase();
  if (value.includes('dealer.com') || value === 'dealer_com' || value === 'dealercom') {
    return 'dealer.com';
  }
  if (value.includes('frazer')) return 'frazer';
  if (value.includes('facebook')) return 'facebook';
  return value;
}

function scraperTypeForPlatform(platform: string | null): string {
  if (platform === 'dealer.com') return 'dealer.com';
  if (platform === 'frazer') return 'frazer';
  if (platform === 'facebook') return 'facebook';
  return 'ai_generic';
}

async function main() {
  await initDatabase();

  const payload = process.argv[2];
  if (!payload) {
    console.error('Usage: npm run import-dealers -- "https://dealer1.com,Dealer One;https://dealer2.com,Dealer Two"');
    process.exit(1);
  }

  const dealers = payload
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, name] = entry.split(',').map((p) => p.trim());
      return { websiteUrl: url || '', dealerName: name || url || '' };
    })
    .filter((d) => d.websiteUrl && d.dealerName);

  if (dealers.length === 0) {
    console.error('No valid dealer entries found.');
    process.exit(1);
  }

  const results = await bulkOnboard(dealers);
  let inserted = 0;

  for (const result of results) {
    const platform = normalizePlatform(result.platform);
    const scraperType = scraperTypeForPlatform(platform);
    const inventoryUrl = result.inventoryUrl || result.websiteUrl;

    try {
      insertDealer({
        name: result.dealerName,
        website_url: result.websiteUrl,
        inventory_url: inventoryUrl,
        platform,
        scraper_type: scraperType,
        scraper_config: JSON.stringify({ inventoryUrl }),
        scrape_priority: result.suggestedPriority,
      });
      inserted += 1;
    } catch (err) {
      logger.error({ err, dealer: result.dealerName }, 'Failed to insert dealer from import script');
    }
  }

  console.log(
    JSON.stringify(
      {
        total: results.length,
        succeeded: results.filter((r) => r.success).length,
        inserted,
        failed: results.filter((r) => !r.success).length,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  logger.error(err, 'import-dealers failed');
  process.exit(1);
});
