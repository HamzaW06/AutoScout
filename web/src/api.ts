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
