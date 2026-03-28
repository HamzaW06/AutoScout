// ── Generic AI Scraper ───────────────────────────────────────────
// Fallback scraper for unknown dealer platforms.  Fetches the dealer
// inventory page, strips non-essential HTML, and sends it to Google
// Gemini Flash (free tier) for structured data extraction.
// -------------------------------------------------------------------

import { BaseScraper, type ScraperResult, type ScrapedListing } from '../base.js';
import { config } from '../../config.js';
import { logger } from '../../logger.js';

// ── Gemini response shapes ──────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  error?: { message?: string; code?: number };
}

interface ExtractedVehicle {
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  price?: number;
  mileage?: number;
  vin?: string;
  photos?: string[];
  description?: string;
  url?: string;
  body_style?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  exterior_color?: string;
  interior_color?: string;
  fuel_type?: string;
}

// ── Constants ───────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `You are a vehicle listing data extractor. Extract ALL vehicle listings from the HTML below.

For each vehicle, return a JSON object with these fields:
- year (number)
- make (string)
- model (string)
- trim (string, empty string if unknown)
- price (number, 0 if unknown)
- mileage (number, 0 if unknown)
- vin (string or null)
- photos (array of full image URLs, empty array if none)
- description (string or null)
- url (relative or absolute URL to the listing detail page, or null)
- body_style (string or null)
- engine (string or null)
- transmission (string or null)
- drivetrain (string or null)
- exterior_color (string or null)
- interior_color (string or null)
- fuel_type (string or null)

Return ONLY a JSON array of these objects, no markdown fences, no explanation.
If no vehicles are found, return an empty array [].

