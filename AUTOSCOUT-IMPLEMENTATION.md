# AutoScout — IMPLEMENTATION HARDENING
## Security, Redundancy, Data Integrity, Error Handling, Anti-Detection, Performance, Testing
### Companion document to AUTOSCOUT-FINAL.md

---

## 0. CLAUDE CODE PLUGINS — USE THESE THROUGHOUT THE BUILD

The following MCP plugins are installed in Claude Code. Use them aggressively at every stage.

### context7@claude-plugins-official
**USE FOR EVERY LIBRARY INTEGRATION.** Before writing any code that uses an external library, query context7 for the latest docs. Training data may be stale — context7 gives you the current API.

```
Mandatory context7 lookups before coding:
- Before writing ANY Playwright code → context7: "Playwright browser automation latest API"
- Before writing ANY better-sqlite3 code → context7: "better-sqlite3 Node.js API"
- Before writing ANY Express middleware → context7: "Express.js middleware setup"
- Before writing ANY React component → context7: "React hooks useState useEffect"
- Before using node-cron → context7: "node-cron scheduling syntax"
- Before using Cheerio → context7: "Cheerio HTML parsing API"
- Before using pino logger → context7: "pino Node.js structured logging"
- Before using Vite → context7: "Vite React TypeScript configuration"
- Before using p-limit → context7: "p-limit concurrency control"
- Before using helmet → context7: "helmet Express security headers"
- Before using nodemailer → context7: "nodemailer SMTP email sending"
- Before using recharts → context7: "recharts React charting library"
- Before using Leaflet/MapLibre → context7: "Leaflet map React integration"
- Before using Vitest → context7: "Vitest testing framework API"
- Before using Tailwind → context7: "Tailwind CSS utility classes"

Rule: If you're importing a package, check context7 first. Every time. No exceptions.
```

### code-review@claude-plugins-official
**USE AFTER EVERY PHASE COMPLETION.** Before moving to the next phase, run code-review on all new files. This catches:
- Security vulnerabilities (SQL injection, XSS, SSRF)
- Error handling gaps (unhandled promises, missing try/catch)
- Performance issues (N+1 queries, memory leaks, unbounded loops)
- Code quality (dead code, unnecessary complexity, missing types)
- Best practice violations

```
Mandatory code review checkpoints:
- After Phase 1 (Foundation): Review schema.ts, queries.ts, risk-scorer.ts, normalizer.ts
- After Phase 2 (Scrapers): Review ALL scraper files, enrichment pipeline, dedup logic
- After Phase 3 (API + UI): Review server.ts for security, all React components for XSS
- After Phase 4 (Dealer System): Review detector.ts, platform scrapers, Google Places integration
- After Phase 5 (Intelligence): Review AI integration, vehicle-analyzer.ts, photo-analyzer.ts
- After Phase 6 (Advanced): Review audit engine, notification system, analytics queries
- After Phase 7 (Scheduling): Review cron jobs, concurrency logic, session management
- After Phase 8 (Extension): Review manifest permissions, content script injection safety

Also run code-review on any file that:
- Handles user input (API endpoints, search configs, dealer URL input)
- Makes external HTTP requests (scrapers, API clients)
- Touches the database (queries, migrations, transactions)
- Manages secrets (env loading, keychain access, cookie storage)
```

### frontend-design@claude-plugins-official
**USE FOR EVERY UI COMPONENT.** This plugin ensures professional, polished design instead of generic AI aesthetics. Use it when building:

```
Mandatory frontend-design usage:
- Dashboard table view — distinctive dark theme with gold accents, not generic Material UI
- Vehicle Detail page — editorial-quality layout for specs, repair forecast, analysis
- Map view — custom pin styling, popup cards, radius overlay
- Compare view — radar charts, side-by-side layout, winner highlighting
- Dealer Manager — clean CRUD interface with status indicators
- Analytics dashboard — charts that actually look good, not default recharts styling
- Filter bar — compact, intuitive, mobile-responsive
- Deal badges (STEAL/GREAT/GOOD/FAIR/HIGH/RIP-OFF) — each needs distinct visual identity
- Scam alert banners — attention-grabbing without being obnoxious
- Purchase workflow — step-by-step progress with clear visual hierarchy
- Repair forecast display — timeline visualization, cost breakdown cards
- Audit dashboard — health indicators, severity color coding
- Notification preferences panel
- Mobile responsive layouts for ALL views (user will check on phone)

Design direction: Dark theme (bg #0a0a0c), gold primary (#f0c040), green for good (#4ade80), 
red for bad (#e85454), blue for info (#60a5fa). Monospace for numbers/prices. 
NO generic AI aesthetics — no purple gradients, no Inter font, no rounded cards everywhere.
```

### ui-ux-pro-max@ui-ux-pro-max-skill
**USE FOR COMPLEX INTERACTION PATTERNS.** This plugin handles advanced UX that frontend-design alone might miss:

```
Mandatory ui-ux-pro-max usage:
- Table sorting/filtering UX — instant feedback, preserved scroll position, URL state sync
- Inline row expansion — smooth animation, no layout shift
- Drag-to-compare — drag listings into a comparison tray
- Favoriting flow — optimistic UI update, undo capability
- Contact seller flow — copy-to-clipboard with confirmation toast, deep link to SMS/messenger
- Search config builder — add/remove criteria with live preview of matching count
- Dealer add flow — URL paste → auto-detect → test scrape → confirmation
- Map interaction — click pin → card → detail page transition
- Mobile swipe gestures — swipe to save/dismiss on listing cards
- Loading states — skeleton screens during scrape, progressive data rendering
- Empty states — helpful guidance when no listings match filters
- Error states — friendly messages with retry actions, not stack traces
- Notification preference toggles — immediate visual feedback
- Data export flow — format selection, progress indicator, download trigger
```

