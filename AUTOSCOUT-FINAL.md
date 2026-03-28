# 🚗 AutoScout — THE COMPLETE PLAN
## Universal Used Car Search Engine
### One Document. Everything. Copy-paste into Claude Code.

---

## VISION

A self-hosted web app that scrapes every possible car listing source — MarketCheck's 53k dealer network, your hand-curated Houston dealer database, Craigslist, Facebook Marketplace, auction data — normalizes everything into one database, scores each listing on value/risk/scam probability, forecasts every future repair with cost estimates, and presents it all in a sortable dashboard with deal alerts, negotiation scripts, and a guided purchase workflow. You input criteria once. It does everything else.

**Operating cost: $5-30/month.** Free-tier AI for 95% of tasks. MarketCheck for the wide net. Free government APIs for everything else.

---

## 1. DATA SOURCES

```
TIER 1A — YOUR CUSTOM SCRAPERS (free)
├── Your hand-built Houston dealer database (200-400 dealers)
├── Craigslist Houston RSS feeds
├── Facebook Marketplace (Playwright headless browser)
└── OfferUp auto section

TIER 1B — MARKETCHECK API ($5-30/mo)
├── Inventory search across 53,000+ US dealers (updated daily)
├── ML price prediction (trained on 4M+ sold listings)
├── VIN history — every price change, every dealer it passed through
├── Comparable vehicle search
└── Days-on-market tracking

TIER 2 — FREE GOVERNMENT APIS
├── NHTSA vPIC — VIN decode (year, make, model, engine, plant)
├── NHTSA Recalls — open recall check by make/model/year
├── NHTSA Complaints — consumer complaint aggregation
├── NHTSA Safety Ratings — crash test scores
├── NMVTIS (via TxDMV) — federal title verification ($2-10/check, on-demand)
└── Texas DPS — inspection history verification

TIER 3 — PRICE INTELLIGENCE BENCHMARKS (free scraping)
├── Carvana/Vroom/CarMax online inventory — retail price ceiling
├── Copart/IAAI public auction results — wholesale price floor
├── RockAuto/eBay — parts pricing for repair cost estimation
├── Google Vehicle Listings — structured car data in search results
└── Government surplus / bank repo auctions — hidden inventory

TIER 4 — AI (cost-optimized)
├── Gemini 2.0 Flash-Lite — HTML parsing, data extraction (FREE TIER)
├── Gemini 2.5 Flash — deep analysis, photo scoring ($0.30/1M tokens, on-demand)
├── Ollama + Llama 3.1 8B — local offline fallback ($0)
└── Claude Haiku — premium analysis when needed (optional)

TIER 5 — DEALER REPUTATION
├── Google Places API — ratings, reviews, location ($0 with free credit)
├── Yelp Fusion API — ratings (5000 calls/day free)
├── BBB — accreditation, complaint count
└── DealerRater — dealer-specific reviews
```

---

## 2. DATABASE SCHEMA

