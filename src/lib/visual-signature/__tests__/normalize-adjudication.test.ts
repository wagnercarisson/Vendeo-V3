import { describe, it, expect } from 'vitest';
import { normalizeAdjudication, normalizeIntendedPalette, VisionAdjudicationError } from '../types';
import type { ColorCluster } from '@/lib/brand-assets/types';

function makeCluster(hex: string, classification: ColorCluster['classification'] = 'dominant'): ColorCluster {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return {
    hex,
    rgb: [r, g, b],
    lab: [50, 0, 0],
    frequency: 0.1,
    luminance: 0.3,
    saturation: 0.5,
    edgeRatio: 0.05,
    classification,
  };
}

const fallback = normalizeIntendedPalette({
  primary: '#22C55E',
  accent: '#1E40AF',
  background: '#0F172A',
  support: ['#3B82F6', '#FF6600'],
})!;

const nonArtifactClusters = [
  makeCluster('#22C55E'),
  makeCluster('#1E40AF'),
  makeCluster('#0F172A'),
  makeCluster('#3B82F6'),
  makeCluster('#FF6600'),
];

describe('normalizeAdjudication', () => {
  it('all keys present, non-contested null — passes, preserves intended', () => {
    const result = normalizeAdjudication(
      {
        corrections: { primary: null, accent: null, background: null, support: [] },
        reason: 'Tudo ok',
      },
      fallback,
      [],
      [],
      nonArtifactClusters
    );
    expect(result.palette).toEqual({
      primary: '#22C55E',
      accent: '#1E40AF',
      background: '#0F172A',
      support: ['#3B82F6', '#FF6600'],
    });
    expect(result.reason).toBe('Tudo ok');
  });

  it('contested role with null throws VisionAdjudicationError no_choice', () => {
    expect(() =>
      normalizeAdjudication(
        {
          corrections: { primary: null, accent: null, background: null, support: [] },
          reason: 'Não escolhi',
        },
        fallback,
        ['primary'],
        [],
        nonArtifactClusters
      )
    ).toThrow(VisionAdjudicationError);
  });

  it('confirmed role ignores vision correction — resolveRole returns fallback', () => {
    const result = normalizeAdjudication(
      {
        corrections: { primary: '#000000', accent: null, background: null, support: [] },
        reason: 'Test',
      },
      fallback,
      ['accent'], // only accent is contested, primary is not
      [],
      nonArtifactClusters
    );
    // Primary should remain from fallback since it's not contested
    expect(result.palette.primary).toBe('#22C55E');
  });

  it('invalid support index filtered — ignored, not failed', () => {
    const result = normalizeAdjudication(
      {
        corrections: { primary: null, accent: null, background: null, support: [{ index: 99, color: '#FF0000' }] },
        reason: 'Test',
      },
      fallback,
      [],
      [],
      nonArtifactClusters
    );
    expect(result.palette.support).toEqual(['#3B82F6', '#FF6600']);
  });

  it('missing correction for contested support index throws no_choice', () => {
    expect(() =>
      normalizeAdjudication(
        {
          corrections: { primary: null, accent: null, background: null, support: [] },
          reason: 'Test',
        },
        fallback,
        [],
        [1],
        nonArtifactClusters
      )
    ).toThrow(VisionAdjudicationError);
  });

  it('duplicate indices throws invalid_json', () => {
    expect(() =>
      normalizeAdjudication(
        {
          corrections: { primary: null, accent: null, background: null, support: [{ index: 0, color: '#FF0000' }, { index: 0, color: '#00FF00' }] },
          reason: 'Test',
        },
        fallback,
        [],
        [0],
        nonArtifactClusters
      )
    ).toThrow(VisionAdjudicationError);
  });

  it('HEX livre ∆E ≤ 18 accepted', () => {
    // #22C55E is in clusters, so this should pass
    const result = normalizeAdjudication(
      {
        corrections: { primary: '#22C55E', accent: null, background: null, support: [] },
        reason: 'Ok',
      },
      fallback,
      ['primary'],
      [],
      nonArtifactClusters
    );
    expect(result.palette.primary).toBe('#22C55E');
  });
});
