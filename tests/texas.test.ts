import { describe, test, expect } from 'vitest';
import {
  calculateTexasTTL,
  isEmissionsCounty,
} from '../src/texas/ttl-calculator.js';

describe('Texas TTL Calculator', () => {
  test('calculates TTL for private sale in emissions county', () => {
    const result = calculateTexasTTL(8000, true, 'Galveston');
    expect(result.salesTax).toBe(500); // 8000 * 0.0625
    expect(result.titleFee).toBe(33);
    expect(result.registrationFee).toBe(51.75);
    expect(result.inspectionFee).toBe(7.5);
    expect(result.emissionsInspection).toBe(18.5);
    expect(result.docFee).toBe(0); // private sale
    expect(result.totalTTL).toBeCloseTo(610.75);
    expect(result.totalOTD).toBeCloseTo(8610.75);
  });

  test('calculates TTL for dealer sale in non-emissions county', () => {
    const result = calculateTexasTTL(10000, false, 'Montgomery');
    expect(result.salesTax).toBe(625);
    expect(result.emissionsInspection).toBe(0);
    expect(result.docFee).toBe(150); // dealer
    expect(result.totalOTD).toBeCloseTo(10867.25);
  });
});

describe('Emissions Counties', () => {
  test('Harris is an emissions county', () => {
    expect(isEmissionsCounty('Harris')).toBe(true);
  });

  test('Galveston is an emissions county', () => {
    expect(isEmissionsCounty('Galveston')).toBe(true);
  });

  test('Montgomery is not an emissions county', () => {
    expect(isEmissionsCounty('Montgomery')).toBe(false);
  });

  test('case insensitive', () => {
    expect(isEmissionsCounty('harris')).toBe(true);
    expect(isEmissionsCounty('GALVESTON')).toBe(true);
  });
});
