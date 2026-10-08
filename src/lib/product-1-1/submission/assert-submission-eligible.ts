import type { ProductFlowAuthorizationDecision } from "@/lib/product-1-1/authorization/authorization-decision";
import {
  detectExclusiveNewFlowFields,
  type ExclusiveNewFlowField,
} from "./exclusive-fields";

/**
 * F56.2b1a — Guard de submissão do novo fluxo (puro).
 *
 * - Corpo sem campos exclusivos → `not_new_flow` (payload legado, caminho anterior).
 * - Corpo com campos exclusivos e decisão de elegibilidade permitida → `allowed`.
 * - Corpo com campos exclusivos e decisão negada → `refused` com código seguro
 *   identificável, SEM tocar/descartar/reinterpretar nenhum campo.
 *
 * O corpo bruto nunca é mutado.
 */
export type SubmissionEligibilityRefusalCode = "new_flow_ineligible";

export type SubmissionEligibilityResult =
  | { readonly kind: "not_new_flow" }
  | { readonly kind: "allowed"; readonly fields: readonly ExclusiveNewFlowField[] }
  | {
      readonly kind: "refused";
      readonly code: SubmissionEligibilityRefusalCode;
      readonly fields: readonly ExclusiveNewFlowField[];
    };

export function assertSubmissionEligible(
  rawBody: unknown,
  decision: ProductFlowAuthorizationDecision,
): SubmissionEligibilityResult {
  const fields = detectExclusiveNewFlowFields(rawBody);

  if (fields.length === 0) {
    return { kind: "not_new_flow" };
  }

  if (decision.allowed === true) {
    return { kind: "allowed", fields };
  }

  return { kind: "refused", code: "new_flow_ineligible", fields };
}
