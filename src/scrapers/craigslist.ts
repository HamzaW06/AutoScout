import { BaseScraper, type ScraperResult, type ScrapedListing } from './base.js';
import * as cheerio from 'cheerio';
import { config } from '../config.js';
import { logger } from '../logger.js';

export interface CraigslistSearchParams {
  make?: string;
  model?: string;
  minPrice?: number;
  maxPrice?: number;
  maxMiles?: number;
  searchByOwner?: boolean;   // true = cta (private), false = ctd (dealer)
  cleanTitleOnly?: boolean;
  maxDetailFetches?: number; // max individual listing pages to fetch (default 20)
}

/** Attributes parsed from a Craigslist listing page's .attrgroup spans. */
interface ClAttributes {
  condition?: string;
  cylinders?: string;
  drive?: string;
  fuel?: string;
  odometer?: string;
  paint_color?: string;
  title_status?: string;
  transmission?: string;
  type?: string;
  vin?: string;
}

/** Data extracted from the RSS feed <item> element. */
interface RssItem {
  title: string;
  link: string;
  description: string;
  date: string;
}

/** Result of parsing a Craigslist title string. */
interface ParsedTitle {
  year: number | null;
  make: string;
  model: string;
  trim: string;
  price: number | null;
  location: string | null;
}

const TITLE_REGEX = /^(\d{4})\s+(.+?)(?:\s*-\s*\$[\d,]+)?(?:\s*\(([^)]+)\))?$/;
const PRICE_REGEX = /\$[\d,]+/;
const POST_ID_REGEX = /\/(\d+)\.html/;

export class CraigslistScraper extends BaseScraper {
  name = 'craigslist';
  private baseUrl = 'https://houston.craigslist.org';