```sql
-- ═══════════════════════════════════════════════════════
-- CORE: Listings
-- ═══════════════════════════════════════════════════════

CREATE TABLE listings (
  id TEXT PRIMARY KEY,
  vin TEXT,
  
  -- Source tracking
  source TEXT NOT NULL,               -- 'dealer:42', 'craigslist', 'facebook', 'marketcheck'
  source_url TEXT,
  source_listing_id TEXT,
  sources_found_on TEXT,              -- JSON array: tracks ALL sources this VIN appeared on
  is_multi_source INTEGER DEFAULT 0,  -- found on 2+ sources = higher confidence
  dealer_id INTEGER REFERENCES dealers(id),
  
  -- Vehicle identity
  year INTEGER NOT NULL,
  make TEXT NOT NULL,                 -- Normalized: "Toyota" not "toyota" or "TOYOTA"
  model TEXT NOT NULL,
  trim TEXT DEFAULT '',
  body_style TEXT,                    -- sedan, suv, truck, coupe, hatchback, wagon
  engine TEXT,                        -- "2.5L I4", "3.5L V6"
  transmission TEXT,                  -- auto, manual, cvt
  drivetrain TEXT DEFAULT 'FWD',      -- fwd, rwd, awd, 4wd
  exterior_color TEXT,
  interior_color TEXT,
  fuel_type TEXT DEFAULT 'Gasoline',
  mpg_city INTEGER,
  mpg_highway INTEGER,
  
  -- Condition
  mileage INTEGER NOT NULL,
  title_status TEXT DEFAULT 'unknown', -- clean, rebuilt, salvage, flood, lemon, unknown
  accident_count INTEGER DEFAULT 0,
  owner_count INTEGER DEFAULT 0,
  was_rental INTEGER DEFAULT 0,
  was_fleet INTEGER DEFAULT 0,
  structural_damage INTEGER DEFAULT 0,
  airbag_deployed INTEGER DEFAULT 0,
  
  -- Pricing
  asking_price INTEGER NOT NULL,
  market_value INTEGER,               -- MarketCheck ML prediction or comparable avg
  deal_score REAL,                    -- % below/above market (positive = below = good)
  value_rating TEXT,                  -- STEAL / GREAT / GOOD / FAIR / HIGH / RIP-OFF
  price_per_mile REAL,
  offer_low INTEGER,                  -- Calculated: what to open with
  offer_high INTEGER,                 -- Calculated: max you should pay
  
  -- Risk & scam
  risk_score INTEGER,                 -- 0-100, higher = worse
  risk_factors TEXT,                  -- JSON array of strings
  scam_score INTEGER DEFAULT 0,       -- 0-100, higher = more suspicious
  scam_flags TEXT,                    -- JSON array of strings
  
  -- Negotiation
  negotiation_power INTEGER,          -- 0-100, higher = more leverage
  negotiation_tactics TEXT,           -- JSON array of specific tactics
  
  -- Seller
  seller_type TEXT,                   -- dealer, private, auction
  seller_name TEXT,
  seller_phone TEXT,
  seller_location TEXT,
  seller_lat REAL,
  seller_lng REAL,
  distance_miles REAL,
  
  -- Content
  photos TEXT,                        -- JSON array of URLs
  description TEXT,
  
  -- AI analysis (populated on demand when user clicks "Analyze")
  ai_analysis TEXT,                   -- JSON: full VehicleAnalysis result
  photo_analysis TEXT,                -- JSON: photo condition scoring
  repair_forecast TEXT,               -- JSON: full RepairForecast result
  
  -- Tracking
  listing_date TEXT,
  days_on_market INTEGER,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  price_dropped INTEGER DEFAULT 0,
  price_drop_count INTEGER DEFAULT 0,
  is_favorite INTEGER DEFAULT 0,
  user_notes TEXT,
  
  -- Audit
  vin_verified INTEGER DEFAULT 0,     -- VIN decode matches listing
  data_completeness REAL DEFAULT 0,   -- 0-1: how many fields are filled
  last_audit TEXT,                    -- timestamp of last validation pass
  audit_flags TEXT,                   -- JSON: any data inconsistencies found
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- PRICE TRACKING
-- ═══════════════════════════════════════════════════════

CREATE TABLE price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  price INTEGER NOT NULL,
  source TEXT,                        -- which source reported this price
  recorded_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- DEALERS
-- ═══════════════════════════════════════════════════════

CREATE TABLE dealers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  website_url TEXT,
  inventory_url TEXT,
  platform TEXT,                      -- 'dealer.com', 'frazer', 'facebook_only', 'custom'
  scraper_type TEXT,                  -- 'platform', 'ai_generic', 'facebook', 'marketcheck'
  scraper_config TEXT,                -- JSON
  
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
  
  dealer_type TEXT,                   -- 'franchise', 'independent', 'wholesaler'
  price_range TEXT,                   -- 'budget', 'mid', 'premium'
  typical_inventory_size INTEGER,
  specialties TEXT,                   -- JSON: ['trucks', 'imports', 'luxury']
  notes TEXT,
  
  is_active INTEGER DEFAULT 1,
  last_scraped TEXT,
  last_listing_count INTEGER,
  scrape_success_rate REAL,
  scrape_priority TEXT DEFAULT 'medium', -- 'critical', 'high', 'medium', 'low'
  added_by TEXT DEFAULT 'user',       -- 'user', 'google_places', 'csv_import'
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- MODEL INTELLIGENCE (80+ pre-seeded entries)
-- ═══════════════════════════════════════════════════════

CREATE TABLE model_intelligence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year_min INTEGER,
  year_max INTEGER,
  engine TEXT,
  transmission TEXT,
  
  timing_type TEXT CHECK(timing_type IN ('chain', 'belt')),
  timing_interval_miles INTEGER,
  
  known_issues TEXT,                  -- JSON array of strings
  critical_checks TEXT,               -- JSON array: what to specifically inspect
  avoid_if TEXT,                      -- JSON array: dealbreaker conditions
  
  reliability_score INTEGER,          -- 0-100
  avg_annual_repair_cost INTEGER,
  expected_lifespan_miles INTEGER,
  
  oil_type TEXT,
  oil_change_interval_miles INTEGER,
  
  -- Repair schedule: at what mileage intervals are things expected to need replacement
  repair_schedule TEXT,               -- JSON: [{"item":"brake_pads","interval_miles":40000,"cost_parts":30,"cost_labor":50}, ...]
  
  -- Common failure points with mileage thresholds
  failure_points TEXT,                -- JSON: [{"component":"AC compressor","typical_failure_miles":120000,"cost_parts":150,"cost_labor":100}, ...]
  
  notes TEXT
);

-- ═══════════════════════════════════════════════════════
-- PARTS PRICING (per make/model)
-- ═══════════════════════════════════════════════════════

CREATE TABLE parts_pricing (
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
  timing_belt_kit REAL,              -- NULL if chain
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
  
  parts_affordability_score INTEGER, -- 0-100: higher = cheaper parts
  source TEXT DEFAULT 'rockauto',
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- MECHANICS DATABASE
-- ═══════════════════════════════════════════════════════

CREATE TABLE mechanics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  phone TEXT,
  lat REAL,
  lng REAL,
  google_rating REAL,
  google_review_count INTEGER,
  specialties TEXT,                   -- JSON: ['Honda', 'Toyota', 'Japanese']
  ppi_price REAL,
  hourly_rate REAL,
  notes TEXT,
  is_favorite INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- SEARCH CONFIGS
-- ═══════════════════════════════════════════════════════

CREATE TABLE search_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,                          -- 'Budget Toyota', 'Reliable Commuter'
  make TEXT,
  model TEXT,
  year_min INTEGER,
  year_max INTEGER,
  max_price INTEGER,
  max_mileage INTEGER,
  title_status TEXT DEFAULT 'clean',
  min_reliability_score INTEGER DEFAULT 0,
  exclude_makes TEXT,                 -- JSON array
  exclude_transmissions TEXT,         -- JSON array: ['cvt']
  is_active INTEGER DEFAULT 1,
  notify_on_steal INTEGER DEFAULT 1,
  notify_on_great INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- TRANSACTION LOG (what you actually paid — personal market data)
-- ═══════════════════════════════════════════════════════

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  dealer_id INTEGER REFERENCES dealers(id),
  asking_price INTEGER,
  negotiated_price INTEGER,
  otd_price INTEGER,
  negotiation_notes TEXT,
  purchased INTEGER DEFAULT 0,       -- did you actually buy it?
  walked_away_reason TEXT,
  visited_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- SCRAPE LOG (audit trail)
-- ═══════════════════════════════════════════════════════

CREATE TABLE scrape_log (
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

-- ═══════════════════════════════════════════════════════
-- AUDIT LOG (data quality tracking)
-- ═══════════════════════════════════════════════════════

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  listing_id TEXT REFERENCES listings(id),
  audit_type TEXT,                    -- 'vin_mismatch', 'price_anomaly', 'missing_data', 'stale_listing', 'duplicate_detected'
  severity TEXT,                      -- 'info', 'warning', 'critical'
  details TEXT,
  resolved INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- ═══════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════

CREATE INDEX idx_listings_make_model ON listings(make, model);
CREATE INDEX idx_listings_price ON listings(asking_price);
CREATE INDEX idx_listings_year ON listings(year);
CREATE INDEX idx_listings_active ON listings(is_active);
CREATE INDEX idx_listings_value ON listings(value_rating);
CREATE INDEX idx_listings_risk ON listings(risk_score);
CREATE INDEX idx_listings_scam ON listings(scam_score);
CREATE INDEX idx_listings_vin ON listings(vin);
CREATE INDEX idx_listings_dealer ON listings(dealer_id);
CREATE INDEX idx_listings_first_seen ON listings(first_seen);
CREATE INDEX idx_listings_favorite ON listings(is_favorite);
CREATE INDEX idx_price_history_listing ON price_history(listing_id);
CREATE INDEX idx_dealers_active ON dealers(is_active);
CREATE INDEX idx_dealers_city ON dealers(city);
CREATE INDEX idx_audit_log_listing ON audit_log(listing_id);
CREATE INDEX idx_audit_log_unresolved ON audit_log(resolved) WHERE resolved = 0;
```

---

## 3. SCRAPING ARCHITECTURE

```
┌───────────────────────────────────────────┐
│            SCHEDULER (node-cron)          │
│                                           │
│  Critical (FB/CL): every 4 hours         │
│  High (50+ inventory): every 6 hours     │
│  Medium (default): every 12 hours        │
│  Low (<10 inventory): every 24 hours     │
│  MarketCheck: daily at 6 AM              │
│  Weekend surge: +50% frequency Fri-Sun   │
│  Month-end: +50% frequency day 26-31     │
│  Alert digest: daily at 7 AM             │
│  Audit sweep: daily at 2 AM             │
└──────────────────┬────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   SCRAPER MANAGER   │
        │  Queue + workers    │
        │  Rate limiting      │
        │  Retry with backoff │
        │  Error reporting    │
        └──────────┬──────────┘
                   │
  ┌────────┬───────┼────────┬───────────┬──────────────┐
  ▼        ▼       ▼        ▼           ▼              ▼
┌─────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌──────────┐
│CL   │ │Your  │ │AI    │ │FB      │ │Market- │ │Benchmark │
│RSS  │ │Dealer│ │Gen.  │ │Market- │ │Check   │ │Scrapers  │
│     │ │Plat- │ │Scrpr │ │place   │ │Inv.    │ │Carvana   │
│     │ │form  │ │Gemini│ │Playw.  │ │Search  │ │CarMax    │
│     │ │Scrpr │ │Flash │ │        │ │API     │ │Copart    │
│FREE │ │FREE  │ │FREE  │ │FREE    │ │$5-30mo │ │FREE      │
└──┬──┘ └──┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └────┬─────┘
   │       │        │         │           │           │
   └───────┴────┬───┴─────────┴───────────┴───────────┘
                ▼
        ┌───────────────┐
        │  NORMALIZER   │ ── Make/model cleanup, trim extraction
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  DEDUP +      │ ── VIN exact match, fuzzy match
        │  MERGE        │ ── Cross-source merge (keep richest data)
        └───────┬───────┘ ── Flag multi-source as "verified"
                ▼
        ┌───────────────┐
        │  ENRICHMENT   │
        │  ├─ VIN decode│ ── NHTSA (free)
        │  ├─ Recalls   │ ── NHTSA (free)
        │  ├─ Complaints│ ── NHTSA (free)
        │  ├─ Safety    │ ── NHTSA (free)
        │  ├─ Risk score│ ── Code logic
        │  ├─ Deal rate │ ── Code logic + MarketCheck ML price
        │  ├─ Scam check│ ── Code logic
        │  ├─ Neg. power│ ── Code logic
        │  └─ Repair $  │ ── Model intel + parts pricing DB
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  AUDIT ENGINE │ ── Validate all data, flag inconsistencies
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │   SQLite DB   │
        └───────┬───────┘
                ▼
        ┌───────────────┐
        │  NOTIFY       │ ── STEAL/GREAT alerts via email/Discord/Telegram
        └───────────────┘
```

