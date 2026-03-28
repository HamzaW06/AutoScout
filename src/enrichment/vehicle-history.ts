import { config } from '../config.js';
import { logger } from '../logger.js';

export interface VehicleHistoryReport {
  vin: string;
  fetchedAt: string;
  source: string;

  // Title History
  titleRecords: Array<{
    date: string;
    state: string;
    title_type: string; // clean, salvage, rebuilt, flood, lemon
    odometer: number;
    odometer_status: string; // actual, not_actual, exempt
  }>;

  // Accident/Damage
  accidentCount: number;
  damageRecords: Array<{
    date: string;
    description: string;
    severity: string;
    source: string;
  }>;

  // Ownership
  ownerCount: number;
  ownershipRecords: Array<{
    startDate: string;
    endDate: string;
    state: string;
    type: string; // personal, lease, fleet, rental, commercial
  }>;

  // Odometer
  odometerRecords: Array<{
    date: string;
    reading: number;
    status: string; // actual, not_actual, exempt, rollback_suspected
  }>;
  rollbackSuspected: boolean;

  // Flags
  salvageRecord: boolean;
  junkRecord: boolean;
  totalLoss: boolean;
  theftReported: boolean;
  floodDamage: boolean;
  lemonLaw: boolean;

  // Raw data for display
  rawReport: unknown;
}

// VinAudit API integration
// Docs: https://www.vinaudit.com/api-documentation-extended
export async function fetchVehicleHistory(vin: string): Promise<VehicleHistoryReport | null> {
  const apiKey = config.vinAuditApiKey;

  if (!apiKey) {
    logger.warn('VinAudit API key not configured — cannot fetch vehicle history');
    return null;
  }

  try {
    // VinAudit API endpoint
    const url = `https://api.vinaudit.com/query.php?key=${encodeURIComponent(apiKey)}&vin=${encodeURIComponent(vin)}&format=json&mode=extended`;

    const resp = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(30_000), // 30s timeout for full reports
    });

    if (!resp.ok) {
      logger.error({ status: resp.status, vin }, 'VinAudit API error');
      return null;
    }

    const data: any = await resp.json();

    if (data.error || data.status === 'error') {
      logger.error({ error: data.error || data.message, vin }, 'VinAudit returned error');
      return null;
    }

    return parseVinAuditResponse(vin, data);
  } catch (err) {
    logger.error({ err, vin }, 'Failed to fetch vehicle history');
    return null;
  }
}

function parseVinAuditResponse(vin: string, data: any): VehicleHistoryReport {
  // Parse title records
  const titleRecords: VehicleHistoryReport['titleRecords'] = [];
  const rawTitles = data.titles || data.title_records || [];
  for (const t of (Array.isArray(rawTitles) ? rawTitles : [])) {
    titleRecords.push({
      date: t.date || t.title_date || '',
      state: t.state || '',
      title_type: normalizeTitleType(t.title_type || t.brand || t.status || ''),
      odometer: parseInt(t.odometer || t.mileage || '0', 10) || 0,
      odometer_status: t.odometer_status || t.odometer_type || 'actual',
    });
  }

  // Parse damage/accident records
  const damageRecords: VehicleHistoryReport['damageRecords'] = [];
  const rawDamage = data.accidents || data.damage_records || data.accident_records || [];
  for (const d of (Array.isArray(rawDamage) ? rawDamage : [])) {
    damageRecords.push({
      date: d.date || d.accident_date || '',
      description: d.description || d.damage_description || d.details || '',
      severity: d.severity || d.damage_severity || 'unknown',
      source: d.source || d.reporting_source || '',
    });
  }

  // Parse ownership records
  const ownershipRecords: VehicleHistoryReport['ownershipRecords'] = [];
  const rawOwners = data.owners || data.ownership_records || [];
  for (const o of (Array.isArray(rawOwners) ? rawOwners : [])) {
    ownershipRecords.push({
      startDate: o.start_date || o.purchase_date || '',
      endDate: o.end_date || o.sale_date || '',
      state: o.state || '',
      type: o.type || o.owner_type || 'personal',
    });
  }

  // Parse odometer records
  const odometerRecords: VehicleHistoryReport['odometerRecords'] = [];
  const rawOdometer = data.odometer_records || data.mileage_records || titleRecords.filter(t => t.odometer > 0);
  if (Array.isArray(rawOdometer)) {
    for (const o of rawOdometer) {
      odometerRecords.push({
        date: o.date || o.reading_date || '',
        reading: parseInt(o.reading || o.odometer || o.mileage || '0', 10) || 0,
        status: o.status || o.odometer_status || 'actual',
      });
    }
  }

  // Check for rollback
  const sortedReadings = [...odometerRecords].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  let rollbackSuspected = false;
  for (let i = 1; i < sortedReadings.length; i++) {
    if (sortedReadings[i].reading < sortedReadings[i - 1].reading - 1000) {
      rollbackSuspected = true;
      break;
    }
  }

  // Extract flags
  const flags = data.flags || {};
  const hasSalvage = titleRecords.some(t => t.title_type === 'salvage') || flags.salvage === true;
  const hasFlood = titleRecords.some(t => t.title_type === 'flood') || flags.flood === true;
  const hasLemon = titleRecords.some(t => t.title_type === 'lemon') || flags.lemon === true;

  return {
    vin,
    fetchedAt: new Date().toISOString(),
    source: 'vinaudit',
    titleRecords,
    accidentCount: damageRecords.length || (data.accident_count ? parseInt(data.accident_count, 10) : 0),
    damageRecords,
    ownerCount: ownershipRecords.length || (data.owner_count ? parseInt(data.owner_count, 10) : 0),
    ownershipRecords,
    odometerRecords: sortedReadings,
    rollbackSuspected,
    salvageRecord: hasSalvage || !!data.salvage || !!flags.salvage,
    junkRecord: !!data.junk || !!flags.junk,
    totalLoss: !!data.total_loss || !!flags.total_loss,
    theftReported: !!data.theft || !!flags.theft,
    floodDamage: hasFlood,
    lemonLaw: hasLemon,
    rawReport: data,
  };
}

function normalizeTitleType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('salvage')) return 'salvage';
  if (lower.includes('rebuilt') || lower.includes('reconstructed')) return 'rebuilt';
  if (lower.includes('flood')) return 'flood';
  if (lower.includes('lemon')) return 'lemon';
  if (lower.includes('junk')) return 'junk';
  if (lower.includes('clean') || lower === '') return 'clean';
  return raw;
}
