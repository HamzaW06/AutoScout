// Repair forecast engine for AutoScout listings

export interface ModelIntelInput {
  timing_type?: string;
  timing_interval_miles?: number;
  known_issues?: string;
  repair_schedule?: string;
  failure_points?: string;
  oil_change_interval_miles?: number;
  notes?: string;
}

export interface PartsPricingInput {
  oil_filter?: number;
  brake_pads_front?: number;
  brake_pads_rear?: number;
  spark_plugs_set?: number;
  timing_belt_kit?: number | null;
  alternator?: number;
  starter_motor?: number;
  ac_compressor?: number;
  struts_front_pair?: number;
  parts_affordability_score?: number;
  [key: string]: number | string | null | undefined;
}

export interface RepairItem {
  item: string;
  urgency?: string;
  reason?: string;
  due_at_miles?: number;
  miles_until_due?: number;
  typical_failure_miles?: number;
  probability?: string;
  cost_parts: number;
  cost_labor: number;
  risk_if_ignored?: string;
}

export interface RepairForecast {
  immediate_repairs: RepairItem[];
  next_12_months: RepairItem[];
  next_12_to_36_months: RepairItem[];
  lifetime_risks: RepairItem[];
  cost_summary: {
    immediate_total: number;
    year_1_maintenance: number;
    year_1_likely_repairs: number;
    year_2_maintenance: number;
    year_2_likely_repairs: number;
    year_3_maintenance: number;
    year_3_likely_repairs: number;
    total_3yr_cost: number;
    monthly_average: number;
  };
  parts_affordability: {
    score: number;
    comparison: string;
    sample_costs: { part: string; aftermarket_price: number; dealer_price: number }[];
  };
  timing_system: {
    type: string;
    is_overdue: boolean;
    next_service_miles: number | null;
    cost_if_needed: number;
    is_interference_engine: boolean;
  };
}

// ---------------------------------------------------------------------------
// JSON parsing helpers
// ---------------------------------------------------------------------------

interface ScheduleEntry {
  item: string;
  interval_miles: number;
  cost_parts?: number;
  cost_labor?: number;
  risk_if_ignored?: string;
}

interface FailureEntry {
  item: string;
  typical_failure_miles: number;
  cost_parts?: number;
  cost_labor?: number;
  probability?: string;
  risk_if_ignored?: string;
}

interface KnownIssueEntry {
  item: string;
  description?: string;
  cost_parts?: number;
  cost_labor?: number;
  risk_if_ignored?: string;
}

