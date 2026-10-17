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
  | "eligibility_context_failure";

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
    return { kind: "inactive" };
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

/**
 * Estimativa CONSERVADORA aprovada para a COPY (USD). É uma **decisão humana**
 * (Plan 04); enquanto não configurada, retorna `undefined` — o gate então
 * BLOQUEIA a copy (nunca contabiliza US$ 0).
 */
export function resolvePilotCopyEstimatedUsd(): number | undefined {
  const raw = process.env.VENDEO_PILOT_COPY_ESTIMATED_USD;
  if (raw === undefined || raw.trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}
