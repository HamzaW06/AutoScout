import { describe, test, expect, vi, beforeEach } from 'vitest';
import { NHTSACache } from '../../src/enrichment/cache.js';

// The DB is not initialised in the test environment; mock the database module
// so that any call to getDb() throws a "not initialized" error (the default
// behaviour) — we avoid calling get/set/delete in these tests.
vi.mock('../../src/db/database.js', () => ({
  getDb: () => {
    throw new Error('Database not initialized');
  },
}));

describe('NHTSACache', () => {
  let cache: NHTSACache;

  beforeEach(() => {
    cache = new NHTSACache();
  });

  describe('makeKey', () => {
    test('formats key as type:make:model:year', () => {
      expect(cache.makeKey('recalls', 'Toyota', 'Camry', 2020)).toBe(
        'recalls:toyota:camry:2020',
      );
    });

    test('lowercases make and model', () => {
      expect(cache.makeKey('complaints', 'FORD', 'MUSTANG', 2018)).toBe(
        'complaints:ford:mustang:2018',
      );
    });

    test('lowercases mixed-case make and model', () => {
      expect(cache.makeKey('safety', 'Honda', 'CR-V', 2022)).toBe(
        'safety:honda:cr-v:2022',
      );
    });

    test('includes year as a number', () => {
      const key = cache.makeKey('recalls', 'chevrolet', 'silverado', 2015);
      expect(key).toBe('recalls:chevrolet:silverado:2015');
    });
  });

  describe('get', () => {
    test('returns null on cache miss (DB not available)', () => {
      // getDb() throws → get() should catch and return null
      const result = cache.get('recalls:toyota:camry:2020');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    test('does not throw when DB is unavailable', () => {
      expect(() =>
        cache.set('recalls:toyota:camry:2020', { count: 2, recalls: [] }),
      ).not.toThrow();
    });
  });

  describe('delete', () => {
    test('does not throw when DB is unavailable', () => {
      expect(() => cache.delete('recalls:toyota:camry:2020')).not.toThrow();
    });
  });
});
