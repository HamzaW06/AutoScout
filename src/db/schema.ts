import { initDatabase as initDb, type Database } from './database.js';

const SCHEMA_SQL = `
-- LISTINGS table
CREATE TABLE IF NOT EXISTS listings (
  id TEXT PRIMARY KEY,
  vin TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  source_listing_id TEXT,
  sources_found_on TEXT,
  is_multi_source INTEGER DEFAULT 0,
  dealer_id INTEGER REFERENCES dealers(id),
  year INTEGER NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  trim TEXT DEFAULT '',
  body_style TEXT,
  engine TEXT,
  transmission TEXT,
  drivetrain TEXT DEFAULT 'FWD',
  exterior_color TEXT,
  interior_color TEXT,
  fuel_type TEXT DEFAULT 'Gasoline',
  mpg_city INTEGER,
  mpg_highway INTEGER,
  mileage INTEGER NOT NULL,
  title_status TEXT DEFAULT 'unknown',
  accident_count INTEGER DEFAULT 0,
  owner_count INTEGER DEFAULT 0,
  was_rental INTEGER DEFAULT 0,
  was_fleet INTEGER DEFAULT 0,
  structural_damage INTEGER DEFAULT 0,
  airbag_deployed INTEGER DEFAULT 0,
  asking_price INTEGER NOT NULL,
  market_value INTEGER,
  deal_score REAL,
  value_rating TEXT,
  price_per_mile REAL,
  offer_low INTEGER,
  offer_high INTEGER,
  risk_score INTEGER,
  risk_factors TEXT,
  scam_score INTEGER DEFAULT 0,
  scam_flags TEXT,
  negotiation_power INTEGER,
  negotiation_tactics TEXT,
  seller_type TEXT,
  seller_name TEXT,
  seller_phone TEXT,
  seller_location TEXT,
  seller_lat REAL,
  seller_lng REAL,
  distance_miles REAL,
  photos TEXT,
  description TEXT,
  ai_analysis TEXT,
  photo_analysis TEXT,
  repair_forecast TEXT,
  listing_date TEXT,
  days_on_market INTEGER,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  price_dropped INTEGER DEFAULT 0,
  price_drop_count INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  user_notes TEXT,
  vin_verified INTEGER DEFAULT 0,
  data_completeness REAL DEFAULT 0,
  last_audit TEXT,
  audit_flags TEXT,
  scrape_confidence REAL DEFAULT 0.5,
  scrape_tier TEXT DEFAULT 'unknown',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- PRICE_HISTORY table
CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  price INTEGER NOT NULL,
  source TEXT,
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- DEALERS table
CREATE TABLE IF NOT EXISTS dealers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website_url TEXT,
  inventory_url TEXT,
  platform TEXT,
  scraper_type TEXT,
  scraper_config TEXT,
  address TEXT,
  city TEXT,
  state TEXT DEFAULT 'TX',
  zip TEXT,
  lat REAL,
  lng REAL,
  distance_miles REAL,
  phone TEXT,
  google_rating REAL,
  google_review_count INTEGER,
  yelp_rating REAL,
  bbb_rating TEXT,
  bbb_complaint_count INTEGER,
  dealer_rater_score REAL,
  dealer_type TEXT,
  price_range TEXT,
  typical_inventory_size INTEGER,
  specialties TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  last_scraped TEXT,
  last_listing_count INTEGER DEFAULT 0,
  scrape_success_rate REAL,
  scrape_priority TEXT DEFAULT 'medium',
  added_by TEXT DEFAULT 'user',
  health_state TEXT DEFAULT 'healthy',
  consecutive_failures INTEGER DEFAULT 0,
  last_success_at TEXT,
  last_tier_used TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- MODEL_INTELLIGENCE table
CREATE TABLE IF NOT EXISTS model_intelligence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_min INTEGER,
  year_max INTEGER,
  engine TEXT,
  transmission TEXT,
  timing_type TEXT CHECK(timing_type IN ('chain', 'belt')),
  timing_interval_miles INTEGER,
  known_issues TEXT,
  critical_checks TEXT,
  avoid_if TEXT,
  reliability_score INTEGER,
  avg_annual_repair_cost INTEGER,
  expected_lifespan_miles INTEGER,
  oil_type TEXT,
  oil_change_interval_miles INTEGER,
  repair_schedule TEXT,
  failure_points TEXT,
  notes TEXT
);

-- PARTS_PRICING table
CREATE TABLE IF NOT EXISTS parts_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_min INTEGER,
  year_max INTEGER,
  brake_pads_front REAL,
  brake_pads_rear REAL,
  brake_rotors_front_pair REAL,
  brake_rotors_rear_pair REAL,
  spark_plugs_set REAL,
  oil_filter REAL,
  air_filter REAL,
  cabin_filter REAL,
  alternator REAL,
  starter_motor REAL,
  water_pump REAL,
  timing_belt_kit REAL,
  ac_compressor REAL,
  ac_condenser REAL,
  radiator REAL,
  battery REAL,
  struts_front_pair REAL,
  struts_rear_pair REAL,
  wheel_bearing REAL,
  catalytic_converter REAL,
  oxygen_sensor REAL,
  serpentine_belt REAL,
  cv_axle REAL,
  thermostat REAL,
  parts_affordability_score INTEGER,
  source TEXT DEFAULT 'rockauto',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- MECHANICS table
CREATE TABLE IF NOT EXISTS mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  lat REAL,
  lng REAL,
  google_rating REAL,
  google_review_count INTEGER,
  specialties TEXT,
  ppi_price REAL,
  hourly_rate REAL,
  notes TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- SEARCH_CONFIGS table
CREATE TABLE IF NOT EXISTS search_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  make TEXT,
  model TEXT,
  year_min INTEGER,
  year_max INTEGER,
  max_price INTEGER,
  max_mileage INTEGER,
  title_status TEXT DEFAULT 'clean',
  min_reliability_score INTEGER DEFAULT 0,
  exclude_makes TEXT,
  exclude_transmissions TEXT,
  is_active INTEGER DEFAULT 1,
  notify_on_steal INTEGER DEFAULT 1,
  notify_on_great INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- TRANSACTIONS table
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  dealer_id INTEGER REFERENCES dealers(id),
  asking_price INTEGER,
  negotiated_price INTEGER,
  otd_price INTEGER,
  negotiation_notes TEXT,
  purchased INTEGER DEFAULT 0,
  walked_away_reason TEXT,
  visited_at TEXT DEFAULT (datetime('now'))
);

-- SCRAPE_LOG table
CREATE TABLE IF NOT EXISTS scrape_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  dealer_id INTEGER,
  started_at TEXT,
  completed_at TEXT,
  listings_found INTEGER,
  new_listings INTEGER,
  updated_listings INTEGER,
  deactivated_listings INTEGER,
  errors TEXT,
  duration_ms INTEGER
);

-- AUDIT_LOG table
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  audit_type TEXT,
  severity TEXT,
  details TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- NHTSA_CACHE table
CREATE TABLE IF NOT EXISTS nhtsa_cache (
  cache_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- USER_SETTINGS table
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
`;

