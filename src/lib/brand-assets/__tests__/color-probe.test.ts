import { describe, it, expect, beforeAll } from 'vitest';
import sharp from 'sharp';
import { probeColors, findClosestProbeCluster, hexToLab, deltaE } from '../color-probe';
import type { ColorCluster, ColorProbeResult } from '../types';

function classifyDeltaE(de: number): 'confirmed' | 'ambiguous' | 'not_confirmed' {
  if (de <= 18) return 'confirmed';
  if (de <= 25) return 'ambiguous';
  return 'not_confirmed';
}

async function createSolidPng(r: number, g: number, b: number, size = 50): Promise<Buffer> {
  return sharp({
    create: { width: size, height: size, channels: 3, background: { r, g, b } },
  }).png().toBuffer();
}

async function createGradientPng(width = 100, height = 100): Promise<Buffer> {
  const pixels = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      pixels[i] = Math.round((x / width) * 220 + 18);
      pixels[i + 1] = Math.round((y / height) * 200 + 28);
      pixels[i + 2] = Math.round(128);
    }
  }
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

const B96F63_RGB: [number, number, number] = [185, 111, 99];

describe('color-prote — probeColors', () => {
  let solidBuffer: Buffer;
  let gradientBuffer: Buffer;

  beforeAll(async () => {
    solidBuffer = await createSolidPng(...B96F63_RGB);
    gradientBuffer = await createGradientPng();
  });

  it('8.1 solid #B96F63 PNG → findClosestProbeCluster returns ∆E <= 18 (confirmed)', async () => {
    const result = await probeColors(solidBuffer);
    const allClusters = getAllClusters(result);
    expect(allClusters.length).toBeGreaterThan(0);

    const match = findClosestProbeCluster('#B96F63', allClusters);
    expect(match.cluster).not.toBeNull();
    const presence = classifyDeltaE(match.deltaE);
    expect(presence).toBe('confirmed');
  });

  it('8.2 solid #B96F63 PNG → findClosestProbeCluster("#B96F50") ∆E <= 18 (confirmed)', async () => {
    const result = await probeColors(solidBuffer);
    const allClusters = getAllClusters(result);
    expect(allClusters.length).toBeGreaterThan(0);

    const match = findClosestProbeCluster('#B96F50', allClusters);
    expect(match.cluster).not.toBeNull();
    const presence = classifyDeltaE(match.deltaE);
    expect(presence).toBe('confirmed');
  });

  it('8.3 solid #B96F63 PNG → findClosestProbeCluster("#FF0000") ∆E > 25 (not_confirmed)', async () => {
    const result = await probeColors(solidBuffer);
    const allClusters = getAllClusters(result);
    expect(allClusters.length).toBeGreaterThan(0);

    const match = findClosestProbeCluster('#FF0000', allClusters);
    const presence = classifyDeltaE(match.deltaE);
    expect(presence).toBe('not_confirmed');
  });

  it('8.4 gradient PNG → findClosestProbeCluster for existing and non-existing colors', async () => {
    const result = await probeColors(gradientBuffer);
    const allClusters = getAllClusters(result);
    expect(allClusters.length).toBeGreaterThan(0);

    const existing = findClosestProbeCluster('#505080', allClusters);
    expect(existing.cluster).not.toBeNull();

    const nonExisting = findClosestProbeCluster('#00FF00', allClusters);
    expect(classifyDeltaE(nonExisting.deltaE)).toBe('not_confirmed');
  });

  it('8.5 corrupted buffer → returns empty result (graceful error)', async () => {
    const corrupted = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const result = await probeColors(corrupted);
    expect(result.dominant_pixels).toEqual([]);
    expect(result.dark_ink_candidates).toEqual([]);
    expect(result.background_candidates).toEqual([]);
    expect(result.neutral_candidates).toEqual([]);
    expect(result.small_but_structural).toEqual([]);
    expect(result.suspected_transitions).toEqual([]);
  });
});

describe('color-prote — hexToLab / deltaE', () => {
  it('deltaE of identical color is ~0', () => {
    const lab = hexToLab('#B96F63');
    const d = deltaE(lab, lab);
    expect(d).toBeLessThan(0.001);
  });

  it('deltaE of very close colors is small', () => {
    const lab1 = hexToLab('#B96F63');
    const lab2 = hexToLab('#B96F50');
    const d = deltaE(lab1, lab2);
    expect(d).toBeLessThan(18);
  });

  it('deltaE of very different colors is large', () => {
    const lab1 = hexToLab('#B96F63');
    const lab2 = hexToLab('#FF0000');
    const d = deltaE(lab1, lab2);
    expect(d).toBeGreaterThan(25);
  });
});

describe('color-prote — edgeRatio preserved in clusters', () => {
  it('every cluster has edgeRatio field', async () => {
    const buffer = await createSolidPng(100, 100, 100);
    const result = await probeColors(buffer);
    const allClusters = getAllClusters(result);
    for (const c of allClusters) {
      expect(c).toHaveProperty('edgeRatio');
      expect(typeof c.edgeRatio).toBe('number');
      expect(c.edgeRatio).toBeGreaterThanOrEqual(0);
      expect(c.edgeRatio).toBeLessThanOrEqual(1);
    }
  });
});

describe('8.6 — brand-director imports regression', () => {
  it('color-prote exports all expected symbols', async () => {
    const cp = await import('../color-probe');
    expect(typeof cp.probeColors).toBe('function');
    expect(typeof cp.findClosestProbeCluster).toBe('function');
    expect(typeof cp.deltaE).toBe('function');
    expect(typeof cp.hexToLab).toBe('function');
    expect(typeof cp.rgbToHex).toBe('function');
    expect(typeof cp.isLightNeutral).toBe('function');
    expect(cp.STRONG_MATCH_DELTA_E).toBe(12);
    expect(cp.ACCEPTABLE_MATCH_DELTA_E).toBe(18);
    expect(cp.LOOSE_MATCH_DELTA_E).toBe(25);
  });

  it('brand-director imports from color-probe', async () => {
    const bd = await import('@/lib/brand-assets/brand-director');
    expect(bd.BrandDirectorService).toBeDefined();
    expect(bd.BrandDirectorAnalysisError).toBeDefined();
    expect(typeof bd.BrandDirectorService).toBe('function');
  });
});

describe('8.7 — BrandDirector deterministic regression', () => {
  it('probe + deterministic logic produces expected structure', async () => {
    const buffer = await createSolidPng(60, 120, 180, 30);
    const result = await probeColors(buffer);
    const allClusters = getAllClusters(result);

    const dominant = result.dominant_pixels;
    expect(dominant.length).toBeGreaterThan(0);
    for (const c of dominant) {
      expect(c.classification).toBe('dominant');
    }

    const bgCandidates = result.background_candidates;
    for (const c of bgCandidates) {
      expect(c.classification).toBe('background');
    }

    const firstDominant = dominant[0];
    expect(firstDominant).toBeDefined();
    expect(typeof firstDominant.hex).toBe('string');
    expect(firstDominant.hex).toMatch(/^#[0-9A-F]{6}$/);
  });
});

function getAllClusters(result: ColorProbeResult): ColorCluster[] {
  return [
    ...result.dominant_pixels,
    ...result.dark_ink_candidates,
    ...result.neutral_candidates,
    ...result.background_candidates,
    ...result.small_but_structural,
    ...result.suspected_transitions,
  ];
}