### Platform-Specific Dealer Scrapers

```typescript
const PLATFORM_SIGNATURES = {
  'dealer.com':       { patterns: ['ddc-', 'dealer.com/content'], inventoryPath: '/used-vehicles/' },
  'dealersocket':     { patterns: ['dscdn', 'dealersocket'], inventoryPath: '/inventory' },
  'frazer':           { patterns: ['frazer', 'frazercms'], inventoryPath: '/inventory.aspx' },
  'dealerfire':       { patterns: ['dealerfire'], inventoryPath: '/vehicles/used/' },
  'dealer_inspire':   { patterns: ['dealerinspire', 'di-'], inventoryPath: '/inventory/' },
  'autorevo':         { patterns: ['autorevo', 'arcdn'], inventoryPath: '/inventory' },
  'dealer_center':    { patterns: ['dealercenter'], inventoryPath: '/all-inventory' },
  'wayne_reaves':     { patterns: ['waynereaves'], inventoryPath: '/inventory' },
  'v12_software':     { patterns: ['v12software'], inventoryPath: '/vehicles' },
  'promax':           { patterns: ['promax'], inventoryPath: '/inventory' },
  'carsforsale':      { patterns: ['carsforsale.com'], inventoryPath: null },
  'facebook_only':    { patterns: [], inventoryPath: null },
};
// Unknown platforms → Gemini Flash-Lite AI parser (free tier)
```

### Smart Scheduling

```typescript
function getScrapePriority(dealer: Dealer): string {
  if (dealer.scraper_type === 'facebook' || dealer.scraper_type === 'craigslist') return 'critical'; // 4hr
  if (dealer.typical_inventory_size > 50) return 'high';    // 6hr
  if (dealer.typical_inventory_size < 10) return 'low';     // 24hr
  return 'medium';                                          // 12hr
}
// Weekend surge: Fri-Sun scrape 50% more frequently
// Month-end (26th-31st): scrape 50% more frequently (dealer quota desperation)
// Tax season (Feb-April): scrape more frequently (market moves faster)
```

---

## 4. INTELLIGENCE LAYER — COST-OPTIMIZED

### What needs NO AI (pure code logic — $0):

```typescript
// ── NORMALIZATION ──
const MAKE_ALIASES = {
  'chevy': 'Chevrolet', 'vw': 'Volkswagen', 'merc': 'Mercedes-Benz', // ... 100+ aliases
};

// ── RISK SCORING ──
function calculateRiskScore(listing, modelIntel): number {
  let score = 50;
  if (listing.title_status === 'salvage') score += 30;
  if (listing.title_status === 'rebuilt') score += 20;
  if (listing.title_status === 'flood') score += 25;
  if (listing.owner_count === 1) score -= 10;
  if (listing.owner_count >= 4) score += 10;
  if (listing.was_rental) score += 8;
  score += listing.accident_count * 8;
  if (listing.structural_damage) score += 15;
  if (listing.airbag_deployed) score += 20;
  const milesPerYear = listing.mileage / (new Date().getFullYear() - listing.year);
  if (milesPerYear > 18000) score += 5;
  if (milesPerYear < 8000) score -= 5;
  if (modelIntel?.reliability_score < 50) score += 10;
  if (modelIntel?.reliability_score > 85) score -= 10;
  if (modelIntel?.timing_type === 'belt' && listing.mileage > (modelIntel.timing_interval_miles || 105000)) score += 15;
  if (modelIntel?.known_issues?.includes('CVT failure')) score += 12;
  if (listing.seller_rating && listing.seller_rating < 3.0) score += 5;
  return Math.max(0, Math.min(100, score));
}

// ── DEAL RATING ──
function calculateDealRating(askingPrice, marketValue): DealRating {
  const pctDiff = ((marketValue - askingPrice) / marketValue) * 100;
  if (pctDiff > 25) return 'STEAL';
  if (pctDiff > 15) return 'GREAT';
  if (pctDiff > 5)  return 'GOOD';
  if (pctDiff > -5) return 'FAIR';
  if (pctDiff > -15) return 'HIGH';
  return 'RIP-OFF';
}

// ── NEGOTIATION POWER ──
function calculateNegotiationPower(listing, comparables): NegotiationPower {
  let power = 50;
  if (listing.days_on_market > 60) power += 15;
  else if (listing.days_on_market > 30) power += 10;
  else if (listing.days_on_market < 3) power -= 10;
  if (listing.price_dropped) power += 10;
  if (listing.price_drop_count > 2) power += 5;
  const similarCount = comparables.filter(c => Math.abs(c.asking_price - listing.asking_price) < 1000).length;
  if (similarCount > 10) power += 10;
  if (similarCount < 3) power -= 10;
  power += (listing.risk_factors?.length || 0) * 3;
  if (listing.seller_type === 'dealer') power += 5;
  if (new Date().getDate() > 25) power += 5; // month-end
  if (listing.deal_score < -10) power += 10; // overpriced
  return { score: Math.max(0, Math.min(100, power)), level: power > 70 ? 'STRONG' : power > 50 ? 'MODERATE' : 'WEAK' };
}

// ── DEDUP ──
function isDuplicate(a, b): boolean {
  if (a.vin && b.vin && a.vin === b.vin) return true;
  return a.year === b.year && a.make === b.make && a.model === b.model
    && Math.abs(a.mileage - b.mileage) < 500 && Math.abs(a.asking_price - b.asking_price) < 300;
}

// ── TEXAS TTL CALCULATOR ──
function texasTTL(price, isPrivate, county) {
  return {
    salesTax: price * 0.0625,
    titleFee: 33,
    registrationFee: 51.75,
    inspectionFee: 7.50,
    emissionsInspection: isEmissionsCounty(county) ? 18.50 : 0,
    docFee: isPrivate ? 0 : 150,
  };
}
```

### What uses FREE APIs:

```typescript
// All NHTSA endpoints — free, no key, generous rate limits
const VIN_DECODE   = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/{VIN}?format=json';
const RECALLS      = 'https://api.nhtsa.dot.gov/recalls/recallsByVehicle?make={}&model={}&modelYear={}';
const COMPLAINTS   = 'https://api.nhtsa.dot.gov/complaints/complaintsByVehicle?make={}&model={}&modelYear={}';
const SAFETY       = 'https://api.nhtsa.dot.gov/SafetyRatings/modelyear/{}/make/{}/model/{}';
```

