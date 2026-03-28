import { ScrapedListing, ScraperResult } from '../base.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

// Common API paths to probe on dealer websites
const COMMON_API_PATHS = [
  '/api/inventory',
  '/api/vehicles',
  '/api/inventory/used',
  '/api/v1/inventory',
  '/api/v1/vehicles',
  '/wp-json/wp/v2/inventory',
  '/wp-json/inventory/v1/vehicles',
  '/inventory.json',
  '/used-inventory.json',
  '/api/dealership/inventory',
];

// Patterns to find dynamic API URLs in HTML source
const DYNAMIC_API_PATTERNS = [
  /["'`](\/api\/[^"'`]*inventory[^"'`]*)["'`]/gi,
  /["'`](\/api\/[^"'`]*vehicle[^"'`]*)["'`]/gi,
  /["'`](\/_next\/data\/[^"'`]*\.json)["'`]/gi,
];

// Keys that commonly wrap vehicle arrays in API responses
const CONTAINER_KEYS = [
  'inventory',
  'vehicles',
  'listings',
  'results',
  'data',
  'items',
  'cars',
  'used_vehicles',
  'pageProps',
];

// Fields that indicate an object is a vehicle listing
const VEHICLE_INDICATOR_FIELDS = [
  'vin',
  'make',
  'model',
  'year',
  'price',
  'mileage',
  'odometer',
  'miles',
];

// Field aliases for mapping API response fields to ScrapedListing fields
const FIELD_ALIASES: Record<string, string[]> = {
  vin: ['vin', 'VIN', 'vehicleIdentificationNumber', 'vehicle_vin', 'vinNumber'],
  year: ['year', 'Year', 'modelYear', 'model_year', 'vehicleYear'],
  make: ['make', 'Make', 'brand', 'manufacturer', 'vehicleMake'],
  model: ['model', 'Model', 'vehicleModel', 'model_name'],
  price: ['price', 'Price', 'askingPrice', 'asking_price', 'salePrice', 'sale_price', 'internetPrice', 'internet_price', 'listPrice', 'list_price'],
  mileage: ['mileage', 'Mileage', 'miles', 'Miles', 'odometer', 'Odometer', 'mileageValue'],
  photos: ['images', 'photos', 'photoUrls', 'photo_urls', 'imageList', 'media', 'gallery'],
};

/**
 * Extracts a value from an object by checking multiple alias keys.
 */
function getByAliases(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(obj, alias)) {
      return obj[alias];
    }
  }
  return undefined;
}

/**
 * Checks whether an object looks like a vehicle listing by counting how many
 * vehicle indicator fields are present (case-insensitive).
 */
function isVehicleObject(obj: unknown): obj is Record<string, unknown> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const record = obj as Record<string, unknown>;
  const lowerKeys = Object.keys(record).map((k) => k.toLowerCase());
  let matches = 0;
  for (const field of VEHICLE_INDICATOR_FIELDS) {
    if (lowerKeys.includes(field)) {
      matches++;
    }
  }
  return matches >= 2;
}

/**
 * Resolves a photo URL relative to the base URL if it is not absolute.
 */
function resolvePhotoUrl(url: unknown, baseUrl: string): string | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  try {
    // If already absolute, return as-is
    new URL(url);
    return url;
  } catch {
    // Relative URL — resolve against baseUrl
    try {
      return new URL(url, baseUrl).href;
    } catch {
      return url;
    }
  }
}

/**
 * Maps a raw vehicle object from an API response to a ScrapedListing.
 */
function mapVehicleObject(obj: Record<string, unknown>, baseUrl: string): ScrapedListing {
  const vinRaw = getByAliases(obj, FIELD_ALIASES.vin);
  const vin = typeof vinRaw === 'string' ? vinRaw : null;

  const yearRaw = getByAliases(obj, FIELD_ALIASES.year);
  const year = typeof yearRaw === 'number'
    ? yearRaw
    : typeof yearRaw === 'string'
      ? parseInt(yearRaw, 10)
      : 0;

  const makeRaw = getByAliases(obj, FIELD_ALIASES.make);
  const make = typeof makeRaw === 'string' ? makeRaw : '';

  const modelRaw = getByAliases(obj, FIELD_ALIASES.model);
  const model = typeof modelRaw === 'string' ? modelRaw : '';

  const priceRaw = getByAliases(obj, FIELD_ALIASES.price);
  const price = typeof priceRaw === 'number'
    ? priceRaw
    : typeof priceRaw === 'string'
      ? parseFloat(priceRaw.replace(/[^0-9.]/g, ''))
      : 0;

  const mileageRaw = getByAliases(obj, FIELD_ALIASES.mileage);
  const mileage = typeof mileageRaw === 'number'
    ? mileageRaw
    : typeof mileageRaw === 'string'
      ? parseInt(mileageRaw.replace(/[^0-9]/g, ''), 10)
      : 0;

  const photosRaw = getByAliases(obj, FIELD_ALIASES.photos);
  let photosResolved: string[] = [];
  if (Array.isArray(photosRaw)) {
    photosResolved = photosRaw
      .map((p) => resolvePhotoUrl(p, baseUrl))
      .filter((p): p is string => p !== null);
  } else if (typeof photosRaw === 'string' && photosRaw.trim()) {
    const resolved = resolvePhotoUrl(photosRaw, baseUrl);
    if (resolved) photosResolved = [resolved];
  }

  // Confidence scoring
  let confidence = 0.92;
  if (!vin) confidence -= 0.05;
  if (!price || price === 0) confidence -= 0.05;

  // Generate a source_listing_id from vin or a hash of make+model+year
  const source_listing_id = vin ?? `${make}-${model}-${year}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    vin,
    source: baseUrl,
    source_url: null,
    source_listing_id,
    year: isNaN(year) ? 0 : year,
    make,
    model,
    trim: (obj['trim'] as string) || (obj['Trim'] as string) || '',
    body_style: (obj['body_style'] as string) || (obj['bodyStyle'] as string) || (obj['bodyType'] as string) || null,
    engine: (obj['engine'] as string) || (obj['engineDescription'] as string) || null,
    transmission: (obj['transmission'] as string) || (obj['transmissionDescription'] as string) || null,
    drivetrain: (obj['drivetrain'] as string) || (obj['driveType'] as string) || (obj['drive_type'] as string) || null,
    exterior_color: (obj['exterior_color'] as string) || (obj['exteriorColor'] as string) || (obj['color'] as string) || null,
    interior_color: (obj['interior_color'] as string) || (obj['interiorColor'] as string) || null,
    fuel_type: (obj['fuel_type'] as string) || (obj['fuelType'] as string) || null,
    mileage: isNaN(mileage) ? 0 : mileage,
    asking_price: isNaN(price) ? 0 : price,
    title_status: (obj['title_status'] as string) || (obj['titleStatus'] as string) || 'clean',
    seller_type: 'dealer',
    seller_name: (obj['dealer_name'] as string) || (obj['dealerName'] as string) || (obj['seller_name'] as string) || null,
    seller_phone: (obj['dealer_phone'] as string) || (obj['dealerPhone'] as string) || null,
    seller_location: (obj['location'] as string) || (obj['dealerCity'] as string) || null,
    photos: photosResolved.length > 0 ? JSON.stringify(photosResolved) : null,
    description: (obj['description'] as string) || (obj['comments'] as string) || null,
    scrape_confidence: confidence,
    scrape_tier: 'api_discovery',
  };
}

