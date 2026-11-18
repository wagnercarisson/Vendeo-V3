/**
 * F60.7 Subfatia B — preflight administrativo read-only da seleção de expansão.
 *
 * SOMENTE para operação NOVA. Replay equivalente reutiliza a seleção congelada
 * persistida e NÃO passa por este módulo; os helpers permanecem separados.
 *
 * Regras:
 * - nunca lança: toda falha vira uma união discriminada;
 * - `absent`/`invalid` bloqueiam a abertura nova sem reservar crédito;
 * - `read_failed` e exceções são `indeterminate` — falha de leitura NUNCA é
 *   convertida em ausência/invalidade;
 * - `pricing_unavailable` é cobertura comprovadamente insuficiente ⇒ `invalid`
 *   (bloqueia a abertura nova, não invalida uma operação já existente);
 * - seleção legada/`configVersionId` nulo não serve ao contrato conjunto.
 *
 * O módulo não importa infraestrutura global: as duas costuras são injetadas.
 * A composição real pertence ao composition root da Subfatia B (plano 05).
 */

import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";

import type { TwoFormatSelectionInput } from "../joint-financial-client";

/** Falha fechada do preflight, com motivo estável e campos faltantes. */
export type JointPreflightFailureKind = "absent" | "invalid" | "indeterminate";

export type JointPreflightResult =
  | { readonly ok: true; readonly selection: TwoFormatSelectionInput }
  | {
      readonly ok: false;
      readonly kind: JointPreflightFailureKind;
      readonly reason: string;
      readonly missing: readonly string[];
    };

/**
 * Subconjunto estrutural do resultado estrito F60.6. O serviço real é
 * atribuível a este contrato sem acoplar o módulo à infraestrutura.
 */
export type JointPreflightConfigReadResult =
  | { readonly kind: "found"; readonly selection: ExpansionSelection }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly reason: string }
  | { readonly kind: "read_failed"; readonly reason: string };

/** Subconjunto estrutural de `ExpansionPreflightResult` relevante ao gate. */
export type JointPreflightEvaluation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly failure:
        | "model_unavailable"
        | "pricing_unavailable"
        | "configuration_read_failed";
      readonly reason: string;
      readonly missing?: readonly string[];
    };

export interface JointPreflightDeps {
  readonly readConfiguration: () => Promise<JointPreflightConfigReadResult>;
  readonly preflightSelection: (
    selection: ExpansionSelection,
  ) => Promise<JointPreflightEvaluation>;
}

const NO_MISSING: readonly string[] = Object.freeze([]);

function failure(
  kind: JointPreflightFailureKind,
  reason: string,
  missing: readonly string[] = NO_MISSING,
): JointPreflightResult {
  return Object.freeze({ ok: false as const, kind, reason, missing });
}

/**
 * Executa o preflight read-only e devolve a seleção exata a ser congelada.
 * Não reserva, não abre operação, não chama provider e não escreve nada.
 */
export async function preflightJointSelection(
  deps: JointPreflightDeps,
): Promise<JointPreflightResult> {
  let read: JointPreflightConfigReadResult;
  try {
    read = await deps.readConfiguration();
  } catch {
    return failure("indeterminate", "configuration_read_failed");
  }

  if (read.kind === "absent") return failure("absent", "expansion_config_absent");
  if (read.kind === "invalid") return failure("invalid", read.reason);
  if (read.kind === "read_failed") return failure("indeterminate", read.reason);
  if (read.kind !== "found") {
    return failure("indeterminate", "configuration_read_failed");
  }

  const selection = read.selection;
  if (
    selection.origin !== "configured" ||
    typeof selection.configVersionId !== "string" ||
    selection.configVersionId.trim() === ""
  ) {
    return failure("invalid", "expansion_selection_not_configured");
  }

  let evaluation: JointPreflightEvaluation;
  try {
    evaluation = await deps.preflightSelection(selection);
  } catch {
    return failure("indeterminate", "preflight_read_failed");
  }

  if (evaluation.ok) {
    return Object.freeze({
      ok: true as const,
      selection: Object.freeze({
        model: selection.model,
        quality: selection.quality,
        configVersionId: selection.configVersionId,
      }),
    });
  }

  if (evaluation.failure === "configuration_read_failed") {
    return failure("indeterminate", evaluation.reason);
  }
  if (evaluation.failure === "pricing_unavailable") {
    return failure("invalid", evaluation.reason, evaluation.missing ?? NO_MISSING);
  }
  return failure("invalid", evaluation.reason);
}
