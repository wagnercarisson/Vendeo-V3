import sharp from 'sharp';
import type { ColorCluster, ColorProbeResult } from './types';

export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const clamped = Math.max(0, Math.min(255, Math.round(x)));
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  }).join('');
}

function srgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function linearToXyz(r: number, g: number, b: number): [number, number, number] {
  return [
    r * 0.4124564 + g * 0.3575761 + b * 0.1804375,
    r * 0.2126729 + g * 0.7151522 + b * 0.0721750,
    r * 0.0193339 + g * 0.1191920 + b * 0.9503041,
  ];
}

function xyzToLab(x: number, y: number, z: number): [number, number, number] {
  const refX = 0.95047, refY = 1, refZ = 1.08883;
  const fy = (t: number) => t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  const fx = fy(x / refX), fy2 = fy(y / refY), fz = fy(z / refZ);
  return [116 * fy2 - 16, 500 * (fx - fy2), 200 * (fy2 - fz)];
}

export function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

export function hexToLab(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [x, y, z] = linearToXyz(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return xyzToLab(x, y, z);
}

export function findClosestProbeCluster(hex: string, clusters: ColorCluster[]): { cluster: ColorCluster | null; deltaE: number } {
  const targetLab = hexToLab(hex);
  let best: ColorCluster | null = null;
  let bestDelta = Infinity;
  for (const c of clusters) {
    const d = deltaE(targetLab, c.lab);
    if (d < bestDelta) { bestDelta = d; best = c; }
  }
  return { cluster: best, deltaE: bestDelta };
}

export function isLightNeutral(hex: string): boolean {
  const lab = hexToLab(hex);
  const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
  return lab[0] > 75 && chroma < 20;
}

export const STRONG_MATCH_DELTA_E = 12;
export const ACCEPTABLE_MATCH_DELTA_E = 18;
export const LOOSE_MATCH_DELTA_E = 25;

export async function probeColors(buffer: Buffer): Promise<ColorProbeResult> {
  const emptyResult = (): ColorProbeResult => ({
    dominant_pixels: [], dark_ink_candidates: [], neutral_candidates: [],
    background_candidates: [], small_but_structural: [], suspected_transitions: [],
  });

  try {
    const { data, info } = await sharp(buffer)
      .resize(150, 150, { fit: 'cover' })
      .flatten({ background: '#FFFFFF' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const channels = info.channels ?? 3;
    const pixelCount = data.length / channels;
    const W = 150;
    const clusterMap = new Map<string, { count: number; edgeCount: number; sumR: number; sumG: number; sumB: number }>();

    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * channels];
      const g = data[i * channels + 1];
      const b = data[i * channels + 2];
      const key = `${Math.min(255, Math.round(r / 32) * 32)},${Math.min(255, Math.round(g / 32) * 32)},${Math.min(255, Math.round(b / 32) * 32)}`;
      const col = i % W;
      const row = Math.floor(i / W);
      const isEdge = row === 0 || row === W - 1 || col === 0 || col === W - 1;
      const entry = clusterMap.get(key);
      if (entry) {
        entry.count++; entry.sumR += r; entry.sumG += g; entry.sumB += b;
        if (isEdge) entry.edgeCount++;
      } else {
        clusterMap.set(key, { count: 1, edgeCount: isEdge ? 1 : 0, sumR: r, sumG: g, sumB: b });
      }
    }

    const totalPixels = pixelCount;
    type ProbeEntry = { hex: string; rgb: [number, number, number]; lab: [number, number, number]; frequency: number; luminance: number; saturation: number; classification: 'dominant'; edgeRatio: number };
    const allEntries: ProbeEntry[] = [...clusterMap.entries()]
      .map(([key, { count, edgeCount, sumR, sumG, sumB }]) => {
        const avgR = Math.round(sumR / count);
        const avgG = Math.round(sumG / count);
        const avgB = Math.round(sumB / count);
        const rgb: [number, number, number] = [avgR, avgG, avgB];
        const hex = rgbToHex(avgR, avgG, avgB);
        const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;
        const max = Math.max(avgR, avgG, avgB), min = Math.min(avgR, avgG, avgB);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return {
          hex, rgb, lab: hexToLab(hex), frequency: count / totalPixels,
          luminance, saturation, classification: 'dominant' as const,
          edgeRatio: edgeCount / count,
        };
      })
      .sort((a, b) => b.frequency - a.frequency);

    const merged: ProbeEntry[] = [];
    for (const c of allEntries) {
      const existing = merged.find(e => deltaE(c.lab, e.lab) <= 12);
      if (!existing) merged.push(c);
    }

    const interiorEntries = merged.filter(c => c.frequency >= 0.01);
    const bgByEdge = [...interiorEntries].sort((a, b) => b.edgeRatio - a.edgeRatio);
    const bgCandidate = bgByEdge.length > 0 ? bgByEdge[0] : (merged[0] ?? null);

    function isInterpolation(c: ProbeEntry, pal: ProbeEntry[]): boolean {
      const pairs = pal.filter(p => p.hex !== c.hex && p.frequency > c.frequency);
      for (const a of pairs) {
        for (const b of pairs) {
          if (a.hex === b.hex) continue;
          const midR = (a.rgb[0] + b.rgb[0]) / 2;
          const midG = (a.rgb[1] + b.rgb[1]) / 2;
          const midB = (a.rgb[2] + b.rgb[2]) / 2;
          const dr = c.rgb[0] - midR, dg = c.rgb[1] - midG, db = c.rgb[2] - midB;
          if (Math.sqrt(dr * dr + dg * dg + db * db) < 35) return true;
        }
      }
      return false;
    }

    const artifact: ProbeEntry[] = [];
    const dominant: ProbeEntry[] = [];
    const darkInk: ProbeEntry[] = [];
    const neutral: ProbeEntry[] = [];
    const background: ProbeEntry[] = [];
    const structural: ProbeEntry[] = [];
    const transitions: ProbeEntry[] = [];

    const bgLab = bgCandidate ? hexToLab(bgCandidate.hex) : null;

    for (const c of merged) {
      if (c.hex === bgCandidate?.hex) {
        if (c.saturation > 0.2) {
        } else {
          background.push(c); continue;
        }
      }

      if (c.luminance < 0.25) { darkInk.push(c); continue; }
      if (c.saturation < 0.1) {
        if (bgLab && c.frequency < 0.15 && deltaE(c.lab, bgLab) > 40) {
          structural.push(c); continue;
        }
        neutral.push(c); continue;
      }
      if (c.frequency < 0.03 && c.saturation > 0.3) { structural.push(c); continue; }

      const bgClose = bgLab && deltaE(c.lab, bgLab) <= ACCEPTABLE_MATCH_DELTA_E;
      if ((c.frequency < 0.005) || (c.frequency < 0.015 && isInterpolation(c, merged)) || (c.frequency < 0.02 && bgClose)) {
        artifact.push(c); continue;
      }

      if (c.frequency < 0.01) { transitions.push(c); continue; }

      dominant.push(c);
    }

    const toCluster = (e: ProbeEntry, cls: ColorCluster['classification']): ColorCluster => ({
      hex: e.hex, rgb: e.rgb, lab: e.lab, frequency: e.frequency,
      luminance: e.luminance, saturation: e.saturation, edgeRatio: e.edgeRatio, classification: cls,
    });

    return {
      dominant_pixels: dominant.map(e => toCluster(e, 'dominant')),
      dark_ink_candidates: darkInk.map(e => toCluster(e, 'dark_ink')),
      neutral_candidates: neutral.map(e => toCluster(e, 'neutral')),
      background_candidates: background.map(e => toCluster(e, 'background')),
      small_but_structural: structural.map(e => toCluster(e, 'structural')),
      suspected_transitions: [...transitions, ...artifact].map(e => toCluster(e, 'transition')),
    };
  } catch {
    return emptyResult();
  }
}
