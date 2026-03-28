// Scam detection engine for AutoScout listings

export interface ScamInput {
  id: string;
  vin?: string | null;
  vin_verified?: number;
  asking_price: number;
  deal_score?: number;
  listing_date?: string | null;
  photos?: string | null;
  seller_type?: string;
  seller_name?: string | null;
  seller_phone?: string | null;
  seller_rating?: number;
}

export interface ScamResult {
  score: number;
  level: 'LIKELY SCAM' | 'HIGH RISK' | 'CAUTION' | 'CLEAR';
  flags: string[];
}

// Major Houston-area storm dates
const HOUSTON_STORM_DATES: { name: string; date: string }[] = [
  { name: 'Hurricane Harvey', date: '2017-08-25' },
  { name: 'Tropical Storm Imelda', date: '2019-09-17' },
  { name: 'Winter Storm Uri', date: '2021-02-13' },
  { name: 'Hurricane Nicholas', date: '2021-09-14' },
];

const STORM_WINDOW_DAYS = 60;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function isPostStorm(listingDate: string): string | null {
  const listed = new Date(listingDate);
  if (isNaN(listed.getTime())) return null;

  for (const storm of HOUSTON_STORM_DATES) {
    const stormDate = new Date(storm.date);
    const diff = daysBetween(stormDate, listed);
    if (diff >= 0 && diff <= STORM_WINDOW_DAYS) {
      return storm.name;
    }
  }
  return null;
}

function parsePhotos(photos: string | null | undefined): string[] {
  if (!photos) return [];
  try {
    const parsed = JSON.parse(photos);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function detectScams(listing: ScamInput, allListings: ScamInput[]): ScamResult {
  const flags: string[] = [];

  // 1. CURBSTONER: "private" seller with 4+ listings matching phone or name
  if (listing.seller_type === 'private') {
    const otherListings = allListings.filter((l) => l.id !== listing.id);

    if (listing.seller_phone) {
      const phoneMatches = otherListings.filter(
        (l) => l.seller_phone && l.seller_phone === listing.seller_phone
      );
      if (phoneMatches.length >= 3) {
        // 3 others + this listing = 4+ total
        flags.push('CURBSTONER');
      }
    }

    if (
      !flags.includes('CURBSTONER') &&
      listing.seller_name
    ) {
      const nameMatches = otherListings.filter(
        (l) => l.seller_name && l.seller_name === listing.seller_name
      );
      if (nameMatches.length >= 3) {
        flags.push('CURBSTONER');
      }
    }
  }

  // 2. VIN NOT VERIFIED: vin exists but vin_verified === 0
  if (listing.vin && listing.vin_verified === 0) {
    flags.push('VIN NOT VERIFIED');
  }

  // 3. SUSPICIOUS PRICE: deal_score > 40
  if (listing.deal_score !== undefined && listing.deal_score > 40) {
    flags.push('SUSPICIOUS PRICE');
  }

  // 4. POST-STORM: listed within 60 days after a major Houston storm
  if (listing.listing_date) {
    const storm = isPostStorm(listing.listing_date);
    if (storm) {
      flags.push(`POST-STORM (${storm})`);
    }
  }

  // 5. DUPLICATE PHOTOS: same photo URLs found in other listings
  const listingPhotos = parsePhotos(listing.photos);
  if (listingPhotos.length > 0) {
    const otherListings = allListings.filter((l) => l.id !== listing.id);
    const hasDuplicatePhotos = otherListings.some((other) => {
      const otherPhotos = parsePhotos(other.photos);
      return listingPhotos.some((url) => otherPhotos.includes(url));
    });
    if (hasDuplicatePhotos) {
      flags.push('DUPLICATE PHOTOS');
    }
  }

  // 6. NO PHOTOS: photos is null or empty array
  if (listingPhotos.length === 0) {
    flags.push('NO PHOTOS');
  }

  // 7. LOW RATED: seller_rating < 2.5
  if (listing.seller_rating !== undefined && listing.seller_rating < 2.5) {
    flags.push('LOW RATED');
  }

  // 8. NO VIN: vin is null/empty
  if (!listing.vin) {
    flags.push('NO VIN');
  }

  // Score and level
  const score = Math.min(100, flags.length * 15);
  let level: ScamResult['level'];
  if (flags.length >= 3) {
    level = 'LIKELY SCAM';
  } else if (flags.length >= 2) {
    level = 'HIGH RISK';
  } else if (flags.length >= 1) {
    level = 'CAUTION';
  } else {
    level = 'CLEAR';
  }

  return { score, level, flags };
}
