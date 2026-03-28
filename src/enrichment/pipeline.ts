// ── Enrichment Pipeline ────────────────────────────────────────────
// Central pipeline that takes raw scraped listings, validates them,
// enriches with all available data sources, scores them, and prepares
// them for database insertion.
// -------------------------------------------------------------------

import { nanoid } from 'nanoid';
import { config } from '../config.js';
import { getDb } from '../db/database.js';
import {
  normalizeMake,
  normalizeModel,
  extractTrim,
  normalizeTransmission,
  normalizeBodyStyle,
  normalizeTitleStatus,
} from './normalizer.js';
import { validateListing } from './validator.js';
import { calculateRiskScore } from './risk-scorer.js';
import type { RiskInput } from './risk-scorer.js';
import { calculateDealRating } from './deal-rater.js';
import { calculateNegotiationPower } from './negotiation-scorer.js';
import type { NegotiationInput } from './negotiation-scorer.js';
import { detectScams } from './scam-detector.js';
import type { ScamInput } from './scam-detector.js';
import { findDuplicate, mergeListings } from './dedup.js';
import type { DeduplicationCandidate } from './dedup.js';
import { generateRepairForecast } from './repair-forecaster.js';
import {
  insertListing,
  updateListing,
  getActiveListings,
  insertPriceHistory,
  getModelIntelligence,
  getPartsPricing,
} from '../db/queries.js';
import type { ListingRow } from '../db/queries.js';
import { lookupMarketValue } from './market-value.js';
import { getRecalls } from './recalls.js';
import { getComplaints } from './complaints.js';
import { getSafetyRating } from './safety-ratings.js';
import { NHTSACache } from './cache.js';
import { fireAlerts } from './alert-check.js';
import { logger } from '../logger.js';
import { emitNewListing } from '../websocket.js';

// ── NHTSA cache (module-level singleton) ──────────────────────────

const nhtsaCache = new NHTSACache();

// ── Public types ──────────────────────────────────────────────────

