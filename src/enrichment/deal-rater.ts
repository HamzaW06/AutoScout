// ── Deal Rater ─────────────────────────────────────────────────────
// Rates a listing's value relative to market and produces offer
// guidance.  Pure logic – no DB or network access.
// -------------------------------------------------------------------

export type ValueRating = 'STEAL' | 'GREAT' | 'GOOD' | 'FAIR' | 'HIGH' | 'RIP-OFF';

export interface DealRating {
  rating: ValueRating;
  dealScore: number;    // % below/above market (positive = below = good)
  pricePerMile: number;
  offerLow: number;     // opening offer
  offerHigh: number;    // max to pay
}

/**
 * Rate a deal and compute offer guidance.
 *
 * @param askingPrice  – listed price in dollars
 * @param marketValue  – estimated fair market value in dollars
 * @param mileage      – current odometer reading
 */
export function calculateDealRating(
  askingPrice: number,
  marketValue: number,
  mileage: number,
): DealRating {
  // ── Deal score ──────────────────────────────────────────────────
  // Positive → asking price is *below* market (good for buyer)
  const dealScore = ((marketValue - askingPrice) / marketValue) * 100;

  // ── Rating band ─────────────────────────────────────────────────
  let rating: ValueRating;
  if (dealScore > 25) {
    rating = 'STEAL';
  } else if (dealScore > 15) {
    rating = 'GREAT';
  } else if (dealScore > 5) {
    rating = 'GOOD';
  } else if (dealScore > -5) {
    rating = 'FAIR';
  } else if (dealScore > -15) {
    rating = 'HIGH';
  } else {
    rating = 'RIP-OFF';
  }

  // ── Price per mile ──────────────────────────────────────────────
  const pricePerMile = mileage > 0 ? askingPrice / mileage : 0;

  // ── Offer range ─────────────────────────────────────────────────
  const offerLow = Math.round(marketValue * 0.80);   // 20 % below market
  const offerHigh = Math.round(marketValue * 0.95);   // 5 % below market

  return { rating, dealScore, pricePerMile, offerLow, offerHigh };
}
