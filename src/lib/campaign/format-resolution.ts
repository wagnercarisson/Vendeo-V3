/**
 * F59 — Contrato NEUTRO e PURO de resolução de formato da campanha.
 *
 * A presença/ausência das chaves `campaignFormat` e `formatContractVersion` no
 * `campaigns.input_snapshot` PERSISTIDO é a única fonte de verdade do formato.
 * Ausência das DUAS chaves em campanha do novo fluxo ⇒ contrato histórico `1:1`.
 *
 * Este módulo não tem I/O, dependência de runtime de servidor, processamento de
 * imagem ou cliente de banco, e não importa o runtime quadrado nem o módulo
 * vertical: a UI pode consumir a MESMA tabela sem cruzar o boundary vertical.
 *
 * Fail-closed: formato/versão malformado, desconhecido ou incoerente resolve
 * para `unavailable` — NUNCA há fallback silencioso para `1:1`.
 */

/** Chave do formato no `campaigns.input_snapshot`. */
export const CAMPAIGN_FORMAT_KEY = "campaignFormat" as const;

/** Chave da versão do contrato de formato no `campaigns.input_snapshot`. */
export const FORMAT_CONTRACT_VERSION_KEY = "formatContractVersion" as const;

/** Versão congelada do contrato vertical 9:16 (v1). */
export const FORMAT_CONTRACT_VERSION = "f59-vertical-9-16-v1" as const;

/** Formatos suportados pelo fluxo NOVO de Produto. */
export type CampaignFormat = "1:1" | "9:16";

/** Motivos estáveis de indisponibilidade (sem texto de UI). */
export type CampaignFormatUnavailableReason =
  | "malformed_format"
  | "unsupported_format"
  | "missing_version"
  | "unsupported_version"
  | "incoherent_pair"
  | "explicit_one_to_one";

/**
 * Contrato versionado dos formatos conhecidos. Hoje apenas `9:16` possui
 * contrato explícito; `1:1` é o histórico SEM chaves.
 */
const KNOWN_CONTRACT_VERSIONS: Readonly<Record<string, CampaignFormat>> =
  Object.freeze({
    [FORMAT_CONTRACT_VERSION]: "9:16",
  });

/** Resultado TOTAL e discriminado da resolução de formato. */
export type CampaignFormatResolution =
  | { readonly kind: "1:1"; readonly source: "absent" }
  | {
      readonly kind: "9:16";
      readonly contractVersion: typeof FORMAT_CONTRACT_VERSION;
    }
  | {
      readonly kind: "unavailable";
      readonly reason: CampaignFormatUnavailableReason;
    };

function unavailable(
  reason: CampaignFormatUnavailableReason,
): CampaignFormatResolution {
  return Object.freeze({ kind: "unavailable" as const, reason });
}

function hasOwn(obj: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Resolve `campaignFormat` + `formatContractVersion` como um PAR.
 *
 * Tabela (nunca lança):
 * - snapshot não-objeto/array ⇒ `malformed_format`;
 * - `campaignFormat` presente porém `null`/`""`/não-string ⇒ `malformed_format`;
 * - `campaignFormat: "1:1"` (com ou sem versão) ⇒ `explicit_one_to_one`
 *   (não escrevemos contrato 1:1 explícito);
 * - `campaignFormat` string desconhecida ⇒ `unsupported_format`;
 * - `9:16` + versão reconhecida ⇒ `9:16`;
 * - `9:16` sem versão/`null`/`""`/não-string ⇒ `missing_version`;
 * - `9:16` + contrato conhecido de OUTRO formato ⇒ `incoherent_pair`;
 * - `9:16` + versão string desconhecida ⇒ `unsupported_version`;
 * - `campaignFormat` ausente/`undefined` + versão presente ⇒ `incoherent_pair`;
 * - ambas as chaves ausentes (ou `undefined`) ⇒ `1:1/absent`.
 */
export function resolveCampaignFormat(
  inputSnapshot: unknown,
): CampaignFormatResolution {
  if (
    inputSnapshot === null ||
    inputSnapshot === undefined ||
    typeof inputSnapshot !== "object" ||
    Array.isArray(inputSnapshot)
  ) {
    return unavailable("malformed_format");
  }

  const snapshot = inputSnapshot as Record<string, unknown>;
  const hasFormatKey = hasOwn(snapshot, CAMPAIGN_FORMAT_KEY);
  const hasVersionKey = hasOwn(snapshot, FORMAT_CONTRACT_VERSION_KEY);
  const formatValue = hasFormatKey ? snapshot[CAMPAIGN_FORMAT_KEY] : undefined;
  const versionValue = hasVersionKey
    ? snapshot[FORMAT_CONTRACT_VERSION_KEY]
    : undefined;

  // `undefined` conta como AUSENTE; `null`/`""`/não-string é malformado.
  const formatIsPresent = hasFormatKey && formatValue !== undefined;

  if (formatIsPresent) {
    if (formatValue === null || typeof formatValue !== "string") {
      return unavailable("malformed_format");
    }
    if (formatValue === "") {
      return unavailable("malformed_format");
    }
    if (formatValue === "1:1") {
      // Não escrevemos contrato 1:1 explícito; nunca reinterpretar como normal.
      return unavailable("explicit_one_to_one");
    }
    if (formatValue !== "9:16") {
      return unavailable("unsupported_format");
    }

    // `campaignFormat: "9:16"` exige uma versão reconhecida.
    if (
      versionValue === undefined ||
      versionValue === null ||
      versionValue === "" ||
      typeof versionValue !== "string"
    ) {
      return unavailable("missing_version");
    }
    if (versionValue === FORMAT_CONTRACT_VERSION) {
      return Object.freeze({
        kind: "9:16" as const,
        contractVersion: FORMAT_CONTRACT_VERSION,
      });
    }
    const knownFormat = KNOWN_CONTRACT_VERSIONS[versionValue];
    if (knownFormat !== undefined && knownFormat !== "9:16") {
      return unavailable("incoherent_pair");
    }
    return unavailable("unsupported_version");
  }

  // Formato ausente (ou `undefined`): uma versão presente torna o par incoerente.
  if (hasVersionKey && versionValue !== undefined) {
    return unavailable("incoherent_pair");
  }

  return Object.freeze({ kind: "1:1" as const, source: "absent" as const });
}

/** `true` somente quando o par formato/versão é utilizável. Nunca lança. */
export function isCampaignFormatAvailable(
  resolution: CampaignFormatResolution,
): boolean {
  return resolution.kind !== "unavailable";
}

/**
 * Chave estável de telemetria para indisponibilidade (não é texto de UI).
 * Formato: `campaign_format_unavailable_<reason>`.
 */
export function formatUnavailableMessageKey(
  reason: CampaignFormatUnavailableReason,
): string {
  return `campaign_format_unavailable_${reason}`;
}