/**
 * Recursively searches a JSON structure for arrays of vehicle-like objects,
 * checking known container keys up to a maximum depth.
 */
function findVehicleArrays(
  data: unknown,
  baseUrl: string,
  depth: number = 0,
  maxDepth: number = 4,
): ScrapedListing[] {
  if (depth > maxDepth) return [];
  if (!data || typeof data !== 'object') return [];

  // Direct array — check if it contains vehicle objects
  if (Array.isArray(data)) {
    const vehicleItems = data.filter(isVehicleObject);
    if (vehicleItems.length > 0) {
      return vehicleItems.map((item) => mapVehicleObject(item, baseUrl));
    }
    // Recurse into array elements that are objects
    for (const item of data) {
      const found = findVehicleArrays(item, baseUrl, depth + 1, maxDepth);
      if (found.length > 0) return found;
    }
    return [];
  }

  const record = data as Record<string, unknown>;

  // First: check known container keys in priority order
  for (const key of CONTAINER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const found = findVehicleArrays(record[key], baseUrl, depth + 1, maxDepth);
      if (found.length > 0) return found;
    }
  }

  // Then: recurse into all other object values
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      const found = findVehicleArrays(value, baseUrl, depth + 1, maxDepth);
      if (found.length > 0) return found;
    }
  }

  return [];
}

