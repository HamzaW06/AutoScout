import { config } from '../config.js';
import { logger } from '../logger.js';
import { getSetting } from '../db/queries.js';

const BASE_URL = 'https://mc-api.marketcheck.com/v2';

// Budget tracking
let dailyCallCount = 0;
const DAILY_BUDGET = 500;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketCheckSearchParams {
  make?: string;
  model?: string;
  year?: number | string; // can be range like "2010-2015"
  priceRange?: string; // "5000-15000"
  milesRange?: string; // "0-150000"
  radius?: number;
  rows?: number; // max 50
  start?: number; // pagination offset
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface NormalizedListing {
  vin: string | null;
  source: string;
  source_url: string | null;
  source_listing_id: string;
  year: number;
  make: string;
  model: string;
  trim: string;
  body_style: string | null;
  engine: string | null;
  transmission: string | null;
  drivetrain: string | null;
  exterior_color: string | null;
  interior_color: string | null;
  fuel_type: string | null;
  mileage: number;
  asking_price: number;
  market_value: number | null;
  days_on_market: number | null;
  seller_type: string | null;
  seller_name: string | null;
  seller_phone: string | null;
  seller_location: string | null;
  seller_lat: number | null;
  seller_lng: number | null;
  photos: string | null; // JSON array
  description: string | null;
  scrape_confidence: number;
  scrape_tier?: string;
}

export interface MarketCheckSearchResult {
  numFound: number;
  listings: NormalizedListing[];
}

/** Raw listing shape returned by the MarketCheck API. */
interface RawMarketCheckListing {
  id?: string;
  vin?: string;
  heading?: string;
  price?: number;
  miles?: number;
  stock_no?: string;
  ref_price?: number;
  ref_price_dt?: string;
  dom?: number;
  seller_type?: string;
  inventory_type?: string;
  source?: string;
  exterior_color?: string;
  interior_color?: string;
  vdp_url?: string;
  build?: {
    year?: number;
    make?: string;
    model?: string;
    trim?: string;
    body_type?: string;
    vehicle_type?: string;
    drivetrain?: string;
    transmission?: string;
    fuel_type?: string;
    engine?: string;
    engine_size?: string;
    doors?: number;
    cylinders?: number;
    made_in?: string;
  };
  dealer?: {
    id?: number;
    name?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    phone?: string;
    website?: string;
    dealer_type?: string;
  };
  media?: {
    photo_links?: string[];
  };
  extra?: {
    seller_comment?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class MarketCheckError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'MarketCheckError';
  }
}

function sanitizeSecret(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^"|"$/g, '');
}

function resolveApiKey(): string {
  const envKey = sanitizeSecret(config.marketCheckApiKey);
  if (envKey) return envKey;

  // Fallback to persisted runtime setting if present.
  try {
    return sanitizeSecret(getSetting('marketcheck_api_key'));
  } catch {
    return '';
  }
}

function ensureApiKey(): void {
  if (!resolveApiKey()) {
    throw new MarketCheckError('MarketCheck API key is not configured');
  }
}

function ensureBudget(): void {
  if (dailyCallCount >= DAILY_BUDGET) {
    throw new MarketCheckError(
      `Daily API call budget exhausted (${DAILY_BUDGET} calls)`,
    );
  }
}

/**
 * Generic fetch wrapper with timeout, budget tracking, and error handling.
 */
