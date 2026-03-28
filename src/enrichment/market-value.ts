// ── Market Value Lookup ─────────────────────────────────────────────────────
// Looks up market values using MarketCheck API with a fallback computation
// from benchmark prices.
// ---------------------------------------------------------------------------

import { logger } from '../logger.js';
import { getPricePrediction } from '../scrapers/marketcheck.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketValueResult {
  marketValue: number;
  source: string;
}

export interface BenchmarkPrice {
  price: number;
  source: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Look up the market value for a vehicle.
 *
 * Strategy 1: If VIN is provided, call MarketCheck with the VIN. If the
 *             result has a price > 0, return it with source 'marketcheck_vin'.
 * Strategy 2: If Strategy 1 fails or no VIN, call MarketCheck with make/model/
 *             year/mileage. Return with source 'marketcheck_comparable'.
 * Strategy 3: If all fail, return { marketValue: 0, source: 'none' }.
 */
export async function lookupMarketValue(
  vin: string,
  make: string,
  model: string,
  year: number,
  mileage: number,
): Promise<MarketValueResult> {
  // Strategy 1: VIN-based lookup
  if (vin) {
    try {
      const result = await getPricePrediction({ vin, year, make, model, miles: mileage });
      if (result && result.predictedPrice > 0) {
        return { marketValue: result.predictedPrice, source: 'marketcheck_vin' };
      }
    } catch (err) {
      logger.debug({ err, vin }, 'MarketCheck VIN price prediction failed');
    }
  }

  // Strategy 2: Comparable lookup (no VIN)
  try {
    const result = await getPricePrediction({ year, make, model, miles: mileage });
    if (result && result.predictedPrice > 0) {
      return { marketValue: result.predictedPrice, source: 'marketcheck_comparable' };
    }
  } catch (err) {
    logger.debug({ err, make, model, year }, 'MarketCheck comparable price prediction failed');
  }

  // Strategy 3: No data available
  return { marketValue: 0, source: 'none' };
}

/**
 * Compute a market value from a set of benchmark prices.
 *
 * Outliers — prices more than 2× the median — are excluded before averaging.
 * Returns 0 for an empty array.
 * Returns the computed average rounded to the nearest integer.
 */
export function computeFallbackMarketValue(benchmarks: BenchmarkPrice[]): number {
  if (benchmarks.length === 0) return 0;

  const prices = benchmarks.map((b) => b.price).sort((a, b) => a - b);

  // Compute median
  const mid = Math.floor(prices.length / 2);
  const median =
    prices.length % 2 === 1
      ? prices[mid]
      : (prices[mid - 1] + prices[mid]) / 2;

  // Filter outliers: keep only prices <= 2× median
  const filtered = prices.filter((p) => p <= 2 * median);

  if (filtered.length === 0) return 0;

  const sum = filtered.reduce((acc, p) => acc + p, 0);
  return Math.round(sum / filtered.length);
}
