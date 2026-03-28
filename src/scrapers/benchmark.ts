// ── Benchmark Price Scraper ──────────────────────────────────────
// Scrapes retail price benchmarks from Carvana and CarMax for market
// comparison.  These represent the retail ceiling -- what a consumer
// would pay at a no-haggle online retailer.  Useful for evaluating
// whether a deal from a local dealer or private seller is competitive.
// -------------------------------------------------------------------

import { BaseScraper, type ScraperResult, type ScrapedListing } from './base.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface BenchmarkSearchParams {
  make: string;
  model: string;
  yearMin?: number;
  yearMax?: number;
}

interface PartialResult {
  listings: ScrapedListing[];
  errors: string[];
}

// ── Carvana API types ───────────────────────────────────────────

interface CarvanaSearchResult {
  inventory?: CarvanaVehicle[];
  totalResults?: number;
}

interface CarvanaVehicle {
  id?: number;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  bodyType?: string;
  mileage?: number;
  price?: number;
  exteriorColor?: string;
  interiorColor?: string;
  driveTrain?: string;
  engine?: string;
  transmission?: string;
  fuelType?: string;
  stockNumber?: string;
  imageUrls?: string[];
  lowResImageUrls?: string[];
  vehicleUrl?: string;
}

// ── CarMax API types ────────────────────────────────────────────

interface CarMaxSearchResponse {
  items?: CarMaxVehicle[];
  totalCount?: number;
}

interface CarMaxVehicle {
  stockNumber?: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  body?: string;
  mileage?: number;
  price?: number;
  exteriorColor?: string;
  interiorColor?: string;
  driveTrain?: string;
  engine?: string;
  mpgCity?: number;
  mpgHighway?: number;
  transmission?: string;
  fuelType?: string;
  photoUrl?: string;
  link?: string;
}

// ── Scraper class ───────────────────────────────────────────────

export class BenchmarkScraper extends BaseScraper {
  name = 'benchmark';

