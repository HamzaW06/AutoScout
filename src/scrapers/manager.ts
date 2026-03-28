// ── Scraper Manager ────────────────────────────────────────────────
// Orchestrates scraping across multiple dealers with concurrency
// control, retry logic with exponential backoff, and result processing
// through the enrichment pipeline.
// -------------------------------------------------------------------

import pLimit from 'p-limit';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getDb } from '../db/database.js';
import {
  getActiveDealers,
  updateDealer,
  insertScrapeLog,
  getRecentScrapeResults,
  getDealer,
  updateDealerHealth,
  getDealerHealth,
} from '../db/queries.js';
import { DealerHealthTracker, emitIfStateChanged } from './health.js';
import { processListings } from '../enrichment/pipeline.js';
import { emitScrapeComplete } from '../websocket.js';
import type { BaseScraper, ScraperResult } from './base.js';
import type { DealerRow, ScrapeLogRow } from '../db/queries.js';
import { runCascade } from './cascade.js';

// ── Priority levels ──────────────────────────────────────────────

type ScrapePriority = 'critical' | 'high' | 'medium' | 'low';

const PRIORITY_ORDER: ScrapePriority[] = ['critical', 'high', 'medium', 'low'];

// ── Manager class ────────────────────────────────────────────────

export class ScraperManager {
  private limit: ReturnType<typeof pLimit>;
  private scrapers: Map<string, BaseScraper> = new Map();
  private running = false;

  constructor() {
    this.limit = pLimit(config.maxConcurrentScrapers);
  }

  /** Register a scraper implementation under a given name (e.g. 'craigslist', 'platform'). */
  registerScraper(name: string, scraper: BaseScraper): void {
    this.scrapers.set(name, scraper);
    logger.info({ scraper: name }, 'manager: scraper registered');
  }

