// ── Complaints Lookup ──────────────────────────────────────────────
// Fetches consumer complaints for a make/model/year via the NHTSA
// Complaints API.  Free API, no key required.
// -------------------------------------------------------------------

import { logger } from '../logger.js';

export interface ComplaintResult {
  count: number;
  complaints: {
    odiNumber: string;
    component: string;
    summary: string;
    crash: boolean;
    fire: boolean;
    dateComplaint: string;
  }[];
}

const COMPLAINTS_BASE =
  'https://api.nhtsa.dot.gov/complaints/complaintsByVehicle';

/**
 * Look up all NHTSA consumer complaints for a given make / model / year.
 *
 * Returns an empty list on any error so callers are never blocked.
 */
export async function getComplaints(
  make: string,
  model: string,
  year: number,
): Promise<ComplaintResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const url =
      `${COMPLAINTS_BASE}?make=${encodeURIComponent(make)}` +
      `&model=${encodeURIComponent(model)}` +
      `&modelYear=${year}`;

    const resp = await fetch(url, { signal: controller.signal });

    if (!resp.ok) {
      logger.warn(
        { make, model, year, status: resp.status },
        'NHTSA Complaints API returned non-OK status',
      );
      return { count: 0, complaints: [] };
    }

    const data = (await resp.json()) as {
      Count: number;
      results: {
        odiNumber?: string;
        components?: string;
        summary?: string;
        crash?: string;
        fire?: string;
        dateComplaintFiled?: string;
      }[];
    };

    const complaints = (data.results ?? []).map((r) => ({
      odiNumber: r.odiNumber ?? '',
      component: r.components ?? '',
      summary: r.summary ?? '',
      crash: r.crash === 'Yes',
      fire: r.fire === 'Yes',
      dateComplaint: r.dateComplaintFiled ?? '',
    }));

    return { count: data.Count ?? complaints.length, complaints };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ make, model, year, err: msg }, 'Complaints lookup failed');
    return { count: 0, complaints: [] };
  } finally {
    clearTimeout(timeout);
  }
}