  async scrape(options?: BenchmarkSearchParams): Promise<ScraperResult> {
    const startTime = Date.now();
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    if (!options?.make || !options?.model) {
      return { success: false, listings: [], errors: ['make and model required'], duration_ms: 0 };
    }

    // Run Carvana and CarMax in parallel for speed
    const [carvana, carmax] = await Promise.all([
      this.scrapeCarvana(options.make, options.model, options.yearMin, options.yearMax),
      this.scrapeCarMax(options.make, options.model, options.yearMin, options.yearMax),
    ]);

    listings.push(...carvana.listings);
    if (carvana.errors.length) errors.push(...carvana.errors);

    listings.push(...carmax.listings);
    if (carmax.errors.length) errors.push(...carmax.errors);

    logger.info(
      {
        make: options.make,
        model: options.model,
        carvanaCount: carvana.listings.length,
        carmaxCount: carmax.listings.length,
        totalErrors: errors.length,
      },
      'Benchmark scrape complete',
    );

    return {
      success: listings.length > 0,
      listings,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }

  // ── Carvana ───────────────────────────────────────────────────

  private async scrapeCarvana(
    make: string,
    model: string,
    yearMin?: number,
    yearMax?: number,
  ): Promise<PartialResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    try {
      // Carvana's public search page exposes inventory data via their
      // internal API.  The search page at /cars/{make}-{model} loads a
      // JSON payload we can request directly via their search endpoint.
      const slug = `${make}-${model}`.toLowerCase().replace(/\s+/g, '-');

      // Build filter query string
      const filters: string[] = [];
      if (yearMin) filters.push(`year-min=${yearMin}`);
      if (yearMax) filters.push(`year-max=${yearMax}`);
      const filterStr = filters.length > 0 ? `?${filters.join('&')}` : '';

      const url = `https://www.carvana.com/cars/${slug}${filterStr}`;

      logger.info({ url }, 'Benchmark: fetching Carvana');

      const resp = await fetch(url, {
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`Carvana HTTP ${resp.status}`);
      }

      const html = await resp.text();

      // Carvana embeds vehicle data in a __NEXT_DATA__ or window.__PRELOADED_STATE__
      // JSON blob within a <script> tag.
      const vehicles = this.extractCarvanaData(html);

      for (const v of vehicles) {
        const year = v.year ?? 0;
        if (!year) continue;

        // Resolve photo URLs
        const photos = v.imageUrls ?? v.lowResImageUrls ?? [];

        // Build detail URL
        let sourceUrl: string | null = null;
        if (v.vehicleUrl) {
          sourceUrl = v.vehicleUrl.startsWith('http')
            ? v.vehicleUrl
            : `https://www.carvana.com${v.vehicleUrl}`;
        } else if (v.id) {
          sourceUrl = `https://www.carvana.com/vehicle/${v.id}`;
        }

        listings.push({
          vin: v.vin ?? null,
          source: 'carvana',
          source_url: sourceUrl,
          source_listing_id: v.vin ?? v.stockNumber ?? `carvana-${v.id ?? year}`,
          year,
          make: v.make ?? make,
          model: v.model ?? model,
          trim: v.trim ?? '',
          body_style: v.bodyType ?? null,
          engine: v.engine ?? null,
          transmission: v.transmission ?? null,
          drivetrain: v.driveTrain ?? null,
          exterior_color: v.exteriorColor ?? null,
          interior_color: v.interiorColor ?? null,
          fuel_type: v.fuelType ?? null,
          mileage: v.mileage ?? 0,
          asking_price: v.price ?? 0,
          title_status: 'clean',
          seller_type: 'retail_benchmark',
          seller_name: 'Carvana',
          seller_phone: null,
          seller_location: null,
          photos: photos.length > 0 ? JSON.stringify(photos) : null,
          description: null,
          scrape_confidence: 0.95,
          scrape_tier: 'benchmark',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Carvana: ${msg}`);
      logger.warn({ error: msg }, 'Benchmark: Carvana scrape failed');
    }

    return { listings, errors };
  }

  /**
   * Extract vehicle data from Carvana's HTML page.
   * Carvana embeds structured data in several possible locations:
   * - __NEXT_DATA__ script tag (Next.js data)
   * - window.__PRELOADED_STATE__ (Redux state)
   * - JSON-LD structured data
   */
  private extractCarvanaData(html: string): CarvanaVehicle[] {
    // Try __NEXT_DATA__ first
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        // Navigate through Next.js data structure to find vehicle inventory
        const pageProps = data?.props?.pageProps;
        if (pageProps?.inventory) {
          return pageProps.inventory as CarvanaVehicle[];
        }
        if (pageProps?.initialState?.inventory?.vehicles) {
          return pageProps.initialState.inventory.vehicles as CarvanaVehicle[];
        }
        // Search recursively for any array of objects with 'vin' keys
        const vehicles = this.findVehicleArrays(pageProps);
        if (vehicles.length > 0) return vehicles;
      } catch {
        // Malformed JSON, try next strategy
      }
    }

    // Try __PRELOADED_STATE__
    const preloadMatch = html.match(/window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?});?\s*<\/script>/i);
    if (preloadMatch) {
      try {
        const state = JSON.parse(preloadMatch[1]);
        const searchResult = state?.search as CarvanaSearchResult | undefined;
        if (searchResult?.inventory) {
          return searchResult.inventory;
        }
      } catch {
        // Malformed JSON
      }
    }

    // Fallback: look for any large JSON array in script tags that
    // contains objects with vehicle-like properties
    const jsonArrayMatch = html.match(/"inventory"\s*:\s*(\[[\s\S]*?\])\s*[,}]/);
    if (jsonArrayMatch) {
      try {
        return JSON.parse(jsonArrayMatch[1]) as CarvanaVehicle[];
      } catch {
        // Not valid JSON
      }
    }

    return [];
  }

  /**
   * Recursively search a nested object for arrays of vehicle-like objects.
   */
  private findVehicleArrays(obj: unknown, depth = 0): CarvanaVehicle[] {
    if (depth > 5 || !obj || typeof obj !== 'object') return [];

    if (Array.isArray(obj)) {
      // Check if this array contains vehicle-like objects
      if (obj.length > 0 && typeof obj[0] === 'object' && obj[0] !== null) {
        const first = obj[0] as Record<string, unknown>;
        if ('vin' in first || ('year' in first && 'make' in first)) {
          return obj as CarvanaVehicle[];
        }
      }
      // Search within array elements
      for (const item of obj) {
        const found = this.findVehicleArrays(item, depth + 1);
        if (found.length > 0) return found;
      }
    } else {
      // Search object values
      for (const value of Object.values(obj as Record<string, unknown>)) {
        const found = this.findVehicleArrays(value, depth + 1);
        if (found.length > 0) return found;
      }
    }

    return [];
  }

  // ── CarMax ────────────────────────────────────────────────────

  private async scrapeCarMax(
    make: string,
    model: string,
    yearMin?: number,
    yearMax?: number,
  ): Promise<PartialResult> {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    try {
      // CarMax exposes a search API that returns JSON.
      // The public search page at /cars/{make}/{model} uses this internally.
      const searchUrl = new URL('https://www.carmax.com/cars/api/search/run');
      searchUrl.searchParams.set('uri', `/cars/${make.toLowerCase()}/${model.toLowerCase()}`);
      searchUrl.searchParams.set('skip', '0');
      searchUrl.searchParams.set('take', '24');
      searchUrl.searchParams.set('zipCode', '77573'); // Default to Houston area

      if (yearMin) searchUrl.searchParams.set('yearMin', String(yearMin));
      if (yearMax) searchUrl.searchParams.set('yearMax', String(yearMax));

      logger.info({ url: searchUrl.toString() }, 'Benchmark: fetching CarMax');

      const resp = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'application/json',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        // CarMax may block direct API access; fall back to HTML scraping
        if (resp.status === 403 || resp.status === 429) {
          logger.info('Benchmark: CarMax API blocked, trying HTML fallback');
          return this.scrapeCarMaxHtml(make, model, yearMin, yearMax);
        }
        throw new Error(`CarMax HTTP ${resp.status}`);
      }

      const contentType = resp.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const data = (await resp.json()) as CarMaxSearchResponse;
        const items = data.items ?? [];

        for (const v of items) {
          const year = v.year ?? 0;
          if (!year) continue;

          const photos: string[] = [];
          if (v.photoUrl) {
            photos.push(v.photoUrl);
          }

          let sourceUrl: string | null = null;
          if (v.link) {
            sourceUrl = v.link.startsWith('http')
              ? v.link
              : `https://www.carmax.com${v.link}`;
          } else if (v.stockNumber) {
            sourceUrl = `https://www.carmax.com/car/${v.stockNumber}`;
          }

          listings.push({
            vin: v.vin ?? null,
            source: 'carmax',
            source_url: sourceUrl,
            source_listing_id: v.vin ?? v.stockNumber ?? `carmax-${year}-${v.make}-${v.model}`,
            year,
            make: v.make ?? make,
            model: v.model ?? model,
            trim: v.trim ?? '',
            body_style: v.body ?? null,
            engine: v.engine ?? null,
            transmission: v.transmission ?? null,
            drivetrain: v.driveTrain ?? null,
            exterior_color: v.exteriorColor ?? null,
            interior_color: v.interiorColor ?? null,
            fuel_type: v.fuelType ?? null,
            mileage: v.mileage ?? 0,
            asking_price: v.price ?? 0,
            title_status: 'clean',
            seller_type: 'retail_benchmark',
            seller_name: 'CarMax',
            seller_phone: null,
            seller_location: null,
            photos: photos.length > 0 ? JSON.stringify(photos) : null,
            description: null,
            scrape_confidence: 0.95,
            scrape_tier: 'benchmark',
          });
        }
      } else {
        // Got HTML instead of JSON, parse it
        const html = await resp.text();
        const htmlResult = this.parseCarMaxHtml(html, make, model);
        listings.push(...htmlResult.listings);
        if (htmlResult.errors.length) errors.push(...htmlResult.errors);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`CarMax: ${msg}`);
      logger.warn({ error: msg }, 'Benchmark: CarMax scrape failed');
    }

    return { listings, errors };
  }

