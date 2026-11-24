import { NextRequest, NextResponse } from "next/server";

import { requireSameOrigin } from "@/lib/auth/csrf";
import { apiHandler } from "@/lib/auth/api-handler";
import { requireApiUser } from "@/lib/auth/require-user";
import { requireOwnership } from "@/lib/auth/store-ownership";
import { notFound } from "@/lib/api-error-response";
import { getCampaign } from "@/lib/campaign/persistence";
import { resolveCampaignFormat } from "@/lib/campaign/format-resolution";
import {
  readSquareReleaseArtifact,
  readSquareReleaseStateForApi,
  releaseSquare,
} from "@/lib/campaign/square-release";
import type {
  SquareReleaseIdentity,
  SquareReleaseResult,
} from "@/lib/campaign/square-release";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { supabaseAdmin } from "@/lib/supabase/server";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ReleaseContext {
  readonly identity: SquareReleaseIdentity;
}

function stateResponse(state: SquareReleaseResult): NextResponse {
  return NextResponse.json({
    state: state.state,
    ...(state.state === "eligible" ? { costCredits: 1 } : {}),
    ...(state.refunded ? { refunded: true } : {}),
    ...(state.reason === null ? {} : { reason: state.reason }),
  });
}

async function resolveContext(
  campaignId: string,
  campaign: {
    readonly store_id: string;
    readonly input_snapshot: Record<string, unknown> | null;
  },
): Promise<
  | { readonly kind: "ok"; readonly context: ReleaseContext }
  | { readonly kind: "incompatible" }
  | { readonly kind: "unknown" }
> {
  if (resolveCampaignFormat(campaign.input_snapshot).kind !== "9:16") {
    return { kind: "incompatible" };
  }

  let operation: Awaited<
    ReturnType<ProductOneToOneAttemptStartClient["getCampaignOperation"]>
  >;
  try {
    operation =
      await new ProductOneToOneAttemptStartClient().getCampaignOperation(
        campaignId,
      );
  } catch {
    return { kind: "unknown" };
  }
  if (!operation || operation.status !== "delivered") {
    return { kind: "incompatible" };
  }

  const artifact = await readSquareReleaseArtifact(
    {
      storeId: campaign.store_id,
      campaignId,
      verticalOperationId: operation.operationId,
    },
    { client: supabaseAdmin },
  );
  if (artifact.kind === "absent") return { kind: "incompatible" };
  if (artifact.kind === "read_failed") return { kind: "unknown" };

  return {
    kind: "ok",
    context: {
      identity: {
        storeId: campaign.store_id,
        campaignId,
        verticalOperationId: operation.operationId,
        artifactId: artifact.artifact.artifactId,
        checksumSha256: artifact.artifact.checksumSha256,
      },
    },
  };
}

export const GET = apiHandler(
  async (
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    const user = await requireApiUser();
    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) return notFound("Campaign not found");

    const campaign = await getCampaign(id);
    if (!campaign) return notFound("Campaign not found");
    await requireOwnership(campaign.store_id, user.userId);

    const resolved = await resolveContext(id, campaign);
    if (resolved.kind === "incompatible") {
      return stateResponse({
        state: "incompatible",
        reason: "operation_unavailable",
        refunded: false,
      });
    }
    if (resolved.kind === "unknown") {
      return stateResponse({
        state: "unknown",
        reason: "operation_unavailable",
        refunded: false,
      });
    }

    const state = await readSquareReleaseStateForApi(resolved.context.identity, {
      client: supabaseAdmin,
    });
    return stateResponse(state);
  },
);

export const POST = apiHandler(
  async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
  ) => {
    requireSameOrigin(request);
    const user = await requireApiUser();
    const { id } = await params;
    if (!UUID_V4_REGEX.test(id)) return notFound("Campaign not found");

    const campaign = await getCampaign(id);
    if (!campaign) return notFound("Campaign not found");
    await requireOwnership(campaign.store_id, user.userId);

    const resolved = await resolveContext(id, campaign);
    if (resolved.kind === "incompatible") {
      return stateResponse({
        state: "incompatible",
        reason: "operation_unavailable",
        refunded: false,
      });
    }
    if (resolved.kind === "unknown") {
      return stateResponse({
        state: "unknown",
        reason: "operation_unavailable",
        refunded: false,
      });
    }

    const state = await releaseSquare(
      {
        storeId: campaign.store_id,
        campaignId: id,
        verticalOperationId: resolved.context.identity.verticalOperationId,
      },
      { client: supabaseAdmin },
    );
    return stateResponse(state);
  },
);
