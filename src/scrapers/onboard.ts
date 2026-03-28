// ── Dealer Auto-Discovery & Onboarding ───────────────────────────
// Analyzes a dealer URL, auto-detects the platform, runs a test
// scrape, and suggests scheduling priority.
// -------------------------------------------------------------------

import * as cheerio from 'cheerio';
import { detectPlatform } from './detector.js';
import { runCascade } from './cascade.js';
import { config } from '../config.js';
import { logger } from '../logger.js';

// ── Public types ──────────────────────────────────────────────────

export interface DiscoveryInput {
  listingsFound: number;
  platform: string;
  confidence: number;
  inventoryUrl: string;
  totalPages: number;
}

export interface DiscoveryResult {
  priority: 'critical' | 'high' | 'medium' | 'low';
  scrapeIntervalHours: number;
}

export interface OnboardResult {
  success: boolean;
  platform: string | null;
  platformConfidence: number;
  inventoryUrl: string;
  listingsFound: number;
  sampleListings: Array<{ year: number; make: string; model: string; price: number }>;
  totalPages: number;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low';
  scrapeIntervalHours: number;
  tierUsed: string;
  errors: string[];
  dealerMeta: { phone: string; address: string };
}

export interface BulkDealerInput {
  websiteUrl: string;
  dealerName: string;
}

// ── Inventory link patterns ───────────────────────────────────────

const INVENTORY_PATH_PATTERNS = [
  /\/inventory/i,
  /\/used-cars/i,
  /\/pre-owned/i,
  /\/vehicles/i,
  /\/our-cars/i,
  /\/browse/i,
];

// ── Phone regex ───────────────────────────────────────────────────

const PHONE_REGEX = /(\(?\d{3}\)?[\s.\-]\d{3}[\s.\-]\d{4})/;

// ── Pure analysis function ────────────────────────────────────────

/**
 * Pure function: given discovery metrics, returns a suggested priority
 * tier and scrape interval.
 *
 * Rules:
 *   50+ vehicles → high / 6h
 *   10–49        → medium / 12h
 *   <10          → low / 24h
 */
export function analyzeDiscoveryResult(input: DiscoveryInput): DiscoveryResult {
  if (input.listingsFound >= 50) {
    return { priority: 'high', scrapeIntervalHours: 6 };
  }
  if (input.listingsFound >= 10) {
    return { priority: 'medium', scrapeIntervalHours: 12 };
  }
  return { priority: 'low', scrapeIntervalHours: 24 };
}

// ── HTML fetch helper ─────────────────────────────────────────────

