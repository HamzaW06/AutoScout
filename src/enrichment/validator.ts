import { normalizeMake } from './normalizer.js';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: Record<string, unknown>;
  fixedListing: Record<string, unknown>;
}

/**
 * Validate a listing before inserting into the database.
 * Returns errors (blocking), warnings (non-blocking), and auto-fixes.
 */
export function validateListing(
  listing: Record<string, unknown>,
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: Record<string, unknown> = {};

  const year = listing.year as number | undefined;
  const make = listing.make as string | undefined;
  const model = listing.model as string | undefined;
  const mileage = listing.mileage as number | undefined;
  const askingPrice = listing.asking_price as number | undefined;
  const vin = listing.vin as string | undefined;

  // -- REQUIRED FIELDS --
  const currentYear = new Date().getFullYear();
  if (!year || year < 1980 || year > currentYear + 1) {
    errors.push(`Invalid year: ${year}`);
  }
  if (!make || make.length < 2) {
    errors.push(`Invalid make: ${make}`);
  }
  if (!model || model.length < 1) {
    errors.push(`Invalid model: ${model}`);
  }
  if (mileage == null || mileage < 0 || mileage > 1_000_000) {
    errors.push(`Invalid mileage: ${mileage}`);
  }
  if (
    askingPrice == null ||
    askingPrice < 0 ||
    askingPrice > 1_000_000
  ) {
    errors.push(`Invalid price: ${askingPrice}`);
  }

  // -- AUTO-FIXES --

  // Normalize make name
  if (make) {
    const normalized = normalizeMake(make);
    if (normalized !== make) {
      fixes.make = normalized;
    }
  }

  // Price sanity warnings
  if (askingPrice && askingPrice > 100000 && year && year < 2020) {
    warnings.push(
      `Price $${askingPrice} seems too high for a ${year} vehicle`,
    );
  }

  // VIN format validation
  if (vin) {
    let cleanVin = vin.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '');
    if (cleanVin.length !== 17) {
      warnings.push(
        `VIN "${cleanVin}" is not 17 characters — clearing`,
      );
      fixes.vin = null;
    } else if (/[IOQ]/.test(cleanVin)) {
      warnings.push(
        'VIN contains invalid characters (I, O, or Q) — likely OCR error',
      );
    } else {
      fixes.vin = cleanVin;
    }
  }

  // Trim whitespace from all string fields
  for (const [key, value] of Object.entries(listing)) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== value) {
        fixes[key] = trimmed;
      }
    }
  }

  // Mileage sanity warnings
  if (mileage && year) {
    const vehicleAge = Math.max(currentYear - year, 1);
    const milesPerYear = mileage / vehicleAge;
    if (milesPerYear > 30000) {
      warnings.push(
        `${milesPerYear.toLocaleString()} mi/yr is extremely high`,
      );
    }
    if (milesPerYear < 1000 && vehicleAge > 3) {
      warnings.push(
        `${milesPerYear.toLocaleString()} mi/yr is suspiciously low — possible rollback`,
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fixes,
    fixedListing: { ...listing, ...fixes },
  };
}
