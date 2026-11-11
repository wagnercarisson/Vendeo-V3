/**
 * F60.2 (quick 261111-idz) — Receita determinística 1024×1024 → 1152×1152.
 *
 * Módulo puro: sem `server-only`, `sharp`, Supabase, `node:crypto` ou I/O.
 * Todos os números derivam de `ROLE_POLICY` (F60.1); nenhuma dimensão, formato
 * ou MIME é repetido como literal solto.
 *
 * NÃO-GARANTIAS (declaradas, não prometidas):
 * - A saída JPEG NÃO é lossless e NÃO é pixel-idêntica à fonte. A qualidade 90
 *   com fator 1,125 é reamostragem com perda.
 * - A fidelidade garantida é de GEOMETRIA: canvas 1:1 preservado, sem crop, sem
 *   pad, sem barra e sem fundo; marcadores escalam por um único fator
 *   (9/8 = 1,125) dentro da tolerância do Lanczos3 + quantização JPEG.
 * - A reprodutibilidade byte-a-byte é garantida POR BUILD de libvips/Sharp: uma
 *   troca de versão pode gerar checksum diferente para a mesma fonte. Nesse
 *   caso a F60.1 responde `content_conflict` (fail-closed) sem sobrescrever.
 */

import { ROLE_POLICY } from "@/lib/campaign/composition-artifacts/role-policy";

const SOURCE_POLICY = ROLE_POLICY.square_original;
const TARGET_POLICY = ROLE_POLICY.square_prepared;

/** Fonte exigida: papel `square_original`, 1:1, JPEG 1024×1024. */
export const SQUARE_PREPARATION_SOURCE = Object.freeze({
  role: "square_original" as const,
  format: SOURCE_POLICY.format,
  width: SOURCE_POLICY.width,
  height: SOURCE_POLICY.height,
  mimeType: SOURCE_POLICY.mimeType,
});

/** Alvo: papel `square_prepared`, 1:1, JPEG 1152×1152. */
export const SQUARE_PREPARATION_TARGET = Object.freeze({
  role: "square_prepared" as const,
  format: TARGET_POLICY.format,
  width: TARGET_POLICY.width,
  height: TARGET_POLICY.height,
  mimeType: TARGET_POLICY.mimeType,
});

/** Origem F60.1 usada na persistência do derivado. */
export const SQUARE_PREPARATION_ORIGIN = "deterministic_preparation" as const;

/**
 * Receita fechada do pipeline. `scale` documenta o fator único exato:
 * 1024 × 9/8 = 1152 (1,125), idêntico nos dois eixos.
 */
export const SQUARE_PREPARATION_RECIPE = Object.freeze({
  fit: "fill" as const,
  kernel: "lanczos3" as const,
  colorspace: "srgb" as const,
  scale: Object.freeze({ numerator: 9, denominator: 8 }),
  jpeg: Object.freeze({
    quality: 90,
    chromaSubsampling: "4:4:4",
    progressive: false,
    optimiseCoding: false,
    mozjpeg: false,
  }),
});
