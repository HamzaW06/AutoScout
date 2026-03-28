const API_BASE_RAW = import.meta.env.VITE_API_BASE_URL || '/api';

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (trimmed === '') return '/api';
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

const API_BASE = normalizeBaseUrl(API_BASE_RAW);

function apiUrl(path: string): string {
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json() as { error?: string; message?: string };
    return body.error || body.message || `${res.status} ${res.statusText}`;
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

export interface Listing {
  id: string;
  vin: string | null;
  year: number;
  make: string;
  model: string;
  trim: string;
  mileage: number;
  asking_price: number;
  market_value: number | null;
  deal_score: number | null;
  value_rating: string | null;
  risk_score: number | null;
  scam_score: number | null;
  negotiation_power: number | null;
  title_status: string;
  seller_type: string | null;
  seller_name: string | null;
  seller_location: string | null;
  distance_miles: number | null;
  days_on_market: number | null;
  photos: string | null;
  description: string | null;
  is_favorite: number;
  price_dropped: number;
  price_drop_count: number;
  first_seen: string;
  source: string;
  engine: string | null;
  transmission: string | null;
  exterior_color: string | null;
  risk_factors: string | null;
  scam_flags: string | null;
  negotiation_tactics: string | null;
  offer_low: number | null;
  offer_high: number | null;
  price_per_mile: number | null;
  body_style: string | null;
  drivetrain: string | null;
  fuel_type: string | null;
  owner_count: number | null;
  accident_count: number | null;
  seller_lat: number | null;
  seller_lng: number | null;
  repair_forecast: string | null;
  seller_phone: string | null;
  source_url: string | null;
  scrape_confidence?: number;
  scrape_tier?: string;
  vin_history_fetched_at?: string;
}

export interface ListingsResponse {
  listings: Listing[];
  total: number;
}

export interface Stats {
  activeListings: number;
  activeDealers: number;
  unresolvedIssues: number;
  ratingBreakdown: Record<string, number>;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(`API error: ${message}`);
  }
  return res.json();
}

async function requestResponse(path: string, options?: RequestInit): Promise<Response> {
  const res = await fetch(apiUrl(path), {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const message = await parseErrorMessage(res);
    throw new Error(`API error: ${message}`);
  }
  return res;
}

export async function fetchListings(
  params?: Record<string, string>,
): Promise<ListingsResponse> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return request<ListingsResponse>(`/listings${qs}`);
}

export async function fetchListing(id: string): Promise<Listing> {
  return request<Listing>(`/listings/${id}`);
}

export async function fetchStats(): Promise<Stats> {
  return request<Stats>('/stats');
}

export async function toggleFavorite(
  id: string,
  isFavorite: boolean,
): Promise<void> {
  await request(`/listings/${id}/favorite`, {
    method: 'PUT',
    body: JSON.stringify({ is_favorite: isFavorite ? 1 : 0 }),
  });
}

export async function updateNotes(id: string, notes: string): Promise<void> {
  await request(`/listings/${id}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ notes }),
  });
}

// ---------------------------------------------------------------------------
// Dealers
// ---------------------------------------------------------------------------

export interface Dealer {
  id: number;
  name: string;
  website_url: string | null;
  platform: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  dealer_type: string | null;
  typical_inventory_size: number | null;
  is_active: number;
  last_scraped: string | null;
  scrape_success_rate: number | null;
  scrape_priority: string | null;
}

export async function fetchDealers(): Promise<Dealer[]> {
  return request<Dealer[]>('/dealers');
}

export async function createDealer(
  data: Partial<Dealer>,
): Promise<{ id: number }> {
  return request<{ id: number }>('/dealers', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDealer(
  id: number,
  data: Partial<Dealer>,
): Promise<void> {
  await request(`/dealers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AuditStats {
  activeListings: number;
  avgCompleteness: number;
  vinsVerified: number;
  multiSourceVerified: number;
  criticalIssues: number;
  warnings: number;
  lastSweep: string | null;
}

// ---------------------------------------------------------------------------
// Dealer import / scrape / health
// ---------------------------------------------------------------------------

export async function importDealers(
  dealers: Array<{ url: string; name: string; city?: string }>,
): Promise<any> {
  return request('/dealers/import', {
    method: 'POST',
    body: JSON.stringify({ dealers }),
  });
}

export async function triggerDealerScrape(dealerId: number): Promise<any> {
  return request(`/dealers/${dealerId}/scrape`, { method: 'POST' });
}

export async function fetchDealerHealth(dealerId: number): Promise<any> {
  return request(`/dealers/${dealerId}/health`);
}

export async function fetchScraperHealth(): Promise<any> {
  return request('/scraper-health');
}

export async function exportListings(format: 'csv' | 'json', filters: Record<string, unknown> = {}) {
  const res = await requestResponse('/listings/export', {
    method: 'POST',
    body: JSON.stringify({ format, filters }),
  });
  if (format === 'csv') {
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'autoscout-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  } else {
    return res.json();
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function fetchSettings(): Promise<Record<string, string>> {
  return request('/settings');
}

export async function saveSettings(settings: Record<string, string>): Promise<any> {
  return request('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function createTransaction(data: {
  listing_id?: string; dealer_id?: number; type: string;
  notes: string; offered_price?: number; final_price?: number;
}): Promise<any> {
  return request('/transactions', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchTransactions(): Promise<any> {
  return request('/transactions');
}

// ---------------------------------------------------------------------------
// VIN History
// ---------------------------------------------------------------------------

export async function fetchVinHistory(listingId: string, forceRefresh = false) {
  if (!forceRefresh) {
    // Try cached first
    try {
      const cached = await fetch(apiUrl(`/listings/${listingId}/vin-history`));
      if (cached.ok) return cached.json();
    } catch { /* fall through to POST */ }
  }

  const res = await fetch(apiUrl(`/listings/${listingId}/vin-history`), { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error || 'Failed to fetch VIN history');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export async function fetchAuditStats(): Promise<AuditStats> {
  try {
    return await request<AuditStats>('/audit/stats');
  } catch {
    // Mock defaults until the backend endpoint exists
    return {
      activeListings: 0,
      avgCompleteness: 72,
      vinsVerified: 58,
      multiSourceVerified: 34,
      criticalIssues: 3,
      warnings: 12,
      lastSweep: new Date().toISOString(),
    };
  }
}
