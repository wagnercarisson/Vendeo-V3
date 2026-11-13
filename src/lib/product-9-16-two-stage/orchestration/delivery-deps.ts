import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/server";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { runSquareBase, type SquareBaseDeps } from "@/lib/campaign/square-base/run-square-base";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { createDefaultThumbnailContext } from "@/lib/campaign/thumbnail/thumbnail-generator";
import type {
  ThumbnailContext,
  ThumbnailUploader,
} from "@/lib/campaign/thumbnail/thumbnail-generator";
import { THUMBNAIL_BUCKET } from "@/lib/campaign/thumbnail/thumbnail-path";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";
import { generateSupportReference } from "@/lib/ai/image-generation-support-reference";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import {
  projectDeliveredCampaign,
  type ProjectDeliveredCampaignResult,
} from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";
import { TwoStageFinancialService } from "../two-stage-financial-service";
import type { RunNineSixteenDeps } from "./types";
import { CompositionVerticalProbe } from "./vertical-probe";

export interface NineSixteenDepsOptions {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
  readonly probeVertical?: RunNineSixteenDeps["probeVertical"];
  readonly generateThumbnail?: RunNineSixteenDeps["generateThumbnail"];
  readonly projectDelivered?: RunNineSixteenDeps["projectDelivered"];
  readonly pilotSpend?: unknown;
  readonly copyOps?: SquareBaseDeps["copyOps"];
  readonly copyInvoker?: SquareBaseDeps["copyInvoker"];
  readonly copyDirectorEnabled?: boolean;
}

async function projectCompositionDelivery(
  client: SupabaseClient,
  input: { storeId: string; campaignId: string; operationId: string },
): Promise<ProjectDeliveredCampaignResult> {
  const row = await getArtifactByIdentity(
    {
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      role: "vertical",
    },
    client,
  );
  if (row.kind !== "found") {
    return { projected: false, reason: "artifact_missing" };
  }
  return projectDeliveredCampaign(
    {
      ...input,
      source: {
        kind: "composition",
        role: "vertical",
        expectedPath: row.record.storagePath,
      },
    },
    { client },
  );
}

/**
 * Contexto da miniatura SEMPRE vinculado ao cliente autorizado. Com o cliente
 * global, preserva o uploader com timeout; com um cliente injetado, o upload
 * passa pelo MESMO cliente (nunca pelo ambiente global).
 */
function thumbnailContextFor(client: SupabaseClient): ThumbnailContext | null {
  if (client === supabaseAdmin) return createDefaultThumbnailContext();

  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (typeof raw !== "string" || raw.trim() === "") return null;
  let endpoint: string;
  try {
    endpoint = new URL(raw).origin;
  } catch {
    return null;
  }

  const uploader: ThumbnailUploader = {
    endpoint,
    async upload({ path, buffer, contentType }) {
      const { error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .upload(path, buffer, { contentType, upsert: false });
      return { error: error ?? null };
    },
  };
  return { endpoint, uploader };
}

/**
 * Composição ÚNICA das dependências reais do orquestrador. Nenhuma rota
 * two-stage deve montar `RunNineSixteenDeps` à mão nem usar o store vertical
 * direto.
 */
export function createNineSixteenDeps(
  options: NineSixteenDepsOptions = {},
): RunNineSixteenDeps {
  const client = options.client ?? supabaseAdmin;
  const control = new ProductTwoStageOperationClient(client);
  const credit = new ProductOneToOneCreditOperationClient(client);
  const financial = new TwoStageFinancialService({ client, control, credit });
  const probeVertical =
    options.probeVertical ?? new CompositionVerticalProbe({ client });

  const base: RunNineSixteenDeps["base"] = (input, deps) =>
    runSquareBase(input, {
      client,
      ...(deps ?? {}),
      ...(options.copyOps === undefined ? {} : { copyOps: options.copyOps }),
      ...(options.copyInvoker === undefined
        ? {}
        : { copyInvoker: options.copyInvoker }),
      ...(options.copyDirectorEnabled === undefined
        ? {}
        : { copyDirectorEnabled: options.copyDirectorEnabled }),
    });

  const prepare: RunNineSixteenDeps["prepare"] = (input, deps) =>
    prepareSquareForExpansion(input, { client, ...(deps ?? {}) });

  const expand: RunNineSixteenDeps["expand"] = (input, deps) =>
    expandVerticalToNineSixteen(input, { client, ...(deps ?? {}) });

  const readFrozen: RunNineSixteenDeps["readFrozenState"] = (input, deps) =>
    readSquareBaseFrozenState(input, { client, ...(deps ?? {}) });

  const projectClosed: RunNineSixteenDeps["projectClosed"] = (input, deps) =>
    projectClosedCampaign(input, { client, ...(deps ?? {}) });

  const thumbnailContext = thumbnailContextFor(client);

  const generateThumbnail: RunNineSixteenDeps["generateThumbnail"] =
    options.generateThumbnail ??
    (async (input) => {
      const retrieved = await retrieveCompositionArtifact(
        {
          identity: {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            role: "vertical",
          },
          authorization: { kind: "system" },
        },
        { client },
      );
      if (retrieved.kind !== "integral") {
        return { status: "skipped", reason: "ineligible_path" };
      }
      return generateCampaignThumbnailSafely({
        originalPath: retrieved.artifact.storagePath,
        originalBuffer: retrieved.bytes,
        context: thumbnailContext,
        campaignId: input.campaignId,
      });
    });

  const projectDelivered: RunNineSixteenDeps["projectDelivered"] =
    options.projectDelivered ??
    ((input) => projectCompositionDelivery(client, input));

  return Object.freeze({
    control,
    financial,
    credit,
    clock: options.clock ?? (() => Date.now()),
    callIdFactory: options.callIdFactory ?? (() => crypto.randomUUID()),
    newSupportReference: generateSupportReference,
    base,
    prepare,
    expand,
    readFrozenState: readFrozen,
    projectDelivered,
    projectClosed,
    probeVertical,
    generateThumbnail,
    reconstruction: { client },
    ...(options.pilotSpend === undefined ? {} : { pilotSpend: options.pilotSpend }),
  });
}
