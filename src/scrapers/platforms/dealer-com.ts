// ── Dealer.com Platform Scraper ──────────────────────────────────
// Scrapes vehicle listings from dealer websites powered by the
// Dealer.com (Cox Automotive / DDC) platform.  These sites use a
// consistent HTML structure with vehicle-card components, data
// attributes, and frequently include JSON-LD structured data.
// -------------------------------------------------------------------

import { BaseScraper, type ScraperResult, type ScrapedListing } from '../base.js';
import * as cheerio from 'cheerio';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

// ── JSON-LD types ───────────────────────────────────────────────

interface JsonLdVehicle {
  '@type'?: string;
  name?: string;
  sku?: string;
  vehicleIdentificationNumber?: string;
  modelDate?: string;
  brand?: { name?: string };
  model?: string;
  vehicleConfiguration?: string;
  bodyType?: string;
  vehicleEngine?: { name?: string; engineType?: string };
  vehicleTransmission?: string;
  driveWheelConfiguration?: string;
  color?: string;
  fuelType?: string;
  mileageFromOdometer?: { value?: string | number; unitCode?: string };
  offers?: { price?: string | number; priceCurrency?: string };
  image?: string | string[];
  description?: string;
  url?: string;
}

// ── Scraper class ───────────────────────────────────────────────

export class DealerComScraper extends BaseScraper {
  name = 'dealer.com';

  async scrape(options?: { inventoryUrl: string }): Promise<ScraperResult> {
    const startTime = Date.now();
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    if (!options?.inventoryUrl) {
      return { success: false, listings: [], errors: ['No inventory URL provided'], duration_ms: 0 };
    }

    try {
      const resp = await fetch(options.inventoryUrl, {
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }

      const html = await resp.text();
      const $ = cheerio.load(html);

      // Strategy 1: Try JSON-LD structured data first (most reliable)
      const jsonLdListings = this.extractFromJsonLd($, options.inventoryUrl);
      if (jsonLdListings.length > 0) {
        listings.push(...jsonLdListings);
        logger.info(
          { dealer: options.inventoryUrl, count: jsonLdListings.length, method: 'json-ld' },
          'Dealer.com: extracted listings from JSON-LD',
        );
      }

      // Strategy 2: Parse vehicle cards from HTML if JSON-LD yielded nothing
      if (listings.length === 0) {
        const htmlListings = this.extractFromHtml($, options.inventoryUrl);
        listings.push(...htmlListings);
        logger.info(
          { dealer: options.inventoryUrl, count: htmlListings.length, method: 'html' },
          'Dealer.com: extracted listings from HTML',
        );
      }

      logger.info({ dealer: options.inventoryUrl, count: listings.length }, 'Dealer.com scrape complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      logger.warn({ url: options.inventoryUrl, error: msg }, 'Dealer.com scrape failed');
    }

    return {
      success: errors.length === 0,
      listings,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }

  // ── JSON-LD extraction ──────────────────────────────────────────

  private extractFromJsonLd($: cheerio.CheerioAPI, baseUrl: string): ScrapedListing[] {
    const listings: ScrapedListing[] = [];

    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;

        let data: unknown = JSON.parse(raw);

        // Handle @graph wrapper
        if (data && typeof data === 'object' && '@graph' in (data as Record<string, unknown>)) {
          data = (data as { '@graph': unknown[] })['@graph'];
        }

        // Normalize to array
        const items: JsonLdVehicle[] = Array.isArray(data) ? data : [data as JsonLdVehicle];

        for (const item of items) {
          if (!item['@type'] || !['Car', 'Vehicle', 'Product', 'Auto'].includes(item['@type'])) {
            continue;
          }

          const listing = this.mapJsonLdToListing(item, baseUrl);
          if (listing) {
            listings.push(listing);
          }
        }
      } catch {
        // Ignore malformed JSON-LD blocks
      }
    });

    return listings;
  }

