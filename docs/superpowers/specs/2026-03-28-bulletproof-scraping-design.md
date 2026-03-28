# AutoScout v2: Bulletproof Scraping & Full Enrichment

## Overview

Upgrade AutoScout from a 60-70% complete prototype to a production-grade system that can ingest 200+ dealer websites automatically, enrich every listing with real market data, and surface actionable intelligence in real time.

## Goals

1. Given any dealer URL, auto-detect platform and scrape inventory with >85% accuracy
2. Handle 1 to 500 dealers without manual intervention
3. Self-heal scraper failures for 48 hours before alerting
4. Every listing gets real market value, deal rating, recalls, complaints, and safety data
5. Real-time updates — new listings and STEAL alerts appear without page refresh

## Non-Goals

- Mobile responsive UI (future iteration)
- Facebook Marketplace scraper (requires Playwright + auth, separate project)
- OfferUp scraper
- NMVTIS title verification (paid, on-demand only)
- Texas DPS inspection history (no public API)
- Ollama local LLM fallback

---

## 1. Scraper Cascade Architecture

### 4-Tier Detection & Extraction

When scraping a dealer, tiers are tried in order. First tier that succeeds wins. If multiple tiers produce results, merge and keep the richest data.

| Tier | Method | Speed | Accuracy | Description |
|------|--------|-------|----------|-------------|
| 1 | Platform-specific | ~2s | 95% | Pattern-match HTML against 20+ known dealer platforms. Use dedicated parser with deep knowledge of that platform's DOM structure. |
| 2 | Structured data | ~3s | 90% | Parse JSON-LD (`<script type="application/ld+json">`), Schema.org `Vehicle`/`Car`/`Product` markup, and sitemap.xml with vehicle entries. |
| 3 | Hidden API discovery | ~5s | 92% | Probe common API paths (`/api/inventory`, `/api/vehicles`, `/wp-json/`, `/_next/data/`, `/graphql`). Parse JSON responses directly. |
| 4 | Gemini AI extraction | ~8s | 70-80% | Strip non-essential HTML (scripts, styles, nav, footer). Send to Gemini 2.0 Flash with structured extraction prompt. Validate extracted fields. |

### Platform Signatures (20+)

Expand from current 11 to 20+:
- **Current:** dealer.com, dealersocket, frazer, dealerfire, dealer_inspire, autorevo, dealer_center, wayne_reaves, v12_software, promax, carsforsale
- **Add:** DealerOn, Dealer eProcess, DealerCenter Pro, Autotrader Dealer, Cars.com Dealer, Vericom, HomenetIoL, Lotlinx, PureCars, WordPress dealer themes, Shopify auto themes, Wix auto templates

### Pagination

Every tier must handle pagination:
- **Platform scrapers:** Follow "Next" links, increment `?page=N`, or use offset params until no new listings found
- **Structured data:** Follow sitemap pagination, JSON-LD `@graph` arrays
- **API discovery:** Increment `offset`/`page` params, follow `next` cursors in response
- **AI extraction:** Detect "Page 1 of N" patterns, construct subsequent page URLs

### Confidence Scoring

Every listing gets a `scrape_confidence` field (0.0 to 1.0):
- Tier 1 (platform): 0.95 base, minus 0.05 per missing critical field (price, mileage, year/make/model)
- Tier 2 (structured): 0.90 base, same deductions
- Tier 3 (API): 0.92 base, same deductions
- Tier 4 (AI): 0.50 base, plus 0.05 per successfully extracted field, capped at 0.85

Listings with confidence < 0.8 get a yellow "Unverified" badge in the UI.

---

## 2. Dealer Onboarding Flow

### Single Dealer Add

User provides: URL + name + city (minimum). System performs:

