/**
 * F61 — Modelo PURO de apresentação dos formatos `1:1` e `9:16`.
 *
 * Camada de APRESENTAÇÃO: traduz estados já resolvidos pelas autoridades
 * existentes (read model conjunto e resolvedor individual) para um contrato
 * tipado consumido pela UI. NÃO decide entrega, NÃO lê banco/Storage, NÃO
 * infere formato por path/miniatura e NÃO promete geração futura.
 *
 * Segurança:
 * - nenhum `input_snapshot`, `storage_path`, credencial ou URL entra aqui;
 * - `error`/`stale` chegam como `unknown` (nunca viram ausência);
 * - estorno é modificador de `absent` e nunca é presumido;
 * - o formato conjunto é mapeado sem reinterpretação.
 *
 * Puro: sem `server-only`, sem React, sem Supabase, sem `fetch`, sem storage.
 */

import type { CampaignFormatResolution } from "./format-resolution";

/** Chave canônica do formato. */
export type CampaignFormatKey = "1:1" | "9:16";

export type CampaignFormatPresentationState =
  | "delivered"
  | "processing"
  | "absent"
  | "unknown"
  | "unavailable";

/**
 * Estruturalmente idêntica a `TwoFormatDeliveryState`; declaração LOCAL para
 * manter este módulo independente do módulo conjunto.
 */
export type CampaignFormatDeliveryState = CampaignFormatPresentationState;

export type CampaignFormatPresentationReason =
  | "not_requested"
  | "not_delivered"
  | null;

export interface CampaignFormatPresentationEntry {
  readonly state: CampaignFormatPresentationState;
  /** `true` SOMENTE em `absent`; nunca presume estorno. */
  readonly refunded: boolean;
  readonly reason: CampaignFormatPresentationReason;
  /** Destaque de seleção no detalhe; sempre `false` em lista/dashboard. */
  readonly active: boolean;
}

export interface CampaignFormatPresentation {
  readonly formats: Readonly<
    Record<CampaignFormatKey, CampaignFormatPresentationEntry>
  >;
  readonly flow: "single_format" | "two_format";
  readonly partial: boolean;
  readonly anyDelivered: boolean;
}

export type IndividualFormatLifecycle =
  | "delivered"
  | "processing"
  | "refunded"
  | "unknown";

export interface JointFormatPresentationInputEntry {
  readonly state: CampaignFormatDeliveryState;
  readonly refunded: boolean;
}

export interface IndividualFormatPresentationInput {
  readonly resolution: CampaignFormatResolution;
  readonly lifecycle: IndividualFormatLifecycle;
  /**
   * F62 — adição posterior do formato vertical. Ausente/`null` significa que
   * NUNCA houve adição: o outro formato permanece `absent/not_requested`.
   * Carrega apenas estado/marcas seguras; nunca snapshot, path ou bytes.
   */
  readonly addition?: FormatAdditionPresentationInput | null;
}

/**
 * F62 — entrada segura da adição do vertical `9:16`.
 *
 * `absent` sempre significa tentativa/entrega ausente (`not_delivered`), e
 * `refunded` é um modificador explícito. `unknown` nunca deve ser convertido
 * em ausência pela apresentação.
 */
export interface FormatAdditionPresentationInput {
  /** Formato alvo da adição; hoje apenas o vertical `9:16`. */
  readonly format: "9:16";
  readonly state: "delivered" | "processing" | "unknown" | "absent";
  /** `true` somente quando a adição terminou estornada; nunca presumido. */
  readonly refunded?: boolean;
}

const FORMAT_KEYS: readonly CampaignFormatKey[] = Object.freeze(["1:1", "9:16"]);

function entry(
  state: CampaignFormatPresentationState,
  options: {
    readonly refunded?: boolean;
    readonly reason?: CampaignFormatPresentationReason;
    readonly active?: boolean;
  } = {},
): CampaignFormatPresentationEntry {
  return Object.freeze({
    state,
    refunded: options.refunded === true,
    reason: options.reason ?? null,
    active: options.active === true,
  });
}

function presentation(
  formats: Record<CampaignFormatKey, CampaignFormatPresentationEntry>,
  flow: CampaignFormatPresentation["flow"],
): CampaignFormatPresentation {
  const frozenFormats = Object.freeze({
    "1:1": formats["1:1"],
    "9:16": formats["9:16"],
  });
  const anyDelivered =
    frozenFormats["1:1"].state === "delivered" ||
    frozenFormats["9:16"].state === "delivered";
  const allDelivered =
    frozenFormats["1:1"].state === "delivered" &&
    frozenFormats["9:16"].state === "delivered";
  return Object.freeze({
    formats: frozenFormats,
    flow,
    partial: flow === "two_format" && anyDelivered && !allDelivered,
    anyDelivered,
  });
}