### What uses FREE-TIER AI (Gemini Flash-Lite):

```typescript
// 1. Parsing unknown dealer website HTML → structured listings
// 2. Extracting vehicle info from messy Craigslist/FB descriptions
// Cost: $0 on Google's free tier
```

### What uses cheap AI ON-DEMAND (Gemini 2.5 Flash — $0.30/1M tokens):

```typescript
// Triggered ONLY when user clicks "Analyze This Car" — NOT automatic
// 1. Deep vehicle analysis → verdict, risks, inspection checklist
// 2. Photo condition scoring → exterior/interior condition from listing photos
// 3. Custom negotiation script based on specific car's issues
// Cost: ~$0.001-0.003 per car analyzed
```

### What uses MarketCheck ($5-30/mo):

```typescript
// 1. Daily inventory search — wide net across 53k dealers
// 2. ML price prediction — fair market value per VIN
// 3. Comparable vehicle search — what similar cars are selling for
// 4. VIN history — listing history, every price change
// 5. Days-on-market data
```

---

## 5. REPAIR FORECAST ENGINE

For every car in the database, compute a complete forward-looking repair timeline. No AI needed — pure logic from model_intelligence + parts_pricing + current mileage.

```typescript
interface RepairForecast {
  immediate_repairs: RepairItem[];      // Needed NOW (overdue timing belt, known active issue)
  next_12_months: RepairItem[];         // Based on mileage intervals
  next_12_to_36_months: RepairItem[];   // 1-3 year horizon
  lifetime_risks: RepairItem[];         // Known failure points for this model

  cost_summary: {
    immediate_total: number;
    year_1_maintenance: number;
    year_1_likely_repairs: number;
    year_2_maintenance: number;
    year_2_likely_repairs: number;
    year_3_maintenance: number;
    year_3_likely_repairs: number;
    total_3yr_cost: number;
    monthly_average: number;
  };

  parts_affordability: {
    score: number;                      // 0-100
    comparison: string;                 // "35% cheaper than average sedan"
    sample_costs: { part: string; ebay_price: number; dealer_price: number }[];
  };

  timing_system: {
    type: 'chain' | 'belt';
    is_overdue: boolean;
    next_service_miles: number | null;   // NULL if chain (lifetime)
    cost_if_needed: number;
    is_interference_engine: boolean;    // if belt breaks, does engine die?
  };
}

function generateRepairForecast(
  listing: CarListing,
  modelIntel: ModelIntelligence,
  partsDB: PartsPricing,
  userMechanic: { laborMultiplier: number } // Hamza's mechanic charges ~40% of dealer rate
): RepairForecast {

  const currentMiles = listing.mileage;
  const milesPerYear = currentMiles / (new Date().getFullYear() - listing.year) || 10000;
  const laborMult = userMechanic.laborMultiplier; // e.g., 0.4 for cheap mechanic

  // ── IMMEDIATE REPAIRS ──
  const immediate = [];

  // Timing belt check
  if (modelIntel.timing_type === 'belt') {
    const interval = modelIntel.timing_interval_miles || 105000;
    if (currentMiles > interval) {
      immediate.push({
        item: 'Timing Belt + Water Pump Kit',
        urgency: 'CRITICAL',
        reason: `At ${currentMiles.toLocaleString()} miles, ${(currentMiles - interval).toLocaleString()} miles overdue`,
        cost_parts: partsDB.timing_belt_kit || 80,
        cost_labor: 200 * laborMult,
        risk_if_ignored: modelIntel.notes?.includes('interference') 
          ? 'CATASTROPHIC — interference engine, belt failure destroys engine ($3000-5000)'
          : 'Engine will not run, but no internal damage'
      });
    }
  }

  // Known active issues for this model
  if (modelIntel.known_issues) {
    for (const issue of JSON.parse(modelIntel.known_issues)) {
      if (issue.includes('VCM') && listing.make === 'Honda') {
        immediate.push({
          item: 'VCM Disabler',
          urgency: 'HIGH',
          reason: 'Prevents ongoing oil consumption and engine damage from VCM system',
          cost_parts: 40,
          cost_labor: 0,
          risk_if_ignored: 'Progressive oil burning, fouled spark plugs, catalytic converter damage'
        });
      }
    }
  }

  // ── SCHEDULED MAINTENANCE (next 3 years) ──
  const repairSchedule = JSON.parse(modelIntel.repair_schedule || '[]');
  const year1 = [], year2 = [], year3 = [];

  for (const item of repairSchedule) {
    // Find next occurrence of this service
    const lastDone = Math.floor(currentMiles / item.interval_miles) * item.interval_miles;
    const nextDue = lastDone + item.interval_miles;
    const milesUntilDue = nextDue - currentMiles;

    const repairItem = {
      item: item.item,
      due_at_miles: nextDue,
      miles_until_due: milesUntilDue,
      cost_parts: partsDB[item.parts_key] || item.cost_parts,
      cost_labor: item.cost_labor * laborMult,
    };

    if (milesUntilDue <= milesPerYear) year1.push(repairItem);
    else if (milesUntilDue <= milesPerYear * 2) year2.push(repairItem);
    else if (milesUntilDue <= milesPerYear * 3) year3.push(repairItem);
  }

  // ── FAILURE POINTS (probability-based) ──
  const failurePoints = JSON.parse(modelIntel.failure_points || '[]');
  const lifetimeRisks = failurePoints
    .filter(fp => currentMiles >= fp.typical_failure_miles * 0.7) // within 30% of typical failure
    .map(fp => ({
      item: fp.component,
      typical_failure_miles: fp.typical_failure_miles,
      probability: currentMiles >= fp.typical_failure_miles ? 'HIGH' : 'MODERATE',
      cost_parts: partsDB[fp.parts_key] || fp.cost_parts,
      cost_labor: fp.cost_labor * laborMult,
    }));

  // ── COST SUMMARY ──
  const oilChangeCost = ((partsDB.oil_filter || 8) + 25) * (milesPerYear / (modelIntel.oil_change_interval_miles || 5000));
  const annualMaintenance = oilChangeCost + 30; // oil + misc fluids/filters

  return {
    immediate_repairs: immediate,
    next_12_months: year1,
    next_12_to_36_months: [...year2, ...year3],
    lifetime_risks: lifetimeRisks,
    cost_summary: {
      immediate_total: immediate.reduce((s, r) => s + r.cost_parts + r.cost_labor, 0),
      year_1_maintenance: annualMaintenance,
      year_1_likely_repairs: year1.reduce((s, r) => s + r.cost_parts + r.cost_labor, 0),
      year_2_maintenance: annualMaintenance,
      year_2_likely_repairs: year2.reduce((s, r) => s + r.cost_parts + r.cost_labor, 0),
      year_3_maintenance: annualMaintenance,
      year_3_likely_repairs: year3.reduce((s, r) => s + r.cost_parts + r.cost_labor, 0),
      total_3yr_cost: 0, // calculated
      monthly_average: 0, // calculated
    },
    parts_affordability: {
      score: partsDB.parts_affordability_score || 50,
      sample_costs: [
        { part: 'Brake pads (front)', ebay_price: partsDB.brake_pads_front, dealer_price: partsDB.brake_pads_front * 3 },
        { part: 'Alternator', ebay_price: partsDB.alternator, dealer_price: partsDB.alternator * 2.5 },
        { part: 'Starter motor', ebay_price: partsDB.starter_motor, dealer_price: partsDB.starter_motor * 2.5 },
      ]
    },
    timing_system: {
      type: modelIntel.timing_type,
      is_overdue: modelIntel.timing_type === 'belt' && currentMiles > (modelIntel.timing_interval_miles || 105000),
      next_service_miles: modelIntel.timing_type === 'belt' ? modelIntel.timing_interval_miles : null,
      cost_if_needed: (partsDB.timing_belt_kit || 80) + (200 * laborMult),
      is_interference_engine: modelIntel.notes?.includes('interference') || false,
    }
  };
}
```

