// ── Frazer Platform Scraper ──────────────────────────────────────
// Scrapes vehicle listings from dealer websites powered by Frazer
// (frazer.com / frazercms).  These are typically smaller independent
// dealers with inventory at /inventory.aspx.  Frazer sites use
// simpler HTML table/card layouts compared to larger platforms.
// -------------------------------------------------------------------

import { BaseScraper, type ScraperResult, type ScrapedListing } from '../base.js';
import * as cheerio from 'cheerio';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

export class FrazerScraper extends BaseScraper {
  name = 'frazer';

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

      // Determine base URL for resolving relative links and images
      let baseOrigin: string;
      try {
        baseOrigin = new URL(options.inventoryUrl).origin;
      } catch {
        baseOrigin = '';
      }

      // Strategy 1: Table-based inventory layout
      // Frazer sites often render inventory in a <table> with one row per vehicle.
      const tableListings = this.extractFromTable($, baseOrigin);
      if (tableListings.length > 0) {
        listings.push(...tableListings);
        logger.info(
          { url: options.inventoryUrl, count: tableListings.length, method: 'table' },
          'Frazer: extracted listings from table layout',
        );
      }

      // Strategy 2: Card/div-based layout (newer Frazer templates)
      if (listings.length === 0) {
        const cardListings = this.extractFromCards($, baseOrigin);
        listings.push(...cardListings);
        logger.info(
          { url: options.inventoryUrl, count: cardListings.length, method: 'cards' },
          'Frazer: extracted listings from card layout',
        );
      }

