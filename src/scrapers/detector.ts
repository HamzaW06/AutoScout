// ── Platform Auto-Detection Engine ─────────────────────────────────
// Detects which platform a dealer website runs on by fetching the HTML
// and matching against known platform signatures.  Used when a user adds
// a dealer by URL so we can choose the right scraper.
// -------------------------------------------------------------------

import { config } from '../config.js';
import { logger } from '../logger.js';

// ── Public types ──────────────────────────────────────────────────

export interface PlatformDetection {
  platform: string;        // 'dealer.com', 'frazer', 'dealersocket', etc.
  confidence: number;      // 0-1
  inventoryUrl: string | null;
  scraperType: string;     // 'platform', 'ai_generic', 'facebook_only'
}

// ── Platform signature database ──────────────────────────────────

const PLATFORM_SIGNATURES: Record<string, {
  patterns: string[];
  inventoryPath: string | null;
}> = {
  'dealer.com':     { patterns: ['ddc-', 'dealer.com/content', 'ddcstatic'], inventoryPath: '/used-vehicles/' },
  'dealersocket':   { patterns: ['dscdn', 'dealersocket'], inventoryPath: '/inventory' },
  'frazer':         { patterns: ['frazer', 'frazercms'], inventoryPath: '/inventory.aspx' },
  'dealerfire':     { patterns: ['dealerfire'], inventoryPath: '/vehicles/used/' },
  'dealer_inspire': { patterns: ['dealerinspire', 'di-'], inventoryPath: '/inventory/' },
  'autorevo':       { patterns: ['autorevo', 'arcdn'], inventoryPath: '/inventory' },
  'dealer_center':  { patterns: ['dealercenter'], inventoryPath: '/all-inventory' },
  'wayne_reaves':   { patterns: ['waynereaves'], inventoryPath: '/inventory' },
  'v12_software':   { patterns: ['v12software'], inventoryPath: '/vehicles' },
  'promax':         { patterns: ['promax'], inventoryPath: '/inventory' },
  'carsforsale':    { patterns: ['carsforsale.com'], inventoryPath: null },

  // Expanded platform set (Task 5)
  'dealeron':           { patterns: ['dealeron.com', 'cdn.dealeron.com', 'dealeron'], inventoryPath: '/used-vehicles' },
  'dealer_eprocess':    { patterns: ['eprocess', 'dealereprocess.com', 'ep-widget'], inventoryPath: '/inventory/used' },
  'dealer_center_pro':  { patterns: ['dealercenterpro', 'dcpweb.com', 'dealercenter'], inventoryPath: '/inventory' },
  'vericom':            { patterns: ['vericom.net', 'vericomvdp'], inventoryPath: '/inventory' },
  'homenet_iol':        { patterns: ['homenetiol', 'homenet.com', 'iol.io'], inventoryPath: '/all-inventory' },
  'lotlinx':            { patterns: ['lotlinx.com', 'lotlinx'], inventoryPath: '/inventory' },
  'wordpress_dealer':   { patterns: ['wp-content', 'wp-json', 'wordpress'], inventoryPath: '/inventory' },
  'shopify_dealer':     { patterns: ['cdn.shopify.com', 'shopify.theme', 'myshopify.com'], inventoryPath: '/collections' },
  'wix_dealer':         { patterns: ['wix.com', 'wixsite.com', 'static.wixstatic.com'], inventoryPath: '/inventory' },
};

// ── Detection logic ──────────────────────────────────────────────

/**
 * Fetch a dealer website and match its HTML source against known platform
 * signatures.  Returns the detected platform, a confidence score, and
 * the constructed inventory URL (when available).
 */
export async function detectPlatform(websiteUrl: string): Promise<PlatformDetection> {
  let html: string;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

    const res = await fetch(websiteUrl, {
      headers: { 'User-Agent': config.userAgent },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timer);

    if (!res.ok) {
      logger.warn({ url: websiteUrl, status: res.status }, 'detector: non-OK response');
      return unknownResult();
    }

    html = await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ url: websiteUrl, error: msg }, 'detector: fetch failed');
    return unknownResult();
  }

  const htmlLower = html.toLowerCase();

  // Check each platform's patterns against the page source
  for (const [platform, sig] of Object.entries(PLATFORM_SIGNATURES)) {
    const matchedPatterns = sig.patterns.filter((p) => htmlLower.includes(p.toLowerCase()));

    if (matchedPatterns.length > 0) {
      // Confidence scales with how many of the platform's patterns matched
      const confidence = Math.min(matchedPatterns.length / sig.patterns.length, 1);

      // Build the inventory URL from the website base and the known path
      let inventoryUrl: string | null = null;
      if (sig.inventoryPath) {
        try {
          const base = new URL(websiteUrl);
          inventoryUrl = `${base.origin}${sig.inventoryPath}`;
        } catch {
          inventoryUrl = null;
        }
      }

      logger.info(
        { platform, confidence, matchedPatterns, url: websiteUrl },
        'detector: platform identified',
      );

      return {
        platform,
        confidence,
        inventoryUrl,
        scraperType: 'platform',
      };
    }
  }

  // Check for Facebook marketplace links as a special case
  if (htmlLower.includes('facebook.com/marketplace') || htmlLower.includes('fb.com/marketplace')) {
    logger.info({ url: websiteUrl }, 'detector: Facebook-only dealer detected');
    return {
      platform: 'facebook',
      confidence: 0.6,
      inventoryUrl: null,
      scraperType: 'facebook_only',
    };
  }

  logger.info({ url: websiteUrl }, 'detector: no platform match found');
  return unknownResult();
}

/** Default result when no platform can be identified. */
function unknownResult(): PlatformDetection {
  return {
    platform: 'unknown',
    confidence: 0,
    inventoryUrl: null,
    scraperType: 'ai_generic',
  };
}