### Repair Forecast UI Display

```
╔══════════════════════════════════════════════════════════════╗
║  🔧 REPAIR FORECAST — 2011 Toyota Camry LE (150,314 mi)   ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  ⚡ IMMEDIATE (do within first week)                        ║
║  └── None! Timing chain = no belt to worry about. ✅        ║
║                                                              ║
║  📅 NEXT 12 MONTHS (~10,000 mi)                             ║
║  ├── Oil changes ×2 .................. $66 (parts+labor)    ║
║  ├── Brake pads front ............... $78 (due ~155k)       ║
║  └── Serpentine belt ................ $45 (due ~160k)       ║
║                                          Subtotal: $189     ║
║                                                              ║
║  📅 YEAR 2-3 (~20,000 mi)                                   ║
║  ├── Oil changes ×4 .................. $132                  ║
║  ├── Brake pads rear ................ $75                    ║
║  ├── Spark plugs (set of 4) ......... $52                   ║
║  └── Cabin + air filter ............. $28                    ║
║                                          Subtotal: $287     ║
║                                                              ║
║  ⚠️ WATCH LIST (may need replacement)                       ║
║  ├── Alternator (typical: 150-180k) .... $125 if needed     ║
║  ├── Starter motor (typical: 160k+) .... $95 if needed      ║
║  └── Struts front (typical: 150k+) ..... $180 if needed     ║
║                                                              ║
║  💰 3-YEAR TOTAL COST OF OWNERSHIP                          ║
║  ├── Purchase ..................... $5,750                   ║
║  ├── TX Tax/Title/License ......... $420                    ║
║  ├── Maintenance (3yr) ............ $476                    ║
║  ├── Likely repairs (3yr) ......... $400                    ║
║  ├── Fuel (3yr @ 10k mi/yr) ...... $2,880                  ║
║  ├── Insurance (est. 3yr) ........ $4,320                   ║
║  │                                ─────────                 ║
║  ├── TOTAL 3-YEAR COST ........... $14,246                  ║
║  ├── Minus resale value ........... -$3,200                 ║
║  ├── TRUE COST TO OWN ............ $11,046                  ║
║  └── PER MONTH ................... $307                     ║
║                                                              ║
║  🔩 PARTS AFFORDABILITY: 88/100 (VERY CHEAP) ✅            ║
║  Brake pads: $28 eBay vs $85 dealer                         ║
║  Alternator: $85 eBay vs $215 dealer                        ║
║  Starter: $55 eBay vs $140 dealer                           ║
║                                                              ║
║  ⛓️ TIMING: Chain (lifetime — no replacement needed) ✅     ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 6. SCAM DETECTION ENGINE

```typescript
function detectScams(listing: CarListing, allListings: CarListing[]): ScamCheck {
  const flags: string[] = [];

  // 1. CURBSTONER — "private" seller with 4+ cars listed
  const sameSeller = allListings.filter(l =>
    l.seller_phone === listing.seller_phone || l.seller_name === listing.seller_name
  );
  if (sameSeller.length > 3 && listing.seller_type === 'private')
    flags.push('CURBSTONER: "Private seller" has 4+ listings — likely unlicensed dealer');

  // 2. VIN MISMATCH — VIN decode doesn't match listing
  if (listing.vin_verified === 0 && listing.vin)
    flags.push('VIN NOT VERIFIED: VIN decode does not match listed make/model/year');

  // 3. TITLE WASHING — multiple state registrations
  // Check via NMVTIS or listing history

  // 4. TOO GOOD TO BE TRUE
  if (listing.deal_score > 40)
    flags.push('SUSPICIOUS PRICE: 40%+ below market — verify in person before sending money');

  // 5. FLOOD DAMAGE (Houston-specific)
  if (listing.listing_date && isPostHurricane(listing.listing_date))
    flags.push('POST-STORM: Listed shortly after major weather event — inspect for flood damage');

  // 6. ODOMETER ROLLBACK
  // Compare mileage history if available

  // 7. STOCK/STOLEN PHOTOS
  const photoMatches = allListings.filter(l =>
    l.id !== listing.id && l.photos?.some(p => listing.photos?.includes(p))
  );
  if (photoMatches.length > 0)
    flags.push('DUPLICATE PHOTOS: Same images found on other listings');

  // 8. NO PHOTOS
  if (!listing.photos || listing.photos.length === 0)
    flags.push('NO PHOTOS: Listing has no images — always suspicious');

  // 9. LOW-RATED SELLER
  if (listing.seller_rating && listing.seller_rating < 2.5)
    flags.push(`LOW RATED: ${listing.seller_name} has ${listing.seller_rating}/5 stars`);

  // 10. MISSING VIN
  if (!listing.vin)
    flags.push('NO VIN: Seller did not provide VIN — ask for it immediately');

  return {
    score: Math.min(100, flags.length * 15),
    level: flags.length >= 3 ? 'LIKELY SCAM' : flags.length >= 2 ? 'HIGH RISK' : flags.length >= 1 ? 'CAUTION' : 'CLEAR',
    flags
  };
}
```

---

## 7. AUDIT & VALIDATION ENGINE

Runs on every scrape cycle AND as a nightly sweep. Ensures nothing is missed, no data is stale, and all listings are trustworthy.

```typescript
async function auditListing(listing: CarListing): Promise<AuditResult[]> {
  const issues: AuditResult[] = [];

  // ── DATA COMPLETENESS ──
  const requiredFields = ['year', 'make', 'model', 'mileage', 'asking_price', 'title_status'];
  const optionalButImportant = ['vin', 'seller_phone', 'photos', 'engine', 'transmission'];
  const missing = requiredFields.filter(f => !listing[f]);
  if (missing.length > 0) {
    issues.push({ type: 'missing_data', severity: 'critical', details: `Missing required: ${missing.join(', ')}` });
  }
  const missingOptional = optionalButImportant.filter(f => !listing[f]);
  if (missingOptional.length > 2) {
    issues.push({ type: 'missing_data', severity: 'warning', details: `Missing recommended: ${missingOptional.join(', ')}` });
  }
  listing.data_completeness = 1 - (missing.length + missingOptional.length * 0.5) / (requiredFields.length + optionalButImportant.length);

  // ── VIN VERIFICATION ──
  if (listing.vin) {
    const decoded = await vinDecode(listing.vin);
    if (decoded.make && decoded.make.toLowerCase() !== listing.make.toLowerCase()) {
      issues.push({ type: 'vin_mismatch', severity: 'critical', details: `VIN decodes to ${decoded.make} ${decoded.model} but listing says ${listing.make} ${listing.model}` });
      listing.vin_verified = 0;
    } else {
      listing.vin_verified = 1;
      // Backfill missing data from VIN decode
      if (!listing.engine) listing.engine = decoded.engine;
      if (!listing.transmission) listing.transmission = decoded.transmission;
      if (!listing.drivetrain) listing.drivetrain = decoded.drivetrain;
    }
  }

  // ── PRICE SANITY CHECK ──
  if (listing.asking_price < 500) {
    issues.push({ type: 'price_anomaly', severity: 'warning', details: `Price $${listing.asking_price} is suspiciously low — may be deposit only or scam` });
  }
  if (listing.asking_price > 50000 && listing.year < 2015) {
    issues.push({ type: 'price_anomaly', severity: 'warning', details: `Price $${listing.asking_price} seems high for a ${listing.year} vehicle` });
  }

  // ── MILEAGE SANITY CHECK ──
  const vehicleAge = new Date().getFullYear() - listing.year;
  const milesPerYear = listing.mileage / Math.max(vehicleAge, 1);
  if (milesPerYear > 30000) {
    issues.push({ type: 'mileage_anomaly', severity: 'warning', details: `${milesPerYear.toLocaleString()} mi/yr is extremely high` });
  }
  if (milesPerYear < 1000 && vehicleAge > 3) {
    issues.push({ type: 'mileage_anomaly', severity: 'warning', details: `${milesPerYear.toLocaleString()} mi/yr is suspiciously low — possible rollback` });
  }

  // ── STALE LISTING CHECK ──
  const daysSinceLastSeen = daysBetween(listing.last_seen, new Date());
  if (daysSinceLastSeen > 7 && listing.is_active) {
    issues.push({ type: 'stale_listing', severity: 'info', details: `Not seen in ${daysSinceLastSeen} days — may be sold` });
  }

  // ── CROSS-REFERENCE CHECK ──
  // If listing claims "clean title" but model intelligence says this VIN was in a salvage auction...
  if (listing.title_status === 'clean' && listing.auction_history) {
    issues.push({ type: 'title_discrepancy', severity: 'critical', details: 'Claims clean title but VIN found in salvage auction records' });
  }

  // ── RECALL CHECK ──
  if (listing.year && listing.make && listing.model) {
    const recalls = await getRecalls(listing.make, listing.model, listing.year);
    const openRecalls = recalls.filter(r => !r.completed);
    if (openRecalls.length > 0) {
      issues.push({ type: 'open_recalls', severity: 'warning', details: `${openRecalls.length} open recall(s): ${openRecalls.map(r => r.component).join(', ')}` });
    }
  }

  // ── MODEL INTELLIGENCE CROSS-CHECK ──
  const intel = db.getModelIntelligence(listing.make, listing.model, listing.year);
  if (intel?.avoid_if) {
    const avoidConditions = JSON.parse(intel.avoid_if);
    for (const condition of avoidConditions) {
      if (condition.includes('CVT') && listing.transmission === 'cvt') {
        issues.push({ type: 'model_warning', severity: 'critical', details: `Model intelligence says AVOID: ${condition}` });
      }
      if (condition.includes('timing belt') && listing.mileage > (intel.timing_interval_miles || 105000)) {
        issues.push({ type: 'model_warning', severity: 'critical', details: `Timing belt likely overdue at ${listing.mileage.toLocaleString()} miles` });
      }
    }
  }

  // Save audit results
  listing.last_audit = new Date().toISOString();
  listing.audit_flags = JSON.stringify(issues.filter(i => i.severity !== 'info'));
  for (const issue of issues) {
    db.insertAuditLog(listing.id, issue);
  }

  return issues;
}

