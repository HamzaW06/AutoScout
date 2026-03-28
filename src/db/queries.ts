import { getDb } from './database.js';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

/** Row shape returned from the listings table. */
export interface ListingRow {
  id: string;
  vin: string | null;
  source: string;
  source_url: string | null;
  source_listing_id: string | null;
  sources_found_on: string | null;
  is_multi_source: number;
  dealer_id: number | null;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string;
  exterior_color: string | null;
  interior_color: string | null;
  fuel_type: string;
  mpg_city: number | null;
  mpg_highway: number | null;
  mileage: number;
  title_status: string;
  accident_count: number;
  owner_count: number;
  was_rental: number;
  was_fleet: number;
  structural_damage: number;
  airbag_deployed: number;
  asking_price: number;
  market_value: number | null;
  deal_score: number | null;
  value_rating: string | null;
  price_per_mile: number | null;
  offer_low: number | null;
  offer_high: number | null;
  risk_score: number | null;
  risk_factors: string | null;
  scam_score: number;
  scam_flags: string | null;
  negotiation_power: number | null;
  negotiation_tactics: string | null;
  seller_type: string | null;
  seller_name: string | null;
  seller_phone: string | null;
  seller_location: string | null;
  seller_lat: number | null;
  seller_lng: number | null;
  distance_miles: number | null;
  photos: string | null;
  description: string | null;
  ai_analysis: string | null;
  photo_analysis: string | null;
  repair_forecast: string | null;
  listing_date: string | null;
  days_on_market: number | null;
  first_seen: string;
  last_seen: string;
  is_active: number;
  price_dropped: number;
  price_drop_count: number;
  is_favorite: number;
  user_notes: string | null;
  vin_verified: number;
  data_completeness: number;
  last_audit: string | null;
  audit_flags: string | null;
  scrape_confidence: number;
  scrape_tier: string | null;
  created_at: string;
  updated_at: string;
}

export interface DealerRow {
  id: number;
  name: string;
  website_url: string | null;
  inventory_url: string | null;
  platform: string | null;
  scraper_type: string | null;
  scraper_config: string | null;
  address: string | null;
  city: string | null;
  state: string;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  distance_miles: number | null;
  phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  yelp_rating: number | null;
  bbb_rating: string | null;
  bbb_complaint_count: number | null;
  dealer_rater_score: number | null;
  dealer_type: string | null;
  price_range: string | null;
  typical_inventory_size: number | null;
  specialties: string | null;
  notes: string | null;
  is_active: number;
  last_scraped: string | null;
  last_listing_count: number | null;
  scrape_success_rate: number | null;
  scrape_priority: string;
  added_by: string;
  created_at: string;
  updated_at: string;
}

export interface PriceHistoryRow {
  id: number;
  listing_id: string;
  price: number;
  source: string | null;
  recorded_at: string;
}

export interface ModelIntelligenceRow {
  id: number;
  make: string;
  model: string;
  year_min: number | null;
  year_max: number | null;
  engine: string | null;
  transmission: string | null;
  timing_type: string | null;
  timing_interval_miles: number | null;
  known_issues: string | null;
  critical_checks: string | null;
  avoid_if: string | null;
  reliability_score: number | null;
  avg_annual_repair_cost: number | null;
  expected_lifespan_miles: number | null;
  oil_type: string | null;
  oil_change_interval_miles: number | null;
  repair_schedule: string | null;
  failure_points: string | null;
  notes: string | null;
}

export interface PartsPricingRow {
  id: number;
  make: string;
  model: string;
  year_min: number | null;
  year_max: number | null;
  brake_pads_front: number | null;
  brake_pads_rear: number | null;
  brake_rotors_front_pair: number | null;
  brake_rotors_rear_pair: number | null;
  spark_plugs_set: number | null;
  oil_filter: number | null;
  air_filter: number | null;
  cabin_filter: number | null;
  alternator: number | null;
  starter_motor: number | null;
  water_pump: number | null;
  timing_belt_kit: number | null;
  ac_compressor: number | null;
  ac_condenser: number | null;
  radiator: number | null;
  battery: number | null;
  struts_front_pair: number | null;
  struts_rear_pair: number | null;
  wheel_bearing: number | null;
  catalytic_converter: number | null;
  oxygen_sensor: number | null;
  serpentine_belt: number | null;
  cv_axle: number | null;
  thermostat: number | null;
  parts_affordability_score: number | null;
  source: string;
  updated_at: string;
}

