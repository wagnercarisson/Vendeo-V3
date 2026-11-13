import type { ProductOneToOneBackgroundDirection } from "@/lib/product-1-1/background-direction";
import type { ProductOneToOneCopyContext } from "@/lib/product-1-1/copy/default-copy-runner";
import type { ProductOneToOneIntent } from "@/lib/product-1-1/intent-selection";
import type { ProductPromptCompositionBriefing } from "@/lib/product-1-1/policies/types";
import type {
  CampaignResumeContext,
  DurableInputDescriptor,
} from "./types";

export interface NineSixteenResumeContextInput {
  readonly briefing: ProductPromptCompositionBriefing;
  readonly campaignIntent: ProductOneToOneIntent;
  readonly backgroundDirection: ProductOneToOneBackgroundDirection;
  readonly identityDirective: string | null;
  readonly identityContext: unknown | null;
  readonly copyContext: ProductOneToOneCopyContext | null;
  readonly economicSnapshot: {
    readonly usdBrlRateAtGeneration: number | null;
    readonly creditValueBrlAtGeneration: number | null;
  };
  readonly inputFiles: readonly DurableInputDescriptor[];
}

export type BuildResumeContextResult =
  | { readonly ok: true; readonly context: CampaignResumeContext }
  | { readonly ok: false; readonly reason: "identity_inside_briefing" | "invalid_input" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function buildNineSixteenResumeContext(
  input: NineSixteenResumeContextInput,
): BuildResumeContextResult {
  if (!isRecord(input.briefing)) return { ok: false, reason: "invalid_input" };
  if (Object.prototype.hasOwnProperty.call(input.briefing, "identity")) {
    return { ok: false, reason: "identity_inside_briefing" };
  }
  const briefing = Object.freeze({ ...input.briefing });
  return {
    ok: true,
    context: Object.freeze({
      briefing,
      briefingText: JSON.stringify(briefing),
      campaignIntent: input.campaignIntent,
      backgroundDirection: input.backgroundDirection,
      identityDirective: input.identityDirective,
      identityContext: input.identityContext,
      copyContext: input.copyContext,
      economicSnapshot: Object.freeze({ ...input.economicSnapshot }),
      inputFiles: Object.freeze([...input.inputFiles]),
    }),
  };
}
