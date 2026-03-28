import path from 'path';
import { fileURLToPath } from 'url';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { logger } from './logger.js';
import { getDb } from './db/database.js';
import {
  getActiveListings,
  getListingById,
  updateListing,
  getActiveDealers,
  getDealer,
  insertDealer,
  updateDealer,
  getActiveSearchConfigs,
  insertSearchConfig,
  countActiveListings,
  countActiveDealers,
  countUnresolvedAuditIssues,
  getActiveListingIdsByDealer,
  getDealerHealth,
  getRecentScrapeResults,
  getAllDealerHealthStatuses,
  insertTransaction,
  getTransactions,
  getAllSettings,
  setSetting,
  saveVinHistory,
  getVinHistory,
  type ActiveListingsOptions,
} from './db/queries.js';
import { bulkOnboard } from './scrapers/onboard.js';
import { createConfiguredScraperManager } from './scrapers/registry.js';
import { getRecalls } from './enrichment/recalls.js';
import { getComplaints } from './enrichment/complaints.js';
import { processListings } from './enrichment/pipeline.js';
import { syncMarketCheckListings } from './scrapers/marketcheck-sync.js';
import { getDailyCallCount, getDailyBudgetLimit } from './scrapers/marketcheck.js';

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/** Trim, strip control characters, and limit string length. */
function sanitizeString(raw: unknown, maxLen = 500): string | undefined {
  if (raw == null) return undefined;
  const s = String(raw)
    .trim()
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '')
    .slice(0, maxLen);
  return s.length > 0 ? s : undefined;
}

/** Parse to number, reject NaN, clamp to bounds. */
function parseNumeric(
  raw: unknown,
  min = -Infinity,
  max = Infinity,
): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) return undefined;
  return Math.max(min, Math.min(max, n));
}

/** Whitelist of valid sort columns for listings. */
const ALLOWED_SORT_COLUMNS = new Set([
  'asking_price',
  'mileage',
  'year',
  'deal_score',
  'first_seen',
  'days_on_market',
  'distance_miles',
  'created_at',
  'updated_at',
]);

// ---------------------------------------------------------------------------
// Async handler wrapper
// ---------------------------------------------------------------------------