export interface SearchConfigRow {
  id: number;
  name: string | null;
  make: string | null;
  model: string | null;
  year_min: number | null;
  year_max: number | null;
  max_price: number | null;
  max_mileage: number | null;
  title_status: string;
  min_reliability_score: number;
  exclude_makes: string | null;
  exclude_transmissions: string | null;
  is_active: number;
  notify_on_steal: number;
  notify_on_great: number;
  created_at: string;
}

export interface ScrapeLogRow {
  id: number;
  source: string;
  dealer_id: number | null;
  started_at: string | null;
  completed_at: string | null;
  listings_found: number | null;
  new_listings: number | null;
  updated_listings: number | null;
  deactivated_listings: number | null;
  errors: string | null;
  duration_ms: number | null;
}

export interface AuditLogRow {
  id: number;
  listing_id: string;
  audit_type: string | null;
  severity: string | null;
  details: string | null;
  resolved: number;
  created_at: string;
}

export interface TransactionRow {
  id: number;
  listing_id: string | null;
  dealer_id: number | null;
  asking_price: number | null;
  negotiated_price: number | null;
  otd_price: number | null;
  negotiation_notes: string | null;
  purchased: number;
  walked_away_reason: string | null;
  visited_at: string;
}

// ---------------------------------------------------------------------------
// Options for getActiveListings
// ---------------------------------------------------------------------------

export interface ActiveListingsOptions {
  make?: string;
  model?: string;
  yearMin?: number;
  yearMax?: number;
  maxPrice?: number;
  maxMileage?: number;
  titleStatus?: string;
  valueRating?: string;
  sortBy?: string;
  sortDir?: 'ASC' | 'DESC';
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/** INSERT a new listing. Generates an ID with nanoid when not provided. */
export function insertListing(listing: Record<string, unknown>): void {
  const db = getDb();
  const id = (listing.id as string) || nanoid();
  const now = new Date().toISOString();

  const row: Record<string, unknown> = { ...listing, id };
  if (!row.first_seen) row.first_seen = now;
  if (!row.last_seen) row.last_seen = now;

  const columns = Object.keys(row);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => row[c]);

  db.run(
    `INSERT INTO listings (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

/** UPDATE specific fields on a listing by ID. Automatically bumps updated_at. */
export function updateListing(
  id: string,
  fields: Record<string, unknown>,
): void {
  const db = getDb();
  const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  const columns = Object.keys(updates);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const params = [...columns.map((c) => updates[c]), id];

  db.run(`UPDATE listings SET ${setClause} WHERE id = ?`, params);
}

/** SELECT a single listing by its primary key. */
export function getListingById(id: string): ListingRow | undefined {
  const db = getDb();
  return db.get<ListingRow>('SELECT * FROM listings WHERE id = ?', [id]);
}

/** SELECT the active listing with a given VIN. */
export function getListingByVin(vin: string): ListingRow | undefined {
  const db = getDb();
  return db.get<ListingRow>(
    'SELECT * FROM listings WHERE vin = ? AND is_active = 1',
    [vin],
  );
}

/** Find a listing by its external source ID and source name. */
export function getListingBySourceId(
  sourceListingId: string,
  source: string,
): ListingRow | undefined {
  const db = getDb();
  return db.get<ListingRow>(
    'SELECT * FROM listings WHERE source_listing_id = ? AND source = ?',
    [sourceListingId, source],
  );
}

/** SELECT active listings with optional dynamic filters, sorting, and pagination. */
export function getActiveListings(
  options: ActiveListingsOptions = {},
): ListingRow[] {
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

  // Whitelist allowed sort columns to prevent injection
  const allowedSortColumns = new Set([
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
  const sortCol = options.sortBy && allowedSortColumns.has(options.sortBy)
    ? options.sortBy
    : 'first_seen';
  const sortDir = options.sortDir === 'ASC' ? 'ASC' : 'DESC';

  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  params.push(limit, offset);

  return db.all<ListingRow>(
    `SELECT * FROM listings WHERE ${whereClause} ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
    params,
  );
}

