// ── Safety Ratings ─────────────────────────────────────────────────
// Fetches NCAP safety ratings for a make/model/year via the NHTSA
// Safety Ratings API (two-step: resolve vehicle ID, then fetch
// ratings).  Free API, no key required.
// -------------------------------------------------------------------

import { logger } from '../logger.js';

export interface SafetyRating {
  found: boolean;
  vehicleDescription?: string;
  overallRating?: number;
  frontalCrashRating?: number;
  sideCrashRating?: number;
  rolloverRating?: number;
  complaintsCount?: number;
  recallsCount?: number;
}

const SAFETY_BASE = 'https://api.nhtsa.dot.gov/SafetyRatings';

/** Parse a rating string into a number, returning undefined for "Not Rated" etc. */
function parseRating(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

/**
 * Fetch NCAP safety ratings for a given make / model / year.
 *
 * This is a two-step process:
 *   1. Resolve vehicle ID(s) from make/model/year.
 *   2. Fetch ratings for the first matching vehicle ID.
 *
 * Returns `{ found: false }` when the vehicle has no NCAP ratings or
 * on any network error.
 */
export async function getSafetyRating(
  make: string,
  model: string,
  year: number,
): Promise<SafetyRating> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    // ── Step 1: resolve vehicle IDs ──────────────────────────────
    const lookupUrl =
      `${SAFETY_BASE}/modelyear/${year}` +
      `/make/${encodeURIComponent(make)}` +
      `/model/${encodeURIComponent(model)}?format=json`;

    const lookupResp = await fetch(lookupUrl, { signal: controller.signal });

    if (!lookupResp.ok) {
      logger.warn(
        { make, model, year, status: lookupResp.status },
        'NHTSA Safety Ratings lookup returned non-OK status',
      );
      return { found: false };
    }

    const lookupData = (await lookupResp.json()) as {
      Count: number;
      Results: { VehicleId: number; VehicleDescription?: string }[];
    };

    if (!lookupData.Results?.length) {
      return { found: false };
    }

    const vehicleId = lookupData.Results[0].VehicleId;
    const vehicleDescription =
      lookupData.Results[0].VehicleDescription ?? undefined;

    // ── Step 2: fetch ratings by vehicle ID ──────────────────────
    const ratingUrl = `${SAFETY_BASE}/VehicleId/${vehicleId}?format=json`;
    const ratingResp = await fetch(ratingUrl, { signal: controller.signal });

    if (!ratingResp.ok) {
      logger.warn(
        { vehicleId, status: ratingResp.status },
        'NHTSA Safety Ratings detail returned non-OK status',
      );
      return { found: false };
    }

    const ratingData = (await ratingResp.json()) as {
      Count: number;
      Results: {
        OverallRating?: string;
        FrontCrashDriversideRating?: string;
        SideCrashDriversideRating?: string;
        RolloverRating?: string;
        ComplaintsCount?: number;
        RecallsCount?: number;
        VehicleDescription?: string;
      }[];
    };

    const r = ratingData.Results?.[0];
    if (!r) {
      return { found: false };
    }

    return {
      found: true,
      vehicleDescription: r.VehicleDescription ?? vehicleDescription,
      overallRating: parseRating(r.OverallRating),
      frontalCrashRating: parseRating(r.FrontCrashDriversideRating),
      sideCrashRating: parseRating(r.SideCrashDriversideRating),
      rolloverRating: parseRating(r.RolloverRating),
      complaintsCount: r.ComplaintsCount,
      recallsCount: r.RecallsCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ make, model, year, err: msg }, 'Safety ratings lookup failed');
    return { found: false };
  } finally {
    clearTimeout(timeout);
  }
}