/**
 * Parses a raw API response (already parsed JSON) and extracts vehicle listings.
 */
export function parseApiResponse(data: unknown, baseUrl: string): ScrapedListing[] {
  try {
    return findVehicleArrays(data, baseUrl);
  } catch (err) {
    logger.warn({ err, baseUrl }, 'api-discovery: error parsing API response');
    return [];
  }
}

/**
 * Scans HTML source for fetch/XHR URLs matching API inventory/vehicle patterns.
 */
function extractApiUrlsFromHtml(html: string): string[] {
  const found = new Set<string>();
  for (const pattern of DYNAMIC_API_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}

/**
 * Probes a single URL and returns parsed listings if the response is valid JSON
 * containing vehicle data.
 */
async function probeUrl(url: string, baseUrl: string): Promise<ScrapedListing[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': config.userAgent,
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      logger.debug({ url, contentType }, 'api-discovery: non-JSON response, skipping');
      return [];
    }

    const text = await response.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      logger.debug({ url }, 'api-discovery: response not valid JSON');
      return [];
    }

    const listings = parseApiResponse(parsed, baseUrl);
    if (listings.length > 0) {
      logger.info({ url, count: listings.length }, 'api-discovery: found vehicle listings');
    }
    return listings;
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') {
      logger.debug({ url }, 'api-discovery: request timed out');
    } else {
      logger.debug({ url, err }, 'api-discovery: request failed');
    }
    return [];
  }
}

/**
 * Discovers and parses hidden REST/JSON API endpoints on a dealer website.
 *
 * Probes common API paths and any URLs discovered in the provided HTML source.
 * Returns the first successful result containing vehicle listings.
 */
export async function discoverApiEndpoints(baseUrl: string, html: string): Promise<ScraperResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Normalise baseUrl — strip trailing slash
  const base = baseUrl.replace(/\/$/, '');

  // Build list of URLs to probe: common paths first
  const urlsToProbe: string[] = COMMON_API_PATHS.map((path) => `${base}${path}`);

  // Discover additional URLs from HTML
  const discoveredPaths = extractApiUrlsFromHtml(html);
  logger.debug({ count: discoveredPaths.length }, 'api-discovery: discovered API paths in HTML');
  for (const path of discoveredPaths.slice(0, 5)) {
    const fullUrl = path.startsWith('http') ? path : `${base}${path}`;
    if (!urlsToProbe.includes(fullUrl)) {
      urlsToProbe.push(fullUrl);
    }
  }

  // Probe URLs sequentially, return on first hit
  for (const url of urlsToProbe) {
    try {
      const listings = await probeUrl(url, base);
      if (listings.length > 0) {
        return {
          success: true,
          listings,
          errors,
          duration_ms: Date.now() - startTime,
        };
      }
    } catch (err) {
      const msg = `Failed to probe ${url}: ${(err as Error).message}`;
      errors.push(msg);
      logger.warn({ url, err }, 'api-discovery: unexpected error probing URL');
    }
  }

  return {
    success: false,
    listings: [],
    errors,
    duration_ms: Date.now() - startTime,
  };
}
