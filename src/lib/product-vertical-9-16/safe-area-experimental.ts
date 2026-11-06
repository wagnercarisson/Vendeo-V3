/**
 * F59 — Política EXPERIMENTAL de bandas protegidas para composição vertical no
 * Instagram.
 *
 * Versão: `safe-area-9-16-experimental-v1`.
 *
 * Baseada em observação manual do responsável, NÃO em garantia oficial do
 * Instagram. Protege apenas:
 * - faixa superior de 15% da altura;
 * - faixa inferior de 20% da altura.
 *
 * Não há máscara lateral nem recorte específico no canto inferior direito. A
 * geometria de `safe-area-9-16-v1` permanece intacta e histórica; esta política
 * é usada pela nova versão do compositor para validação e sobreposições de
 * análise, não para o prompt artístico.
 *
 * Módulo puro: sem I/O, `server-only`, `sharp` ou Supabase.
 */

export const SAFE_AREA_9_16_EXPERIMENTAL_VERSION =
  "safe-area-9-16-experimental-v1" as const;

/** Percentuais experimentais das faixas protegidas. */
export const INSTAGRAM_PROTECTED_BANDS_PERCENT = Object.freeze({
  top: 15 as const,
  bottom: 20 as const,
});

export interface InstagramProtectedBands {
  readonly width: number;
  readonly height: number;
  readonly topPx: number;
  readonly bottomPx: number;
  /** Início da região verticalmente protegida. */
  readonly protectedYMin: number;
  /** Fim da região verticalmente protegida. */
  readonly protectedYMax: number;
  readonly isGenerationCanvas: boolean;
}

/**
 * Faixas para EXATAMENTE `1152 × 2048` (geração) ou `1080 × 1920` (entrega).
 * Qualquer outro canvas ⇒ `null` (fail-closed).
 */
export function instagramProtectedBandsForCanvas(
  width: number,
  height: number,
): InstagramProtectedBands | null {
  const isGeneration = width === 1152 && height === 2048;
  const isDelivery = width === 1080 && height === 1920;
  if (!isGeneration && !isDelivery) return null;

  const topPx = Math.round(
    (INSTAGRAM_PROTECTED_BANDS_PERCENT.top / 100) * height,
  );
  const bottomPx = Math.round(
    (INSTAGRAM_PROTECTED_BANDS_PERCENT.bottom / 100) * height,
  );

  return Object.freeze({
    width,
    height,
    topPx,
    bottomPx,
    protectedYMin: topPx,
    protectedYMax: height - bottomPx,
    isGenerationCanvas: isGeneration,
  });
}

/**
 * Versão seguinte da política experimental: protege SOMENTE a faixa inferior
 * de 20%. A faixa superior de 15% deixa de ser uma restrição de informação;
 * não há máscara lateral nem recorte de canto.
 *
 * `safe-area-9-16-experimental-v1` permanece histórica para campanhas anteriores.
 */
export const SAFE_AREA_9_16_BOTTOM_ONLY_VERSION =
  "safe-area-9-16-experimental-v2" as const;

/** Percentual experimental da faixa inferior protegida. */
export const INSTAGRAM_BOTTOM_BAND_PERCENT = Object.freeze({
  bottom: 20 as const,
});

export interface InstagramBottomBand {
  readonly width: number;
  readonly height: number;
  readonly bottomPx: number;
  /** Fim da região permitida para informações protegidas. */
  readonly protectedYMax: number;
  readonly isGenerationCanvas: boolean;
}

/**
 * Faixa inferior para EXATAMENTE `1152 × 2048` (geração) ou `1080 × 1920`
 * (entrega). Qualquer outro canvas ⇒ `null` (fail-closed).
 */
export function instagramBottomBandForCanvas(
  width: number,
  height: number,
): InstagramBottomBand | null {
  const isGeneration = width === 1152 && height === 2048;
  const isDelivery = width === 1080 && height === 1920;
  if (!isGeneration && !isDelivery) return null;

  const bottomPx = Math.round(
    (INSTAGRAM_BOTTOM_BAND_PERCENT.bottom / 100) * height,
  );

  return Object.freeze({
    width,
    height,
    bottomPx,
    protectedYMax: height - bottomPx,
    isGenerationCanvas: isGeneration,
  });
}
