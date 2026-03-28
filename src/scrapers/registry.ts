import { ScraperManager } from './manager.js';
import { DealerComScraper } from './platforms/dealer-com.js';
import { FrazerScraper } from './platforms/frazer.js';
import { GenericAiScraper } from './platforms/generic-ai.js';
import { CraigslistScraper } from './craigslist.js';
import { FacebookMarketplaceScraper } from './facebook.js';

/** Build a scraper manager with all implemented scraper classes registered. */
export function createConfiguredScraperManager(): ScraperManager {
  const manager = new ScraperManager();

  const dealerCom = new DealerComScraper();
  manager.registerScraper('dealer.com', dealerCom);
  manager.registerScraper('dealer_com', dealerCom);

  manager.registerScraper('frazer', new FrazerScraper());

  const aiGeneric = new GenericAiScraper();
  manager.registerScraper('ai_generic', aiGeneric);
  manager.registerScraper('generic-ai', aiGeneric);
  manager.registerScraper('generic_ai', aiGeneric);

  manager.registerScraper('craigslist', new CraigslistScraper());
  manager.registerScraper('facebook', new FacebookMarketplaceScraper());

  return manager;
}