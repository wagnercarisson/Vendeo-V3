import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { BrandDirectorResult, ColorCluster, ColorProbeResult } from './types';
import OpenAI from 'openai';
import sharp from 'sharp';

export interface DeterministicColorResult {
  logo_colors_detected: string[];
  safe_color_tokens: { primary: string; secondary: string; accent: string; background: string };
  inferred_primary_color: string;
  inferred_accent_color: string;
}

export class BrandDirectorAnalysisError extends Error {
  public readonly metadata: { provider: string; model: string; elapsedMs: number; errorType: string };
  public readonly deterministicResult: DeterministicColorResult | null;
  constructor(
    message: string,
    metadata: { provider: string; model: string; elapsedMs: number; errorType: string },
    deterministicResult?: DeterministicColorResult | null,
  ) {
    super(message);
    this.name = 'BrandDirectorAnalysisError';
    this.metadata = metadata;
    this.deterministicResult = deterministicResult ?? null;
  }
}

export interface StoreAnalysisInput {
  storeName: string;
  segment: string;
  subsegment?: string;
  city?: string;
  state?: string;
  tone_of_voice?: string;
  positioning?: string;
  short_description?: string;
  slogan?: string;
  userPrimaryColor?: string;
  userAccentColor?: string;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const clamped = Math.max(0, Math.min(255, Math.round(x)));
    return clamped.toString(16).padStart(2, '0').toUpperCase();
  }).join('');
}

// CIE76 color distance
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

function deltaE(lab1: [number, number, number], lab2: [number, number, number]): number {
  const dL = lab1[0] - lab2[0];
  const da = lab1[1] - lab2[1];
  const db = lab1[2] - lab2[2];
  return Math.sqrt(dL * dL + da * da + db * db);
}