### superpowers@claude-plugins-official
**USE FOR COMPLEX SYSTEM ARCHITECTURE.** When Claude Code needs to:
- Design the scraper orchestration system (queue management, priority scheduling, concurrency)
- Architect the enrichment pipeline (ordering, dependency resolution, caching strategy)
- Design the cross-source dedup merge algorithm
- Plan the database migration strategy
- Structure the Chrome extension architecture (content script ↔ background script ↔ popup communication)
- Design the notification fanout system (email + Discord + Telegram in parallel)

### Plugin Usage Pattern Per Phase

```
EVERY PHASE follows this pattern:

1. context7 → Look up docs for all libraries used in this phase
2. Code → Write the implementation
3. code-review → Review all new files for bugs, security, performance
4. Fix → Address all code-review findings
5. frontend-design + ui-ux-pro-max → Build/polish any UI for this phase
6. code-review → Final review of UI components
7. Test → Run unit tests and smoke tests
8. Move to next phase
```

---

## 1. SECURITY

### 1.1 Secret Management

**Problem:** API keys, database credentials, email passwords sitting in plaintext .env files.

```typescript
// ❌ BAD — .env file with raw secrets
MARKETCHECK_API_KEY=abc123xyz
SMTP_PASS=mypassword

// ✅ BETTER — use dotenv + file permissions
// .env should be 600 permissions (owner read/write only)
chmod 600 .env

// ✅ BEST — encrypt secrets at rest
// Use node-keytar (OS keychain) or age encryption
import * as keytar from 'keytar';

async function getSecret(key: string): Promise<string> {
  // Try OS keychain first
  const val = await keytar.getPassword('autoscout', key);
  if (val) return val;
  // Fall back to .env
  return process.env[key] || '';
}

// On first run, prompt user and store in OS keychain
async function setupSecrets() {
  const keys = ['MARKETCHECK_API_KEY', 'GOOGLE_AI_API_KEY', 'SMTP_PASS'];
  for (const key of keys) {
    if (!await keytar.getPassword('autoscout', key)) {
      const value = await prompt(`Enter ${key}: `);
      await keytar.setPassword('autoscout', key, value);
    }
  }
}
```

**Additional measures:**
- `.env` in `.gitignore` — never committed
- No secrets in logs — sanitize all log output
- Rotate MarketCheck API key monthly
- Use app-specific passwords for Gmail SMTP (not your real password)
- If using Discord webhook: webhook URL is a secret, treat it like an API key

### 1.2 Database Security

```typescript
// ❌ BAD — SQL injection via string concatenation
db.prepare(`SELECT * FROM listings WHERE make = '${userInput}'`).all();

// ✅ CORRECT — parameterized queries EVERYWHERE
db.prepare('SELECT * FROM listings WHERE make = ?').all(userInput);

// ✅ ALSO — validate and sanitize all inputs before they hit the DB
function sanitizeInput(input: string): string {
  // Remove null bytes, control characters
  return input.replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 500);
}

// ✅ Database file permissions
chmod 600 data/autoscout.db
// Only the process owner can read/write

// ✅ Enable WAL mode for concurrent reads during scraping
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
```

### 1.3 Network Security

```typescript
// All external requests go through a hardened fetch wrapper
async function secureFetch(url: string, options?: RequestInit): Promise<Response> {
  // Validate URL — prevent SSRF (Server-Side Request Forgery)
  const parsed = new URL(url);
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    throw new Error('SSRF blocked: cannot fetch localhost URLs');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`Blocked protocol: ${parsed.protocol}`);
  }

  // Timeout — never hang forever
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s max

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': getRotatingUserAgent(),
        ...(options?.headers || {}),
      }
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
}
```

### 1.4 API Server Security (Express)

```typescript
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cors from 'cors';

const app = express();

// Security headers
app.use(helmet());

// CORS — only allow your frontend origin
app.use(cors({ origin: 'http://localhost:5173' })); // Vite dev server

// Rate limiting — protect against runaway scripts
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                 // 1000 requests per window (generous for personal use)
  message: 'Too many requests'
}));

// Body size limit — prevent memory bombs
app.use(express.json({ limit: '1mb' }));

// Input validation on all API endpoints
app.get('/api/listings', (req, res) => {
  const make = sanitizeInput(String(req.query.make || ''));
  const maxPrice = Math.min(Number(req.query.maxPrice) || 100000, 500000); // cap at 500k
  const limit = Math.min(Number(req.query.limit) || 50, 200); // cap at 200 results
  // ... query with validated params
});

// No stack traces in production errors
app.use((err, req, res, next) => {
  console.error(err.stack); // log full error
  res.status(500).json({ error: 'Internal server error' }); // return generic message
});
```

### 1.5 Playwright / Scraper Security

```typescript
// Browser isolation
const browser = await chromium.launch({
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-sandbox',
    '--disable-web-security',      // needed for some scrapers
    '--disable-features=VizDisplayCompositor',
  ],
  headless: true,
});

// Separate browser contexts per scraper — no cookie/session leakage between dealers
const context = await browser.newContext({
  userAgent: getRotatingUserAgent(),
  viewport: { width: 1366, height: 768 },
  locale: 'en-US',
  timezoneId: 'America/Chicago',
});

// Close context after each scrape — prevent memory leaks
try {
  const page = await context.newPage();
  // ... scrape
} finally {
  await context.close();
}

// Kill browser process if it hangs
setTimeout(async () => {
  if (browser.isConnected()) {
    console.warn('Browser hung — force killing');
    await browser.close();
  }
}, 120000); // 2 minute max per scrape session
```

