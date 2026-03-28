// ── NHTSA Result Cache ───────────────────────────────────────────────
// Caches NHTSA API responses (recalls, complaints, safety ratings) in
// the local SQLite database to avoid redundant network calls.
// Each entry expires after CACHE_TTL_DAYS days.
// -------------------------------------------------------------------

import { getDb } from '../db/database.js';
import { logger } from '../logger.js';

const CACHE_TTL_DAYS = 30;

interface CacheRow {
  cache_key: string;
  data: string;
  fetched_at: string;
  expires_at: string;
}

export class NHTSACache {
  /**
   * Build a canonical cache key from lookup parameters.
   * Format: 'type:make_lower:model_lower:year'
   * e.g.  'recalls:toyota:camry:2020'
   */
  makeKey(type: string, make: string, model: string, year: number): string {
    return `${type}:${make.toLowerCase()}:${model.toLowerCase()}:${year}`;
  }

  /**
   * Retrieve a cached value for the given key.
   * Returns parsed JSON data if the entry exists and has not expired.
   * Deletes expired entries on access and returns null.
   */
  get(key: string): unknown | null {
    try {
      const row = getDb().get<CacheRow>(
        'SELECT cache_key, data, expires_at FROM nhtsa_cache WHERE cache_key = ?',
        [key],
      );

      if (!row) {
        return null;
      }

      const now = new Date();
      const expiresAt = new Date(row.expires_at);

      if (now > expiresAt) {
        // Entry is stale — remove it and signal a cache miss
        this.delete(key);
        logger.debug({ key }, 'NHTSA cache entry expired, deleted');
        return null;
      }

      return JSON.parse(row.data) as unknown;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ key, err: msg }, 'NHTSA cache get failed');
      return null;
    }
  }

  /**
   * Store a value in the cache under the given key.
   * The entry will expire CACHE_TTL_DAYS days from now.
   * Uses INSERT OR REPLACE so existing entries are overwritten.
   */
  set(key: string, data: unknown): void {
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);
      const expiresAtStr = expiresAt.toISOString().replace('T', ' ').slice(0, 19);

      getDb().run(
        `INSERT OR REPLACE INTO nhtsa_cache (cache_key, data, fetched_at, expires_at)
         VALUES (?, ?, datetime('now'), ?)`,
        [key, JSON.stringify(data), expiresAtStr],
      );

      logger.debug({ key, expiresAt: expiresAtStr }, 'NHTSA cache entry stored');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ key, err: msg }, 'NHTSA cache set failed');
    }
  }

  /**
   * Remove a single entry from the cache by key.
   */
  delete(key: string): void {
    try {
      getDb().run('DELETE FROM nhtsa_cache WHERE cache_key = ?', [key]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ key, err: msg }, 'NHTSA cache delete failed');
    }
  }
}