// ── NIGHTLY AUDIT SWEEP ──
async function nightlyAuditSweep() {
  const allActive = db.getActiveListings();
  let totalIssues = 0;

  for (const listing of allActive) {
    const issues = await auditListing(listing);
    totalIssues += issues.filter(i => i.severity === 'critical').length;

    // Deactivate listings not seen in 14+ days
    if (daysBetween(listing.last_seen, new Date()) > 14) {
      db.deactivateListing(listing.id);
    }
  }

  // Check for duplicate VINs across active listings
  const vinGroups = groupBy(allActive.filter(l => l.vin), 'vin');
  for (const [vin, listings] of Object.entries(vinGroups)) {
    if (listings.length > 1) {
      // Same car on multiple sources — merge, don't duplicate
      mergeDuplicateListings(listings);
    }
  }

  // Log sweep results
  console.log(`Audit sweep: ${allActive.length} listings checked, ${totalIssues} critical issues found`);
}
```

### Audit Dashboard UI

```
╔═══════════════════════════════════════════════════════╗
║  🔍 DATA QUALITY DASHBOARD                           ║
╠═══════════════════════════════════════════════════════╣
║  Active listings: 847                                 ║
║  Avg data completeness: 82%                          ║
║  VINs verified: 634 / 847 (74.8%)                    ║
║  Multi-source verified: 156 (18.4%)                  ║
║                                                       ║
║  ⛔ Critical issues: 12                               ║
║  ├── 3 VIN mismatches                                ║
║  ├── 4 suspected scams                               ║
║  ├── 2 title discrepancies                           ║
║  └── 3 overdue timing belt warnings                  ║
║                                                       ║
║  ⚠️ Warnings: 45                                      ║
║  ├── 18 missing VINs                                 ║
║  ├── 12 no photos                                    ║
║  ├── 8 price anomalies                               ║
║  └── 7 open recalls                                  ║
║                                                       ║
║  Last audit sweep: Today 2:00 AM                     ║
║  Last scrape cycle: Today 6:15 AM                    ║
║  Stale listings removed: 23                          ║
╚═══════════════════════════════════════════════════════╝
```

---

## 8. PURCHASE WORKFLOW

Guided 5-stage checklist from "found it" to "keys in hand":

```typescript
const PURCHASE_STAGES = [
  { id: 'found', name: '🔍 Found It', tasks: [
    'Review listing details, photos, and AI analysis',
    'Check risk score and scam flags',
    'Verify VIN decode matches listing',
    'Review open recalls',
    'Read model-specific known issues',
    'Check repair forecast and 3-year cost',
    'Compare with similar listings in database',
  ]},
  { id: 'contact', name: '📱 Contact Seller', tasks: [
    'Send pre-written inquiry (auto-generated)',
    'Ask for VIN if not listed',
    'Ask: title status, mechanical issues, accident history',
    'Ask: oil consumption, timing belt (if applicable)',
    'Confirm price is negotiable',
    'Schedule test drive / viewing',
  ]},
  { id: 'inspect', name: '🔧 Inspect', tasks: [
    'Complete auto-generated inspection checklist (specific to THIS car)',
    'Cold start test — listen for rattle, watch for smoke',
    'Test drive: highway + city streets',
    'Check all fluids: oil, coolant, trans, brake, power steering',
    'Check under the car for leaks',
    'Test A/C, heat, all windows, locks, sunroof, radio',
    'Take photos: odometer, VIN plate, title, damage',
    'Run NMVTIS title check ($2-5) if serious about buying',
    'Book PPI with mechanic if interested (use mechanic database)',
  ]},
  { id: 'negotiate', name: '💰 Negotiate', tasks: [
    'Use AutoScout negotiation power score and tactics',
    'Reference comparable listings as leverage',
    'Use flagged issues (risk factors, known defects) as leverage',
    'Open at calculated offer_low price',
    'Get final OTD price in writing (include TTL)',
    'Verify title is clean and in seller name',
    'For private sale: verify lien release / payoff letter',
    'Log transaction in AutoScout (even if you walk away)',
  ]},
  { id: 'purchase', name: '🤝 Close the Deal', tasks: [
    'Texas Bill of Sale — Form 130-U (auto-generated)',
    'Get signed title from seller',
    'Verify odometer disclosure on title back',
    'Exchange payment (cashier\'s check or cash)',
    'Get receipt with VIN, price, date, signatures',
    'Transfer title at county tax office within 30 days',
    'Pay sales tax: 6.25% of purchase price',
    'Get Texas safety inspection within 3 days of purchase',
    'Get emissions inspection if in Harris/Galveston/Fort Bend/Brazoria county',
    'Register vehicle and get plates',
    'Set up insurance BEFORE driving off the lot',
    'Execute immediate repairs from repair forecast (timing belt, VCM disabler, etc.)',
  ]},
];
```

---

## 9. FRONTEND

### Tech: React + Vite

### Dark theme with gold accents, green = good, red = bad. Mobile responsive.

### Views:

**Dashboard (Main Table)** — sortable by: Deal Rating, Price, Miles, Year, Risk, Scam Score, Negotiation Power, Days Listed, Distance. Color-coded cells. Inline expand for details. "New today" and "Price drop" badges. Quick actions: Favorite, Analyze, Contact, Navigate.

**Map View** — all listings + all dealers plotted on Houston map. Color-coded pins by deal rating. Dealer reputation badges. Mechanic locations. Radius circle from home.

**Compare View** — side-by-side 2-4 vehicles. Radar chart: Value, Reliability, Risk, Parts Cost, Repair Forecast. 3-year TCO comparison. Clear winner per category.

**Dealer Manager** — add/edit/remove dealers. Bulk CSV import. Auto-discover via Google Places. Scrape status (green/yellow/red). Per-dealer stats.

**Analytics** — price trends by make/model. Days-on-market distribution. Best deals this week. Market supply/demand. Price heatmap by Houston sub-region.

**Vehicle Detail Page** — full specs from VIN decode. Repair forecast with timeline chart. Price history. Recalls + complaints. Scam check results. AI analysis (on-demand). Photo analysis (on-demand). Pre-written contact message. Negotiation script with specific leverage. Inspection checklist (customized for this car). Purchase workflow tracker.

**Audit Dashboard** — data quality metrics. Unresolved critical issues. Scrape health. Stale listing cleanup stats.

---

## 10. NOTIFICATIONS

```
Channels: Email, Discord webhook, Telegram bot

