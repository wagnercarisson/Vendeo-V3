import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ColorProbeResult, ColorCluster } from '@/lib/brand-assets/types';
import { intendedToResolved } from '../types';

vi.mock('@/lib/brand-assets/color-probe', () => ({
  probeColors: vi.fn(),
  findClosestProbeCluster: vi.fn(),
  deltaE: vi.fn(),
  hexToLab: vi.fn(),
  rgbToHex: vi.fn(),
  isLightNeutral: vi.fn(),
  STRONG_MATCH_DELTA_E: 12,
  ACCEPTABLE_MATCH_DELTA_E: 18,
  LOOSE_MATCH_DELTA_E: 25,
}));

describe('intendedToResolved', () => {
  it('derives secondary from supportResolved[0]', () => {
    const palette = { primary: '#22C55E', accent: '#1E40AF', background: '#0F172A', support: ['#3B82F6', '#FF6600'] };
    const result = intendedToResolved(palette, ['#B96F63']);
    expect(result).toEqual({
      primary: '#22C55E',
      secondary: '#B96F63',
      accent: '#1E40AF',
      background: '#0F172A',
    });
  });

  it('secondary falls back to primary when supportResolved is empty', () => {
    const palette = { primary: '#22C55E', accent: '#1E40AF', background: '#0F172A', support: [] };
    const result = intendedToResolved(palette, []);
    expect(result.secondary).toBe('#22C55E');
  });
});

describe('profiler palette resolution (mocked probe)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
});