/**
 * Mapeia a leitura conjunta sem reinterpretar os estados.
 *
 * - `delivered`/`processing`/`unknown`/`unavailable` são copiados;
 * - `absent` recebe `reason = "not_delivered"` e o `refunded` do input;
 * - `active` só no formato passado e apenas quando `delivered`.
 */
export function buildJointFormatPresentation(
  input: Readonly<
    Record<CampaignFormatKey, JointFormatPresentationInputEntry>
  >,
  activeFormat: CampaignFormatKey | null = null,
): CampaignFormatPresentation {
  const build = (
    key: CampaignFormatKey,
  ): CampaignFormatPresentationEntry => {
    const source = input[key];
    const isAbsent = source.state === "absent";
    return entry(source.state, {
      refunded: isAbsent && source.refunded === true,
      reason: isAbsent ? "not_delivered" : null,
      active: activeFormat === key && source.state === "delivered",
    });
  };

  return presentation(
    { "1:1": build("1:1"), "9:16": build("9:16") },
    "two_format",
  );
}

/**
 * Mapeia a adição posterior sem reinterpretar o estado durável.
 * `absent` sempre recebe `not_delivered`; `active` exige `delivered` e a
 * seleção efetiva do formato.
 */
function additionEntry(
  addition: FormatAdditionPresentationInput,
  activeFormat: CampaignFormatKey | null,
  key: CampaignFormatKey,
): CampaignFormatPresentationEntry {
  switch (addition.state) {
    case "delivered":
      return entry("delivered", { active: activeFormat === key });
    case "processing":
      return entry("processing");
    case "unknown":
      return entry("unknown");
    case "absent":
      return entry("absent", {
        refunded: addition.refunded === true,
        reason: "not_delivered",
      });
  }
}

/**
 * Monta a apresentação de uma campanha individual a partir do formato
 * persistido (resolvedor), do ciclo de vida já derivado pela superfície e,
 * opcionalmente, do estado durável de uma adição posterior.
 *
 * - resolução `unavailable` ⇒ AMBOS `unavailable` (sem fallback `1:1`);
 * - formato persistido: `delivered`/`processing`/`refunded`/`unknown`;
 * - sem adição, o OUTRO formato é `absent/not_requested`;
 * - com adição, o OUTRO formato reflete `delivered`/`processing`/`unknown`/
 *   `absent` (sempre `reason: "not_delivered"`);
 * - `active` depende da seleção recebida e exige entrega comprovada;
 * - `partial` sempre `false` (campanha individual não é parcial).
 */
export function buildIndividualFormatPresentation(
  input: IndividualFormatPresentationInput,
  activeFormat: CampaignFormatKey | null = null,
): CampaignFormatPresentation {
  if (input.resolution.kind === "unavailable") {
    return presentation(
      {
        "1:1": entry("unavailable"),
        "9:16": entry("unavailable"),
      },
      "single_format",
    );
  }

  const persistedKey: CampaignFormatKey = input.resolution.kind;
  const otherKey: CampaignFormatKey = persistedKey === "1:1" ? "9:16" : "1:1";

  const persistedEntry = (() => {
    switch (input.lifecycle) {
      case "delivered":
        return entry("delivered", {
          active: activeFormat === persistedKey,
        });
      case "processing":
        return entry("processing");
      case "refunded":
        return entry("absent", {
          refunded: true,
          reason: "not_delivered",
        });
      case "unknown":
        return entry("unknown");
    }
  })();

  const otherEntry =
    input.addition !== null &&
    input.addition !== undefined &&
    input.addition.format === otherKey
      ? additionEntry(input.addition, activeFormat, otherKey)
      : entry("absent", { reason: "not_requested" });

  return presentation(
    {
      "1:1": persistedKey === "1:1" ? persistedEntry : otherEntry,
      "9:16": persistedKey === "9:16" ? persistedEntry : otherEntry,
    },
    "single_format",
  );
}

/** Fluxo/leitura indeterminada: ambos `unknown`, nunca ausência presumida. */
export function buildUnknownFormatPresentation(): CampaignFormatPresentation {
  return presentation(
    { "1:1": entry("unknown"), "9:16": entry("unknown") },
    "single_format",
  );
}

/** Contrato inválido/desconhecido: ambos `unavailable`, sem fallback `1:1`. */
export function buildUnavailableFormatPresentation(): CampaignFormatPresentation {
  return presentation(
    { "1:1": entry("unavailable"), "9:16": entry("unavailable") },
    "single_format",
  );
}

/**
 * `ready` → `delivered`, `generating` → `processing`,
 * `error` → `unknown` (erro NUNCA comprova ausência).
 */
export function individualLifecycleFromStatus(
  status: "generating" | "ready" | "error",
): IndividualFormatLifecycle {
  switch (status) {
    case "ready":
      return "delivered";
    case "generating":
      return "processing";
    case "error":
      return "unknown";
  }
}

/** Lista imutável das chaves, na ordem canônica `1:1`, `9:16`. */
export const CAMPAIGN_FORMAT_KEYS: readonly CampaignFormatKey[] = FORMAT_KEYS;