function asyncHandler(fn: (req: Request, res: Response) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** Guard that checks if the database is reachable. Returns true if OK. */
function ensureDb(res: Response): boolean {
  try {
    getDb();
    return true;
  } catch {
    res.status(503).json({ error: 'Database not initialized' });
    return false;
  }
}

// ---------------------------------------------------------------------------
// Count active listings with the same filters as getActiveListings
// (queries.ts only exposes an unfiltered count, so we replicate the filter
// logic here using the safe query builder on getDb())
// ---------------------------------------------------------------------------

function countFilteredActiveListings(options: ActiveListingsOptions): number {
  const db = getDb();
  const conditions: string[] = ['is_active = 1'];
  const params: unknown[] = [];

  if (options.make) {
    conditions.push('make = ?');
    params.push(options.make);
  }
  if (options.model) {
    conditions.push('model = ?');
    params.push(options.model);
  }
  if (options.yearMin != null) {
    conditions.push('year >= ?');
    params.push(options.yearMin);
  }
  if (options.yearMax != null) {
    conditions.push('year <= ?');
    params.push(options.yearMax);
  }
  if (options.maxPrice != null) {
    conditions.push('asking_price <= ?');
    params.push(options.maxPrice);
  }
  if (options.maxMileage != null) {
    conditions.push('mileage <= ?');
    params.push(options.maxMileage);
  }
  if (options.titleStatus) {
    conditions.push('title_status = ?');
    params.push(options.titleStatus);
  }
  if (options.valueRating) {
    conditions.push('value_rating = ?');
    params.push(options.valueRating);
  }

  const whereClause = conditions.join(' AND ');
  const row = db.get<{ cnt: number }>(
    `SELECT COUNT(*) AS cnt FROM listings WHERE ${whereClause}`,
    params,
  );
  return row?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// Rating breakdown helper
// ---------------------------------------------------------------------------

function getRatingBreakdown(): Record<string, number> {
  const db = getDb();
  const rows = db.all<{ value_rating: string; cnt: number }>(
    `SELECT value_rating, COUNT(*) AS cnt
       FROM listings
      WHERE is_active = 1 AND value_rating IS NOT NULL
      GROUP BY value_rating`,
  );
  const breakdown: Record<string, number> = {};
  for (const row of rows) {
    breakdown[row.value_rating] = row.cnt;
  }
  return breakdown;
}

// ---------------------------------------------------------------------------
// Last inserted rowid helper for search configs
// ---------------------------------------------------------------------------

function getLastInsertRowId(): number {
  const db = getDb();
  const row = db.get<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row!.id;
}

function normalizePlatform(raw: unknown): string | undefined {
  const value = sanitizeString(raw)?.toLowerCase();
  if (!value) return undefined;

  if (value.includes('dealer.com') || value === 'dealer_com' || value === 'dealercom') {
    return 'dealer.com';
  }
  if (value.includes('frazer')) {
    return 'frazer';
  }
  if (value.includes('facebook')) {
    return 'facebook';
  }

  return value;
}

function scraperTypeForPlatform(platform: string | undefined): string {
  if (platform === 'dealer.com') return 'dealer.com';
  if (platform === 'frazer') return 'frazer';
  if (platform === 'facebook') return 'facebook';
  return 'ai_generic';
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createServer(): express.Express {
  const app = express();
  const configuredOrigins = new Set(config.allowedOrigins);
  const usingDefaultOrigins = configuredOrigins.size === 0;

  // ----- Security middleware -----
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (usingDefaultOrigins) {
          const isLocalOrigin =
            origin === 'http://localhost:5173' || origin === 'http://localhost:3000';
          callback(null, isLocalOrigin);
          return;
        }

        callback(null, configuredOrigins.has(origin));
      },
    }),
  );
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // ----- Serve frontend static files -----
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.join(__dirname, '..', 'web', 'dist');
  app.use(express.static(webDist));

  // ==========================================================================
  // Listings
  // ==========================================================================

  /** GET /api/listings – active listings with filters */
  app.get(
    '/api/listings',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;

      const q = _req.query;

      const opts: ActiveListingsOptions = {};
      opts.make = sanitizeString(q.make);
      opts.model = sanitizeString(q.model);
      opts.yearMin = parseNumeric(q.yearMin, 1900, 2100);
      opts.yearMax = parseNumeric(q.yearMax, 1900, 2100);
      opts.maxPrice = parseNumeric(q.maxPrice, 0, 10_000_000);
      opts.maxMileage = parseNumeric(q.maxMileage, 0, 1_000_000);
      opts.titleStatus = sanitizeString(q.titleStatus);
      opts.valueRating = sanitizeString(q.valueRating);

      // Sort
      const sortByRaw = sanitizeString(q.sortBy);
      if (sortByRaw && ALLOWED_SORT_COLUMNS.has(sortByRaw)) {
        opts.sortBy = sortByRaw;
      }
      const sortDirRaw = sanitizeString(q.sortDir);
      if (sortDirRaw === 'ASC' || sortDirRaw === 'DESC') {
        opts.sortDir = sortDirRaw;
      }

      // Pagination
      const rawLimit = parseNumeric(q.limit, 1, 200) ?? 50;
      const rawOffset = parseNumeric(q.offset, 0, 1_000_000) ?? 0;
      opts.limit = rawLimit;
      opts.offset = rawOffset;

      const listings = getActiveListings(opts);
      const total = countFilteredActiveListings(opts);

      res.json({ listings, total });
    }),
  );

  /** GET /api/listings/:id – single listing */
  app.get(
    '/api/listings/:id',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const listing = getListingById(id);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }
      res.json(listing);
    }),
  );

  /** PATCH /api/listings/:id/favorite – toggle favorite */
  app.patch(
    '/api/listings/:id/favorite',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const listing = getListingById(id);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      const isFavorite = req.body?.is_favorite;
      if (typeof isFavorite !== 'boolean') {
        res.status(400).json({ error: 'is_favorite must be a boolean' });
        return;
      }

      updateListing(id, { is_favorite: isFavorite ? 1 : 0 });
      res.json({ success: true });
    }),
  );

  /** PATCH /api/listings/:id/notes – update user notes */
  app.patch(
    '/api/listings/:id/notes',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const listing = getListingById(id);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      const notes = req.body?.notes;
      if (typeof notes !== 'string') {
        res.status(400).json({ error: 'notes must be a string' });
        return;
      }

      const sanitized = sanitizeString(notes, 5000) ?? '';
      updateListing(id, { user_notes: sanitized });
      res.json({ success: true });
    }),
  );

  // ==========================================================================
  // Dealers
  // ==========================================================================

  /** GET /api/dealers – all active dealers */
  app.get(
    '/api/dealers',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;
      const dealers = getActiveDealers();
      res.json(dealers);
    }),
  );

  /** GET /api/dealers/:id – single dealer */
  app.get(
    '/api/dealers/:id',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = parseNumeric(req.params.id, 1);
      if (id == null) {
        res.status(400).json({ error: 'Invalid dealer ID' });
        return;
      }

      const dealer = getDealer(id);
      if (!dealer) {
        res.status(404).json({ error: 'Dealer not found' });
        return;
      }
      res.json(dealer);
    }),
  );

  /** POST /api/dealers – add a new dealer */
  app.post(
    '/api/dealers',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const body = req.body;
      const name = sanitizeString(body?.name);
      if (!name) {
        res.status(400).json({ error: 'name is required' });
        return;
      }

      const websiteUrl = sanitizeString(body?.website_url);
      const inventoryUrl = sanitizeString(body?.inventory_url);
      if (!websiteUrl && !inventoryUrl) {
        res.status(400).json({ error: 'website_url or inventory_url is required' });
        return;
      }

      const normalizedPlatform = normalizePlatform(body?.platform);

      const dealer: Record<string, unknown> = { name };

      dealer.website_url = websiteUrl ?? null;
      dealer.inventory_url = inventoryUrl ?? websiteUrl ?? null;
      dealer.platform = normalizedPlatform ?? null;
      dealer.scraper_type = scraperTypeForPlatform(normalizedPlatform);
      dealer.scraper_config = JSON.stringify({
        inventoryUrl: inventoryUrl ?? websiteUrl,
      });

      // Optional string fields
      const optionalStrFields = [
        'address',
        'city',
        'state',
        'zip',
        'phone',
        'dealer_type',
      ] as const;
      for (const field of optionalStrFields) {
        const val = sanitizeString(body?.[field]);
        if (val != null) dealer[field] = val;
      }

      const id = insertDealer(dealer);
      res.status(201).json({ id });
    }),
  );

  /** PATCH /api/dealers/:id – update a dealer */
  app.patch(
    '/api/dealers/:id',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = parseNumeric(req.params.id, 1);
      if (id == null) {
        res.status(400).json({ error: 'Invalid dealer ID' });
        return;
      }

      const existing = getDealer(id);
      if (!existing) {
        res.status(404).json({ error: 'Dealer not found' });
        return;
      }

      const body = req.body;
      const fields: Record<string, unknown> = {};

      const allowedStrFields = [
        'name',
        'website_url',
        'inventory_url',
        'platform',
        'address',
        'city',
        'state',
        'zip',
        'phone',
        'dealer_type',
        'notes',
      ] as const;
      for (const field of allowedStrFields) {
        if (body?.[field] !== undefined) {
          fields[field] = sanitizeString(body[field]) ?? null;
        }
      }

      if (Object.keys(fields).length === 0) {
        res.status(400).json({ error: 'No valid fields provided' });
        return;
      }

      updateDealer(id, fields);
      res.json({ success: true });
    }),
  );

  // ==========================================================================
  // Search Configs
  // ==========================================================================

  /** GET /api/search-configs – all active search configs */
  app.get(
    '/api/search-configs',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;
      const configs = getActiveSearchConfigs();
      res.json(configs);
    }),
  );

  /** POST /api/search-configs – create a new search config */
  app.post(
    '/api/search-configs',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const body = req.body;
      const entry: Record<string, unknown> = {};

      // Optional fields
      const strFields = ['name', 'make', 'model', 'title_status'] as const;
      for (const f of strFields) {
        const val = sanitizeString(body?.[f]);
        if (val != null) entry[f] = val;
      }

      const numFields: Array<{ key: string; min: number; max: number }> = [
        { key: 'year_min', min: 1900, max: 2100 },
        { key: 'year_max', min: 1900, max: 2100 },
        { key: 'max_price', min: 0, max: 10_000_000 },
        { key: 'max_mileage', min: 0, max: 1_000_000 },
      ];
      for (const { key, min, max } of numFields) {
        const val = parseNumeric(body?.[key], min, max);
        if (val != null) entry[key] = val;
      }

      insertSearchConfig(entry);
      const id = getLastInsertRowId();
      res.status(201).json({ id });
    }),
  );

  // ==========================================================================
  // Stats & Health
  // ==========================================================================

  /** GET /api/stats – dashboard statistics */
  app.get(
    '/api/stats',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;

      const activeListings = countActiveListings();
      const activeDealers = countActiveDealers();
      const unresolvedIssues = countUnresolvedAuditIssues();
      const ratingBreakdown = getRatingBreakdown();

      res.json({
        activeListings,
        activeDealers,
        unresolvedIssues,
        ratingBreakdown,
      });
    }),
  );

  /** GET /api/health – health check */
  app.get(
    '/api/health',
    asyncHandler(async (_req, res) => {
      let database = false;
      let activeListings = 0;
      let activeDealers = 0;

      try {
        getDb();
        database = true;
        activeListings = countActiveListings();
        activeDealers = countActiveDealers();
      } catch {
        // database is not available
      }

      const status = database ? 'healthy' : 'degraded';
      res.json({
        status,
        database,
        activeListings,
        activeDealers,
        uptime: process.uptime(),
      });
    }),
  );

  // ==========================================================================
  // Scraping & Dealer Management
  // ==========================================================================

  /** POST /api/dealers/import – bulk onboard dealers (max 50 per batch) */
  app.post(
    '/api/dealers/import',
    asyncHandler(async (req, res) => {
      const body = req.body;
      const rawDealers = body?.dealers;

      if (!Array.isArray(rawDealers) || rawDealers.length === 0) {
        res.status(400).json({ error: 'dealers array is required' });
        return;
      }

      if (rawDealers.length > 50) {
        res.status(400).json({ error: 'Maximum 50 dealers per batch' });
        return;
      }

      const dealers = rawDealers.map((d: Record<string, unknown>) => ({
        websiteUrl: String(d.url ?? ''),
        dealerName: String(d.name ?? ''),
        city: sanitizeString(d.city) ?? null,
        state: sanitizeString(d.state) ?? null,
      })).filter((d) => d.websiteUrl && d.dealerName);

      if (dealers.length === 0) {
        res.status(400).json({ error: 'No valid dealers provided (url and name are required)' });
        return;
      }

      try {
        const results = await bulkOnboard(dealers);
        let inserted = 0;
        let insertFailed = 0;

        const persisted = results.map((result) => {
          const input = dealers.find(
            (d) => d.websiteUrl === result.websiteUrl && d.dealerName === result.dealerName,
          );
          const dealerName = input?.dealerName ?? result.dealerName;
          const websiteUrl = input?.websiteUrl ?? result.websiteUrl;
          let dealerId: number | null = null;
          let persistError: string | null = null;

          try {
            const platform = normalizePlatform(result.platform);
            const scraperType = scraperTypeForPlatform(platform);
            const inventoryUrl = result.inventoryUrl || websiteUrl;

            const dealerRecord: Record<string, unknown> = {
              name: dealerName,
              website_url: websiteUrl,
              inventory_url: inventoryUrl,
              platform: platform ?? null,
              scraper_type: scraperType,
              scraper_config: JSON.stringify({ inventoryUrl }),
              scrape_priority: result.suggestedPriority,
            };

            if (input?.city) dealerRecord.city = input.city;
            if (input?.state) dealerRecord.state = input.state;
            if (result.dealerMeta.phone) dealerRecord.phone = result.dealerMeta.phone;
            if (result.dealerMeta.address) dealerRecord.address = result.dealerMeta.address;

            dealerId = insertDealer(dealerRecord);
            inserted++;
          } catch (err) {
            insertFailed++;
            persistError = err instanceof Error ? err.message : String(err);
          }

          const combinedErrors = [...result.errors];
          if (persistError) {
            combinedErrors.push(`Persistence error: ${persistError}`);
          }

          return {
            ...result,
            dealerName,
            websiteUrl,
            dealerId,
            persisted: dealerId != null,
            persistError,
            // Keep backward-compatible keys expected by the onboarding UI.
            name: dealerName,
            url: websiteUrl,
            status: result.success ? 'OK' : 'FAILED',
            listings_found: result.listingsFound,
            priority: result.suggestedPriority,
            tier_used: result.tierUsed,
            error: combinedErrors.length > 0 ? combinedErrors.join(' | ') : undefined,
          };
        });

        const succeeded = results.filter((r) => r.success).length;
        const failed = results.length - succeeded;

        res.json({
          summary: {
            total: results.length,
            succeeded,
            failed,
            inserted,
            insertFailed,
          },
          results: persisted,
        });
      } catch (err) {
        logger.error(err, 'Bulk dealer import failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }),
  );

  /** POST /api/dealers/:id/scrape – scrape a specific dealer */
  app.post(
    '/api/dealers/:id/scrape',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = parseNumeric(req.params.id, 1);
      if (id == null) {
        res.status(400).json({ error: 'Invalid dealer ID' });
        return;
      }

      const dealer = getDealer(id);
      if (!dealer) {
        res.status(404).json({ error: 'Dealer not found' });
        return;
      }

      const websiteUrl = dealer.website_url ?? dealer.inventory_url;
      if (!websiteUrl) {
        res.status(400).json({ error: 'Dealer has no website_url or inventory_url' });
        return;
      }

      try {
        const manager = createConfiguredScraperManager();
        const result = await manager.scrapeDealer(id);
        res.json(result);
      } catch (err) {
        logger.error(err, 'Dealer scrape failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }),
  );

  /** GET /api/dealers/:id/health – dealer health status and recent scrapes */
  app.get(
    '/api/dealers/:id/health',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = parseNumeric(req.params.id, 1);
      if (id == null) {
        res.status(400).json({ error: 'Invalid dealer ID' });
        return;
      }

      const health = getDealerHealth(id);
      if (!health) {
        res.status(404).json({ error: 'Dealer not found' });
        return;
      }

      const recentScrapes = getRecentScrapeResults(id, 20);
      res.json({ health, recentScrapes });
    }),
  );

  /** GET /api/dealers/:id/listings – active listing IDs for a dealer */
  app.get(
    '/api/dealers/:id/listings',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const dealerId = parseNumeric(req.params.id, 1);
      if (dealerId == null) {
        res.status(400).json({ error: 'Invalid dealer ID' });
        return;
      }

      const rows = getActiveListingIdsByDealer(dealerId);
      const ids = rows.map((r) => r.id);
      res.json({ count: ids.length, ids });
    }),
  );

  /** GET /api/scraper-health – health summary for all active dealers */
  app.get(
    '/api/scraper-health',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;

      const dealers = getAllDealerHealthStatuses();

      const counts: Record<string, number> = {};
      for (const d of dealers) {
        counts[d.health_state] = (counts[d.health_state] ?? 0) + 1;
      }

      res.json({ summary: counts, dealers });
    }),
  );

  /** POST /api/scrape/run – trigger a full scrape asynchronously */
  app.post(
    '/api/scrape/run',
    asyncHandler(async (_req, res) => {
      res.json({ status: 'started' });

      // Run asynchronously after response is sent
      setImmediate(async () => {
        try {
          const manager = createConfiguredScraperManager();
          await manager.runFullScrape();
        } catch (err) {
          logger.error(err, 'Background full scrape failed');
        }
      });
    }),
  );

  /** POST /api/marketcheck/sync – ingest MarketCheck used-car inventory into dashboard */
  app.post(
    '/api/marketcheck/sync',
    asyncHandler(async (req, res) => {
      const maxPagesPerConfig = parseNumeric(req.body?.maxPagesPerConfig, 1, 20) ?? 4;
      const rowsPerPage = parseNumeric(req.body?.rowsPerPage, 1, 50) ?? 50;
      const maxConfigs = parseNumeric(req.body?.maxConfigs, 1, 50) ?? 8;
      const radius = parseNumeric(req.body?.radius, 1, 500) ?? 50;

      const syncResult = await syncMarketCheckListings({
        maxConfigs,
        maxPagesPerConfig,
        rowsPerPage,
        radius,
      });

      res.json(syncResult);
    }),
  );

  /** GET /api/marketcheck/status – daily MarketCheck usage stats */
  app.get(
    '/api/marketcheck/status',
    asyncHandler(async (_req, res) => {
      const used = getDailyCallCount();
      const budget = getDailyBudgetLimit();
      res.json({
        used,
        budget,
        remaining: Math.max(0, budget - used),
      });
    }),
  );

  // ==========================================================================
  // Enrichment & Analysis
  // ==========================================================================

  /** POST /api/listings/:id/analyze – re-run enrichment pipeline on a listing */
  app.post(
    '/api/listings/:id/analyze',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const listing = getListingById(id);
      if (!listing) {
        res.status(404).json({ error: 'Listing not found' });
        return;
      }

      try {
        await processListings([listing as unknown as Record<string, unknown>], listing.source);
        const enriched = getListingById(id);
        res.json(enriched);
      } catch (err) {
        logger.error(err, 'Listing analysis failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }),
  );

  // POST /api/listings/:id/vin-history — fetch VIN history report (on-demand, costs money)
  app.post(
    '/api/listings/:id/vin-history',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const listing = getListingById(id);
      if (!listing) return void res.status(404).json({ error: 'Listing not found' });
      if (!listing.vin || String(listing.vin).length !== 17) {
        return void res.status(400).json({ error: 'Listing has no valid VIN' });
      }

      // Check if we already have a recent report (within 7 days)
      const existing = getVinHistory(id);
      if (existing) {
        const parsed = JSON.parse(existing);
        const fetchedAt = new Date(parsed.fetchedAt);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (fetchedAt > sevenDaysAgo) {
          return void res.json({ cached: true, report: parsed });
        }
      }

      const { fetchVehicleHistory } = await import('./enrichment/vehicle-history.js');
      const report = await fetchVehicleHistory(String(listing.vin));

      if (!report) {
        return void res.status(502).json({ error: 'Failed to fetch VIN history. Check API key configuration.' });
      }

      // Save to DB
      saveVinHistory(id, JSON.stringify(report));

      // Update listing flags from history
      const updates: Record<string, unknown> = {};
      if (report.accidentCount > 0) updates.accident_count = report.accidentCount;
      if (report.ownerCount > 0) updates.owner_count = report.ownerCount;
      if (report.totalLoss) updates.total_loss_reported = 1;
      if (report.theftReported) updates.theft_reported = 1;
      if (report.rollbackSuspected) updates.odometer_rollback = 1;
      if (report.titleRecords.length > 0) {
        const latestTitle = report.titleRecords[report.titleRecords.length - 1];
        if (latestTitle.title_type && latestTitle.title_type !== 'clean') {
          updates.title_status = latestTitle.title_type;
        }
      }
      if (Object.keys(updates).length > 0) {
        updateListing(id, updates);
      }

      res.json({ cached: false, report });
    }),
  );

  // GET /api/listings/:id/vin-history — get cached VIN history
  app.get(
    '/api/listings/:id/vin-history',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const id = sanitizeString(req.params.id);
      if (!id) {
        res.status(400).json({ error: 'Invalid listing ID' });
        return;
      }

      const existing = getVinHistory(id);
      if (!existing) {
        return void res.status(404).json({ error: 'No VIN history report available. Use POST to fetch one.' });
      }
      res.json({ cached: true, report: JSON.parse(existing) });
    }),
  );

  /** GET /api/vehicle/:make/:model/:year/recalls – NHTSA recalls */
  app.get(
    '/api/vehicle/:make/:model/:year/recalls',
    asyncHandler(async (req, res) => {
      const make = sanitizeString(req.params.make);
      const model = sanitizeString(req.params.model);
      const year = parseNumeric(req.params.year, 1900, 2100);

      if (!make || !model || year == null) {
        res.status(400).json({ error: 'make, model, and year are required' });
        return;
      }

      try {
        const result = await getRecalls(make, model, year);
        res.json(result);
      } catch (err) {
        logger.error(err, 'Recalls lookup failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }),
  );

  /** GET /api/vehicle/:make/:model/:year/complaints – NHTSA complaints */
  app.get(
    '/api/vehicle/:make/:model/:year/complaints',
    asyncHandler(async (req, res) => {
      const make = sanitizeString(req.params.make);
      const model = sanitizeString(req.params.model);
      const year = parseNumeric(req.params.year, 1900, 2100);

      if (!make || !model || year == null) {
        res.status(400).json({ error: 'make, model, and year are required' });
        return;
      }

      try {
        const result = await getComplaints(make, model, year);
        res.json(result);
      } catch (err) {
        logger.error(err, 'Complaints lookup failed');
        res.status(500).json({ error: 'Internal server error' });
      }
    }),
  );

  // ==========================================================================
  // Export
  // ==========================================================================

  /** POST /api/listings/export – export listings as JSON or CSV */
  app.post(
    '/api/listings/export',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const body = req.body;
      const format = sanitizeString(body?.format);

      if (format !== 'csv' && format !== 'json') {
        res.status(400).json({ error: "format must be 'csv' or 'json'" });
        return;
      }

      // Build filter options from body.filters
      const filters = body?.filters ?? {};
      const opts: ActiveListingsOptions = {};
      opts.make = sanitizeString(filters.make);
      opts.model = sanitizeString(filters.model);
      opts.yearMin = parseNumeric(filters.yearMin, 1900, 2100);
      opts.yearMax = parseNumeric(filters.yearMax, 1900, 2100);
      opts.maxPrice = parseNumeric(filters.maxPrice, 0, 10_000_000);
      opts.maxMileage = parseNumeric(filters.maxMileage, 0, 1_000_000);
      opts.titleStatus = sanitizeString(filters.titleStatus);
      opts.valueRating = sanitizeString(filters.valueRating);
      opts.limit = 10_000;
      opts.offset = 0;

      const listings = getActiveListings(opts);

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="listings.json"');
        res.json(listings);
        return;
      }

      // CSV export
      const CSV_HEADERS = [
        'year', 'make', 'model', 'trim', 'price', 'mileage', 'vin',
        'market_value', 'deal_score', 'value_rating', 'risk_score',
        'seller_name', 'listing_url', 'exterior_color', 'transmission', 'drivetrain',
      ];

      function escapeCsv(val: unknown): string {
        if (val == null) return '';
        const s = String(val);
        if (s.includes(',') || s.includes('"') || s.includes('\n')) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      }

      const rows: string[] = [CSV_HEADERS.join(',')];
      for (const l of listings) {
        const row = [
          escapeCsv(l.year),
          escapeCsv(l.make),
          escapeCsv(l.model),
          escapeCsv(l.trim),
          escapeCsv(l.asking_price),
          escapeCsv(l.mileage),
          escapeCsv(l.vin),
          escapeCsv(l.market_value),
          escapeCsv(l.deal_score),
          escapeCsv(l.value_rating),
          escapeCsv(l.risk_score),
          escapeCsv(l.seller_name),
          escapeCsv(l.source_url),
          escapeCsv(l.exterior_color),
          escapeCsv(l.transmission),
          escapeCsv(l.drivetrain),
        ];
        rows.push(row.join(','));
      }

      const csv = rows.join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="listings.csv"');
      res.send(csv);
    }),
  );

  // ==========================================================================
  // Transactions
  // ==========================================================================

  /** POST /api/transactions – record a new transaction */
  app.post(
    '/api/transactions',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const body = req.body;
      const entry: Record<string, unknown> = {};

      const listingId = sanitizeString(body?.listing_id);
      if (listingId) entry.listing_id = listingId;

      const dealerId = parseNumeric(body?.dealer_id, 1);
      if (dealerId != null) entry.dealer_id = dealerId;

      const type = sanitizeString(body?.type);
      if (type) entry.negotiation_notes = type;

      const notes = sanitizeString(body?.notes, 5000);
      if (notes) entry.negotiation_notes = notes;

      const offeredPrice = parseNumeric(body?.offered_price, 0);
      if (offeredPrice != null) entry.asking_price = offeredPrice;

      const finalPrice = parseNumeric(body?.final_price, 0);
      if (finalPrice != null) entry.negotiated_price = finalPrice;

      insertTransaction(entry);
      res.status(201).json({ success: true });
    }),
  );

  /** GET /api/transactions – list recent transactions */
  app.get(
    '/api/transactions',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const limit = parseNumeric(req.query.limit, 1, 500) ?? 50;
      const transactions = getTransactions(limit);
      res.json(transactions);
    }),
  );

  // ==========================================================================
  // Settings
  // ==========================================================================

  /** GET /api/settings – return all user settings */
  app.get(
    '/api/settings',
    asyncHandler(async (_req, res) => {
      if (!ensureDb(res)) return;
      const settings = getAllSettings();
      res.json(settings);
    }),
  );

  /** PUT /api/settings – update one or more settings */
  app.put(
    '/api/settings',
    asyncHandler(async (req, res) => {
      if (!ensureDb(res)) return;

      const body = req.body;
      if (typeof body !== 'object' || body == null || Array.isArray(body)) {
        res.status(400).json({ error: 'Body must be a key/value object' });
        return;
      }

      for (const [key, value] of Object.entries(body)) {
        const k = sanitizeString(key, 256);
        const v = sanitizeString(value as unknown, 10_000);
        if (k && v !== undefined) {
          setSetting(k, v);
        }
      }

      res.json({ success: true });
    }),
  );

  // ==========================================================================
  // Global error handler (must be last)
  // ==========================================================================

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err, 'API error');
    res.status(500).json({ error: 'Internal server error' });
  });

  // ----- SPA fallback: serve index.html for all non-API routes -----
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  return app;
}

// ---------------------------------------------------------------------------
// Start listening
// ---------------------------------------------------------------------------

export function startServer(app: express.Express): void {
  app.listen(config.port, () => {
    logger.info(`API server listening on http://localhost:${config.port}`);
  });
}