      logger.info({ dealer: options.inventoryUrl, count: listings.length }, 'Frazer scrape complete');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      logger.warn({ url: options.inventoryUrl, error: msg }, 'Frazer scrape failed');
    }

    return {
      success: errors.length === 0,
      listings,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }

  // ── Table-based extraction ──────────────────────────────────────

  private extractFromTable($: cheerio.CheerioAPI, baseOrigin: string): ScrapedListing[] {
    const listings: ScrapedListing[] = [];

    // Frazer inventory tables typically have class "inventory" or are
    // inside a container with id "inventory".
    const rows = $('table.inventory tr, #inventory table tr, .inventoryList tr').toArray();

    // Skip header row (first row)
    for (let i = 1; i < rows.length; i++) {
      const row = $(rows[i]);
      const cells = row.find('td');
      if (cells.length < 3) continue;

      const listing = this.parseTableRow(cells, $, row, baseOrigin);
      if (listing) {
        listings.push(listing);
      }
    }

    return listings;
  }

  private parseTableRow(
    cells: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    row: cheerio.Cheerio<any>,
    baseOrigin: string,
  ): ScrapedListing | null {
    // Frazer table layouts vary, but common patterns:
    // Photo | Year Make Model | Price | Mileage | Stock# | VIN
    // Or: Photo | Vehicle Info (multiline) | Price

    // Collect all cell texts
    const cellTexts: string[] = [];
    cells.each((_i, cell) => {
      cellTexts.push($(cell).text().trim());
    });

    // Try to find year/make/model from any cell that matches "20XX Make Model"
    let year = 0;
    let make = '';
    let model = '';
    let trim = '';
    let price = 0;
    let mileage = 0;
    let vin: string | null = null;
    let stockNum: string | null = null;

    for (const text of cellTexts) {
      // Year/Make/Model pattern
      if (!year) {
        const ymm = text.match(/(\d{4})\s+(\S+)\s+(\S+)\s*(.*)/);
        if (ymm) {
          year = parseInt(ymm[1], 10);
          make = ymm[2];
          model = ymm[3];
          trim = (ymm[4] ?? '').trim();
        }
      }

      // Price pattern
      if (!price) {
        const priceMatch = text.match(/\$[\d,]+/);
        if (priceMatch) {
          price = parseInt(priceMatch[0].replace(/[$,]/g, ''), 10) || 0;
        }
      }

      // Mileage pattern (look for numbers followed by "mi" or "miles")
      if (!mileage) {
        const mileageMatch = text.match(/([\d,]+)\s*(?:mi(?:les?)?|k\s*mi)/i);
        if (mileageMatch) {
          mileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10) || 0;
        }
      }

      // VIN pattern (17 alphanumeric characters)
      if (!vin) {
        const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
        if (vinMatch) {
          vin = vinMatch[1].toUpperCase();
        }
      }

      // Stock number pattern
      if (!stockNum) {
        const stockMatch = text.match(/(?:stk?|stock)\s*#?\s*:?\s*(\S+)/i);
        if (stockMatch) {
          stockNum = stockMatch[1];
        }
      }
    }

    if (!year) return null;

    // Extract photos from the row
    const photos: string[] = [];
    row.find('img').each((_j, img) => {
      let src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
      if (src && !src.includes('spacer') && !src.includes('blank')) {
        if (!src.startsWith('http') && baseOrigin) {
          src = `${baseOrigin}${src.startsWith('/') ? '' : '/'}${src}`;
        }
        if (!photos.includes(src)) {
          photos.push(src);
        }
      }
    });

    // Extract listing URL
    let listingUrl: string | null = null;
    const link = row.find('a[href]').first();
    const href = link.attr('href');
    if (href) {
      listingUrl = href.startsWith('http') ? href : `${baseOrigin}${href.startsWith('/') ? '' : '/'}${href}`;
    }

    return {
      vin,
      source: 'frazer',
      source_url: listingUrl,
      source_listing_id: vin ?? stockNum ?? `frazer-${year}-${make}-${model}-${price}`,
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
    };
  }

  // ── Card-based extraction ───────────────────────────────────────

  private extractFromCards($: cheerio.CheerioAPI, baseOrigin: string): ScrapedListing[] {
    const listings: ScrapedListing[] = [];

    // Newer Frazer templates use card/div based layouts
    const selectors = [
      '.vehicle-item',
      '.inventory-item',
      '.vehicleCard',
      '.car-listing',
      '.inv-item',
      '.vehicle-listing',
    ];

    const combinedSelector = selectors.join(', ');
    const cards = $(combinedSelector);

    cards.each((_i, el) => {
      const card = $(el);
      const listing = this.parseCard(card, $, baseOrigin);
      if (listing) {
        listings.push(listing);
      }
    });

    return listings;
  }

  private parseCard(
    card: cheerio.Cheerio<any>,
    $: cheerio.CheerioAPI,
    baseOrigin: string,
  ): ScrapedListing | null {
    // Extract all text from the card for pattern matching
    const fullText = card.text().replace(/\s+/g, ' ').trim();

    // Year/Make/Model from title or heading
    let year = 0;
    let make = '';
    let model = '';
    let trim = '';

    const titleEl = card.find('h2, h3, h4, .title, .vehicle-title, .vehicle-name').first();
    const titleText = titleEl.length ? titleEl.text().trim() : '';

    const ymmMatch = (titleText || fullText).match(/(\d{4})\s+(\S+)\s+(\S+)\s*(.*?)(?:\s*[-|$]|$)/);
    if (ymmMatch) {
      year = parseInt(ymmMatch[1], 10);
      make = ymmMatch[2];
      model = ymmMatch[3];
      trim = (ymmMatch[4] ?? '').trim();
    }

    if (!year) return null;

    // Price
    let price = 0;
    const priceEl = card.find('.price, .vehicle-price, .asking-price').first();
    const priceText = priceEl.length ? priceEl.text() : fullText;
    const priceMatch = priceText.match(/\$[\d,]+/);
    if (priceMatch) {
      price = parseInt(priceMatch[0].replace(/[$,]/g, ''), 10) || 0;
    }

    // Mileage
    let mileage = 0;
    const mileageMatch = fullText.match(/([\d,]+)\s*(?:mi(?:les?)?|k\s*mi)/i);
    if (mileageMatch) {
      mileage = parseInt(mileageMatch[1].replace(/,/g, ''), 10) || 0;
    }

    // VIN
    let vin: string | null = null;
    const vinMatch = fullText.match(/\b([A-HJ-NPR-Z0-9]{17})\b/i);
    if (vinMatch) {
      vin = vinMatch[1].toUpperCase();
    }

    // Photos
    const photos: string[] = [];
    card.find('img').each((_j, img) => {
      let src = $(img).attr('src') ?? $(img).attr('data-src') ?? '';
      if (src && !src.includes('spacer') && !src.includes('blank') && !src.includes('logo')) {
        if (!src.startsWith('http') && baseOrigin) {
          src = `${baseOrigin}${src.startsWith('/') ? '' : '/'}${src}`;
        }
        if (!photos.includes(src)) {
          photos.push(src);
        }
      }
    });

    // Listing URL
    let listingUrl: string | null = null;
    const href = card.find('a[href]').first().attr('href');
    if (href) {
      listingUrl = href.startsWith('http') ? href : `${baseOrigin}${href.startsWith('/') ? '' : '/'}${href}`;
    }

    return {
      vin,
      source: 'frazer',
      source_url: listingUrl,
      source_listing_id: vin ?? `frazer-${year}-${make}-${model}-${price}`,
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
    };
  }
}