Instant alerts:
  - STEAL-rated listing appears
  - Listing you favorited drops in price

Daily digest (7 AM):
  - Top 5 new listings by deal score
  - Any price drops on tracked listings
  - Market summary: new inventory count, avg prices
  - Audit alerts: critical issues found overnight

Weekly report:
  - Best deals of the week
  - Market trends: prices rising or falling?
  - Dealer activity: which dealers are adding inventory?
```

---

## 11. CHROME EXTENSION (Phase 8)

When browsing FB Marketplace, Craigslist, or Cars.com:
- Auto-detects car listings on the page
- Overlays floating badge: deal rating + risk score
- Click badge → popup with AutoScout analysis
- "Save to AutoScout" button
- VIN auto-extraction from listing text

---

## 12. PROJECT STRUCTURE

```
autoscout/
├── package.json
├── tsconfig.json
├── .env
├── data/
│   ├── autoscout.db
│   └── dealer-import-template.csv
├── src/
│   ├── index.ts
│   ├── server.ts                          # Express API
│   ├── scheduler.ts                       # Cron jobs
│   ├── db/
│   │   ├── schema.ts                      # All tables + migrations
│   │   ├── queries.ts                     # Query helpers
│   │   ├── seed-models.ts                 # 80+ model intelligence entries
│   │   └── seed-parts.ts                  # Parts pricing for 30+ models
│   ├── scrapers/
│   │   ├── base.ts                        # Abstract scraper interface
│   │   ├── manager.ts                     # Orchestrator + queue
│   │   ├── craigslist.ts                  # RSS + HTML
│   │   ├── facebook.ts                    # Playwright headless
│   │   ├── marketcheck.ts                 # API client
│   │   ├── benchmark.ts                   # Carvana/CarMax/Copart price scraping
│   │   ├── detector.ts                    # Platform auto-detection
│   │   └── platforms/
│   │       ├── dealer-com.ts
│   │       ├── frazer.ts
│   │       ├── dealer-socket.ts
│   │       ├── dealer-center.ts
│   │       ├── wayne-reaves.ts
│   │       └── generic-ai.ts             # Gemini Flash fallback
│   ├── enrichment/
│   │   ├── vin-decoder.ts                 # NHTSA
│   │   ├── recalls.ts                     # NHTSA
│   │   ├── complaints.ts                  # NHTSA
│   │   ├── safety-ratings.ts              # NHTSA
│   │   ├── risk-scorer.ts                 # Rule engine
│   │   ├── deal-rater.ts                  # Price analysis
│   │   ├── scam-detector.ts               # Scam flags
│   │   ├── negotiation-scorer.ts          # Leverage calculator
│   │   ├── repair-forecaster.ts           # Future repair timeline + costs
│   │   ├── normalizer.ts                  # Make/model cleanup
│   │   ├── dedup.ts                       # Duplicate detection + merge
│   │   └── model-intelligence.ts          # Known issues lookup
│   ├── ai/
│   │   ├── gemini.ts                      # Gemini client (primary)
│   │   ├── ollama.ts                      # Local LLM fallback
│   │   ├── vehicle-analyzer.ts            # Deep analysis on demand
│   │   └── photo-analyzer.ts              # Photo scoring on demand
│   ├── audit/
│   │   ├── validator.ts                   # Per-listing validation
│   │   ├── sweep.ts                       # Nightly audit sweep
│   │   └── data-quality.ts                # Completeness scoring
│   ├── notifications/
│   │   ├── email.ts
│   │   ├── discord.ts
│   │   ├── telegram.ts
│   │   └── digest.ts                      # Daily/weekly summaries
│   ├── texas/
│   │   ├── ttl-calculator.ts              # Tax, title, license
│   │   ├── emissions-counties.ts          # Which counties require emissions
│   │   └── bill-of-sale.ts                # Form 130-U generator
│   └── utils/
│       ├── geocoder.ts
│       ├── csv-import.ts
│       └── csv-export.ts
├── web/                                   # React + Vite frontend
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       ├── components/
│       │   ├── Dashboard.tsx
│       │   ├── MapView.tsx
│       │   ├── CompareView.tsx
│       │   ├── DealerManager.tsx
│       │   ├── Analytics.tsx
│       │   ├── VehicleDetail.tsx
│       │   ├── RepairForecast.tsx
│       │   ├── PurchaseWorkflow.tsx
│       │   ├── AuditDashboard.tsx
│       │   ├── FilterBar.tsx
│       │   ├── DealBadge.tsx
│       │   ├── ScamAlert.tsx
│       │   └── ContactButton.tsx
│       └── utils/
│           ├── formatting.ts
│           └── colors.ts
├── extension/                             # Chrome extension (Phase 8)
│   ├── manifest.json
│   ├── content.ts
│   ├── popup.tsx
│   └── background.ts
├── scripts/
│   ├── scrape-now.ts
│   ├── discover-dealers.ts
│   ├── import-dealers.ts
│   ├── audit-sweep.ts
│   └── seed-db.ts
└── README.md
```

---

## 13. BUILD ORDER

**CRITICAL: Claude Code has these MCP plugins installed. Use them at every stage:**
- **context7** → Look up latest library docs BEFORE writing any code that imports a package
- **code-review** → Run on ALL new files AFTER each phase. Fix every finding before moving on.
- **frontend-design** → Use for EVERY UI component. Dark theme, gold accents, no generic aesthetics.
- **ui-ux-pro-max** → Use for complex interaction patterns (tables, maps, modals, mobile gestures).
- **superpowers** → Use for complex system architecture decisions (pipelines, queues, concurrency).

**Every phase follows: context7 → Code → code-review → Fix → UI plugins → Test → Next phase**

```
Phase 1 — Foundation (Session 1-2):
 1. context7: look up better-sqlite3, pino, dotenv latest APIs
 2. Initialize: Node.js + TypeScript + Express + SQLite
 3. Database schema — ALL tables, ALL indexes
 4. Seed model_intelligence — 80+ cars
 5. Seed parts_pricing — 30+ common models
 6. Normalizer + dedup + merge logic
 7. Risk scorer + deal rater + negotiation power scorer
 8. code-review: review schema.ts, queries.ts, all scoring logic — fix all findings

