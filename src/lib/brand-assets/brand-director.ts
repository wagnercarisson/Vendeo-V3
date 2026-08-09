import { PromptLoader } from '@/lib/image-generation/prompt-loader';
import type { BrandDirectorResult, ColorCluster, ColorProbeResult } from './types';
import { probeColors, deltaE, hexToLab, rgbToHex, findClosestProbeCluster, isLightNeutral, STRONG_MATCH_DELTA_E, ACCEPTABLE_MATCH_DELTA_E, LOOSE_MATCH_DELTA_E } from './color-probe';
import OpenAI from 'openai';
import type { AiCallInfo, TokenUsage } from '@/lib/ai-cost/types';

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

export class BrandDirectorService {
  private promptLoader = new PromptLoader();
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Mapeia o payload de usage do chat.completions (OpenAI) para TokenUsage
   * normalizado (D12). Defensivo contra drift de shape do SDK.
   */
  private mapChatUsage(usage: unknown): TokenUsage | undefined {
    if (!usage || typeof usage !== 'object') return undefined;
    const u = usage as Record<string, unknown>;
    const tokens: TokenUsage = {};
    if (typeof u.prompt_tokens === 'number') tokens.promptTokens = u.prompt_tokens;
    if (typeof u.completion_tokens === 'number') tokens.completionTokens = u.completion_tokens;
    if (typeof u.total_tokens === 'number') tokens.totalTokens = u.total_tokens;
    const promptDetails = u.prompt_tokens_details as Record<string, unknown> | undefined;
    if (promptDetails && typeof promptDetails.cached_tokens === 'number') {
      tokens.cachedInputTokens = promptDetails.cached_tokens;
    }
    const completionDetails = u.completion_tokens_details as Record<string, unknown> | undefined;
    if (completionDetails && typeof completionDetails.image_tokens === 'number') {
      tokens.imageTokens = completionDetails.image_tokens;
    }
    return tokens;
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
    /** F38.1 (D7/D11): callback best-effort com dados da chamada de visão (brand_profile_vision). Opcional — nunca bloqueia. */
    onCall?: (info: AiCallInfo) => void | Promise<void>;
  }): Promise<BrandDirectorResult> {
    const startTime = Date.now();

    // Step 1: Probe logo — structured color extraction
    const probe = await probeColors(params.logoBuffer);
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

      // F38.1 (D7/D11): telemetria best-effort da chamada de visão
      // (brand_profile_vision mapeado na rota). Nunca lança — a análise não é
      // bloqueada por telemetria (mesmo padrão do BrandProfiler callVision).
      try {
        await params.onCall?.({
          provider: 'openai',
          model,
          usage: this.mapChatUsage(response.usage),
          durationMs: elapsedMs,
        });
      } catch (err) {
        console.error(
          `[BrandDirector] onCall callback failed (best-effort): ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }

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