async function apiFetch<T>(
  path: string,
  params: Record<string, string>,
): Promise<T> {
  ensureApiKey();
  ensureBudget();
  const apiKey = resolveApiKey();

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set('api_key', apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  dailyCallCount++;
  logger.info(
    { endpoint: path, dailyCallCount },
    `MarketCheck API call #${dailyCallCount}: ${path}`,
  );

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');

      if (response.status === 401) {
        throw new MarketCheckError('Invalid MarketCheck API key', 401);
      }
      if (response.status === 429) {
        throw new MarketCheckError('MarketCheck rate limit exceeded', 429);
      }
      throw new MarketCheckError(
        `MarketCheck API error ${response.status}: ${body}`,
        response.status,
      );
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof MarketCheckError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new MarketCheckError('MarketCheck API request timed out (15s)');
    }

    throw new MarketCheckError(
      `MarketCheck API request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeListing(raw: RawMarketCheckListing): NormalizedListing {
  const build = raw.build ?? {};
  const dealer = raw.dealer ?? {};
  const media = raw.media ?? {};
  const extra = raw.extra ?? {};

  const dealerLocation =
    dealer.city && dealer.state
      ? `${dealer.city}, ${dealer.state} ${dealer.zip ?? ''}`.trim()
      : null;

  return {
    vin: raw.vin ?? null,
    source: 'marketcheck',
    source_url: raw.vdp_url ?? null,
    source_listing_id: raw.id ?? raw.vin ?? '',
    year: build.year ?? 0,
    make: build.make ?? '',
    model: build.model ?? '',
    trim: build.trim ?? '',
    body_style: build.body_type ?? null,
    engine: build.engine ?? null,
    transmission: build.transmission ?? null,
    drivetrain: build.drivetrain ?? null,
    exterior_color: raw.exterior_color ?? null,
    interior_color: raw.interior_color ?? null,
    fuel_type: build.fuel_type ?? null,
    mileage: raw.miles ?? 0,
    asking_price: raw.price ?? 0,
    market_value: raw.ref_price ?? null,
    days_on_market: raw.dom ?? null,
    seller_type: raw.seller_type ?? null,
    seller_name: dealer.name ?? null,
    seller_phone: dealer.phone ?? null,
    seller_location: dealerLocation,
    seller_lat: dealer.latitude ?? null,
    seller_lng: dealer.longitude ?? null,
    photos: media.photo_links ? JSON.stringify(media.photo_links) : null,
    description: extra.seller_comment ?? null,
    scrape_confidence: 0.95,
    scrape_tier: 'api_discovery',
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search active dealer inventory on MarketCheck.
 *
 * Uses `config.userLat` / `config.userLng` as default coordinates when no
 * explicit latitude/longitude is provided.
 */
export async function searchInventory(
  params: MarketCheckSearchParams,
): Promise<MarketCheckSearchResult> {
  const queryParams: Record<string, string> = {};

  if (params.make) queryParams.make = params.make;
  if (params.model) queryParams.model = params.model;
  if (params.year !== undefined) queryParams.year = String(params.year);
  if (params.priceRange) queryParams.price_range = params.priceRange;
  if (params.milesRange) queryParams.miles_range = params.milesRange;
  if (params.radius !== undefined) queryParams.radius = String(params.radius);
  if (params.rows !== undefined)
    queryParams.rows = String(Math.min(params.rows, 50));
  if (params.start !== undefined) queryParams.start = String(params.start);
  if (params.sortBy) queryParams.sort_by = params.sortBy;
  if (params.sortOrder) queryParams.sort_order = params.sortOrder;

  // Default location from user config
  if (!queryParams.latitude) queryParams.latitude = String(config.userLat);
  if (!queryParams.longitude) queryParams.longitude = String(config.userLng);

  try {
    const data = await apiFetch<{
      num_found: number;
      listings: RawMarketCheckListing[];
    }>('/search/car/active', queryParams);

    return {
      numFound: data.num_found ?? 0,
      listings: (data.listings ?? []).map(normalizeListing),
    };
  } catch (err) {
    logger.error({ err }, 'MarketCheck searchInventory failed');
    return { numFound: 0, listings: [] };
  }
}

/**
 * Get a price prediction for a vehicle.
 *
 * Provide either a `vin` or a combination of `make` + `model` + `year` + `miles`.
 */
export async function getPricePrediction(options: {
  vin?: string;
  make?: string;
  model?: string;
  year?: number;
  miles?: number;
}): Promise<{ predictedPrice: number; confidence: number } | null> {
  const queryParams: Record<string, string> = {};

  if (options.vin) queryParams.vin = options.vin;
  if (options.make) queryParams.make = options.make;
  if (options.model) queryParams.model = options.model;
  if (options.year !== undefined) queryParams.year = String(options.year);
  if (options.miles !== undefined) queryParams.miles = String(options.miles);

  try {
    const data = await apiFetch<{
      predicted_price?: number;
      confidence?: number;
    }>('/predict/car/price', queryParams);

    if (data.predicted_price === undefined) return null;

    return {
      predictedPrice: data.predicted_price,
      confidence: data.confidence ?? 0,
    };
  } catch (err) {
    logger.error({ err }, 'MarketCheck getPricePrediction failed');
    return null;
  }
}

/**
 * Retrieve the listing history for a given VIN (price changes, listing
 * periods, dealers).
 */
export async function getVinHistory(vin: string): Promise<unknown[] | null> {
  try {
    const data = await apiFetch<unknown[]>(`/history/car/${encodeURIComponent(vin)}`, {});
    return Array.isArray(data) ? data : [data];
  } catch (err) {
    logger.error({ err, vin }, 'MarketCheck getVinHistory failed');
    return null;
  }
}

/**
 * Find comparable (similar) vehicles for a given VIN, normalised to our
 * listing format.
 */
export async function getComparables(
  vin: string,
  radius?: number,
): Promise<NormalizedListing[]> {
  const queryParams: Record<string, string> = {
    vin,
  };
  if (radius !== undefined) queryParams.radius = String(radius);
  queryParams.rows = '50';

  try {
    const data = await apiFetch<{
      listings?: RawMarketCheckListing[];
    }>('/search/car/active/similar', queryParams);

    return (data.listings ?? []).map(normalizeListing);
  } catch (err) {
    logger.error({ err, vin }, 'MarketCheck getComparables failed');
    return [];
  }
}

// ---------------------------------------------------------------------------
// Budget management
// ---------------------------------------------------------------------------

/** Reset the daily call counter (intended to be called by a cron job at midnight). */
export function resetDailyBudget(): void {
  logger.info(
    { previousCount: dailyCallCount },
    'Resetting MarketCheck daily call budget',
  );
  dailyCallCount = 0;
}

/** Return the current daily API call count (for monitoring / dashboards). */
export function getDailyCallCount(): number {
  return dailyCallCount;
}

/** Return configured daily API budget ceiling for monitoring/sync logic. */
export function getDailyBudgetLimit(): number {
  return DAILY_BUDGET;
}
