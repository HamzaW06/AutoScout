import { describe, test, expect } from 'vitest';
import { computeFallbackMarketValue } from '../../src/enrichment/market-value.js';

describe('computeFallbackMarketValue', () => {
  test('returns 0 for empty array', () => {
    expect(computeFallbackMarketValue([])).toBe(0);
  });

  test('computes average of two benchmarks', () => {
    const benchmarks = [
      { price: 10000, source: 'kbb' },
      { price: 12000, source: 'edmunds' },
    ];
    // median = (10000 + 12000) / 2 = 11000
    // both prices <= 2 * 11000 = 22000, so both included
    // average = (10000 + 12000) / 2 = 11000
    expect(computeFallbackMarketValue(benchmarks)).toBe(11000);
  });

  test('excludes outliers greater than 2x median', () => {
    const benchmarks = [
      { price: 10000, source: 'kbb' },
      { price: 11000, source: 'edmunds' },
      { price: 12000, source: 'cargurus' },
      { price: 50000, source: 'outlier' }, // outlier: > 2 * 11000 = 22000
    ];
    // sorted: [10000, 11000, 12000, 50000]
    // median = (11000 + 12000) / 2 = 11500
    // threshold = 2 * 11500 = 23000
    // 50000 > 23000 → excluded
    // filtered = [10000, 11000, 12000]
    // average = 33000 / 3 = 11000
    expect(computeFallbackMarketValue(benchmarks)).toBe(11000);
  });

  test('returns average rounded to nearest integer', () => {
    const benchmarks = [
      { price: 10000, source: 'kbb' },
      { price: 10001, source: 'edmunds' },
      { price: 10002, source: 'cargurus' },
    ];
    // median = 10001
    // all <= 2 * 10001 = 20002, so all included
    // average = 30003 / 3 = 10001
    expect(computeFallbackMarketValue(benchmarks)).toBe(10001);
  });

  test('handles single benchmark', () => {
    expect(computeFallbackMarketValue([{ price: 15000, source: 'kbb' }])).toBe(15000);
  });
});
