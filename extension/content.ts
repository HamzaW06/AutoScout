// ==========================================================================
// AutoScout - Content Script
// Runs on car marketplace listing pages and overlays deal badges.
// ==========================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DetectedListing {
  title: string;
  price: number | null;
  url: string;
  vin: string | null;
  site: string;
  element: HTMLElement;
}

interface AnalyzeResponse {
  rating: string;
  riskScore: number;
}

// ---------------------------------------------------------------------------
// Processed element tracking (avoid double-processing)
// ---------------------------------------------------------------------------

const processedElements = new WeakSet<HTMLElement>();

// ---------------------------------------------------------------------------
// Site detection
// ---------------------------------------------------------------------------

function detectSite(): string {
  const host = window.location.hostname;
  if (host.includes('craigslist')) return 'craigslist';
  if (host.includes('facebook')) return 'facebook';
  if (host.includes('cars.com')) return 'cars.com';
  if (host.includes('autotrader')) return 'autotrader';
  if (host.includes('cargurus')) return 'cargurus';
  return 'unknown';
}

// ---------------------------------------------------------------------------
// VIN extraction
// ---------------------------------------------------------------------------

function extractVin(text: string): string | null {
  // VIN: 17 alphanumeric characters excluding I, O, Q
  const match = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/);
  return match ? match[0] : null;
}

// ---------------------------------------------------------------------------
// Price parsing
// ---------------------------------------------------------------------------

function parsePrice(text: string): number | null {
  // Match common price formats: $12,345  $12345  12,345
  const match = text.match(/\$?\s?([\d,]+)/);
  if (!match) return null;
  const num = parseInt(match[1].replace(/,/g, ''), 10);
  // Sanity check: cars are typically $500 - $500,000
  if (num >= 500 && num <= 500_000) return num;
  return null;
}

// ---------------------------------------------------------------------------
// Per-site listing extraction
// ---------------------------------------------------------------------------

function findCraigslistListings(): DetectedListing[] {
  const listings: DetectedListing[] = [];

  // Modern Craigslist search results
  const elements = document.querySelectorAll<HTMLElement>(
    '.cl-search-result, .result-row, li.cl-static-search-result',
  );

  for (const el of elements) {
    if (processedElements.has(el)) continue;

    const titleEl =
      el.querySelector<HTMLAnchorElement>('.titlestring, .result-title, a.posting-title') ||
      el.querySelector<HTMLAnchorElement>('a');
    const priceEl = el.querySelector<HTMLElement>('.priceinfo, .result-price');

    const title = titleEl?.textContent?.trim() || '';
    const url = titleEl?.href || '';
    const price = priceEl ? parsePrice(priceEl.textContent || '') : null;
    const vin = extractVin(el.textContent || '');

    if (title && url) {
      listings.push({ title, price, url, vin, site: 'craigslist', element: el });
    }
  }

  return listings;
}

function findFacebookListings(): DetectedListing[] {
  const listings: DetectedListing[] = [];

  // Facebook Marketplace uses dynamic class names; target common structural patterns
  const elements = document.querySelectorAll<HTMLElement>(
    'div[data-testid="marketplace-search-results"] a[href*="/marketplace/item/"], ' +
    'div.x9f619 a[href*="/marketplace/item/"]',
  );

  // Deduplicate by getting the closest card-like ancestor
  const seen = new Set<HTMLElement>();
  for (const anchor of elements) {
    const card = anchor.closest<HTMLElement>('div[class*="x9f619"]') || anchor.parentElement;
    if (!card || seen.has(card) || processedElements.has(card)) continue;
    seen.add(card);

    const title = card.textContent?.trim().split('\n')[0] || '';
    const url = (anchor as HTMLAnchorElement).href || '';
    const priceText = card.textContent || '';
    const price = parsePrice(priceText);
    const vin = extractVin(priceText);

    if (title && url) {
      listings.push({ title, price, url, vin, site: 'facebook', element: card });
    }
  }

  return listings;
}

function findCarsComListings(): DetectedListing[] {
  const listings: DetectedListing[] = [];

  const elements = document.querySelectorAll<HTMLElement>('.vehicle-card');

  for (const el of elements) {
    if (processedElements.has(el)) continue;

    const titleEl = el.querySelector<HTMLElement>('.title, h2');
    const linkEl = el.querySelector<HTMLAnchorElement>('a[href*="/vehicledetail/"]') ||
                   el.querySelector<HTMLAnchorElement>('a');
    const priceEl = el.querySelector<HTMLElement>('.primary-price, [class*="price"]');

    const title = titleEl?.textContent?.trim() || '';
    const url = linkEl?.href || '';
    const price = priceEl ? parsePrice(priceEl.textContent || '') : null;
    const vin = extractVin(el.textContent || '');

    if (title && url) {
      listings.push({ title, price, url, vin, site: 'cars.com', element: el });
    }
  }

  return listings;
}

