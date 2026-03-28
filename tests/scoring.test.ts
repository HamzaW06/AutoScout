import { describe, test, expect } from 'vitest';
import { calculateRiskScore } from '../src/enrichment/risk-scorer.js';
import { calculateDealRating } from '../src/enrichment/deal-rater.js';
import { calculateNegotiationPower } from '../src/enrichment/negotiation-scorer.js';

describe('Risk Scoring', () => {
  test('salvage title is high risk', () => {
    const result = calculateRiskScore({
      title_status: 'salvage',
      mileage: 100000,
      year: 2015,
    });
    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.factors.length).toBeGreaterThan(0);
  });

  test('clean title 1-owner is low risk', () => {
    const result = calculateRiskScore({
      title_status: 'clean',
      owner_count: 1,
      accident_count: 0,
      mileage: 80000,
      year: 2016,
    });
    expect(result.score).toBeLessThan(50);
  });

  test('overdue timing belt increases risk', () => {
    const base = calculateRiskScore({
      mileage: 130000,
      year: 2010,
    });
    const withBelt = calculateRiskScore({
      mileage: 130000,
      year: 2010,
      timing_type: 'belt',
      timing_interval_miles: 105000,
    });
    expect(withBelt.score).toBeGreaterThan(base.score);
  });

  test('score is clamped 0-100', () => {
    const extreme = calculateRiskScore({
      title_status: 'salvage',
      accident_count: 5,
      structural_damage: 1,
      airbag_deployed: 1,
      mileage: 200000,
      year: 2005,
    });
    expect(extreme.score).toBeLessThanOrEqual(100);
    expect(extreme.score).toBeGreaterThanOrEqual(0);
  });
});

describe('Deal Rating', () => {
  test('rates a steal correctly', () => {
    const result = calculateDealRating(6000, 10000, 100000);
    expect(result.rating).toBe('STEAL');
    expect(result.dealScore).toBeGreaterThan(25);
  });

  test('rates a rip-off correctly', () => {
    const result = calculateDealRating(12000, 8000, 100000);
    expect(result.rating).toBe('RIP-OFF');
    expect(result.dealScore).toBeLessThan(-15);
  });

  test('rates fair price correctly', () => {
    const result = calculateDealRating(9800, 10000, 100000);
    expect(result.rating).toBe('FAIR');
  });

  test('calculates offer range', () => {
    const result = calculateDealRating(10000, 10000, 100000);
    expect(result.offerLow).toBe(8000);
    expect(result.offerHigh).toBe(9500);
  });

  test('calculates price per mile', () => {
    const result = calculateDealRating(10000, 10000, 100000);
    expect(result.pricePerMile).toBeCloseTo(0.1);
  });
});

describe('Negotiation Power', () => {
  test('long-listed car gives strong negotiation power', () => {
    const result = calculateNegotiationPower({
      days_on_market: 90,
      price_dropped: 1,
      price_drop_count: 3,
      comparable_count: 15,
    });
    expect(result.score).toBeGreaterThanOrEqual(65);
    expect(result.level).toBe('STRONG');
    expect(result.tactics.length).toBeGreaterThan(0);
  });

  test('freshly listed car with few comparables is weak', () => {
    const result = calculateNegotiationPower({
      days_on_market: 1,
      comparable_count: 1,
    });
    expect(result.score).toBeLessThan(40);
    expect(result.level).toBe('WEAK');
  });

  test('score is clamped 0-100', () => {
    const result = calculateNegotiationPower({
      days_on_market: 200,
      price_dropped: 1,
      price_drop_count: 10,
      comparable_count: 50,
      risk_factors: ['a', 'b', 'c', 'd', 'e', 'f'],
      seller_type: 'dealer',
      deal_score: -30,
    });
    expect(result.score).toBeLessThanOrEqual(100);
  });
});