---

## 2. REDUNDANCY & FAILURE RECOVERY

### 2.1 Database Backup

```typescript
// Automated daily backup before the audit sweep
import { copyFileSync, existsSync, mkdirSync } from 'fs';

function backupDatabase() {
  const backupDir = 'data/backups';
  if (!existsSync(backupDir)) mkdirSync(backupDir, { recursive: true });

  const date = new Date().toISOString().slice(0, 10);
  const backupPath = `${backupDir}/autoscout-${date}.db`;

  // SQLite online backup — safe even while DB is being written to
  const backupDb = new Database(backupPath);
  db.backup(backupDb).then(() => {
    backupDb.close();
    console.log(`Backup created: ${backupPath}`);
  });

  // Retention: keep last 7 daily backups, delete older
  const backups = readdirSync(backupDir)
    .filter(f => f.startsWith('autoscout-') && f.endsWith('.db'))
    .sort()
    .reverse();
  for (const old of backups.slice(7)) {
    unlinkSync(`${backupDir}/${old}`);
  }
}

// Schedule: daily at 1:55 AM (just before audit sweep at 2 AM)
cron.schedule('55 1 * * *', backupDatabase);
```

### 2.2 Scraper Failure Handling

```typescript
interface ScraperResult {
  success: boolean;
  listings: CarListing[];
  errors: string[];
  duration_ms: number;
  retryable: boolean;
}

async function scrapeWithRetry(
  scraper: BaseScraper,
  dealer: Dealer,
  maxRetries: number = 3
): Promise<ScraperResult> {

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      const listings = await scraper.scrape(dealer);

      // Validate result — don't accept obviously broken data
      if (listings.length === 0 && dealer.last_listing_count > 10) {
        // Dealer had 10+ cars last time but now has 0?
        // Likely a scraper failure, not empty inventory
        throw new Error(`Suspicious: 0 listings found but dealer had ${dealer.last_listing_count} previously`);
      }

      return {
        success: true,
        listings,
        errors: [],
        duration_ms: Date.now() - startTime,
        retryable: false
      };

    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);

      console.warn(`Scrape attempt ${attempt}/${maxRetries} failed for ${dealer.name}: ${error.message}`);

      if (!isRetryable) break;

      // Exponential backoff: 2s, 4s, 8s
      await sleep(2000 * Math.pow(2, attempt - 1));
    }
  }

  // All retries failed — log and degrade gracefully
  db.insertScrapeLog({
    source: dealer.platform,
    dealer_id: dealer.id,
    listings_found: 0,
    errors: lastError?.message,
    duration_ms: 0,
  });

  // Update dealer scrape success rate
  updateDealerReliability(dealer.id, false);

  return {
    success: false,
    listings: [],
    errors: [lastError?.message || 'Unknown error'],
    duration_ms: 0,
    retryable: true
  };
}

function isRetryableError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  // Retryable: network timeouts, rate limits, temporary server errors
  if (msg.includes('timeout')) return true;
  if (msg.includes('429') || msg.includes('rate limit')) return true;
  if (msg.includes('503') || msg.includes('502')) return true;
  if (msg.includes('econnreset') || msg.includes('econnrefused')) return true;
  // NOT retryable: 404, 403, parse errors, auth failures
  if (msg.includes('404') || msg.includes('403')) return false;
  if (msg.includes('parse') || msg.includes('json')) return false;
  return true; // default to retryable
}

// Track dealer reliability — automatically reduce scrape frequency for unreliable dealers
function updateDealerReliability(dealerId: number, success: boolean) {
  const dealer = db.getDealer(dealerId);
  const history = db.getRecentScrapeResults(dealerId, 10);
  const successCount = history.filter(h => h.success).length;
  const successRate = successCount / Math.max(history.length, 1);

  db.updateDealer(dealerId, { scrape_success_rate: successRate });

  // If failing 70%+ of the time, demote to low priority
  if (successRate < 0.3 && history.length >= 5) {
    db.updateDealer(dealerId, { scrape_priority: 'low' });
    console.warn(`Dealer ${dealer.name} demoted to low priority — ${Math.round(successRate * 100)}% success rate`);
  }

  // If failing 100% over 10 attempts, deactivate scraping
  if (successRate === 0 && history.length >= 10) {
    db.updateDealer(dealerId, { is_active: 0 });
    console.error(`Dealer ${dealer.name} deactivated — 0% success rate over 10 attempts`);
  }
}
```

### 2.3 API Failure Handling

```typescript
// MarketCheck API — graceful degradation
async function searchMarketCheck(config: SearchConfig): Promise<CarListing[]> {
  try {
    const response = await secureFetch(MARKETCHECK_URL, { /* params */ });

    if (response.status === 429) {
      console.warn('MarketCheck rate limited — skipping this cycle');
      return []; // Don't crash, just skip
    }

    if (response.status === 401) {
      console.error('MarketCheck API key invalid — check .env');
      // Send notification to user
      await notify('MarketCheck API key expired or invalid — update your key');
      return [];
    }

    if (!response.ok) {
      throw new Error(`MarketCheck HTTP ${response.status}`);
    }

    return parseMarketCheckResponse(await response.json());

  } catch (error) {
    console.error(`MarketCheck failed: ${error.message}`);
    // System continues working with other sources
    return [];
  }
}

// NHTSA API — cache results (they don't change often)
const vinCache = new Map<string, { data: any; timestamp: number }>();

async function vinDecode(vin: string): Promise<VinDecodeResult> {
  // Check cache first — VIN data doesn't change
  const cached = vinCache.get(vin);
  if (cached && Date.now() - cached.timestamp < 86400000) { // 24hr cache
    return cached.data;
  }

  try {
    const response = await secureFetch(`${NHTSA_VIN_URL}/${vin}?format=json`);
    const data = await response.json();
    const result = parseVinDecode(data);

    // Cache the result
    vinCache.set(vin, { data: result, timestamp: Date.now() });

    // Also persist to DB for offline access
    db.cacheVinDecode(vin, result);

    return result;
  } catch (error) {
    // Fall back to DB cache
    const dbCached = db.getCachedVinDecode(vin);
    if (dbCached) return dbCached;

    console.warn(`VIN decode failed for ${vin}: ${error.message}`);
    return { success: false, vin } as VinDecodeResult;
  }
}
```