function findAutotraderListings(): DetectedListing[] {
  const listings: DetectedListing[] = [];

  const elements = document.querySelectorAll<HTMLElement>(
    'div[data-cmp="inventoryListing"], .inventory-listing',
  );

  for (const el of elements) {
    if (processedElements.has(el)) continue;

    const titleEl = el.querySelector<HTMLElement>('h2, .text-bold');
    const linkEl = el.querySelector<HTMLAnchorElement>('a[href*="/cars-for-sale/"]') ||
                   el.querySelector<HTMLAnchorElement>('a');
    const priceEl = el.querySelector<HTMLElement>('.first-price, [data-cmp="firstPrice"]');

    const title = titleEl?.textContent?.trim() || '';
    const url = linkEl?.href || '';
    const price = priceEl ? parsePrice(priceEl.textContent || '') : null;
    const vin = extractVin(el.textContent || '');

    if (title && url) {
      listings.push({ title, price, url, vin, site: 'autotrader', element: el });
    }
  }

  return listings;
}

function findCargurusListings(): DetectedListing[] {
  const listings: DetectedListing[] = [];

  const elements = document.querySelectorAll<HTMLElement>(
    '.cg-dealFinder-result-wrap, [data-cg-ft="car-blade"]',
  );

  for (const el of elements) {
    if (processedElements.has(el)) continue;

    const titleEl = el.querySelector<HTMLElement>('h4, .cg-dealFinder-result-title');
    const linkEl = el.querySelector<HTMLAnchorElement>('a[href*="/Cars/"]') ||
                   el.querySelector<HTMLAnchorElement>('a');
    const priceEl = el.querySelector<HTMLElement>('.cg-dealFinder-result-stats h4, [class*="price"]');

    const title = titleEl?.textContent?.trim() || '';
    const url = linkEl?.href || '';
    const price = priceEl ? parsePrice(priceEl.textContent || '') : null;
    const vin = extractVin(el.textContent || '');

    if (title && url) {
      listings.push({ title, price, url, vin, site: 'cargurus', element: el });
    }
  }

  return listings;
}

function findListings(site: string): DetectedListing[] {
  switch (site) {
    case 'craigslist': return findCraigslistListings();
    case 'facebook':   return findFacebookListings();
    case 'cars.com':   return findCarsComListings();
    case 'autotrader':  return findAutotraderListings();
    case 'cargurus':    return findCargurusListings();
    default:           return [];
  }
}

// ---------------------------------------------------------------------------
// UI: Deal badge
// ---------------------------------------------------------------------------

function ratingToCssClass(rating: string): string {
  const map: Record<string, string> = {
    STEAL: 'steal',
    GREAT: 'great',
    GOOD: 'good',
    FAIR: 'fair',
    HIGH: 'high',
    'RIP-OFF': 'ripoff',
    UNKNOWN: 'unknown',
  };
  return map[rating] || 'unknown';
}

function riskLevel(score: number): string {
  if (score < 0) return 'none';
  if (score <= 30) return 'low';
  if (score <= 60) return 'medium';
  return 'high';
}

function createBadge(rating: string, riskScore: number): HTMLElement {
  const badge = document.createElement('div');
  badge.className = `autoscout-badge ${ratingToCssClass(rating)}`;

  const label = document.createElement('span');
  label.textContent = rating;
  badge.appendChild(label);

  // Risk dot
  const dot = document.createElement('span');
  dot.className = `autoscout-risk-dot ${riskLevel(riskScore)}`;
  dot.title = riskScore >= 0 ? `Risk: ${riskScore}/100` : 'Risk: N/A';
  badge.appendChild(dot);

  // Expandable detail panel
  let detailEl: HTMLElement | null = null;
  badge.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (detailEl) {
      detailEl.remove();
      detailEl = null;
      return;
    }

    detailEl = document.createElement('div');
    detailEl.className = 'autoscout-detail';
    detailEl.innerHTML = `
      <div class="autoscout-detail-row">
        <span class="autoscout-detail-label">Rating</span>
        <span class="autoscout-detail-value">${rating}</span>
      </div>
      <div class="autoscout-detail-divider"></div>
      <div class="autoscout-detail-row">
        <span class="autoscout-detail-label">Risk Score</span>
        <span class="autoscout-detail-value">${riskScore >= 0 ? riskScore + '/100' : 'N/A'}</span>
      </div>
    `;
    badge.appendChild(detailEl);

    // Close on outside click
    const closeHandler = (ev: MouseEvent) => {
      if (!badge.contains(ev.target as Node)) {
        detailEl?.remove();
        detailEl = null;
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 0);
  });

  return badge;
}

