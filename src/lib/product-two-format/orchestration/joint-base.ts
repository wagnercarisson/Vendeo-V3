/**
 * F60.7 Subfatia B — base conjunta (uma única execução sob a identidade de
 * CONTROLE).
 *
 * A `square_original` é persistida em
 * `{store}/{campaign}/{operationId}/square_original.jpg`, exatamente o caminho
 * que a RPC de entrega valida. A identidade financeira do quadrado é separada
 * e NUNCA chega à base nem ao caminho de artefato.
 *
 * Este módulo apenas delega ao step layer real (`runBaseStep`), repassando
 * TODAS as dependências de reconstrução e o `signal`. Ele não monta conteúdo,
 * não reserva, não entrega, não projeta e não gera segunda arte.
 */

import {
  runBaseStep,
  type BaseStepDeps,
  type BaseStepInput,
} from "@/lib/product-9-16-two-stage/orchestration/base-step";

export type JointBaseInput = BaseStepInput;
export type JointBaseDeps = BaseStepDeps;

export type JointBaseOutcome =
  | { readonly kind: "completed" }
  | { readonly kind: "definitive"; readonly reason: string }
  | { readonly kind: "retryable"; readonly reason: string }
  | { readonly kind: "unknown"; readonly reason: string }
  | {
      readonly kind: "processing";
      readonly state: string;
      readonly nextStep: string;
      readonly canContinue: boolean;
    }
  | { readonly kind: "skipped" };

function mapOutcome(
  outcome: Awaited<ReturnType<typeof runBaseStep>>,
): JointBaseOutcome {
  switch (outcome.kind) {
    case "completed":
      return { kind: "completed" };
    case "definitive":
      return { kind: "definitive", reason: outcome.reason };
    case "retryable":
      return { kind: "retryable", reason: outcome.reason };
    case "unknown":
      return { kind: "unknown", reason: outcome.reason };
    case "processing":
      return {
        kind: "processing",
        state: outcome.state,
        nextStep: outcome.nextStep,
        canContinue: outcome.canContinue,
      };
    case "skipped":
      return { kind: "skipped" };
  }
}

/**
 * Executa a etapa de base uma única vez com a identidade de controle.
 * `deps.base` é o `runSquareBase` vinculado ao client pelo composition root.
 */
export async function runJointBase(
  input: JointBaseInput,
  deps: JointBaseDeps,
): Promise<JointBaseOutcome> {
  return mapOutcome(await runBaseStep(input, deps));
}
