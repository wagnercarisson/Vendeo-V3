export const GENERATION_ORIGIN_KEY = "generationOrigin" as const;
export const GENERATION_CONTRACT_VERSION_KEY = "generationContractVersion" as const;
export const GENERATION_ORIGIN = "9_16_two_stage" as const;
export const GENERATION_CONTRACT_VERSION = "f60.5-two-stage-9-16-v1" as const;

export type CampaignGenerationOrigin =
  | { readonly kind: "two_stage_9_16" }
  | { readonly kind: "historical" }
  | { readonly kind: "indeterminate"; readonly reason: string };

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function resolveCampaignGenerationOrigin(
  inputSnapshot: unknown,
): CampaignGenerationOrigin {
  if (
    inputSnapshot === null ||
    inputSnapshot === undefined ||
    typeof inputSnapshot !== "object" ||
    Array.isArray(inputSnapshot)
  ) {
    return Object.freeze({ kind: "historical" as const });
  }

  const snapshot = inputSnapshot as Record<string, unknown>;
  const hasOrigin = hasOwn(snapshot, GENERATION_ORIGIN_KEY);
  const hasVersion = hasOwn(snapshot, GENERATION_CONTRACT_VERSION_KEY);
  const origin = snapshot[GENERATION_ORIGIN_KEY];
  const version = snapshot[GENERATION_CONTRACT_VERSION_KEY];

  if (
    (!hasOrigin && !hasVersion) ||
    (origin === undefined && version === undefined)
  ) {
    return Object.freeze({ kind: "historical" as const });
  }
  if (!hasOrigin || !hasVersion) {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "incomplete_origin_pair",
    });
  }
  if (origin === null || origin === "" || typeof origin !== "string") {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "malformed_origin",
    });
  }
  if (version === null || version === "" || typeof version !== "string") {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "malformed_version",
    });
  }
  if (origin !== GENERATION_ORIGIN) {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "unsupported_origin",
    });
  }
  if (version !== GENERATION_CONTRACT_VERSION) {
    return Object.freeze({
      kind: "indeterminate" as const,
      reason: "unsupported_version",
    });
  }
  return Object.freeze({ kind: "two_stage_9_16" as const });
}
