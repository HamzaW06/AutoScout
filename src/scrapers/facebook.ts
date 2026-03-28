// ── Facebook Marketplace Scraper ─────────────────────────────────
// Stub implementation for scraping Facebook Marketplace vehicle
// listings using Playwright.  This is the most complex scraper due
// to Facebook's anti-bot measures, login requirements, and dynamic
// rendering.  Full implementation requires Playwright with stealth
// mode and pre-authenticated cookies.
//
// Status: STUB - returns an error with setup instructions.
// -------------------------------------------------------------------

import { BaseScraper, type ScraperResult } from './base.js';
import { logger } from '../logger.js';

export interface FacebookSearchParams {
  query?: string;
  minPrice?: number;
  maxPrice?: number;
  maxMiles?: number;
  location?: string;
  daysSinceListed?: number;
  sortBy?: 'best_match' | 'price_ascend' | 'price_descend' | 'date_listed';
}

/**
 * Facebook Marketplace vehicle scraper.
 *
 * ## Architecture (full implementation)
 *
 * 1. **Browser launch**: Playwright Chromium with stealth context
 *    (anti-fingerprinting, WebGL spoofing, consistent viewport).
 *
 * 2. **Session management**: Load cookies from `data/cookies-facebook.json`.
 *    User must complete initial manual login:
 *    ```
 *    npx playwright codegen https://www.facebook.com/login
 *    ```
 *    Then export cookies via browser context.
 *
 * 3. **Search URL construction**:
 *    ```
 *    https://www.facebook.com/marketplace/{city}/vehicles
 *      ?minPrice={min}&maxPrice={max}&daysSinceListed={days}
 *      &sortBy=creation_time_descend
 *    ```
 *
 * 4. **Infinite scroll**: Scroll the page incrementally, waiting for
 *    new listing cards to appear.  Stop after N scrolls or when no
 *    new cards load.
 *
 * 5. **Card parsing**: Each listing card contains:
 *    - Title (year make model in the heading)
 *    - Price
 *    - Location / distance
 *    - Thumbnail image
 *    - Link to detail page
 *
 * 6. **Detail page scraping** (optional, rate-limited):
 *    Navigate to each listing for:
 *    - Full description
 *    - Seller name and profile link
 *    - All photos
 *    - Vehicle details (mileage, VIN if listed)
 *    - Estimated distance from location
 *
 * 7. **Human-like delays**: Random delays (2-5s) between actions,
 *    occasional mouse movements, realistic scroll patterns.
 *
 * 8. **Cookie persistence**: Save updated cookies after each session
 *    to maintain the login state.
 *
 * ## Requirements
 * ```
 * npm install playwright
 * npx playwright install chromium
 * ```
 *
 * ## Known challenges
 * - Facebook aggressively detects automation; accounts may be locked
 * - Login requires 2FA handling
 * - Marketplace availability varies by region
 * - Rate limits are strict and unpredictable
 * - DOM structure changes frequently
 */
export class FacebookMarketplaceScraper extends BaseScraper {
  name = 'facebook';

  async scrape(options?: FacebookSearchParams): Promise<ScraperResult> {
    const startTime = Date.now();

    logger.warn(
      { options },
      'Facebook Marketplace scraper is a stub - Playwright not configured',
    );

    // In a full implementation this would:
    // 1. Check for Playwright installation
    // 2. Load cookies
    // 3. Launch browser
    // 4. Navigate and scrape
    // 5. Return listings

    return {
      success: false,
      listings: [],
      errors: [
        'Facebook Marketplace scraper requires Playwright setup.',
        'Install: npm install playwright && npx playwright install chromium',
        'Then authenticate manually and save cookies to data/cookies-facebook.json.',
      ],
      duration_ms: Date.now() - startTime,
    };
  }
}
