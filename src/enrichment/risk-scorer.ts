// ── Risk Scorer ────────────────────────────────────────────────────
// Calculates a 0‑100 risk score for a used‑car listing.
// Higher = worse.  Pure logic – no DB or network access.
// -------------------------------------------------------------------

export interface RiskInput {
  title_status?: string;
  owner_count?: number;
  accident_count?: number;
  was_rental?: number;
  was_fleet?: number;
  structural_damage?: number;
  airbag_deployed?: number;
  mileage: number;
  year: number;
  // Model intelligence (optional)
  reliability_score?: number;
  timing_type?: string;          // 'belt' | 'chain'
  timing_interval_miles?: number;
  known_issues?: string;         // JSON‑encoded string[]
  transmission?: string;
}

export interface RiskResult {
  score: number;      // 0‑100, higher = worse
  factors: string[];  // human‑readable risk factors
}

/**
 * Calculate a composite risk score.
 *
 * Starts at 50 and adjusts based on the attributes of the listing.
 * Result is clamped to [0, 100].
 */
export function calculateRiskScore(input: RiskInput): RiskResult {
  let score = 50;
  const factors: string[] = [];

  // ── Title status ────────────────────────────────────────────────
  const status = (input.title_status ?? '').toLowerCase();
  if (status === 'salvage') {
    score += 30;
    factors.push('Salvage title (+30)');
  } else if (status === 'rebuilt' || status === 'reconstructed') {
    score += 20;
    factors.push('Rebuilt title (+20)');
  } else if (status === 'flood') {
    score += 25;
    factors.push('Flood damage title (+25)');
  }

  // ── Owner count ─────────────────────────────────────────────────
  if (input.owner_count !== undefined) {
    if (input.owner_count === 1) {
      score -= 10;
      factors.push('Single owner (-10)');
    } else if (input.owner_count >= 4) {
      score += 10;
      factors.push(`${input.owner_count} previous owners (+10)`);
    }
  }

  // ── Rental history ──────────────────────────────────────────────
  if (input.was_rental === 1) {
    score += 8;
    factors.push('Former rental vehicle (+8)');
  }

  // ── Accident history ────────────────────────────────────────────
  if (input.accident_count !== undefined && input.accident_count > 0) {
    const add = input.accident_count * 8;
    score += add;
    factors.push(`${input.accident_count} accident(s) reported (+${add})`);
  }

  // ── Structural damage ───────────────────────────────────────────
  if (input.structural_damage === 1) {
    score += 15;
    factors.push('Structural damage reported (+15)');
  }

  // ── Airbag deployment ───────────────────────────────────────────
  if (input.airbag_deployed === 1) {
    score += 20;
    factors.push('Airbag deployment reported (+20)');
  }

  // ── Mileage / year ─────────────────────────────────────────────
  const currentYear = new Date().getFullYear();
  const vehicleAge = Math.max(currentYear - input.year, 1);
  const milesPerYear = input.mileage / vehicleAge;

  if (milesPerYear > 18_000) {
    score += 5;
    factors.push(`High mileage (${Math.round(milesPerYear).toLocaleString()} mi/yr, +5)`);
  } else if (milesPerYear < 8_000) {
    score -= 5;
    factors.push(`Low mileage (${Math.round(milesPerYear).toLocaleString()} mi/yr, -5)`);
  }

  // ── Reliability score ───────────────────────────────────────────
  if (input.reliability_score !== undefined) {
    if (input.reliability_score < 50) {
      score += 10;
      factors.push(`Below‑average reliability (score ${input.reliability_score}, +10)`);
    } else if (input.reliability_score > 85) {
      score -= 10;
      factors.push(`Excellent reliability (score ${input.reliability_score}, -10)`);
    }
  }

  // ── Timing belt overdue ─────────────────────────────────────────
  if (
    input.timing_type === 'belt' &&
    input.timing_interval_miles !== undefined &&
    input.mileage > input.timing_interval_miles
  ) {
    score += 15;
    factors.push(
      `Timing belt may be overdue (interval ${input.timing_interval_miles.toLocaleString()} mi, current ${input.mileage.toLocaleString()} mi, +15)`,
    );
  }

  // ── Known CVT issues ────────────────────────────────────────────
  if (input.known_issues) {
    try {
      const issues: string[] = JSON.parse(input.known_issues);
      const hasCvtIssue = issues.some(
        i => /cvt/i.test(i) && /fail|defect|problem|issue|recall/i.test(i),
      );
      if (hasCvtIssue) {
        score += 12;
        factors.push('Known CVT failure issues (+12)');
      }
    } catch {
      // malformed JSON – ignore
    }
  }

  // ── Clamp ───────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  return { score, factors };
}
