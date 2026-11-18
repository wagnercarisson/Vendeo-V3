/**
 * F60.7 — Classificação combinada da campanha conjunta.
 *
 * Compõe os dois contratos puros (formato e origem) sem duplicar a tabela de
 * resolução: a decisão é sempre derivada dos resolvedores dedicados.
 *
 * Sem I/O e sem dependência de runtime de servidor: nenhum cliente de banco,
 * framework de UI, processamento de imagem ou acesso a arquivos.
 */

import { CAMPAIGN_FORMAT_KEY, FORMAT_CONTRACT_VERSION_KEY } from "@/lib/campaign/format-resolution";
import {
  GENERATION_CONTRACT_VERSION_KEY,
  GENERATION_ORIGIN_KEY,
} from "@/lib/product-9-16-two-stage/orchestration/origin";

import { resolveTwoFormatContract } from "./format";
import { resolveTwoFormatOrigin } from "./origin";
import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_CONTRACT_VERSION,
  TWO_FORMAT_GENERATION_ORIGIN,
} from "./types";

export type TwoFormatCampaignClassification =
  | { readonly kind: "two_format" }
  | { readonly kind: "not_two_format" }
  | { readonly kind: "inconsistent"; readonly reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Um snapshot "indica" o par conjunto quando declara o valor conjunto de
 * formato ou uma das versões conjuntas. Serve apenas para distinguir
 * `not_two_format` de um par conjunto inválido — não reimplementa parsing.
 */
function hasJointIndication(inputSnapshot: unknown): boolean {
  if (!isRecord(inputSnapshot)) return false;

  return (
    inputSnapshot[CAMPAIGN_FORMAT_KEY] === TWO_FORMAT_CAMPAIGN_FORMAT ||
    inputSnapshot[FORMAT_CONTRACT_VERSION_KEY] === TWO_FORMAT_CONTRACT_VERSION ||
    inputSnapshot[GENERATION_ORIGIN_KEY] === TWO_FORMAT_GENERATION_ORIGIN ||
    inputSnapshot[GENERATION_CONTRACT_VERSION_KEY] ===
      TWO_FORMAT_GENERATION_CONTRACT_VERSION
  );
}

/**
 * Classifica um snapshot como campanha conjunta, inconsistente ou não conjunta.
 *
 * - formato E origem conjuntos com as duas versões ⇒ `two_format`;
 * - formato conjunto com origem ausente/divergente ⇒ `origin_not_two_format`;
 * - origem conjunta com formato não conjunto ⇒ `format_not_two_format`;
 * - par conjunto inválido (indício sem resolução) ⇒ `format_unavailable:<motivo>`;
 * - nenhum indício conjunto ⇒ `not_two_format`.
 */
export function classifyTwoFormatCampaign(
  inputSnapshot: unknown,
): TwoFormatCampaignClassification {
  const format = resolveTwoFormatContract(inputSnapshot);
  const origin = resolveTwoFormatOrigin(inputSnapshot);

  if (format.kind === "two_format") {
    if (origin.kind === "two_format_two_stage") {
      return Object.freeze({ kind: "two_format" as const });
    }
    return Object.freeze({
      kind: "inconsistent" as const,
      reason: "origin_not_two_format",
    });
  }

  if (origin.kind === "two_format_two_stage") {
    return Object.freeze({
      kind: "inconsistent" as const,
      reason: "format_not_two_format",
    });
  }

  if (format.kind === "unavailable" && hasJointIndication(inputSnapshot)) {
    return Object.freeze({
      kind: "inconsistent" as const,
      reason: `format_unavailable:${format.reason}`,
    });
  }

  return Object.freeze({ kind: "not_two_format" as const });
}