async function fetchHtml(url: string): Promise<{ html: string; ok: boolean; error?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(url, {
      headers: { 'User-Agent': config.userAgent },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!res.ok) {
      return { html: '', ok: false, error: `HTTP ${res.status} from ${url}` };
    }

    const html = await res.text();
    return { html, ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { html: '', ok: false, error: `Fetch failed for ${url}: ${msg}` };
  }
}

// ── Dealer metadata extraction ────────────────────────────────────

function extractDealerMeta($: cheerio.CheerioAPI, bodyText: string): { phone: string; address: string } {
  // Phone: prefer tel: links, fall back to regex in body text
  let phone = '';
  $('a[href^="tel:"]').each((_i, el) => {
    if (!phone) {
      phone = $(el).attr('href')?.replace('tel:', '').trim() ?? '';
    }
  });
  if (!phone) {
    const match = bodyText.match(PHONE_REGEX);
    if (match) phone = match[1];
  }

  // Address: prefer Schema.org itemprop, fall back to footer text heuristic
  let address = '';
  const itemprop = $('[itemprop="address"]').first();
  if (itemprop.length) {
    address = itemprop.text().replace(/\s+/g, ' ').trim();
  }
  if (!address) {
    const footer = $('footer').first();
    if (footer.length) {
      // Look for a line that looks like a street address
      const footerText = footer.text();
      const addrMatch = footerText.match(/\d+\s+[\w\s]+(?:Ave|Blvd|Dr|Hwy|Pkwy|Rd|St|Way)[.,]?\s*[\w\s,]+\d{5}/i);
      if (addrMatch) address = addrMatch[0].replace(/\s+/g, ' ').trim();
    }
  }

  return { phone, address };
}

// ── Inventory URL discovery ───────────────────────────────────────

function findInventoryUrl($: cheerio.CheerioAPI, baseUrl: string): string | null {
  let found: string | null = null;

  $('a[href]').each((_i, el) => {
    if (found) return false; // break

    const href = ($('a', el).attr('href') ?? $(el).attr('href') ?? '').trim();
    if (!href) return;

    for (const pattern of INVENTORY_PATH_PATTERNS) {
      if (pattern.test(href)) {
        try {
          found = new URL(href, baseUrl).toString();
        } catch {
          // ignore malformed URLs
        }
        return false; // break
      }
    }
  });

  return found;
}

// ── Main onboarding function ──────────────────────────────────────

/**
 * Analyzes a dealer website: detects platform, discovers inventory URL,
 * runs a test scrape, and returns structured onboarding metadata.
 */
export async function onboardDealer(websiteUrl: string, dealerName: string): Promise<OnboardResult> {
  const errors: string[] = [];

  logger.info({ websiteUrl, dealerName }, 'onboard: starting dealer analysis');

  // Step 1 — Fetch homepage HTML
  const homepageFetch = await fetchHtml(websiteUrl);
  if (!homepageFetch.ok) {
    errors.push(homepageFetch.error ?? 'Homepage fetch failed');
    return buildFailureResult(websiteUrl, errors);
  }

  const homepageHtml = homepageFetch.html;
  const $home = cheerio.load(homepageHtml);
  const homeBodyText = $home('body').text();

  // Step 2 — Detect platform
  const detection = await detectPlatform(websiteUrl);
  const platform = detection.platform !== 'unknown' ? detection.platform : null;
  const platformConfidence = detection.confidence;

  // Step 3 — Find inventory URL
  let inventoryUrl =
    detection.inventoryUrl ??
    findInventoryUrl($home, websiteUrl) ??
    websiteUrl;

  // Normalise to same origin if relative
  try {
    inventoryUrl = new URL(inventoryUrl, websiteUrl).toString();
  } catch {
    inventoryUrl = websiteUrl;
  }

  // Step 4 — Extract dealer phone & address from homepage
  const dealerMeta = extractDealerMeta($home, homeBodyText);

  // Step 5 — Fetch inventory page HTML (if different from homepage)
  let inventoryHtml = homepageHtml;
  if (inventoryUrl !== websiteUrl) {
    const invFetch = await fetchHtml(inventoryUrl);
    if (invFetch.ok) {
      inventoryHtml = invFetch.html;
    } else {
      errors.push(invFetch.error ?? 'Inventory page fetch failed');
      // Fall back to homepage HTML for the cascade
    }
  }

  // Step 6 — Run scraper cascade
  let cascadeResult;
  try {
    cascadeResult = await runCascade({
      url: inventoryUrl,
      html: inventoryHtml,
      platform,
      dealerId: 0,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Cascade error: ${msg}`);
    return buildFailureResult(websiteUrl, errors, {
      platform,
      platformConfidence,
      inventoryUrl,
      dealerMeta,
    });
  }

  if (!cascadeResult.success) {
    errors.push(...cascadeResult.errors);
  }

  const listings = cascadeResult.listings;
  const listingsFound = listings.length;

  // Estimate total pages from listing count (rough heuristic: 20/page)
  const totalPages = listingsFound > 0 ? Math.ceil(listingsFound / 20) : 0;

  // Step 7 — Analyse and build result
  const analysis = analyzeDiscoveryResult({
    listingsFound,
    platform: platform ?? 'unknown',
    confidence: platformConfidence,
    inventoryUrl,
    totalPages,
  });

  const sampleListings = listings.slice(0, 5).map((l) => ({
    year: l.year,
    make: l.make,
    model: l.model,
    price: l.asking_price,
  }));

  logger.info(
    { websiteUrl, dealerName, platform, listingsFound, priority: analysis.priority },
    'onboard: analysis complete',
  );

  return {
    success: true,
    platform,
    platformConfidence,
    inventoryUrl,
    listingsFound,
    sampleListings,
    totalPages,
    suggestedPriority: analysis.priority,
    scrapeIntervalHours: analysis.scrapeIntervalHours,
    tierUsed: cascadeResult.tier_used,
    errors,
    dealerMeta,
  };
}

// ── Failure result helper ─────────────────────────────────────────

function buildFailureResult(
  websiteUrl: string,
  errors: string[],
  partial?: {
    platform?: string | null;
    platformConfidence?: number;
    inventoryUrl?: string;
    dealerMeta?: { phone: string; address: string };
  },
): OnboardResult {
  return {
    success: false,
    platform: partial?.platform ?? null,
    platformConfidence: partial?.platformConfidence ?? 0,
    inventoryUrl: partial?.inventoryUrl ?? websiteUrl,
    listingsFound: 0,
    sampleListings: [],
    totalPages: 0,
    suggestedPriority: 'low',
    scrapeIntervalHours: 24,
    tierUsed: 'none',
    errors,
    dealerMeta: partial?.dealerMeta ?? { phone: '', address: '' },
  };
}

// ── Bulk onboarding ───────────────────────────────────────────────

/**
 * Processes multiple dealers concurrently using a worker-pool pattern.
 * Defaults to 3 concurrent workers.
 */
export async function bulkOnboard(
  dealers: BulkDealerInput[],
  concurrency = 3,
): Promise<Array<OnboardResult & { dealerName: string; websiteUrl: string }>> {
  const queue = [...dealers];
  const results: Array<OnboardResult & { dealerName: string; websiteUrl: string }> = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const dealer = queue.shift();
      if (!dealer) break;

      const result = await onboardDealer(dealer.websiteUrl, dealer.dealerName);
      results.push({ ...result, dealerName: dealer.dealerName, websiteUrl: dealer.websiteUrl });
    }
  }

  // Spawn `concurrency` workers and let them drain the queue
  const workers = Array.from({ length: Math.min(concurrency, dealers.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
