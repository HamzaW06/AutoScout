import { describe, test, expect } from 'vitest';
import { analyzeDiscoveryResult } from '../../src/scrapers/onboard.js';
import type { DiscoveryInput } from '../../src/scrapers/onboard.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeInput(listingsFound: number): DiscoveryInput {
  return {
    listingsFound,
    platform: 'dealer.com',
    confidence: 0.9,
    inventoryUrl: 'https://example-dealer.com/inventory',
    totalPages: 3,
  };
}

// ── analyzeDiscoveryResult — priority assignment ───────────────────────────────

describe('analyzeDiscoveryResult — 50+ vehicles', () => {
  test('returns high priority for exactly 50 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(50));
    expect(result.priority).toBe('high');
  });

  test('returns high priority for 51 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(51));
    expect(result.priority).toBe('high');
  });

  test('returns high priority for 200 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(200));
    expect(result.priority).toBe('high');
  });

  test('scrapeIntervalHours is ≤6 for 50+ vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(50));
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(6);
  });

  test('scrapeIntervalHours is exactly 6 for 50+ vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(75));
    expect(result.scrapeIntervalHours).toBe(6);
  });
});

describe('analyzeDiscoveryResult — 10–49 vehicles', () => {
  test('returns medium priority for exactly 10 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(10));
    expect(result.priority).toBe('medium');
  });

  test('returns medium priority for 25 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(25));
    expect(result.priority).toBe('medium');
  });

  test('returns medium priority for exactly 49 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(49));
    expect(result.priority).toBe('medium');
  });

  test('scrapeIntervalHours is ≤12 for 10–49 vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(30));
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(12);
  });

  test('scrapeIntervalHours is exactly 12 for 10–49 vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(20));
    expect(result.scrapeIntervalHours).toBe(12);
  });
});

describe('analyzeDiscoveryResult — <10 vehicles', () => {
  test('returns low priority for 0 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(0));
    expect(result.priority).toBe('low');
  });

  test('returns low priority for 1 listing', () => {
    const result = analyzeDiscoveryResult(makeInput(1));
    expect(result.priority).toBe('low');
  });

  test('returns low priority for exactly 9 listings', () => {
    const result = analyzeDiscoveryResult(makeInput(9));
    expect(result.priority).toBe('low');
  });

  test('scrapeIntervalHours is ≤24 for <10 vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(5));
    expect(result.scrapeIntervalHours).toBeLessThanOrEqual(24);
  });

  test('scrapeIntervalHours is exactly 24 for <10 vehicles', () => {
    const result = analyzeDiscoveryResult(makeInput(0));
    expect(result.scrapeIntervalHours).toBe(24);
  });
});

// ── Boundary conditions ───────────────────────────────────────────────────────

describe('analyzeDiscoveryResult — boundary conditions', () => {
  test('priority transitions correctly at boundary 10 (medium not low)', () => {
    expect(analyzeDiscoveryResult(makeInput(10)).priority).toBe('medium');
    expect(analyzeDiscoveryResult(makeInput(9)).priority).toBe('low');
  });

  test('priority transitions correctly at boundary 50 (high not medium)', () => {
    expect(analyzeDiscoveryResult(makeInput(50)).priority).toBe('high');
    expect(analyzeDiscoveryResult(makeInput(49)).priority).toBe('medium');
  });

  test('interval transitions correctly at boundary 10', () => {
    expect(analyzeDiscoveryResult(makeInput(10)).scrapeIntervalHours).toBe(12);
    expect(analyzeDiscoveryResult(makeInput(9)).scrapeIntervalHours).toBe(24);
  });

  test('interval transitions correctly at boundary 50', () => {
    expect(analyzeDiscoveryResult(makeInput(50)).scrapeIntervalHours).toBe(6);
    expect(analyzeDiscoveryResult(makeInput(49)).scrapeIntervalHours).toBe(12);
  });
});

// ── Return shape ──────────────────────────────────────────────────────────────

describe('analyzeDiscoveryResult — return shape', () => {
  test('always returns an object with priority and scrapeIntervalHours', () => {
    const result = analyzeDiscoveryResult(makeInput(15));
    expect(result).toHaveProperty('priority');
    expect(result).toHaveProperty('scrapeIntervalHours');
  });

  test('priority is one of the valid enum values', () => {
    for (const count of [0, 10, 50]) {
      const { priority } = analyzeDiscoveryResult(makeInput(count));
      expect(['critical', 'high', 'medium', 'low']).toContain(priority);
    }
  });

  test('scrapeIntervalHours is a positive integer', () => {
    for (const count of [0, 10, 50]) {
      const { scrapeIntervalHours } = analyzeDiscoveryResult(makeInput(count));
      expect(scrapeIntervalHours).toBeGreaterThan(0);
      expect(Number.isInteger(scrapeIntervalHours)).toBe(true);
    }
  });
});