1. **Fetch homepage** — HTTP GET with timeout, store raw HTML
2. **Platform detection** — run Tier 1 signature matching against HTML
3. **Structured data scan** — check for JSON-LD, Schema.org markup
4. **API probing** — HEAD/GET requests to 10+ common API paths, check for JSON responses
5. **Inventory URL discovery** — follow links matching patterns: "inventory", "used-cars", "pre-owned", "vehicles", "our-cars"
6. **Pagination detection** — load inventory page, check for page count/next links
7. **Metadata extraction** — phone, address, hours from page content or Google Places
8. **Test scrape** — run selected tier on page 1, return summary

**Test scrape summary returned to user:**
```
Dealer: Texas Car Superstore
Platform: dealer.com (Tier 1, confidence: 94%)
Inventory URL: texascarsuperstore.com/used-vehicles/
Vehicles found: 47 across 3 pages
Sample: 2019 Toyota Camry LE — $14,500 — 45,000 mi
Status: Ready to scrape ✅
```

If confidence < 0.7: show "Needs Review" with sample extracted data for user confirmation.

### Bulk Import

Accept input as:
- CSV with columns: url, name, city, state (minimum: url)
- Plain text: one URL per line (name/city auto-extracted from site)
- Paste into textarea in Dealer Manager UI

Processing:
- Run auto-discovery on up to 5 dealers in parallel
- Show progress table: each row updates from "Queued" → "Detecting..." → "Test scraping..." → "Ready ✅" or "Needs Review ⚠️" or "Failed ❌"
- User can fix/retry failures individually

### Auto-Priority Assignment

Based on test scrape results:
- 50+ vehicles → `high` priority (every 4-6 hours)
- 10-49 vehicles → `medium` priority (every 12 hours)
- <10 vehicles → `low` priority (every 24 hours)

User can override priority per dealer.

---

## 3. Health Monitoring & Self-Healing

### Dealer Health States

| State | Trigger | Behavior |
|-------|---------|----------|
| `healthy` | Last 3 scrapes succeeded | Normal schedule |
| `degraded` | 1-2 consecutive failures | Auto-escalate to next tier. If platform scraper fails, try structured data, then API, then AI. Log tier switch. |
| `failing` | 3+ consecutive failures, <48 hours | AI-only mode, reduce to daily frequency. Continue retrying. |
| `dead` | 48+ hours of continuous failure | **Alert user** via Discord/email + dashboard notification. Pause scraping until user acts. |

### Self-Healing Cascade

On each failure:
1. Retry same tier, same URL — exponential backoff (2s, 4s, 8s), max 3 retries
2. If retries exhausted → try next tier (Tier 1→2→3→4)
3. If all tiers fail → mark `failing`, schedule retry next cycle
4. If failing for 48+ hours → mark `dead`, send alert

### Site Redesign Detection

Triggered when:
- Scraper returns 0 listings but HTTP status is 200
- Listing count drops 80%+ from previous scrape

Response:
1. Re-run full platform detection (site may have switched platforms)
2. If platform changed → update dealer config, log event
3. If same platform → HTML structure changed, escalate to AI tier
4. Create audit log entry: "Texas Auto switched from Frazer to DealerSocket on 2026-03-28"

### Monitoring Data Stored

Per scrape attempt:
- Tier used, tier result (success/fail/skipped)
- Listings found, new/updated/deactivated counts
- Duration, error messages
- Confidence distribution (min/max/avg across listings)

Per dealer (rolling):
- Health state
- Success rate (7-day, 30-day)
- Average listing count (for anomaly detection)
- Tier history (which tiers have worked)
- Last successful scrape timestamp

---

## 4. Enrichment Pipeline (Fixed)

### Current Pipeline (Broken)

```
Scrape → Normalize → Validate → Dedup → Risk Score → Insert
```

Problems: No market value lookup. Deal ratings are null. Recalls/complaints never fetched. Safety ratings ignored. VIN decode is on-demand only.

### New Pipeline

```
Scrape → Normalize → Validate → Dedup →
VIN Decode → Market Value → Risk Score → Deal Rating →
Scam Detection → Negotiation Power → Recall Check →
Complaint Check → Safety Rating → Repair Forecast →
Distance Calc → Confidence Score → Insert → Alert Check
```

