import { describe, it, expect } from 'vitest';
import { normalizeIntendedPalette } from '../types';

describe('normalizeIntendedPalette', () => {
  it('valid input returns IntendedPalette with uppercase hex', () => {
    const result = normalizeIntendedPalette({
      primary: '#22c55e',
      accent: '#1e40af',
      background: '#0f172a',
      support: ['#3b82f6'],
    });
    expect(result).toEqual({
      primary: '#22C55E',
      accent: '#1E40AF',
      background: '#0F172A',
      support: ['#3B82F6'],
    });
  });

  it('invalid primary returns null', () => {
    const result = normalizeIntendedPalette({
      primary: 'invalid',
      accent: '#1e40af',
      background: '#0f172a',
    });
    expect(result).toBeNull();
  });

  it('support filters out invalid hexes', () => {
    const result = normalizeIntendedPalette({
      primary: '#22c55e',
      accent: '#1e40af',
      background: '#0f172a',
      support: ['#3B82F6', 'invalid', '#FF6600'],
    });
    expect(result?.support).toEqual(['#3B82F6', '#FF6600']);
  });

  it('idempotent — calling twice returns identical result', () => {
    const input = { primary: '#22c55e', accent: '#1e40af', background: '#0f172a', support: ['#3b82f6'] };
    const first = normalizeIntendedPalette(input);
    const second = normalizeIntendedPalette(first);
    expect(second).toEqual(first);
  });

  it('null returns null', () => {
    expect(normalizeIntendedPalette(null)).toBeNull();
  });

  it('undefined returns null', () => {
    expect(normalizeIntendedPalette(undefined)).toBeNull();
  });

  it('empty object returns null', () => {
    expect(normalizeIntendedPalette({})).toBeNull();
  });

  it('missing accent returns null', () => {
    const result = normalizeIntendedPalette({
      primary: '#22c55e',
      background: '#0f172a',
    });
    expect(result).toBeNull();
  });
});
