import "server-only";

import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import { readNineSixteenExpansionConfig } from "@/lib/ai/nine-sixteen-expansion-model-config-service";
import type { ExpansionSelection } from "@/lib/ai/nine-sixteen-expansion-model-config";
import {
  createDefaultThumbnailContext,
  type ThumbnailContext,
  type ThumbnailUploader,
} from "@/lib/campaign/thumbnail/thumbnail-generator";
import { THUMBNAIL_BUCKET } from "@/lib/campaign/thumbnail/thumbnail-path";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { repairFrozenEvidence } from "@/lib/campaign/square-base/config";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import {
  runSquareBase,
  type SquareBaseDeps,
} from "@/lib/campaign/square-base/run-square-base";
import type {
  SquareBaseInput,
  SquareBaseResult,
} from "@/lib/campaign/square-base/types";
import { downloadCampaignInputFileWithClient } from "@/lib/campaign/persistence";
import { preflightExpansionToNineSixteen } from "@/lib/campaign/vertical-expansion/model";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { supabaseAdmin } from "@/lib/supabase/server";

import { TwoFormatJointFinancialClient } from "../joint-financial-client";
import type { JointPreflightDeps } from "./preflight";
import {
  CompositionSquareOriginalProbe,
  type JointSquareProbe,
} from "./square-probe";

/**
 * F60.7 Subfatia B — composição única das dependências conjuntas.
 *
 * TODAS as leituras usam o MESMO client injetado (nunca o global quando um
 * client é fornecido): preflight, reconstrução (campanha, inputs, congelado e
 * reparo), controle de etapas, base, sondas e publicação.
 *
 * O composition root não executa RPC na construção.
 */

export interface JointOrchestrationDeps {
  readonly client: SupabaseClient;
  readonly jointClient: TwoFormatJointFinancialClient;
  readonly credit: {
    beginPublication(
      campaignId: string,
      operationId: string,
    ): Promise<{ acquired: boolean; token: string | null; publicationState: string }>;
    abortPublication(
      campaignId: string,
      operationId: string,
      publicationToken: string,
      phase: "before_upload",
    ): Promise<{ success: boolean; reason?: string }>;
    getPublicationEpoch(campaignId: string, operationId: string): Promise<number>;
  };
  readonly preflight: JointPreflightDeps;
  readonly control: ProductTwoStageOperationClient;
  readonly base: (
    input: SquareBaseInput,
    deps?: SquareBaseDeps,
  ) => Promise<SquareBaseResult>;
  readonly readFrozenState: typeof readSquareBaseFrozenState;
  readonly readInputBytes: (storagePath: string) => Promise<
    Awaited<ReturnType<typeof downloadCampaignInputFileWithClient>>
  >;
  readonly repairEvidence: typeof repairFrozenEvidence;
  readonly probeSquare: JointSquareProbe;
  readonly probeVertical: CompositionVerticalProbe;
  readonly generateThumbnail: (input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    role: "square_original" | "vertical";
    storagePath: string;
  }) => Promise<unknown>;
  readonly clock: () => number;
  readonly callIdFactory: () => string;
}

export interface JointDepsOptions {
  readonly client?: SupabaseClient;
  readonly clock?: () => number;
  readonly callIdFactory?: () => string;
  /** Contexto injetável nos testes; default derivado do client. */
  readonly thumbnailContext?: ThumbnailContext | null;
}

/**
 * Contexto de miniatura vinculado ao MESMO client (replica o padrão de
 * `delivery-deps` sem alterar aquele módulo). O artefato original permanece no
 * bucket interno; só a miniatura vai para `campaign-images`.
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

export function createJointDeps(
  options: JointDepsOptions = {},
): JointOrchestrationDeps {
  const client = options.client ?? supabaseAdmin;
  const creditClient = new ProductOneToOneCreditOperationClient(client);
  const thumbnailContext =
    options.thumbnailContext === undefined
      ? thumbnailContextFor(client)
      : options.thumbnailContext;

  const generateThumbnail: JointOrchestrationDeps["generateThumbnail"] =
    async (input) => {
      const retrieved = await retrieveCompositionArtifact(
        {
          identity: {
            storeId: input.storeId,
            campaignId: input.campaignId,
            operationId: input.operationId,
            role: input.role,
          },
          authorization: { kind: "system" },
        },
        { client },
      );
      if (retrieved.kind !== "integral") {
        return { status: "skipped", reason: "ineligible_path" };
      }
      if (thumbnailContext === null) {
        return { status: "skipped", reason: "ineligible_path" };
      }
      return generateCampaignThumbnailSafely({
        originalPath: retrieved.artifact.storagePath,
        originalBuffer: retrieved.bytes,
        context: thumbnailContext,
        campaignId: input.campaignId,
      });
    };

  return Object.freeze({
    client,
    jointClient: new TwoFormatJointFinancialClient(client),
    credit: Object.freeze({
      beginPublication: (campaignId: string, operationId: string) =>
        creditClient.beginPublication(campaignId, operationId),
      abortPublication: (
        campaignId: string,
        operationId: string,
        publicationToken: string,
        phase: "before_upload",
      ) => creditClient.abortPublication(campaignId, operationId, publicationToken, phase),
      getPublicationEpoch: (campaignId: string, operationId: string) =>
        creditClient.getPublicationEpoch(campaignId, operationId),
    }),
    preflight: Object.freeze({
      readConfiguration: () =>
        readNineSixteenExpansionConfig({ client }),
      preflightSelection: (selection: ExpansionSelection) =>
        preflightExpansionToNineSixteen({ client }, selection),
    }),
    control: new ProductTwoStageOperationClient(client),
    base: (input: SquareBaseInput, deps: SquareBaseDeps = {}) =>
      runSquareBase(input, { ...deps, client }),
    readFrozenState: (
      input: Parameters<typeof readSquareBaseFrozenState>[0],
      deps: Parameters<typeof readSquareBaseFrozenState>[1] = {},
    ) => readSquareBaseFrozenState(input, { ...deps, client }),
    readInputBytes: (storagePath: string) =>
      downloadCampaignInputFileWithClient(client, storagePath),
    repairEvidence: (
      input: Parameters<typeof repairFrozenEvidence>[0],
      deps: Parameters<typeof repairFrozenEvidence>[1] = {},
    ) => repairFrozenEvidence(input, { ...deps, client }),
    probeSquare: new CompositionSquareOriginalProbe({ client }),
    probeVertical: new CompositionVerticalProbe({ client }),
    generateThumbnail,
    clock: options.clock ?? (() => Date.now()),
    callIdFactory: options.callIdFactory ?? (() => randomUUID()),
  });
}
