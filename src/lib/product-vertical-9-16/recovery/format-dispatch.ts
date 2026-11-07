import type { ArtifactProber } from "../artifact/types";
import type { CampaignFormatResolution } from "@/lib/campaign/format-resolution";
import type { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";

/**
 * F59 — Despacho PURO de recuperação por formato persistido.
 * Não executa sonda, não importa o runtime 1:1 e não consulta a flag.
 */
export interface RecoveryProfile {
  readonly format: "1:1" | "9:16";
  readonly prober: ArtifactProber;
  readonly projection: typeof projectDeliveredCampaign;
}

export type RecoveryProfileResolution =
  | { readonly kind: "profile"; readonly profile: RecoveryProfile }
  | {
      readonly kind: "unavailable";
      readonly reason: Extract<CampaignFormatResolution, { kind: "unavailable" }>;
    };

export function resolveRecoveryProfile(input: {
  resolution: CampaignFormatResolution;
  oneToOne: RecoveryProfile;
  vertical: RecoveryProfile;
}): RecoveryProfileResolution {
  if (input.resolution.kind === "9:16") {
    return { kind: "profile", profile: input.vertical };
  }
  if (input.resolution.kind === "1:1") {
    return { kind: "profile", profile: input.oneToOne };
  }
  return { kind: "unavailable", reason: input.resolution };
}
