# AutoScout V2: Bulletproof Scraping & Full Intelligence Pipeline

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AutoScout from a prototype into a production-grade used car intelligence engine that can onboard 200+ dealer websites, auto-scrape them on tiered schedules, self-heal when scrapers break, deliver accurate deal ratings backed by real market data, and surface everything through a polished real-time UI.

**Architecture:** 4-tier scraper cascade (platform-specific → structured data → API discovery → AI extraction) with per-listing confidence scoring. Health state machine per dealer with self-healing tier escalation. Enrichment pipeline wired end-to-end with MarketCheck market values, NHTSA data auto-enriched on ingest, and instant STEAL alerts. WebSocket push for real-time UI updates.

**Tech Stack:** TypeScript, Express, SQLite (sql.js), Cheerio, Google Gemini Flash, MarketCheck API, NHTSA APIs, React 19, Vite, Tailwind CSS 4, Recharts, Leaflet, WebSocket (ws).

---

## File Structure

### New Files

```
src/scrapers/tiers/structured-data.ts    — Tier 2: JSON-LD/Schema.org parser
src/scrapers/tiers/api-discovery.ts      — Tier 3: hidden REST/GraphQL endpoint finder
src/scrapers/cascade.ts                  — 4-tier cascade orchestrator
src/scrapers/platforms/dealeron.ts       — DealerOn platform scraper
src/scrapers/platforms/dealersocket.ts   — DealerSocket platform scraper
src/scrapers/platforms/wordpress-dealer.ts — WordPress dealer site scraper
src/scrapers/onboard.ts                 — Dealer auto-discovery & test scrape
src/scrapers/health.ts                  — Health state machine & self-healing
src/enrichment/cache.ts                 — NHTSA result cache layer
src/enrichment/market-value.ts          — MarketCheck integration for pipeline
src/enrichment/alert-check.ts           — Post-enrichment STEAL/GREAT alert firing
src/websocket.ts                        — WebSocket server for real-time push
web/src/components/DealerOnboarding.tsx  — Dealer add/bulk import UI
web/src/components/ScraperHealth.tsx     — Scraper health dashboard
web/src/components/SettingsPanel.tsx     — User settings & API keys
web/src/components/EnrichmentStatus.tsx  — Per-listing enrichment badges
web/src/components/ExportTools.tsx       — CSV/JSON export UI
web/src/components/TransactionTracker.tsx — Visit/offer/purchase log
web/src/hooks/useWebSocket.ts           — WebSocket hook for real-time updates
web/src/components/ConfidenceBadge.tsx   — Confidence indicator component
tests/scrapers/cascade.test.ts          — Cascade orchestrator tests
tests/scrapers/structured-data.test.ts  — Tier 2 parser tests
tests/scrapers/api-discovery.test.ts    — Tier 3 discovery tests
tests/scrapers/onboard.test.ts          — Onboarding flow tests
tests/scrapers/health.test.ts           — Health state machine tests
tests/enrichment/cache.test.ts          — NHTSA cache tests
tests/enrichment/market-value.test.ts   — Market value lookup tests
tests/enrichment/alert-check.test.ts    — Alert firing tests
```

### Modified Files

```
src/scrapers/detector.ts                — Expand from 11 to 20+ platforms
src/scrapers/manager.ts                 — Wire cascade, health tracking
src/scrapers/base.ts                    — Add confidence field to ScrapedListing
src/scrapers/platforms/generic-ai.ts    — Add confidence scoring, pagination
src/scrapers/platforms/dealer-com.ts    — Add pagination, confidence scoring
src/scrapers/platforms/frazer.ts        — Add pagination, confidence scoring
src/scrapers/craigslist.ts             — Add confidence scoring
src/scrapers/benchmark.ts              — Add confidence scoring
src/scrapers/marketcheck.ts            — Add confidence scoring
src/enrichment/pipeline.ts             — Wire all enrichment stages end-to-end
src/enrichment/deal-rater.ts           — Use real market values from MarketCheck
src/db/schema.ts                       — Add health_state, scrape_tier, confidence columns
src/db/queries.ts                      — Add 15+ new query functions
src/server.ts                          — Add 18 new API endpoints + WebSocket upgrade
src/scheduler.ts                       — Add tiered scrape schedules
src/config.ts                          — Add new config keys
web/src/api.ts                         — Add new API client functions
web/src/App.tsx                        — Add new routes
web/src/components/Dashboard.tsx       — Add confidence badges, real-time updates
web/src/components/VehicleDetail.tsx    — Add enrichment status section
web/src/components/DealerManager.tsx    — Add onboarding link, health indicators
```

---

## Phase 1: Scraper Cascade Foundation

### Task 1: Add confidence field to ScrapedListing

**Files:**
- Modify: `src/scrapers/base.ts`

- [ ] **Step 1: Add scrape_confidence to ScrapedListing interface**

In `src/scrapers/base.ts`, add to the `ScrapedListing` interface after the `photos` field:

```typescript
  scrape_confidence: number; // 0.0 to 1.0 — how confident the scraper is in the data
  scrape_tier?: string;      // 'platform' | 'structured_data' | 'api_discovery' | 'ai_extraction'
```

- [ ] **Step 2: Update all existing scrapers to set confidence = 0.95**

In each of these files, find where `ScrapedListing` objects are constructed and add `scrape_confidence: 0.95, scrape_tier: 'platform'`:
- `src/scrapers/platforms/dealer-com.ts` — both strategy1 and strategy2 return blocks
- `src/scrapers/platforms/frazer.ts` — both strategy1 and strategy2 return blocks
- `src/scrapers/craigslist.ts` — listing construction block
- `src/scrapers/benchmark.ts` — both Carvana and CarMax listing blocks
- `src/scrapers/marketcheck.ts` — listing construction in `searchInventory`
- `src/scrapers/platforms/generic-ai.ts` — set `scrape_confidence: 0.7, scrape_tier: 'ai_extraction'`

- [ ] **Step 3: Add columns to database schema**

In `src/db/schema.ts`, add to the `listings` CREATE TABLE after `scrape_error`:

```sql
scrape_confidence REAL DEFAULT 0.5,
scrape_tier TEXT DEFAULT 'unknown',
```

- [ ] **Step 4: Update insertListing and updateListing in queries.ts**

In `src/db/queries.ts`, add `scrape_confidence` and `scrape_tier` to the `insertListing` function's column list and parameter bindings. Also add them to `updateListing`'s SET clause.

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/base.ts src/scrapers/platforms/ src/scrapers/craigslist.ts src/scrapers/benchmark.ts src/scrapers/marketcheck.ts src/db/schema.ts src/db/queries.ts
git commit -m "feat: add scrape_confidence and scrape_tier to listings"
```

---

### Task 2: Tier 2 — Structured Data Parser

**Files:**
- Create: `src/scrapers/tiers/structured-data.ts`
- Create: `tests/scrapers/structured-data.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/scrapers/structured-data.test.ts
import { describe, it, expect } from 'vitest';
import { extractStructuredData } from '../../src/scrapers/tiers/structured-data.js';

const JSON_LD_HTML = `
<html><head>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": "2021 Toyota Camry SE",
  "vehicleIdentificationNumber": "4T1G11AK5MU123456",
  "mileageFromOdometer": {"@type": "QuantitativeValue", "value": 35000, "unitCode": "SMI"},
  "offers": {"@type": "Offer", "price": 22500, "priceCurrency": "USD"},
  "brand": {"@type": "Brand", "name": "Toyota"},
  "model": "Camry",
  "vehicleModelDate": "2021",
  "color": "Silver",
  "image": "https://example.com/photo.jpg",
  "bodyType": "Sedan",
  "vehicleEngine": {"@type": "EngineSpecification", "name": "2.5L I4"},
  "vehicleTransmission": "Automatic",
  "driveWheelConfiguration": "FWD",
  "fuelType": "Gasoline"
}
</script>
</head><body></body></html>`;

const MULTIPLE_VEHICLES_HTML = `
<html><head>
<script type="application/ld+json">
[
  {"@context":"https://schema.org","@type":"Car","name":"2020 Honda Civic LX","vehicleIdentificationNumber":"2HGFC2F5XLH123456","offers":{"@type":"Offer","price":18900},"brand":{"name":"Honda"},"model":"Civic","vehicleModelDate":"2020","mileageFromOdometer":{"value":42000}},
  {"@context":"https://schema.org","@type":"Car","name":"2019 Ford F-150 XLT","vehicleIdentificationNumber":"1FTEW1E5XKFA12345","offers":{"@type":"Offer","price":28500},"brand":{"name":"Ford"},"model":"F-150","vehicleModelDate":"2019","mileageFromOdometer":{"value":55000}}
]
</script>
</head><body></body></html>`;

const NO_STRUCTURED_DATA_HTML = `<html><body><p>Just a regular page</p></body></html>`;