/** Set is_active = 0 for a listing. */
export function deactivateListing(id: string): void {
  const db = getDb();
  db.run(
    'UPDATE listings SET is_active = 0, updated_at = ? WHERE id = ?',
    [new Date().toISOString(), id],
  );
}

/** COUNT all active listings. */
export function countActiveListings(): number {
  const db = getDb();
  const row = db.get<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM listings WHERE is_active = 1',
  );
  return row?.cnt ?? 0;
}

/** Get the IDs of all active listings belonging to a specific dealer. */
export function getActiveListingIdsByDealer(dealerId: number): { id: string }[] {
  const db = getDb();
  return db.all<{ id: string }>(
    'SELECT id FROM listings WHERE dealer_id = ? AND is_active = 1',
    [dealerId],
  );
}

/** Get all active listings that have been favorited. */
export function getFavoriteListings(): ListingRow[] {
  const db = getDb();
  return db.all<ListingRow>(
    'SELECT * FROM listings WHERE is_favorite = 1 AND is_active = 1',
  );
}

// ---------------------------------------------------------------------------
// Price History
// ---------------------------------------------------------------------------

/** INSERT a price history record for a listing. */
export function insertPriceHistory(
  listingId: string,
  price: number,
  source?: string,
): void {
  const db = getDb();
  db.run(
    'INSERT INTO price_history (listing_id, price, source) VALUES (?, ?, ?)',
    [listingId, price, source ?? null],
  );
}

// ---------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------

