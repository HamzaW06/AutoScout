import { describe, test, expect } from 'vitest';
import {
  normalizeMake,
  normalizeModel,
  extractTrim,
  normalizeTransmission,
  normalizeBodyStyle,
  normalizeTitleStatus,
} from '../src/enrichment/normalizer.js';

describe('normalizeMake', () => {
  test('normalizes common aliases', () => {
    expect(normalizeMake('chevy')).toBe('Chevrolet');
    expect(normalizeMake('vw')).toBe('Volkswagen');
    expect(normalizeMake('merc')).toBe('Mercedes-Benz');
  });

  test('normalizes case variants', () => {
    expect(normalizeMake('TOYOTA')).toBe('Toyota');
    expect(normalizeMake('honda')).toBe('Honda');
    expect(normalizeMake('FORD')).toBe('Ford');
  });

  test('handles edge cases', () => {
    expect(normalizeMake('')).toBe('');
    expect(normalizeMake('  Honda  ')).toBe('Honda');
    expect(normalizeMake('  ')).toBe('');
  });
});

describe('extractTrim', () => {
  test('extracts common trims', () => {
    const result = extractTrim('Camry LE');
    expect(result.model).toBe('Camry');
    expect(result.trim).toBe('LE');
  });

  test('handles model with no trim', () => {
    const result = extractTrim('Camry');
    expect(result.model).toBe('Camry');
    expect(result.trim).toBe('');
  });
});

describe('normalizeTransmission', () => {
  test('normalizes transmission types', () => {
    expect(normalizeTransmission('automatic')).toBe('auto');
    expect(normalizeTransmission('Manual')).toBe('manual');
    expect(normalizeTransmission('CVT')).toBe('cvt');
  });
});

describe('normalizeBodyStyle', () => {
  test('normalizes body styles', () => {
    expect(normalizeBodyStyle('SUV')).toBe('suv');
    expect(normalizeBodyStyle('Sedan')).toBe('sedan');
    expect(normalizeBodyStyle('Pick-up')).toBe('truck');
  });
});

describe('normalizeTitleStatus', () => {
  test('normalizes title statuses', () => {
    expect(normalizeTitleStatus('Clean')).toBe('clean');
    expect(normalizeTitleStatus('SALVAGE')).toBe('salvage');
    expect(normalizeTitleStatus('rebuilt')).toBe('rebuilt');
    expect(normalizeTitleStatus('something weird')).toBe('unknown');
  });
});