  /**
   * Fallback: scrape CarMax search results from the HTML page when
   * the JSON API is not accessible.
   */
  private async scrapeCarMaxHtml(
    make: string,
    model: string,
    yearMin?: number,
    yearMax?: number,
  ): Promise<PartialResult> {
    const errors: string[] = [];

    try {
      const slug = `${make.toLowerCase()}/${model.toLowerCase()}`;
      const params = new URLSearchParams();
      if (yearMin) params.set('year', `${yearMin}-${yearMax ?? yearMin}`);

      const url = `https://www.carmax.com/cars/${slug}${params.toString() ? '?' + params.toString() : ''}`;

      const resp = await fetch(url, {
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'text/html',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`CarMax HTML HTTP ${resp.status}`);
      }

      const html = await resp.text();
      return this.parseCarMaxHtml(html, make, model);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`CarMax HTML fallback: ${msg}`);
      return { listings: [], errors };
    }
  }

  /**
   * Parse CarMax HTML page for vehicle listings.
   * CarMax may embed vehicle data in __NEXT_DATA__ or render it
   * in structured HTML elements.
   */
  private parseCarMaxHtml(html: string, make: string, model: string): PartialResult {
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    // Try __NEXT_DATA__ extraction (CarMax uses Next.js)
    const nextDataMatch = html.match(/<script\s+id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
    if (nextDataMatch) {
      try {
        const data = JSON.parse(nextDataMatch[1]);
        const vehicles = this.findVehicleArrays(data?.props?.pageProps);

        for (const v of vehicles) {
          const vehicle = v as unknown as CarMaxVehicle;
          const year = vehicle.year ?? 0;
          if (!year) continue;

          const photos: string[] = [];
          if (vehicle.photoUrl) photos.push(vehicle.photoUrl);

          listings.push({
            vin: vehicle.vin ?? null,
            source: 'carmax',
            source_url: vehicle.link
              ? `https://www.carmax.com${vehicle.link}`
              : null,
            source_listing_id: vehicle.vin ?? vehicle.stockNumber ?? `carmax-${year}`,
            year,
            make: vehicle.make ?? make,
            model: vehicle.model ?? model,
            trim: vehicle.trim ?? '',
            body_style: vehicle.body ?? null,
            engine: vehicle.engine ?? null,
            transmission: vehicle.transmission ?? null,
            drivetrain: vehicle.driveTrain ?? null,
            exterior_color: vehicle.exteriorColor ?? null,
            interior_color: vehicle.interiorColor ?? null,
            fuel_type: vehicle.fuelType ?? null,
            mileage: vehicle.mileage ?? 0,
            asking_price: vehicle.price ?? 0,
            title_status: 'clean',
            seller_type: 'retail_benchmark',
            seller_name: 'CarMax',
            seller_phone: null,
            seller_location: null,
            photos: photos.length > 0 ? JSON.stringify(photos) : null,
            description: null,
            scrape_confidence: 0.95,
            scrape_tier: 'benchmark',
          });
        }
      } catch {
        errors.push('CarMax: failed to parse __NEXT_DATA__');
      }
    }

    return { listings, errors };
  }
}
