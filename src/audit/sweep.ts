import { getDb } from '../db/database.js';
import { logger } from '../logger.js';
import {
  getActiveListings,
  deactivateListing,
  insertAuditLog,
  updateListing,
  getModelIntelligence,
} from '../db/queries.js';
import type { ListingRow } from '../db/queries.js';
import { calculateDataCompleteness } from './data-quality.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STALE_DAYS = 14;
const CURRENT_YEAR = new Date().getFullYear();

function daysSince(isoDate: string): number {
  const then = new Date(isoDate).getTime();
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}

// ---------------------------------------------------------------------------
// Nightly Audit Sweep
// ---------------------------------------------------------------------------

export async function nightlyAuditSweep(): Promise<void> {
  logger.info('Starting nightly audit sweep...');

  // Fetch ALL active listings (use a high limit)
  const listings = getActiveListings({ limit: 100_000 });

  let checked = 0;
  let issuesFound = 0;
  let deactivated = 0;

  for (const listing of listings) {
    checked++;
    const issues = auditListing(listing);
    issuesFound += issues;
  }

  // ----- Stale listing deactivation ------------------------------------------
  for (const listing of listings) {
    if (daysSince(listing.last_seen) >= STALE_DAYS) {
      deactivateListing(listing.id);
      insertAuditLog(listing.id, {
        audit_type: 'stale',
        severity: 'info',
        details: `Listing not seen for ${Math.round(daysSince(listing.last_seen))} days - deactivated`,
      });
      deactivated++;
    }
  }

  // ----- Duplicate VIN check -------------------------------------------------
  const dupIssues = flagDuplicateVins();
  issuesFound += dupIssues;

  logger.info(
    { checked, issuesFound, deactivated },
    'Nightly audit sweep complete',
  );
}

// ---------------------------------------------------------------------------
// Per-listing audit
// ---------------------------------------------------------------------------

function auditListing(listing: ListingRow): number {
  let issues = 0;
  const now = new Date().toISOString();

  // (a) Data completeness -----------------------------------------------
  const completeness = calculateDataCompleteness(
    listing as unknown as Record<string, unknown>,
  );
  updateListing(listing.id, {
    data_completeness: Math.round(completeness * 100) / 100,
    last_audit: now,
  });

  if (completeness < 0.5) {
    insertAuditLog(listing.id, {
      audit_type: 'data_quality',
      severity: 'warning',
      details: `Low data completeness: ${(completeness * 100).toFixed(0)}%`,
    });
    issues++;
  }

  // (b) Price anomalies --------------------------------------------------
  if (listing.asking_price < 500) {
    insertAuditLog(listing.id, {
      audit_type: 'price_anomaly',
      severity: 'warning',
      details: `Suspiciously low price: $${listing.asking_price}`,
    });
    issues++;
  }

  const vehicleAge = CURRENT_YEAR - listing.year;
  if (listing.asking_price > 50000 && vehicleAge > 10) {
    insertAuditLog(listing.id, {
      audit_type: 'price_anomaly',
      severity: 'warning',
      details: `High price ($${listing.asking_price}) for ${vehicleAge}-year-old vehicle`,
    });
    issues++;
  }

  // (c) Mileage anomalies ------------------------------------------------
  if (vehicleAge >= 3 && listing.mileage > 0) {
    const milesPerYear = listing.mileage / vehicleAge;

    if (milesPerYear > 30000) {
      insertAuditLog(listing.id, {
        audit_type: 'mileage_anomaly',
        severity: 'warning',
        details: `Very high annual mileage: ${Math.round(milesPerYear).toLocaleString()} mi/yr`,
      });
      issues++;
    }

    if (milesPerYear < 1000) {
      insertAuditLog(listing.id, {
        audit_type: 'mileage_anomaly',
        severity: 'info',
        details: `Unusually low annual mileage: ${Math.round(milesPerYear).toLocaleString()} mi/yr - possible rollback`,
      });
      issues++;
    }
  }

  // (d) VIN verification status ------------------------------------------
  if (!listing.vin_verified && listing.vin) {
    insertAuditLog(listing.id, {
      audit_type: 'vin_check',
      severity: 'info',
      details: 'VIN present but not yet verified',
    });
    issues++;
  }

  // (e) Model intelligence warnings --------------------------------------
  const intel = getModelIntelligence(listing.make, listing.model, listing.year);
  if (intel?.avoid_if) {
    const avoidReasons = intel.avoid_if;
    insertAuditLog(listing.id, {
      audit_type: 'model_warning',
      severity: 'warning',
      details: `Model intelligence warning: ${avoidReasons}`,
    });
    issues++;
  }

  // Accumulate audit flags on the listing itself
  if (issues > 0) {
    const existingFlags: string[] = listing.audit_flags
      ? JSON.parse(listing.audit_flags as string) as string[]
      : [];
    // We don't duplicate flags here; just note the audit ran
    updateListing(listing.id, {
      audit_flags: JSON.stringify(existingFlags),
      last_audit: now,
    });
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Duplicate VIN detection
// ---------------------------------------------------------------------------

function flagDuplicateVins(): number {
  const db = getDb();

  const dupes = db.all<{ vin: string; cnt: number }>(
    `SELECT vin, COUNT(*) AS cnt FROM listings
     WHERE is_active = 1 AND vin IS NOT NULL AND vin != ''
     GROUP BY vin HAVING cnt > 1`,
  );

  let issues = 0;

  for (const row of dupes) {
    const dupListings = db.all<{ id: string }>(
      `SELECT id FROM listings WHERE vin = ? AND is_active = 1`,
      [row.vin],
    );

    for (const dup of dupListings) {
      insertAuditLog(dup.id, {
        audit_type: 'duplicate_vin',
        severity: 'warning',
        details: `VIN ${row.vin} appears on ${row.cnt} active listings`,
      });
      issues++;
    }
  }

  if (dupes.length > 0) {
    logger.warn({ duplicateVins: dupes.length }, 'Duplicate VINs found');
  }

  return issues;
}
