export interface DeduplicationCandidate {
  id: string;
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string;
  mileage: number;
  asking_price: number;
  exterior_color?: string | null;
  seller_name?: string | null;
  source: string;
  sources_found_on?: string | null;
  is_multi_source?: number;
  // All other listing fields carried through
  [key: string]: unknown;
}

export interface DeduplicationResult {
  isDuplicate: boolean;
  matchedId: string | null;
  confidence: number;
  matchType: 'vin_exact' | 'fuzzy_tight' | 'fuzzy_same_seller' | 'fuzzy_color_trim' | 'none';
}

/**
 * Check if a new listing is a duplicate of any existing listing.
 * Uses a multi-layer matching strategy: exact VIN > fuzzy tight > fuzzy same seller > fuzzy color+trim.
 */
export function findDuplicate(
  newListing: DeduplicationCandidate,
  existingListings: DeduplicationCandidate[],
): DeduplicationResult {
  // LAYER 1: Exact VIN match (highest confidence)
  if (newListing.vin && newListing.vin.length === 17) {
    const vinMatch = existingListings.find(
      (l) => l.vin && l.vin === newListing.vin,
    );
    if (vinMatch) {
      return {
        isDuplicate: true,
        matchedId: vinMatch.id,
        confidence: 1.0,
        matchType: 'vin_exact',
      };
    }
  }

  // LAYER 2-4: Fuzzy matching
  for (const existing of existingListings) {
    if (existing.year !== newListing.year) continue;
    if (existing.make.toLowerCase() !== newListing.make.toLowerCase()) continue;
    if (existing.model.toLowerCase() !== newListing.model.toLowerCase()) continue;

    const mileageDiff = Math.abs(existing.mileage - newListing.mileage);
    const priceDiff = Math.abs(existing.asking_price - newListing.asking_price);

    // LAYER 2: Tight match — same car appearing on multiple sites
    if (mileageDiff < 200 && priceDiff < 200) {
      return {
        isDuplicate: true,
        matchedId: existing.id,
        confidence: 0.95,
        matchType: 'fuzzy_tight',
      };
    }

    // LAYER 3: Same seller, slightly different price (price changed between scrapes)
    if (
      mileageDiff < 500 &&
      priceDiff < 1000 &&
      existing.seller_name &&
      newListing.seller_name &&
      existing.seller_name.toLowerCase() === newListing.seller_name.toLowerCase()
    ) {
      return {
        isDuplicate: true,
        matchedId: existing.id,
        confidence: 0.85,
        matchType: 'fuzzy_same_seller',
      };
    }

    // LAYER 4: Color + trim match as additional signal
    if (
      mileageDiff < 1000 &&
      existing.exterior_color &&
      newListing.exterior_color &&
      existing.exterior_color.toLowerCase() ===
        newListing.exterior_color.toLowerCase() &&
      existing.trim &&
      newListing.trim &&
      existing.trim.toLowerCase() === newListing.trim.toLowerCase()
    ) {
      return {
        isDuplicate: true,
        matchedId: existing.id,
        confidence: 0.75,
        matchType: 'fuzzy_color_trim',
      };
    }
  }

  return {
    isDuplicate: false,
    matchedId: null,
    confidence: 0,
    matchType: 'none',
  };
}

/**
 * Merge an incoming listing into an existing one, keeping the richest data from each source.
 * Returns the merged listing object (does NOT write to DB).
 */
export function mergeListings(
  existing: DeduplicationCandidate,
  incoming: DeduplicationCandidate,
): DeduplicationCandidate {
  const merged = { ...existing };

  // Always update tracking fields
  merged.last_seen = new Date().toISOString();
  merged.is_active = 1;

  // Track all sources this VIN/listing appeared on
  let sources: string[];
  try {
    sources = JSON.parse(
      (existing.sources_found_on as string) || '[]',
    ) as string[];
  } catch {
    sources = [];
  }
  if (!sources.includes(incoming.source)) {
    sources.push(incoming.source);
  }
  merged.sources_found_on = JSON.stringify(sources);
  merged.is_multi_source = sources.length > 1 ? 1 : 0;

  // Prefer data from whichever source has more info (fill gaps)
  if (!existing.vin && incoming.vin) merged.vin = incoming.vin;
  if (!existing.engine && incoming.engine) merged.engine = incoming.engine;
  if (!existing.transmission && incoming.transmission)
    merged.transmission = incoming.transmission;
  if (!existing.drivetrain && incoming.drivetrain)
    merged.drivetrain = incoming.drivetrain;
  if (!existing.exterior_color && incoming.exterior_color)
    merged.exterior_color = incoming.exterior_color;
  if (!existing.interior_color && incoming.interior_color)
    merged.interior_color = incoming.interior_color;
  if (!existing.body_style && incoming.body_style)
    merged.body_style = incoming.body_style;
  if (!existing.trim && incoming.trim) merged.trim = incoming.trim;
  if (!existing.seller_phone && incoming.seller_phone)
    merged.seller_phone = incoming.seller_phone;
  if (!existing.description && incoming.description)
    merged.description = incoming.description;

  // Photos: prefer the source with more photos
  const existingPhotos = parseJsonArray(existing.photos as string | null);
  const incomingPhotos = parseJsonArray(incoming.photos as string | null);
  if (incomingPhotos.length > existingPhotos.length) {
    merged.photos = incoming.photos;
  }

  // Price: use the most recently seen price (incoming is newer)
  if (incoming.asking_price !== existing.asking_price) {
    merged.asking_price = incoming.asking_price;
  }

  return merged;
}

function parseJsonArray(json: string | null | undefined): unknown[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