### Stage Details

**VIN Decode (automatic on ingest):**
- Every listing with a VIN gets NHTSA vPIC decode
- Backfills: engine, transmission, drivetrain, body style, fuel type, plant info
- Flags VIN/listing mismatches (listing says "Honda" but VIN decodes to "Toyota")
- Cached permanently per VIN (VIN data never changes)

**Market Value (mandatory):**
- Primary: MarketCheck price prediction API (by VIN or year/make/model/miles)
- Fallback 1: MarketCheck comparable search (average of 5 nearest matches)
- Fallback 2: Carvana/CarMax benchmark average (retail ceiling × 0.85)
- Fallback 3: Model-year-mileage regression from existing listings in DB
- At least one source must populate `market_value` before deal rating runs

**Recall/Complaint/Safety (cached per make/model/year):**
- First lookup for any make/model/year combination hits NHTSA APIs
- Result cached in a new `nhtsa_cache` table
- All subsequent listings with same make/model/year reuse cache
- Cache expires after 30 days (recalls get updated)

**Alert Check (end of pipeline):**
- If `value_rating` is STEAL or GREAT → call `sendStealAlert()`
- If `scam_score` > 60 → create audit log entry
- If any open recalls with safety consequence → flag in listing

### New Database Tables

```sql
CREATE TABLE IF NOT EXISTS nhtsa_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  data_type TEXT NOT NULL,  -- 'recalls', 'complaints', 'safety'
  data TEXT NOT NULL,        -- JSON response
  fetched_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
CREATE UNIQUE INDEX idx_nhtsa_cache_lookup ON nhtsa_cache(make, model, year, data_type);
```

### New Listing Fields

```sql
ALTER TABLE listings ADD COLUMN scrape_confidence REAL DEFAULT 1.0;
ALTER TABLE listings ADD COLUMN scrape_tier TEXT;           -- 'platform', 'structured', 'api', 'ai'
ALTER TABLE listings ADD COLUMN market_value_source TEXT;   -- 'marketcheck', 'benchmark', 'regression'
ALTER TABLE listings ADD COLUMN recalls_json TEXT;          -- cached recall data
ALTER TABLE listings ADD COLUMN complaints_count INTEGER DEFAULT 0;
ALTER TABLE listings ADD COLUMN safety_overall INTEGER;     -- 1-5 stars
ALTER TABLE listings ADD COLUMN enrichment_status TEXT;     -- JSON tracking what was enriched
```

---

## 5. API Additions (18 New Endpoints)

### Scraping & Dealers

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/dealers/import` | Bulk import from CSV or URL list. Returns job ID for progress tracking. |
| POST | `/api/dealers/:id/scrape` | Trigger immediate scrape of one dealer. Returns scrape result. |
| POST | `/api/scrape/run` | Trigger full scrape cycle. Returns job ID. |
| GET | `/api/dealers/:id/listings` | All active listings from a dealer. |
| GET | `/api/dealers/:id/health` | Health state, scrape history, tier info, errors. |

### Enrichment

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/listings/:id/analyze` | Full re-enrichment: VIN + recalls + complaints + safety + market value + scores. |
| POST | `/api/listings/:id/decode-vin` | Manual VIN decode and field backfill. |
| GET | `/api/vehicle/:make/:model/:year/recalls` | Recall data for any vehicle (cached). |
| GET | `/api/vehicle/:make/:model/:year/complaints` | Complaint data for any vehicle (cached). |
| GET | `/api/listings/:id/price-history` | All price changes for a listing over time. |

