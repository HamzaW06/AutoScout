// ── Negotiation Scorer ─────────────────────────────────────────────
// Calculates buyer negotiation leverage (0‑100) and generates
// actionable tactics.  Pure logic – no DB or network access.
// -------------------------------------------------------------------

export interface NegotiationInput {
  days_on_market?: number;
  price_dropped?: number;        // 1 if price was ever reduced
  price_drop_count?: number;
  deal_score?: number;           // from deal‑rater (positive = below market)
  risk_factors?: string[];
  seller_type?: string;          // 'dealer' | 'private'
  // Comparables
  comparable_count?: number;
}

export interface NegotiationResult {
  score: number;                             // 0‑100, higher = more leverage
  level: 'STRONG' | 'MODERATE' | 'WEAK';
  tactics: string[];                         // specific negotiation tactics
}

/**
 * Calculate how much negotiation leverage a buyer has and return
 * contextual tactics.
 */
export function calculateNegotiationPower(input: NegotiationInput): NegotiationResult {
  let score = 50;
  const tactics: string[] = [];

  // ── Days on market ──────────────────────────────────────────────
  if (input.days_on_market !== undefined) {
    if (input.days_on_market > 60) {
      score += 15;
      tactics.push(`Listed for ${input.days_on_market} days - seller is motivated`);
    } else if (input.days_on_market > 30) {
      score += 10;
      tactics.push(`On the market ${input.days_on_market} days - some urgency to sell`);
    } else if (input.days_on_market < 3) {
      score -= 10;
      tactics.push('Just listed - seller unlikely to negotiate yet');
    }
  }

  // ── Price drops ─────────────────────────────────────────────────
  if (input.price_dropped === 1) {
    score += 10;
    if (input.price_drop_count !== undefined && input.price_drop_count > 0) {
      tactics.push(
        `Price dropped ${input.price_drop_count} time${input.price_drop_count > 1 ? 's' : ''} already - they want to sell`,
      );
    } else {
      tactics.push('Price was already reduced - seller is flexible');
    }
  }

  if (input.price_drop_count !== undefined && input.price_drop_count > 2) {
    score += 5;
    tactics.push('Multiple price reductions signal difficulty selling');
  }

  // ── Comparable inventory ────────────────────────────────────────
  if (input.comparable_count !== undefined) {
    if (input.comparable_count > 10) {
      score += 10;
      tactics.push(`${input.comparable_count} similar vehicles available - plenty of alternatives`);
    } else if (input.comparable_count < 3) {
      score -= 10;
      tactics.push('Very few comparable listings - limited alternatives weaken leverage');
    }
  }

  // ── Risk factors ────────────────────────────────────────────────
  if (input.risk_factors && input.risk_factors.length > 0) {
    const riskAdd = input.risk_factors.length * 3;
    score += riskAdd;
    tactics.push(
      `${input.risk_factors.length} risk factor${input.risk_factors.length > 1 ? 's' : ''} to cite during negotiation (+${riskAdd})`,
    );
  }

  // ── Seller type ─────────────────────────────────────────────────
  if (input.seller_type?.toLowerCase() === 'dealer') {
    score += 5;
    tactics.push('Dealer listing - they have margin built in; room to negotiate');
  }

  // ── Month‑end bonus ─────────────────────────────────────────────
  const dayOfMonth = new Date().getDate();
  if (dayOfMonth > 25) {
    score += 5;
    tactics.push('End of month - dealers often push for quota; leverage this timing');
  }

  // ── Overpriced listing ──────────────────────────────────────────
  if (input.deal_score !== undefined && input.deal_score < -10) {
    score += 10;
    tactics.push('Listing is significantly overpriced compared to market - use comps to justify lower offer');
  }

  // ── Clamp ───────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  // ── Level ───────────────────────────────────────────────────────
  let level: NegotiationResult['level'];
  if (score >= 65) {
    level = 'STRONG';
  } else if (score >= 40) {
    level = 'MODERATE';
  } else {
    level = 'WEAK';
  }

  return { score, level, tactics };
}
