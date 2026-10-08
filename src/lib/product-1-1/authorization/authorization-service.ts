import "server-only";

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import {
  decideProductFlowAuthorization,
  type ProductFlowAuthorizationDecision,
} from "./authorization-decision";
import { deriveCurrentAuthorization } from "./derive";
import {
  SupabaseStageAuthorizationRepository,
  type StageAuthorizationRepository,
} from "./stage-authorization-repository";
import type { ProductFlowEnvironment, ProductFlowScope } from "./types";

export interface ResolveProductFlowAuthorizationInput {
  readonly requestedScope: ProductFlowScope;
  readonly expectedInstanceIdentity: string;
  readonly expectedEnvironment: ProductFlowEnvironment;
  readonly nowMs?: number;
}

/**
 * Revalida, a cada decisão, escopo/instância/expiração/revogação e as duas flags
 * (exigindo apenas a aplicável + autorização vigente). Fail-closed: qualquer
 * exceção de leitura retorna `allowed: false` com `read_failure`.
 *
 * Não executa geração, provider, crédito, entrega ou download; apenas lê estado.
 */
export async function resolveProductFlowAuthorization(
  input: ResolveProductFlowAuthorizationInput,
  flags: FeatureFlagService = new FeatureFlagService(),
  repository: StageAuthorizationRepository = new SupabaseStageAuthorizationRepository(),
): Promise<ProductFlowAuthorizationDecision> {
  try {
    const [flagRead, events] = await Promise.all([
      flags.readProductOneToOneFlags(),
      repository.listEvents({
        scope: input.requestedScope,
        instanceIdentity: input.expectedInstanceIdentity,
      }),
    ]);

    return decideProductFlowAuthorization({
      nowMs: input.nowMs ?? Date.now(),
      requestedScope: input.requestedScope,
      expectedInstanceIdentity: input.expectedInstanceIdentity,
      expectedEnvironment: input.expectedEnvironment,
      authorization: deriveCurrentAuthorization(
        events,
        input.requestedScope,
        input.expectedInstanceIdentity,
      ),
      flags: {
        testStoresEnabled: flagRead.testStoresEnabled,
        allStoresEnabled: flagRead.allStoresEnabled,
        testStoresStatus: flagRead.testStoresStatus,
        allStoresStatus: flagRead.allStoresStatus,
      },
    });
  } catch {
    return { allowed: false, code: "read_failure" };
  }
}
