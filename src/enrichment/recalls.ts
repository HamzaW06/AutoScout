// ── Recalls Lookup ─────────────────────────────────────────────────
// Fetches recall campaigns for a make/model/year via the NHTSA
// Recalls API.  Free API, no key required.
// -------------------------------------------------------------------

import { logger } from '../logger.js';

export interface RecallResult {
  count: number;
  recalls: {
    nhtsaCampaignNumber: string;
    component: string;
    summary: string;
    consequence: string;
    remedy: string;
    reportDate: string;
  }[];
}

const RECALLS_BASE = 'https://api.nhtsa.dot.gov/recalls/recallsByVehicle';

/**
 * Look up all NHTSA recall campaigns for a given make / model / year.
 *
 * Returns an empty list on any error so callers are never blocked.
 */
export async function getRecalls(
  make: string,
  model: string,
  year: number,
): Promise<RecallResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const url =
      `${RECALLS_BASE}?make=${encodeURIComponent(make)}` +
      `&model=${encodeURIComponent(model)}` +
      `&modelYear=${year}`;

    const resp = await fetch(url, { signal: controller.signal });

    if (!resp.ok) {
      logger.warn(
        { make, model, year, status: resp.status },
        'NHTSA Recalls API returned non-OK status',
      );
      return { count: 0, recalls: [] };
    }

    const data = (await resp.json()) as {
      Count: number;
      results: {
        NHTSACampaignNumber?: string;
        Component?: string;
        Summary?: string;
        Consequence?: string;
        Remedy?: string;
        ReportReceivedDate?: string;
      }[];
    };

    const recalls = (data.results ?? []).map((r) => ({
      nhtsaCampaignNumber: r.NHTSACampaignNumber ?? '',
      component: r.Component ?? '',
      summary: r.Summary ?? '',
      consequence: r.Consequence ?? '',
      remedy: r.Remedy ?? '',
      reportDate: r.ReportReceivedDate ?? '',
    }));

    return { count: data.Count ?? recalls.length, recalls };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ make, model, year, err: msg }, 'Recalls lookup failed');
    return { count: 0, recalls: [] };
  } finally {
    clearTimeout(timeout);
  }
}
