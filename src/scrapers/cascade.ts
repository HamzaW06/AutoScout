// ── 4-Tier Scraper Cascade ────────────────────────────────────────
// Tries each extraction method in order until one succeeds.
// Tier 1: Platform-specific scraper (if platform is known)
// Tier 2: Structured data (JSON-LD / Schema.org)
// Tier 3: API discovery (probe common API endpoints)
// Tier 4: AI extraction (Gemini-powered generic scraper)
// -------------------------------------------------------------------

import { type ScrapedListing, type ScraperResult } from './base.js';
import { extractStructuredData } from './tiers/structured-data.js';
import { discoverApiEndpoints } from './tiers/api-discovery.js';
import { GenericAiScraper } from './platforms/generic-ai.js';
import { DealerComScraper } from './platforms/dealer-com.js';
import { FrazerScraper } from './platforms/frazer.js';
import { logger } from '../logger.js';

// ── Public interfaces ────────────────────────────────────────────

export interface CascadeInput {
  url: string;
  html: string;
  platform: string | null;
  dealerId: number;
}

export interface CascadeResult extends ScraperResult {
  tier_used: string;
  tiers_attempted: string[];
}

// ── Main orchestrator ────────────────────────────────────────────

export async function runCascade(input: CascadeInput): Promise<CascadeResult> {
  const tiersAttempted: string[] = [];
  const allErrors: string[] = [];

  // ── Tier 1: Platform-specific scraper ───────────────────────────
  if (input.platform) {
    tiersAttempted.push('platform');

    let platformScraper: DealerComScraper | FrazerScraper | null = null;

    if (input.platform === 'dealer_com' || input.platform === 'dealer.com') {
      platformScraper = new DealerComScraper();
    } else if (input.platform === 'frazer') {
      platformScraper = new FrazerScraper();
    }
    // Other platforms: no scraper available yet — skip

    if (platformScraper) {
      const result = await platformScraper.scrape({ inventoryUrl: input.url });
      if (result.success && result.listings.length > 0) {
        logger.info(
          { url: input.url, dealerId: input.dealerId, tier: 'platform', count: result.listings.length },
          'Cascade: tier 1 (platform) succeeded',
        );
        return {
          ...result,
          tier_used: 'platform',
          tiers_attempted: tiersAttempted,
        };
      }
      allErrors.push(...result.errors);
    }
  }

  // ── Tier 2: Structured data ──────────────────────────────────────
  tiersAttempted.push('structured_data');
  {
    const result = extractStructuredData(input.html, input.url);
    if (result.success && result.listings.length > 0) {
      logger.info(
        { url: input.url, dealerId: input.dealerId, tier: 'structured_data', count: result.listings.length },
        'Cascade: tier 2 (structured_data) succeeded',
      );
      return {
        ...result,
        tier_used: 'structured_data',
        tiers_attempted: tiersAttempted,
      };
    }
    allErrors.push(...result.errors);
  }

  // ── Tier 3: API discovery ────────────────────────────────────────
  tiersAttempted.push('api_discovery');
  {
    const result = await discoverApiEndpoints(input.url, input.html);
    if (result.success && result.listings.length > 0) {
      logger.info(
        { url: input.url, dealerId: input.dealerId, tier: 'api_discovery', count: result.listings.length },
        'Cascade: tier 3 (api_discovery) succeeded',
      );
      return {
        ...result,
        tier_used: 'api_discovery',
        tiers_attempted: tiersAttempted,
      };
    }
    allErrors.push(...result.errors);
  }

  // ── Tier 4: AI extraction ────────────────────────────────────────
  tiersAttempted.push('ai_extraction');
  {
    const result = await new GenericAiScraper().scrape({ inventoryUrl: input.url });
    if (result.success && result.listings.length > 0) {
      logger.info(
        { url: input.url, dealerId: input.dealerId, tier: 'ai_extraction', count: result.listings.length },
        'Cascade: tier 4 (ai_extraction) succeeded',
      );
      return {
        ...result,
        tier_used: 'ai_extraction',
        tiers_attempted: tiersAttempted,
      };
    }
    allErrors.push(...result.errors);
  }

  // ── All tiers failed ─────────────────────────────────────────────
  logger.warn(
    { url: input.url, dealerId: input.dealerId, tiersAttempted },
    'Cascade: all tiers failed, no listings extracted',
  );

  return {
    success: false,
    listings: [],
    errors: allErrors,
    duration_ms: 0,
    tier_used: 'none',
    tiers_attempted: tiersAttempted,
  };
}
