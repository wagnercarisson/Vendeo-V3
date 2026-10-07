import "server-only";

import { FeatureFlagService } from "@/lib/feature-flags/feature-flag-service";
import {
  decideProductFlow,
  type ProductOneToOneFlow,
} from "./feature-flow-decision";

export interface ResolveProductOneToOneFlowInput {
  /** Server-derived classification; this API exposes no client flow override. */
  readonly isTestStore: boolean;
}

/**
 * Reads both F56.2a switches server-side. A read exception fails closed to the
 * legacy path; even when either switch is enabled, this service performs no
 * routing or generation side effect.
 */
export async function resolveProductOneToOneFlow(
  input: ResolveProductOneToOneFlowInput,
  service: FeatureFlagService = new FeatureFlagService(),
): Promise<ProductOneToOneFlow> {
  try {
    const [testStoresEnabled, allStoresEnabled] = await Promise.all([
      service.isProductOneToOneTestStoresEnabled(),
      service.isProductOneToOneAllStoresEnabled(),
    ]);

    return decideProductFlow({
      testStoresEnabled,
      allStoresEnabled,
      isTestStore: input.isTestStore,
    });
  } catch {
    return decideProductFlow({
      testStoresEnabled: false,
      allStoresEnabled: false,
      isTestStore: input.isTestStore,
    });
  }
}