  private mapJsonLdToListing(item: JsonLdVehicle, baseUrl: string): ScrapedListing | null {
    const year = parseInt(item.modelDate ?? '', 10);
    const make = item.brand?.name ?? '';
    const model = item.model ?? '';

    // Need at least year and make to be useful
    if (!year || !make) return null;

    // Parse price
    let price = 0;
    if (item.offers?.price != null) {
      price = typeof item.offers.price === 'number'
        ? item.offers.price
        : parseInt(String(item.offers.price).replace(/[$,]/g, ''), 10) || 0;
    }

    // Parse mileage
    let mileage = 0;
    if (item.mileageFromOdometer?.value != null) {
      mileage = typeof item.mileageFromOdometer.value === 'number'
        ? item.mileageFromOdometer.value
        : parseInt(String(item.mileageFromOdometer.value).replace(/\D/g, ''), 10) || 0;
    }

    // Parse photos
    let photos: string[] = [];
    if (item.image) {
      photos = Array.isArray(item.image) ? item.image : [item.image];
    }

    // Build listing URL
    let sourceUrl: string | null = item.url ?? null;
    if (sourceUrl && !sourceUrl.startsWith('http')) {
      try {
        const base = new URL(baseUrl);
        sourceUrl = `${base.origin}${sourceUrl.startsWith('/') ? '' : '/'}${sourceUrl}`;
      } catch {
        // leave as-is
      }
    }

    const vin = item.vehicleIdentificationNumber ?? item.sku ?? null;

    return {
      vin: vin,
      source: 'dealer.com',
      source_url: sourceUrl,
      source_listing_id: vin ?? `ddc-${year}-${make}-${model}-${price}`,
      year,
      make,
      model,
      trim: item.vehicleConfiguration ?? '',
      body_style: item.bodyType ?? null,
      engine: item.vehicleEngine?.name ?? item.vehicleEngine?.engineType ?? null,
      transmission: item.vehicleTransmission ?? null,
      drivetrain: item.driveWheelConfiguration ?? null,
      exterior_color: item.color ?? null,
      interior_color: null,
      fuel_type: item.fuelType ?? null,
      mileage,
      asking_price: price,
      title_status: 'unknown',
      seller_type: 'dealer',
      seller_name: null,
      seller_phone: null,
      seller_location: null,
      photos: photos.length > 0 ? JSON.stringify(photos) : null,
      description: item.description ?? null,
      scrape_confidence: 0.95,
      scrape_tier: 'platform',
    };
  }

  // ── HTML card extraction ────────────────────────────────────────

  private extractFromHtml($: cheerio.CheerioAPI, baseUrl: string): ScrapedListing[] {
    const listings: ScrapedListing[] = [];

    // Dealer.com uses various card selectors across site versions
    const selectors = [
      '.vehicle-card',
      '.hproduct',
      '.inventory-listing',
      '[data-vin]',
      '.srpVehicle',
      '.vehicle-card-content',
      '.ddc-content .vehicle',
    ];

    const combinedSelector = selectors.join(', ');
    const cards = $(combinedSelector);

    // Dedupe by tracking VINs/IDs we have already seen
    const seen = new Set<string>();

    cards.each((_i, el) => {
      const card = $(el);
      const listing = this.parseVehicleCard(card, $, baseUrl);

      if (!listing) return;

      // Deduplicate
      const key = listing.vin ?? listing.source_listing_id;
      if (seen.has(key)) return;
      seen.add(key);

      listings.push(listing);
    });

    return listings;
  }