### 2.4 Crash Recovery

```typescript
// Graceful shutdown — save state before dying
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await scraperManager.stopAll();
  db.pragma('wal_checkpoint(TRUNCATE)'); // flush WAL to main DB
  db.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down...');
  await scraperManager.stopAll();
  db.close();
  process.exit(0);
});

// Unhandled rejection handler — log but don't crash
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  // Log to audit_log table
  db.insertAuditLog(null, {
    audit_type: 'system_error',
    severity: 'critical',
    details: `Unhandled rejection: ${reason}`
  });
  // Don't process.exit — keep running
});

// Uncaught exception — log and restart
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  db.insertAuditLog(null, {
    audit_type: 'system_crash',
    severity: 'critical',
    details: `Uncaught exception: ${error.message}\n${error.stack}`
  });
  // Flush DB and exit — let process manager (PM2/systemd) restart
  try { db.close(); } catch (e) {}
  process.exit(1);
});
```

### 2.5 Process Management

```bash
# Use PM2 for automatic restart on crash
npm install -g pm2

# Start with auto-restart
pm2 start dist/index.js --name autoscout --max-restarts 10 --restart-delay 5000

# Save process list so it survives reboot
pm2 save
pm2 startup  # generates systemd service

# Monitor
pm2 logs autoscout
pm2 monit
```

---

## 3. DATA INTEGRITY

### 3.1 Transaction Safety

```typescript
// All multi-step operations use transactions
function processScraperResults(dealerId: number, listings: CarListing[]) {
  const transaction = db.transaction(() => {
    // 1. Deactivate listings from this dealer not in new results
    const existingIds = db.getActiveListingIdsByDealer(dealerId);
    const newIds = new Set(listings.map(l => l.id));
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        db.deactivateListing(existingId);
      }
    }

    // 2. Upsert new listings
    for (const listing of listings) {
      const existing = db.getListingBySourceId(listing.source_listing_id);
      if (existing) {
        // Track price changes
        if (existing.asking_price !== listing.asking_price) {
          db.insertPriceHistory(existing.id, listing.asking_price);
          listing.price_dropped = listing.asking_price < existing.asking_price ? 1 : 0;
          listing.price_drop_count = existing.price_drop_count + (listing.price_dropped ? 1 : 0);
        }
        db.updateListing(existing.id, listing);
      } else {
        db.insertListing(listing);
      }
    }

    // 3. Log scrape result
    db.insertScrapeLog({
      dealer_id: dealerId,
      listings_found: listings.length,
      new_listings: listings.filter(l => !db.getListingBySourceId(l.source_listing_id)).length,
    });
  });

  transaction(); // Atomic — all or nothing
}
```

### 3.2 Dedup Edge Cases

```typescript
function dedup(newListing: CarListing, existingListings: CarListing[]): DeduplicationResult {
  // LAYER 1: Exact VIN match (highest confidence)
  if (newListing.vin && newListing.vin.length === 17) {
    const vinMatch = existingListings.find(l => l.vin === newListing.vin);
    if (vinMatch) {
      return { isDuplicate: true, matchedId: vinMatch.id, confidence: 1.0, matchType: 'vin_exact' };
    }
  }

  // LAYER 2: Fuzzy match — same car, different sources
  for (const existing of existingListings) {
    if (existing.year !== newListing.year) continue;
    if (existing.make !== newListing.make) continue;
    if (existing.model !== newListing.model) continue;

    const mileageDiff = Math.abs(existing.mileage - newListing.mileage);
    const priceDiff = Math.abs(existing.asking_price - newListing.asking_price);

    // Tight match: same car appearing on multiple sites
    if (mileageDiff < 200 && priceDiff < 200) {
      return { isDuplicate: true, matchedId: existing.id, confidence: 0.95, matchType: 'fuzzy_tight' };
    }

    // Loose match: price may have changed between scrapes
    if (mileageDiff < 500 && priceDiff < 1000 && existing.seller_name === newListing.seller_name) {
      return { isDuplicate: true, matchedId: existing.id, confidence: 0.85, matchType: 'fuzzy_same_seller' };
    }

    // Color + trim match as additional signal
    if (mileageDiff < 1000 && existing.exterior_color === newListing.exterior_color
        && existing.trim === newListing.trim) {
      return { isDuplicate: true, matchedId: existing.id, confidence: 0.75, matchType: 'fuzzy_color_trim' };
    }
  }

  return { isDuplicate: false, matchedId: null, confidence: 0, matchType: 'none' };
}

// MERGE logic when duplicate found
function mergeListings(existing: CarListing, incoming: CarListing): CarListing {
  // Keep the richer data from each source
  const merged = { ...existing };

  // Always update: last_seen, is_active
  merged.last_seen = new Date().toISOString();
  merged.is_active = 1;

  // Track all sources
  const sources = JSON.parse(existing.sources_found_on || '[]');
  if (!sources.includes(incoming.source)) {
    sources.push(incoming.source);
    merged.sources_found_on = JSON.stringify(sources);
    merged.is_multi_source = sources.length > 1 ? 1 : 0;
  }

  // Prefer data from the source with more info
  if (!existing.vin && incoming.vin) merged.vin = incoming.vin;
  if (!existing.engine && incoming.engine) merged.engine = incoming.engine;
  if (!existing.transmission && incoming.transmission) merged.transmission = incoming.transmission;
  if ((!existing.photos || existing.photos === '[]') && incoming.photos) merged.photos = incoming.photos;
  if (!existing.seller_phone && incoming.seller_phone) merged.seller_phone = incoming.seller_phone;
  if (!existing.description && incoming.description) merged.description = incoming.description;

  // Price: use the most recently seen price
  if (incoming.asking_price !== existing.asking_price) {
    merged.asking_price = incoming.asking_price;
    // Track the change
    db.insertPriceHistory(existing.id, incoming.asking_price);
  }

  return merged;
}
```