function hexToLab(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const [x, y, z] = linearToXyz(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  return xyzToLab(x, y, z);
}

function findClosestProbeCluster(hex: string, clusters: ColorCluster[]): { cluster: ColorCluster | null; deltaE: number } {
  const targetLab = hexToLab(hex);
  let best: ColorCluster | null = null;
  let bestDelta = Infinity;
  for (const c of clusters) {
    const d = deltaE(targetLab, c.lab);
    if (d < bestDelta) { bestDelta = d; best = c; }
  }
  return { cluster: best, deltaE: bestDelta };
}

function isLightNeutral(hex: string): boolean {
  const lab = hexToLab(hex);
  const chroma = Math.sqrt(lab[1] * lab[1] + lab[2] * lab[2]);
  return lab[0] > 75 && chroma < 20;
}

const STRONG_MATCH_DELTA_E = 12;
const ACCEPTABLE_MATCH_DELTA_E = 18;
const LOOSE_MATCH_DELTA_E = 25;

export class BrandDirectorService {
  private promptLoader = new PromptLoader();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  private async probeColors(buffer: Buffer): Promise<ColorProbeResult> {
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
      // Track sums for average hex computation (avoid quantized bucket as final color)
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

      // Consolidation: merge clusters within ∆E ≤ 12, keep highest frequency
      const merged: ProbeEntry[] = [];
      for (const c of allEntries) {
        const existing = merged.find(e => deltaE(c.lab, e.lab) <= 12);
        if (!existing) merged.push(c);
      }

      // Background detection: cluster with highest edge ratio + significant interior presence
      const interiorEntries = merged.filter(c => c.frequency >= 0.01);
      const bgByEdge = [...interiorEntries].sort((a, b) => b.edgeRatio - a.edgeRatio);
      const bgCandidate = bgByEdge.length > 0 ? bgByEdge[0] : (merged[0] ?? null);

      // Artifact detection helpers
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
        // Background candidate: neutral or chromatic/brand_field
        if (c.hex === bgCandidate?.hex) {
          if (c.saturation > 0.2) {
            // Chromatic background = brand field → classify normally (not background)
          } else {
            // Neutral background (white/off-white/gray) → push to background
            background.push(c); continue;
          }
        }

        if (c.luminance < 0.25) { darkInk.push(c); continue; }
        if (c.saturation < 0.1) {
          // Light-on-dark structural: high contrast from background + small area
          if (bgLab && c.frequency < 0.15 && deltaE(c.lab, bgLab) > 40) {
            structural.push(c); continue;
          }
          neutral.push(c); continue;
        }
        if (c.frequency < 0.03 && c.saturation > 0.3) { structural.push(c); continue; }

        // Artifact detection: very small, or interpolation, or close to background
        const bgClose = bgLab && deltaE(c.lab, bgLab) <= ACCEPTABLE_MATCH_DELTA_E;
        if ((c.frequency < 0.005) || (c.frequency < 0.015 && isInterpolation(c, merged)) || (c.frequency < 0.02 && bgClose)) {
          artifact.push(c); continue;
        }

        if (c.frequency < 0.01) { transitions.push(c); continue; }

        dominant.push(c);
      }

      const toCluster = (e: ProbeEntry, cls: ColorCluster['classification']): ColorCluster => ({
        hex: e.hex, rgb: e.rgb, lab: e.lab, frequency: e.frequency,
        luminance: e.luminance, saturation: e.saturation, classification: cls,
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

  private buildProbeContext(probe: ColorProbeResult, curated: { primary: string; accent: string; background: string }): string {
    const lines: string[] = ['## Análise Técnica da Imagem (extração por pixels)', ''];

    // Brand palette — colors that represent the brand identity
    const brandColors = [
      ...probe.dominant_pixels,
      ...probe.small_but_structural,
      ...probe.dark_ink_candidates,
    ];
    const seen = new Set<string>();
    const brandDeduped = brandColors.filter(c => {
      if (seen.has(c.hex)) return false;
      seen.add(c.hex);
      return true;
    });
    if (brandDeduped.length > 0) {
      lines.push('### Paleta da Marca (evidência factual da identidade)');
      lines.push('Use estas cores como referência para as cores do logotipo.');
      for (const c of brandDeduped) {
        const tags: string[] = [];
        if (c.classification === 'structural') tags.push('alto impacto visual');
        if (c.classification === 'dark_ink') tags.push('texto/traço');
        const tagStr = tags.length > 0 ? ` — ${tags.join(', ')}` : '';
        lines.push(`- ${c.hex} — frequência ${(c.frequency * 100).toFixed(1)}%, saturação ${c.saturation.toFixed(2)}${tagStr}`);
      }
      lines.push('');
    }

    // Tokens funcionais sugeridos pelo backend (referência inicial, revise contra a imagem)
    lines.push('### Tokens Funcionais (sugestão operacional)');
    lines.push(`- **primary:** ${curated.primary} — sugestão do backend. Revise semanticamente contra a imagem; se o logo indicar uma cor de marca mais forte, desconsidere.`);
    lines.push(`- **accent:** ${curated.accent} — sugestão operacional. Pode ser uma cor funcional, não necessariamente extraída do logotipo.`);
    lines.push(`- **background:** ${curated.background} — sugestão de fundo para campanhas.`);
    lines.push('');

    // Background/Neutral — must be ignored for brand identity
    const bgNeutral = [
      ...probe.background_candidates,
      ...probe.neutral_candidates,
    ];
    if (bgNeutral.length > 0) {
      lines.push('### ⚠️ Cores de Fundo / Neutras (IGNORE para identidade visual)');
      lines.push('Estas cores são fundo, iluminação ou neutros do logotipo. Não as use como cor de marca, não as inclua em logo_colors_detected, não as use como acento e não as transforme em identidade visual.');
      for (const c of bgNeutral) {
        lines.push(`- ${c.hex} — frequência ${(c.frequency * 100).toFixed(1)}%`);
      }
      lines.push('');
    }

    // Artifact palette — transitions, shadows, antialiasing
    if (probe.suspected_transitions.length > 0) {
      lines.push('### ⚠️ Bordas / Sombras / Antialias (IGNORE)');
      lines.push('Estas cores são artefatos de renderização, bordas suavizadas ou sombras. Não as use como cor de marca, não as inclua em logo_colors_detected e não as mencione em diretrizes de campanha.');
      for (const c of probe.suspected_transitions) {
        lines.push(`- ${c.hex} — frequência ${(c.frequency * 100).toFixed(1)}%`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  private curateLogoColors(probe: ColorProbeResult): {
    logo_colors_detected: string[];
    primary: string;
    accent: string;
    background: string;
  } {
    const meaningful = [
      ...probe.dominant_pixels,
      ...probe.small_but_structural,
      ...probe.dark_ink_candidates,
    ];
    const seen = new Set<string>();
    const deduped = meaningful.filter(c => {
      if (seen.has(c.hex)) return false;
      seen.add(c.hex);
      return true;
    });

    const bgHex = probe.background_candidates.length > 0
      ? probe.background_candidates[0].hex
      : '#FFFFFF';
    const bgLab = hexToLab(bgHex);

    // Gap 3: remove colors too close to background (∆E ≤ 15)
    const nonBg = deduped.filter(c => {
      if (c.hex === bgHex) return false;
      return deltaE(c.lab, bgLab) > 15;
    });

    // Gap 4: filter light/neutral, EXCEPT if structural on dark bg
    const nonLight = nonBg.filter(c => {
      if (!isLightNeutral(c.hex)) return true;
      if ((c.classification === 'structural' || c.classification === 'dark_ink') && deltaE(c.lab, bgLab) > 40) return true;
      return false;
    });

    const logoColors = nonLight.slice(0, 4).map(c => c.hex);

    // Gap 5: prefer structural/dark_ink for primary, then saturated, then dark
    const best = nonLight.find(c => c.saturation > 0.15 && (c.classification === 'dark_ink' || c.classification === 'structural'))
      || nonLight.find(c => c.saturation > 0.15)
      || nonLight.find(c => c.luminance < 0.5)
      || nonLight[0];
    const primary = best?.hex ?? '#000000';

    // Accent: second non-bg, non-light, non-primary; fallback to primary
    const accent = nonLight.filter(c => c.hex !== primary)[0]?.hex ?? primary;

    return { logo_colors_detected: logoColors, primary, accent, background: bgHex };
  }

  private applyGuardrail(
    raw: Record<string, unknown>,
    probe: ColorProbeResult,
    deterministicResult: DeterministicColorResult,
  ): { result: BrandDirectorResult; warnings: string[]; scorePenalty: number } {
    const warnings: string[] = [];
    let scorePenalty = 0;
    const allClusters = [
      ...probe.dominant_pixels, ...probe.dark_ink_candidates,
      ...probe.neutral_candidates, ...probe.background_candidates,
      ...probe.small_but_structural, ...probe.suspected_transitions,
    ];

    const validRelevantClusters = [
      ...probe.dominant_pixels, ...probe.small_but_structural,
      ...probe.dark_ink_candidates,
    ];

    const validateOne = (hex: string | undefined, label: string, strict: boolean, allowStructuralFallback: boolean): string => {
      if (!hex) {
        warnings.push(`${label}: GPT não retornou valor`);
        scorePenalty += 0.1;
        return strict ? deterministicResult.inferred_primary_color : deterministicResult.inferred_accent_color;
      }
      const match = findClosestProbeCluster(hex, strict ? validRelevantClusters : allClusters);
      if (!match.cluster) {
        warnings.push(`${label} (${hex}): sem cluster correspondente — fallback para sharp`);
        scorePenalty += 0.1;
        return strict ? deterministicResult.inferred_primary_color : deterministicResult.inferred_accent_color;
      }
      if (match.deltaE <= STRONG_MATCH_DELTA_E) {
        return hex;
      }
      if (match.deltaE <= ACCEPTABLE_MATCH_DELTA_E) {
        warnings.push(`${label} (${hex}): ∆E ${match.deltaE.toFixed(1)} — match aceitável, confidence reduzido`);
        scorePenalty += 0.05;
        return hex;
      }
      if (match.deltaE <= LOOSE_MATCH_DELTA_E && allowStructuralFallback && match.cluster.classification === 'structural') {
        warnings.push(`${label} (${hex}): ∆E ${match.deltaE.toFixed(1)} — match estrutural, mantido`);
        scorePenalty += 0.05;
        return hex;
      }
      warnings.push(`${label} (${hex}): ∆E ${match.deltaE.toFixed(1)} — distante demais, substituído por ${match.cluster.hex}`);
      scorePenalty += 0.15;
      return match.cluster.hex;
    };

    const rawTokens = raw.safe_color_tokens as Record<string, unknown> | undefined;
    const primary = validateOne(
      String(raw.inferred_primary_color || rawTokens?.primary || ''),
      'inferred_primary_color', true, false,
    );
    let accent = validateOne(
      String(raw.inferred_accent_color || rawTokens?.accent || ''),
      'inferred_accent_color', false, true,
    );
    // Accent guard: light/neutral colors can't be accent
    if (accent && isLightNeutral(accent)) {
      warnings.push(`accent (${accent}): cor clara/neutra, substituída por primary (${primary})`);
      scorePenalty += 0.1;
      accent = primary;
    }

    // logo_colors_detected: GPT colors, validated only against curated brand clusters
    const gptDetected: string[] = Array.isArray(raw.logo_colors_detected)
      ? raw.logo_colors_detected.filter(Boolean).map(String)
      : [];
    const validatedDetected: string[] = [];
    const warningsSeen = new Set<string>();
    for (const hex of gptDetected) {
      const m = findClosestProbeCluster(hex, validRelevantClusters);
      if (m.cluster && m.deltaE <= ACCEPTABLE_MATCH_DELTA_E) {
        validatedDetected.push(hex);
      } else {
        const w = `logo_colors_detected: ${hex} descartado (∆E ${m.deltaE.toFixed(1)})`;
        if (!warningsSeen.has(w)) { warnings.push(w); warningsSeen.add(w); }
      }
    }
    // Fallback only to curated deterministic palette, never to raw probe palette
    const detected = validatedDetected.length > 0
      ? validatedDetected
      : deterministicResult.logo_colors_detected;

    // safe_color_tokens from GPT, with guardrail on primary/accent
    const gptPrimary = String(rawTokens?.primary ?? '');
    const gptAccent = String(rawTokens?.accent ?? '');
    // Guard: even if GPT's accent passes delta-E checks, reject if light/neutral
    const safeAccent = (!gptAccent || isLightNeutral(gptAccent))
      ? accent
      : (findClosestProbeCluster(gptAccent, allClusters).deltaE <= LOOSE_MATCH_DELTA_E
          ? gptAccent : accent);
    const safeTokens: Record<string, string> = {
      primary: gptPrimary && findClosestProbeCluster(gptPrimary, validRelevantClusters).deltaE <= LOOSE_MATCH_DELTA_E
        ? gptPrimary : primary,
      secondary: String(rawTokens?.secondary ?? deterministicResult.safe_color_tokens.secondary),
      accent: safeAccent,
      background: String(rawTokens?.background ?? deterministicResult.safe_color_tokens.background),
    };

    const result: BrandDirectorResult = {
      logo_colors_detected: detected,
      safe_color_tokens: safeTokens,
      visual_style: String(raw.visual_style ?? ''),
      visual_tone: String(raw.visual_tone ?? ''),
      typography_direction: String(raw.typography_direction ?? ''),
      brand_personality: String(raw.brand_personality ?? ''),
      campaign_guidelines: String(raw.campaign_guidelines ?? ''),
      campaign_brief: String(raw.campaign_brief ?? ''),
      inferred_primary_color: primary,
      inferred_accent_color: accent,
      confidence_score: typeof raw.confidence_score === 'number'
        ? Math.max(0, Math.min(1, raw.confidence_score - scorePenalty))
        : 0.5 - scorePenalty,
      campaign_accent_suggestion: raw.campaign_accent_suggestion
        ? String(raw.campaign_accent_suggestion)
        : undefined,
    };

    return { result, warnings, scorePenalty };
  }

  async analyze(params: {
    logoBuffer: Buffer;
    logoMimeType: string;
    storeData: StoreAnalysisInput;
  }): Promise<BrandDirectorResult> {
    const startTime = Date.now();

    // Step 1: Probe logo — structured color extraction
    const probe = await this.probeColors(params.logoBuffer);
    const allClusters = [
      ...probe.dominant_pixels, ...probe.dark_ink_candidates,
      ...probe.neutral_candidates, ...probe.background_candidates,
      ...probe.small_but_structural, ...probe.suspected_transitions,
    ];

    // Step 2: Curate factual colors from probe (Sharp measures, curation decides)
    const curated = this.curateLogoColors(probe);
    const deterministicResult: DeterministicColorResult = {
      logo_colors_detected: curated.logo_colors_detected.length > 0
        ? curated.logo_colors_detected
        : [],
      safe_color_tokens: {
        primary: curated.primary,
        secondary: '#666666',
        accent: curated.accent,
        background: curated.background,
      },
      inferred_primary_color: curated.primary,
      inferred_accent_color: curated.accent,
    };

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === 'production') {
        throw new BrandDirectorAnalysisError('OPENAI_API_KEY não configurada', {
          provider: 'openai',
          model: process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o',
          elapsedMs: 0,
          errorType: 'missing_api_key',
        });
      }

      return {
        logo_colors_detected: deterministicResult.logo_colors_detected.length > 0
          ? deterministicResult.logo_colors_detected
          : ['#CC0000', '#000000'],
        safe_color_tokens: deterministicResult.safe_color_tokens,
        visual_style: 'mock — desenvolvimento',
        visual_tone: 'mock — desenvolvimento',
        typography_direction: 'mock — desenvolvimento',
        brand_personality: 'mock — desenvolvimento',
        campaign_guidelines: 'mock — desenvolvimento',
        campaign_brief: 'mock — desenvolvimento',
        inferred_primary_color: curated.primary,
        inferred_accent_color: curated.accent,
        confidence_score: 0.1,
      };
    }

    const model = process.env.OPENAI_BRAND_DIRECTOR_MODEL ?? 'gpt-4o';

    console.log(`[BrandDirector] logo analysis start: model=${model}, mimeType=${params.logoMimeType}, bufferSize=${params.logoBuffer.length} bytes, store=${params.storeData.storeName}`);

    try {
      // Step 3: Build user colors section
      let userColorsSection = '';
      if (params.storeData.userPrimaryColor || params.storeData.userAccentColor) {
        userColorsSection = [
          '## Preferência de Cores do Lojista',
          '',
          'O lojista escolheu manualmente as seguintes cores. Considere como SINAL DE PREFERÊNCIA, não como regra obrigatória — você pode adotar, ajustar ou descartar conforme seu julgamento profissional:',
          '',
          ...(params.storeData.userPrimaryColor
            ? [`- **Cor primária escolhida:** ${params.storeData.userPrimaryColor}`]
            : []),
          ...(params.storeData.userAccentColor
            ? [`- **Cor de destaque escolhida:** ${params.storeData.userAccentColor}`]
            : []),
          '',
          'Instrução: avalie se as cores escolhidas são adequadas para o segmento e perfil da loja. Se forem apropriadas, incorpore-as. Se não forem ideais, sugira alternativas melhores no mesmo espectro.',
        ].join('\n');
      }

      // Step 4: Build technical context from probe + curated tokens
      const technicalSection = this.buildProbeContext(probe, curated);

      // Step 5: Load prompt with store data + user colors
      const prompt = this.promptLoader.load('store-brand-director-with-logo', {
        storeName: params.storeData.storeName,
        segment: params.storeData.segment,
        subsegment: params.storeData.subsegment ?? '',
        city: params.storeData.city ?? '',
        state: params.storeData.state ?? '',
        tone_of_voice: params.storeData.tone_of_voice ?? '',
        positioning: params.storeData.positioning ?? '',
        short_description: params.storeData.short_description ?? '',
        slogan: params.storeData.slogan ?? '',
        userColorsSection,
      });

      const base64Image = params.logoBuffer.toString('base64');
      const imageDataUrl = `data:${params.logoMimeType};base64,${base64Image}`;

      console.log(`[BrandDirector] calling OpenAI vision: model=${model}, detail=low, maxTokens=3000, dataUrlLength=${imageDataUrl.length}`);

      const response = await this.openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: prompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Analise o logotipo desta loja e gere o perfil de marca completo em JSON.\n\n${technicalSection}` },
              { type: 'image_url', image_url: { url: imageDataUrl, detail: 'low' } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        max_tokens: 3000,
      });

      const elapsedMs = Date.now() - startTime;
      const rawContent = response.choices[0]?.message?.content ?? '{}';
      const raw = JSON.parse(rawContent);

      const CRITICAL_FIELDS = ['visual_style', 'visual_tone', 'brand_personality', 'campaign_guidelines'] as const;
      const emptyFields = CRITICAL_FIELDS.filter(f => !raw[f] || !String(raw[f]).trim());

      console.log(`[BrandDirector] OpenAI vision response: success=true, elapsed=${elapsedMs}ms, emptyFields=${emptyFields.length > 0 ? `[${emptyFields.join(', ')}]` : 'none'}, rawKeys=${Object.keys(raw).join(',')}`);

      if (emptyFields.length > 0) {
        const errorMsg = `GPT returned incomplete JSON: empty fields [${emptyFields.join(', ')}]. Raw keys: ${Object.keys(raw).join(',')}`;
        console.error(`[BrandDirector] ${errorMsg}. Full raw: ${JSON.stringify(raw).slice(0, 500)}`);
        throw new BrandDirectorAnalysisError(
          errorMsg,
          { provider: 'openai', model, elapsedMs, errorType: 'incomplete_response' },
          deterministicResult,
        );
      }

      // Step 6: Guardrail — validate GPT output against probe data
      const { result } = this.applyGuardrail(raw, probe, deterministicResult);

      console.log(`[BrandDirector] result built: primary=${result.inferred_primary_color}, accent=${result.inferred_accent_color}, detected=[${result.logo_colors_detected.join(',')}], confidence=${result.confidence_score}`);

      return result;
    } catch (err) {
      const elapsedMs = Date.now() - startTime;

      if (err instanceof BrandDirectorAnalysisError) {
        console.error(`[BrandDirector] analysis failed: type=${err.metadata.errorType}, elapsed=${elapsedMs}ms, msg=${err.message}`);
        throw err;
      }

      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[BrandDirector] unexpected error: elapsed=${elapsedMs}ms, msg=${errorMessage}`);

      throw new BrandDirectorAnalysisError(
        errorMessage,
        { provider: 'openai', model, elapsedMs, errorType: 'api_error' },
        deterministicResult,
      );
    }
  }
}