  private parseVehicleCard(
    card: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    baseUrl: string,
  ): ScrapedListing | null {
    // Extract data attributes (dealer.com commonly uses these)
    const vin = card.attr('data-vin') ?? card.find('[data-vin]').attr('data-vin') ?? null;
    const dataYear = card.attr('data-year') ?? card.find('[data-year]').attr('data-year');
    const dataMake = card.attr('data-make') ?? card.find('[data-make]').attr('data-make');
    const dataModel = card.attr('data-model') ?? card.find('[data-model]').attr('data-model');
    const dataTrim = card.attr('data-trim') ?? card.find('[data-trim]').attr('data-trim');
    const dataMileage = card.attr('data-mileage') ?? card.find('[data-mileage]').attr('data-mileage');

    // Try to parse year/make/model from data attributes or title text
    let year = parseInt(dataYear ?? '', 10) || 0;
    let make = dataMake ?? '';
    let model = dataModel ?? '';
    let trim = dataTrim ?? '';

    // Fallback: parse the title text (e.g., "2021 Toyota Camry SE")
    if (!year || !make) {
      const titleEl = card.find('.vehicle-title, .title, h2, h3, .vehicle-name, .listing-title').first();
      const titleText = titleEl.text().trim();
      const titleParsed = this.parseTitleText(titleText);
      if (titleParsed) {
        year = year || titleParsed.year;
        make = make || titleParsed.make;
        model = model || titleParsed.model;
        trim = trim || titleParsed.trim;
      }
    }

    // Need at minimum a year to consider this valid
    if (!year) return null;

    // Extract price
    let price = 0;
    const priceEl = card.find('.price, .vehicle-price, .final-price, .sale-price, .internetPrice, [data-price]').first();
    const priceText = priceEl.attr('data-price') ?? priceEl.text();
    if (priceText) {
      price = parseInt(priceText.replace(/[$,\s]/g, ''), 10) || 0;
    }

    // Extract mileage
    let mileage = 0;
    if (dataMileage) {
      mileage = parseInt(dataMileage.replace(/\D/g, ''), 10) || 0;
    }
    if (!mileage) {
      const mileageEl = card.find('.mileage, .odometer, .vehicle-mileage').first();
      const mileageText = mileageEl.text();
      if (mileageText) {
        mileage = parseInt(mileageText.replace(/\D/g, ''), 10) || 0;
      }
    }

    // Extract photos
    const photos: string[] = [];
    card.find('.vehicle-image img, .photo img, img.vehicle-photo, img[data-src]').each((_j, img) => {
      const src = $(img).attr('data-src') ?? $(img).attr('src') ?? '';
      if (src && src.startsWith('http') && !photos.includes(src)) {
        photos.push(src);
      }
    });

    // Extract listing URL
    let listingUrl: string | null = null;
    const linkEl = card.find('a[href*="vehicle"], a[href*="inventory"], a.vehicle-link').first();
    const href = linkEl.attr('href') ?? card.find('a').first().attr('href');
    if (href) {
      if (href.startsWith('http')) {
        listingUrl = href;
      } else {
        try {
          const base = new URL(baseUrl);
          listingUrl = `${base.origin}${href.startsWith('/') ? '' : '/'}${href}`;
        } catch {
          listingUrl = href;
        }
      }
    }

    return {
      vin,
      source: 'dealer.com',
      source_url: listingUrl,
      source_listing_id: vin ?? `ddc-${year}-${make}-${model}-${price}`,
      year,
      make,
      model,
      trim,
      body_style: null,
      engine: null,
      transmission: null,
      drivetrain: null,
      exterior_color: null,
      interior_color: null,
      fuel_type: null,
      mileage,
      asking_price: price,
      title_status: 'unknown',
      seller_type: 'dealer',
      seller_name: null,
      seller_phone: null,
      seller_location: null,
      photos: photos.length > 0 ? JSON.stringify(photos) : null,
      description: null,
      scrape_confidence: 0.95,
      scrape_tier: 'platform',
    };
  }

  // ── Title text parsing ──────────────────────────────────────────

  private parseTitleText(text: string): { year: number; make: string; model: string; trim: string } | null {
    if (!text) return null;

    // Match pattern: "2021 Toyota Camry SE" or "Pre-Owned 2021 Toyota Camry SE"
    const match = text.match(/(\d{4})\s+(\S+)\s+(\S+)\s*(.*)/);
    if (!match) return null;

    return {
      year: parseInt(match[1], 10),
      make: match[2],
      model: match[3],
      trim: (match[4] ?? '').trim(),
    };
  }
}