export interface PipelineResult {
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

// ── Haversine distance ────────────────────────────────────────────

/**
 * Calculate the distance in miles between two lat/lng coordinates
 * using the Haversine formula.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8; // Earth radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ── VIN decode (optional, may not exist yet) ──────────────────────

interface VinDecodeResult {
  make?: string;
  model?: string;
  year?: number;
  trim?: string;
  body_style?: string;
  engine?: string;
  transmission?: string;
  drivetrain?: string;
  fuel_type?: string;
  [key: string]: unknown;
}

async function tryDecodeVin(vin: string): Promise<VinDecodeResult | null> {
  try {
    const mod = await import('./vin-decoder.js');
    if (typeof mod.decodeVin === 'function') {
      return (await mod.decodeVin(vin)) as unknown as VinDecodeResult;
    }
  } catch {
    // Module doesn't exist yet or failed — gracefully skip
  }
  return null;
}

// ── Helpers ───────────────────────────────────────────────────────

/** Convert a ListingRow to a DeduplicationCandidate for the dedup module. */
function toDeduplicationCandidate(row: ListingRow): DeduplicationCandidate {
  return {
    id: row.id,
    vin: row.vin,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim,
    mileage: row.mileage,
    asking_price: row.asking_price,
    exterior_color: row.exterior_color,
    seller_name: row.seller_name,
    source: row.source,
    sources_found_on: row.sources_found_on,
    is_multi_source: row.is_multi_source,
    // Carry through remaining fields
    body_style: row.body_style,
    engine: row.engine,
    transmission: row.transmission,
    drivetrain: row.drivetrain,
    interior_color: row.interior_color,
    seller_phone: row.seller_phone,
    description: row.description,
    photos: row.photos,
    listing_date: row.listing_date,
    last_seen: row.last_seen,
    is_active: row.is_active,
  };
}

/** Build a ScamInput from a listing record. */
function toScamInput(listing: Record<string, unknown>): ScamInput {
  return {
    id: listing.id as string,
    vin: listing.vin as string | null | undefined,
    vin_verified: listing.vin_verified as number | undefined,
    asking_price: listing.asking_price as number,
    deal_score: listing.deal_score as number | undefined,
    listing_date: listing.listing_date as string | null | undefined,
    photos: listing.photos as string | null | undefined,
    seller_type: listing.seller_type as string | undefined,
    seller_name: listing.seller_name as string | null | undefined,
    seller_phone: listing.seller_phone as string | null | undefined,
    seller_rating: listing.seller_rating as number | undefined,
  };
}

// ── Async pre-enrichment ──────────────────────────────────────────

/**
 * Perform all async enrichment for a single listing (VIN decode, market value,
 * NHTSA data). This runs BEFORE the synchronous DB transaction so that the
 * enriched data is available when scores are calculated inside the transaction.
 */
async function preEnrichListing(
  listing: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const enriched: Record<string, unknown> = { ...listing };

  // Passthrough scrape confidence / tier
  enriched.scrape_confidence = listing.scrape_confidence ?? 0.5;
  enriched.scrape_tier = listing.scrape_tier ?? 'unknown';

  const vin = typeof enriched.vin === 'string' ? enriched.vin : '';
  const make = typeof enriched.make === 'string' ? enriched.make : '';
  const model = typeof enriched.model === 'string' ? enriched.model : '';
  const year = typeof enriched.year === 'number' ? enriched.year : 0;
  const mileage = typeof enriched.mileage === 'number' ? enriched.mileage : 0;

  // ── VIN decode ──────────────────────────────────────────────────
  if (vin.length === 17) {
    try {
      const decoded = await tryDecodeVin(vin);
      if (decoded) {
        const backfillFields: (keyof VinDecodeResult)[] = [
          'engine',
          'transmission',
          'drivetrain',
          'body_style',
          'fuel_type',
        ];
        for (const field of backfillFields) {
          if (decoded[field] && !enriched[field]) {
            enriched[field] = decoded[field];
          }
        }
        enriched.vin_decoded = 1;
      }
    } catch (err) {
      logger.debug({ err, vin }, 'VIN decode in pipeline failed — skipping');
    }
  }

  // ── Market value lookup ─────────────────────────────────────────
  if (make && model && year > 0) {
    try {
      const mv = await lookupMarketValue(vin, make, model, year, mileage);
      if (mv.marketValue > 0) {
        enriched.market_value = mv.marketValue;
        enriched.market_value_source = mv.source;
      }
    } catch (err) {
      logger.debug({ err, make, model, year }, 'Market value lookup failed — skipping');
    }
  }

  // ── NHTSA auto-enrichment with caching ──────────────────────────
  if (make && model && year > 0) {
    // Recalls
    try {
      const recallKey = nhtsaCache.makeKey('recalls', make, model, year);
      let recallData = nhtsaCache.get(recallKey) as { count: number } | null;
      if (!recallData) {
        recallData = await getRecalls(make, model, year);
        nhtsaCache.set(recallKey, recallData);
      }
      enriched.recall_count = recallData.count;
    } catch (err) {
      logger.debug({ err, make, model, year }, 'Recalls lookup failed — skipping');
    }

    // Complaints
    try {
      const complaintKey = nhtsaCache.makeKey('complaints', make, model, year);
      let complaintData = nhtsaCache.get(complaintKey) as { count: number } | null;
      if (!complaintData) {
        complaintData = await getComplaints(make, model, year);
        nhtsaCache.set(complaintKey, complaintData);
      }
      enriched.complaint_count = complaintData.count;
    } catch (err) {
      logger.debug({ err, make, model, year }, 'Complaints lookup failed — skipping');
    }

    // Safety ratings
    try {
      const safetyKey = nhtsaCache.makeKey('safety', make, model, year);
      let safetyData = nhtsaCache.get(safetyKey) as {
        found: boolean;
        overallRating?: number;
      } | null;
      if (!safetyData) {
        safetyData = await getSafetyRating(make, model, year);
        nhtsaCache.set(safetyKey, safetyData);
      }
      if (safetyData.found && safetyData.overallRating != null) {
        enriched.safety_rating = safetyData.overallRating;
      }
    } catch (err) {
      logger.debug({ err, make, model, year }, 'Safety ratings lookup failed — skipping');
    }
  }

  return enriched;
}

// ── Main Pipeline ─────────────────────────────────────────────────

/**
 * Process a batch of raw scraped listings through the enrichment pipeline.
 *
 * Steps per listing:
 *   1. Normalize fields (make, model, trim, transmission, body style, title status)
 *   2. Validate required fields; skip invalid listings
 *   3. Async pre-enrichment: VIN decode, market value, NHTSA (runs before transaction)
 *   4. Dedup check; merge if duplicate found
 *   5. Compute scores (risk, deal rating, scam, negotiation)
 *   6. Calculate distance from user location
 *   7. Insert or update in the database
 *   8. Fire alerts for exceptional deals
 *
 * Async enrichment (steps 3) runs outside the DB transaction because sql.js
 * transactions are synchronous. DB operations are batched in a transaction
 * for performance.
 */
export async function processListings(
  rawListings: Record<string, unknown>[],
  source: string,
): Promise<PipelineResult> {
  const result: PipelineResult = {
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  if (rawListings.length === 0) return result;

  // Fetch all active listings once for dedup and scam checks
  const existingRows = getActiveListings({ limit: 100_000 });
  const existingCandidates = existingRows.map(toDeduplicationCandidate);

  // Collect ScamInput records from existing listings (for scam detection cross-ref)
  const allScamInputs: ScamInput[] = existingRows.map((r) => toScamInput(r as unknown as Record<string, unknown>));

  // ── Phase A: Normalize + Validate + Async Pre-Enrich ──────────
  // This must happen OUTSIDE the synchronous DB transaction.

  interface PreEnrichedEntry {
    enriched: Record<string, unknown>;
    valid: boolean;
    skipReason?: string;
  }

  const preEnrichedListings: PreEnrichedEntry[] = [];

  for (const raw of rawListings) {
    result.processed++;

    try {
      // ── 1. NORMALIZE ────────────────────────────────────────────
      const listing: Record<string, unknown> = { ...raw };
      listing.source = source;

      if (typeof listing.make === 'string') {
        listing.make = normalizeMake(listing.make);
      }

      if (typeof listing.model === 'string') {
        const normalized = normalizeModel(listing.model);

        // If no trim provided, try to extract from the model string
        if (!listing.trim) {
          const extracted = extractTrim(normalized);
          listing.model = extracted.model;
          if (extracted.trim) {
            listing.trim = extracted.trim;
          }
        } else {
          listing.model = normalized;
        }
      }

      if (typeof listing.transmission === 'string') {
        listing.transmission = normalizeTransmission(listing.transmission);
      }

      if (typeof listing.body_style === 'string') {
        listing.body_style = normalizeBodyStyle(listing.body_style);
      }

      if (typeof listing.title_status === 'string') {
        listing.title_status = normalizeTitleStatus(listing.title_status);
      }

      // ── 2. VALIDATE ───────────────────────────────────────────
      const validation = validateListing(listing);

      if (!validation.valid) {
        result.skipped++;
        result.errors.push(
          `Skipped listing: ${validation.errors.join('; ')}`,
        );
        preEnrichedListings.push({ enriched: {}, valid: false, skipReason: validation.errors.join('; ') });
        continue;
      }

      // Apply auto-fixes from validation
      const fixed: Record<string, unknown> = { ...validation.fixedListing };

      // ── 3. ASYNC PRE-ENRICHMENT (VIN decode, market value, NHTSA) ─
      const enriched = await preEnrichListing(fixed);

      preEnrichedListings.push({ enriched, valid: true });
    } catch (err) {
      result.errors.push(
        `Error pre-enriching listing: ${err instanceof Error ? err.message : String(err)}`,
      );
      preEnrichedListings.push({ enriched: {}, valid: false, skipReason: 'pre-enrich error' });
    }
  }

  // ── Phase B: Synchronous DB transaction ───────────────────────
  // All async work is done; now run scoring + DB writes in a transaction.

  const postInsertAlerts: Record<string, unknown>[] = [];

  const db = getDb();

  db.transaction(() => {
    for (const entry of preEnrichedListings) {
      if (!entry.valid) continue;

      const fixed = entry.enriched;

      try {
        // ── 3. DEDUP CHECK ────────────────────────────────────────
        const candidateForDedup: DeduplicationCandidate = {
          id: (fixed.id as string) || '',
          vin: fixed.vin as string | null | undefined,
          year: fixed.year as number,
          make: fixed.make as string,
          model: fixed.model as string,
          trim: fixed.trim as string | undefined,
          mileage: fixed.mileage as number,
          asking_price: fixed.asking_price as number,
          exterior_color: fixed.exterior_color as string | null | undefined,
          seller_name: fixed.seller_name as string | null | undefined,
          source,
          sources_found_on: fixed.sources_found_on as string | null | undefined,
          is_multi_source: fixed.is_multi_source as number | undefined,
        };

        // Copy through any extra fields
        for (const [k, v] of Object.entries(fixed)) {
          if (!(k in candidateForDedup)) {
            candidateForDedup[k] = v;
          }
        }

        const dedupResult = findDuplicate(candidateForDedup, existingCandidates);

        let listingId: string;
        let isDuplicate = false;
        const now = new Date().toISOString();

        if (dedupResult.isDuplicate && dedupResult.matchedId) {
          isDuplicate = true;
          listingId = dedupResult.matchedId;

          // Find the existing candidate to merge with
          const existingCandidate = existingCandidates.find(
            (c) => c.id === dedupResult.matchedId,
          );

          if (existingCandidate) {
            const merged = mergeListings(existingCandidate, candidateForDedup);

            // Track price changes
            const oldPrice = existingCandidate.asking_price;
            const newPrice = fixed.asking_price as number;
            if (oldPrice !== newPrice) {
              insertPriceHistory(listingId, newPrice, source);
              merged.price_dropped = 1;
              merged.price_drop_count =
                ((existingCandidate.price_drop_count as number) ?? 0) + 1;
            }

            // Copy merged data into the fixed record for score computation
            for (const [k, v] of Object.entries(merged)) {
              fixed[k] = v;
            }
            fixed.id = listingId;
          }
        } else {
          // New listing
          listingId = nanoid();
          fixed.id = listingId;
          fixed.first_seen = now;
          fixed.last_seen = now;
          fixed.is_active = 1;
          fixed.sources_found_on = JSON.stringify([source]);
        }

        // ── 4. COMPUTE SCORES ────────────────────────────────────

        // 4a. Model intelligence lookup (for risk scoring and repair forecast)
        const make = fixed.make as string;
        const model = fixed.model as string;
        const year = fixed.year as number;
        const mileage = fixed.mileage as number;
        const askingPrice = fixed.asking_price as number;

        const modelIntel = getModelIntelligence(make, model, year);

        // 4b. Risk score
        const riskInput: RiskInput = {
          title_status: fixed.title_status as string | undefined,
          owner_count: fixed.owner_count as number | undefined,
          accident_count: fixed.accident_count as number | undefined,
          was_rental: fixed.was_rental as number | undefined,
          was_fleet: fixed.was_fleet as number | undefined,
          structural_damage: fixed.structural_damage as number | undefined,
          airbag_deployed: fixed.airbag_deployed as number | undefined,
          mileage,
          year,
          reliability_score: modelIntel?.reliability_score ?? undefined,
          timing_type: modelIntel?.timing_type ?? undefined,
          timing_interval_miles: modelIntel?.timing_interval_miles ?? undefined,
          known_issues: modelIntel?.known_issues ?? undefined,
          transmission: fixed.transmission as string | undefined,
        };

        const risk = calculateRiskScore(riskInput);
        fixed.risk_score = risk.score;
        fixed.risk_factors = JSON.stringify(risk.factors);

        // 4c. Deal rating (uses market_value set during pre-enrichment, or existing)
        const marketValue = fixed.market_value as number | null | undefined;
        if (marketValue && marketValue > 0) {
          const deal = calculateDealRating(askingPrice, marketValue, mileage);
          fixed.deal_score = deal.dealScore;
          fixed.value_rating = deal.rating;
          fixed.price_per_mile = deal.pricePerMile;
          fixed.offer_low = deal.offerLow;
          fixed.offer_high = deal.offerHigh;
        }

        // 4d. Scam detection
        const scamInput = toScamInput(fixed);
        // Include this listing in the cross-reference pool
        const scamPool: ScamInput[] = [...allScamInputs, scamInput];
        const scam = detectScams(scamInput, scamPool);
        fixed.scam_score = scam.score;
        fixed.scam_flags = JSON.stringify(scam.flags);

        // 4e. Negotiation power
        const negotiationInput: NegotiationInput = {
          days_on_market: fixed.days_on_market as number | undefined,
          price_dropped: fixed.price_dropped as number | undefined,
          price_drop_count: fixed.price_drop_count as number | undefined,
          deal_score: fixed.deal_score as number | undefined,
          risk_factors: risk.factors,
          seller_type: fixed.seller_type as string | undefined,
          comparable_count: existingCandidates.filter(
            (c) =>
              c.make.toLowerCase() === make.toLowerCase() &&
              c.model.toLowerCase() === model.toLowerCase() &&
              Math.abs(c.year - year) <= 2,
          ).length,
        };

        const negotiation = calculateNegotiationPower(negotiationInput);
        fixed.negotiation_power = negotiation.score;
        fixed.negotiation_tactics = JSON.stringify(negotiation.tactics);

        // 4f. Repair forecast
        const partsDb = getPartsPricing(make, model, year);
        const modelIntelInput = modelIntel
          ? {
              timing_type: modelIntel.timing_type ?? undefined,
              timing_interval_miles: modelIntel.timing_interval_miles ?? undefined,
              known_issues: modelIntel.known_issues ?? undefined,
              repair_schedule: modelIntel.repair_schedule ?? undefined,
              failure_points: modelIntel.failure_points ?? undefined,
              oil_change_interval_miles: modelIntel.oil_change_interval_miles ?? undefined,
              notes: modelIntel.notes ?? undefined,
            }
          : null;
        const partsDbInput = partsDb
          ? {
              oil_filter: partsDb.oil_filter ?? undefined,
              brake_pads_front: partsDb.brake_pads_front ?? undefined,
              brake_pads_rear: partsDb.brake_pads_rear ?? undefined,
              spark_plugs_set: partsDb.spark_plugs_set ?? undefined,
              timing_belt_kit: partsDb.timing_belt_kit ?? undefined,
              alternator: partsDb.alternator ?? undefined,
              starter_motor: partsDb.starter_motor ?? undefined,
              ac_compressor: partsDb.ac_compressor ?? undefined,
              struts_front_pair: partsDb.struts_front_pair ?? undefined,
              parts_affordability_score: partsDb.parts_affordability_score ?? undefined,
            }
          : null;
        const forecast = generateRepairForecast(
          mileage,
          year,
          make,
          modelIntelInput,
          partsDbInput,
          config.mechanicLaborMultiplier,
        );
        fixed.repair_forecast = JSON.stringify(forecast);

        // ── 5. DISTANCE CALCULATION ──────────────────────────────
        const sellerLat = fixed.seller_lat as number | null | undefined;
        const sellerLng = fixed.seller_lng as number | null | undefined;
        if (
          sellerLat != null &&
          sellerLng != null &&
          !isNaN(sellerLat) &&
          !isNaN(sellerLng)
        ) {
          fixed.distance_miles = Math.round(
            calculateDistance(config.userLat, config.userLng, sellerLat, sellerLng) * 10,
          ) / 10;
        }

        // ── 6. INSERT / UPDATE DATABASE ──────────────────────────
        if (isDuplicate) {
          // Remove the id before passing to updateListing (it's the key, not a field to SET)
          const { id: _id, ...fieldsToUpdate } = fixed;
          updateListing(listingId, fieldsToUpdate);
          result.updated++;
        } else {
          insertListing(fixed);
          // Record initial price in history
          insertPriceHistory(listingId, askingPrice, source);
          result.inserted++;
          // Emit new_listing WebSocket event
          emitNewListing({
            id: fixed.id as string || '',
            year: fixed.year as number || 0,
            make: fixed.make as string || '',
            model: fixed.model as string || '',
            price: askingPrice || 0,
            value_rating: fixed.value_rating as string || '',
            deal_score: fixed.deal_score as number || 0,
          });
        }

        // Queue alert check (executed after transaction commits)
        postInsertAlerts.push({ ...fixed });

        // Add the processed listing to the scam pool for subsequent cross-references
        allScamInputs.push(toScamInput(fixed));

      } catch (err) {
        result.errors.push(
          `Error processing listing: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  });

  // ── Phase C: Fire alerts (after transaction is committed) ─────
  for (const enriched of postInsertAlerts) {
    const valueRating = enriched.value_rating as string | undefined;
    if (valueRating === 'STEAL' || valueRating === 'GREAT') {
      try {
        await fireAlerts({
          value_rating: valueRating,
          deal_score: (enriched.deal_score as number) || 0,
          price: (enriched.asking_price as number) || (enriched.price as number) || 0,
          year: (enriched.year as number) || 0,
          make: (enriched.make as string) || '',
          model: (enriched.model as string) || '',
          listing_url: enriched.listing_url as string | undefined,
          id: enriched.id as string | undefined,
        });
      } catch (err) {
        logger.error({ err, id: enriched.id }, 'fireAlerts failed — non-blocking');
      }
    }
  }

  return result;
}

/**
 * Enrich a single listing with VIN-decoded data.
 * Intended for on-demand use (not bulk processing).
 */
export async function enrichWithVin(
  listingId: string,
  vin: string,
): Promise<VinDecodeResult | null> {
  const decoded = await tryDecodeVin(vin);
  if (!decoded) return null;

  const updates: Record<string, unknown> = { vin_verified: 1 };

  // Backfill missing fields from VIN decode
  const backfillFields: (keyof VinDecodeResult)[] = [
    'trim',
    'body_style',
    'engine',
    'transmission',
    'drivetrain',
    'fuel_type',
  ];

  for (const field of backfillFields) {
    if (decoded[field]) {
      updates[field] = decoded[field];
    }
  }

  updateListing(listingId, updates);
  return decoded;
}
