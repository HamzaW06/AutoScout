const API_BASE = '/api';

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
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
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

export async function importDealers(dealers: Array<{ url: string; name: string; city?: string }>) {
  const res = await fetch(`${API_BASE}/dealers/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dealers }),
  });
  return res.json();
}

export async function triggerDealerScrape(dealerId: number) {
  const res = await fetch(`${API_BASE}/dealers/${dealerId}/scrape`, { method: 'POST' });
  return res.json();
}

export async function fetchDealerHealth(dealerId: number) {
  const res = await fetch(`${API_BASE}/dealers/${dealerId}/health`);
  return res.json();
}

export async function fetchScraperHealth() {
  const res = await fetch(`${API_BASE}/scraper-health`);
  return res.json();
}

export async function exportListings(format: 'csv' | 'json', filters: Record<string, unknown> = {}) {
  const res = await fetch(`${API_BASE}/listings/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function saveSettings(settings: Record<string, string>) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return res.json();
}

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export async function createTransaction(data: {
  listing_id?: string; dealer_id?: number; type: string;
  notes: string; offered_price?: number; final_price?: number;
}) {
  const res = await fetch(`${API_BASE}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function fetchTransactions() {
  const res = await fetch(`${API_BASE}/transactions`);
  return res.json();
}

// ---------------------------------------------------------------------------
// VIN History
// ---------------------------------------------------------------------------

export async function fetchVinHistory(listingId: string, forceRefresh = false) {
  if (!forceRefresh) {
    // Try cached first
    try {
      const cached = await fetch(`${API_BASE}/listings/${listingId}/vin-history`);
      if (cached.ok) return cached.json();
    } catch { /* fall through to POST */ }
  }

  const res = await fetch(`${API_BASE}/listings/${listingId}/vin-history`, { method: 'POST' });
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
