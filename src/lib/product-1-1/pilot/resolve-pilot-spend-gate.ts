import "server-only";

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { resolveProductFlowAuthorization } from "@/lib/product-1-1/authorization/authorization-service";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";

import { ProductOneToOnePilotSpendControl, type PilotSpendGate } from "./spend-control";

/**
 * F56.2b2c (B2.3) — Resolver SERVER-SIDE do gate de gasto do piloto.
 *
 * Devolve um `PilotSpendGate` SOMENTE quando o piloto está ATIVO:
 * autorização ESTREITA vigente (`isolated_pilot` + `test_stores` + ambiente
 * `isolated`) E a flag aplicável `product_1_1_test_stores_enabled` ligada.
 * Fora disso (ou em qualquer erro de leitura), devolve `null` — o piloto fica
 * INATIVO e o fluxo LEGADO/inerte NÃO é afetado (fail-closed para "inativo").
 *
 * NÃO habilita flag, não insere chave e não chama provider: apenas decide se o
 * gate deve ser consultado pelas rotas do novo fluxo.
 */
export async function resolvePilotSpendGate(): Promise<PilotSpendGate | null> {
  try {
    const instanceIdentity = resolveCanonicalInstanceIdentity();
    const decision = await resolveProductFlowAuthorization({
      requestedScope: "test_stores",
      expectedInstanceIdentity: instanceIdentity,
      expectedEnvironment: "isolated",
    });
    if (!decision.allowed || decision.stage !== "isolated_pilot") return null;

    const flags = await new FeatureFlagService().readProductOneToOneFlags();
    if (!flags.testStoresEnabled) return null;

    return new ProductOneToOnePilotSpendControl();
  } catch {
    // Fail-closed para INATIVO: nunca arma o gate por incerteza.
    return null;
  }
}
