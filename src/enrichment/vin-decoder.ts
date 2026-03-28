// ── VIN Decoder ────────────────────────────────────────────────────
// Decodes a VIN via the NHTSA vPIC API to extract vehicle details.
// Free API, no key required.
// -------------------------------------------------------------------

import { logger } from '../logger.js';

export interface VinDecodeResult {
  success: boolean;
  vin: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  body_style?: string;
  engine?: string;
  engine_cylinders?: number;
  displacement_l?: number;
  fuel_type?: string;
  transmission?: string;
  drivetrain?: string;
  plant_city?: string;
  plant_country?: string;
  vehicle_type?: string;
  error_code?: string;
  error_text?: string;
}

const VPIC_BASE = 'https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues';

/**
 * Decode a 17-character VIN using NHTSA's vPIC API.
 *
 * Returns `success: true` when the API responds with ErrorCode "0" or empty.
 * Network / timeout errors return `success: false` with the VIN echoed back.
 */
export async function decodeVin(vin: string): Promise<VinDecodeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const url = `${VPIC_BASE}/${encodeURIComponent(vin)}?format=json`;
    const resp = await fetch(url, { signal: controller.signal });

    if (!resp.ok) {
      logger.warn({ vin, status: resp.status }, 'NHTSA vPIC returned non-OK status');
      return { success: false, vin, error_text: `HTTP ${resp.status}` };
    }

    const data = (await resp.json()) as {
      Results: Record<string, string>[];
    };

    const r = data.Results?.[0];
    if (!r) {
      return { success: false, vin, error_text: 'Empty Results array' };
    }

    const errorCode = r.ErrorCode ?? '';
    // ErrorCode "0" or blank means clean decode
    const success = errorCode === '0' || errorCode === '';

    return {
      success,
      vin,
      year: r.ModelYear ? parseInt(r.ModelYear, 10) || undefined : undefined,
      make: r.Make || undefined,
      model: r.Model || undefined,
      trim: r.Trim || undefined,
      body_style: r.BodyClass || undefined,
      engine: r.EngineModel || undefined,
      engine_cylinders: r.EngineCylinders
        ? parseInt(r.EngineCylinders, 10) || undefined
        : undefined,
      displacement_l: r.DisplacementL
        ? parseFloat(r.DisplacementL) || undefined
        : undefined,
      fuel_type: r.FuelTypePrimary || undefined,
      transmission: r.TransmissionStyle || undefined,
      drivetrain: r.DriveType || undefined,
      plant_city: r.PlantCity || undefined,
      plant_country: r.PlantCountry || undefined,
      vehicle_type: r.VehicleType || undefined,
      error_code: errorCode || undefined,
      error_text: r.ErrorText || undefined,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ vin, err: msg }, 'VIN decode failed');
    return { success: false, vin, error_text: msg };
  } finally {
    clearTimeout(timeout);
  }
}