### 3.3 Data Validation Pipeline

```typescript
// Every listing goes through validation BEFORE entering the database
function validateListing(listing: Partial<CarListing>): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: Record<string, any> = {};

  // ── REQUIRED FIELDS ──
  if (!listing.year || listing.year < 1980 || listing.year > new Date().getFullYear() + 1) {
    errors.push(`Invalid year: ${listing.year}`);
  }
  if (!listing.make || listing.make.length < 2) {
    errors.push(`Invalid make: ${listing.make}`);
  }
  if (!listing.model || listing.model.length < 1) {
    errors.push(`Invalid model: ${listing.model}`);
  }
  if (!listing.mileage || listing.mileage < 0 || listing.mileage > 500000) {
    errors.push(`Invalid mileage: ${listing.mileage}`);
  }
  if (!listing.asking_price || listing.asking_price < 100 || listing.asking_price > 500000) {
    errors.push(`Invalid price: ${listing.asking_price}`);
  }

  // ── AUTO-FIXES ──
  // Normalize make name
  if (listing.make) {
    const normalized = normalizeMake(listing.make);
    if (normalized !== listing.make) {
      fixes.make = normalized;
    }
  }

  // Fix common price mistakes (listed in cents, listed with extra zeros)
  if (listing.asking_price && listing.asking_price > 100000 && listing.year < 2020) {
    warnings.push(`Price $${listing.asking_price} seems too high — possible cents-vs-dollars error`);
  }

  // VIN format validation
  if (listing.vin) {
    listing.vin = listing.vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (listing.vin.length !== 17) {
      warnings.push(`VIN "${listing.vin}" is not 17 characters — clearing`);
      fixes.vin = null;
    }
    // VIN never contains I, O, Q
    if (/[IOQ]/.test(listing.vin)) {
      warnings.push(`VIN contains invalid characters (I, O, or Q) — likely OCR error`);
    }
  }

  // Trim whitespace from all string fields
  for (const [key, value] of Object.entries(listing)) {
    if (typeof value === 'string') {
      fixes[key] = value.trim();
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixes,
    fixedListing: { ...listing, ...fixes }
  };
}
```

---

## 4. ANTI-DETECTION (SCRAPING)

### 4.1 User-Agent Rotation

```typescript
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:134.0) Gecko/20100101 Firefox/134.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  // Refresh this list every few months from whatismybrowser.com
];

let uaIndex = 0;
function getRotatingUserAgent(): string {
  return USER_AGENTS[uaIndex++ % USER_AGENTS.length];
}
```

### 4.2 Request Throttling

```typescript
class RateLimiter {
  private queues: Map<string, number[]> = new Map();

  // Per-domain rate limiting
  async waitForSlot(domain: string, maxPerMinute: number = 15): Promise<void> {
    const now = Date.now();
    const history = this.queues.get(domain) || [];

    // Remove entries older than 1 minute
    const recent = history.filter(t => now - t < 60000);

    if (recent.length >= maxPerMinute) {
      const waitMs = 60000 - (now - recent[0]);
      console.log(`Rate limiting ${domain} — waiting ${waitMs}ms`);
      await sleep(waitMs);
    }

    recent.push(Date.now());
    this.queues.set(domain, recent);
  }
}

const rateLimiter = new RateLimiter();

// Per-domain limits
const RATE_LIMITS: Record<string, number> = {
  'craigslist.org': 10,         // 10 req/min — they're lenient but respect it
  'api.marketcheck.com': 30,    // 30 req/min — paid API, generous
  'vpic.nhtsa.dot.gov': 20,     // 20 req/min — free, be respectful
  'facebook.com': 5,            // 5 req/min — aggressive anti-bot
  'default': 15,                // default for dealer sites
};
```

### 4.3 Playwright Anti-Detection

```typescript
async function createStealthContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent: getRotatingUserAgent(),
    viewport: { width: 1366 + randomInt(-50, 50), height: 768 + randomInt(-30, 30) },
    locale: 'en-US',
    timezoneId: 'America/Chicago',
    geolocation: { latitude: 29.51 + Math.random() * 0.05, longitude: -95.13 + Math.random() * 0.05 },
    permissions: ['geolocation'],
    colorScheme: 'light',
    deviceScaleFactor: 1,
  });

  // Remove navigator.webdriver flag
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    // Override plugins to look normal
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5] // non-empty plugin list
    });
    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });
  });

  return context;
}

// Human-like behavior
async function humanScroll(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  let position = 0;
  while (position < height) {
    const scrollAmount = 200 + Math.random() * 400;
    position += scrollAmount;
    await page.evaluate((y) => window.scrollTo(0, y), position);
    await sleep(500 + Math.random() * 1500); // Random pause
  }
}

async function humanClick(page: Page, selector: string) {
  const element = await page.$(selector);
  if (!element) return;
  const box = await element.boundingBox();
  if (!box) return;
  // Click at a slightly random offset within the element
  await page.mouse.click(
    box.x + box.width * (0.3 + Math.random() * 0.4),
    box.y + box.height * (0.3 + Math.random() * 0.4),
    { delay: 50 + Math.random() * 100 }
  );
}
```