### User Features

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mechanics` | Search mechanic directory by location/specialty. |
| POST | `/api/transactions` | Log a dealer visit, offer, or purchase. |
| GET | `/api/transactions` | Retrieve transaction history. |
| POST | `/api/listings/export` | Export filtered listings as CSV or JSON. Body includes filter params + format. |
| GET/PUT | `/api/settings` | Read/update user preferences (location, radius, API keys, notifications, mechanic rate). |

### Monitoring

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/scraper-health` | All dealers with health state, tier, success rate, listing count. |
| GET | `/api/audit/stats` | Real audit statistics (not mocked). |
| GET | `/api/audit/issues` | Unresolved audit issues with severity filtering. |

---

## 6. Frontend Additions

### 6.1 Dealer Onboarding UI

Redesign the Dealer Manager page:
- **Add Single Dealer:** URL input → live auto-discovery status → test scrape preview → confirm
- **Bulk Import:** textarea for pasting URLs/CSV → parallel processing → results table with status per dealer
- **Dealer List:** enhanced with health dots, tier badges, listing count, sparkline trends
- **Drill-in:** click dealer → full scrape history, error log, tier switches, inventory over time

### 6.2 Scraper Health Dashboard

New page at `/scraper-health`:
- Grid of all dealers with green/yellow/red health indicators
- Each card shows: name, platform, tier, success rate (7d), last scrape, listing count
- Filter by health state (show me all failing dealers)
- "Dead" dealers highlighted with red banner and "Re-test" button
- Summary bar: X healthy, Y degraded, Z failing, W dead

### 6.3 Confidence Badges

On Dashboard table and Vehicle Detail:
- Listings with `scrape_confidence < 0.8` get yellow "Unverified" badge
- Tooltip: "Extracted by AI — price and mileage may need verification"
- Vehicle Detail shows raw vs. normalized data comparison for unverified listings

### 6.4 Settings Panel

New page at `/settings`:
- **Location:** lat/lng, city, county, search radius (with map preview)
- **API Keys:** MarketCheck, Gemini, Google Places (masked input, test button)
- **Notifications:** toggle email/Discord/Telegram, set alert thresholds (STEAL only, STEAL+GREAT, all)
- **Scraping:** default frequency, max concurrent scrapers, request delay
- **Mechanic:** labor rate multiplier
- All settings persisted to a `user_settings` table (or `.env` file update)

### 6.5 Enrichment Status on Vehicle Detail

On the Vehicle Detail page, add an "Enrichment" section:
- Checklist: ✅ VIN decoded, ✅ Recalls checked (2 open), ✅ Market value ($8,200 via MarketCheck), ⚠️ Safety rating unavailable, ✅ Repair forecast generated
- "Re-analyze" button triggers `/api/listings/:id/analyze`
- Shows market value source and confidence
- Shows recall details inline (component, summary, remedy)

### 6.6 Export & Transaction Tracking

**Export:** Button on Dashboard filter bar → dropdown: CSV, JSON → downloads filtered results

**Transactions:** New page at `/transactions`:
- Log form: select listing, action (viewed/contacted/visited/offered/bought/walked), price, notes
- History table: your negotiation journey
- Purchase funnel visualization: viewed → contacted → visited → offered → bought/walked

### 6.7 Real-time Updates (WebSocket)

Add WebSocket server alongside Express:
- **New listings:** when a scrape completes, push new listing IDs to connected clients. Dashboard shows "3 new listings" badge, click to refresh.
- **STEAL alerts:** toast notification pops up in browser when a STEAL/GREAT listing is found
- **Scraper health:** live updates when a dealer changes health state
- **Scrape progress:** when manual scrape triggered, show live progress (5/47 dealers complete...)

---

## 7. Scheduling Updates

### Current Scheduler (5 jobs)

- 1:55 AM: DB backup
- 2:00 AM: Audit sweep
- 7:00 AM: Daily digest
- Monday 8 AM: Weekly report
- Midnight: API budget reset (broken — no reset function)

### Updated Scheduler (8 jobs)