Phase 2 — First Data Sources (Session 2-3):
 9. context7: look up Cheerio, node-fetch, Playwright latest APIs
10. Craigslist scraper (RSS + HTML parse)
11. MarketCheck inventory search + price prediction
12. NHTSA integration: VIN decode, recalls, complaints, safety
13. Scam detection engine
14. Repair forecast engine
15. Audit validator (per-listing)
16. code-review: review ALL scrapers, enrichment, dedup, forecast — fix all findings
17. Run smoke tests against live endpoints

Phase 3 — API + Basic UI (Session 3-4):
18. context7: look up Express/helmet/cors/rate-limit, React, Vite, Tailwind, recharts
19. Express API: /listings, /listings/:id, /dealers, /stats, /audit
20. code-review: review server.ts for injection, SSRF, auth — fix all findings
21. frontend-design: Dashboard table — dark theme, gold accents, color-coded cells
22. ui-ux-pro-max: sorting/filtering UX, inline expansion, loading/empty/error states
23. frontend-design: Vehicle Detail page — repair forecast viz, deal badges, risk indicators
24. frontend-design: Filter bar — compact, mobile-responsive
25. code-review: review all React components for XSS — fix all findings

Phase 4 — Dealer System (Session 4-5):
26. context7: look up Google Places API, Playwright stealth
27. superpowers: architect the platform auto-detection + scraper registry system
28. Dealer CRUD API + platform auto-detection engine
29. Build platform scrapers: dealer.com, frazer, generic-ai (Gemini)
30. Google Places auto-discovery
31. Cross-source dedup merge (MarketCheck + your scrapers)
32. frontend-design + ui-ux-pro-max: Dealer Manager UI — add, import, discover, status
33. code-review: review detector.ts, all scrapers, dealer input validation — fix all

Phase 5 — Intelligence + Polish (Session 5-6):
34. context7: look up Google Gemini generative AI SDK, Ollama API
35. Gemini integration: deep analysis + photo analysis (on-demand)
36. Contact message generator with negotiation script
37. Texas TTL calculator
38. frontend-design + ui-ux-pro-max: Purchase workflow — step progress, checklists
39. Notification system (email + Discord)
40. code-review: review AI integration for prompt injection, notification security — fix all

Phase 6 — Advanced (Session 7-8):
41. superpowers: architect the nightly audit sweep + crash recovery system
42. Nightly audit sweep implementation
43. frontend-design: Audit dashboard — health indicators, severity badges
44. frontend-design + ui-ux-pro-max: Map view — custom pins, popups, radius
45. frontend-design: Compare view — radar charts, winner highlighting
46. frontend-design: Analytics — price trend charts, heatmaps
47. Price history tracking + price drop detection
48. Benchmark scrapers: Carvana/CarMax/Copart
49. code-review: full review of ALL Phase 6 files — fix all findings

Phase 7 — Scheduling + More Scrapers (Session 9-10):
50. context7: look up node-cron, p-limit, PM2 latest APIs
51. superpowers: architect priority-based smart scheduling
52. Smart scheduling implementation
53. Daily digest + weekly report notifications
54. More platform scrapers as needed
55. Facebook Marketplace scraper (Playwright stealth — most complex)
56. frontend-design + ui-ux-pro-max: Transaction log UI, Mechanic database UI
57. code-review: review scheduling, FB scraper anti-detection, sessions — fix all

Phase 8 — Chrome Extension (Session 11-12):
58. context7: look up Chrome Extension Manifest V3, content scripts
59. superpowers: architect extension ↔ backend communication
60. Extension: detect listings, overlay badges, save button, VIN extraction
61. code-review: review manifest permissions (minimum needed), content script security

Phase 9 — Final Polish (Session 13+):
62. Price drop prediction + market demand scoring + seasonal trends
63. Community transaction data
64. frontend-design: FINAL polish pass — consistency, animations, mobile responsive ALL views
65. ui-ux-pro-max: FINAL UX audit — every flow, every edge case, every error state
66. code-review: COMPREHENSIVE final review of ENTIRE codebase
67. Full test suite: unit + integration + smoke — ALL passing
```

---

## 14. CONFIGURATION (.env)

```bash
# Location
USER_LAT=29.5111
USER_LNG=-95.1313
USER_CITY=League City
USER_STATE=TX
USER_COUNTY=Galveston
SEARCH_RADIUS_MILES=50

# Your mechanic's labor rate as multiplier (1.0 = dealer rate, 0.4 = 40% of dealer)
MECHANIC_LABOR_MULTIPLIER=0.4

# MarketCheck
MARKETCHECK_API_KEY=

# Google (dealer discovery + geocoding)
GOOGLE_PLACES_API_KEY=

# Gemini (primary AI — free tier)
GOOGLE_AI_API_KEY=

# Ollama (local fallback)
OLLAMA_URL=http://localhost:11434

# Notifications
SMTP_HOST=smtp.gmail.com
SMTP_USER=
SMTP_PASS=
NOTIFY_EMAIL=
DISCORD_WEBHOOK_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# Scraping
REQUEST_DELAY_MS=2000
MAX_CONCURRENT_SCRAPERS=3
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
```

---

## 15. WHY THIS IS UNFAIR

1. **Dual-source coverage** — MarketCheck's 53k national dealers + your 200-400 hand-curated Houston dealers. Nothing slips through.
2. **$5-30/month** — 95% of intelligence is free code logic and free APIs.
3. **Scam detection** — catches curbstoners, title washers, VIN cloners, flood cars, and stock photo listings automatically.
4. **Repair forecast for every car** — see exact future costs before you buy. Not guessing — computed from model intelligence + parts pricing + your mechanic's rates.
5. **Audit engine** — validates every listing: VIN verification, price sanity, mileage sanity, stale detection, cross-reference checks. Nothing is taken at face value.
6. **Negotiation intelligence** — knows how long it's been listed, how many comparables exist, what the defects are, and when the month ends. Generates specific tactics.
7. **Speed** — scrapes every 4-24 hours depending on source priority. You see STEAL listings within hours. Everyone else finds them days later on their phone.
8. **Information asymmetry** — you know the ML-predicted market value, the risk score, the scam probability, every open recall, every consumer complaint pattern, the exact parts costs, and the precise offer range. The seller knows none of this.
9. **Texas-specific** — TTL calculator, emissions county check, bill of sale generator, inspection requirements, lien verification guidance.
10. **Grows with you** — transaction log builds your personal market intelligence over time. The longer you use it, the smarter it gets.