// ---------------------------------------------------------------------------
// UI: Save button
// ---------------------------------------------------------------------------

function createSaveButton(listing: DetectedListing): HTMLElement {
  const btn = document.createElement('button');
  btn.className = 'autoscout-save-btn';
  btn.textContent = 'Save to AutoScout';
  btn.type = 'button';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = 'Saving...';

    chrome.runtime.sendMessage(
      {
        type: 'SAVE_LISTING',
        data: {
          title: listing.title,
          price: listing.price,
          url: listing.url,
          vin: listing.vin,
          site: listing.site,
        },
      },
      (response) => {
        if (response?.success) {
          btn.textContent = 'Saved!';
          btn.classList.add('saved');
        } else {
          btn.textContent = 'Failed - Retry';
          btn.classList.add('error');
          btn.disabled = false;
          // Allow retry after a moment
          setTimeout(() => {
            btn.classList.remove('error');
            btn.textContent = 'Save to AutoScout';
          }, 3000);
        }
      },
    );
  });

  return btn;
}

// ---------------------------------------------------------------------------
// VIN tag
// ---------------------------------------------------------------------------

function createVinTag(vin: string): HTMLElement {
  const tag = document.createElement('span');
  tag.className = 'autoscout-vin-tag';
  tag.textContent = `VIN: ${vin}`;
  tag.title = vin;
  return tag;
}

// ---------------------------------------------------------------------------
// Process a single listing element
// ---------------------------------------------------------------------------

async function processListing(listing: DetectedListing): Promise<void> {
  if (processedElements.has(listing.element)) return;
  processedElements.add(listing.element);

  // Ensure parent is positioned for absolute badge placement
  const computed = window.getComputedStyle(listing.element);
  if (computed.position === 'static') {
    listing.element.classList.add('autoscout-listing-wrap');
  }

  // Request analysis from the background script
  const analysis: AnalyzeResponse = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      {
        type: 'ANALYZE_LISTING',
        data: {
          title: listing.title,
          price: listing.price,
          vin: listing.vin,
        },
      },
      (response) => {
        resolve(response || { rating: 'UNKNOWN', riskScore: -1 });
      },
    );
  });

  // Create and attach badge
  const badge = createBadge(analysis.rating, analysis.riskScore);
  listing.element.appendChild(badge);

  // Create and attach save button
  const saveBtn = createSaveButton(listing);
  listing.element.appendChild(saveBtn);

  // If VIN was found, show a tag
  if (listing.vin) {
    const vinTag = createVinTag(listing.vin);
    listing.element.appendChild(vinTag);
  }
}

// ---------------------------------------------------------------------------
// Full scan
// ---------------------------------------------------------------------------

function scanPage(): number {
  const site = detectSite();
  if (site === 'unknown') return 0;

  const listings = findListings(site);

  for (const listing of listings) {
    processListing(listing);
  }

  return listings.length;
}

// ---------------------------------------------------------------------------
// Listen for messages from popup / background
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
  (
    message: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: any) => void,
  ) => {
    if (message.type === 'TRIGGER_SCAN') {
      const count = scanPage();
      sendResponse({ scanned: true, count });
    }
    return false;
  },
);

// ---------------------------------------------------------------------------
// Initialise
// ---------------------------------------------------------------------------

function init(): void {
  // Initial scan
  scanPage();

  // Observe DOM mutations for infinite scroll / dynamically loaded content
  const observer = new MutationObserver((mutations) => {
    // Only re-scan if actual nodes were added (not just attribute changes)
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }
    if (hasNewNodes) {
      // Debounce: wait a bit for the DOM to settle
      clearTimeout(scanDebounceTimer);
      scanDebounceTimer = window.setTimeout(() => scanPage(), 500);
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
}

let scanDebounceTimer: number = 0;

// Run when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