  async scrape(params?: CraigslistSearchParams): Promise<ScraperResult> {
    const start = Date.now();
    const errors: string[] = [];
    const listings: ScrapedListing[] = [];
    const maxDetails = params?.maxDetailFetches ?? 20;

    try {
      // 1. Build RSS URL
      const rssUrl = this.buildRssUrl(params);
      logger.info({ url: rssUrl }, 'Craigslist: fetching RSS feed');

      // 2. Fetch RSS feed
      const xmlText = await this.fetchWithTimeout(rssUrl);
      if (!xmlText) {
        return { success: false, listings: [], errors: ['Failed to fetch RSS feed'], duration_ms: Date.now() - start };
      }

      // 3. Parse RSS XML
      const rssItems = this.parseRssFeed(xmlText);
      logger.info({ count: rssItems.length }, 'Craigslist: parsed RSS items');

      if (rssItems.length === 0) {
        return { success: true, listings: [], errors: [], duration_ms: Date.now() - start };
      }

      // 4. Process each item - build basic listings from RSS data
      const sellerType = (params?.searchByOwner !== false) ? 'private' : 'dealer';

      for (const item of rssItems) {
        const parsed = this.parseTitle(item.title);
        const postId = this.extractPostId(item.link);

        const listing: ScrapedListing = {
          vin: null,
          source: 'craigslist',
          source_url: item.link,
          source_listing_id: postId || item.link,
          year: parsed.year ?? 0,
          make: parsed.make,
          model: parsed.model,
          trim: parsed.trim,
          body_style: null,
          engine: null,
          transmission: null,
          drivetrain: null,
          exterior_color: null,
          interior_color: null,
          fuel_type: null,
          mileage: 0,
          asking_price: parsed.price ?? 0,
          title_status: (params?.cleanTitleOnly !== false) ? 'clean' : 'unknown',
          seller_type: sellerType,
          seller_name: null,
          seller_phone: null,
          seller_location: parsed.location ?? null,
          photos: null,
          description: item.description || null,
        };

        listings.push(listing);
      }

      // 5. Fetch individual listing pages for richer details (up to maxDetails)
      const toFetch = listings.slice(0, maxDetails);
      for (let i = 0; i < toFetch.length; i++) {
        const listing = toFetch[i];
        if (!listing.source_url) continue;

        try {
          const html = await this.fetchWithTimeout(listing.source_url);
          if (!html) {
            errors.push(`Failed to fetch listing page: ${listing.source_url}`);
            continue;
          }

          this.enrichFromListingPage(listing, html);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Error fetching ${listing.source_url}: ${msg}`);

          // Stop fetching on 403/429 (Craigslist is blocking us)
          if (msg.includes('403') || msg.includes('429')) {
            errors.push('Craigslist is rate-limiting or blocking requests; stopping detail fetches');
            break;
          }
        }

        // Rate-limit delay between page fetches
        if (i < toFetch.length - 1) {
          await this.delay(config.requestDelayMs);
        }
      }

      return {
        success: true,
        listings,
        errors,
        duration_ms: Date.now() - start,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      return {
        success: false,
        listings,
        errors,
        duration_ms: Date.now() - start,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // URL building
  // ---------------------------------------------------------------------------

  private buildRssUrl(params?: CraigslistSearchParams): string {
    const category = (params?.searchByOwner !== false) ? 'cta' : 'ctd';
    const url = new URL(`/search/${category}`, this.baseUrl);

    url.searchParams.set('format', 'rss');

    if (params?.make || params?.model) {
      const parts = [params.make, params.model].filter(Boolean).join('+');
      url.searchParams.set('auto_make_model', parts);
    }
    if (params?.minPrice != null) {
      url.searchParams.set('min_price', String(params.minPrice));
    }
    if (params?.maxPrice != null) {
      url.searchParams.set('max_price', String(params.maxPrice));
    }
    if (params?.maxMiles != null) {
      url.searchParams.set('max_auto_miles', String(params.maxMiles));
    }
    if (params?.cleanTitleOnly !== false) {
      url.searchParams.set('auto_title_status', '1');
    }

    return url.toString();
  }

  // ---------------------------------------------------------------------------
  // HTTP helpers
  // ---------------------------------------------------------------------------

  private async fetchWithTimeout(url: string, timeoutMs = 15_000): Promise<string | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': config.userAgent },
        signal: controller.signal,
      });

      if (res.status === 403 || res.status === 429) {
        throw new Error(`HTTP ${res.status} from ${url}`);
      }
      if (!res.ok) {
        logger.warn({ status: res.status, url }, 'Craigslist: non-OK response');
        return null;
      }

      return await res.text();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        logger.warn({ url }, 'Craigslist: request timed out');
        return null;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // RSS parsing
  // ---------------------------------------------------------------------------

  private parseRssFeed(xml: string): RssItem[] {
    const $ = cheerio.load(xml, { xmlMode: true });
    const items: RssItem[] = [];

    $('item').each((_i, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const description = $(el).find('description').text().trim();
      const date = $(el).find('dc\\:date, date').text().trim();

      if (title && link) {
        items.push({ title, link, description, date });
      }
    });

    return items;
  }

  // ---------------------------------------------------------------------------
  // Title parsing
  // ---------------------------------------------------------------------------

  /**
   * Parse a Craigslist title like:
   *   "2014 Toyota Camry LE - $5,500 (Houston)"
   *   "2018 Honda Civic EX - $12500"
   *   "2020 Ford F-150 XLT 4x4"
   */
  private parseTitle(raw: string): ParsedTitle {
    const result: ParsedTitle = {
      year: null,
      make: '',
      model: '',
      trim: '',
      price: null,
      location: null,
    };

    if (!raw) return result;

    // Extract price
    const priceMatch = raw.match(PRICE_REGEX);
    if (priceMatch) {
      result.price = parseInt(priceMatch[0].replace(/[$,]/g, ''), 10) || null;
    }

    // Extract location in parentheses at the end
    const locMatch = raw.match(/\(([^)]+)\)\s*$/);
    if (locMatch) {
      result.location = locMatch[1].trim();
    }

    // Try the full regex
    const m = raw.match(TITLE_REGEX);
    if (m) {
      result.year = parseInt(m[1], 10);
      if (m[3]) result.location = m[3].trim();

      // The vehicle text is group 2: "Toyota Camry LE"
      const vehicleText = m[2].trim();
      const parts = vehicleText.split(/\s+/);

      result.make = parts[0] ?? '';
      result.model = parts[1] ?? '';
      result.trim = parts.slice(2).join(' ');
    } else {
      // Fallback: look for a 4-digit year at the start
      const yearMatch = raw.match(/^(\d{4})\s+/);
      if (yearMatch) {
        result.year = parseInt(yearMatch[1], 10);

        // Strip year, price, and location to get make/model/trim
        let rest = raw.slice(yearMatch[0].length);
        rest = rest.replace(/\s*-\s*\$[\d,]+/, '');
        rest = rest.replace(/\s*\([^)]+\)\s*$/, '');
        rest = rest.trim();

        const parts = rest.split(/\s+/);
        result.make = parts[0] ?? '';
        result.model = parts[1] ?? '';
        result.trim = parts.slice(2).join(' ');
      }
    }

    return result;
  }

  // ---------------------------------------------------------------------------
  // Post ID extraction
  // ---------------------------------------------------------------------------

  private extractPostId(url: string): string | null {
    const m = url.match(POST_ID_REGEX);
    return m ? m[1] : null;
  }

  // ---------------------------------------------------------------------------
  // Individual listing page enrichment
  // ---------------------------------------------------------------------------

  private enrichFromListingPage(listing: ScrapedListing, html: string): void {
    const $ = cheerio.load(html);

    // Price
    const priceText = $('span.price').first().text().trim();
    if (priceText) {
      const p = parseInt(priceText.replace(/[$,]/g, ''), 10);
      if (!isNaN(p)) listing.asking_price = p;
    }

    // Description
    const bodyEl = $('section#postingbody');
    if (bodyEl.length) {
      // Remove the "QR Code Link to This Post" notice
      bodyEl.find('.print-information').remove();
      const desc = bodyEl.text().trim();
      if (desc) listing.description = desc;
    }

    // Photos - look in gallery / thumbs containers
    const photos: string[] = [];
    $('div.gallery img, div#thumbs img, div.swipe img, a.thumb img').each((_i, img) => {
      let src = $(img).attr('src') || $(img).attr('data-src') || '';
      if (src) {
        // Upgrade thumbnail to full-size image: replace _50x50c or similar with _600x450
        src = src.replace(/_\d+x\d+c?\.jpg/, '_600x450.jpg');
        if (!photos.includes(src)) {
          photos.push(src);
        }
      }
    });
    if (photos.length > 0) {
      listing.photos = JSON.stringify(photos);
    }

    // Attribute groups
    const attrs = this.parseAttributes($);

    if (attrs.vin) listing.vin = attrs.vin;
    if (attrs.transmission) listing.transmission = attrs.transmission;
    if (attrs.drive) listing.drivetrain = attrs.drive;
    if (attrs.fuel) listing.fuel_type = attrs.fuel;
    if (attrs.paint_color) listing.exterior_color = attrs.paint_color;
    if (attrs.type) listing.body_style = attrs.type;
    if (attrs.title_status) listing.title_status = attrs.title_status;
    if (attrs.cylinders) listing.engine = attrs.cylinders;

    if (attrs.odometer) {
      const miles = parseInt(attrs.odometer.replace(/\D/g, ''), 10);
      if (!isNaN(miles)) listing.mileage = miles;
    }
  }

  /**
   * Parse the `.attrgroup span` elements on a Craigslist listing page.
   * These typically look like: `<span>odometer: 98000</span>`
   */
  private parseAttributes($: cheerio.CheerioAPI): ClAttributes {
    const attrs: ClAttributes = {};

    $('p.attrgroup span').each((_i, el) => {
      const text = $(el).text().trim().toLowerCase();
      const colonIdx = text.indexOf(':');
      if (colonIdx === -1) return;

      const key = text.slice(0, colonIdx).trim().replace(/\s+/g, '_');
      const value = text.slice(colonIdx + 1).trim();

      if (key && value) {
        (attrs as Record<string, string>)[key] = value;
      }
    });

    return attrs;
  }
}