### 4.4 IP & Session Management

```typescript
// For Facebook Marketplace specifically
// Rotate sessions to avoid account bans
class SessionManager {
  private sessions: { cookies: any[]; lastUsed: Date; useCount: number }[] = [];

  async getSession(): Promise<any[]> {
    // Find least-recently-used session
    const session = this.sessions
      .filter(s => s.useCount < 50) // max 50 uses per session
      .sort((a, b) => a.lastUsed.getTime() - b.lastUsed.getTime())[0];

    if (session) {
      session.lastUsed = new Date();
      session.useCount++;
      return session.cookies;
    }

    // No valid session — create new one (requires manual login)
    console.warn('All FB sessions exhausted — manual re-login needed');
    return [];
  }
}

// Cookie persistence between runs
function saveCookies(name: string, cookies: any[]) {
  writeFileSync(`data/cookies-${name}.json`, JSON.stringify(cookies));
}
function loadCookies(name: string): any[] {
  try {
    return JSON.parse(readFileSync(`data/cookies-${name}.json`, 'utf-8'));
  } catch {
    return [];
  }
}
```

---

## 5. PERFORMANCE

### 5.1 Database Optimization

```typescript
// Enable WAL mode — allows concurrent reads during writes
db.pragma('journal_mode = WAL');
db.pragma('cache_size = -64000');    // 64MB cache
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');   // Faster than FULL, still safe with WAL
db.pragma('temp_store = MEMORY');
db.pragma('mmap_size = 268435456');  // 256MB memory-mapped I/O

// Prepare statements ONCE, reuse many times
const stmts = {
  getActiveListing: db.prepare('SELECT * FROM listings WHERE is_active = 1'),
  getByVin: db.prepare('SELECT * FROM listings WHERE vin = ?'),
  getByMakeModel: db.prepare(`
    SELECT * FROM listings 
    WHERE make = ? AND model = ? AND is_active = 1 
    AND asking_price <= ? AND mileage <= ?
    ORDER BY deal_score DESC
    LIMIT ?
  `),
  insertListing: db.prepare(`
    INSERT INTO listings (id, vin, source, source_url, year, make, model, trim, 
    mileage, asking_price, title_status, seller_name, seller_location,
    first_seen, last_seen, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
  `),
  // ... all other queries as prepared statements
};
```

### 5.2 Scraping Concurrency

```typescript
// Process dealers in parallel but with a concurrency limit
import pLimit from 'p-limit';

const limit = pLimit(Number(process.env.MAX_CONCURRENT_SCRAPERS) || 3);

async function runFullScrape() {
  const dealers = db.getActiveDealers();

  // Group by priority
  const critical = dealers.filter(d => d.scrape_priority === 'critical');
  const high = dealers.filter(d => d.scrape_priority === 'high');
  const medium = dealers.filter(d => d.scrape_priority === 'medium');
  const low = dealers.filter(d => d.scrape_priority === 'low');

  // Scrape critical first, then high, etc.
  for (const group of [critical, high, medium, low]) {
    await Promise.all(
      group.map(dealer => limit(() => scrapeDealer(dealer)))
    );
  }

  // MarketCheck inventory search (runs alongside dealer scraping)
  const configs = db.getActiveSearchConfigs();
  for (const config of configs) {
    await limit(() => searchMarketCheck(config));
  }
}
```

### 5.3 Memory Management

```typescript
// Process large result sets in batches
function processListingsInBatches(listings: CarListing[], batchSize: number = 100) {
  for (let i = 0; i < listings.length; i += batchSize) {
    const batch = listings.slice(i, i + batchSize);

    const transaction = db.transaction(() => {
      for (const listing of batch) {
        processListing(listing);
      }
    });
    transaction();

    // Force garbage collection between batches if available
    if (global.gc) global.gc();
  }
}

// Clear VIN cache periodically to prevent memory bloat
setInterval(() => {
  const now = Date.now();
  for (const [vin, entry] of vinCache.entries()) {
    if (now - entry.timestamp > 86400000) { // 24hr
      vinCache.delete(vin);
    }
  }
}, 3600000); // Every hour

// Monitor memory usage
setInterval(() => {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  if (heapMB > 500) {
    console.warn(`High memory usage: ${heapMB}MB heap`);
  }
}, 60000); // Every minute
```

---

## 6. MONITORING & OBSERVABILITY

### 6.1 Health Check Endpoint

```typescript
app.get('/api/health', (req, res) => {
  const dbOk = (() => { try { db.prepare('SELECT 1').get(); return true; } catch { return false; } })();
  const lastScrape = db.getLastScrapeTime();
  const minutesSinceLastScrape = lastScrape 
    ? (Date.now() - new Date(lastScrape).getTime()) / 60000 
    : Infinity;

  const healthy = dbOk && minutesSinceLastScrape < 1440; // scrape within 24hr

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    database: dbOk ? 'ok' : 'error',
    last_scrape: lastScrape,
    minutes_since_scrape: Math.round(minutesSinceLastScrape),
    active_listings: db.countActiveListings(),
    active_dealers: db.countActiveDealers(),
    unresolved_audit_issues: db.countUnresolvedAuditIssues(),
    memory_mb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    uptime_hours: Math.round(process.uptime() / 3600),
  });
});
```

### 6.2 Structured Logging

```typescript
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      // Console output (pretty for dev)
      { target: 'pino-pretty', level: 'info', options: { colorize: true } },
      // File output (structured JSON for debugging)
      { target: 'pino/file', level: 'debug', options: { destination: 'data/logs/autoscout.log' } },
    ]
  },
  // Redact sensitive fields from logs
  redact: {
    paths: ['api_key', 'password', 'smtp_pass', 'cookies', 'authorization'],
    censor: '[REDACTED]'
  }
});

// Usage
logger.info({ dealer: dealer.name, listings: results.length }, 'Scrape completed');
logger.warn({ dealer: dealer.name, error: err.message }, 'Scrape failed');
logger.error({ vin, expected: decoded.make, actual: listing.make }, 'VIN mismatch detected');
```

### 6.3 Scraper Health Dashboard Data

```typescript
// API endpoint for monitoring scraper health
app.get('/api/scraper-health', (req, res) => {
  const dealers = db.getActiveDealers();
  
  const health = {
    total_dealers: dealers.length,
    by_status: {
      healthy: dealers.filter(d => d.scrape_success_rate > 0.8).length,
      degraded: dealers.filter(d => d.scrape_success_rate > 0.3 && d.scrape_success_rate <= 0.8).length,
      failing: dealers.filter(d => d.scrape_success_rate <= 0.3).length,
      never_scraped: dealers.filter(d => !d.last_scraped).length,
    },
    by_platform: groupBy(dealers, 'platform'),
    stale_dealers: dealers.filter(d => {
      if (!d.last_scraped) return true;
      const hoursSince = (Date.now() - new Date(d.last_scraped).getTime()) / 3600000;
      return hoursSince > 48;
    }).length,
    recent_errors: db.getRecentScrapeErrors(10),
    avg_scrape_duration_ms: db.getAvgScrapeDuration(),
  };

  res.json(health);
});
```

---

## 7. TESTING

### 7.1 Unit Tests

```typescript
// tests/normalizer.test.ts
describe('Make Normalization', () => {
  test('normalizes common aliases', () => {
    expect(normalizeMake('chevy')).toBe('Chevrolet');
    expect(normalizeMake('TOYOTA')).toBe('Toyota');
    expect(normalizeMake('vw')).toBe('Volkswagen');
    expect(normalizeMake('merc')).toBe('Mercedes-Benz');
  });

  test('handles edge cases', () => {
    expect(normalizeMake('')).toBe('');
    expect(normalizeMake('  Honda  ')).toBe('Honda');
    expect(normalizeMake('HONDA')).toBe('Honda');
  });
});

// tests/risk-scorer.test.ts
describe('Risk Scoring', () => {
  test('salvage title adds 30 points', () => {
    const listing = mockListing({ title_status: 'salvage' });
    expect(calculateRiskScore(listing, null)).toBeGreaterThanOrEqual(80);
  });

  test('1-owner clean title is low risk', () => {
    const listing = mockListing({ title_status: 'clean', owner_count: 1, accident_count: 0 });
    expect(calculateRiskScore(listing, null)).toBeLessThan(50);
  });

  test('overdue timing belt increases risk', () => {
    const listing = mockListing({ mileage: 130000 });
    const intel = mockModelIntel({ timing_type: 'belt', timing_interval_miles: 105000 });
    const score = calculateRiskScore(listing, intel);
    expect(score).toBeGreaterThan(calculateRiskScore(listing, null));
  });
});

// tests/dedup.test.ts
describe('Deduplication', () => {
  test('exact VIN match', () => {
    const a = mockListing({ vin: '1HGCP36878A080119' });
    const result = dedup(a, [mockListing({ vin: '1HGCP36878A080119' })]);
    expect(result.isDuplicate).toBe(true);
    expect(result.confidence).toBe(1.0);
  });

  test('fuzzy match — same car, different source', () => {
    const a = mockListing({ year: 2013, make: 'Toyota', model: 'Camry', mileage: 98000, asking_price: 5200 });
    const b = mockListing({ year: 2013, make: 'Toyota', model: 'Camry', mileage: 98050, asking_price: 5200 });
    const result = dedup(a, [b]);
    expect(result.isDuplicate).toBe(true);
  });

  test('different cars — not a duplicate', () => {
    const a = mockListing({ year: 2013, make: 'Toyota', model: 'Camry', mileage: 98000 });
    const b = mockListing({ year: 2013, make: 'Toyota', model: 'Camry', mileage: 145000 });
    const result = dedup(a, [b]);
    expect(result.isDuplicate).toBe(false);
  });
});

// tests/scam-detector.test.ts
describe('Scam Detection', () => {
  test('detects curbstoner', () => {
    const listing = mockListing({ seller_phone: '555-1234', seller_type: 'private' });
    const others = Array(5).fill(null).map(() => mockListing({ seller_phone: '555-1234' }));
    const result = detectScams(listing, others);
    expect(result.flags).toContainEqual(expect.stringContaining('CURBSTONER'));
  });

  test('flags no-photo listings', () => {
    const listing = mockListing({ photos: null });
    const result = detectScams(listing, []);
    expect(result.flags).toContainEqual(expect.stringContaining('NO PHOTOS'));
  });
});

// tests/repair-forecast.test.ts
describe('Repair Forecast', () => {
  test('flags overdue timing belt', () => {
    const listing = mockListing({ mileage: 130000 });
    const intel = mockModelIntel({ timing_type: 'belt', timing_interval_miles: 105000 });
    const forecast = generateRepairForecast(listing, intel, mockParts(), { laborMultiplier: 0.4 });
    expect(forecast.immediate_repairs.some(r => r.item.includes('Timing Belt'))).toBe(true);
    expect(forecast.timing_system.is_overdue).toBe(true);
  });

  test('no immediate repairs for well-maintained chain engine', () => {
    const listing = mockListing({ mileage: 100000 });
    const intel = mockModelIntel({ timing_type: 'chain' });
    const forecast = generateRepairForecast(listing, intel, mockParts(), { laborMultiplier: 0.4 });
    expect(forecast.immediate_repairs.length).toBe(0);
  });
});

// tests/validation.test.ts
describe('Listing Validation', () => {
  test('rejects invalid year', () => {
    const result = validateListing({ year: 1950, make: 'Toyota', model: 'Camry', mileage: 100000, asking_price: 5000 });
    expect(result.valid).toBe(false);
  });

  test('fixes VIN format', () => {
    const result = validateListing({ vin: '  1hgcp36878a080119  ', year: 2008, make: 'Honda', model: 'Accord', mileage: 127000, asking_price: 4000 });
    expect(result.fixedListing.vin).toBe('1HGCP36878A080119');
  });

  test('rejects VIN with I, O, Q', () => {
    const result = validateListing({ vin: '1HGCP36878AO80119', year: 2008, make: 'Honda', model: 'Accord', mileage: 127000, asking_price: 4000 });
    expect(result.warnings.some(w => w.includes('invalid characters'))).toBe(true);
  });
});
```

### 7.2 Integration Tests

```typescript
// tests/integration/scraper-pipeline.test.ts
describe('Full Scraper Pipeline', () => {
  test('Craigslist RSS → normalize → dedup → enrich → store', async () => {
    const rss = await fetchCraigslistRSS('test-fixtures/craigslist-sample.xml');
    expect(rss.length).toBeGreaterThan(0);

    const normalized = rss.map(normalizeListng);
    const deduped = removeDuplicates(normalized, []);
    const enriched = await Promise.all(deduped.map(enrichListing));

    for (const listing of enriched) {
      const validation = validateListing(listing);
      expect(validation.valid).toBe(true);
    }
  });
});
```

### 7.3 Scraper Smoke Tests

```typescript
// Run before deploying changes — verify each scraper still works
async function smokeTestAllScrapers() {
  const results: { name: string; ok: boolean; error?: string }[] = [];

  // Test Craigslist
  try {
    const listings = await craigslistScraper.scrape({ query: 'Toyota Camry', limit: 3 });
    results.push({ name: 'Craigslist', ok: listings.length > 0 });
  } catch (e) {
    results.push({ name: 'Craigslist', ok: false, error: e.message });
  }

  // Test MarketCheck
  try {
    const listings = await marketcheck.search({ make: 'Toyota', model: 'Camry', limit: 3 });
    results.push({ name: 'MarketCheck', ok: listings.length > 0 });
  } catch (e) {
    results.push({ name: 'MarketCheck', ok: false, error: e.message });
  }

  // Test NHTSA
  try {
    const decoded = await vinDecode('4T1BF3EK2BU765897');
    results.push({ name: 'NHTSA VIN', ok: decoded.make === 'Toyota' });
  } catch (e) {
    results.push({ name: 'NHTSA VIN', ok: false, error: e.message });
  }

  console.table(results);
  return results.every(r => r.ok);
}
```

---

## 8. DEPLOYMENT CHECKLIST

```
Before first run:
□ .env file created with all required keys
□ .env permissions set to 600
□ .gitignore includes: .env, data/*.db, data/backups/, data/logs/, data/cookies-*
□ Node.js 20+ installed
□ npm install completed
□ Database initialized: npm run seed-db
□ Model intelligence seeded: 80+ entries verified
□ Parts pricing seeded: 30+ models verified
□ At least 1 dealer added or Google Places discovery run
□ Smoke test passed: npm run smoke-test
□ PM2 installed for process management

Before each scrape cycle:
□ Database backup completed (automated)
□ Stale listings deactivated (automated)
□ Audit sweep completed (automated)
□ Scraper health check shows no critical failures

Monthly maintenance:
□ Rotate API keys if exposed
□ Update User-Agent strings
□ Review audit_log for patterns
□ Compact SQLite: VACUUM
□ Review dealer success rates — remove dead dealers
□ Update model_intelligence with any new known issues
□ Update parts_pricing if costs have changed
□ Check PM2 restart count — investigate if high
```

---

## 9. COST CONTROL

```typescript
// Track MarketCheck API spending
let dailyApiCalls = 0;
const DAILY_BUDGET_CALLS = 500; // ~$1-4/day depending on endpoint

async function marketCheckCallWithBudget(url: string, params: any): Promise<any> {
  if (dailyApiCalls >= DAILY_BUDGET_CALLS) {
    console.warn('MarketCheck daily budget exhausted — skipping');
    return null;
  }

  dailyApiCalls++;
  const response = await secureFetch(url, { params });
  
  // Log spend
  logger.info({ 
    endpoint: url, 
    daily_calls: dailyApiCalls, 
    budget_remaining: DAILY_BUDGET_CALLS - dailyApiCalls 
  }, 'MarketCheck API call');

  return response;
}

// Reset counter at midnight
cron.schedule('0 0 * * *', () => { dailyApiCalls = 0; });

// Gemini API spend tracking
let dailyGeminiTokens = 0;
const DAILY_GEMINI_BUDGET = 100000; // 100k tokens/day = well within free tier

async function geminiCallWithBudget(prompt: string): Promise<string> {
  const estimatedTokens = Math.ceil(prompt.length / 4);
  if (dailyGeminiTokens + estimatedTokens > DAILY_GEMINI_BUDGET) {
    console.warn('Gemini daily token budget exhausted — falling back to Ollama');
    return ollamaCall(prompt); // free local fallback
  }
  dailyGeminiTokens += estimatedTokens;
  return geminiCall(prompt);
}
```
