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
  type ActiveListingsOptions,
} from './db/queries.js';

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

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createServer(): express.Express {
  const app = express();

  // ----- Security middleware -----
  app.use(helmet());
  app.use(
    cors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
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

      const dealer: Record<string, unknown> = { name };

      // Optional string fields
      const optionalStrFields = [
        'website_url',
        'inventory_url',
        'platform',
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
  // Global error handler (must be last)
  // ==========================================================================

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(err, 'API error');
    res.status(500).json({ error: 'Internal server error' });
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
