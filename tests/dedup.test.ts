import { describe, test, expect } from 'vitest';
import { findDuplicate, mergeListings } from '../src/enrichment/dedup.js';

describe('Deduplication', () => {
  test('exact VIN match', () => {
    const a = {
      id: 'new',
      vin: '1HGCP36878A080119',
      year: 2008,
      make: 'Honda',
      model: 'Accord',
      mileage: 127000,
      asking_price: 4000,
      source: 'craigslist',
    };
    const existing = [
      {
        id: 'existing1',
        vin: '1HGCP36878A080119',
        year: 2008,
        make: 'Honda',
        model: 'Accord',
        mileage: 127000,
        asking_price: 4200,
        source: 'marketcheck',
      },
    ];
    const result = findDuplicate(a, existing);
    expect(result.isDuplicate).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.matchType).toBe('vin_exact');
  });

  test('fuzzy tight match', () => {
    const a = {
      id: 'new',
      year: 2013,
      make: 'Toyota',
      model: 'Camry',
      mileage: 98000,
      asking_price: 5200,
      source: 'craigslist',
    };
    const existing = [
      {
        id: 'existing1',
        year: 2013,
        make: 'Toyota',
        model: 'Camry',
        mileage: 98050,
        asking_price: 5200,
        source: 'dealer',
      },
    ];
    const result = findDuplicate(a, existing);
    expect(result.isDuplicate).toBe(true);
    expect(result.matchType).toBe('fuzzy_tight');
  });

  test('different cars are not duplicates', () => {
    const a = {
      id: 'new',
      year: 2013,
      make: 'Toyota',
      model: 'Camry',
      mileage: 98000,
      asking_price: 5000,
      source: 'craigslist',
    };
    const existing = [
      {
        id: 'existing1',
        year: 2013,
        make: 'Toyota',
        model: 'Camry',
        mileage: 145000,
        asking_price: 4000,
        source: 'dealer',
      },
    ];
    const result = findDuplicate(a, existing);
    expect(result.isDuplicate).toBe(false);
  });
});

describe('Merge Listings', () => {
  test('merges keeping richest data', () => {
    const existing = {
      id: 'existing1',
      vin: null,
      year: 2013,
      make: 'Toyota',
      model: 'Camry',
      mileage: 98000,
      asking_price: 5200,
      source: 'craigslist',
      sources_found_on: '["craigslist"]',
      photos: '["a.jpg"]',
    };
    const incoming = {
      id: 'new1',
      vin: '4T1BF3EK2BU765897',
      year: 2013,
      make: 'Toyota',
      model: 'Camry',
      mileage: 98050,
      asking_price: 5000,
      source: 'marketcheck',
      photos: '["a.jpg","b.jpg","c.jpg"]',
    };
    const merged = mergeListings(existing, incoming);
    expect(merged.vin).toBe('4T1BF3EK2BU765897');
    expect(merged.asking_price).toBe(5000);
    expect(merged.is_multi_source).toBe(1);
    // Incoming has more photos, so it wins
    expect(merged.photos).toBe(incoming.photos);
  });
});
