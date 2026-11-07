/**
 * F59 — Contrato PURO de dimensões do Produto vertical 9:16.
 *
 * O provider (`openai.images.edit`) exige largura E altura divisíveis por 16.
 * `1152 = 72 × 16` e `2048 = 128 × 16` (proporção 9:16). `1080 × 1920` NÃO é
 * divisível por 16 em largura (1080 / 16 = 67,5) e por isso nunca é enviado ao
 * provider: a entrega é obtida por redução proporcional de 0,9375.
 *
 * Módulo puro: sem I/O, `server-only`, `sharp` ou Supabase.
 */

/** Tamanho solicitado ao provider (divisível por 16). */
export const PROVIDER_SIZE = "1152x2048" as const;

/** Largura do artefato entregue. */
export const DELIVERED_WIDTH = 1080 as const;

/** Altura do artefato entregue. */
export const DELIVERED_HEIGHT = 1920 as const;

/** Fator único de redução 1152 → 1080 e 2048 → 1920. */
export const DOWNSCALE_FACTOR = 0.9375 as const;

/** Motivos tipados de rejeição de dimensão do provider. */
export type ProviderDimensionError =
  | "provider_size_not_divisible_by_16"
  | "provider_aspect_mismatch"
  | "provider_size_unsupported";

/** Resultado TIPADO da checagem de dimensões (nunca lança). */
export type ProviderDimensionCheck =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: ProviderDimensionError };

/** Tamanho entregue calculado, com o fator único aplicado. */
export interface DeliveredSize {
  readonly width: typeof DELIVERED_WIDTH;
  readonly height: typeof DELIVERED_HEIGHT;
  readonly factor: typeof DOWNSCALE_FACTOR;
}

/**
 * Proporção 9:16 por MULTIPLICAÇÃO CRUZADA INTEIRA, sem divisão/float/tolerância.
 * `width / height === 9 / 16` ⇔ `width * 16 === height * 9`.
 */
export function hasEqualAspect(width: number, height: number): boolean {
  return width > 0 && height > 0 && width * 16 === height * 9;
}

/**
 * Valida a dimensão REAL devolvida pelo provider.
 *
 * Ordem explícita:
 * 1. divisibilidade por 16 (regra do SDK) — vence antes de qualquer proporção;
 * 2. proporção 9:16 por inteiros;
 * 3. tamanho exato suportado na v1 (`1152 × 2048`).
 */
export function assertProviderDimensions(
  width: number,
  height: number,
): ProviderDimensionCheck {
  if (width % 16 !== 0 || height % 16 !== 0) {
    return { ok: false, reason: "provider_size_not_divisible_by_16" };
  }
  if (!hasEqualAspect(width, height)) {
    return { ok: false, reason: "provider_aspect_mismatch" };
  }
  if (width !== 1152 || height !== 2048) {
    return { ok: false, reason: "provider_size_unsupported" };
  }
  return { ok: true };
}

/**
 * Dimensão entregue somente para a fonte exata `1152 × 2048`; qualquer outra
 * entrada ⇒ `null` (sem upscale, crop, pad ou distorção).
 */
export function deliveredSizeFor(
  width: number,
  height: number,
): DeliveredSize | null {
  if (width !== 1152 || height !== 2048) return null;
  return Object.freeze({
    width: DELIVERED_WIDTH,
    height: DELIVERED_HEIGHT,
    factor: DOWNSCALE_FACTOR,
  });
}