const INDEXES_SQL = `
CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model);
CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(asking_price);
CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year);
CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active);
CREATE INDEX IF NOT EXISTS idx_listings_value ON listings(value_rating);
CREATE INDEX IF NOT EXISTS idx_listings_risk ON listings(risk_score);
CREATE INDEX IF NOT EXISTS idx_listings_scam ON listings(scam_score);
CREATE INDEX IF NOT EXISTS idx_listings_vin ON listings(vin);
CREATE INDEX IF NOT EXISTS idx_listings_dealer ON listings(dealer_id);
CREATE INDEX IF NOT EXISTS idx_listings_first_seen ON listings(first_seen);
CREATE INDEX IF NOT EXISTS idx_listings_favorite ON listings(is_favorite);
CREATE INDEX IF NOT EXISTS idx_price_history_listing ON price_history(listing_id);
CREATE INDEX IF NOT EXISTS idx_dealers_active ON dealers(is_active);
CREATE INDEX IF NOT EXISTS idx_dealers_city ON dealers(city);
CREATE INDEX IF NOT EXISTS idx_audit_log_listing ON audit_log(listing_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_unresolved ON audit_log(resolved) WHERE resolved = 0;
`;

/**
 * Initialize the database: open/create the file, create all tables and indexes.
 * Returns the ready-to-use Database instance.
 */
export async function initDatabase(): Promise<Database> {
  const db = await initDb();

  db.exec(SCHEMA_SQL);
  db.exec(INDEXES_SQL);

  return db;
}
