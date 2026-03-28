// ── Tier 2: Structured Data Parser ────────────────────────────────────────────
// Extracts vehicle listings from JSON-LD and Schema.org structured data embedded
// in dealer website HTML.  Many dealer sites include Schema.org Vehicle objects —
// this is free, well-structured data we can parse with high confidence.
// ──────────────────────────────────────────────────────────────────────────────

import * as cheerio from 'cheerio';
import { type ScrapedListing, type ScraperResult } from '../base.js';

// ── Internal types ─────────────────────────────────────────────────────────────

interface JsonLdOffer {
  price?: string | number;
  priceCurrency?: string;
}

interface JsonLdMileage {
  value?: string | number;
  unitCode?: string;
  unitText?: string;
}

interface JsonLdEngine {
  name?: string;
  engineType?: string;
  engineDisplacement?: unknown;
}

interface JsonLdBrand {
  name?: string;
}

interface JsonLdVehicle {
  '@type'?: string;
  name?: string;
  // VIN / ID
  vehicleIdentificationNumber?: string;
  sku?: string;
  // Core vehicle fields
  brand?: JsonLdBrand | string;
  model?: string;
  vehicleModelDate?: string;
  // Descriptors
  color?: string;
  vehicleInteriorColor?: string;
  bodyType?: string;
  vehicleEngine?: JsonLdEngine | string;
  vehicleTransmission?: string;
  driveWheelConfiguration?: string;
  fuelType?: string;
  // Odometer / price
  mileageFromOdometer?: JsonLdMileage | number | string;
  offers?: JsonLdOffer | JsonLdOffer[];
  // Media / URL
  image?: string | string[];
  url?: string;
  description?: string;
  // Allow extra Schema.org fields we may not know about
  [key: string]: unknown;
}

// Vehicle @type values we consider valid
const VEHICLE_TYPES = new Set(['Vehicle', 'Car', 'Automobile']);

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Parses all JSON-LD blocks from raw HTML and extracts Schema.org Vehicle
 * listings.  Also checks for microdata `itemtype` attributes as a fallback.
 */
export function extractStructuredData(html: string, baseUrl: string): ScraperResult {
  const startTime = Date.now();
  const listings: ScrapedListing[] = [];
  const errors: string[] = [];

  try {
    const $ = cheerio.load(html);

    // ── Strategy 1: JSON-LD ──────────────────────────────────────────────────
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;

        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          return; // skip malformed JSON
        }

        // Unwrap @graph containers
        if (
          parsed &&
          typeof parsed === 'object' &&
          !Array.isArray(parsed) &&
          '@graph' in (parsed as Record<string, unknown>)
        ) {
          parsed = (parsed as { '@graph': unknown })['@graph'];
        }

        // Normalise to array
        const items: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

        for (const item of items) {
          if (!isVehicleObject(item)) continue;
          const listing = mapToListing(item as JsonLdVehicle, baseUrl);
          if (listing) listings.push(listing);
        }
      } catch {
        // swallow per-block errors so one bad block doesn't abort the whole page
      }
    });

    // ── Strategy 2: Microdata (itemtype schema.org/Vehicle or /Car) ──────────
    if (listings.length === 0) {
      $('[itemtype]').each((_i, el) => {
        const itemtype = $(el).attr('itemtype') ?? '';
        if (
          !itemtype.includes('schema.org/Vehicle') &&
          !itemtype.includes('schema.org/Car')
        ) {
          return;
        }

        const item = parseMicrodata($, el, baseUrl);
        if (item) {
          const listing = mapToListing(item, baseUrl);
          if (listing) listings.push(listing);
        }
      });
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return {
    success: listings.length > 0,
    listings,
    errors,
    duration_ms: Date.now() - startTime,
  };
}

// ── Type guard ─────────────────────────────────────────────────────────────────

function isVehicleObject(item: unknown): item is JsonLdVehicle {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
  const obj = item as Record<string, unknown>;
  const type = obj['@type'];
  if (typeof type === 'string') return VEHICLE_TYPES.has(type);
  if (Array.isArray(type)) return type.some((t) => typeof t === 'string' && VEHICLE_TYPES.has(t));
  return false;
}

