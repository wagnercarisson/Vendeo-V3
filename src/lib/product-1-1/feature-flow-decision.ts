export type ProductOneToOneFlow = "legacy" | "new_flow";

export const PRODUCT_ONE_TO_ONE_FLOWS = Object.freeze([
  "legacy",
  "new_flow",
] as const satisfies readonly ProductOneToOneFlow[]);

export interface DecideProductFlowInput {
  readonly testStoresEnabled: boolean;
  readonly allStoresEnabled: boolean;
  /** Server-derived store classification; never read from a client parameter. */
  readonly isTestStore: boolean;
}

/** Pure, deterministic F56.2a contract; this decision does not route traffic. */
export function decideProductFlow(
  input: DecideProductFlowInput,
): ProductOneToOneFlow {
  if (
    input.allStoresEnabled === true ||
    (input.testStoresEnabled === true && input.isTestStore === true)
  ) {
    return "new_flow";
  }

  return "legacy";
}