| Time | Job | New? |
|------|-----|------|
| Every 4h | Scrape `high` priority dealers | **NEW** |
| Every 12h | Scrape `medium` priority dealers | **NEW** |
| Every 24h | Scrape `low` priority dealers | **NEW** |
| Midnight | MarketCheck budget reset (fix: actually call `resetDailyBudget()`) | **FIX** |
| 1:55 AM | Database backup | existing |
| 2:00 AM | Audit sweep + stale listing cleanup | existing |
| 7:00 AM | Daily digest (top deals, price drops, scraper health summary) | enhanced |
| Monday 8 AM | Weekly report (market trends, best deals, dealer activity) | existing |

Weekend surge: Friday-Sunday, `high` and `medium` dealers scrape 50% more frequently (every 3h and 8h respectively).

Month-end boost: Days 26-31, all frequencies increased 50% (dealers desperate to clear inventory).

---

## 8. Database Schema Changes

### New Tables

```sql
-- NHTSA response cache
CREATE TABLE IF NOT EXISTS nhtsa_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  data_type TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- User settings (single row)
CREATE TABLE IF NOT EXISTS user_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  lat REAL,
  lng REAL,
  city TEXT,
  county TEXT,
  search_radius_miles INTEGER DEFAULT 50,
  mechanic_labor_multiplier REAL DEFAULT 0.4,
  notify_email INTEGER DEFAULT 1,
  notify_discord INTEGER DEFAULT 1,
  notify_telegram INTEGER DEFAULT 0,
  alert_threshold TEXT DEFAULT 'GREAT',
  scrape_delay_ms INTEGER DEFAULT 2000,
  max_concurrent_scrapers INTEGER DEFAULT 3,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Scrape attempt log (more detailed than scrape_log)
CREATE TABLE IF NOT EXISTS scrape_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  tier_used TEXT NOT NULL,
  tier_result TEXT NOT NULL,
  listings_found INTEGER DEFAULT 0,
  confidence_avg REAL,
  confidence_min REAL,
  error_message TEXT,
  duration_ms INTEGER,
  attempted_at TEXT DEFAULT (datetime('now'))
);
```

### Altered Tables

```sql
-- listings: add scraper metadata
ALTER TABLE listings ADD COLUMN scrape_confidence REAL DEFAULT 1.0;
ALTER TABLE listings ADD COLUMN scrape_tier TEXT;
ALTER TABLE listings ADD COLUMN market_value_source TEXT;
ALTER TABLE listings ADD COLUMN recalls_json TEXT;
ALTER TABLE listings ADD COLUMN complaints_count INTEGER DEFAULT 0;
ALTER TABLE listings ADD COLUMN safety_overall INTEGER;
ALTER TABLE listings ADD COLUMN enrichment_status TEXT;

-- dealers: add health tracking
ALTER TABLE dealers ADD COLUMN health_state TEXT DEFAULT 'healthy';
ALTER TABLE dealers ADD COLUMN preferred_tier TEXT;
ALTER TABLE dealers ADD COLUMN inventory_page_count INTEGER DEFAULT 1;
ALTER TABLE dealers ADD COLUMN last_successful_scrape TEXT;
ALTER TABLE dealers ADD COLUMN consecutive_failures INTEGER DEFAULT 0;
ALTER TABLE dealers ADD COLUMN tier_history TEXT;
```

---

## 9. Implementation Priority

Build in this order — each layer unlocks the next:

1. **Scraper cascade + pagination** — Tier 2 (structured data), Tier 3 (API discovery), pagination on all tiers, confidence scoring
2. **Dealer onboarding flow** — auto-discovery, test scrape, bulk import
3. **Health monitoring** — 4 states, self-healing, alerts, site redesign detection
4. **Enrichment pipeline fix** — wire MarketCheck, auto VIN decode, NHTSA caching, alert check
5. **New API endpoints** — all 18 endpoints
6. **Scrape scheduling** — 3 new cron jobs, weekend/month-end surge
7. **Frontend: dealer onboarding + health dashboard + settings** — critical UI
8. **Frontend: confidence badges + enrichment status + export + transactions** — polish UI
9. **WebSocket real-time updates** — new listings, STEAL alerts, scrape progress
