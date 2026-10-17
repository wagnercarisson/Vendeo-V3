import "server-only";

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolveEligibilityContext } from "@/lib/product-1-1/submission/eligibility-context";

import { ProductOneToOnePilotSpendControl, type PilotSpendGate } from "@/lib/product-1-1/pilot/spend-control";

/**
 * F56.2b2c (B2.3) — Resolução SERVER-SIDE do gate de gasto do piloto.
 *
 * TRÊS estados (distinção OBRIGATÓRIA, ver revisão):
 * - `armed`: piloto AUTORIZADO (via estreita) **e** flag aplicável ligada ⇒ passa o gate.
 * - `inactive`: leitura DETERMINÍSTA que mostra o piloto DESLIGADO (autorização
 *   resolvida e NÃO estreita) ⇒ fluxo segue SEM gate (legado/inerte preservado).
 * - `blocked`: INCERTEZA (falha de leitura de autorização/flags, ou inconsistência)
 *   ⇒ o caminho NOVO deve **IMPEDIR a chamada** — nunca retirar a proteção.
 *
 * Reutiliza o CONTEXTO SERVER-SIDE real da loja (`resolveEligibilityContext`), sem
 * fixar ambiente/instância.
 */

export type PilotSpendBlockReason =
  | "authorization_read_failure"
  | "flags_unavailable"
  | "eligibility_context_failure"
  | "non_narrow_enabling_stage";

export type PilotSpendGateResolution =
  | { readonly kind: "armed"; readonly gate: PilotSpendGate }
  | { readonly kind: "inactive" }
  | { readonly kind: "blocked"; readonly reason: PilotSpendBlockReason };

type StoreRow = Parameters<typeof resolveEligibilityContext>[0];

export async function resolvePilotSpendGate(input: {
  store: StoreRow;
}): Promise<PilotSpendGateResolution> {
  let decision: Awaited<ReturnType<typeof resolveProductFlowAuthorization>>;
  try {
    const context = resolveEligibilityContext(input.store);
    decision = await resolveProductFlowAuthorization(context);
  } catch {
    return { kind: "blocked", reason: "eligibility_context_failure" };
  }

  // Leitura DETERMINÍSTA não-armada ⇒ INATIVO (segue sem gate). ATENÇÃO:
  // `resolveProductFlowAuthorization` **retorna** `{allowed:false, code:"read_failure"}`
  // em falha de leitura (não lança) — isso é INCERTEZA e deve BLOQUEAR.
  if (!decision.allowed) {
    if (decision.code === "read_failure" || decision.code === "flags_unavailable") {
      return { kind: "blocked", reason: "authorization_read_failure" };
    }
    return { kind: "inactive" };
  }
  if (decision.stage !== "isolated_pilot") {
    // Estágio HABILITADOR não-estreito (`test_stores`/`all_stores`) ⇒ NEGAR o novo
    // fluxo (NÃO armar gate para escopo geral — não amplia a autorização aprovada).
    return { kind: "blocked", reason: "non_narrow_enabling_stage" };
  }

  // Autorização estreita vigente: a flag é a janela. Falha/leitura inválida ⇒
  // INCERTEZA ⇒ bloqueia (não retira a proteção).
  try {
    const flags = await new FeatureFlagService().readProductOneToOneFlags();
    if (!flags.testStoresEnabled || flags.testStoresStatus !== "valid") {
      return { kind: "blocked", reason: "flags_unavailable" };
    }
  } catch {
    return { kind: "blocked", reason: "flags_unavailable" };
  }

  return { kind: "armed", gate: new ProductOneToOnePilotSpendControl() };
}

// Estimativa (opção 2) extraída para módulo PURO `./copy-estimate` (sem
// server-only/env), para uso pelo runner da copy sem puxar a cadeia de flags.
export {
  PILOT_COPY_MAX_OUTPUT_TOKENS,
  PILOT_COPY_CONSERVATIVE_INPUT_TOKENS,
  computeCopyEstimate,
} from "./copy-estimate";
export type { PilotCopyPricing } from "./copy-estimate";