// ── Microdata parser ───────────────────────────────────────────────────────────

function parseMicrodata(
  $: cheerio.CheerioAPI,
  rootEl: cheerio.Element,
  _baseUrl: string,
): JsonLdVehicle | null {
  const root = $(rootEl);

  function getProp(name: string): string {
    return root.find(`[itemprop="${name}"]`).first().attr('content') ??
      root.find(`[itemprop="${name}"]`).first().text().trim();
  }

  function getAllProp(name: string): string[] {
    const results: string[] = [];
    root.find(`[itemprop="${name}"]`).each((_i, el) => {
      const val = $(el).attr('content') ?? $(el).attr('src') ?? $(el).text().trim();
      if (val) results.push(val);
    });
    return results;
  }

  // Build a minimal JsonLdVehicle from microdata props
  const item: JsonLdVehicle = {
    '@type': 'Vehicle',
    vehicleIdentificationNumber: getProp('vehicleIdentificationNumber') || undefined,
    name: getProp('name') || undefined,
    model: getProp('model') || undefined,
    vehicleModelDate: getProp('vehicleModelDate') || undefined,
    color: getProp('color') || undefined,
    vehicleInteriorColor: getProp('vehicleInteriorColor') || undefined,
    bodyType: getProp('bodyType') || undefined,
    vehicleTransmission: getProp('vehicleTransmission') || undefined,
    driveWheelConfiguration: getProp('driveWheelConfiguration') || undefined,
    fuelType: getProp('fuelType') || undefined,
    description: getProp('description') || undefined,
    url: getProp('url') || undefined,
  };

  // brand (may be nested itemscope)
  const brandName = getProp('brand');
  if (brandName) item.brand = { name: brandName };

  // mileageFromOdometer
  const mileageVal = getProp('mileageFromOdometer');
  if (mileageVal) item.mileageFromOdometer = { value: mileageVal };

  // offers
  const priceVal = getProp('price');
  if (priceVal) item.offers = { price: priceVal };

  // engine
  const engineVal = getProp('vehicleEngine');
  if (engineVal) item.vehicleEngine = { name: engineVal };

  // images
  const images = getAllProp('image');
  if (images.length > 0) item.image = images;

  return item;
}

// ── Field mappers ──────────────────────────────────────────────────────────────

function resolveMake(brand: JsonLdVehicle['brand']): string {
  if (!brand) return '';
  if (typeof brand === 'string') return brand.trim();
  if (typeof brand === 'object' && brand.name) return brand.name.trim();
  return '';
}

function resolveYear(item: JsonLdVehicle): number {
  // 1. vehicleModelDate field
  if (item.vehicleModelDate) {
    const y = parseInt(item.vehicleModelDate, 10);
    if (y >= 1900 && y <= 2100) return y;
  }

  // 2. Pull year from name string (e.g. "2021 Toyota Camry SE")
  if (item.name) {
    const match = item.name.match(/\b(1[89]\d{2}|20\d{2})\b/);
    if (match) return parseInt(match[1], 10);
  }

  return 0;
}

function resolveMileage(mileage: JsonLdVehicle['mileageFromOdometer']): number {
  if (mileage == null) return 0;
  if (typeof mileage === 'number') return mileage;
  if (typeof mileage === 'string') {
    return parseInt(mileage.replace(/\D/g, ''), 10) || 0;
  }
  if (typeof mileage === 'object') {
    const val = (mileage as JsonLdMileage).value;
    if (val == null) return 0;
    if (typeof val === 'number') return val;
    return parseInt(String(val).replace(/\D/g, ''), 10) || 0;
  }
  return 0;
}

function resolvePrice(offers: JsonLdVehicle['offers']): number {
  if (!offers) return 0;
  const offer = Array.isArray(offers) ? offers[0] : offers;
  if (!offer || offer.price == null) return 0;
  if (typeof offer.price === 'number') return offer.price;
  return parseInt(String(offer.price).replace(/[$,\s]/g, ''), 10) || 0;
}

