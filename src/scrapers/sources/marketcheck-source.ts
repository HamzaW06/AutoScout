/**
 * MarketCheck Listing Source
 *
 * Uses the MarketCheck /search/car/active API to pull real used-car
 * inventory near the user's configured location and feed it through
 * the enrichment pipeline.
 */

import { searchInventory } from '../marketcheck.js';
import { processListings, type PipelineResult } from '../../enrichment/pipeline.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

/** How many listings to fetch per page (MarketCheck max is 50). */
const PAGE_SIZE = 50;

/** Maximum pages per run — keeps us well inside the 500 calls/day budget. */
const MAX_PAGES = 4; // 4 × 50 = 200 listings, costs 4 API calls

export interface FetchMarketCheckOptions {
  lat?: number;
  lng?: number;
  radiusMiles?: number;
  maxListings?: number;
}

/**
 * Fetch used-car listings from MarketCheck near the user's location,
 * run them through the enrichment pipeline, and return a summary.
 */
export async function fetchMarketCheckListings(
  opts: FetchMarketCheckOptions = {},
): Promise<PipelineResult> {
  const lat = opts.lat ?? config.userLat;
  const lng = opts.lng ?? config.userLng;
  const radius = opts.radiusMiles ?? config.searchRadiusMiles;
  const maxListings = opts.maxListings ?? PAGE_SIZE * MAX_PAGES;

  const aggregate: PipelineResult = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  logger.info(
    { lat, lng, radius, maxListings },
    'MarketCheck source: starting inventory fetch',
  );

  let page = 0;
  let fetched = 0;

  while (fetched < maxListings) {
    const batchSize = Math.min(PAGE_SIZE, maxListings - fetched);

    let result;
    try {
      result = await searchInventory({
        radius,
        rows: batchSize,
        start: page * PAGE_SIZE,
        sortBy: 'dom',        // sort by days-on-market so freshest listings come first
        sortOrder: 'asc',
      });
    } catch (err) {
      logger.error({ err, page }, 'MarketCheck source: searchInventory error');
      aggregate.errors.push(`Page ${page}: ${err instanceof Error ? err.message : String(err)}`);
      break;
    }

    if (!result || result.listings.length === 0) {
      logger.info({ page }, 'MarketCheck source: no more listings');
      break;
    }

    // Convert NormalizedListing → raw record shape processListings expects
    // processListings accepts Record<string, unknown>[] and maps fields internally
    const raw = result.listings.map((l) => ({
      ...(l as unknown as Record<string, unknown>),
      // Ensure required ScrapedListing fields have defaults
      title_status: (l as unknown as Record<string, unknown>).title_status ?? 'unknown',
      seller_type: l.seller_type ?? 'dealer',
    }));

    const batchResult = await processListings(raw, 'marketcheck');

    aggregate.processed += batchResult.processed;
    aggregate.inserted += batchResult.inserted;
    aggregate.updated += batchResult.updated;
    aggregate.skipped += batchResult.skipped;
    aggregate.errors.push(...batchResult.errors);

    // Diagnostic: log first few skip/error reasons if nothing was inserted
    if (batchResult.inserted === 0 && batchResult.updated === 0 && batchResult.errors.length > 0) {
      logger.warn(
        { firstErrors: batchResult.errors.slice(0, 5), skipped: batchResult.skipped },
        'MarketCheck source: batch had 0 inserts — check errors',
      );
    }

    fetched += result.listings.length;
    page++;

    logger.info(
      {
        page,
        batchInserted: batchResult.inserted,
        batchUpdated: batchResult.updated,
        totalFetched: fetched,
        numFound: result.numFound,
      },
      'MarketCheck source: batch processed',
    );

    // If the API says there are no more listings, stop early
    if (fetched >= result.numFound) break;

    // Stop if we hit page limit
    if (page >= MAX_PAGES) break;

    // Small delay between pages to be polite
    await new Promise((r) => setTimeout(r, 500));
  }

  logger.info(
    {
      processed: aggregate.processed,
      inserted: aggregate.inserted,
      updated: aggregate.updated,
    },
    'MarketCheck source: fetch complete',
  );

  return aggregate;
}
