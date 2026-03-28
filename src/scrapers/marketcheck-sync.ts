import { logger } from '../logger.js';
import { getActiveSearchConfigs, type SearchConfigRow } from '../db/queries.js';
import {
  searchInventory,
  getDailyCallCount,
  getDailyBudgetLimit,
  type MarketCheckSearchParams,
} from './marketcheck.js';
import { processListings } from '../enrichment/pipeline.js';

export interface MarketCheckSyncOptions {
  maxConfigs?: number;
  maxPagesPerConfig?: number;
  rowsPerPage?: number;
  radius?: number;
}

export interface MarketCheckSyncResult {
  configsProcessed: number;
  apiCallsUsed: number;
  fetched: number;
  processed: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: string[];
}

function buildSearchParamsFromConfig(
  configRow: SearchConfigRow | null,
  page: number,
  rowsPerPage: number,
  radius: number,
): MarketCheckSearchParams {
  const params: MarketCheckSearchParams = {
    radius,
    rows: rowsPerPage,
    start: page * rowsPerPage,
    sortBy: 'dom',
    sortOrder: 'desc',
  };

  if (!configRow) return params;

  if (configRow.make) params.make = configRow.make;
  if (configRow.model) params.model = configRow.model;

  const yMin = configRow.year_min;
  const yMax = configRow.year_max;
  if (yMin != null && yMax != null) {
    params.year = yMin === yMax ? yMin : `${yMin}-${yMax}`;
  } else if (yMin != null) {
    params.year = `${yMin}-${new Date().getFullYear() + 1}`;
  } else if (yMax != null) {
    params.year = `1980-${yMax}`;
  }

  if (configRow.max_price != null) {
    params.priceRange = `0-${configRow.max_price}`;
  }

  if (configRow.max_mileage != null) {
    params.milesRange = `0-${configRow.max_mileage}`;
  }

  return params;
}

export async function syncMarketCheckListings(
  options: MarketCheckSyncOptions = {},
): Promise<MarketCheckSyncResult> {
  const maxConfigs = options.maxConfigs ?? 8;
  const maxPagesPerConfig = options.maxPagesPerConfig ?? 4;
  const rowsPerPage = Math.max(1, Math.min(options.rowsPerPage ?? 50, 50));
  const radius = options.radius ?? 50;

  const result: MarketCheckSyncResult = {
    configsProcessed: 0,
    apiCallsUsed: 0,
    fetched: 0,
    processed: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const callsBefore = getDailyCallCount();
  const budgetLimit = getDailyBudgetLimit();

  const configs = getActiveSearchConfigs().slice(0, maxConfigs);
  const effectiveConfigs = configs.length > 0 ? configs : [null];

  logger.info(
    {
      activeConfigs: configs.length,
      maxConfigs,
      maxPagesPerConfig,
      rowsPerPage,
      radius,
      callsBefore,
      budgetLimit,
    },
    'marketcheck-sync: starting sync',
  );

  for (const cfg of effectiveConfigs) {
    result.configsProcessed += 1;

    for (let page = 0; page < maxPagesPerConfig; page++) {
      if (getDailyCallCount() >= budgetLimit) {
        result.errors.push('MarketCheck daily budget exhausted during sync');
        break;
      }

      const params = buildSearchParamsFromConfig(cfg, page, rowsPerPage, radius);
      const search = await searchInventory(params);

      if (!search.listings.length) {
        break;
      }

      result.fetched += search.listings.length;

      const pipeline = await processListings(
        search.listings as unknown as Record<string, unknown>[],
        'marketcheck',
      );

      result.processed += pipeline.processed;
      result.inserted += pipeline.inserted;
      result.updated += pipeline.updated;
      result.skipped += pipeline.skipped;
      result.errors.push(...pipeline.errors);

      // Stop paging when the API returns less than requested rows.
      if (search.listings.length < rowsPerPage) {
        break;
      }
    }
  }

  result.apiCallsUsed = getDailyCallCount() - callsBefore;

  logger.info(
    {
      ...result,
      callsAfter: getDailyCallCount(),
      budgetLimit,
    },
    'marketcheck-sync: sync complete',
  );

  return result;
}
