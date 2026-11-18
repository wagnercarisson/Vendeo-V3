/**
 * F60.7 — Resolução PURA do par formato/versão da campanha conjunta.
 *
 * Regra central: o contrato conjunto é reconhecido apenas pelo par EXATO
 * `campaignFormat: "1:1+9:16"` + `formatContractVersion: "f60.7-two-format-v1"`.
 * Todo snapshot que não declara o par conjunto é DELEGADO, sem reescrita, ao
 * resolvedor existente (`resolveCampaignFormat`), preservando byte a byte o
 * comportamento de `1:1`, `9:16` individual e histórico.
 *
 * Fail-closed: par conjunto malformado, incompleto, desconhecido ou incoerente
 * resolve para `unavailable` — NUNCA há fallback para `1:1`, e uma LISTA de
 * formatos nunca é lida como contrato.
 *
 * Sem I/O e sem dependência de runtime de servidor: nenhum cliente de banco,
 * framework de UI, processamento de imagem ou acesso a arquivos.
 */

import {
  CAMPAIGN_FORMAT_KEY,
  FORMAT_CONTRACT_VERSION,
  FORMAT_CONTRACT_VERSION_KEY,
  resolveCampaignFormat,
  type CampaignFormatResolution,
  type CampaignFormatUnavailableReason,
} from "@/lib/campaign/format-resolution";

import {
  TWO_FORMAT_CAMPAIGN_FORMAT,
  TWO_FORMAT_CONTRACT_VERSION,
} from "./types";

/**
 * Resultado TOTAL da resolução conjunta: o caso conjunto próprio ou o union
 * reutilizado do resolvedor existente para todo o resto.
 */
export type TwoFormatContractResolution =
  | {
      readonly kind: "two_format";
      readonly contractVersion: typeof TWO_FORMAT_CONTRACT_VERSION;
    }
  | CampaignFormatResolution;

/**
 * Chaves que sugerem uma lista de formatos. Sua PRESENÇA invalida o snapshot:
 * o contrato conjunto aceita somente o valor escalar exato, nunca uma coleção.
 */
const LIST_FORMAT_KEYS = ["campaignFormats", "formats"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unavailable(
  reason: CampaignFormatUnavailableReason,
): TwoFormatContractResolution {
  return Object.freeze({ kind: "unavailable" as const, reason });
}

/**
 * Resolve o par formato/versão da campanha conjunta.
 *
 * Ordem explícita (nunca lança):
 * - snapshot não-objeto/array ⇒ delegação (que devolve `malformed_format`);
 * - chave de lista presente ⇒ `unsupported_format`, sem delegar e sem 1:1;
 * - `campaignFormat: "1:1+9:16"` ⇒ valida a versão conjunta exata;
 * - `formatContractVersion` conjunta com outro formato/órfã ⇒ `incoherent_pair`;
 * - qualquer outro snapshot ⇒ `resolveCampaignFormat` sem reescrita.
 */
export function resolveTwoFormatContract(
  inputSnapshot: unknown,
): TwoFormatContractResolution {
  if (!isRecord(inputSnapshot)) {
    return resolveCampaignFormat(inputSnapshot);
  }

  const hasListKey = LIST_FORMAT_KEYS.some(
    (key) => hasOwn(inputSnapshot, key) && inputSnapshot[key] !== undefined,
  );
  if (hasListKey) {
    return unavailable("unsupported_format");
  }

  const formatValue = inputSnapshot[CAMPAIGN_FORMAT_KEY];
  const versionValue = inputSnapshot[FORMAT_CONTRACT_VERSION_KEY];

  if (formatValue === TWO_FORMAT_CAMPAIGN_FORMAT) {
    if (
      versionValue === undefined ||
      versionValue === null ||
      versionValue === "" ||
      typeof versionValue !== "string"
    ) {
      return unavailable("missing_version");
    }
    if (versionValue === TWO_FORMAT_CONTRACT_VERSION) {
      return Object.freeze({
        kind: "two_format" as const,
        contractVersion: TWO_FORMAT_CONTRACT_VERSION,
      });
    }
    if (versionValue === FORMAT_CONTRACT_VERSION) {
      return unavailable("incoherent_pair");
    }
    return unavailable("unsupported_version");
  }

  // Versão conjunta órfã ou acoplada a outro formato é sempre incoerente.
  if (versionValue === TWO_FORMAT_CONTRACT_VERSION) {
    return unavailable("incoherent_pair");
  }

  return resolveCampaignFormat(inputSnapshot);
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
