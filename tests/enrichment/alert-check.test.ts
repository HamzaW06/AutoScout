import { describe, test, expect } from 'vitest';
import { shouldFireAlert } from '../../src/enrichment/alert-check.js';

const base = {
  deal_score: 30,
  price: 8000,
  year: 2019,
  make: 'Toyota',
  model: 'Camry',
};

describe('shouldFireAlert', () => {
  test('STEAL rating returns ["steal"]', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'STEAL' });
    expect(result).toContain('steal');
    expect(result).toHaveLength(1);
  });

  test('GREAT rating returns ["great_deal"]', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'GREAT' });
    expect(result).toContain('great_deal');
    expect(result).toHaveLength(1);
  });

  test('FAIR rating returns empty array', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'FAIR' });
    expect(result).toEqual([]);
  });

  test('GOOD rating returns empty array', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'GOOD' });
    expect(result).toEqual([]);
  });

  test('HIGH rating returns empty array', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'HIGH' });
    expect(result).toEqual([]);
  });

  test('RIP-OFF rating returns empty array', () => {
    const result = shouldFireAlert({ ...base, value_rating: 'RIP-OFF' });
    expect(result).toEqual([]);
  });
});