HTML content:
`;

/** Max HTML characters to send to Gemini (roughly ~30k tokens) */
const MAX_HTML_CHARS = 120_000;

// ── Scraper class ───────────────────────────────────────────────

export class GenericAiScraper extends BaseScraper {
  name = 'generic-ai';

  async scrape(options?: { inventoryUrl: string }): Promise<ScraperResult> {
    const startTime = Date.now();
    const listings: ScrapedListing[] = [];
    const errors: string[] = [];

    if (!options?.inventoryUrl) {
      return { success: false, listings: [], errors: ['No inventory URL provided'], duration_ms: 0 };
    }

    const apiKey = config.googleAiApiKey;
    if (!apiKey) {
      logger.warn('GenericAI: no GOOGLE_AI_API_KEY configured, skipping');
      return {
        success: false,
        listings: [],
        errors: ['No GOOGLE_AI_API_KEY configured. Set it in .env to use the AI scraper.'],
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      // 1. Fetch the dealer inventory page
      const resp = await fetch(options.inventoryUrl, {
        headers: {
          'User-Agent': config.userAgent,
          'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} fetching ${options.inventoryUrl}`);
      }

      const html = await resp.text();

      // 2. Trim HTML to relevant content
      const trimmedHtml = this.trimHtml(html);

      if (trimmedHtml.length < 100) {
        logger.warn({ url: options.inventoryUrl }, 'GenericAI: page content too short after trimming');
        return {
          success: true,
          listings: [],
          errors: [],
          duration_ms: Date.now() - startTime,
        };
      }

      // 3. Send to Gemini Flash for extraction
      const extracted = await this.callGemini(apiKey, trimmedHtml);

      if (!extracted || extracted.length === 0) {
        logger.info({ url: options.inventoryUrl }, 'GenericAI: Gemini found no vehicle listings');
        return {
          success: true,
          listings: [],
          errors: [],
          duration_ms: Date.now() - startTime,
        };
      }

      // 4. Resolve base URL for relative links/images
      let baseOrigin: string;
      try {
        baseOrigin = new URL(options.inventoryUrl).origin;
      } catch {
        baseOrigin = '';
      }

      // 5. Map extracted data to ScrapedListing format
      for (const vehicle of extracted) {
        const year = vehicle.year ?? 0;
        const make = vehicle.make ?? '';
        const model = vehicle.model ?? '';

        if (!year || !make) continue;

        // Resolve photo URLs
        const photos = (vehicle.photos ?? []).map((url) => {
          if (url.startsWith('http')) return url;
          return `${baseOrigin}${url.startsWith('/') ? '' : '/'}${url}`;
        });

        // Resolve listing URL
        let sourceUrl: string | null = vehicle.url ?? null;
        if (sourceUrl && !sourceUrl.startsWith('http')) {
          sourceUrl = `${baseOrigin}${sourceUrl.startsWith('/') ? '' : '/'}${sourceUrl}`;
        }

        listings.push({
          vin: vehicle.vin ?? null,
          source: 'generic-ai',
          source_url: sourceUrl,
          source_listing_id: vehicle.vin ?? `ai-${year}-${make}-${model}-${vehicle.price ?? 0}`,
          year,
          make,
          model,
          trim: vehicle.trim ?? '',
          body_style: vehicle.body_style ?? null,
          engine: vehicle.engine ?? null,
          transmission: vehicle.transmission ?? null,
          drivetrain: vehicle.drivetrain ?? null,
          exterior_color: vehicle.exterior_color ?? null,
          interior_color: vehicle.interior_color ?? null,
          fuel_type: vehicle.fuel_type ?? null,
          mileage: vehicle.mileage ?? 0,
          asking_price: vehicle.price ?? 0,
          title_status: 'unknown',
          seller_type: 'dealer',
          seller_name: null,
          seller_phone: null,
          seller_location: null,
          photos: photos.length > 0 ? JSON.stringify(photos) : null,
          description: vehicle.description ?? null,
        });
      }

      logger.info(
        { url: options.inventoryUrl, count: listings.length },
        'GenericAI: extraction complete',
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(msg);
      logger.warn({ url: options.inventoryUrl, error: msg }, 'GenericAI scrape failed');
    }

    return {
      success: errors.length === 0,
      listings,
      errors,
      duration_ms: Date.now() - startTime,
    };
  }

  // ── HTML trimming ─────────────────────────────────────────────

  /**
   * Strip non-essential elements from the HTML to reduce token count.
   * Removes: scripts, styles, SVGs, navs, footers, headers, iframes,
   * comments, and excessive whitespace.
   */
  private trimHtml(html: string): string {
    let trimmed = html;

    // Remove script and style blocks (including content)
    trimmed = trimmed.replace(/<script[\s\S]*?<\/script>/gi, '');
    trimmed = trimmed.replace(/<style[\s\S]*?<\/style>/gi, '');
    trimmed = trimmed.replace(/<svg[\s\S]*?<\/svg>/gi, '');

    // Remove HTML comments
    trimmed = trimmed.replace(/<!--[\s\S]*?-->/g, '');

    // Remove nav, footer, header elements
    trimmed = trimmed.replace(/<nav[\s\S]*?<\/nav>/gi, '');
    trimmed = trimmed.replace(/<footer[\s\S]*?<\/footer>/gi, '');
    trimmed = trimmed.replace(/<header[\s\S]*?<\/header>/gi, '');
    trimmed = trimmed.replace(/<iframe[\s\S]*?<\/iframe>/gi, '');
    trimmed = trimmed.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

    // Remove data URIs (base64 images bloat the text)
    trimmed = trimmed.replace(/data:[^"'\s]+/g, '');

    // Collapse whitespace
    trimmed = trimmed.replace(/\s+/g, ' ').trim();

    // Truncate to max character limit
    if (trimmed.length > MAX_HTML_CHARS) {
      trimmed = trimmed.slice(0, MAX_HTML_CHARS);
    }

    return trimmed;
  }

  // ── Gemini API call ───────────────────────────────────────────

  private async callGemini(apiKey: string, trimmedHtml: string): Promise<ExtractedVehicle[]> {
    const url = `${GEMINI_URL}?key=${apiKey}`;

    const body = {
      contents: [
        {
          parts: [
            { text: EXTRACTION_PROMPT + trimmedHtml },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      },
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`Gemini API HTTP ${resp.status}: ${text.slice(0, 200)}`);
    }

    const json = (await resp.json()) as GeminiResponse;

    if (json.error) {
      throw new Error(`Gemini API error: ${json.error.message ?? JSON.stringify(json.error)}`);
    }

    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      logger.warn('GenericAI: Gemini returned empty response');
      return [];
    }

    // Parse the JSON response - Gemini sometimes wraps it in markdown fences
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed: unknown = JSON.parse(cleaned);
      if (!Array.isArray(parsed)) {
        logger.warn('GenericAI: Gemini response was not an array');
        return [];
      }
      return parsed as ExtractedVehicle[];
    } catch (parseErr) {
      logger.warn(
        { response: cleaned.slice(0, 300) },
        'GenericAI: failed to parse Gemini JSON response',
      );
      return [];
    }
  }
}