describe('extractStructuredData', () => {
  it('extracts single Vehicle from JSON-LD', () => {
    const result = extractStructuredData(JSON_LD_HTML, 'https://example.com');
    expect(result.success).toBe(true);
    expect(result.listings).toHaveLength(1);
    const listing = result.listings[0];
    expect(listing.vin).toBe('4T1G11AK5MU123456');
    expect(listing.year).toBe(2021);
    expect(listing.make).toBe('Toyota');
    expect(listing.model).toBe('Camry');
    expect(listing.price).toBe(22500);
    expect(listing.mileage).toBe(35000);
    expect(listing.scrape_confidence).toBeGreaterThanOrEqual(0.9);
    expect(listing.scrape_tier).toBe('structured_data');
  });

  it('extracts multiple vehicles from JSON-LD array', () => {
    const result = extractStructuredData(MULTIPLE_VEHICLES_HTML, 'https://example.com');
    expect(result.success).toBe(true);
    expect(result.listings).toHaveLength(2);
    expect(result.listings[0].make).toBe('Honda');
    expect(result.listings[1].make).toBe('Ford');
  });

  it('returns empty when no structured data found', () => {
    const result = extractStructuredData(NO_STRUCTURED_DATA_HTML, 'https://example.com');
    expect(result.success).toBe(false);
    expect(result.listings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scrapers/structured-data.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the structured data parser**

```typescript
// src/scrapers/tiers/structured-data.ts
import * as cheerio from 'cheerio';
import { ScrapedListing, ScraperResult } from '../base.js';
import { logger } from '../../logger.js';

interface SchemaVehicle {
  '@type'?: string;
  name?: string;
  vehicleIdentificationNumber?: string;
  vin?: string;
  mileageFromOdometer?: { value?: number; unitCode?: string } | number | string;
  offers?: { price?: number | string; priceCurrency?: string } | { price?: number | string }[];
  brand?: { name?: string } | string;
  manufacturer?: { name?: string } | string;
  model?: string;
  vehicleModelDate?: string | number;
  modelDate?: string | number;
  color?: string;
  vehicleInteriorColor?: string;
  image?: string | string[] | { url?: string }[];
  bodyType?: string;
  vehicleEngine?: { name?: string } | string;
  vehicleTransmission?: string;
  driveWheelConfiguration?: string;
  fuelType?: string;
  itemCondition?: string;
}

const VEHICLE_TYPES = ['Vehicle', 'Car', 'MotorizedBicycle', 'Automobile', 'BusOrCoach', 'Motorcycle'];

export function extractStructuredData(html: string, baseUrl: string): ScraperResult {
  const listings: ScrapedListing[] = [];
  const errors: string[] = [];
  const start = Date.now();

  try {
    const $ = cheerio.load(html);
    const jsonLdBlocks: unknown[] = [];

    // Extract all JSON-LD blocks
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const text = $(el).text().trim();
        if (!text) return;
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          jsonLdBlocks.push(...parsed);
        } else if (parsed['@graph']) {
          jsonLdBlocks.push(...parsed['@graph']);
        } else {
          jsonLdBlocks.push(parsed);
        }
      } catch {
        // Invalid JSON-LD block, skip
      }
    });

    // Also check for microdata itemtype="schema.org/Vehicle" etc.
    // (less common but some dealers use it)
    $('[itemtype*="schema.org/Vehicle"], [itemtype*="schema.org/Car"]').each((_, el) => {
      const vehicle: Record<string, string> = {};
      $(el).find('[itemprop]').each((__, prop) => {
        const name = $(prop).attr('itemprop') || '';
        const content = $(prop).attr('content') || $(prop).text().trim();
        vehicle[name] = content;
      });
      if (Object.keys(vehicle).length > 2) {
        jsonLdBlocks.push({ '@type': 'Vehicle', ...vehicle });
      }
    });

    // Filter to vehicle types only
    const vehicles = jsonLdBlocks.filter((block: any) => {
      const type = block?.['@type'] || '';
      return VEHICLE_TYPES.some(t => type.includes(t));
    }) as SchemaVehicle[];

    for (const v of vehicles) {
      try {
        const listing = vehicleToListing(v, baseUrl);
        if (listing) {
          listings.push(listing);
        }
      } catch (err) {
        errors.push(`Failed to parse vehicle: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    errors.push(`Structured data extraction error: ${(err as Error).message}`);
  }

  return {
    success: listings.length > 0,
    listings,
    errors,
    duration_ms: Date.now() - start,
  };
}

function vehicleToListing(v: SchemaVehicle, baseUrl: string): ScrapedListing | null {
  const year = extractYear(v);
  const make = extractMake(v);
  const model = v.model || '';

  // Must have at least year + make or model to be useful
  if (!year && !make && !model) return null;

  const price = extractPrice(v);
  const mileage = extractMileage(v);
  const vin = v.vehicleIdentificationNumber || v.vin || '';
  const photos = extractPhotos(v, baseUrl);

  // Compute confidence based on data completeness
  let confidence = 0.9;
  if (!vin) confidence -= 0.05;
  if (!price) confidence -= 0.1;
  if (!mileage) confidence -= 0.05;
  if (!year) confidence -= 0.1;

  return {
    vin,
    source: baseUrl,
    source_id: vin || `${baseUrl}-${year}-${make}-${model}`.replace(/\s+/g, '-'),
    year: year || 0,
    make,
    model,
    trim: extractTrim(v),
    price: price || 0,
    mileage: mileage || 0,
    exterior_color: v.color || '',
    interior_color: v.vehicleInteriorColor || '',
    body_style: v.bodyType || '',
    engine: typeof v.vehicleEngine === 'object' ? v.vehicleEngine?.name || '' : v.vehicleEngine || '',
    transmission: v.vehicleTransmission || '',
    drivetrain: v.driveWheelConfiguration || '',
    fuel_type: v.fuelType || '',
    title_status: '',
    seller_type: 'dealer',
    seller_name: '',
    seller_phone: '',
    latitude: 0,
    longitude: 0,
    listing_url: baseUrl,
    photos,
    description: '',
    scrape_confidence: Math.max(0.5, confidence),
    scrape_tier: 'structured_data',
  };
}

function extractYear(v: SchemaVehicle): number {
  const raw = v.vehicleModelDate || v.modelDate || '';
  const str = String(raw);
  const match = str.match(/(\d{4})/);
  if (match) return parseInt(match[1], 10);
  // Try extracting from name
  const nameMatch = (v.name || '').match(/\b(19|20)\d{2}\b/);
  return nameMatch ? parseInt(nameMatch[0], 10) : 0;
}

function extractMake(v: SchemaVehicle): string {
  if (typeof v.brand === 'object' && v.brand?.name) return v.brand.name;
  if (typeof v.brand === 'string') return v.brand;
  if (typeof v.manufacturer === 'object' && v.manufacturer?.name) return v.manufacturer.name;
  if (typeof v.manufacturer === 'string') return v.manufacturer;
  // Try extracting from name: "2021 Toyota Camry" → "Toyota"
  const name = v.name || '';
  const parts = name.replace(/^\d{4}\s+/, '').split(/\s+/);
  return parts[0] || '';
}

function extractPrice(v: SchemaVehicle): number {
  if (!v.offers) return 0;
  const offer = Array.isArray(v.offers) ? v.offers[0] : v.offers;
  const raw = offer?.price;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') {
    const cleaned = raw.replace(/[^0-9.]/g, '');
    return parseFloat(cleaned) || 0;
  }
  return 0;
}

function extractMileage(v: SchemaVehicle): number {
  const raw = v.mileageFromOdometer;
  if (!raw) return 0;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string') return parseInt(raw.replace(/[^0-9]/g, ''), 10) || 0;
  if (typeof raw === 'object' && 'value' in raw) {
    return typeof raw.value === 'number' ? raw.value : parseInt(String(raw.value), 10) || 0;
  }
  return 0;
}

function extractTrim(v: SchemaVehicle): string {
  // Try to get trim from name after year make model
  const name = v.name || '';
  const year = extractYear(v);
  const make = extractMake(v);
  const model = v.model || '';
  if (year && make && model) {
    const prefix = `${year} ${make} ${model}`;
    const remaining = name.replace(new RegExp(`^${year}\\s+${make}\\s+${model}\\s*`, 'i'), '').trim();
    return remaining;
  }
  return '';
}

function extractPhotos(v: SchemaVehicle, baseUrl: string): string[] {
  if (!v.image) return [];
  const resolve = (url: string) => {
    try { return new URL(url, baseUrl).href; } catch { return url; }
  };
  if (typeof v.image === 'string') return [resolve(v.image)];
  if (Array.isArray(v.image)) {
    return v.image.map(img => {
      if (typeof img === 'string') return resolve(img);
      if (typeof img === 'object' && img.url) return resolve(img.url);
      return '';
    }).filter(Boolean);
  }
  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scrapers/structured-data.test.ts
```
Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/tiers/structured-data.ts tests/scrapers/structured-data.test.ts
git commit -m "feat: add Tier 2 structured data parser (JSON-LD/Schema.org)"
```

---

### Task 3: Tier 3 — Hidden API Discovery

**Files:**
- Create: `src/scrapers/tiers/api-discovery.ts`
- Create: `tests/scrapers/api-discovery.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/scrapers/api-discovery.test.ts
import { describe, it, expect, vi } from 'vitest';
import { discoverApiEndpoints, parseApiResponse } from '../../src/scrapers/tiers/api-discovery.js';

describe('parseApiResponse', () => {
  it('parses array of vehicle objects', () => {
    const data = [
      {
        vin: '1HGBH41JXMN109186',
        year: 2021,
        make: 'Honda',
        model: 'Civic',
        price: 19500,
        mileage: 32000,
        images: ['https://img.com/1.jpg'],
      },
    ];
    const result = parseApiResponse(data, 'https://dealer.com');
    expect(result).toHaveLength(1);
    expect(result[0].vin).toBe('1HGBH41JXMN109186');
    expect(result[0].scrape_tier).toBe('api_discovery');
    expect(result[0].scrape_confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('parses nested {inventory: [...]} response', () => {
    const data = {
      inventory: [
        { VIN: '1FTEW1E5XKFA12345', Year: 2019, Make: 'Ford', Model: 'F-150', Price: 28000, Miles: 55000 },
      ],
    };
    const result = parseApiResponse(data, 'https://dealer.com');
    expect(result).toHaveLength(1);
    expect(result[0].make).toBe('Ford');
  });

  it('parses nested {data: {vehicles: [...]}} response', () => {
    const data = {
      data: {
        vehicles: [
          { vin: 'WBA3B1C55FK123456', year: 2015, make: 'BMW', model: '328i', askingPrice: 16500, odometer: 78000 },
        ],
      },
    };
    const result = parseApiResponse(data, 'https://dealer.com');
    expect(result).toHaveLength(1);
    expect(result[0].make).toBe('BMW');
  });

  it('returns empty for non-vehicle data', () => {
    const data = { status: 'ok', menu: [{ name: 'About Us' }] };
    const result = parseApiResponse(data, 'https://dealer.com');
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scrapers/api-discovery.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the API discovery module**

```typescript
// src/scrapers/tiers/api-discovery.ts
import { ScrapedListing, ScraperResult } from '../base.js';
import { logger } from '../../logger.js';
import { config } from '../../config.js';

// Common API paths that dealer websites expose
const API_PATHS = [
  '/api/inventory',
  '/api/vehicles',
  '/api/inventory/used',
  '/api/v1/inventory',
  '/api/v1/vehicles',
  '/wp-json/wp/v2/inventory',
  '/wp-json/inventory/v1/vehicles',
  '/_next/data/*/inventory.json',
  '/_next/data/*/used-vehicles.json',
  '/inventory.json',
  '/used-inventory.json',
  '/api/dealership/inventory',
  '/graphql',
];

const VEHICLE_ARRAY_KEYS = [
  'inventory', 'vehicles', 'listings', 'results', 'data',
  'items', 'cars', 'used_vehicles', 'pageProps',
];

// Field name aliases across different dealer APIs
const FIELD_MAP: Record<string, string[]> = {
  vin: ['vin', 'VIN', 'vehicleIdentificationNumber', 'vehicle_vin', 'vinNumber'],
  year: ['year', 'Year', 'modelYear', 'model_year', 'vehicleYear'],
  make: ['make', 'Make', 'brand', 'manufacturer', 'vehicleMake'],
  model: ['model', 'Model', 'vehicleModel', 'model_name'],
  trim: ['trim', 'Trim', 'trimLevel', 'trim_level'],
  price: ['price', 'Price', 'askingPrice', 'asking_price', 'salePrice', 'sale_price', 'internetPrice', 'internet_price', 'listPrice', 'list_price', 'msrp'],
  mileage: ['mileage', 'Mileage', 'miles', 'Miles', 'odometer', 'Odometer', 'mileageValue'],
  exterior_color: ['exteriorColor', 'exterior_color', 'color', 'Color', 'extColor'],
  interior_color: ['interiorColor', 'interior_color', 'intColor'],
  body_style: ['bodyType', 'body_type', 'bodyStyle', 'body_style', 'style', 'vehicleType'],
  engine: ['engine', 'Engine', 'engineDescription', 'engine_description'],
  transmission: ['transmission', 'Transmission', 'trans', 'transmissionType'],
  drivetrain: ['drivetrain', 'Drivetrain', 'driveType', 'drive_type', 'driveTrain'],
  fuel_type: ['fuelType', 'fuel_type', 'fuel', 'Fuel'],
  photos: ['images', 'photos', 'photoUrls', 'photo_urls', 'imageList', 'media', 'gallery'],
};

export async function discoverApiEndpoints(
  baseUrl: string,
  html: string
): Promise<ScraperResult> {
  const start = Date.now();
  const errors: string[] = [];
  const origin = new URL(baseUrl).origin;

  // Strategy 1: Probe known API paths
  for (const path of API_PATHS) {
    // Skip wildcard paths for now
    if (path.includes('*')) continue;

    const url = `${origin}${path}`;
    try {
      const resp = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': config.userAgent,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!resp.ok) continue;
      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('json')) continue;

      const data = await resp.json();
      const listings = parseApiResponse(data, baseUrl);

      if (listings.length > 0) {
        logger.info({ url, count: listings.length }, 'Discovered API endpoint');
        return {
          success: true,
          listings,
          errors: [],
          duration_ms: Date.now() - start,
        };
      }
    } catch {
      // Endpoint doesn't exist or isn't JSON, continue
    }
  }

  // Strategy 2: Scan HTML for fetch/XHR URLs that look like inventory APIs
  const apiUrlMatches = html.match(/["'](\/api\/[^"']*(?:inventory|vehicle|car)[^"']*?)["']/gi) || [];
  const nextDataMatches = html.match(/["'](\/\_next\/data\/[^"']+\.json)["']/gi) || [];
  const allMatches = [...new Set([...apiUrlMatches, ...nextDataMatches])];

  for (const rawMatch of allMatches.slice(0, 5)) {
    const path = rawMatch.replace(/^["']|["']$/g, '');
    const url = path.startsWith('http') ? path : `${origin}${path}`;
    try {
      const resp = await fetch(url, {
        headers: { 'Accept': 'application/json', 'User-Agent': config.userAgent },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      const listings = parseApiResponse(data, baseUrl);
      if (listings.length > 0) {
        logger.info({ url, count: listings.length }, 'Discovered API from HTML scan');
        return { success: true, listings, errors: [], duration_ms: Date.now() - start };
      }
    } catch {
      // Continue
    }
  }

  return {
    success: false,
    listings: [],
    errors: [...errors, 'No API endpoints found'],
    duration_ms: Date.now() - start,
  };
}

export function parseApiResponse(data: unknown, baseUrl: string): ScrapedListing[] {
  const vehicles = findVehicleArray(data);
  if (!vehicles || vehicles.length === 0) return [];

  const listings: ScrapedListing[] = [];

  for (const item of vehicles) {
    if (typeof item !== 'object' || !item) continue;
    const obj = item as Record<string, unknown>;

    const resolved = resolveFields(obj);
    // Must have at least make or model to count as a vehicle
    if (!resolved.make && !resolved.model && !resolved.vin) continue;

    const photos = extractPhotos(obj, baseUrl);
    let confidence = 0.92;
    if (!resolved.vin) confidence -= 0.05;
    if (!resolved.price) confidence -= 0.05;

    listings.push({
      vin: resolved.vin,
      source: baseUrl,
      source_id: resolved.vin || `${baseUrl}-${resolved.year}-${resolved.make}-${resolved.model}`.replace(/\s+/g, '-'),
      year: resolved.year,
      make: resolved.make,
      model: resolved.model,
      trim: resolved.trim,
      price: resolved.price,
      mileage: resolved.mileage,
      exterior_color: resolved.exterior_color,
      interior_color: resolved.interior_color,
      body_style: resolved.body_style,
      engine: resolved.engine,
      transmission: resolved.transmission,
      drivetrain: resolved.drivetrain,
      fuel_type: resolved.fuel_type,
      title_status: '',
      seller_type: 'dealer',
      seller_name: '',
      seller_phone: '',
      latitude: 0,
      longitude: 0,
      listing_url: baseUrl,
      photos,
      description: '',
      scrape_confidence: confidence,
      scrape_tier: 'api_discovery',
    });
  }

  return listings;
}

function findVehicleArray(data: unknown, depth = 0): unknown[] | null {
  if (depth > 4) return null;
  if (Array.isArray(data)) {
    if (data.length > 0 && looksLikeVehicle(data[0])) return data;
  }
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>;
    // Check known keys first
    for (const key of VEHICLE_ARRAY_KEYS) {
      if (obj[key]) {
        const result = findVehicleArray(obj[key], depth + 1);
        if (result) return result;
      }
    }
    // Check all keys
    for (const val of Object.values(obj)) {
      const result = findVehicleArray(val, depth + 1);
      if (result) return result;
    }
  }
  return null;
}

function looksLikeVehicle(item: unknown): boolean {
  if (typeof item !== 'object' || !item) return false;
  const keys = Object.keys(item).map(k => k.toLowerCase());
  const vehicleKeywords = ['vin', 'make', 'model', 'year', 'price', 'mileage', 'odometer', 'miles'];
  const matchCount = vehicleKeywords.filter(kw => keys.some(k => k.includes(kw))).length;
  return matchCount >= 2;
}

function resolveFields(obj: Record<string, unknown>): {
  vin: string; year: number; make: string; model: string; trim: string;
  price: number; mileage: number; exterior_color: string; interior_color: string;
  body_style: string; engine: string; transmission: string; drivetrain: string; fuel_type: string;
} {
  const get = (field: string): unknown => {
    const aliases = FIELD_MAP[field] || [field];
    for (const alias of aliases) {
      if (obj[alias] !== undefined && obj[alias] !== null && obj[alias] !== '') {
        return obj[alias];
      }
    }
    return undefined;
  };

  const str = (field: string): string => String(get(field) || '').trim();
  const num = (field: string): number => {
    const raw = get(field);
    if (typeof raw === 'number') return raw;
    if (typeof raw === 'string') return parseFloat(raw.replace(/[^0-9.]/g, '')) || 0;
    return 0;
  };

  return {
    vin: str('vin'),
    year: num('year'),
    make: str('make'),
    model: str('model'),
    trim: str('trim'),
    price: num('price'),
    mileage: num('mileage'),
    exterior_color: str('exterior_color'),
    interior_color: str('interior_color'),
    body_style: str('body_style'),
    engine: str('engine'),
    transmission: str('transmission'),
    drivetrain: str('drivetrain'),
    fuel_type: str('fuel_type'),
  };
}

function extractPhotos(obj: Record<string, unknown>, baseUrl: string): string[] {
  for (const key of FIELD_MAP.photos) {
    const val = obj[key];
    if (Array.isArray(val)) {
      return val.slice(0, 30).map(item => {
        const url = typeof item === 'string' ? item : (item as any)?.url || (item as any)?.src || '';
        if (!url) return '';
        try { return new URL(url, baseUrl).href; } catch { return url; }
      }).filter(Boolean);
    }
  }
  return [];
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scrapers/api-discovery.test.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/tiers/api-discovery.ts tests/scrapers/api-discovery.test.ts
git commit -m "feat: add Tier 3 hidden API discovery for dealer websites"
```

---

### Task 4: Cascade Orchestrator

**Files:**
- Create: `src/scrapers/cascade.ts`
- Create: `tests/scrapers/cascade.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/scrapers/cascade.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScrapedListing, ScraperResult } from '../../src/scrapers/base.js';

// We'll test the cascade logic by mocking each tier
const mockPlatformScrape = vi.fn<() => Promise<ScraperResult>>();
const mockStructuredData = vi.fn<() => ScraperResult>();
const mockApiDiscovery = vi.fn<() => Promise<ScraperResult>>();
const mockAiScrape = vi.fn<() => Promise<ScraperResult>>();

vi.mock('../../src/scrapers/tiers/structured-data.js', () => ({
  extractStructuredData: (...args: unknown[]) => mockStructuredData(),
}));

vi.mock('../../src/scrapers/tiers/api-discovery.js', () => ({
  discoverApiEndpoints: (...args: unknown[]) => mockApiDiscovery(),
}));

// Import after mocks
const { runCascade } = await import('../../src/scrapers/cascade.js');

const EMPTY_RESULT: ScraperResult = { success: false, listings: [], errors: ['No data'], duration_ms: 100 };
const makeListing = (tier: string, confidence: number): ScrapedListing => ({
  vin: '1HGBH41JXMN109186', source: 'https://dealer.com', source_id: 'test',
  year: 2021, make: 'Honda', model: 'Civic', trim: '', price: 19000, mileage: 30000,
  exterior_color: '', interior_color: '', body_style: '', engine: '', transmission: '',
  drivetrain: '', fuel_type: '', title_status: '', seller_type: 'dealer',
  seller_name: '', seller_phone: '', latitude: 0, longitude: 0,
  listing_url: 'https://dealer.com', photos: [], description: '',
  scrape_confidence: confidence, scrape_tier: tier,
});

describe('runCascade', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses structured data when platform scraper not available', async () => {
    mockStructuredData.mockReturnValue({
      success: true,
      listings: [makeListing('structured_data', 0.9)],
      errors: [],
      duration_ms: 50,
    });

    const result = await runCascade({
      url: 'https://unknown-dealer.com',
      html: '<html></html>',
      platform: null,
      dealerId: 1,
    });

    expect(result.success).toBe(true);
    expect(result.tier_used).toBe('structured_data');
    expect(result.listings[0].scrape_tier).toBe('structured_data');
  });

  it('falls through to AI when all other tiers fail', async () => {
    mockStructuredData.mockReturnValue(EMPTY_RESULT);
    mockApiDiscovery.mockResolvedValue(EMPTY_RESULT);

    const result = await runCascade({
      url: 'https://unknown-dealer.com',
      html: '<html><body>Cars here</body></html>',
      platform: null,
      dealerId: 1,
    });

    // AI tier will be attempted (may fail in test since no Gemini key)
    expect(result.tiers_attempted).toContain('structured_data');
    expect(result.tiers_attempted).toContain('api_discovery');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/scrapers/cascade.test.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cascade orchestrator**

```typescript
// src/scrapers/cascade.ts
import { ScrapedListing, ScraperResult } from './base.js';
import { extractStructuredData } from './tiers/structured-data.js';
import { discoverApiEndpoints } from './tiers/api-discovery.js';
import { GenericAiScraper } from './platforms/generic-ai.js';
import { DealerComScraper } from './platforms/dealer-com.js';
import { FrazerScraper } from './platforms/frazer.js';
import { logger } from '../logger.js';

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

// Map platform names to scraper classes
const PLATFORM_SCRAPERS: Record<string, { scrape(url: string): Promise<ScraperResult> }> = {};

function getPlatformScraper(platform: string): { scrape(url: string): Promise<ScraperResult> } | null {
  switch (platform) {
    case 'dealer_com': return new DealerComScraper();
    case 'frazer': return new FrazerScraper();
    // Add more as implemented:
    // case 'dealeron': return new DealerOnScraper();
    // case 'dealersocket': return new DealerSocketScraper();
    default: return null;
  }
}

export async function runCascade(input: CascadeInput): Promise<CascadeResult> {
  const start = Date.now();
  const tiersAttempted: string[] = [];
  const allErrors: string[] = [];

  // Tier 1: Platform-specific scraper
  if (input.platform) {
    const scraper = getPlatformScraper(input.platform);
    if (scraper) {
      tiersAttempted.push('platform');
      try {
        const result = await scraper.scrape(input.url);
        if (result.success && result.listings.length > 0) {
          logger.info({ dealerId: input.dealerId, tier: 'platform', platform: input.platform, count: result.listings.length }, 'Cascade: platform scraper succeeded');
          return {
            ...result,
            tier_used: 'platform',
            tiers_attempted: tiersAttempted,
            duration_ms: Date.now() - start,
          };
        }
        allErrors.push(...result.errors);
      } catch (err) {
        allErrors.push(`Platform scraper error: ${(err as Error).message}`);
      }
    }
  }

  // Tier 2: Structured data (JSON-LD, Schema.org)
  tiersAttempted.push('structured_data');
  try {
    const result = extractStructuredData(input.html, input.url);
    if (result.success && result.listings.length > 0) {
      logger.info({ dealerId: input.dealerId, tier: 'structured_data', count: result.listings.length }, 'Cascade: structured data succeeded');
      return {
        ...result,
        tier_used: 'structured_data',
        tiers_attempted: tiersAttempted,
        duration_ms: Date.now() - start,
      };
    }
    allErrors.push(...result.errors);
  } catch (err) {
    allErrors.push(`Structured data error: ${(err as Error).message}`);
  }

  // Tier 3: Hidden API discovery
  tiersAttempted.push('api_discovery');
  try {
    const result = await discoverApiEndpoints(input.url, input.html);
    if (result.success && result.listings.length > 0) {
      logger.info({ dealerId: input.dealerId, tier: 'api_discovery', count: result.listings.length }, 'Cascade: API discovery succeeded');
      return {
        ...result,
        tier_used: 'api_discovery',
        tiers_attempted: tiersAttempted,
        duration_ms: Date.now() - start,
      };
    }
    allErrors.push(...result.errors);
  } catch (err) {
    allErrors.push(`API discovery error: ${(err as Error).message}`);
  }

  // Tier 4: AI extraction (Gemini)
  tiersAttempted.push('ai_extraction');
  try {
    const aiScraper = new GenericAiScraper();
    const result = await aiScraper.scrape(input.url);
    if (result.success && result.listings.length > 0) {
      logger.info({ dealerId: input.dealerId, tier: 'ai_extraction', count: result.listings.length }, 'Cascade: AI extraction succeeded');
      return {
        ...result,
        tier_used: 'ai_extraction',
        tiers_attempted: tiersAttempted,
        duration_ms: Date.now() - start,
      };
    }
    allErrors.push(...result.errors);
  } catch (err) {
    allErrors.push(`AI extraction error: ${(err as Error).message}`);
  }

  // All tiers failed
  logger.warn({ dealerId: input.dealerId, tiers: tiersAttempted, errors: allErrors }, 'Cascade: all tiers failed');
  return {
    success: false,
    listings: [],
    errors: allErrors,
    duration_ms: Date.now() - start,
    tier_used: 'none',
    tiers_attempted: tiersAttempted,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scrapers/cascade.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/cascade.ts tests/scrapers/cascade.test.ts
git commit -m "feat: add 4-tier scraper cascade orchestrator"
```

---

### Task 5: Expand Platform Detection to 20+ Platforms

**Files:**
- Modify: `src/scrapers/detector.ts`

- [ ] **Step 1: Read current detector.ts and add new platform signatures**

Add these platform signatures to the `PLATFORM_SIGNATURES` array in `src/scrapers/detector.ts`:

```typescript
  // Existing 11 platforms stay as-is. Add these:
  {
    name: 'dealeron',
    signatures: ['dealeron.com', 'cdn.dealeron.com', 'DealerOn'],
    inventoryPatterns: ['/used-vehicles', '/used-cars', '/inventory'],
    confidence: 0.90,
    scraperType: 'dealeron' as const,
  },
  {
    name: 'dealer_eprocess',
    signatures: ['eprocess', 'dealereprocess.com', 'ep-widget'],
    inventoryPatterns: ['/inventory/used', '/used-vehicles'],
    confidence: 0.85,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'dealer_center_pro',
    signatures: ['dealercenterpro', 'dcpweb.com', 'DealerCenter'],
    inventoryPatterns: ['/inventory', '/vehicles'],
    confidence: 0.85,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'vericom',
    signatures: ['vericom.net', 'vericomvdp'],
    inventoryPatterns: ['/inventory', '/our-inventory'],
    confidence: 0.80,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'homenet_iol',
    signatures: ['homenetiol', 'homenet.com', 'iol.io'],
    inventoryPatterns: ['/all-inventory', '/inventory'],
    confidence: 0.85,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'lotlinx',
    signatures: ['lotlinx.com', 'lotlinx'],
    inventoryPatterns: ['/inventory'],
    confidence: 0.80,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'wordpress_dealer',
    signatures: ['wp-content', 'wp-json', 'wordpress', 'developer/developer-developer'],
    inventoryPatterns: ['/inventory', '/vehicles', '/used-cars'],
    confidence: 0.70,
    scraperType: 'wordpress_dealer' as const,
  },
  {
    name: 'shopify_dealer',
    signatures: ['cdn.shopify.com', 'Shopify.theme', 'myshopify.com'],
    inventoryPatterns: ['/collections', '/pages/inventory'],
    confidence: 0.70,
    scraperType: 'ai_generic' as const,
  },
  {
    name: 'wix_dealer',
    signatures: ['wix.com', 'wixsite.com', 'static.wixstatic.com'],
    inventoryPatterns: ['/inventory', '/used-cars'],
    confidence: 0.65,
    scraperType: 'ai_generic' as const,
  },
```

- [ ] **Step 2: Verify detection still works**

```bash
npx vitest run tests/ --reporter verbose 2>&1 | head -50
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/detector.ts
git commit -m "feat: expand platform detection from 11 to 20+ platforms"
```

---

## Phase 2: Dealer Onboarding & Health Monitoring

### Task 6: Dealer Auto-Discovery & Test Scrape

**Files:**
- Create: `src/scrapers/onboard.ts`
- Create: `tests/scrapers/onboard.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/scrapers/onboard.test.ts
import { describe, it, expect, vi } from 'vitest';
import { analyzeDiscoveryResult } from '../../src/scrapers/onboard.js';

describe('analyzeDiscoveryResult', () => {
  it('assigns high priority for 50+ vehicles', () => {
    const result = analyzeDiscoveryResult({
      listingsFound: 60,
      platform: 'dealer_com',
      confidence: 0.95,
      inventoryUrl: 'https://dealer.com/inventory',
      totalPages: 3,
    });
    expect(result.priority).toBe('high');
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(6);
  });

  it('assigns medium priority for 10-49 vehicles', () => {
    const result = analyzeDiscoveryResult({
      listingsFound: 25,
      platform: 'frazer',
      confidence: 0.9,
      inventoryUrl: 'https://dealer.com/inventory',
      totalPages: 1,
    });
    expect(result.priority).toBe('medium');
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(12);
  });

  it('assigns low priority for <10 vehicles', () => {
    const result = analyzeDiscoveryResult({
      listingsFound: 5,
      platform: 'ai_generic',
      confidence: 0.7,
      inventoryUrl: 'https://smalldealer.com',
      totalPages: 1,
    });
    expect(result.priority).toBe('low');
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(24);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/scrapers/onboard.test.ts
```

- [ ] **Step 3: Implement onboard.ts**

```typescript
// src/scrapers/onboard.ts
import * as cheerio from 'cheerio';
import { detectPlatform } from './detector.js';
import { runCascade, CascadeResult } from './cascade.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface DiscoveryInput {
  listingsFound: number;
  platform: string;
  confidence: number;
  inventoryUrl: string;
  totalPages: number;
}

export interface DiscoveryResult {
  priority: 'critical' | 'high' | 'medium' | 'low';
  scrapeIntervalHours: number;
}

export function analyzeDiscoveryResult(input: DiscoveryInput): DiscoveryResult {
  if (input.listingsFound >= 50) {
    return { priority: 'high', scrapeIntervalHours: 6 };
  } else if (input.listingsFound >= 10) {
    return { priority: 'medium', scrapeIntervalHours: 12 };
  } else {
    return { priority: 'low', scrapeIntervalHours: 24 };
  }
}

export interface OnboardResult {
  success: boolean;
  platform: string | null;
  platformConfidence: number;
  inventoryUrl: string;
  listingsFound: number;
  sampleListings: Array<{ year: number; make: string; model: string; price: number }>;
  totalPages: number;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  scrapeIntervalHours: number;
  tierUsed: string;
  errors: string[];
  dealerMeta: {
    phone: string;
    address: string;
  };
}

const INVENTORY_LINK_PATTERNS = [
  /inventory/i, /used[-\s]?cars/i, /pre[-\s]?owned/i, /vehicles/i,
  /our[-\s]?cars/i, /browse/i, /search/i, /stock/i,
];

export async function onboardDealer(
  websiteUrl: string,
  dealerName: string
): Promise<OnboardResult> {
  const errors: string[] = [];

  // Step 1: Fetch homepage
  let html: string;
  try {
    const resp = await fetch(websiteUrl, {
      headers: { 'User-Agent': config.userAgent },
      signal: AbortSignal.timeout(15_000),
    });
    html = await resp.text();
  } catch (err) {
    return {
      success: false, platform: null, platformConfidence: 0,
      inventoryUrl: websiteUrl, listingsFound: 0, sampleListings: [],
      totalPages: 0, suggestedPriority: 'low', scrapeIntervalHours: 24,
      tierUsed: 'none', errors: [`Failed to fetch: ${(err as Error).message}`],
      dealerMeta: { phone: '', address: '' },
    };
  }

  // Step 2: Detect platform
  const detection = detectPlatform(html, websiteUrl);
  const platform = detection?.platform || null;
  const platformConfidence = detection?.confidence || 0;

  // Step 3: Find inventory URL
  let inventoryUrl = detection?.inventoryUrl || websiteUrl;
  if (inventoryUrl === websiteUrl) {
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const text = $(el).text();
      const fullHref = href + ' ' + text;
      if (INVENTORY_LINK_PATTERNS.some(p => p.test(fullHref))) {
        try {
          inventoryUrl = new URL(href, websiteUrl).href;
          return false; // break
        } catch { /* skip */ }
      }
    });
  }

  // Step 4: Extract dealer metadata
  const $ = cheerio.load(html);
  const phone = extractPhone($);
  const address = extractAddress($);

  // Step 5: Fetch inventory page if different from homepage
  let inventoryHtml = html;
  if (inventoryUrl !== websiteUrl) {
    try {
      const resp = await fetch(inventoryUrl, {
        headers: { 'User-Agent': config.userAgent },
        signal: AbortSignal.timeout(15_000),
      });
      inventoryHtml = await resp.text();
    } catch {
      errors.push('Could not fetch inventory URL, using homepage');
      inventoryUrl = websiteUrl;
    }
  }

  // Step 6: Run cascade on inventory page
  const cascadeResult = await runCascade({
    url: inventoryUrl,
    html: inventoryHtml,
    platform,
    dealerId: 0, // temporary — real ID assigned after insert
  });

  // Step 7: Analyze results
  const analysis = analyzeDiscoveryResult({
    listingsFound: cascadeResult.listings.length,
    platform: platform || 'unknown',
    confidence: platformConfidence,
    inventoryUrl,
    totalPages: 1, // TODO: pagination discovery
  });

  const sampleListings = cascadeResult.listings.slice(0, 5).map(l => ({
    year: l.year, make: l.make, model: l.model, price: l.price,
  }));

  return {
    success: cascadeResult.success,
    platform,
    platformConfidence,
    inventoryUrl,
    listingsFound: cascadeResult.listings.length,
    sampleListings,
    totalPages: 1,
    suggestedPriority: analysis.priority,
    scrapeIntervalHours: analysis.scrapeIntervalHours,
    tierUsed: cascadeResult.tier_used,
    errors: [...errors, ...cascadeResult.errors],
    dealerMeta: { phone, address },
  };
}

function extractPhone($: cheerio.CheerioAPI): string {
  // Look for tel: links
  const telLink = $('a[href^="tel:"]').first().attr('href');
  if (telLink) return telLink.replace('tel:', '').trim();

  // Look for phone patterns in text
  const bodyText = $('body').text();
  const phoneMatch = bodyText.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  return phoneMatch ? phoneMatch[0] : '';
}

function extractAddress($: cheerio.CheerioAPI): string {
  // Look for Schema.org address
  const schemaAddr = $('[itemprop="streetAddress"]').text().trim();
  if (schemaAddr) {
    const city = $('[itemprop="addressLocality"]').text().trim();
    const state = $('[itemprop="addressRegion"]').text().trim();
    return `${schemaAddr}, ${city}, ${state}`.replace(/,\s*,/g, ',').trim();
  }

  // Look for address in footer
  const footerText = $('footer').text();
  const addrMatch = footerText.match(/\d+\s+\w+.*(?:St|Ave|Blvd|Rd|Dr|Hwy|Lane|Ln|Way).*\d{5}/i);
  return addrMatch ? addrMatch[0].trim() : '';
}

export async function bulkOnboard(
  dealers: Array<{ url: string; name: string; city?: string }>,
  concurrency = 3
): Promise<Array<{ dealer: string; result: OnboardResult }>> {
  const results: Array<{ dealer: string; result: OnboardResult }> = [];
  const queue = [...dealers];

  const worker = async () => {
    while (queue.length > 0) {
      const dealer = queue.shift()!;
      logger.info({ dealer: dealer.name, url: dealer.url }, 'Onboarding dealer');
      const result = await onboardDealer(dealer.url, dealer.name);
      results.push({ dealer: dealer.name, result });
    }
  };

  const workers = Array.from({ length: Math.min(concurrency, dealers.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/scrapers/onboard.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/scrapers/onboard.ts tests/scrapers/onboard.test.ts
git commit -m "feat: add dealer auto-discovery and test scrape onboarding"
```

---

### Task 7: Health State Machine & Self-Healing

**Files:**
- Create: `src/scrapers/health.ts`
- Create: `tests/scrapers/health.test.ts`
- Modify: `src/db/schema.ts` — add health columns to dealers table
- Modify: `src/db/queries.ts` — add health query functions

- [ ] **Step 1: Write tests**

```typescript
// tests/scrapers/health.test.ts
import { describe, it, expect } from 'vitest';
import { DealerHealthTracker, HealthState } from '../../src/scrapers/health.js';

describe('DealerHealthTracker', () => {
  it('starts as healthy', () => {
    const tracker = new DealerHealthTracker();
    expect(tracker.getState({ consecutiveFailures: 0, lastSuccessAt: new Date().toISOString() })).toBe('healthy');
  });

  it('moves to degraded after 1-2 failures', () => {
    const tracker = new DealerHealthTracker();
    expect(tracker.getState({ consecutiveFailures: 1, lastSuccessAt: new Date().toISOString() })).toBe('degraded');
    expect(tracker.getState({ consecutiveFailures: 2, lastSuccessAt: new Date().toISOString() })).toBe('degraded');
  });

  it('moves to failing after 3+ failures', () => {
    const tracker = new DealerHealthTracker();
    expect(tracker.getState({ consecutiveFailures: 3, lastSuccessAt: new Date().toISOString() })).toBe('failing');
    expect(tracker.getState({ consecutiveFailures: 5, lastSuccessAt: new Date().toISOString() })).toBe('failing');
  });

  it('moves to dead after 48 hours without success', () => {
    const tracker = new DealerHealthTracker();
    const twoDaysAgo = new Date(Date.now() - 49 * 60 * 60 * 1000).toISOString();
    expect(tracker.getState({ consecutiveFailures: 5, lastSuccessAt: twoDaysAgo })).toBe('dead');
  });

  it('suggests tier escalation when degraded', () => {
    const tracker = new DealerHealthTracker();
    const suggestion = tracker.getScrapeStrategy({
      healthState: 'degraded',
      currentTier: 'platform',
      consecutiveFailures: 2,
    });
    expect(suggestion.skipToTier).toBe('structured_data');
  });

  it('suggests AI-only when failing', () => {
    const tracker = new DealerHealthTracker();
    const suggestion = tracker.getScrapeStrategy({
      healthState: 'failing',
      currentTier: 'platform',
      consecutiveFailures: 4,
    });
    expect(suggestion.skipToTier).toBe('ai_extraction');
    expect(suggestion.reduceFrequency).toBe(true);
  });

  it('suggests pause when dead', () => {
    const tracker = new DealerHealthTracker();
    const suggestion = tracker.getScrapeStrategy({
      healthState: 'dead',
      currentTier: 'platform',
      consecutiveFailures: 10,
    });
    expect(suggestion.pause).toBe(true);
    expect(suggestion.alert).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/scrapers/health.test.ts
```

- [ ] **Step 3: Implement health.ts**

```typescript
// src/scrapers/health.ts
import { logger } from '../logger.js';

export type HealthState = 'healthy' | 'degraded' | 'failing' | 'dead';

const TIERS_IN_ORDER = ['platform', 'structured_data', 'api_discovery', 'ai_extraction'];
const DEAD_THRESHOLD_MS = 48 * 60 * 60 * 1000; // 48 hours

interface HealthInput {
  consecutiveFailures: number;
  lastSuccessAt: string | null;
}

interface StrategyInput {
  healthState: HealthState;
  currentTier: string;
  consecutiveFailures: number;
}

interface ScrapeStrategy {
  skipToTier: string | null;
  reduceFrequency: boolean;
  pause: boolean;
  alert: boolean;
}

export class DealerHealthTracker {
  getState(input: HealthInput): HealthState {
    const { consecutiveFailures, lastSuccessAt } = input;

    // Check if dead (48+ hours since last success)
    if (lastSuccessAt && consecutiveFailures >= 3) {
      const lastSuccess = new Date(lastSuccessAt).getTime();
      const elapsed = Date.now() - lastSuccess;
      if (elapsed > DEAD_THRESHOLD_MS) return 'dead';
    }

    if (consecutiveFailures === 0) return 'healthy';
    if (consecutiveFailures <= 2) return 'degraded';
    return 'failing';
  }

  getScrapeStrategy(input: StrategyInput): ScrapeStrategy {
    switch (input.healthState) {
      case 'healthy':
        return { skipToTier: null, reduceFrequency: false, pause: false, alert: false };

      case 'degraded': {
        // Escalate to next tier
        const currentIndex = TIERS_IN_ORDER.indexOf(input.currentTier);
        const nextTier = currentIndex >= 0 && currentIndex < TIERS_IN_ORDER.length - 1
          ? TIERS_IN_ORDER[currentIndex + 1]
          : null;
        return { skipToTier: nextTier, reduceFrequency: false, pause: false, alert: false };
      }

      case 'failing':
        return { skipToTier: 'ai_extraction', reduceFrequency: true, pause: false, alert: false };

      case 'dead':
        return { skipToTier: null, reduceFrequency: false, pause: true, alert: true };
    }
  }

  detectSuddenDrop(previousCount: number, currentCount: number): boolean {
    if (previousCount <= 0) return false;
    const dropPercent = (previousCount - currentCount) / previousCount;
    return currentCount === 0 || dropPercent > 0.8;
  }
}
```

- [ ] **Step 4: Add health columns to database schema**

In `src/db/schema.ts`, add to the `dealers` CREATE TABLE:

```sql
health_state TEXT DEFAULT 'healthy',
consecutive_failures INTEGER DEFAULT 0,
last_success_at TEXT,
last_tier_used TEXT,
last_listing_count INTEGER DEFAULT 0,
```

- [ ] **Step 5: Add health query functions to queries.ts**

Add these functions to `src/db/queries.ts`:

```typescript
export function updateDealerHealth(
  id: number,
  healthState: string,
  consecutiveFailures: number,
  lastTierUsed: string,
  lastListingCount: number
): void {
  const stmt = db().prepare(`
    UPDATE dealers SET
      health_state = ?,
      consecutive_failures = ?,
      last_tier_used = ?,
      last_listing_count = ?,
      last_success_at = CASE WHEN ? = 'healthy' THEN datetime('now') ELSE last_success_at END,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  stmt.run([healthState, consecutiveFailures, lastTierUsed, lastListingCount, healthState, id]);
  stmt.free();
}

export function getDealerHealth(id: number): {
  health_state: string;
  consecutive_failures: number;
  last_success_at: string | null;
  last_tier_used: string | null;
  last_listing_count: number;
} | undefined {
  const stmt = db().prepare(
    'SELECT health_state, consecutive_failures, last_success_at, last_tier_used, last_listing_count FROM dealers WHERE id = ?'
  );
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return {
      health_state: String(row.health_state || 'healthy'),
      consecutive_failures: Number(row.consecutive_failures || 0),
      last_success_at: row.last_success_at ? String(row.last_success_at) : null,
      last_tier_used: row.last_tier_used ? String(row.last_tier_used) : null,
      last_listing_count: Number(row.last_listing_count || 0),
    };
  }
  stmt.free();
  return undefined;
}

export function getDealersNeedingAlert(): Array<{
  id: number; name: string; website: string; health_state: string;
  consecutive_failures: number; last_success_at: string;
}> {
  const stmt = db().prepare(`
    SELECT id, name, website, health_state, consecutive_failures, last_success_at
    FROM dealers WHERE health_state = 'dead' AND is_active = 1
  `);
  const results: Array<any> = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

export function getAllDealerHealthStatuses(): Array<{
  id: number; name: string; website: string; health_state: string;
  consecutive_failures: number; last_success_at: string | null;
  last_tier_used: string | null; last_listing_count: number;
  scrape_success_rate: number; priority: string;
}> {
  const stmt = db().prepare(`
    SELECT id, name, website, health_state, consecutive_failures,
           last_success_at, last_tier_used, last_listing_count,
           scrape_success_rate, priority
    FROM dealers WHERE is_active = 1
    ORDER BY
      CASE health_state
        WHEN 'dead' THEN 0
        WHEN 'failing' THEN 1
        WHEN 'degraded' THEN 2
        WHEN 'healthy' THEN 3
      END,
      name ASC
  `);
  const results: Array<any> = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push({
      ...row,
      last_success_at: row.last_success_at ? String(row.last_success_at) : null,
      last_tier_used: row.last_tier_used ? String(row.last_tier_used) : null,
    });
  }
  stmt.free();
  return results;
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run tests/scrapers/health.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/scrapers/health.ts tests/scrapers/health.test.ts src/db/schema.ts src/db/queries.ts
git commit -m "feat: add dealer health state machine with self-healing and tier escalation"
```

---

### Task 8: Wire Health Tracking into Scraper Manager

**Files:**
- Modify: `src/scrapers/manager.ts`

- [ ] **Step 1: Import health tracker and cascade in manager.ts**

At the top of `src/scrapers/manager.ts`, add:

```typescript
import { DealerHealthTracker, HealthState } from './health.js';
import { runCascade } from './cascade.js';
import { updateDealerHealth, getDealerHealth } from '../db/queries.js';
```

- [ ] **Step 2: Add health check to scrapeDealer method**

In the `scrapeDealer` method, after a scrape completes (success or failure), add health tracking:

```typescript
  // After scrape result is obtained:
  const healthTracker = new DealerHealthTracker();
  const currentHealth = getDealerHealth(dealer.id);

  if (result.success && result.listings.length > 0) {
    // Check for sudden drop (possible site redesign)
    if (currentHealth && healthTracker.detectSuddenDrop(currentHealth.last_listing_count, result.listings.length)) {
      logger.warn({
        dealerId: dealer.id,
        previousCount: currentHealth.last_listing_count,
        currentCount: result.listings.length,
      }, 'Sudden listing count drop detected — possible site redesign');
    }

    updateDealerHealth(dealer.id, 'healthy', 0, result.tier_used || 'platform', result.listings.length);
  } else {
    const failures = (currentHealth?.consecutive_failures || 0) + 1;
    const state = healthTracker.getState({
      consecutiveFailures: failures,
      lastSuccessAt: currentHealth?.last_success_at || null,
    });
    updateDealerHealth(dealer.id, state, failures, currentHealth?.last_tier_used || 'unknown', currentHealth?.last_listing_count || 0);

    if (state === 'dead') {
      logger.error({ dealerId: dealer.id, name: dealer.name }, 'Dealer marked as DEAD — alerting user');
      // Alert will be sent by the scheduler check
    }
  }
```

- [ ] **Step 3: Commit**

```bash
git add src/scrapers/manager.ts
git commit -m "feat: wire health tracking into scraper manager with drop detection"
```

---

## Phase 3: Enrichment Pipeline Overhaul

### Task 9: NHTSA Result Cache

**Files:**
- Create: `src/enrichment/cache.ts`
- Create: `tests/enrichment/cache.test.ts`
- Modify: `src/db/schema.ts` — add cache table

- [ ] **Step 1: Add cache table to schema**

In `src/db/schema.ts`, add this CREATE TABLE:

```sql
CREATE TABLE IF NOT EXISTS nhtsa_cache (
  cache_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fetched_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
```

- [ ] **Step 2: Write tests**

```typescript
// tests/enrichment/cache.test.ts
import { describe, it, expect } from 'vitest';
import { NHTSACache } from '../../src/enrichment/cache.js';

describe('NHTSACache', () => {
  it('generates correct cache key', () => {
    const cache = new NHTSACache();
    expect(cache.makeKey('recalls', 'Toyota', 'Camry', 2020)).toBe('recalls:toyota:camry:2020');
  });

  it('returns null for cache miss', () => {
    const cache = new NHTSACache();
    const result = cache.get('recalls:nonexistent:car:2020');
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure**

```bash
npx vitest run tests/enrichment/cache.test.ts
```

- [ ] **Step 4: Implement cache.ts**

```typescript
// src/enrichment/cache.ts
import { db } from '../db/database.js';
import { logger } from '../logger.js';

const CACHE_TTL_DAYS = 30; // NHTSA data doesn't change often

export class NHTSACache {
  makeKey(type: string, make: string, model: string, year: number): string {
    return `${type}:${make.toLowerCase()}:${model.toLowerCase()}:${year}`;
  }

  get(key: string): unknown | null {
    try {
      const stmt = db().prepare(
        'SELECT data, expires_at FROM nhtsa_cache WHERE cache_key = ?'
      );
      stmt.bind([key]);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        const expiresAt = new Date(String(row.expires_at));
        if (expiresAt > new Date()) {
          return JSON.parse(String(row.data));
        }
        // Expired — delete and return null
        this.delete(key);
        return null;
      }
      stmt.free();
      return null;
    } catch (err) {
      logger.error({ err, key }, 'Cache read error');
      return null;
    }
  }

  set(key: string, data: unknown): void {
    try {
      const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const stmt = db().prepare(
        'INSERT OR REPLACE INTO nhtsa_cache (cache_key, data, expires_at) VALUES (?, ?, ?)'
      );
      stmt.run([key, JSON.stringify(data), expiresAt]);
      stmt.free();
    } catch (err) {
      logger.error({ err, key }, 'Cache write error');
    }
  }

  delete(key: string): void {
    try {
      const stmt = db().prepare('DELETE FROM nhtsa_cache WHERE cache_key = ?');
      stmt.run([key]);
      stmt.free();
    } catch (err) {
      logger.error({ err, key }, 'Cache delete error');
    }
  }
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run tests/enrichment/cache.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add src/enrichment/cache.ts tests/enrichment/cache.test.ts src/db/schema.ts
git commit -m "feat: add NHTSA result cache with 30-day TTL"
```

---

### Task 10: Market Value Lookup Module

**Files:**
- Create: `src/enrichment/market-value.ts`
- Create: `tests/enrichment/market-value.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/enrichment/market-value.test.ts
import { describe, it, expect, vi } from 'vitest';
import { computeFallbackMarketValue } from '../../src/enrichment/market-value.js';

describe('computeFallbackMarketValue', () => {
  it('returns average of benchmark prices when available', () => {
    const benchmarks = [
      { price: 20000, source: 'carvana' },
      { price: 21000, source: 'carmax' },
    ];
    const result = computeFallbackMarketValue(benchmarks);
    expect(result).toBe(20500);
  });

  it('returns 0 when no benchmarks', () => {
    expect(computeFallbackMarketValue([])).toBe(0);
  });

  it('excludes outliers (>2x median)', () => {
    const benchmarks = [
      { price: 20000, source: 'carvana' },
      { price: 21000, source: 'carmax' },
      { price: 60000, source: 'outlier' }, // way too high
    ];
    const result = computeFallbackMarketValue(benchmarks);
    // Should exclude 60k outlier, average of 20k and 21k
    expect(result).toBe(20500);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/enrichment/market-value.test.ts
```

- [ ] **Step 3: Implement market-value.ts**

```typescript
// src/enrichment/market-value.ts
import { getPricePrediction } from '../scrapers/marketcheck.js';
import { logger } from '../logger.js';

interface BenchmarkPrice {
  price: number;
  source: string;
}

export async function lookupMarketValue(
  vin: string,
  make: string,
  model: string,
  year: number,
  mileage: number
): Promise<{ marketValue: number; source: string }> {
  // Strategy 1: MarketCheck VIN-specific prediction
  if (vin) {
    try {
      const prediction = await getPricePrediction(vin, year, make, model, mileage);
      if (prediction && prediction.price > 0) {
        return { marketValue: prediction.price, source: 'marketcheck_vin' };
      }
    } catch (err) {
      logger.debug({ err, vin }, 'MarketCheck VIN prediction failed, trying fallback');
    }
  }

  // Strategy 2: MarketCheck comparable search (no VIN needed)
  try {
    const prediction = await getPricePrediction('', year, make, model, mileage);
    if (prediction && prediction.price > 0) {
      return { marketValue: prediction.price, source: 'marketcheck_comparable' };
    }
  } catch (err) {
    logger.debug({ err, make, model, year }, 'MarketCheck comparable failed');
  }

  // Strategy 3: No market value available
  return { marketValue: 0, source: 'none' };
}

export function computeFallbackMarketValue(benchmarks: BenchmarkPrice[]): number {
  if (benchmarks.length === 0) return 0;

  // Sort prices
  const sorted = benchmarks.map(b => b.price).sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  // Exclude outliers (>2x median)
  const filtered = sorted.filter(p => p <= median * 2);
  if (filtered.length === 0) return 0;

  return Math.round(filtered.reduce((sum, p) => sum + p, 0) / filtered.length);
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/enrichment/market-value.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/market-value.ts tests/enrichment/market-value.test.ts
git commit -m "feat: add market value lookup with MarketCheck + fallback"
```

---

### Task 11: Alert Check Module

**Files:**
- Create: `src/enrichment/alert-check.ts`
- Create: `tests/enrichment/alert-check.test.ts`

- [ ] **Step 1: Write tests**

```typescript
// tests/enrichment/alert-check.test.ts
import { describe, it, expect } from 'vitest';
import { shouldFireAlert, AlertType } from '../../src/enrichment/alert-check.js';

describe('shouldFireAlert', () => {
  it('fires STEAL alert for value_rating STEAL', () => {
    const alerts = shouldFireAlert({
      value_rating: 'STEAL',
      deal_score: 30,
      price: 15000,
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
    });
    expect(alerts).toContain('steal');
  });

  it('fires GREAT alert for value_rating GREAT', () => {
    const alerts = shouldFireAlert({
      value_rating: 'GREAT',
      deal_score: 18,
      price: 16000,
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
    });
    expect(alerts).toContain('great_deal');
  });

  it('returns empty for FAIR rating', () => {
    const alerts = shouldFireAlert({
      value_rating: 'FAIR',
      deal_score: 2,
      price: 20000,
      year: 2019,
      make: 'Toyota',
      model: 'Camry',
    });
    expect(alerts).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run tests/enrichment/alert-check.test.ts
```

- [ ] **Step 3: Implement alert-check.ts**

```typescript
// src/enrichment/alert-check.ts
import { sendDiscordAlert, formatListingEmbed } from '../notifications/discord.js';
import { logger } from '../logger.js';

export type AlertType = 'steal' | 'great_deal' | 'price_drop';

interface AlertInput {
  value_rating: string;
  deal_score: number;
  price: number;
  year: number;
  make: string;
  model: string;
  listing_url?: string;
  id?: string;
}

export function shouldFireAlert(input: AlertInput): AlertType[] {
  const alerts: AlertType[] = [];

  if (input.value_rating === 'STEAL') {
    alerts.push('steal');
  } else if (input.value_rating === 'GREAT') {
    alerts.push('great_deal');
  }

  return alerts;
}

export async function fireAlerts(input: AlertInput): Promise<void> {
  const alerts = shouldFireAlert(input);
  if (alerts.length === 0) return;

  for (const alertType of alerts) {
    try {
      const emoji = alertType === 'steal' ? '🔥' : '⭐';
      const title = alertType === 'steal'
        ? `STEAL ALERT: ${input.year} ${input.make} ${input.model}`
        : `GREAT DEAL: ${input.year} ${input.make} ${input.model}`;

      await sendDiscordAlert(
        `${emoji} **${title}** — $${input.price.toLocaleString()} (${input.deal_score}% below market)`,
        []
      );

      logger.info({ alertType, make: input.make, model: input.model, price: input.price }, 'Alert fired');
    } catch (err) {
      logger.error({ err, alertType }, 'Failed to fire alert');
    }
  }
}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run tests/enrichment/alert-check.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/alert-check.ts tests/enrichment/alert-check.test.ts
git commit -m "feat: add post-enrichment STEAL/GREAT alert system"
```

---

### Task 12: Overhaul the Enrichment Pipeline

**Files:**
- Modify: `src/enrichment/pipeline.ts`

This is the critical wiring task — connecting all enrichment modules end-to-end.

- [ ] **Step 1: Add new imports at top of pipeline.ts**

```typescript
import { lookupMarketValue } from './market-value.js';
import { fetchRecalls } from './recalls.js';
import { fetchComplaints } from './complaints.js';
import { fetchSafetyRatings } from './safety-ratings.js';
import { NHTSACache } from './cache.js';
import { fireAlerts } from './alert-check.js';
```

- [ ] **Step 2: Create the NHTSA cache instance**

After imports, add:

```typescript
const nhtsaCache = new NHTSACache();
```

- [ ] **Step 3: Add market value lookup to the pipeline**

In the `processListing` function, after the deal-rater section, add:

```typescript
  // Market Value Lookup
  if (normalized.make && normalized.model && normalized.year) {
    try {
      const { marketValue, source } = await lookupMarketValue(
        normalized.vin || '',
        normalized.make,
        normalized.model,
        normalized.year,
        normalized.mileage || 0
      );
      if (marketValue > 0) {
        enriched.market_value = marketValue;
        enriched.market_value_source = source;
      }
    } catch (err) {
      logger.debug({ err }, 'Market value lookup failed');
    }
  }
```

- [ ] **Step 4: Add NHTSA auto-enrichment with caching**

After market value, add:

```typescript
  // NHTSA Auto-Enrichment (cached)
  if (normalized.make && normalized.model && normalized.year) {
    const make = normalized.make;
    const model = normalized.model;
    const year = normalized.year;

    // Recalls
    const recallKey = nhtsaCache.makeKey('recalls', make, model, year);
    let recalls = nhtsaCache.get(recallKey) as { count: number; items: unknown[] } | null;
    if (!recalls) {
      try {
        recalls = await fetchRecalls(make, model, year);
        nhtsaCache.set(recallKey, recalls);
      } catch { /* non-blocking */ }
    }
    if (recalls) {
      enriched.recall_count = recalls.count;
    }

    // Complaints
    const complaintKey = nhtsaCache.makeKey('complaints', make, model, year);
    let complaints = nhtsaCache.get(complaintKey) as { count: number; items: unknown[] } | null;
    if (!complaints) {
      try {
        complaints = await fetchComplaints(make, model, year);
        nhtsaCache.set(complaintKey, complaints);
      } catch { /* non-blocking */ }
    }
    if (complaints) {
      enriched.complaint_count = complaints.count;
    }

    // Safety Ratings
    const safetyKey = nhtsaCache.makeKey('safety', make, model, year);
    let safety = nhtsaCache.get(safetyKey) as { overall_rating: number } | null;
    if (!safety) {
      try {
        safety = await fetchSafetyRatings(make, model, year);
        nhtsaCache.set(safetyKey, safety);
      } catch { /* non-blocking */ }
    }
    if (safety && (safety as any).found) {
      enriched.safety_rating_overall = (safety as any).overallRating;
    }
  }
```

- [ ] **Step 5: Add VIN decode on ingest (not on-demand)**

Move the VIN decode from the optional/on-demand section to the main pipeline flow, before market value:

```typescript
  // VIN Decode on ingest
  if (normalized.vin && normalized.vin.length === 17) {
    try {
      const decoded = await decodeVin(normalized.vin);
      if (decoded.success) {
        // Backfill missing fields from VIN
        if (!normalized.engine && decoded.engine) enriched.engine = decoded.engine;
        if (!normalized.transmission && decoded.transmission) enriched.transmission = decoded.transmission;
        if (!normalized.drivetrain && decoded.drivetrain) enriched.drivetrain = decoded.drivetrain;
        if (!normalized.body_style && decoded.bodyStyle) enriched.body_style = decoded.bodyStyle;
        if (!normalized.fuel_type && decoded.fuelType) enriched.fuel_type = decoded.fuelType;
        enriched.vin_decoded = 1;
      }
    } catch (err) {
      logger.debug({ err, vin: normalized.vin }, 'VIN decode failed');
    }
  }
```

- [ ] **Step 6: Add confidence score passthrough**

In the listing insert/update section, make sure `scrape_confidence` and `scrape_tier` from the raw listing are preserved:

```typescript
  enriched.scrape_confidence = listing.scrape_confidence || 0.5;
  enriched.scrape_tier = listing.scrape_tier || 'unknown';
```

- [ ] **Step 7: Add alert check at end of pipeline**

After the listing is inserted/updated in the database, add:

```typescript
  // Fire alerts for exceptional deals
  if (enriched.value_rating === 'STEAL' || enriched.value_rating === 'GREAT') {
    await fireAlerts({
      value_rating: enriched.value_rating,
      deal_score: enriched.deal_score || 0,
      price: enriched.price || 0,
      year: enriched.year || 0,
      make: enriched.make || '',
      model: enriched.model || '',
      listing_url: enriched.listing_url,
      id: enriched.id,
    });
  }
```

- [ ] **Step 8: Commit**

```bash
git add src/enrichment/pipeline.ts
git commit -m "feat: wire complete enrichment pipeline — market values, NHTSA, VIN decode, alerts"
```

---

## Phase 4: API Expansion

### Task 13: Scraping & Dealer API Endpoints

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add imports for new modules**

At the top of `src/server.ts`, add:

```typescript
import { onboardDealer, bulkOnboard } from './scrapers/onboard.js';
import { getAllDealerHealthStatuses, getDealerHealth, getActiveListingIdsByDealer } from './db/queries.js';
```

- [ ] **Step 2: Add dealer import endpoint**

```typescript
  // POST /api/dealers/import — bulk import from URL list or CSV
  app.post('/api/dealers/import', async (req, res) => {
    try {
      const { dealers } = req.body as {
        dealers: Array<{ url: string; name: string; city?: string }>;
      };
      if (!Array.isArray(dealers) || dealers.length === 0) {
        return res.status(400).json({ error: 'dealers array required' });
      }
      if (dealers.length > 50) {
        return res.status(400).json({ error: 'Max 50 dealers per batch' });
      }

      const results = await bulkOnboard(dealers);
      const summary = {
        total: results.length,
        succeeded: results.filter(r => r.result.success).length,
        failed: results.filter(r => !r.result.success).length,
        results: results.map(r => ({
          dealer: r.dealer,
          success: r.result.success,
          platform: r.result.platform,
          listingsFound: r.result.listingsFound,
          suggestedPriority: r.result.suggestedPriority,
          tierUsed: r.result.tierUsed,
          errors: r.result.errors,
        })),
      };
      res.json(summary);
    } catch (err) {
      logger.error({ err }, 'Bulk import failed');
      res.status(500).json({ error: 'Import failed' });
    }
  });
```

- [ ] **Step 3: Add single dealer scrape trigger**

```typescript
  // POST /api/dealers/:id/scrape — trigger immediate scrape
  app.post('/api/dealers/:id/scrape', async (req, res) => {
    try {
      const dealer = getDealer(parseInt(req.params.id));
      if (!dealer) return res.status(404).json({ error: 'Dealer not found' });

      const result = await onboardDealer(dealer.website, dealer.name);
      res.json({
        success: result.success,
        listingsFound: result.listingsFound,
        tierUsed: result.tierUsed,
        sampleListings: result.sampleListings,
        errors: result.errors,
      });
    } catch (err) {
      logger.error({ err }, 'Manual scrape failed');
      res.status(500).json({ error: 'Scrape failed' });
    }
  });
```

- [ ] **Step 4: Add dealer health endpoint**

```typescript
  // GET /api/dealers/:id/health — scrape history and health
  app.get('/api/dealers/:id/health', (req, res) => {
    const dealerId = parseInt(req.params.id);
    const health = getDealerHealth(dealerId);
    if (!health) return res.status(404).json({ error: 'Dealer not found' });

    const recentScrapes = getRecentScrapeResults(dealerId, 20);
    res.json({ ...health, recentScrapes });
  });

  // GET /api/dealers/:id/listings — all listings from a dealer
  app.get('/api/dealers/:id/listings', (req, res) => {
    const dealerId = parseInt(req.params.id);
    const listingIds = getActiveListingIdsByDealer(dealerId);
    res.json({ dealerId, count: listingIds.length, listingIds });
  });
```

- [ ] **Step 5: Add scraper health overview endpoint**

```typescript
  // GET /api/scraper-health — all dealers with health status
  app.get('/api/scraper-health', (_req, res) => {
    const statuses = getAllDealerHealthStatuses();
    const summary = {
      total: statuses.length,
      healthy: statuses.filter(s => s.health_state === 'healthy').length,
      degraded: statuses.filter(s => s.health_state === 'degraded').length,
      failing: statuses.filter(s => s.health_state === 'failing').length,
      dead: statuses.filter(s => s.health_state === 'dead').length,
      dealers: statuses,
    };
    res.json(summary);
  });
```

- [ ] **Step 6: Add full scrape trigger endpoint**

```typescript
  // POST /api/scrape/run — trigger full scrape cycle
  app.post('/api/scrape/run', async (_req, res) => {
    try {
      // This runs asynchronously — respond immediately
      res.json({ status: 'started', message: 'Full scrape cycle initiated' });

      // Import ScraperManager to trigger full scrape
      const { ScraperManager } = await import('./scrapers/manager.js');
      const manager = new ScraperManager();
      await manager.runFullScrape();
    } catch (err) {
      logger.error({ err }, 'Full scrape trigger failed');
    }
  });
```

- [ ] **Step 7: Commit**

```bash
git add src/server.ts
git commit -m "feat: add scraping & dealer management API endpoints"
```

---

### Task 14: Enrichment, Export & Settings API Endpoints

**Files:**
- Modify: `src/server.ts`
- Modify: `src/db/queries.ts`

- [ ] **Step 1: Add analysis/enrichment endpoints**

```typescript
  // POST /api/listings/:id/analyze — on-demand deep analysis
  app.post('/api/listings/:id/analyze', async (req, res) => {
    try {
      const listing = getListingById(req.params.id);
      if (!listing) return res.status(404).json({ error: 'Listing not found' });

      // Re-run enrichment pipeline on this listing
      const { processListing } = await import('./enrichment/pipeline.js');
      const enriched = await processListing(listing as any);
      res.json({ success: true, listing: enriched });
    } catch (err) {
      logger.error({ err }, 'Analysis failed');
      res.status(500).json({ error: 'Analysis failed' });
    }
  });

  // GET /api/vehicle/:make/:model/:year/recalls
  app.get('/api/vehicle/:make/:model/:year/recalls', async (req, res) => {
    try {
      const { fetchRecalls } = await import('./enrichment/recalls.js');
      const result = await fetchRecalls(req.params.make, req.params.model, parseInt(req.params.year));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Recall lookup failed' });
    }
  });

  // GET /api/vehicle/:make/:model/:year/complaints
  app.get('/api/vehicle/:make/:model/:year/complaints', async (req, res) => {
    try {
      const { fetchComplaints } = await import('./enrichment/complaints.js');
      const result = await fetchComplaints(req.params.make, req.params.model, parseInt(req.params.year));
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Complaint lookup failed' });
    }
  });
```

- [ ] **Step 2: Add export endpoint**

```typescript
  // POST /api/listings/export — export filtered listings
  app.post('/api/listings/export', (req, res) => {
    const { format = 'csv', filters = {} } = req.body;
    const listings = getActiveListings(filters);

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename=autoscout-export.json');
      return res.json(listings);
    }

    // CSV format
    if (listings.length === 0) {
      return res.status(200).send('No listings found');
    }

    const headers = ['year', 'make', 'model', 'trim', 'price', 'mileage', 'vin',
      'market_value', 'deal_score', 'value_rating', 'risk_score', 'seller_name',
      'listing_url', 'exterior_color', 'transmission', 'drivetrain'];
    const csvRows = [headers.join(',')];

    for (const l of listings) {
      const row = headers.map(h => {
        const val = (l as any)[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      });
      csvRows.push(row.join(','));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=autoscout-export.csv');
    res.send(csvRows.join('\n'));
  });
```

- [ ] **Step 3: Add transaction endpoints**

First, add a `getTransactions` query to `src/db/queries.ts`:

```typescript
export function getTransactions(limit = 50): Array<Record<string, unknown>> {
  const stmt = db().prepare(
    'SELECT * FROM transactions ORDER BY created_at DESC LIMIT ?'
  );
  stmt.bind([limit]);
  const results: Array<Record<string, unknown>> = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}
```

Then add to `src/server.ts`:

```typescript
  // POST /api/transactions — log a dealer visit/offer/purchase
  app.post('/api/transactions', (req, res) => {
    try {
      const { listing_id, dealer_id, type, notes, offered_price, final_price } = req.body;
      insertTransaction({
        listing_id, dealer_id, type, notes, offered_price, final_price,
      });
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to log transaction' });
    }
  });

  // GET /api/transactions — your negotiation history
  app.get('/api/transactions', (req, res) => {
    const limit = parseInt(req.query.limit as string) || 50;
    const transactions = getTransactions(limit);
    res.json(transactions);
  });
```

- [ ] **Step 4: Add settings endpoints**

Add a `settings` table to `src/db/schema.ts`:

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

Add settings queries to `src/db/queries.ts`:

```typescript
export function getSetting(key: string): string | null {
  const stmt = db().prepare('SELECT value FROM user_settings WHERE key = ?');
  stmt.bind([key]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return String(row.value);
  }
  stmt.free();
  return null;
}

export function setSetting(key: string, value: string): void {
  const stmt = db().prepare(
    'INSERT OR REPLACE INTO user_settings (key, value, updated_at) VALUES (?, ?, datetime("now"))'
  );
  stmt.run([key, value]);
  stmt.free();
}

export function getAllSettings(): Record<string, string> {
  const stmt = db().prepare('SELECT key, value FROM user_settings');
  const settings: Record<string, string> = {};
  while (stmt.step()) {
    const row = stmt.getAsObject();
    settings[String(row.key)] = String(row.value);
  }
  stmt.free();
  return settings;
}
```

Then add to `src/server.ts`:

```typescript
  // GET /api/settings
  app.get('/api/settings', (_req, res) => {
    res.json(getAllSettings());
  });

  // PUT /api/settings
  app.put('/api/settings', (req, res) => {
    const settings = req.body as Record<string, string>;
    for (const [key, value] of Object.entries(settings)) {
      setSetting(key, value);
    }
    res.json({ success: true });
  });
```

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/db/queries.ts src/db/schema.ts
git commit -m "feat: add enrichment, export, transaction, and settings API endpoints"
```

---

## Phase 5: Frontend Features

### Task 15: WebSocket Hook & Real-time Infrastructure

**Files:**
- Create: `src/websocket.ts`
- Create: `web/src/hooks/useWebSocket.ts`

- [ ] **Step 1: Install ws package**

```bash
npm install ws && npm install -D @types/ws
```

- [ ] **Step 2: Create WebSocket server**

```typescript
// src/websocket.ts
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from './logger.js';

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    logger.info('WebSocket client connected');
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));

    ws.on('close', () => {
      logger.info('WebSocket client disconnected');
    });
  });
}

export function broadcast(event: string, data: unknown): void {
  if (!wss) return;
  const message = JSON.stringify({ type: event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Specific event emitters
export function emitNewListing(listing: {
  id: string; year: number; make: string; model: string;
  price: number; value_rating: string; deal_score: number;
}): void {
  broadcast('new_listing', listing);
}

export function emitScrapeComplete(dealerId: number, dealerName: string, listingsFound: number): void {
  broadcast('scrape_complete', { dealerId, dealerName, listingsFound });
}

export function emitDealerHealthChange(dealerId: number, dealerName: string, oldState: string, newState: string): void {
  broadcast('dealer_health_change', { dealerId, dealerName, oldState, newState });
}

export function emitAlert(alertType: string, listing: {
  year: number; make: string; model: string; price: number; deal_score: number;
}): void {
  broadcast('deal_alert', { alertType, ...listing });
}
```

- [ ] **Step 3: Wire WebSocket into server startup**

In `src/index.ts`, after `startServer(app)`, add:

```typescript
import { initWebSocket } from './websocket.js';
import { createServer as createHttpServer } from 'http';

// Replace startServer(app) with:
const httpServer = createHttpServer(app);
initWebSocket(httpServer);
httpServer.listen(config.port);
```

- [ ] **Step 4: Create frontend WebSocket hook**

```typescript
// web/src/hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';

interface WSMessage {
  type: string;
  data: unknown;
  timestamp: string;
}

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null);
  const listenersRef = useRef<Map<string, Set<(data: unknown) => void>>>(new Map());

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.hostname}:3000/ws`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Auto-reconnect after 3 seconds
      setTimeout(() => {
        wsRef.current = null;
      }, 3000);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as WSMessage;
        setLastMessage(msg);

        // Notify listeners
        const handlers = listenersRef.current.get(msg.type);
        if (handlers) {
          handlers.forEach(handler => handler(msg.data));
        }
      } catch { /* ignore parse errors */ }
    };

    wsRef.current = ws;
    return () => { ws.close(); };
  }, []);

  const on = useCallback((event: string, handler: (data: unknown) => void) => {
    if (!listenersRef.current.has(event)) {
      listenersRef.current.set(event, new Set());
    }
    listenersRef.current.get(event)!.add(handler);

    return () => {
      listenersRef.current.get(event)?.delete(handler);
    };
  }, []);

  return { connected, lastMessage, on };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/websocket.ts web/src/hooks/useWebSocket.ts src/index.ts
git commit -m "feat: add WebSocket server and React hook for real-time updates"
```

---

### Task 16: Confidence Badge Component

**Files:**
- Create: `web/src/components/ConfidenceBadge.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/src/components/ConfidenceBadge.tsx
interface ConfidenceBadgeProps {
  confidence: number;
  tier?: string;
}

export default function ConfidenceBadge({ confidence, tier }: ConfidenceBadgeProps) {
  if (confidence >= 0.8) return null; // Don't show badge for high confidence

  const bgColor = confidence >= 0.6 ? '#f59e0b' : '#ef4444';
  const label = confidence >= 0.6 ? 'Unverified' : 'Low Confidence';
  const tierLabel = tier === 'ai_extraction' ? 'AI-extracted' : tier === 'structured_data' ? 'Structured data' : '';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        backgroundColor: `${bgColor}22`,
        color: bgColor,
        border: `1px solid ${bgColor}44`,
      }}
      title={`Scrape confidence: ${Math.round(confidence * 100)}%. ${tierLabel ? `Source: ${tierLabel}.` : ''} Price and mileage may need verification.`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Add to Dashboard listings table**

In `web/src/components/Dashboard.tsx`, import ConfidenceBadge and add it to the listing row, after the vehicle name cell:

```typescript
import ConfidenceBadge from './ConfidenceBadge';

// In the table row, after the make/model cell:
<td>
  <ConfidenceBadge
    confidence={listing.scrape_confidence || 1}
    tier={listing.scrape_tier}
  />
</td>
```

- [ ] **Step 3: Update the Listing type in api.ts**

In `web/src/api.ts`, add to the `Listing` interface:

```typescript
  scrape_confidence?: number;
  scrape_tier?: string;
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ConfidenceBadge.tsx web/src/components/Dashboard.tsx web/src/api.ts
git commit -m "feat: add confidence badge for unverified listings"
```

---

### Task 17: Dealer Onboarding UI

**Files:**
- Create: `web/src/components/DealerOnboarding.tsx`
- Modify: `web/src/App.tsx` — add route
- Modify: `web/src/api.ts` — add API functions

- [ ] **Step 1: Add API functions**

In `web/src/api.ts`, add:

```typescript
export async function importDealers(dealers: Array<{ url: string; name: string; city?: string }>) {
  const res = await fetch(`${API}/dealers/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealers }),
  });
  return res.json();
}

export async function triggerDealerScrape(dealerId: number) {
  const res = await fetch(`${API}/dealers/${dealerId}/scrape`, { method: 'POST' });
  return res.json();
}

export async function fetchDealerHealth(dealerId: number) {
  const res = await fetch(`${API}/dealers/${dealerId}/health`);
  return res.json();
}

export async function fetchScraperHealth() {
  const res = await fetch(`${API}/scraper-health`);
  return res.json();
}

export async function exportListings(format: 'csv' | 'json', filters: Record<string, unknown> = {}) {
  const res = await fetch(`${API}/listings/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, filters }),
  });
  if (format === 'csv') {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autoscout-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    return res.json();
  }
}

export async function fetchSettings() {
  const res = await fetch(`${API}/settings`);
  return res.json();
}

export async function saveSettings(settings: Record<string, string>) {
  const res = await fetch(`${API}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.json();
}

export async function createTransaction(data: {
  listing_id?: string; dealer_id?: number; type: string;
  notes: string; offered_price?: number; final_price?: number;
}) {
  const res = await fetch(`${API}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchTransactions() {
  const res = await fetch(`${API}/transactions`);
  return res.json();
}
```

- [ ] **Step 2: Create DealerOnboarding component**

```typescript
// web/src/components/DealerOnboarding.tsx
import { useState } from 'react';
import { importDealers } from '../api';

interface OnboardResult {
  dealer: string;
  success: boolean;
  platform: string | null;
  listingsFound: number;
  suggestedPriority: string;
  tierUsed: string;
  errors: string[];
}

export default function DealerOnboarding() {
  const [mode, setMode] = useState<'single' | 'bulk'>('single');
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<OnboardResult[] | null>(null);
  const [error, setError] = useState('');

  const handleSingleAdd = async () => {
    if (!url || !name) return setError('URL and name are required');
    setLoading(true);
    setError('');
    try {
      const res = await importDealers([{ url, name, city }]);
      setResults(res.results);
    } catch (err) {
      setError('Failed to onboard dealer');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    const lines = bulkText.trim().split('\n').filter(Boolean);
    const dealers = lines.map(line => {
      const parts = line.split(',').map(s => s.trim());
      return { url: parts[0], name: parts[1] || parts[0], city: parts[2] || '' };
    });
    if (dealers.length === 0) return setError('No dealers provided');
    setLoading(true);
    setError('');
    try {
      const res = await importDealers(dealers);
      setResults(res.results);
    } catch (err) {
      setError('Bulk import failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '900px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Add Dealers</h2>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          onClick={() => setMode('single')}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: mode === 'single' ? '#3b82f6' : '#374151', color: '#fff',
          }}
        >Single</button>
        <button
          onClick={() => setMode('bulk')}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: mode === 'bulk' ? '#3b82f6' : '#374151', color: '#fff',
          }}
        >Bulk Import</button>
      </div>

      {mode === 'single' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://dealerwebsite.com"
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: '#fff' }}
          />
          <input
            value={name} onChange={e => setName(e.target.value)}
            placeholder="Dealer Name"
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: '#fff' }}
          />
          <input
            value={city} onChange={e => setCity(e.target.value)}
            placeholder="City (optional)"
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: '#fff' }}
          />
          <button
            onClick={handleSingleAdd}
            disabled={loading}
            style={{ padding: '10px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >{loading ? 'Analyzing...' : 'Add & Test Scrape'}</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>
            One dealer per line: URL, Name, City (CSV format)
          </p>
          <textarea
            value={bulkText} onChange={e => setBulkText(e.target.value)}
            rows={10}
            placeholder={`https://example-auto.com, Example Auto Sales, Houston\nhttps://joes-cars.com, Joe's Cars, League City`}
            style={{ padding: '10px', borderRadius: '6px', border: '1px solid #374151', background: '#1f2937', color: '#fff', fontFamily: 'monospace', fontSize: '13px' }}
          />
          <button
            onClick={handleBulkAdd}
            disabled={loading}
            style={{ padding: '10px', borderRadius: '6px', border: 'none', background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
          >{loading ? `Importing...` : 'Import All'}</button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: '#7f1d1d', color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {results && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #374151' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af' }}>Dealer</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af' }}>Platform</th>
                <th style={{ textAlign: 'right', padding: '8px', color: '#9ca3af' }}>Listings</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af' }}>Priority</th>
                <th style={{ textAlign: 'left', padding: '8px', color: '#9ca3af' }}>Tier</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                  <td style={{ padding: '8px' }}>{r.dealer}</td>
                  <td style={{ padding: '8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
                      background: r.success ? '#065f4622' : '#7f1d1d22',
                      color: r.success ? '#10b981' : '#ef4444',
                    }}>
                      {r.success ? 'OK' : 'FAILED'}
                    </span>
                  </td>
                  <td style={{ padding: '8px', color: '#9ca3af' }}>{r.platform || 'unknown'}</td>
                  <td style={{ padding: '8px', textAlign: 'right' }}>{r.listingsFound}</td>
                  <td style={{ padding: '8px', color: '#9ca3af' }}>{r.suggestedPriority}</td>
                  <td style={{ padding: '8px', color: '#9ca3af' }}>{r.tierUsed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add route to App.tsx**

In `web/src/App.tsx`, add import and route:

```typescript
import DealerOnboarding from './components/DealerOnboarding';

// In Routes:
<Route path="/dealers/onboard" element={<DealerOnboarding />} />
```

And add nav link in the sidebar:

```typescript
{ path: '/dealers/onboard', icon: '➕', label: 'Add Dealers' },
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/DealerOnboarding.tsx web/src/api.ts web/src/App.tsx
git commit -m "feat: add dealer onboarding UI with single and bulk import"
```

---

### Task 18: Scraper Health Dashboard

**Files:**
- Create: `web/src/components/ScraperHealth.tsx`
- Modify: `web/src/App.tsx` — add route

- [ ] **Step 1: Create the component**

```typescript
// web/src/components/ScraperHealth.tsx
import { useState, useEffect } from 'react';
import { fetchScraperHealth, triggerDealerScrape } from '../api';
import { useWebSocket } from '../hooks/useWebSocket';

interface DealerHealth {
  id: number;
  name: string;
  website: string;
  health_state: string;
  consecutive_failures: number;
  last_success_at: string | null;
  last_tier_used: string | null;
  last_listing_count: number;
  scrape_success_rate: number;
  priority: string;
}

interface HealthSummary {
  total: number;
  healthy: number;
  degraded: number;
  failing: number;
  dead: number;
  dealers: DealerHealth[];
}

const STATE_COLORS: Record<string, string> = {
  healthy: '#10b981',
  degraded: '#f59e0b',
  failing: '#f97316',
  dead: '#ef4444',
};

export default function ScraperHealth() {
  const [data, setData] = useState<HealthSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState<number | null>(null);
  const { on, connected } = useWebSocket();

  const load = async () => {
    try {
      const result = await fetchScraperHealth();
      setData(result);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Real-time updates
  useEffect(() => {
    const unsub = on('dealer_health_change', () => load());
    return unsub;
  }, [on]);

  useEffect(() => {
    const unsub = on('scrape_complete', () => load());
    return unsub;
  }, [on]);

  const handleReScrape = async (dealerId: number) => {
    setScraping(dealerId);
    try {
      await triggerDealerScrape(dealerId);
      await load();
    } finally {
      setScraping(null);
    }
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading...</div>;
  if (!data) return <div style={{ padding: '24px' }}>Failed to load health data</div>;

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Scraper Health</h2>
        {connected && (
          <span style={{ fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
            Live
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {(['healthy', 'degraded', 'failing', 'dead'] as const).map(state => (
          <div key={state} style={{
            padding: '16px', borderRadius: '8px', background: '#1f2937',
            borderLeft: `4px solid ${STATE_COLORS[state]}`,
          }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: STATE_COLORS[state] }}>
              {data[state]}
            </div>
            <div style={{ fontSize: '12px', color: '#9ca3af', textTransform: 'capitalize' }}>
              {state}
            </div>
          </div>
        ))}
      </div>

      {/* Dead dealers alert */}
      {data.dead > 0 && (
        <div style={{
          padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
          background: '#7f1d1d22', border: '1px solid #ef444444', color: '#fca5a5',
        }}>
          {data.dead} dealer(s) have been failing for 48+ hours and need attention.
        </div>
      )}

      {/* Dealer table */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #374151' }}>
            <th style={{ textAlign: 'left', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Status</th>
            <th style={{ textAlign: 'left', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Dealer</th>
            <th style={{ textAlign: 'left', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Tier</th>
            <th style={{ textAlign: 'right', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Success Rate</th>
            <th style={{ textAlign: 'right', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Listings</th>
            <th style={{ textAlign: 'left', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Last Success</th>
            <th style={{ textAlign: 'left', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Priority</th>
            <th style={{ textAlign: 'center', padding: '10px', color: '#9ca3af', fontSize: '12px' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.dealers.map(d => (
            <tr key={d.id} style={{ borderBottom: '1px solid #1f2937' }}>
              <td style={{ padding: '10px' }}>
                <span style={{
                  display: 'inline-block', width: '10px', height: '10px',
                  borderRadius: '50%', background: STATE_COLORS[d.health_state] || '#6b7280',
                }} title={d.health_state} />
              </td>
              <td style={{ padding: '10px' }}>
                <div style={{ fontWeight: 500 }}>{d.name}</div>
                <div style={{ fontSize: '11px', color: '#6b7280' }}>{d.website}</div>
              </td>
              <td style={{ padding: '10px', color: '#9ca3af', fontSize: '13px' }}>
                {d.last_tier_used || '—'}
              </td>
              <td style={{ padding: '10px', textAlign: 'right' }}>
                <span style={{
                  color: (d.scrape_success_rate || 0) > 80 ? '#10b981' :
                    (d.scrape_success_rate || 0) > 50 ? '#f59e0b' : '#ef4444',
                }}>
                  {Math.round(d.scrape_success_rate || 0)}%
                </span>
              </td>
              <td style={{ padding: '10px', textAlign: 'right' }}>{d.last_listing_count}</td>
              <td style={{ padding: '10px', color: '#9ca3af', fontSize: '13px' }}>
                {d.last_success_at ? new Date(d.last_success_at).toLocaleString() : 'Never'}
              </td>
              <td style={{ padding: '10px', color: '#9ca3af', fontSize: '13px' }}>{d.priority}</td>
              <td style={{ padding: '10px', textAlign: 'center' }}>
                <button
                  onClick={() => handleReScrape(d.id)}
                  disabled={scraping === d.id}
                  style={{
                    padding: '4px 10px', borderRadius: '4px', border: '1px solid #374151',
                    background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: '12px',
                  }}
                >
                  {scraping === d.id ? '...' : 'Re-test'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Add route and nav link**

In `web/src/App.tsx`:

```typescript
import ScraperHealth from './components/ScraperHealth';

// Add route:
<Route path="/scraper-health" element={<ScraperHealth />} />

// Add nav link:
{ path: '/scraper-health', icon: '🔧', label: 'Scraper Health' },
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ScraperHealth.tsx web/src/App.tsx
git commit -m "feat: add scraper health dashboard with real-time updates"
```

---

### Task 19: Settings Panel

**Files:**
- Create: `web/src/components/SettingsPanel.tsx`
- Modify: `web/src/App.tsx` — add route

- [ ] **Step 1: Create the component**

```typescript
// web/src/components/SettingsPanel.tsx
import { useState, useEffect } from 'react';
import { fetchSettings, saveSettings } from '../api';

interface SettingsConfig {
  label: string;
  key: string;
  type: 'text' | 'number' | 'password';
  placeholder: string;
  section: string;
}

const SETTINGS_SCHEMA: SettingsConfig[] = [
  { label: 'Your City', key: 'user_city', type: 'text', placeholder: 'League City', section: 'Location' },
  { label: 'Your State', key: 'user_state', type: 'text', placeholder: 'TX', section: 'Location' },
  { label: 'Latitude', key: 'user_lat', type: 'number', placeholder: '29.5111', section: 'Location' },
  { label: 'Longitude', key: 'user_lng', type: 'number', placeholder: '-95.1313', section: 'Location' },
  { label: 'Search Radius (miles)', key: 'search_radius', type: 'number', placeholder: '50', section: 'Location' },
  { label: 'MarketCheck API Key', key: 'marketcheck_api_key', type: 'password', placeholder: 'Your API key', section: 'API Keys' },
  { label: 'Google Gemini API Key', key: 'google_ai_api_key', type: 'password', placeholder: 'Your API key', section: 'API Keys' },
  { label: 'Google Places API Key', key: 'google_places_api_key', type: 'password', placeholder: 'Your API key', section: 'API Keys' },
  { label: 'Discord Webhook URL', key: 'discord_webhook', type: 'password', placeholder: 'https://discord.com/api/webhooks/...', section: 'Notifications' },
  { label: 'Email SMTP Host', key: 'smtp_host', type: 'text', placeholder: 'smtp.gmail.com', section: 'Notifications' },
  { label: 'Email From', key: 'smtp_from', type: 'text', placeholder: 'alerts@example.com', section: 'Notifications' },
  { label: 'Mechanic Labor Rate ($/hr)', key: 'mechanic_labor_rate', type: 'number', placeholder: '95', section: 'Preferences' },
  { label: 'Max Concurrent Scrapers', key: 'max_concurrent_scrapers', type: 'number', placeholder: '3', section: 'Preferences' },
  { label: 'Request Delay (ms)', key: 'request_delay_ms', type: 'number', placeholder: '2000', section: 'Preferences' },
];

export default function SettingsPanel() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings().then(s => { setValues(s); setLoading(false); });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings(values);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading settings...</div>;

  const sections = [...new Set(SETTINGS_SCHEMA.map(s => s.section))];

  return (
    <div style={{ padding: '24px', maxWidth: '700px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '20px' }}>Settings</h2>

      {sections.map(section => (
        <div key={section} style={{ marginBottom: '28px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#9ca3af', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {section}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SETTINGS_SCHEMA.filter(s => s.section === section).map(field => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <label style={{ width: '200px', fontSize: '13px', color: '#d1d5db' }}>{field.label}</label>
                <input
                  type={field.type}
                  value={values[field.key] || ''}
                  onChange={e => setValues({ ...values, [field.key]: e.target.value })}
                  placeholder={field.placeholder}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid #374151', background: '#1f2937', color: '#fff', fontSize: '13px',
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 24px', borderRadius: '6px', border: 'none',
          background: saved ? '#10b981' : '#3b82f6', color: '#fff',
          fontWeight: 600, cursor: 'pointer',
        }}
      >
        {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add route to App.tsx**

```typescript
import SettingsPanel from './components/SettingsPanel';

// Route:
<Route path="/settings" element={<SettingsPanel />} />

// Nav link:
{ path: '/settings', icon: '⚙️', label: 'Settings' },
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/SettingsPanel.tsx web/src/App.tsx
git commit -m "feat: add settings panel for API keys, location, and preferences"
```

---

### Task 20: Enrichment Status on Vehicle Detail

**Files:**
- Create: `web/src/components/EnrichmentStatus.tsx`
- Modify: `web/src/components/VehicleDetail.tsx`

- [ ] **Step 1: Create the component**

```typescript
// web/src/components/EnrichmentStatus.tsx
interface EnrichmentStatusProps {
  listing: {
    vin?: string;
    vin_decoded?: number;
    market_value?: number;
    recall_count?: number;
    complaint_count?: number;
    safety_rating_overall?: number;
    risk_score?: number;
    repair_forecast?: string;
    scrape_confidence?: number;
    scrape_tier?: string;
  };
  onReAnalyze?: () => void;
}

interface StatusItem {
  label: string;
  status: 'done' | 'partial' | 'missing';
  detail: string;
}

export default function EnrichmentStatus({ listing, onReAnalyze }: EnrichmentStatusProps) {
  const items: StatusItem[] = [
    {
      label: 'VIN Decoded',
      status: listing.vin_decoded ? 'done' : listing.vin ? 'partial' : 'missing',
      detail: listing.vin_decoded ? 'Full decode complete' : listing.vin ? 'VIN present, not decoded' : 'No VIN',
    },
    {
      label: 'Market Value',
      status: listing.market_value && listing.market_value > 0 ? 'done' : 'missing',
      detail: listing.market_value ? `$${listing.market_value.toLocaleString()}` : 'Not available',
    },
    {
      label: 'Recalls Checked',
      status: listing.recall_count !== undefined && listing.recall_count !== null ? 'done' : 'missing',
      detail: listing.recall_count !== undefined ? `${listing.recall_count} open recall(s)` : 'Not checked',
    },
    {
      label: 'Complaints Checked',
      status: listing.complaint_count !== undefined && listing.complaint_count !== null ? 'done' : 'missing',
      detail: listing.complaint_count !== undefined ? `${listing.complaint_count} complaint(s)` : 'Not checked',
    },
    {
      label: 'Safety Rating',
      status: listing.safety_rating_overall ? 'done' : 'missing',
      detail: listing.safety_rating_overall ? `${listing.safety_rating_overall}/5 stars` : 'Not available',
    },
    {
      label: 'Risk Assessment',
      status: listing.risk_score !== undefined ? 'done' : 'missing',
      detail: listing.risk_score !== undefined ? `Score: ${listing.risk_score}/100` : 'Not assessed',
    },
    {
      label: 'Repair Forecast',
      status: listing.repair_forecast ? 'done' : 'missing',
      detail: listing.repair_forecast ? 'Generated' : 'Not available',
    },
  ];

  const statusIcon = (s: string) => {
    switch (s) {
      case 'done': return { symbol: '✓', color: '#10b981' };
      case 'partial': return { symbol: '~', color: '#f59e0b' };
      default: return { symbol: '✗', color: '#6b7280' };
    }
  };

  return (
    <div style={{
      padding: '16px', borderRadius: '8px', background: '#1f2937',
      border: '1px solid #374151', marginBottom: '16px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600 }}>Enrichment Status</h3>
        {onReAnalyze && (
          <button
            onClick={onReAnalyze}
            style={{
              padding: '4px 12px', borderRadius: '4px', border: '1px solid #374151',
              background: 'transparent', color: '#3b82f6', cursor: 'pointer', fontSize: '12px',
            }}
          >Re-analyze</button>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {items.map(item => {
          const icon = statusIcon(item.status);
          return (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: icon.color, fontWeight: 700, width: '16px' }}>{icon.symbol}</span>
              <span style={{ color: '#d1d5db' }}>{item.label}</span>
              <span style={{ color: '#6b7280', fontSize: '11px', marginLeft: 'auto' }}>{item.detail}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to VehicleDetail.tsx**

In `web/src/components/VehicleDetail.tsx`, import and add EnrichmentStatus after the specs grid:

```typescript
import EnrichmentStatus from './EnrichmentStatus';

// After the specs grid, before the risk section:
<EnrichmentStatus listing={listing} onReAnalyze={() => {
  fetch(`/api/listings/${listing.id}/analyze`, { method: 'POST' })
    .then(() => window.location.reload());
}} />
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/EnrichmentStatus.tsx web/src/components/VehicleDetail.tsx
git commit -m "feat: add enrichment status display on vehicle detail page"
```

---

### Task 21: Export Tools & Transaction Tracker

**Files:**
- Create: `web/src/components/ExportTools.tsx`
- Create: `web/src/components/TransactionTracker.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Create ExportTools component**

```typescript
// web/src/components/ExportTools.tsx
import { useState } from 'react';
import { exportListings } from '../api';

export default function ExportTools() {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportListings(format);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '24px', maxWidth: '600px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>Export Listings</h2>
      <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
        Export all active listings with their enrichment data.
      </p>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setFormat('csv')}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: format === 'csv' ? '#3b82f6' : '#374151', color: '#fff',
          }}
        >CSV</button>
        <button
          onClick={() => setFormat('json')}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            background: format === 'json' ? '#3b82f6' : '#374151', color: '#fff',
          }}
        >JSON</button>
      </div>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          padding: '10px 24px', borderRadius: '6px', border: 'none',
          background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer',
        }}
      >
        {exporting ? 'Exporting...' : `Export as ${format.toUpperCase()}`}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create TransactionTracker component**

```typescript
// web/src/components/TransactionTracker.tsx
import { useState, useEffect } from 'react';
import { fetchTransactions, createTransaction } from '../api';

const TRANSACTION_TYPES = ['viewed', 'contacted', 'visited', 'offered', 'bought', 'walked'];

interface Transaction {
  id: number;
  listing_id: string;
  type: string;
  notes: string;
  offered_price: number;
  final_price: number;
  created_at: string;
}

export default function TransactionTracker() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'visited', notes: '', offered_price: '', listing_id: '' });

  useEffect(() => {
    fetchTransactions().then(data => { setTransactions(data); setLoading(false); });
  }, []);

  const handleSubmit = async () => {
    await createTransaction({
      type: form.type,
      notes: form.notes,
      listing_id: form.listing_id || undefined,
      offered_price: form.offered_price ? parseFloat(form.offered_price) : undefined,
    });
    const updated = await fetchTransactions();
    setTransactions(updated);
    setShowForm(false);
    setForm({ type: 'visited', notes: '', offered_price: '', listing_id: '' });
  };

  if (loading) return <div style={{ padding: '24px' }}>Loading...</div>;

  // Funnel counts
  const funnel = TRANSACTION_TYPES.map(t => ({
    type: t,
    count: transactions.filter(tx => tx.type === t).length,
  }));

  return (
    <div style={{ padding: '24px', maxWidth: '800px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Transaction History</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            padding: '8px 16px', borderRadius: '6px', border: 'none',
            background: '#3b82f6', color: '#fff', cursor: 'pointer',
          }}
        >{showForm ? 'Cancel' : '+ Log Activity'}</button>
      </div>

      {/* Funnel */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {funnel.map((f, i) => (
          <div key={f.type} style={{
            flex: 1, padding: '12px', borderRadius: '8px', background: '#1f2937', textAlign: 'center',
          }}>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{f.count}</div>
            <div style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'capitalize' }}>{f.type}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{
          padding: '16px', borderRadius: '8px', background: '#1f2937',
          marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '12px',
        }}>
          <select
            value={form.type}
            onChange={e => setForm({ ...form, type: e.target.value })}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #374151', background: '#111827', color: '#fff' }}
          >
            {TRANSACTION_TYPES.map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <input
            value={form.listing_id}
            onChange={e => setForm({ ...form, listing_id: e.target.value })}
            placeholder="Listing ID (optional)"
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #374151', background: '#111827', color: '#fff' }}
          />
          <input
            value={form.offered_price}
            onChange={e => setForm({ ...form, offered_price: e.target.value })}
            placeholder="Offered price (optional)"
            type="number"
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #374151', background: '#111827', color: '#fff' }}
          />
          <textarea
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (e.g., 'Offered $5k, they countered at $5.5k')"
            rows={3}
            style={{ padding: '8px', borderRadius: '6px', border: '1px solid #374151', background: '#111827', color: '#fff' }}
          />
          <button
            onClick={handleSubmit}
            style={{
              padding: '10px', borderRadius: '6px', border: 'none',
              background: '#10b981', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >Save</button>
        </div>
      )}

      {/* Transaction list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {transactions.map(tx => (
          <div key={tx.id} style={{
            padding: '12px', borderRadius: '8px', background: '#1f2937',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                background: '#374151', color: '#d1d5db', marginRight: '8px', textTransform: 'capitalize',
              }}>{tx.type}</span>
              <span style={{ color: '#d1d5db' }}>{tx.notes}</span>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {tx.offered_price > 0 && (
                <span style={{ color: '#f59e0b', fontSize: '13px' }}>
                  ${tx.offered_price.toLocaleString()}
                </span>
              )}
              <span style={{ color: '#6b7280', fontSize: '12px' }}>
                {new Date(tx.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {transactions.length === 0 && (
          <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px' }}>
            No transactions yet. Log your first dealer visit!
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add routes to App.tsx**

```typescript
import ExportTools from './components/ExportTools';
import TransactionTracker from './components/TransactionTracker';

// Routes:
<Route path="/export" element={<ExportTools />} />
<Route path="/transactions" element={<TransactionTracker />} />

// Nav links:
{ path: '/export', icon: '📥', label: 'Export' },
{ path: '/transactions', icon: '📋', label: 'Transactions' },
```

- [ ] **Step 4: Commit**

```bash
git add web/src/components/ExportTools.tsx web/src/components/TransactionTracker.tsx web/src/App.tsx
git commit -m "feat: add export tools and transaction tracker with purchase funnel"
```

---

### Task 22: Wire WebSocket Events into Pipeline and Scraper

**Files:**
- Modify: `src/enrichment/pipeline.ts`
- Modify: `src/scrapers/manager.ts`
- Modify: `src/scrapers/health.ts`

- [ ] **Step 1: Emit new_listing events from pipeline**

In `src/enrichment/pipeline.ts`, add import:

```typescript
import { emitNewListing } from '../websocket.js';
```

After a listing is inserted into the database, add:

```typescript
  emitNewListing({
    id: enriched.id,
    year: enriched.year || 0,
    make: enriched.make || '',
    model: enriched.model || '',
    price: enriched.price || 0,
    value_rating: enriched.value_rating || '',
    deal_score: enriched.deal_score || 0,
  });
```

- [ ] **Step 2: Emit scrape_complete from manager**

In `src/scrapers/manager.ts`, add import:

```typescript
import { emitScrapeComplete } from '../websocket.js';
```

After a dealer scrape completes successfully:

```typescript
  emitScrapeComplete(dealer.id, dealer.name, result.listings.length);
```

- [ ] **Step 3: Emit health changes from health tracker**

In `src/scrapers/health.ts`, add:

```typescript
import { emitDealerHealthChange } from '../websocket.js';
```

Create a helper that emits when state changes:

```typescript
export function emitIfStateChanged(
  dealerId: number,
  dealerName: string,
  oldState: string,
  newState: string
): void {
  if (oldState !== newState) {
    emitDealerHealthChange(dealerId, dealerName, oldState, newState);
  }
}
```

- [ ] **Step 4: Emit alert events**

In `src/enrichment/alert-check.ts`, add import and emit:

```typescript
import { emitAlert } from '../websocket.js';

// Inside fireAlerts, after the Discord notification:
emitAlert(alertType, {
  year: input.year, make: input.make, model: input.model,
  price: input.price, deal_score: input.deal_score,
});
```

- [ ] **Step 5: Commit**

```bash
git add src/enrichment/pipeline.ts src/scrapers/manager.ts src/scrapers/health.ts src/enrichment/alert-check.ts
git commit -m "feat: wire WebSocket events into pipeline, scraper, and health systems"
```

---

### Task 23: Add Real-time Toast Notifications to Dashboard

**Files:**
- Modify: `web/src/components/Dashboard.tsx`

- [ ] **Step 1: Add WebSocket listener for deal alerts and new listings**

At the top of Dashboard component, add:

```typescript
import { useWebSocket } from '../hooks/useWebSocket';

// Inside the Dashboard component:
const { on, connected } = useWebSocket();
const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);
const [newListingCount, setNewListingCount] = useState(0);

useEffect(() => {
  const unsub1 = on('deal_alert', (data: any) => {
    const toast = {
      id: Date.now(),
      message: `${data.alertType === 'steal' ? '🔥 STEAL' : '⭐ GREAT'}: ${data.year} ${data.make} ${data.model} — $${data.price?.toLocaleString()}`,
      type: data.alertType,
    };
    setToasts(prev => [...prev, toast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id));
    }, 8000);
  });

  const unsub2 = on('new_listing', () => {
    setNewListingCount(prev => prev + 1);
  });

  return () => { unsub1(); unsub2(); };
}, [on]);
```

- [ ] **Step 2: Add toast display and new listings badge**

Before the main table, add:

```typescript
{/* Toast notifications */}
<div style={{ position: 'fixed', top: '16px', right: '16px', zIndex: 1000, display: 'flex', flexDirection: 'column', gap: '8px' }}>
  {toasts.map(toast => (
    <div key={toast.id} style={{
      padding: '12px 20px', borderRadius: '8px', maxWidth: '400px',
      background: toast.type === 'steal' ? '#065f46' : '#1e3a5f',
      border: `1px solid ${toast.type === 'steal' ? '#10b981' : '#3b82f6'}`,
      color: '#fff', fontSize: '14px', fontWeight: 500,
      animation: 'slideIn 0.3s ease-out',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    }}>
      {toast.message}
    </div>
  ))}
</div>

{/* New listings badge */}
{newListingCount > 0 && (
  <button
    onClick={() => { setNewListingCount(0); /* refetch listings */ }}
    style={{
      padding: '8px 16px', borderRadius: '9999px', border: 'none',
      background: '#3b82f6', color: '#fff', cursor: 'pointer', marginBottom: '12px',
      fontWeight: 600,
    }}
  >
    {newListingCount} new listing{newListingCount > 1 ? 's' : ''} — click to refresh
  </button>
)}
```

- [ ] **Step 3: Commit**

```bash
git add web/src/components/Dashboard.tsx
git commit -m "feat: add real-time toast notifications and new listing badges to dashboard"
```

---

### Task 24: Update Tiered Scheduler

**Files:**
- Modify: `src/scheduler.ts`

- [ ] **Step 1: Add tiered scrape schedules**

Replace the current scheduler with tiered support:

```typescript
import { getActiveDealers } from './db/queries.js';
import { ScraperManager } from './scrapers/manager.js';
import { getDealersNeedingAlert } from './db/queries.js';
import { sendDiscordAlert } from './notifications/discord.js';

// In startScheduler():

  // High-priority dealers: every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    logger.info('Running high-priority dealer scrape');
    const manager = new ScraperManager();
    const dealers = getActiveDealers().filter(d => d.priority === 'critical' || d.priority === 'high');
    for (const dealer of dealers) {
      await manager.scrapeDealer(dealer);
    }
  });

  // Medium-priority dealers: every 12 hours
  cron.schedule('0 6,18 * * *', async () => {
    logger.info('Running medium-priority dealer scrape');
    const manager = new ScraperManager();
    const dealers = getActiveDealers().filter(d => d.priority === 'medium');
    for (const dealer of dealers) {
      await manager.scrapeDealer(dealer);
    }
  });

  // Low-priority dealers: daily at 3 AM
  cron.schedule('0 3 * * *', async () => {
    logger.info('Running low-priority dealer scrape');
    const manager = new ScraperManager();
    const dealers = getActiveDealers().filter(d => d.priority === 'low');
    for (const dealer of dealers) {
      await manager.scrapeDealer(dealer);
    }
  });

  // Dead dealer check: every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    const deadDealers = getDealersNeedingAlert();
    if (deadDealers.length > 0) {
      const names = deadDealers.map(d => d.name).join(', ');
      await sendDiscordAlert(
        `⚠️ **${deadDealers.length} dealer(s) have been failing for 48+ hours:** ${names}`,
        []
      );
    }
  });
```

- [ ] **Step 2: Commit**

```bash
git add src/scheduler.ts
git commit -m "feat: add tiered scrape scheduling (4h/12h/24h) and dead dealer alerts"
```

---

### Task 25: Final Integration — Wire Server Startup

**Files:**
- Modify: `src/index.ts`
- Modify: `src/server.ts`

- [ ] **Step 1: Update index.ts for WebSocket integration**

Replace the current `src/index.ts` startup:

```typescript
import { config } from './config.js';
import { logger } from './logger.js';
import { initDatabase } from './db/schema.js';
import { createServer } from './server.js';
import { startScheduler } from './scheduler.js';
import { initWebSocket } from './websocket.js';
import { createServer as createHttpServer } from 'http';

async function main() {
  logger.info('AutoScout V2 starting...');

  const db = await initDatabase();
  logger.info('Database initialized');

  const app = createServer();
  const httpServer = createHttpServer(app);

  initWebSocket(httpServer);
  logger.info('WebSocket server initialized');

  httpServer.listen(config.port, () => {
    logger.info(`AutoScout V2 ready on port ${config.port}`);
  });

  startScheduler();
}

main().catch((err) => {
  logger.error(err, 'Fatal error during startup');
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down...');
  process.exit(0);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection');
});

process.on('uncaughtException', (error) => {
  logger.error(error, 'Uncaught exception');
  process.exit(1);
});
```

- [ ] **Step 2: Verify everything compiles**

```bash
npx tsc --noEmit
```

Fix any type errors that surface.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: final integration — WebSocket startup, complete V2 wiring"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|-----------------|
| 1: Scraper Cascade | 1-5 | 4-tier cascade, confidence scoring, 20+ platforms |
| 2: Onboarding & Health | 6-8 | Auto-discovery, test scrape, health state machine, self-healing |
| 3: Enrichment | 9-12 | NHTSA cache, market values, alerts, full pipeline wiring |
| 4: API | 13-14 | 18 new endpoints (33 total) |
| 5: Frontend | 15-23 | WebSocket, confidence badges, onboarding UI, health dashboard, settings, enrichment status, export, transactions, real-time toasts |
| 6: Integration | 24-25 | Tiered scheduler, WebSocket startup, final wiring |

Total: 25 tasks, ~75 steps.