function safeJsonArray<T>(json: string | undefined | null): T[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Core forecast generator
// ---------------------------------------------------------------------------

const DEFAULT_OIL_CHANGE_INTERVAL = 5000;
const DEFAULT_OIL_CHANGE_COST_PARTS = 35;
const DEFAULT_OIL_CHANGE_COST_LABOR = 30;
const DEALER_MARKUP = 2.5;
const CURRENT_YEAR = new Date().getFullYear();

export function generateRepairForecast(
  mileage: number,
  year: number,
  make: string,
  modelIntel: ModelIntelInput | null,
  partsDB: PartsPricingInput | null,
  laborMultiplier: number
): RepairForecast {
  const vehicleAge = Math.max(1, CURRENT_YEAR - year);
  const milesPerYear = Math.max(5000, Math.round(mileage / vehicleAge));

  const immediate: RepairItem[] = [];
  const year1: RepairItem[] = [];
  const year2to3: RepairItem[] = [];
  const lifetime: RepairItem[] = [];

  // Apply labor multiplier to a base labor cost
  const labor = (base: number) => Math.round(base * laborMultiplier);

  // -----------------------------------------------------------------------
  // 1. Timing system analysis
  // -----------------------------------------------------------------------
  const timingType = modelIntel?.timing_type ?? 'unknown';
  const timingInterval = modelIntel?.timing_interval_miles ?? 0;
  const isBelt = timingType.toLowerCase().includes('belt');
  const isInterference =
    modelIntel?.notes?.toLowerCase().includes('interference') ?? false;

  let timingOverdue = false;
  let timingNextService: number | null = null;
  const timingBeltKitCost = partsDB?.timing_belt_kit ?? (isBelt ? 250 : 0);
  const timingLaborCost = isBelt ? labor(500) : 0;
  const timingTotalCost = timingBeltKitCost + timingLaborCost;

  if (isBelt && timingInterval > 0) {
    // Calculate how many intervals have elapsed
    const intervalsDone = Math.floor(mileage / timingInterval);
    const nextDue = (intervalsDone + 1) * timingInterval;

    if (mileage >= timingInterval) {
      // Check if we're past due (simple heuristic: past any interval boundary)
      const milesOverdue = mileage - intervalsDone * timingInterval;
      if (milesOverdue > timingInterval * 0.1) {
        // More than 10% past an interval
        timingOverdue = true;
        immediate.push({
          item: 'Timing belt replacement',
          urgency: 'CRITICAL',
          reason: `Belt type with ${timingInterval.toLocaleString()}-mile interval, currently at ${mileage.toLocaleString()} miles`,
          due_at_miles: intervalsDone * timingInterval,
          miles_until_due: 0,
          cost_parts: timingBeltKitCost,
          cost_labor: timingLaborCost,
          risk_if_ignored: isInterference
            ? 'Catastrophic engine damage (interference engine)'
            : 'Engine will stop running',
        });
      } else {
        timingNextService = nextDue;
      }
    } else {
      timingNextService = timingInterval;
    }
  } else if (isBelt && timingInterval === 0) {
    timingNextService = null; // Unknown interval
  }

  // -----------------------------------------------------------------------
  // 2. Known issues (immediate attention items)
  // -----------------------------------------------------------------------
  const knownIssues = safeJsonArray<KnownIssueEntry>(modelIntel?.known_issues);
  for (const issue of knownIssues) {
    immediate.push({
      item: issue.item,
      urgency: 'CHECK',
      reason: issue.description ?? `Known issue for ${make}`,
      cost_parts: issue.cost_parts ?? 0,
      cost_labor: labor(issue.cost_labor ?? 100),
      risk_if_ignored: issue.risk_if_ignored,
    });
  }

  // -----------------------------------------------------------------------
  // 3. Scheduled maintenance - bucket into year1 / year2-3
  // -----------------------------------------------------------------------
  const schedule = safeJsonArray<ScheduleEntry>(modelIntel?.repair_schedule);
  for (const entry of schedule) {
    if (!entry.interval_miles || entry.interval_miles <= 0) continue;

    // How many intervals completed so far
    const intervalsDone = Math.floor(mileage / entry.interval_miles);
    const nextDue = (intervalsDone + 1) * entry.interval_miles;
    const milesUntilDue = nextDue - mileage;

    const item: RepairItem = {
      item: entry.item,
      due_at_miles: nextDue,
      miles_until_due: milesUntilDue,
      cost_parts: entry.cost_parts ?? 0,
      cost_labor: labor(entry.cost_labor ?? 80),
      risk_if_ignored: entry.risk_if_ignored,
    };

    if (milesUntilDue <= milesPerYear) {
      year1.push(item);
    } else if (milesUntilDue <= milesPerYear * 3) {
      year2to3.push(item);
    }
    // Beyond 3 years - skip
  }

  // -----------------------------------------------------------------------
  // 4. Failure points - items approaching typical failure mileage
  // -----------------------------------------------------------------------
  const failurePoints = safeJsonArray<FailureEntry>(modelIntel?.failure_points);
  for (const fp of failurePoints) {
    if (!fp.typical_failure_miles || fp.typical_failure_miles <= 0) continue;

    const threshold = fp.typical_failure_miles * 0.7;
    if (mileage < threshold) continue;

    const milesUntilFailure = Math.max(0, fp.typical_failure_miles - mileage);

    const item: RepairItem = {
      item: fp.item,
      typical_failure_miles: fp.typical_failure_miles,
      miles_until_due: milesUntilFailure,
      probability: fp.probability ?? (mileage >= fp.typical_failure_miles ? 'HIGH' : 'MODERATE'),
      cost_parts: fp.cost_parts ?? 0,
      cost_labor: labor(fp.cost_labor ?? 150),
      risk_if_ignored: fp.risk_if_ignored,
    };

    if (milesUntilFailure === 0) {
      // Already past typical failure mileage
      immediate.push({ ...item, urgency: 'INSPECT' });
    } else if (milesUntilFailure <= milesPerYear) {
      year1.push(item);
    } else if (milesUntilFailure <= milesPerYear * 3) {
      year2to3.push(item);
    } else {
      lifetime.push(item);
    }
  }

  // -----------------------------------------------------------------------
  // 5. Annual oil changes
  // -----------------------------------------------------------------------
  const oilInterval = modelIntel?.oil_change_interval_miles ?? DEFAULT_OIL_CHANGE_INTERVAL;
  const oilChangesPerYear = Math.ceil(milesPerYear / oilInterval);
  const oilPartsCost = partsDB?.oil_filter ?? DEFAULT_OIL_CHANGE_COST_PARTS;
  const oilLaborCost = labor(DEFAULT_OIL_CHANGE_COST_LABOR);
  const annualOilCost = oilChangesPerYear * (oilPartsCost + oilLaborCost);

  // -----------------------------------------------------------------------
  // 6. Cost summary
  // -----------------------------------------------------------------------
  const sumCosts = (items: RepairItem[]) =>
    items.reduce((sum, i) => sum + i.cost_parts + i.cost_labor, 0);

  const immediateTotal = sumCosts(immediate);
  const year1Maintenance = annualOilCost;
  const year1LikelyRepairs = sumCosts(year1);

  // Spread year2-3 costs across 2 years
  const year2to3Total = sumCosts(year2to3);
  const year2Maintenance = annualOilCost;
  const year2LikelyRepairs = Math.round(year2to3Total / 2);
  const year3Maintenance = annualOilCost;
  const year3LikelyRepairs = year2to3Total - year2LikelyRepairs;

  const total3yr =
    immediateTotal +
    year1Maintenance +
    year1LikelyRepairs +
    year2Maintenance +
    year2LikelyRepairs +
    year3Maintenance +
    year3LikelyRepairs;

  const monthlyAverage = Math.round(total3yr / 36);

  // -----------------------------------------------------------------------
  // 7. Parts affordability
  // -----------------------------------------------------------------------
  const affordabilityScore = partsDB?.parts_affordability_score ?? 5;
  let comparison: string;
  if (affordabilityScore >= 8) {
    comparison = 'Very affordable parts - common and widely available';
  } else if (affordabilityScore >= 6) {
    comparison = 'Average parts costs';
  } else if (affordabilityScore >= 4) {
    comparison = 'Above-average parts costs';
  } else {
    comparison = 'Expensive parts - specialty or import vehicle';
  }

  const sampleCosts: { part: string; aftermarket_price: number; dealer_price: number }[] = [];
  if (partsDB) {
    const sampleParts: { key: keyof PartsPricingInput; label: string }[] = [
      { key: 'brake_pads_front', label: 'Front brake pads' },
      { key: 'alternator', label: 'Alternator' },
      { key: 'ac_compressor', label: 'A/C compressor' },
      { key: 'struts_front_pair', label: 'Front struts (pair)' },
      { key: 'starter_motor', label: 'Starter motor' },
    ];

    for (const sp of sampleParts) {
      const price = partsDB[sp.key];
      if (typeof price === 'number' && price > 0) {
        sampleCosts.push({
          part: sp.label,
          aftermarket_price: price,
          dealer_price: Math.round(price * DEALER_MARKUP),
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Build result
  // -----------------------------------------------------------------------
  return {
    immediate_repairs: immediate,
    next_12_months: year1,
    next_12_to_36_months: year2to3,
    lifetime_risks: lifetime,
    cost_summary: {
      immediate_total: immediateTotal,
      year_1_maintenance: year1Maintenance,
      year_1_likely_repairs: year1LikelyRepairs,
      year_2_maintenance: year2Maintenance,
      year_2_likely_repairs: year2LikelyRepairs,
      year_3_maintenance: year3Maintenance,
      year_3_likely_repairs: year3LikelyRepairs,
      total_3yr_cost: total3yr,
      monthly_average: monthlyAverage,
    },
    parts_affordability: {
      score: affordabilityScore,
      comparison,
      sample_costs: sampleCosts,
    },
    timing_system: {
      type: timingType,
      is_overdue: timingOverdue,
      next_service_miles: timingNextService,
      cost_if_needed: timingTotalCost,
      is_interference_engine: isInterference,
    },
  };
}