  /**
   * Scrape a single dealer by ID.
   *
   * 1. Look up the dealer in the database
   * 2. Choose a scraper based on dealer.scraper_type
   * 3. Run scraper with retry (max 3 attempts, exponential backoff)
   * 4. Process results through the enrichment pipeline
   * 5. Log to scrape_log
   * 6. Update dealer.last_scraped and dealer.scrape_success_rate
   */
  async scrapeDealer(dealerId: number): Promise<ScraperResult> {
    const start = Date.now();
    const dealer = getDealer(dealerId);

    if (!dealer) {
      const msg = `Dealer ${dealerId} not found`;
      logger.error(msg);
      return { success: false, listings: [], errors: [msg], duration_ms: Date.now() - start };
    }

    const scraperType = this.resolveScraperType(dealer);
    const scraper = this.scrapers.get(scraperType);

    if (!scraper) {
      const msg = `No scraper registered for type '${scraperType}' (dealer ${dealer.name})`;
      logger.error(msg);
      return { success: false, listings: [], errors: [msg], duration_ms: Date.now() - start };
    }

    logger.info(
      { dealerId, dealer: dealer.name, scraperType },
      'manager: starting dealer scrape',
    );

    // Build scraper options from dealer config and dealer URLs.
    let scraperOptions: Record<string, unknown> = {};
    if (dealer.scraper_config) {
      try {
        const parsed = JSON.parse(dealer.scraper_config);
        if (parsed && typeof parsed === 'object') {
          scraperOptions = parsed as Record<string, unknown>;
        }
      } catch {
        logger.warn({ dealerId }, 'manager: invalid scraper_config JSON, using defaults');
      }
    }

    if (scraperOptions.inventoryUrl == null) {
      scraperOptions.inventoryUrl = dealer.inventory_url ?? dealer.website_url;
    }

    // Run with retry
    let result: ScraperResult;
    try {
      const isGenericScraper =
        scraperType === 'ai_generic' ||
        scraperType === 'generic-ai' ||
        scraperType === 'generic_ai';

      if (isGenericScraper) {
        // Use the full cascade for generic dealers so we still leverage
        // structured data and API discovery before AI extraction.
        result = await scrapeGenericDealerWithCascade(dealer, scraperOptions);

        // If cascade fails, fall back to the registered generic scraper.
        if (!result.success && scraper) {
          result = await scrapeWithRetry(scraper, scraperOptions, 2);
        }
      } else {
        result = await scrapeWithRetry(scraper, scraperOptions, 3);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result = { success: false, listings: [], errors: [msg], duration_ms: Date.now() - start };
    }

    // Update dealer health state machine
    {
      const healthTracker = new DealerHealthTracker();
      const currentHealth = getDealerHealth(dealer.id);
      const previousState = currentHealth?.health_state ?? 'healthy';

      if (result.success && result.listings.length > 0) {
        // Check for sudden drop in listing count
        if (
          currentHealth &&
          healthTracker.detectSuddenDrop(currentHealth.last_listing_count, result.listings.length)
        ) {
          logger.warn(
            {
              dealerId: dealer.id,
              previousCount: currentHealth.last_listing_count,
              currentCount: result.listings.length,
            },
            'Sudden listing count drop detected — possible site redesign',
          );
        }
        updateDealerHealth(dealer.id, 'healthy', 0, dealer.scraper_type ?? 'platform', result.listings.length);
        emitIfStateChanged(dealer.id, dealer.name, previousState, 'healthy');
      } else {
        const failures = (currentHealth?.consecutive_failures ?? 0) + 1;
        const state = healthTracker.getState({
          consecutiveFailures: failures,
          lastSuccessAt: currentHealth?.last_success_at ?? null,
        });
        updateDealerHealth(
          dealer.id,
          state,
          failures,
          currentHealth?.last_tier_used ?? 'unknown',
          currentHealth?.last_listing_count ?? 0,
        );
        emitIfStateChanged(dealer.id, dealer.name, previousState, state);

        if (state === 'dead') {
          logger.error({ dealerId: dealer.id, name: dealer.name }, 'Dealer marked as DEAD — alerting user');
        }
      }
    }

    // Process results through enrichment pipeline
    if (result.listings.length > 0) {
      try {
        const source = `dealer:${dealer.id}:${dealer.name}`;
        const rawListings = result.listings.map((l) => ({
          ...l,
          dealer_id: dealer.id,
          seller_name: l.seller_name ?? dealer.name,
          seller_phone: l.seller_phone ?? dealer.phone,
          seller_location: l.seller_location ?? ([dealer.city, dealer.state].filter(Boolean).join(', ') || null),
          seller_lat: dealer.lat,
          seller_lng: dealer.lng,
        }));

        const pipelineResult = await processListings(
          rawListings as unknown as Record<string, unknown>[],
          source,
        );

        logger.info(
          { dealerId, ...pipelineResult },
          'manager: enrichment pipeline complete',
        );

        // Emit scrape_complete WebSocket event
        emitScrapeComplete(dealer.id, dealer.name, result.listings.length);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Pipeline error: ${msg}`);
        logger.error({ dealerId, error: msg }, 'manager: enrichment pipeline failed');
      }
    }

    // Log to scrape_log
    const durationMs = Date.now() - start;
    insertScrapeLog({
      source: scraperType,
      dealer_id: dealer.id,
      started_at: new Date(start).toISOString(),
      completed_at: new Date().toISOString(),
      listings_found: result.listings.length,
      errors: result.errors.length > 0 ? JSON.stringify(result.errors) : null,
      duration_ms: durationMs,
    });

    // Update dealer metadata
    updateDealer(dealer.id, {
      last_scraped: new Date().toISOString(),
      last_listing_count: result.listings.length,
    });

    // Update reliability tracking
    updateDealerReliability(dealer.id, result.success);

    return { ...result, duration_ms: durationMs };
  }

  private resolveScraperType(dealer: DealerRow): string {
    const rawType = (dealer.scraper_type ?? 'ai_generic').toLowerCase();

    if (rawType === 'platform') {
      const platform = (dealer.platform ?? '').toLowerCase();
      if (platform === 'dealer.com' || platform === 'dealer_com' || platform === 'dealercom') {
        return 'dealer.com';
      }
      if (platform === 'frazer') {
        return 'frazer';
      }
      if (platform === 'facebook') {
        return 'facebook';
      }
      return 'ai_generic';
    }

    if (rawType === 'generic-ai' || rawType === 'generic_ai') {
      return 'ai_generic';
    }
    if (rawType === 'dealer_com' || rawType === 'dealercom') {
      return 'dealer.com';
    }

    return rawType;
  }

  /**
   * Run a full scrape across all active dealers.
   *
   * 1. Get all active dealers
   * 2. Group by scrape_priority (critical, high, medium, low)
   * 3. Process each group with concurrency limit
   * 4. Log summary
   */
  async runFullScrape(): Promise<void> {
    this.running = true;
    const start = Date.now();
    const dealers = getActiveDealers();

    if (dealers.length === 0) {
      logger.info('manager: no active dealers to scrape');
      this.running = false;
      return;
    }

    logger.info({ dealerCount: dealers.length }, 'manager: starting full scrape');

    // Group dealers by priority
    const groups = new Map<ScrapePriority, DealerRow[]>();
    for (const p of PRIORITY_ORDER) {
      groups.set(p, []);
    }
    for (const dealer of dealers) {
      const priority = (dealer.scrape_priority ?? this.getScrapePriority(dealer)) as ScrapePriority;
      const list = groups.get(priority) ?? groups.get('medium')!;
      list.push(dealer);
    }

    // Process each priority group in order
    let totalScraped = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const priority of PRIORITY_ORDER) {
      if (!this.running) {
        logger.info('manager: scrape stopped by user');
        break;
      }

      const dealersInGroup = groups.get(priority)!;
      if (dealersInGroup.length === 0) continue;

      logger.info(
        { priority, count: dealersInGroup.length },
        'manager: processing priority group',
      );

      const tasks = dealersInGroup.map((dealer) =>
        this.limit(async () => {
          if (!this.running) return null;

          try {
            const result = await this.scrapeDealer(dealer.id);
            return result;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            logger.error({ dealerId: dealer.id, error: msg }, 'manager: dealer scrape failed');
            return { success: false, listings: [], errors: [msg], duration_ms: 0 } as ScraperResult;
          }
        }),
      );

      const results = await Promise.all(tasks);

      for (const result of results) {
        if (!result) continue;
        totalScraped++;
        if (result.success) {
          totalSuccess++;
        } else {
          totalFailed++;
        }
      }
    }

    const durationMs = Date.now() - start;
    this.running = false;

    logger.info(
      { totalScraped, totalSuccess, totalFailed, durationMs },
      'manager: full scrape complete',
    );
  }

  /** Signal all running scrapers to stop. */
  async stopAll(): Promise<void> {
    logger.info('manager: stopping all scrapers');
    this.running = false;
  }

  /**
   * Determine scrape priority for a dealer based on its type and inventory size.
   *
   * - critical: large inventory (100+) platform dealers
   * - high:     medium inventory or platform scrapers
   * - medium:   standard dealers
   * - low:      small/unknown dealers or generic scrapers
   */
  getScrapePriority(dealer: { scraper_type?: string | null; typical_inventory_size?: number | null }): string {
    const size = dealer.typical_inventory_size ?? 0;
    const type = dealer.scraper_type ?? 'ai_generic';

    if (type === 'platform' && size >= 100) return 'critical';
    if (type === 'platform' || size >= 50) return 'high';
    if (type === 'ai_generic' && size < 10) return 'low';
    return 'medium';
  }
}

// ── Retry helper ─────────────────────────────────────────────────

/**
 * Execute a scraper with retry logic.  Uses exponential backoff
 * (2s, 4s, 8s) and only retries on transient/retryable errors.
 */
async function scrapeWithRetry(
  scraper: BaseScraper,
  options: unknown,
  maxRetries: number,
): Promise<ScraperResult> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await scraper.scrape(options);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (!isRetryableError(lastError)) {
        logger.warn(
          { attempt, error: lastError.message, scraper: scraper.name },
          'manager: non-retryable error, aborting retries',
        );
        throw lastError;
      }

      if (attempt < maxRetries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        logger.info(
          { attempt, maxRetries, backoffMs, error: lastError.message, scraper: scraper.name },
          'manager: retrying after backoff',
        );
        await delay(backoffMs);
      }
    }
  }

  throw lastError ?? new Error('scrapeWithRetry: all attempts failed');
}

// ── Error classification ─────────────────────────────────────────

/**
 * Determine whether an error is transient and worth retrying.
 *
 * Retryable: timeout, 429 (rate limit), 502/503 (upstream), ECONNRESET, ECONNREFUSED
 * Not retryable: 404 (not found), 403 (forbidden), parse errors
 */
function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();

  // Retryable conditions
  const retryablePatterns = [
    'timeout',
    'aborted',
    'econnreset',
    'econnrefused',
    'enotfound',
    'epipe',
    'socket hang up',
    '429',
    '502',
    '503',
  ];

  if (retryablePatterns.some((p) => msg.includes(p))) {
    return true;
  }

  // Non-retryable conditions
  const nonRetryablePatterns = [
    '404',
    '403',
    '401',
    'parse error',
    'syntax error',
    'invalid json',
    'unexpected token',
  ];

  if (nonRetryablePatterns.some((p) => msg.includes(p))) {
    return false;
  }

  // Default: assume retryable for unknown errors
  return true;
}

// ── Dealer reliability tracking ──────────────────────────────────

/**
 * Update a dealer's scrape_success_rate and priority based on recent
 * scrape history.
 *
 * - If success rate drops below 30% over 5 attempts: demote to 'low' priority
 * - If success rate is 0% over 10 attempts: deactivate the dealer entirely
 */
function updateDealerReliability(dealerId: number, success: boolean): void {
  const recentLogs = getRecentScrapeResults(dealerId, 10);

  if (recentLogs.length === 0) return;

  // Count successes: a scrape_log entry is "successful" when it found listings
  // and had no errors (or the errors field is null/empty).
  const successCount = recentLogs.filter((log: ScrapeLogRow) => {
    const hasListings = (log.listings_found ?? 0) > 0;
    const hasErrors = log.errors != null && log.errors !== '' && log.errors !== '[]';
    return hasListings && !hasErrors;
  }).length;

  const rate = successCount / recentLogs.length;

  const updates: Record<string, unknown> = {
    scrape_success_rate: Math.round(rate * 100) / 100,
  };

  // Deactivate if 0% success rate over 10+ attempts
  if (recentLogs.length >= 10 && rate === 0) {
    updates.is_active = 0;
    logger.warn(
      { dealerId, attempts: recentLogs.length, rate },
      'manager: deactivating dealer due to 0% success rate',
    );
  }
  // Demote to low priority if < 30% over 5+ attempts
  else if (recentLogs.length >= 5 && rate < 0.3) {
    updates.scrape_priority = 'low';
    logger.warn(
      { dealerId, attempts: recentLogs.length, rate },
      'manager: demoting dealer to low priority',
    );
  }

  updateDealer(dealerId, updates);
}

// ── Utilities ────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildInventoryCandidates(primaryUrl: string): string[] {
  const candidates = new Set<string>();
  candidates.add(primaryUrl);

  try {
    const u = new URL(primaryUrl);
    const origin = u.origin;
    const commonPaths = [
      '/inventory',
      '/used-cars',
      '/vehicles',
      '/search-inventory',
      '/pre-owned',
    ];

    for (const path of commonPaths) {
      candidates.add(`${origin}${path}`);
    }
  } catch {
    // Ignore malformed URL and keep only primary URL.
  }

  return Array.from(candidates);
}

async function fetchHtmlForCascade(url: string): Promise<{ ok: boolean; html: string; error?: string }> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': config.userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: url,
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });

    if (!response.ok) {
      return { ok: false, html: '', error: `HTTP ${response.status} fetching ${url}` };
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return { ok: false, html: '', error: `Non-HTML response (${contentType}) from ${url}` };
    }

    const html = await response.text();
    if (!html || html.length < 200) {
      return { ok: false, html: '', error: `HTML too short from ${url}` };
    }

    return { ok: true, html };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, html: '', error: `Fetch failed for ${url}: ${msg}` };
  }
}

async function scrapeGenericDealerWithCascade(
  dealer: DealerRow,
  scraperOptions: Record<string, unknown>,
): Promise<ScraperResult> {
  const start = Date.now();
  const baseUrl =
    (typeof scraperOptions.inventoryUrl === 'string' ? scraperOptions.inventoryUrl : null) ??
    dealer.inventory_url ??
    dealer.website_url;

  if (!baseUrl) {
    return {
      success: false,
      listings: [],
      errors: ['Dealer has no inventory_url or website_url'],
      duration_ms: Date.now() - start,
    };
  }

  const errors: string[] = [];
  const candidates = buildInventoryCandidates(baseUrl);

  for (const candidate of candidates) {
    const fetched = await fetchHtmlForCascade(candidate);
    if (!fetched.ok) {
      if (fetched.error) errors.push(fetched.error);
      continue;
    }

    const cascade = await runCascade({
      url: candidate,
      html: fetched.html,
      platform: dealer.platform ?? null,
      dealerId: dealer.id,
    });

    if (cascade.success && cascade.listings.length > 0) {
      return {
        success: true,
        listings: cascade.listings,
        errors: cascade.errors,
        duration_ms: Date.now() - start,
      };
    }

    errors.push(...cascade.errors);
  }

  return {
    success: false,
    listings: [],
    errors,
    duration_ms: Date.now() - start,
  };
}