function resolveEngine(engine: JsonLdVehicle['vehicleEngine']): string | null {
  if (!engine) return null;
  if (typeof engine === 'string') return engine.trim() || null;
  if (typeof engine === 'object') {
    return (engine as JsonLdEngine).name ?? (engine as JsonLdEngine).engineType ?? null;
  }
  return null;
}

function resolvePhotos(image: JsonLdVehicle['image'], baseUrl: string): string[] {
  if (!image) return [];
  const urls = Array.isArray(image) ? image : [image];
  return urls
    .filter((u) => typeof u === 'string' && u.length > 0)
    .map((u) => resolveUrl(u, baseUrl));
}

function resolveUrl(url: string, baseUrl: string): string {
  if (!url) return url;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return url;
  }
}

function extractTrimFromName(
  name: string,
  year: number,
  make: string,
  model: string,
): string {
  if (!name) return '';

  // Remove year
  let remainder = name.replace(String(year), '').trim();

  // Remove make (case-insensitive)
  if (make) {
    remainder = remainder.replace(new RegExp(make, 'i'), '').trim();
  }

  // Remove model (case-insensitive)
  if (model) {
    remainder = remainder.replace(new RegExp(model, 'i'), '').trim();
  }

  return remainder.replace(/\s+/g, ' ').trim();
}

// ── Confidence scorer ──────────────────────────────────────────────────────────

function computeConfidence(listing: Partial<ScrapedListing>): number {
  let confidence = 0.9;
  if (!listing.vin) confidence -= 0.05;
  if (!listing.asking_price) confidence -= 0.1;
  if (!listing.mileage) confidence -= 0.05;
  if (!listing.year) confidence -= 0.1;
  return Math.max(0.5, confidence);
}

// ── Listing mapper ─────────────────────────────────────────────────────────────

function mapToListing(item: JsonLdVehicle, baseUrl: string): ScrapedListing | null {
  const make = resolveMake(item.brand);
  const model = (item.model ?? '').trim();
  const year = resolveYear(item);
  const vin = item.vehicleIdentificationNumber?.trim() || null;
  const mileage = resolveMileage(item.mileageFromOdometer);
  const price = resolvePrice(item.offers);
  const photos = resolvePhotos(item.image, baseUrl);

  // Extract trim from name if available
  const trim = item.name ? extractTrimFromName(item.name, year, make, model) : '';

  // Resolve listing URL
  let listingUrl: string | null = null;
  if (item.url) {
    listingUrl = resolveUrl(item.url, baseUrl);
  }

  // Build partial listing to score confidence
  const partial: Partial<ScrapedListing> = { vin, asking_price: price, mileage, year };
  const confidence = computeConfidence(partial);

  const listing: ScrapedListing = {
    vin,
    source: 'structured_data',
    source_url: listingUrl,
    source_listing_id: vin ?? `sd-${year}-${make}-${model}-${price}`,
    year,
    make,
    model,
    trim,
    body_style: (item.bodyType as string | undefined) ?? null,
    engine: resolveEngine(item.vehicleEngine),
    transmission: (item.vehicleTransmission as string | undefined) ?? null,
    drivetrain: (item.driveWheelConfiguration as string | undefined) ?? null,
    exterior_color: (item.color as string | undefined) ?? null,
    interior_color: (item.vehicleInteriorColor as string | undefined) ?? null,
    fuel_type: (item.fuelType as string | undefined) ?? null,
    mileage,
    asking_price: price,
    title_status: 'unknown',
    seller_type: 'dealer',
    seller_name: null,
    seller_phone: null,
    seller_location: null,
    photos: photos.length > 0 ? JSON.stringify(photos) : null,
    description: (item.description as string | undefined) ?? null,
    scrape_confidence: confidence,
    scrape_tier: 'structured_data',
  };

  return listing;
}
