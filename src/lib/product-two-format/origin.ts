/**
 * F60.7 — Resolução PURA do par origem/versão da campanha conjunta.
 *
 * O contrato conjunto de origem é reconhecido apenas pelo par EXATO
 * `generationOrigin: "two_format_two_stage"` +
 * `generationContractVersion: "f60.7-two-format-v1"`. Todo snapshot que não
 * declara o par conjunto é DELEGADO, sem reescrita, ao resolvedor existente
 * (`resolveCampaignGenerationOrigin`), preservando `9_16_two_stage`, histórico e
 * indeterminado exatamente como antes.
 *
 * Marcador incompleto ou malformado do par conjunto é `indeterminate` — nunca
 * `historical` (que autorizaria tratar a campanha conjunta como legada).
 *
 * Sem I/O e sem dependência de runtime de servidor: nenhum cliente de banco,
 * framework de UI, processamento de imagem ou acesso a arquivos.
 */

import {
  GENERATION_CONTRACT_VERSION,
  GENERATION_CONTRACT_VERSION_KEY,
  GENERATION_ORIGIN_KEY,
  resolveCampaignGenerationOrigin,
  type CampaignGenerationOrigin,
} from "@/lib/product-9-16-two-stage/orchestration/origin";

import {
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "./types";

/**
 * Resultado TOTAL da resolução de origem conjunta: o caso conjunto próprio ou o
 * union reutilizado do resolvedor existente para todo o resto.
 */
export type TwoFormatOriginResolution =
  | { readonly kind: "two_format_two_stage" }
  | CampaignGenerationOrigin;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function indeterminate(reason: string): TwoFormatOriginResolution {
  return Object.freeze({ kind: "indeterminate" as const, reason });
}

/**
 * Resolve o par origem/versão da campanha conjunta.
 *
 * Só interpreta `generationOrigin: "two_format_two_stage"` ou
 * `generationContractVersion: "f60.7-two-format-v1"`; todo o resto é delegado
 * sem reescrita ao resolvedor existente. Nunca lança.
 */
export function resolveTwoFormatOrigin(
  inputSnapshot: unknown,
): TwoFormatOriginResolution {
  if (!isRecord(inputSnapshot)) {
    return resolveCampaignGenerationOrigin(inputSnapshot);
  }

  const origin = inputSnapshot[GENERATION_ORIGIN_KEY];
  const version = inputSnapshot[GENERATION_CONTRACT_VERSION_KEY];

  const isJointOrigin = origin === TWO_FORMAT_GENERATION_ORIGIN;
  const isJointVersion = version === TWO_FORMAT_GENERATION_CONTRACT_VERSION;

  if (!isJointOrigin && !isJointVersion) {
    return resolveCampaignGenerationOrigin(inputSnapshot);
  }

  // Metade ausente do par conjunto (inclui versão conjunta sem origem).
  if (origin === undefined || version === undefined) {
    return indeterminate("incomplete_origin_pair");
  }

  if (origin === null || origin === "" || typeof origin !== "string") {
    return indeterminate("malformed_origin");
  }

  if (version === null || version === "" || typeof version !== "string") {
    return indeterminate("incomplete_origin_pair");
  }

  // Versão conjunta acoplada a outra origem conhecida/desconhecida.
  if (!isJointOrigin) {
    return indeterminate("incoherent_origin_pair");
  }

  if (version === TWO_FORMAT_GENERATION_CONTRACT_VERSION) {
    return Object.freeze({ kind: "two_format_two_stage" as const });
  }

  if (version === GENERATION_CONTRACT_VERSION) {
    return indeterminate("incoherent_origin_pair");
  }

  return indeterminate("unsupported_version");
}