/** INSERT a new dealer, returns the new auto-incremented ID. */
export function insertDealer(dealer: Record<string, unknown>): number {
  const db = getDb();
  const columns = Object.keys(dealer);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => dealer[c]);

  db.run(
    `INSERT INTO dealers (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );

  const row = db.get<{ id: number }>('SELECT last_insert_rowid() AS id');
  return row!.id;
}

/** UPDATE specific fields on a dealer by ID. Bumps updated_at. */
export function updateDealer(
  id: number,
  fields: Record<string, unknown>,
): void {
  const db = getDb();
  const updates: Record<string, unknown> = { ...fields, updated_at: new Date().toISOString() };
  const columns = Object.keys(updates);
  const setClause = columns.map((c) => `${c} = ?`).join(', ');
  const params = [...columns.map((c) => updates[c]), id];

  db.run(`UPDATE dealers SET ${setClause} WHERE id = ?`, params);
}

/** SELECT a dealer by ID. */
export function getDealer(id: number): DealerRow | undefined {
  const db = getDb();
  return db.get<DealerRow>('SELECT * FROM dealers WHERE id = ?', [id]);
}

/** SELECT all active dealers. */
export function getActiveDealers(): DealerRow[] {
  const db = getDb();
  return db.all<DealerRow>('SELECT * FROM dealers WHERE is_active = 1');
}

/** COUNT all active dealers. */
export function countActiveDealers(): number {
  const db = getDb();
  const row = db.get<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM dealers WHERE is_active = 1',
  );
  return row?.cnt ?? 0;
}

/** Get recent scrape_log entries for a dealer, most recent first. */
export function getRecentScrapeResults(
  dealerId: number,
  limit: number,
): ScrapeLogRow[] {
  const db = getDb();
  return db.all<ScrapeLogRow>(
    'SELECT * FROM scrape_log WHERE dealer_id = ? ORDER BY id DESC LIMIT ?',
    [dealerId, limit],
  );
}

// ---------------------------------------------------------------------------
// Model Intelligence
// ---------------------------------------------------------------------------

/**
 * Find a model intelligence entry by make and model.
 * When year is provided, only returns an entry whose year range covers that year.
 */
export function getModelIntelligence(
  make: string,
  model: string,
  year?: number,
): ModelIntelligenceRow | undefined {
  const db = getDb();
  if (year != null) {
    return db.get<ModelIntelligenceRow>(
      `SELECT * FROM model_intelligence
       WHERE make = ? AND model = ?
         AND (year_min IS NULL OR year_min <= ?)
         AND (year_max IS NULL OR year_max >= ?)`,
      [make, model, year, year],
    );
  }
  return db.get<ModelIntelligenceRow>(
    'SELECT * FROM model_intelligence WHERE make = ? AND model = ?',
    [make, model],
  );
}

/** INSERT a model intelligence entry. */
export function insertModelIntelligence(
  entry: Record<string, unknown>,
): void {
  const db = getDb();
  const columns = Object.keys(entry);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => entry[c]);

  db.run(
    `INSERT INTO model_intelligence (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Parts Pricing
// ---------------------------------------------------------------------------

/**
 * Find a parts pricing entry by make and model.
 * When year is provided, only returns an entry whose year range covers that year.
 */
export function getPartsPricing(
  make: string,
  model: string,
  year?: number,
): PartsPricingRow | undefined {
  const db = getDb();
  if (year != null) {
    return db.get<PartsPricingRow>(
      `SELECT * FROM parts_pricing
       WHERE make = ? AND model = ?
         AND (year_min IS NULL OR year_min <= ?)
         AND (year_max IS NULL OR year_max >= ?)`,
      [make, model, year, year],
    );
  }
  return db.get<PartsPricingRow>(
    'SELECT * FROM parts_pricing WHERE make = ? AND model = ?',
    [make, model],
  );
}

/** INSERT a parts pricing entry. */
export function insertPartsPricing(
  entry: Record<string, unknown>,
): void {
  const db = getDb();
  const columns = Object.keys(entry);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => entry[c]);

  db.run(
    `INSERT INTO parts_pricing (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Search Configs
// ---------------------------------------------------------------------------

/** SELECT all active search configs. */
export function getActiveSearchConfigs(): SearchConfigRow[] {
  const db = getDb();
  return db.all<SearchConfigRow>(
    'SELECT * FROM search_configs WHERE is_active = 1',
  );
}

/** INSERT a new search config. */
export function insertSearchConfig(
  config: Record<string, unknown>,
): void {
  const db = getDb();
  const columns = Object.keys(config);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => config[c]);

  db.run(
    `INSERT INTO search_configs (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

// ---------------------------------------------------------------------------
// Scrape Log
// ---------------------------------------------------------------------------

/** INSERT a scrape log entry. */
export function insertScrapeLog(
  entry: Record<string, unknown>,
): void {
  const db = getDb();
  const columns = Object.keys(entry);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => entry[c]);

  db.run(
    `INSERT INTO scrape_log (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}

/** Get the most recent completed_at timestamp from the scrape log. */
export function getLastScrapeTime(): string | undefined {
  const db = getDb();
  const row = db.get<{ completed_at: string }>(
    'SELECT completed_at FROM scrape_log WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT 1',
  );
  return row?.completed_at;
}

/** Get the most recent scrape errors, ordered newest first. */
export function getRecentScrapeErrors(limit: number): ScrapeLogRow[] {
  const db = getDb();
  return db.all<ScrapeLogRow>(
    'SELECT * FROM scrape_log WHERE errors IS NOT NULL AND errors != \'\' ORDER BY id DESC LIMIT ?',
    [limit],
  );
}

// ---------------------------------------------------------------------------
// Audit Log
// ---------------------------------------------------------------------------

/** INSERT an audit log entry for a listing. */
export function insertAuditLog(
  listingId: string,
  entry: { audit_type: string; severity: string; details: string },
): void {
  const db = getDb();
  db.run(
    'INSERT INTO audit_log (listing_id, audit_type, severity, details) VALUES (?, ?, ?, ?)',
    [listingId, entry.audit_type, entry.severity, entry.details],
  );
}

/** COUNT all unresolved audit issues. */
export function countUnresolvedAuditIssues(): number {
  const db = getDb();
  const row = db.get<{ cnt: number }>(
    'SELECT COUNT(*) AS cnt FROM audit_log WHERE resolved = 0',
  );
  return row?.cnt ?? 0;
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

/** INSERT a transaction entry. */
export function insertTransaction(
  entry: Record<string, unknown>,
): void {
  const db = getDb();
  const columns = Object.keys(entry);
  const placeholders = columns.map(() => '?').join(', ');
  const values = columns.map((c) => entry[c]);

  db.run(
    `INSERT INTO transactions (${columns.join(', ')}) VALUES (${placeholders})`,
    values,
  );
}
