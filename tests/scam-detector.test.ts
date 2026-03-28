import { describe, test, expect } from 'vitest';
import { detectScams } from '../src/enrichment/scam-detector.js';

describe('Scam Detection', () => {
  test('detects curbstoner', () => {
    const listing = {
      id: 'test1',
      asking_price: 5000,
      seller_phone: '555-1234',
      seller_type: 'private',
    };
    const others = Array.from({ length: 5 }, (_, i) => ({
      id: `other${i}`,
      asking_price: 5000 + i * 100,
      seller_phone: '555-1234',
    }));
    const result = detectScams(listing, others);
    expect(result.flags.some((f) => f.includes('CURBSTONER'))).toBe(true);
  });

  test('flags no-photo listings', () => {
    const result = detectScams(
      { id: 'test1', asking_price: 5000, photos: null },
      [],
    );
    expect(result.flags.some((f) => f.includes('NO PHOTOS'))).toBe(true);
  });

  test('flags missing VIN', () => {
    const result = detectScams(
      { id: 'test1', asking_price: 5000, vin: null },
      [],
    );
    expect(result.flags.some((f) => f.includes('NO VIN'))).toBe(true);
  });

  test('flags suspicious price', () => {
    const result = detectScams(
      { id: 'test1', asking_price: 3000, deal_score: 50 },
      [],
    );
    expect(result.flags.some((f) => f.includes('SUSPICIOUS PRICE'))).toBe(
      true,
    );
  });

  test('clean listing returns CLEAR', () => {
    const result = detectScams(
      {
        id: 'test1',
        asking_price: 5000,
        vin: '1HGCP36878A080119',
        vin_verified: 1,
        photos: '["photo1.jpg","photo2.jpg"]',
        seller_type: 'dealer',
        deal_score: 10,
      },
      [],
    );
    expect(result.level).toBe('CLEAR');
    expect(result.score).toBe(0);
  });
});
