import "server-only";

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import { deriveCurrentAuthorization } from "@/lib/product-1-1/authorization/derive";
import { resolveCanonicalInstanceIdentity } from "@/lib/product-1-1/authorization/instance-identity";
import { SupabaseStageAuthorizationRepository } from "@/lib/product-1-1/authorization/stage-authorization-repository";
import type { ProductFlowStage } from "@/lib/product-1-1/authorization/types";
import type { ProductActivationMode } from "./schemas";

/**
 * Leitura SERVER-SIDE do estado operacional real do Produto 1:1.
 *
 * A UI e o endpoint usam este valor (`mode`) depois de qualquer acao, inclusive
 * replay idempotente. O resultado historico de um replay nunca e exibido como
 * estado atual.
 */
export interface ProductActivationState {
  readonly mode: ProductActivationMode | "inconsistent";
  readonly flags: {
    readonly testStores: boolean;
    readonly allStores: boolean;
    readonly testStoresStatus: string;
    readonly allStoresStatus: string;
  };
  readonly authorizations: {
    readonly testStores: ProductFlowStage;
    readonly allStores: ProductFlowStage;
  };
  readonly instanceIdentity: string;
}

function stageOf(
  events: Awaited<ReturnType<SupabaseStageAuthorizationRepository["listEvents"]>>,
  scope: "test_stores" | "all_stores",
  instanceIdentity: string,
): ProductFlowStage {
  return (
    deriveCurrentAuthorization(events, scope, instanceIdentity)?.stage ?? "off"
  );
}

export async function readProductActivationState(
  flags: FeatureFlagService = new FeatureFlagService(),
  repository: SupabaseStageAuthorizationRepository = new SupabaseStageAuthorizationRepository(),
): Promise<ProductActivationState> {
  const instanceIdentity = resolveCanonicalInstanceIdentity();
  const [flagRead, testEvents, allEvents] = await Promise.all([
    flags.readProductOneToOneFlags(),
    repository.listEvents({ scope: "test_stores", instanceIdentity }),
    repository.listEvents({ scope: "all_stores", instanceIdentity }),
  ]);

  const testStores = stageOf(testEvents, "test_stores", instanceIdentity);
  const allStores = stageOf(allEvents, "all_stores", instanceIdentity);

  let mode: ProductActivationState["mode"] = "inconsistent";
  if (!flagRead.testStoresEnabled && !flagRead.allStoresEnabled) {
    mode = testStores === "off" && allStores === "off" ? "off" : "inconsistent";
  } else if (flagRead.testStoresEnabled && !flagRead.allStoresEnabled) {
    mode =
      testStores === "test_stores" && allStores === "off"
        ? "test_stores"
        : "inconsistent";
  } else if (!flagRead.testStoresEnabled && flagRead.allStoresEnabled) {
    mode =
      allStores === "all_stores" && testStores === "test_stores"
        ? "all_stores"
        : "inconsistent";
  }

  return Object.freeze({
    mode,
    flags: {
      testStores: flagRead.testStoresEnabled,
      allStores: flagRead.allStoresEnabled,
      testStoresStatus: flagRead.testStoresStatus,
      allStoresStatus: flagRead.allStoresStatus,
    },
    authorizations: { testStores, allStores },
    instanceIdentity,
  });
}
