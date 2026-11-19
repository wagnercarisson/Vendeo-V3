import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";

import { createFakeArtifactBackend } from "@/lib/campaign/__tests__/support/fake-artifact-backend";
import {
  buildCandidatePayload,
} from "@/lib/campaign/square-base/run-square-base";
import {
  frozenFingerprint,
  serializeFrozenPayload,
} from "@/lib/campaign/square-base/frozen-state";
import { composeSquareBasePrompt } from "@/lib/campaign/square-base/prompt";
import { COMPOSITION_ARTIFACT_BUCKET } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { VERTICAL_COMPOSITION_FIXTURES } from "@/lib/product-vertical-9-16/__tests__/fixtures/vertical-briefings";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { AiInvocationResult } from "@/lib/ai/types";
import { AiInvocationError } from "@/lib/ai/types";
import type { SquareBaseDeps } from "@/lib/campaign/square-base/run-square-base";
import type { SquareBaseInput } from "@/lib/campaign/square-base/types";
import type { ExpandVerticalSeams } from "@/lib/campaign/vertical-expansion/expand";
import type {
  RunNineSixteenDeps,
  RunNineSixteenInput,
} from "@/lib/product-9-16-two-stage/orchestration/types";
import type { TwoStageStepStatus } from "@/lib/product-9-16-two-stage/types";
import { deriveFrozenExpansionSelection } from "@/lib/product-9-16-two-stage/orchestration/delivery-deps";
import { ProductTwoStageOperationClient } from "@/lib/product-9-16-two-stage/two-stage-operation-client";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
import { ProductOneToOneAttemptStartClient } from "@/lib/product-1-1/orchestration/attempt-start-client";
import { TwoStageFinancialService } from "@/lib/product-9-16-two-stage/two-stage-financial-service";
import { CompositionVerticalProbe } from "@/lib/product-9-16-two-stage/orchestration/vertical-probe";
import { prepareSquareForExpansion } from "@/lib/campaign/square-preparation/prepare";
import { expandVerticalToNineSixteen } from "@/lib/campaign/vertical-expansion/expand";
import { preflightExpansionToNineSixteen } from "@/lib/campaign/vertical-expansion/model";
import { runPreparationStep } from "@/lib/product-9-16-two-stage/orchestration/preparation-step";
import { runExpansionStep } from "@/lib/product-9-16-two-stage/orchestration/expansion-step";
import { readNineSixteenExpansionConfig } from "@/lib/ai/nine-sixteen-expansion-model-config-service";
import { readSquareBaseFrozenState } from "@/lib/campaign/square-base/frozen-state";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { downloadCampaignInputFileWithClient } from "@/lib/campaign/persistence";
import { generateSupportReference } from "@/lib/ai/image-generation-support-reference";
import { retrieveCompositionArtifact } from "@/lib/campaign/composition-artifacts/retrieve";
import { getArtifactByIdentity } from "@/lib/campaign/composition-artifacts/repository";
import { generateCampaignThumbnailSafely } from "@/lib/campaign/thumbnail/thumbnail-safe";
import type { ThumbnailContext } from "@/lib/campaign/thumbnail/thumbnail-generator";
import { THUMBNAIL_BUCKET } from "@/lib/campaign/thumbnail/thumbnail-path";
import { runSquareBase } from "@/lib/campaign/square-base/run-square-base";
import { runSquareBaseCopy } from "@/lib/campaign/square-base/copy";
import {
  reconstructFirstExecution,
  reconstructForComplete,
  reconstructForRepair,
} from "@/lib/product-9-16-two-stage/orchestration/reconstruction";
import { TwoFormatJointFinancialClient } from "@/lib/product-two-format/joint-financial-client";
import { readTwoFormatDelivery } from "@/lib/product-two-format/delivery-reader";
import { createJointDeps } from "@/lib/product-two-format/orchestration/joint-deps";
import { runJointBase } from "@/lib/product-two-format/orchestration/joint-base";
import { deliverJointSquare } from "@/lib/product-two-format/orchestration/deliver-square";
import { deliverTwoFormatVertical } from "@/lib/product-two-format/orchestration/deliver-joint-vertical";
import { repairJointProjection } from "@/lib/product-two-format/orchestration/repair-joint-projection";
import { CompositionSquareOriginalProbe } from "@/lib/product-two-format/orchestration/square-probe";

export const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
export const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
export const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
export const SQUARE_DELIVERY_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";

const BRIEFING = VERTICAL_COMPOSITION_FIXTURES.find(
  (fixture) => fixture.id === "offer-studio",
)!.briefing;
const COPY_CONTEXT = {
  storeName: "Loja Integrada",
  segment: "variedades-utilidades",
  toneOfVoice: "amigavel",
} as never;

export const PRODUCT_BYTES = Buffer.from("durable-product-image-bytes");
export const PRODUCT_DATA_URL = `data:image/png;base64,${PRODUCT_BYTES.toString("base64")}`;
export const PRODUCT_CONTENT_ID = createHash("sha256")
  .update(PRODUCT_DATA_URL)
  .digest("hex");
export const PRODUCT_STORAGE_PATH = `${STORE_ID}/${CAMPAIGN_ID}/inputs/${PRODUCT_CONTENT_ID}.png`;

const RESUME_CONTEXT = {
  briefing: BRIEFING,
  briefingText: JSON.stringify(BRIEFING),
  campaignIntent: "offer",
  backgroundDirection: "studio",
  identityDirective: null,
  identityContext: null,
  copyContext: COPY_CONTEXT,
  economicSnapshot: {
    usdBrlRateAtGeneration: 5.1,
    creditBrlAtGeneration: 1,
    creditValueBrlAtGeneration: 1,
  },
  inputFiles: [
    {
      kind: "product",
      role: "primary",
      index: 0,
      contentId: PRODUCT_CONTENT_ID,
      storagePath: PRODUCT_STORAGE_PATH,
      mimeType: "image/png",
      dataUrlPrefix: "data:image/png;base64,",
      byteSize: PRODUCT_BYTES.byteLength,
    },
  ],
};

const FROZEN_REFERENCES = [
  { kind: "product", id: PRODUCT_CONTENT_ID, role: "primary", index: 0 },
];

type Row = Record<string, unknown>;
type RpcCounts = Record<string, number>;

interface CreditRow extends Row {
  campaign_id: string;
  operation_id: string;
  store_id: string;
  amount: number;
  status: "reserved" | "art_uploaded" | "delivered" | "refunded";
  state_epoch: number;
  publication_state: string;
  publication_token: string | null;
}

interface ClaimRow extends Row {
  id: string;
  campaign_id: string;
  operation_id: string;
  stage: "base" | "expansion";
  attempt_number: number;
  target: string;
  request_id: string;
  status: "in_progress" | "completed" | "failed" | "abandoned";
  failure_class: string | null;
  attempt_token: string;
}

function copy(row: Row): Row {
  return JSON.parse(JSON.stringify(row)) as Row;
}

/**
 * Simula o round-trip JSONB do Postgres: objetos voltam com as chaves em outra
 * ordem (aqui, invertida recursivamente). Arrays preservam a ordem; strings
 * (inclusive `briefingText`) NAO sao tocadas.
 */
function reorderJsonbKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorderJsonbKeys);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    return Object.fromEntries(
      entries
        .slice()
        .reverse()
        .map(([key, entry]) => [key, reorderJsonbKeys(entry)]),
    );
  }
  return value;
}

function shapeRow(row: Row): Row {
  if (row.__table !== "campaigns") return row;
  return {
    ...row,
    input_snapshot:
      row.input_snapshot === null || row.input_snapshot === undefined
        ? row.input_snapshot
        : reorderJsonbKeys(row.input_snapshot),
    identity_snapshot:
      row.identity_snapshot === null || row.identity_snapshot === undefined
        ? row.identity_snapshot
        : reorderJsonbKeys(row.identity_snapshot),
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Fronteira DB/Storage simulada por completo, com o estado de controle 9:16 e
 * de credito reproduzindo os contratos das RPCs. Nenhum banco/Storage real.
 */
export function createJointOfflineWorld() {
  const base = createFakeArtifactBackend();
  base.seedStore(STORE_ID, "user-1");
  base.seedCampaign(CAMPAIGN_ID, STORE_ID);

  const rows: Row[] = [];
  const rpcCounts: RpcCounts = {};
  const rpcOrder: string[] = [];
  const refundFailures = new Map<string, "throw" | "deliver">();
  let beginBarrier: { count: number; release: () => void; promise: Promise<void> } | null =
    null;
  const clockBase = Date.now();
  let snapshotSeq = 0;

  const tableRows = (table: string) => rows.filter((row) => row.__table === table);
  const creditRowFor = (operationId: string = OPERATION_ID): CreditRow | null =>
    (tableRows("product_1_1_campaign_credit_operations").find(
      (row) => row.operation_id === operationId,
    ) as CreditRow | undefined) ?? null;
  const creditRow = (): CreditRow | null => creditRowFor(OPERATION_ID);
  const steps = () => tableRows("product_9_16_two_stage_steps");
  const step = (stage: "base" | "expansion") =>
    steps().find((row) => row.stage === stage);
  const claims = () => tableRows("product_9_16_two_stage_attempt_claims") as ClaimRow[];
  const outcome = () => tableRows("product_9_16_two_stage_outcomes")[0] ?? null;
  const operation = () => tableRows("product_9_16_two_stage_operations")[0] ?? null;

  const orderers: Record<string, (a: Row, b: Row) => number> = {
    attempt_number: (a, b) => Number(a.attempt_number) - Number(b.attempt_number),
  };

  function selectRows(table: string, filters: [string, unknown][], order?: [string, boolean]) {
    let matched = tableRows(table).filter((row) =>
      filters.every(([column, value]) =>
        value === null || value === undefined
          ? row[column] === null || row[column] === undefined
          : row[column] === value,
      ),
    );
    if (order) {
      const comparator = orderers[order[0]];
      if (comparator) matched = [...matched].sort(order[1] ? comparator : (a, b) => comparator(b, a));
    }
    return matched.map((row) => copy(shapeRow(row)));
  }

  function builder(table: string, filters: [string, unknown][] = [], order?: [string, boolean]) {
    const self: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return self;
      },
      is(column: string, value: unknown) {
        filters.push([column, value]);
        return self;
      },
      in(column: string, values: unknown[]) {
        const accepted = new Set(values);
        filters.push([column, "__in__"]);
        // Representa `in` removendo o filtro especial logo abaixo.
        filters.pop();
        const existing = tableRows(table).filter((row) =>
          filters.every(([candidate, expected]) => row[candidate] === expected),
        );
        const selected = existing.filter((row) => accepted.has(row[column]));
        return {
          ...self,
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve({ data: selected.map(copy), error: null }).then(resolve);
          },
        };
      },
      order(column: string, options?: { ascending?: boolean }) {
        return builder(table, filters, [column, options?.ascending !== false]);
      },
      limit() {
        return builder(table, filters, order);
      },
      range() {
        return builder(table, filters, order);
      },
      async maybeSingle() {
        const [first] = selectRows(table, filters, order);
        return { data: first ?? null, error: null };
      },
      async single() {
        const [first] = selectRows(table, filters, order);
        return first
          ? { data: first, error: null }
          : { data: null, error: { message: "not_found" } };
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({
          data: selectRows(table, filters, order),
          error: null,
        }).then(resolve);
      },
    };
    return self;
  }

  function updateBuilder(table: string, patch: Row) {
    const filters: [string, unknown][] = [];
    const apply = () => {
      const matched = tableRows(table).filter((row) =>
        filters.every(([column, value]) => row[column] === value),
      );
      for (const row of matched) Object.assign(row, patch);
      return matched.map(copy);
    };
    const self: Record<string, unknown> = {
      eq(column: string, value: unknown) {
        filters.push([column, value]);
        return self;
      },
      select() {
        return Promise.resolve({ data: apply(), error: null });
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve({ data: apply(), error: null }).then(resolve);
      },
    };
    return self;
  }

  function insertBuilder(table: string, value: Row | Row[]) {
    const list = Array.isArray(value) ? value : [value];
    for (const row of list) rows.push({ ...row, __table: table });
    return {
      select: () => ({
        single: async () => ({ data: copy(list[0]), error: null }),
      }),
    };
  }

  interface ArtifactQueryLike {
    eq(column: string, value: unknown): ArtifactQueryLike;
    is(column: string, value: unknown): ArtifactQueryLike;
    order(column?: string, options?: unknown): ArtifactQueryLike;
    limit(count?: number): ArtifactQueryLike;
    maybeSingle(): Promise<{ data: Row | null; error: unknown }>;
    single(): Promise<{ data: Row | null; error: unknown }>;
  }
  interface ArtifactTableLike {
    select(columns?: string): ArtifactQueryLike;
    insert(value: Row | Row[]): unknown;
    update(patch: Row): unknown;
    delete(): unknown;
  }

  function artifactAlias(row: Row | null): Row | null {
    if (row === null) return null;
    return { ...row, artifact_path: row.artifact_path ?? row.storage_path };
  }

  function artifactTable(): ArtifactTableLike {
    const source = base.client.from(
      "campaign_composition_artifacts",
    ) as unknown as ArtifactTableLike;
    return {
      select() {
        const query = source.select();
        const wrapped: ArtifactQueryLike = {
          eq(column, value) {
            query.eq(column, value);
            return wrapped;
          },
          is(column, value) {
            query.is(column, value);
            return wrapped;
          },
          order(column, options) {
            query.order(column, options);
            return wrapped;
          },
          limit(count) {
            query.limit(count);
            return wrapped;
          },
          async maybeSingle() {
            const result = await query.maybeSingle();
            return { data: artifactAlias(result.data), error: result.error };
          },
          async single() {
            const result = await query.single();
            return { data: artifactAlias(result.data), error: result.error };
          },
        };
        return wrapped;
      },
      insert: (value) => source.insert(value),
      update: (patch) => source.update(patch),
      delete: () => source.delete(),
    };
  }

  function from(table: string) {
    if (table === "campaign_composition_artifacts") {
      return artifactTable();
    }
    return {
      select: () => builder(table),
      insert: (value: Row | Row[]) => insertBuilder(table, value),
      update: (patch: Row) => updateBuilder(table, patch),
    };
  }

  function seedScenario() {
    rows.push({
      __table: "campaigns",
      id: CAMPAIGN_ID,
      store_id: STORE_ID,
      status: "generating",
      storage_path: `${STORE_ID}/${CAMPAIGN_ID}`,
      error_message: null,
      input_snapshot: {
        resumeContext: RESUME_CONTEXT,
        frozenContentReferences: FROZEN_REFERENCES,
        generationOrigin: "two_format_two_stage",
        generationContractVersion: "f60.7-two-format-v1",
        campaignFormat: "1:1+9:16",
        formatContractVersion: "f60.7-two-format-v1",
      },
      identity_snapshot: null,
    });
    base.putObject(PRODUCT_STORAGE_PATH, PRODUCT_BYTES, {}, "campaign-images");
    rows.push(
      {
        __table: "nine_sixteen_expansion_model_config",
        scope: "expansion",
        model: "gpt-image-2.5-sunburst",
        quality: "low",
        config_version_id: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
        reason: null,
        updated_by: null,
        updated_at: "2026-11-18T00:00:00.000Z",
        created_at: "2026-11-18T00:00:00.000Z",
      },
      {
        __table: "ai_model_catalog",
        id: "0f7f1c1a-5f2b-4a4b-9d1e-2a3b4c5d6e7f",
        capability: "campaign_product_image",
        segment: "product",
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        protocol: "images",
        label: null,
        status: "active",
        source_note: null,
        validated_at: null,
        created_at: "2026-11-18T00:00:00.000Z",
        updated_at: "2026-11-18T00:00:00.000Z",
      },
      {
        __table: "ai_model_pricing",
        id: "pricing-1",
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        quality: "low",
        effective_until: null,
        input_token_usd_per_1m: 1,
        output_token_usd_per_1m: 2,
        cached_input_token_usd_per_1m: 0.5,
        image_unit_usd: 0.05,
        image_token_usd_per_1m: 4,
        image_input_token_usd_per_1m: 3,
        image_cached_input_token_usd_per_1m: 5,
      },
    );
  }

  function seedFrozenState(input: {
    snapshotId: string;
    fingerprint: string;
    serialized: string;
    payload: ReturnType<typeof buildCandidatePayload> extends infer T
      ? NonNullable<T>
      : never;
  }) {
    rows.push({
      __table: "image_generation_config_snapshots",
      id: input.snapshotId,
      campaign_id: CAMPAIGN_ID,
      primary_model: "gpt-image-2.5-sunburst",
      primary_quality: "medium",
      fallback_model: "gpt-image-2",
      fallback_quality: "low",
      config_version_id: "cfg-1",
      origin: "selection",
      run_id: null,
      trace_id: null,
      created_at: "2026-11-13T00:00:00.000Z",
    });
    rows.push({
      __table: "product_1_1_snapshot_content_binding",
      snapshot_original_id: input.snapshotId,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      content_fingerprint: input.fingerprint,
    });
    rows.push({
      __table: "product_1_1_snapshot_frozen_evidence",
      id: "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e",
      snapshot_original_id: input.snapshotId,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      campaign_intent: input.payload.campaignIntent,
      background_direction: input.payload.backgroundDirection,
      briefing: input.serialized,
      reference_selections: input.payload.referenceSelections,
      base_version: input.payload.promptBaseVersion,
      composer_version: input.payload.composerVersion,
      policy_versions: input.payload.policyVersions,
    });
  }

  /**
   * Semeia uma operação JÁ EXISTENTE sem passar pelo orquestrador, para provar
   * a derivação do congelado em operações legadas (v1) e em operações v2
   * incompletas. Nunca usado para simular o caminho de geração nova.
   */
  function seedOperation(input: {
    contractVersion: 1 | 2;
    selection?: Row;
  }) {
    rows.push({
      __table: "product_9_16_two_stage_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: STORE_ID,
      origin: "9_16_two_stage",
      contract_version: input.contractVersion,
      expansion_model: input.selection?.expansion_model ?? null,
      expansion_quality: input.selection?.expansion_quality ?? null,
      expansion_config_version_id: input.selection?.expansion_config_version_id ?? null,
      expansion_selection_origin: input.selection?.expansion_selection_origin ?? null,
    });
    rows.push(
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "base",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "expansion",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
    );
    rows.push({
      __table: "product_1_1_campaign_credit_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: STORE_ID,
      amount: 1,
      status: "reserved",
      state_epoch: 0,
      publication_state: "none",
      publication_token: null,
      credit_tx_id: "tx-1",
      refund_tx_id: null,
    });
  }

  function seedJointState(input: {
    squareStatus?: CreditRow["status"];
    verticalStatus?: CreditRow["status"];
    squareOutcome?: "failed" | "unknown";
    sharedOutcome?: "failed" | "unknown";
    activeClaim?: boolean;
    campaignStatus?: string;
  } = {}) {
    for (let index = rows.length - 1; index >= 0; index -= 1) {
      const table = rows[index].__table;
      if (
        table === "product_two_format_deliveries" ||
        table === "product_1_1_campaign_credit_operations" ||
        table === "product_1_1_generation_outcomes" ||
        table === "product_9_16_two_stage_outcomes" ||
        table === "product_generation_active_claims_v"
      ) {
        rows.splice(index, 1);
      }
    }
    const campaign = tableRows("campaigns").find((row) => row.id === CAMPAIGN_ID);
    if (campaign) campaign.status = input.campaignStatus ?? "generating";
    rows.push(
      {
        __table: "product_1_1_campaign_credit_operations",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        store_id: STORE_ID,
        amount: 1,
        status: input.verticalStatus ?? "reserved",
        state_epoch: 0,
        publication_state: "none",
        publication_token: null,
        credit_tx_id: "tx-control",
        refund_tx_id: input.verticalStatus === "refunded" ? "refund-control" : null,
      },
      {
        __table: "product_1_1_campaign_credit_operations",
        campaign_id: CAMPAIGN_ID,
        operation_id: SQUARE_DELIVERY_ID,
        store_id: STORE_ID,
        amount: 1,
        status: input.squareStatus ?? "reserved",
        state_epoch: 0,
        publication_state: "none",
        publication_token: null,
        credit_tx_id: "tx-square",
        refund_tx_id: input.squareStatus === "refunded" ? "refund-square" : null,
      },
      {
        __table: "product_two_format_deliveries",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        store_id: STORE_ID,
        format: "1:1",
        delivery_operation_id: SQUARE_DELIVERY_ID,
        artifact_role: "square_original",
        created_at: "2026-11-18T00:00:00.000Z",
      },
      {
        __table: "product_two_format_deliveries",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        store_id: STORE_ID,
        format: "9:16",
        delivery_operation_id: OPERATION_ID,
        artifact_role: "vertical",
        created_at: "2026-11-18T00:00:00.000Z",
      },
    );
    if (input.sharedOutcome !== undefined) {
      rows.push({
        __table: "product_9_16_two_stage_outcomes",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        outcome: input.sharedOutcome,
        stage: "base",
        support_reference: null,
      });
    }
    if (input.squareOutcome !== undefined) {
      rows.push({
        __table: "product_1_1_generation_outcomes",
        campaign_id: CAMPAIGN_ID,
        operation_id: SQUARE_DELIVERY_ID,
        outcome: input.squareOutcome,
        support_reference: null,
      });
    }
    if (input.activeClaim === true) {
      rows.push({
        __table: "product_generation_active_claims_v",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        status: "in_progress",
      });
    }
  }

  function seedJointArtifact(input: {
    role: "square_original" | "vertical";
    operationId: string;
  }): Promise<void> {
    return seedCompositionArtifact(input);
  }

  async function seedCompositionArtifact(input: {
    role: "square_original" | "vertical";
    operationId: string;
  }): Promise<void> {
    const isSquare = input.role === "square_original";
    const bytes = isSquare
      ? await sharp({
          create: { width: 1024, height: 1024, channels: 3, background: { r: 30, g: 40, b: 50 } },
        }).jpeg({ quality: 80 }).toBuffer()
      : await sharp({
          create: { width: 1080, height: 1920, channels: 3, background: { r: 10, g: 20, b: 30 } },
        }).jpeg({ quality: 80 }).toBuffer();
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const storagePath = `${STORE_ID}/${CAMPAIGN_ID}/${input.operationId}/${input.role}.jpg`;
    base.putObject(storagePath, bytes, {});
    const artifactId = isSquare
      ? "6a7b8c9d-6a7b-4c8d-9e0f-6a7b8c9d0e1f"
      : "7b8c9d0e-7b8c-4d0e-9f1a-7b8c9d0e1f2a";
    base.seedArtifactRow({
      id: artifactId,
      store_id: STORE_ID,
      campaign_id: CAMPAIGN_ID,
      operation_id: input.operationId,
      role: input.role,
      format: isSquare ? "1:1" : "9:16",
      origin: isSquare ? "provider_generation" : "ai_expansion",
      derived_from_artifact_id: isSquare ? null : "6a7b8c9d-6a7b-4c8d-9e0f-6a7b8c9d0e1f",
      source_campaign_id: null,
      storage_bucket: COMPOSITION_ARTIFACT_BUCKET,
      storage_path: storagePath,
      width: isSquare ? 1024 : 1080,
      height: isSquare ? 1024 : 1920,
      mime_type: "image/jpeg",
      byte_size: bytes.byteLength,
      checksum_sha256: checksum,
      provenance: isSquare ? {} : {},
      created_at: "2026-11-18T00:00:00.000Z",
    });
    const evidenceResult = buildObjectEvidence({
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: input.operationId,
      role: input.role,
      origin: isSquare ? "provider_generation" : "ai_expansion",
      sourceKind: isSquare ? "none" : "internal_artifact",
      ...(isSquare ? {} : { sourceArtifactId: "6a7b8c9d-6a7b-4c8d-9e0f-6a7b8c9d0e1f" }),
      width: isSquare ? 1024 : 1080,
      height: isSquare ? 1024 : 1920,
      mimeType: "image/jpeg",
      byteSize: bytes.byteLength,
      checksumSha256: checksum,
      provenance: {},
    } as never);
    if (!evidenceResult.ok) {
      throw new Error(`fixture_evidence_failed:${evidenceResult.reason}`);
    }
    base.setObjectMetadata(storagePath, buildEvidenceMetadata(evidenceResult.evidence));
  }


  function rpc(name: string, params: Record<string, unknown>) {
    rpcCounts[name] = (rpcCounts[name] ?? 0) + 1;
    rpcOrder.push(`${name}:${String(params.p_format ?? params.p_stage ?? "")}`);
    switch (name) {
      case "product_9_16_open_operation":
        return openOperation(params);
      case "product_9_16_open_operation_v2":
        return openOperationV2(params);
      case "product_9_16_acquire_step":
        return acquireStep(params);
      case "product_9_16_finish_step":
        return finishStep(params);
      case "product_9_16_record_outcome":
        return recordOutcome(params);
      case "product_9_16_resume_operation":
        return resumeOperation();
      case "product_1_1_begin_publication":
        return beginPublication(params);
      case "product_1_1_abort_publication":
        return abortPublication(params);
      case "product_1_1_record_generation_outcome":
        return recordSquareOutcome(params);
      case "product_two_format_open_delivery":
        return jointOpen(params);
      case "product_two_format_deliver_format":
        return jointDeliver(params);
      case "product_two_format_refund_format":
        return jointRefund(params);
      case "product_two_format_project_campaign":
        return jointProject();
      case "product_1_1_mark_campaign_credit_art_uploaded":
        return markArtUploaded(params);
      case "product_1_1_deliver_campaign_credit_operation":
        return deliver(params);
      case "product_1_1_get_campaign_credit_operation":
        return getCredit();
      case "product_1_1_get_publication_epoch":
        return creditRowFor(String(params.p_operation_id ?? OPERATION_ID))?.state_epoch ?? null;
      case "product_1_1_persist_snapshot_with_binding":
        return persistSnapshotWithBinding(params);
      case "product_1_1_close_failed_operation":
        return closeFailed(params);
      case "product_1_1_acquire_copy_attempt":
        return acquireCopyAttempt(params);
      case "product_1_1_apply_copy_state":
        return applyCopyState(params);
      case "product_1_1_cancel_copy":
        return cancelCopy(params);
      default:
        return null;
    }
  }

  function stepsEnvelope() {
    return steps().map((row) => ({
      stage: row.stage,
      status: row.status,
      attempts_used: row.attempts_used,
      failure_class: row.failure_class,
    }));
  }

  /**
   * F60.7-05 — fronteira simulada da RPC atômica de snapshot+binding (F60.1).
   *
   * Reproduz as verificações da RPC real
   * (`20261009000003_f56_2b1b_frozen_evidence.sql`):
   * - fingerprint obrigatório;
   * - snapshot idempotente por `campaign_id` (ON CONFLICT DO NOTHING, nunca
   *   alterado) e reuso SOMENTE sob equivalência de par/qualidade/versão/origem;
   * - binding inserido com ON CONFLICT DO NOTHING (`snapshot_original_id` é PK e
   *   `(campaign_id, operation_id)` é UNIQUE) e verificado por
   *   snapshot+campanha+operação+fingerprint.
   * Divergência em qualquer eixo ⇒ `operation_identity_conflict`, sem mutação:
   * nenhuma linha existente é reescrita (o binding real é imutável por trigger).
   */
  function persistSnapshotWithBinding(params: Record<string, unknown>) {
    const campaignId = String(params.p_campaign_id);
    const operationId = String(params.p_operation_id);
    const fingerprint = params.p_content_fingerprint;
    if (typeof fingerprint !== "string" || fingerprint === "") {
      throw new Error("content_fingerprint_required");
    }

    // 1. Snapshot idempotente por campanha: a linha existente NUNCA é alterada.
    const existingSnapshot = tableRows("image_generation_config_snapshots").find(
      (row) => row.campaign_id === campaignId,
    );
    if (existingSnapshot && !snapshotConfigMatches(existingSnapshot, params)) {
      // 2. Reuso só com par/qualidade/versão/origem equivalentes.
      throw new Error("operation_identity_conflict");
    }
    const snapshot =
      existingSnapshot ?? createSnapshotRow(campaignId, params);

    // 3. Binding: ON CONFLICT DO NOTHING em `snapshot_original_id` (PK) e em
    //    `(campaign_id, operation_id)` (UNIQUE).
    const conflicts = tableRows("product_1_1_snapshot_content_binding").some(
      (row) =>
        row.snapshot_original_id === snapshot.id ||
        (row.campaign_id === campaignId && row.operation_id === operationId),
    );
    if (!conflicts) {
      rows.push({
        __table: "product_1_1_snapshot_content_binding",
        snapshot_original_id: snapshot.id,
        campaign_id: campaignId,
        operation_id: operationId,
        content_fingerprint: fingerprint,
      });
    }

    // 4. Equivalência do binding persistido (mesma snapshot, campanha, operação
    //    e fingerprint). Divergência ⇒ conflito, sem reescrever o binding.
    const equivalent = tableRows("product_1_1_snapshot_content_binding").some(
      (row) =>
        row.snapshot_original_id === snapshot.id &&
        row.campaign_id === campaignId &&
        row.operation_id === operationId &&
        row.content_fingerprint === fingerprint,
    );
    if (!equivalent) throw new Error("operation_identity_conflict");

    return {
      snapshot_original_id: snapshot.id,
      reused: conflicts,
      content_fingerprint: fingerprint,
    };
  }

  function snapshotConfigMatches(
    row: Record<string, unknown>,
    params: Record<string, unknown>,
  ): boolean {
    return (
      row.primary_model === String(params.p_primary_model) &&
      row.primary_quality === String(params.p_primary_quality) &&
      row.fallback_model === String(params.p_fallback_model) &&
      row.fallback_quality === String(params.p_fallback_quality) &&
      row.config_version_id === String(params.p_config_version_id) &&
      row.origin === String(params.p_origin)
    );
  }

  function createSnapshotRow(
    campaignId: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> {
    const created = {
      __table: "image_generation_config_snapshots",
      id: nextSnapshotId(),
      campaign_id: campaignId,
      primary_model: String(params.p_primary_model),
      primary_quality: String(params.p_primary_quality),
      fallback_model: String(params.p_fallback_model),
      fallback_quality: String(params.p_fallback_quality),
      config_version_id: String(params.p_config_version_id),
      origin: String(params.p_origin),
      run_id: params.p_run_id ?? null,
      trace_id: params.p_trace_id ?? null,
      created_at: "2026-11-18T00:00:00.000Z",
    };
    rows.push(created);
    return created;
  }

  function nextSnapshotId(): string {
    snapshotSeq += 1;
    return `7a8b9c0d-7a8b-4c0d-9e1f-${String(snapshotSeq).padStart(12, "0")}`;
  }

  function openOperation(params: Record<string, unknown>) {
    const credit = creditRow();
    if (credit) {
      if (!operation()) {
        return { success: false, reason: "operation_origin_conflict" };
      }
      return {
        success: true,
        idempotent: true,
        status: credit.status,
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        origin: "9_16_two_stage",
        steps: stepsEnvelope(),
        contract_version: 1,
      };
    }
    rows.push({
      __table: "product_9_16_two_stage_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: params.p_store_id,
      origin: "9_16_two_stage",
      contract_version: 1,
      expansion_model: null,
      expansion_quality: null,
      expansion_config_version_id: null,
      expansion_selection_origin: null,
    });
    rows.push(
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "base",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "expansion",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
    );
    rows.push({
      __table: "product_1_1_campaign_credit_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: params.p_store_id,
      amount: 1,
      status: "reserved",
      state_epoch: 0,
      publication_state: "none",
      publication_token: null,
      credit_tx_id: "tx-1",
      refund_tx_id: null,
    });
    return {
      success: true,
      idempotent: false,
      status: "reserved",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      origin: "9_16_two_stage",
      steps: stepsEnvelope(),
      contract_version: 1,
    };
  }

  /**
   * RPC v2 (F60.6): grava a seleção congelada + reserva na mesma "transação".
   * Seleção divergente devolve `operation_config_conflict` SEM escrever; linha
   * v1 existente devolve `operation_origin_conflict` (nunca converte legado).
   */
  function openOperationV2(params: Record<string, unknown>) {
    const incoming = {
      model: String(params.p_expansion_model),
      quality: String(params.p_expansion_quality),
      config_version_id: String(params.p_expansion_config_version_id),
      origin: "configured",
    };
    const existing = operation();
    if (existing) {
      if (Number(existing.contract_version) !== 2) {
        return { success: false, reason: "operation_origin_conflict" };
      }
      if (
        existing.expansion_model !== incoming.model ||
        existing.expansion_quality !== incoming.quality ||
        existing.expansion_config_version_id !== incoming.config_version_id
      ) {
        return { success: false, reason: "operation_config_conflict" };
      }
      return {
        success: true,
        idempotent: true,
        status: creditRow()?.status ?? "reserved",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        origin: "9_16_two_stage",
        steps: stepsEnvelope(),
        contract_version: 2,
        expansion_model: existing.expansion_model,
        expansion_quality: existing.expansion_quality,
        expansion_config_version_id: existing.expansion_config_version_id,
        expansion_selection_origin: existing.expansion_selection_origin,
      };
    }
    if (creditRow()) {
      // Crédito sem linha de operação nunca é adotado como operação nova.
      return { success: false, reason: "operation_origin_conflict" };
    }
    rows.push({
      __table: "product_9_16_two_stage_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: params.p_store_id,
      origin: "9_16_two_stage",
      contract_version: 2,
      expansion_model: incoming.model,
      expansion_quality: incoming.quality,
      expansion_config_version_id: incoming.config_version_id,
      expansion_selection_origin: incoming.origin,
    });
    rows.push(
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "base",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "expansion",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
    );
    rows.push({
      __table: "product_1_1_campaign_credit_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: params.p_store_id,
      amount: 1,
      status: "reserved",
      state_epoch: 0,
      publication_state: "none",
      publication_token: null,
      credit_tx_id: "tx-1",
      refund_tx_id: null,
    });
    return {
      success: true,
      idempotent: false,
      status: "reserved",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      origin: "9_16_two_stage",
      steps: stepsEnvelope(),
      contract_version: 2,
      expansion_model: incoming.model,
      expansion_quality: incoming.quality,
      expansion_config_version_id: incoming.config_version_id,
      expansion_selection_origin: incoming.origin,
    };
  }

  function acquireStep(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) {
      return { acquired: false, authorization: "query_only", reason: "operation_not_reserved" };
    }
    if (credit.status === "delivered" || credit.status === "refunded") {
      return { acquired: false, authorization: "query_only", reason: "operation_terminal" };
    }
    if (!operation()) {
      return { acquired: false, authorization: "query_only", reason: "operation_not_reserved" };
    }
    const persisted = outcome();
    if (persisted?.outcome === "unknown") {
      return { acquired: false, authorization: "query_only", reason: "operation_unknown" };
    }
    if (persisted?.outcome === "failed") {
      return { acquired: false, authorization: "query_only", reason: "operation_terminal" };
    }
    const stage = params.p_stage as "base" | "expansion";
    const target = String(params.p_target);
    const requestId = String(params.p_request_id);
    const existingRequest = claims().find((claim) => claim.request_id === requestId);
    if (existingRequest) {
      if (existingRequest.stage !== stage || existingRequest.target !== target) {
        return {
          acquired: false,
          authorization: "query_only",
          reason: "operation_identity_conflict",
        };
      }
      return {
        acquired: false,
        authorization: "query_only",
        reason: null,
        attempt_token: existingRequest.attempt_token,
        attempt_number: existingRequest.attempt_number,
        stage,
        target,
      };
    }
    if (claims().some((claim) => claim.status === "in_progress")) {
      return { acquired: false, authorization: "query_only", reason: "operation_in_progress" };
    }
    const currentStep = step(stage);
    if (!currentStep) {
      return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
    }
    if (currentStep.status === "done") {
      return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
    }
    const stageClaims = claims()
      .filter((claim) => claim.stage === stage)
      .sort((a, b) => a.attempt_number - b.attempt_number);
    const previous = stageClaims.at(-1);
    if (previous && (previous.status === "failed" || previous.status === "abandoned")) {
      if (previous.failure_class === "unknown") {
        return { acquired: false, authorization: "query_only", reason: "operation_unknown" };
      }
      if (!(previous.status === "failed" && previous.failure_class === "transient")) {
        return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
      }
    }
    let attemptNumber: number;
    if (stage === "expansion") {
      const baseStep = step("base");
      if (!baseStep || baseStep.status !== "done") {
        return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
      }
      if (target !== "initial" && target !== "retry") {
        return { acquired: false, authorization: "query_only", reason: "invalid_target" };
      }
      if (stageClaims.length >= 2) {
        return { acquired: false, authorization: "query_only", reason: "attempt_limit_reached" };
      }
      if (target === "retry") {
        if (stageClaims.length !== 1 || previous?.status !== "failed" || previous.failure_class !== "transient") {
          return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
        }
      } else if (stageClaims.length !== 0) {
        return { acquired: false, authorization: "query_only", reason: "invalid_transition" };
      }
      attemptNumber = stageClaims.length + 1;
    } else {
      if (target !== "primary" && target !== "fallback") {
        return { acquired: false, authorization: "query_only", reason: "invalid_target" };
      }
      const primaryCount = stageClaims.filter((claim) => claim.target === "primary").length;
      const fallbackCount = stageClaims.filter((claim) => claim.target === "fallback").length;
      if (stageClaims.length >= 3) {
        return { acquired: false, authorization: "query_only", reason: "attempt_limit_reached" };
      }
      if (target === "primary") {
        if (fallbackCount > 0 || primaryCount >= 2) {
          return { acquired: false, authorization: "query_only", reason: "attempt_limit_reached" };
        }
      } else if (primaryCount < 1 || fallbackCount >= 1) {
        return { acquired: false, authorization: "query_only", reason: "attempt_limit_reached" };
      }
      attemptNumber = stageClaims.length + 1;
    }
    const token = `token-${stage}-${attemptNumber}`;
    rows.push({
      __table: "product_9_16_two_stage_attempt_claims",
      id: `claim-${stage}-${attemptNumber}`,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      stage,
      attempt_number: attemptNumber,
      target,
      request_id: requestId,
      status: "in_progress",
      failure_class: null,
      attempt_token: token,
    });
    Object.assign(currentStep, {
      status: "in_progress",
      attempts_used: Math.max(Number(currentStep.attempts_used ?? 0), attemptNumber),
    });
    return {
      acquired: true,
      authorization: "execute",
      reason: null,
      attempt_token: token,
      attempt_number: attemptNumber,
      stage,
      target,
    };
  }

  function finishStep(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) throw new Error("operation_not_reserved");
    if (credit.status === "delivered" || credit.status === "refunded") {
      return { success: false, reason: "operation_terminal" };
    }
    const claim = claims().find(
      (candidate) => candidate.attempt_token === String(params.p_attempt_token),
    );
    if (!claim) return { success: false, reason: "invalid_transition" };
    const status = String(params.p_status) as ClaimRow["status"];
    if (claim.status === status) {
      return {
        success: true,
        idempotent: true,
        status,
        stage: claim.stage,
        attempt_number: claim.attempt_number,
      };
    }
    if (claim.status !== "in_progress") {
      return { success: false, reason: "invalid_transition" };
    }
    claim.status = status;
    claim.failure_class =
      typeof params.p_failure_class === "string" ? params.p_failure_class : null;
    const currentStep = step(claim.stage);
    if (currentStep) {
      if (status === "completed") {
        currentStep.status = "done";
        currentStep.failure_class = null;
      } else if (status === "failed") {
        currentStep.status = "failed";
        currentStep.failure_class = claim.failure_class;
      } else {
        currentStep.status = "abandoned";
      }
    }
    return {
      success: true,
      idempotent: false,
      status,
      stage: claim.stage,
      attempt_number: claim.attempt_number,
    };
  }

  function recordOutcome(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) throw new Error("operation_not_reserved");
    if (credit.status === "delivered" || credit.status === "refunded") {
      return { success: false, reason: "operation_terminal" };
    }
    const existing = outcome();
    if (existing) {
      if (existing.outcome === params.p_outcome && existing.stage === params.p_stage) {
        return {
          success: true,
          idempotent: true,
          outcome: existing.outcome,
          stage: existing.stage,
          support_reference: existing.support_reference,
        };
      }
      return { success: false, reason: "operation_identity_conflict" };
    }
    rows.push({
      __table: "product_9_16_two_stage_outcomes",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      outcome: params.p_outcome,
      stage: params.p_stage,
      support_reference: params.p_support_reference ?? null,
    });
    return {
      success: true,
      idempotent: false,
      outcome: params.p_outcome,
      stage: params.p_stage,
      support_reference: params.p_support_reference ?? null,
    };
  }

  function resumeOperation() {
    const credit = creditRow();
    if (!credit) return { success: false, reason: "operation_not_found" };
    const baseStep = step("base");
    const expansionStep = step("expansion");
    if (!baseStep || !expansionStep) {
      return { success: false, reason: "operation_not_found" };
    }
    const unknown = outcome()?.outcome === "unknown";
    const failedOutcome = outcome()?.outcome === "failed";
    let action: string;
    let nextTarget: string | null = null;
    if (credit.status === "delivered" || credit.status === "refunded") {
      action = "blocked";
    } else if (unknown || failedOutcome) {
      action = "blocked";
    } else if (baseStep.status === "pending" || baseStep.status === "in_progress") {
      if (baseStep.status === "in_progress") action = "wait";
      else {
        action = "acquire_base";
        nextTarget = "primary";
      }
    } else if (baseStep.status === "done") {
      if (expansionStep.status === "pending" || expansionStep.status === "in_progress") {
        if (expansionStep.status === "in_progress") action = "wait";
        else {
          action = "acquire_expansion";
          nextTarget = "initial";
        }
      } else if (
        expansionStep.status === "failed" &&
        expansionStep.attempts_used === 1 &&
        expansionStep.failure_class === "transient"
      ) {
        action = "retry_expansion";
        nextTarget = "retry";
      } else if (expansionStep.status === "done") {
        action = "deliver";
      } else {
        action = "blocked";
      }
    } else if (baseStep.status === "failed") {
      if (baseStep.failure_class === null || baseStep.failure_class === "definitive" || baseStep.failure_class === "unknown") {
        action = "blocked";
      } else {
        const baseClaims = claims().filter((claim) => claim.stage === "base");
        const fallbackCount = baseClaims.filter((claim) => claim.target === "fallback").length;
        if (baseClaims.length >= 3 || fallbackCount >= 1) action = "blocked";
        else {
          action = "retry_base";
          nextTarget = "primary";
        }
      }
    } else {
      action = "blocked";
    }
    return {
      success: true,
      action,
      next_target: nextTarget,
      origin: "9_16_two_stage",
      credit_status: credit.status,
      base_status: baseStep.status,
      base_attempts: baseStep.attempts_used,
      expansion_status: expansionStep.status,
      expansion_attempts: expansionStep.attempts_used,
      unknown,
      failed_outcome: failedOutcome,
    };
  }

  async function beginPublication(params: Record<string, unknown>) {
    if (beginBarrier !== null) {
      beginBarrier.count += 1;
      if (beginBarrier.count >= 2) beginBarrier.release();
      await beginBarrier.promise;
    }
    const operationId = String(params.p_operation_id ?? OPERATION_ID);
    const credit = creditRowFor(operationId);
    if (!credit) throw new Error("operation_not_found");
    if (credit.status === "delivered" || credit.status === "refunded") {
      throw new Error("operation_terminal");
    }
    if (["in_flight", "result_unknown", "published"].includes(credit.publication_state)) {
      return {
        success: true,
        acquired: false,
        publication_state: credit.publication_state,
        state_epoch: credit.state_epoch,
        status: credit.status,
      };
    }
    credit.publication_state = "in_flight";
    credit.publication_token = randomUUID();
    credit.state_epoch += 1;
    return {
      success: true,
      acquired: true,
      token: credit.publication_token,
      publication_state: "in_flight",
      state_epoch: credit.state_epoch,
      status: credit.status,
    };
  }

  function abortPublication(params: Record<string, unknown>) {
    const operationId = String(params.p_operation_id ?? OPERATION_ID);
    const credit = creditRowFor(operationId);
    if (!credit) throw new Error("operation_not_found");
    assertOwnToken(credit, params.p_publication_token);
    credit.publication_state = "none";
    credit.publication_token = null;
    return { success: true };
  }

  function assertOwnToken(credit: CreditRow, token: unknown) {
    if (!token || !credit.publication_token || credit.publication_token !== token) {
      throw new Error("publication_not_owner");
    }
  }

  function creditEnvelope(credit: CreditRow, idempotent: boolean) {
    return {
      success: true,
      idempotent,
      status: credit.status,
      campaign_id: credit.campaign_id,
      operation_id: credit.operation_id,
      amount: credit.amount,
      credit_tx_id: credit.credit_tx_id,
      refund_tx_id: credit.refund_tx_id,
    };
  }

  function markArtUploaded(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) throw new Error("operation_not_found");
    assertOwnToken(credit, params.p_publication_token);
    if (credit.status === "art_uploaded") return creditEnvelope(credit, true);
    if (credit.status !== "reserved") throw new Error("invalid_transition");
    credit.status = "art_uploaded";
    credit.publication_state = "published";
    credit.state_epoch += 1;
    return creditEnvelope(credit, false);
  }

  function deliver(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) throw new Error("operation_not_found");
    assertOwnToken(credit, params.p_publication_token);
    if (credit.status === "delivered") return creditEnvelope(credit, true);
    if (credit.status !== "art_uploaded") throw new Error("invalid_transition");
    credit.status = "delivered";
    credit.publication_state = "published";
    credit.state_epoch += 1;
    return creditEnvelope(credit, false);
  }

  function getCredit() {
    const credit = creditRow();
    if (!credit) return null;
    return {
      success: true,
      status: credit.status,
      campaign_id: credit.campaign_id,
      operation_id: credit.operation_id,
      amount: credit.amount,
      credit_tx_id: credit.credit_tx_id,
      refund_tx_id: credit.refund_tx_id,
      consumed_definitive: credit.status === "delivered",
    };
  }

  function closeFailed(params: Record<string, unknown>) {
    const credit = creditRow();
    if (!credit) throw new Error("operation_not_found");
    if (credit.status === "refunded") {
      return {
        success: true,
        idempotent: true,
        status: "refunded",
        campaign_id: credit.campaign_id,
        operation_id: credit.operation_id,
        action: "close_failed_operation",
      };
    }
    if (credit.status === "delivered") throw new Error("delivered_not_refundable");
    if (["in_flight", "result_unknown", "published"].includes(credit.publication_state)) {
      throw new Error("publication_in_progress");
    }
    if (params.p_observed_epoch !== credit.state_epoch) throw new Error("evidence_stale");
    if (params.p_art_kind !== "absent") throw new Error("absent_not_confirmed");
    credit.status = "refunded";
    credit.refund_tx_id = "refund-1";
    credit.state_epoch += 1;
    return {
      success: true,
      idempotent: false,
      status: "refunded",
      campaign_id: credit.campaign_id,
      operation_id: credit.operation_id,
      action: "close_failed_operation",
    };
  }

  const copyRows = () => tableRows("product_1_1_copy_state");

  function jointFormatId(format: string): string {
    return format === "1:1" ? SQUARE_DELIVERY_ID : OPERATION_ID;
  }

  function jointLink(format: string): Record<string, unknown> | null {
    return (
      tableRows("product_two_format_deliveries").find(
        (row) => row.format === format && row.campaign_id === CAMPAIGN_ID,
      ) ?? null
    );
  }

  function jointCampaignStatus(): string {
    const statuses = [creditRowFor(OPERATION_ID)?.status, creditRowFor(SQUARE_DELIVERY_ID)?.status];
    if (statuses.every((status) => status === "refunded")) return "error";
    if (statuses.some((status) => status === "delivered")) return "ready";
    return "generating";
  }

  function assertJointPair(): void {
    const squareLink = jointLink("1:1");
    const verticalLink = jointLink("9:16");
    if (
      !squareLink ||
      !verticalLink ||
      squareLink.delivery_operation_id !== SQUARE_DELIVERY_ID ||
      verticalLink.delivery_operation_id !== OPERATION_ID ||
      !creditRowFor(SQUARE_DELIVERY_ID) ||
      !creditRowFor(OPERATION_ID)
    ) {
      throw new Error("delivery_links_inconsistent");
    }
  }

  function hasFormatArtifact(format: string): boolean {
    const role = format === "1:1" ? "square_original" : "vertical";
    const path = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/${role}.jpg`;
    return (
      base
        .rowsForTable("campaign_composition_artifacts")
        .some((row) => row.role === role && row.operation_id === OPERATION_ID) ||
      base.hasObject(path)
    );
  }

  function jointProject() {
    const campaign = tableRows("campaigns").find((row) => row.id === CAMPAIGN_ID);
    if (!campaign) return { success: false, reason: "campaign_not_found" };
    assertJointPair();
    const square = creditRowFor(SQUARE_DELIVERY_ID)?.status === "delivered";
    const vertical = creditRowFor(OPERATION_ID)?.status === "delivered";
    const previous = campaign.storage_path;
    if (square) {
      campaign.storage_path = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`;
      campaign.preferred_format = "1:1";
    } else if (vertical) {
      campaign.storage_path = `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`;
      campaign.preferred_format = "9:16";
    }
    campaign.status = jointCampaignStatus();
    return {
      success: true,
      campaign_id: CAMPAIGN_ID,
      projected: campaign.storage_path !== previous,
      already_projected: campaign.storage_path === previous,
      campaign_status: campaign.status,
      storage_path: campaign.storage_path ?? null,
      preferred_format: campaign.preferred_format ?? null,
    };
  }

  function ensureJointOperation(params: Record<string, unknown>) {
    if (operation()) return;
    const selection = {
      model: String(params.p_expansion_model),
      quality: String(params.p_expansion_quality),
      configVersionId: String(params.p_expansion_config_version_id),
    };
    rows.push({
      __table: "product_9_16_two_stage_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: STORE_ID,
      origin: "9_16_two_stage",
      contract_version: 2,
      expansion_model: selection.model,
      expansion_quality: selection.quality,
      expansion_config_version_id: selection.configVersionId,
      expansion_selection_origin: "configured",
    });
    rows.push(
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "base",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
      {
        __table: "product_9_16_two_stage_steps",
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        stage: "expansion",
        status: "pending",
        attempts_used: 0,
        failure_class: null,
      },
    );
  }

  function jointOpen(params: Record<string, unknown>) {
    const existing = creditRowFor(OPERATION_ID) !== null;
    if (existing) {
      const opened = operation();
      if (!opened || Number(opened.contract_version) !== 2) {
        return { success: false, reason: "operation_origin_conflict" };
      }
      if (
        opened.expansion_model !== params.p_expansion_model ||
        opened.expansion_quality !== params.p_expansion_quality ||
        opened.expansion_config_version_id !== params.p_expansion_config_version_id
      ) {
        return { success: false, reason: "operation_config_conflict" };
      }
    }
    if (!existing) {
      rows.push(
        {
          __table: "product_1_1_campaign_credit_operations",
          campaign_id: CAMPAIGN_ID,
          operation_id: OPERATION_ID,
          store_id: STORE_ID,
          amount: 1,
          status: "reserved",
          state_epoch: 0,
          publication_state: "none",
          publication_token: null,
          credit_tx_id: "tx-control",
          refund_tx_id: null,
        },
        {
          __table: "product_1_1_campaign_credit_operations",
          campaign_id: CAMPAIGN_ID,
          operation_id: SQUARE_DELIVERY_ID,
          store_id: STORE_ID,
          amount: 1,
          status: "reserved",
          state_epoch: 0,
          publication_state: "none",
          publication_token: null,
          credit_tx_id: "tx-square",
          refund_tx_id: null,
        },
        {
          __table: "product_two_format_deliveries",
          campaign_id: CAMPAIGN_ID,
          operation_id: OPERATION_ID,
          store_id: STORE_ID,
          format: "1:1",
          delivery_operation_id: SQUARE_DELIVERY_ID,
          artifact_role: "square_original",
          created_at: "2026-11-18T00:00:00.000Z",
        },
        {
          __table: "product_two_format_deliveries",
          campaign_id: CAMPAIGN_ID,
          operation_id: OPERATION_ID,
          store_id: STORE_ID,
          format: "9:16",
          delivery_operation_id: OPERATION_ID,
          artifact_role: "vertical",
          created_at: "2026-11-18T00:00:00.000Z",
        },
      );
    }
    ensureJointOperation(params);
    const control = creditRowFor(OPERATION_ID);
    const square = creditRowFor(SQUARE_DELIVERY_ID);
    return {
      success: true,
      idempotent: existing,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      square_delivery_id: SQUARE_DELIVERY_ID,
      vertical_delivery_operation_id: OPERATION_ID,
      contract_version: "f60.7-two-format-v1",
      expansion_model: String(params.p_expansion_model),
      expansion_quality: String(params.p_expansion_quality),
      expansion_config_version_id: String(params.p_expansion_config_version_id),
      expansion_selection_origin: "configured",
      status: control?.status ?? "reserved",
      square_status: square?.status ?? "reserved",
      steps: stepsEnvelope(),
    };
  }

  function jointDeliver(params: Record<string, unknown>) {
    const format = String(params.p_format);
    const id = jointFormatId(format);
    const credit = creditRowFor(id);
    if (!credit) throw new Error("credit_operation_missing");
    assertJointPair();
    assertOwnToken(credit, params.p_publication_token);
    if (credit.status === "refunded") return { success: false, reason: "operation_terminal" };
    if (credit.status === "delivered") {
      return {
        success: true,
        idempotent: true,
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        format,
        delivery_operation_id: id,
        artifact_role: format === "1:1" ? "square_original" : "vertical",
        credit_status: "delivered",
        campaign_status: "ready",
        storage_path: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/${format === "1:1" ? "square_original" : "vertical"}.jpg`,
        preferred_format: format,
        projected: false,
        already_projected: true,
      };
    }
    credit.status = "delivered";
    credit.publication_state = "published";
    credit.state_epoch += 1;
    const projection = jointProject();
    return {
      success: true,
      idempotent: false,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      format,
      delivery_operation_id: id,
      artifact_role: format === "1:1" ? "square_original" : "vertical",
      credit_status: "delivered",
      campaign_status: projection.campaign_status,
      storage_path: projection.storage_path,
      preferred_format: projection.preferred_format,
      projected: projection.projected,
      already_projected: projection.already_projected,
    };
  }

  function jointRefund(params: Record<string, unknown>) {
    const format = String(params.p_format);
    const id = jointFormatId(format);
    const credit = creditRowFor(id);
    if (!credit) throw new Error("credit_operation_missing");
    const failure = refundFailures.get(format);
    if (failure !== undefined) {
      refundFailures.delete(format);
      if (failure === "deliver") {
        credit.status = "delivered";
        credit.state_epoch += 1;
        jointProject();
        return { success: false, reason: "delivered_not_refundable" };
      }
      throw new Error("publication_in_progress");
    }
    if (credit.status === "delivered") return { success: false, reason: "delivered_not_refundable" };
    if (["in_flight", "result_unknown", "published"].includes(credit.publication_state)) {
      throw new Error("publication_in_progress");
    }
    if (hasFormatArtifact(format)) {
      return { success: false, reason: "artifact_present" };
    }
    if (credit.status === "refunded") {
      return {
        success: true,
        idempotent: true,
        campaign_id: CAMPAIGN_ID,
        operation_id: OPERATION_ID,
        format,
        delivery_operation_id: id,
        artifact_role: format === "1:1" ? "square_original" : "vertical",
        credit_status: "refunded",
        campaign_status: jointCampaignStatus(),
        storage_path: null,
        preferred_format: null,
        projected: false,
        already_projected: true,
      };
    }
    if (claims().some((claim) => claim.status === "in_progress")) {
      throw new Error("operation_in_progress");
    }
    if (params.p_art_kind !== "absent") throw new Error("absent_not_confirmed");
    if (params.p_observed_epoch !== credit.state_epoch) throw new Error("evidence_stale");
    const shared = outcome();
    const sharedFinal =
      shared?.outcome === "failed" ||
      creditRowFor(OPERATION_ID)?.status === "refunded";
    if (!sharedFinal) throw new Error("shared_operation_not_final");
    if (format === "1:1") {
      const own = tableRows("product_1_1_generation_outcomes").find(
        (row) => row.operation_id === SQUARE_DELIVERY_ID && row.outcome === "failed",
      );
      if (!own) throw new Error("finality_not_recorded");
    }
    credit.status = "refunded";
    credit.refund_tx_id = "refund";
    credit.state_epoch += 1;
    const status = jointCampaignStatus();
    const campaign = tableRows("campaigns").find((row) => row.id === CAMPAIGN_ID);
    if (campaign) campaign.status = status;
    return {
      success: true,
      idempotent: false,
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      format,
      delivery_operation_id: id,
      artifact_role: format === "1:1" ? "square_original" : "vertical",
      credit_status: "refunded",
      campaign_status: status,
      storage_path: null,
      preferred_format: null,
      projected: false,
      already_projected: true,
    };
  }

  function recordSquareOutcome(params: Record<string, unknown>) {
    const operationId = String(params.p_operation_id ?? SQUARE_DELIVERY_ID);
    const credit = creditRowFor(operationId);
    if (!credit) throw new Error("operation_not_found");
    if (credit.status === "delivered" || credit.status === "refunded") {
      throw new Error("operation_terminal");
    }
    const outcomeValue = String(params.p_outcome);
    if (outcomeValue !== "failed" && outcomeValue !== "unknown") throw new Error("invalid_outcome");
    const existing = tableRows("product_1_1_generation_outcomes").find(
      (row) => row.operation_id === operationId,
    );
    if (existing) {
      if (existing.outcome !== outcomeValue) throw new Error("operation_identity_conflict");
      return {
        success: true,
        idempotent: true,
        campaign_id: CAMPAIGN_ID,
        operation_id: operationId,
        outcome: existing.outcome,
        support_reference: existing.support_reference ?? null,
      };
    }
    rows.push({
      __table: "product_1_1_generation_outcomes",
      campaign_id: CAMPAIGN_ID,
      operation_id: operationId,
      outcome: outcomeValue,
      support_reference: params.p_support_reference ?? null,
    });
    return {
      success: true,
      idempotent: false,
      campaign_id: CAMPAIGN_ID,
      operation_id: operationId,
      outcome: outcomeValue,
      support_reference: params.p_support_reference ?? null,
    };
  }



  function acquireCopyAttempt(params: Record<string, unknown>) {
    const existing = copyRows().sort(
      (a, b) => Number(a.attempt_seq) - Number(b.attempt_seq),
    );
    const completed = existing.find((row) => row.state === "completed");
    if (completed) {
      return { acquired: false, reason: "attempt_already_completed" };
    }
    const pending = existing.find((row) => row.state === "pending");
    if (pending) {
      return {
        acquired: false,
        reason: "already_acquired",
        attempt_seq: pending.attempt_seq,
        attempt_token: pending.attempt_token,
      };
    }
    const attemptSeq = existing.length + 1;
    const attemptToken = `copy-token-${attemptSeq}`;
    rows.push({
      __table: "product_1_1_copy_state",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      attempt_seq: attemptSeq,
      attempt_token: attemptToken,
      state: "pending",
      copy_text: null,
      copy_payload: null,
      request_token: params.p_request_token ?? null,
      lease_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    return {
      acquired: true,
      attempt_seq: attemptSeq,
      attempt_token: attemptToken,
      mode: params.p_mode,
    };
  }

  function applyCopyState(params: Record<string, unknown>) {
    const row = copyRows().find(
      (candidate) =>
        candidate.attempt_seq === params.p_attempt_seq &&
        candidate.attempt_token === params.p_attempt_token,
    );
    if (!row) {
      return { applied: false, outcome: "stale_attempt", state: null };
    }
    const nextState = params.p_state;
    if (row.state === "completed" && nextState === "completed") {
      return { applied: false, outcome: "idempotent", state: "completed" };
    }
    if (nextState !== "pending" && nextState !== "completed" && nextState !== "failed") {
      return { applied: false, outcome: "rejected", state: row.state };
    }
    if (nextState === "completed" && (typeof params.p_copy_text !== "string" || params.p_copy_text.length === 0)) {
      return { applied: false, outcome: "invalid_content", state: row.state };
    }
    row.state = nextState;
    if (typeof params.p_copy_text === "string") row.copy_text = params.p_copy_text;
    if (params.p_copy_payload !== null && params.p_copy_payload !== undefined) {
      row.copy_payload = params.p_copy_payload;
    }
    row.updated_at = new Date().toISOString();
    return { applied: true, outcome: "applied", state: nextState };
  }

  function cancelCopy(params: Record<string, unknown>) {
    const row = copyRows().find(
      (candidate) =>
        candidate.attempt_seq === params.p_attempt_seq &&
        candidate.attempt_token === params.p_attempt_token,
    );
    if (!row) return { applied: false, canceled: false, state: null };
    if (row.state === "completed") {
      return { applied: false, canceled: false, state: "completed" };
    }
    row.state = "failed";
    row.copy_payload = params.p_copy_payload ?? { recovery: { failureClass: "transient" } };
    row.updated_at = new Date().toISOString();
    return {
      applied: true,
      canceled: true,
      state: "failed",
      outcome: "applied",
      attempt_seq: row.attempt_seq,
      attempt_token: row.attempt_token,
    };
  }

  interface StorageStore {
    upload: (...args: unknown[]) => Promise<unknown>;
    download: (path: string) => Promise<{ data: unknown; error: unknown }>;
    info: (path: string) => Promise<unknown>;
    createSignedUrl: (...args: unknown[]) => Promise<unknown>;
    getPublicUrl: (...args: unknown[]) => unknown;
    remove: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
    list: (...args: unknown[]) => Promise<unknown>;
  }
  const storage = {
    from(bucket: string) {
      const store = (base.client.storage as unknown as {
        from: (bucket: string) => StorageStore;
      }).from(bucket);
      return {
        upload: store.upload,
        download: async (path: string) => {
          const result = await store.download(path);
          if (!result?.data) return result;
          return {
            ...result,
            data: new Blob([result.data as BlobPart]),
          };
        },
        info: store.info,
        createSignedUrl: store.createSignedUrl,
        getPublicUrl: store.getPublicUrl,
        remove: store.remove,
        update: store.update,
        list: store.list,
      };
    },
  };

  const client = {
    from,
    storage,
    rpc: async (name: string, params: Record<string, unknown>) => {
      try {
        const data = await rpc(name, params);
        return { data, error: null };
      } catch (error) {
        return {
          data: null,
          error: { message: error instanceof Error ? error.message : "rpc_failed" },
        };
      }
    },
  } as unknown as SupabaseClient;

  return {
    client,
    base,
    rows,
    rpcCounts,
    rpcOrder,
    seedScenario,
    seedJointState,
    seedJointArtifact,
    seedFrozenState,
    seedOperation,
    credit: creditRow,
    creditRowFor,
    links: () => tableRows("product_two_format_deliveries").map(copy),
    claims,
    outcome,
    operation,
    clock: () => clockBase,
    failNextRefund: (format: "1:1" | "9:16", mode: "throw" | "deliver" = "throw") => {
      refundFailures.set(format, mode);
    },
    interleaveBeginPublication: () => {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      beginBarrier = { count: 0, release, promise };
      return () => {
        beginBarrier = null;
      };
    },
  };
}

export type JointWorld = ReturnType<typeof createJointOfflineWorld>;

export interface OfflineProviderOptions {
  readonly expansionMode?:
    | "success"
    | "unknown"
    | "transient_once"
    | "transient_always"
    | "definitive"
    | "invalid_output";
  /** Texto devolvido pelo invoker SIMULADO da copy (provider). */
  readonly copyText?: string;
  /** Avanca o relogio injetado depois da chamada da base (orcamento). */
  readonly baseClockAdvanceMs?: number;
  /**
   * Controlador do preflight read-only da seleção congelada (catálogo+pricing
   * falsos). `undefined`/`"ok"` valida contra as costuras; os demais forçam a
   * falha correspondente sem banco.
   */
  readonly frozenPreflight?:
    | "ok"
    | "model_unavailable"
    | "pricing_unavailable"
    | "configuration_read_failed";
}

const CATALOG_ROW = {
  id: "0f7f1c1a-5f2b-4a4b-9d1e-2a3b4c5d6e7f",
  capability: "campaign_product_image",
  segment: "product",
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
  label: null,
  status: "active",
  source_note: null,
  validated_at: null,
  created_at: "2026-11-13T00:00:00.000Z",
  updated_at: "2026-11-13T00:00:00.000Z",
} as unknown as AiModelCatalogRow;

const COMPLETE_PRICING = {
  inputCostUsd: 1,
  outputCostUsd: 2,
  cachedInputCostUsd: 0.5,
  imageInputTokenUsdPer1M: 3,
  imageTokenUsdPer1M: 4,
  imageCachedInputTokenUsdPer1M: 5,
  imageUnitCostUsd: 0.05,
} as unknown as ModelPricing;

/**
 * Seleção congelada do harness, compatível com `CATALOG_ROW`/`COMPLETE_PRICING`.
 * O preflight é injetado (nunca lê a configuração administrativa).
 */
const CONFIGURED_SELECTION = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "9b1d3c4e-5f60-4a7b-8c9d-0e1f2a3b4c5d",
  origin: "configured",
} as const;

async function imageBase64(
  width: number,
  height: number,
  format: "png" | "jpeg",
): Promise<string> {
  const image = sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 60, b: 90 } },
  });
  const bytes =
    format === "png" ? await image.png().toBuffer() : await image.jpeg({ quality: 80 }).toBuffer();
  return bytes.toString("base64");
}

/**
 * Compõe as dependências REAIS via composição 9:16, injetando apenas as
 * fronteiras de banco/Storage/provider (seams já previstos nos adaptadores).
 */
async function projectCompositionDelivery(
  client: SupabaseClient,
  input: { storeId: string; campaignId: string; operationId: string },
) {
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
    return { projected: false as const, reason: "artifact_missing" as const };
  }
  return projectDeliveredCampaign(
    {
      ...input,
      source: {
        kind: "composition" as const,
        role: "vertical" as const,
        expectedPath: row.record.storagePath,
      },
    },
    { client },
  );
}

interface ComposeNineSixteenOptions {
  readonly client: SupabaseClient;
  readonly clock: () => number;
  readonly callIdFactory: () => string;
  readonly probeVertical?: RunNineSixteenDeps["probeVertical"];
  readonly generateThumbnail?: RunNineSixteenDeps["generateThumbnail"];
  readonly projectDelivered?: RunNineSixteenDeps["projectDelivered"];
  readonly copyInvoker?: SquareBaseDeps["copyInvoker"];
  readonly copyDirectorEnabled?: boolean;
  readonly base?: (input: SquareBaseInput, deps?: SquareBaseDeps) => Promise<unknown>;
  readonly expand?: RunNineSixteenDeps["expand"];
  readonly preflightFrozenExpansion?: RunNineSixteenDeps["preflightFrozenExpansion"];
}

/**
 * Equivalente local da composição 9:16 (não importada): compõe os
 * componentes reais sem depender do harness 9:16. A seleção congelada continua
 * vindo do chamador.
 */
function composeNineSixteenDeps(options: ComposeNineSixteenOptions): RunNineSixteenDeps {
  const client = options.client;
  const control = new ProductTwoStageOperationClient(client);
  const credit = new ProductOneToOneCreditOperationClient(client);
  const financial = new TwoStageFinancialService({ client, control, credit });
  const probeVertical = options.probeVertical ?? new CompositionVerticalProbe({ client });
  const base = options.base ?? ((input: SquareBaseInput, deps?: SquareBaseDeps) =>
    runSquareBase(input, {
      client,
      ...(deps ?? {}),
      ...(options.copyInvoker === undefined ? {} : { copyInvoker: options.copyInvoker }),
      ...(options.copyDirectorEnabled === undefined
        ? {}
        : { copyDirectorEnabled: options.copyDirectorEnabled }),
    }));
  const prepare: RunNineSixteenDeps["prepare"] = (input, deps) =>
    prepareSquareForExpansion(input, { client, ...(deps ?? {}) });
  const expand: RunNineSixteenDeps["expand"] =
    options.expand ??
    ((input, deps) => expandVerticalToNineSixteen(input, { client, ...deps }));
  const preflightExpansion: RunNineSixteenDeps["preflightExpansion"] = async () => {
    const read = await readNineSixteenExpansionConfig({ client });
    if (read.kind === "absent") {
      return { ok: false, failure: "configuration_missing", reason: "expansion_config_absent", missing: [] };
    }
    if (read.kind === "invalid") {
      return { ok: false, failure: "configuration_missing", reason: read.reason, missing: [] };
    }
    if (read.kind === "read_failed") {
      return { ok: false, failure: "configuration_read_failed", reason: read.reason, missing: [] };
    }
    const outcome = await preflightExpansionToNineSixteen({ client }, read.selection);
    if (outcome.ok) return { ok: true, selection: read.selection };
    const missing = outcome.failure === "pricing_unavailable" ? outcome.missing : [];
    return { ok: false, failure: outcome.failure, reason: outcome.reason, missing };
  };
  const preflightFrozenExpansion: RunNineSixteenDeps["preflightFrozenExpansion"] =
    options.preflightFrozenExpansion ??
    (async (selection) => {
      const outcome = await preflightExpansionToNineSixteen({ client }, selection);
      if (outcome.ok) return { ok: true, selection };
      const missing = outcome.failure === "pricing_unavailable" ? outcome.missing : [];
      return { ok: false, failure: outcome.failure, reason: outcome.reason, missing };
    });
  return Object.freeze({
    client,
    control,
    financial,
    credit,
    clock: options.clock,
    callIdFactory: options.callIdFactory,
    newSupportReference: generateSupportReference,
    base: base as RunNineSixteenDeps["base"],
    prepare,
    expand,
    readFrozenState: ((input, deps) =>
      readSquareBaseFrozenState(input, { client, ...(deps ?? {}) })) as RunNineSixteenDeps["readFrozenState"],
    projectDelivered:
      options.projectDelivered ??
      ((input: { storeId: string; campaignId: string; operationId: string }) =>
        projectCompositionDelivery(client, input)),
    projectClosed: ((input, deps) =>
      projectClosedCampaign(input, { client, ...(deps ?? {}) })) as RunNineSixteenDeps["projectClosed"],
    probeVertical,
    preflightExpansion,
    preflightFrozenExpansion,
    generateThumbnail:
      options.generateThumbnail ?? (async () => ({ status: "skipped", reason: "offline" })),
    reconstruction: {
      client,
      readInputBytes: (storagePath: string) =>
        downloadCampaignInputFileWithClient(client, storagePath),
    },
  });
}


export async function createOfflineDeps(
  world: JointWorld,
  options: OfflineProviderOptions = {},
) {
  const counters = {
    order: [] as string[],
    baseProviderCalls: 0,
    expansionProviderCalls: 0,
    copyCalls: 0,
    copyInputs: [] as unknown[],
    telemetryEmits: 0,
    frozenPreflightCalls: 0,
  };
  let expansionAttempt = 0;
  let now = world.clock();

  const squareResult: AiInvocationResult = {
    imageBase64: await imageBase64(1024, 1024, "png"),
    mimeType: "image/png",
    model: "gpt-image-2.5-sunburst",
    usage: {
      promptTokens: 120,
      completionTokens: 80,
      totalTokens: 200,
      inputTextTokens: 20,
      inputImageTokens: 100,
      outputTextTokens: 0,
      outputImageTokens: 80,
      imageTokens: 80,
    },
  };

  const baseSeams: SquareBaseDeps = {
    client: world.client,
    clock: () => now,
    callIdFactory: () => `base-call-${counters.baseProviderCalls + 1}`,
    runCopy: runSquareBaseCopy,
    runPreflight: async () => ({
      config: {
        primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
        fallback: { model: "gpt-image-2", quality: "low" },
        origin: "selection",
        configVersionId: "cfg-1",
      },
      pricing: {} as never,
    }),
    readFrozenState: (async (
      input: { campaignId: string; operationId: string },
      deps?: { client?: SupabaseClient },
    ) => {
      const mod = await import("@/lib/campaign/square-base/frozen-state");
      return mod.readSquareBaseFrozenState(input, { client: deps?.client ?? world.client });
    }) as never,
    imageGateway: {
      prepare: async (_capability: unknown, target: "primary" | "fallback") => ({
        capability: "campaign_product_image",
        target,
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        protocol: "images",
        resolved: { provider: "openai", model: "gpt-image-2.5-sunburst", protocol: "images" },
      }),
      invokePrepared: async (
        _prepared: unknown,
        _request: unknown,
        telemetry: {
          sink: {
            emit: (envelope: Record<string, unknown>) => Promise<void>;
          };
        },
      ) => {
        counters.baseProviderCalls += 1;
        counters.order.push("baseProvider");
        if (options.baseClockAdvanceMs !== undefined) {
          now += options.baseClockAdvanceMs;
        }
        counters.telemetryEmits += 1;
        await telemetry.sink.emit({
          capability: "campaign_product_image",
          protocol: "images",
          status: "success",
          provider: "openai",
          model: "gpt-image-2.5-sunburst",
          quality: "medium",
          attemptNumber: 1,
          durationMs: 0,
          usage: squareResult.usage,
        });
        return squareResult;
      },
    } as never,
    // Copy REAL (runSquareBaseCopy): apenas o provider (invoker) e o sink de
    // telemetria sao simulados; persistencia/estado usam o caminho produtivo.
    copyDirectorEnabled: true,
    copyInvoker: {
      hasFallback: () => false,
      invoke: async () => {
        counters.copyCalls += 1;
        counters.order.push("copy");
        counters.copyInputs.push({ call: "copy" });
        const caption = options.copyText ?? "Copy entregue congelada";
        return {
          content: JSON.stringify({
            title: "Oferta da loja",
            caption,
            hashtags: ["#oferta"],
            cta_post: "Aproveite hoje",
          }),
          model: "gpt-4.1-mini",
        };
      },
    } as never,
    // Telemetria REAL (createSquareBaseTelemetry) com custo derivado do par de
    // pricing; somente a persistencia final (sink/tracker) e simulada no teste.
    resolveTelemetryCost: (async (pair: { primary: { model: string; quality: string }; fallback: { model: string; quality: string } }) => ({
      primary: {
        model: pair.primary.model,
        quality: pair.primary.quality,
        costUsd: COMPLETE_PRICING.imageUnitCostUsd ?? null,
        versionId: "pricing-1",
        costSource: "pricing_table",
        pricing: COMPLETE_PRICING,
      },
      fallback: {
        model: pair.fallback.model,
        quality: pair.fallback.quality,
        costUsd: COMPLETE_PRICING.imageUnitCostUsd ?? null,
        versionId: "pricing-1",
        costSource: "pricing_table",
        pricing: COMPLETE_PRICING,
      },
    })) as never,
  };

  const expandSeams: ExpandVerticalSeams = {
    client: world.client,
    clock: () => now,
    callIdFactory: () => `exp-call-${counters.expansionProviderCalls + 1}`,
    invoker: {
      invokePrepared: async () => {
        counters.expansionProviderCalls += 1;
        counters.order.push("expansionProvider");
        expansionAttempt += 1;
        const mode = options.expansionMode ?? "success";
        if (mode === "unknown") {
          throw new Error("provider_comm_lost");
        }
        if (mode === "transient_once" && expansionAttempt === 1) {
          throw new AiInvocationError({
            kind: "rate_limit",
            retryable: true,
            message: "rate limited",
          });
        }
        if (mode === "transient_always") {
          throw new AiInvocationError({
            kind: "rate_limit",
            retryable: true,
            message: "rate limited",
          });
        }
        if (mode === "definitive") {
          throw new AiInvocationError({
            kind: "auth",
            retryable: false,
            message: "invalid api key",
          });
        }
        if (mode === "invalid_output") {
          return {
            imageBase64: await imageBase64(64, 64, "jpeg"),
            mimeType: "image/jpeg",
            model: "gpt-image-2.5-sunburst",
          };
        }
        return {
          imageBase64: await imageBase64(1152, 2048, "jpeg"),
          mimeType: "image/jpeg",
          model: "gpt-image-2.5-sunburst",
        };
      },
    } as never,
    catalog: { getActiveCatalogRows: async () => [CATALOG_ROW] },
    pricing: {
      getModelPricing: async () => ({ pricing: COMPLETE_PRICING, versionId: "pricing-1" }),
    },
  };

  const real = composeNineSixteenDeps({
    client: world.client,
    clock: () => now,
    callIdFactory: () => "call",
    base: (input, inner) =>
      runSquareBase(input, { ...baseSeams, ...(inner ?? {}), client: world.client }),
    expand: (input, inner) =>
      expandVerticalToNineSixteen(input, {
        client: world.client,
        ...inner,
        ...expandSeams,
      }),
    probeVertical: new CompositionVerticalProbe({ client: world.client }),
    copyInvoker: baseSeams.copyInvoker,
    copyDirectorEnabled: true,
  });

  /**
   * Preflight read-only da seleção CONGELADA sobre as costuras FALSAS de
   * catálogo/pricing (nunca lê a configuração administrativa e nunca toca
   * banco/rede). O controlador `frozenPreflight` força os três desfechos.
   */
  const deps: RunNineSixteenDeps = {
    ...real,
    base: (input, inner) =>
      real.base(input, { ...baseSeams, ...(inner ?? {}) }),
    prepare: (input, inner) => real.prepare(input, inner),
    expand: (input, inner) => real.expand(input, { ...inner, ...expandSeams }),
  };

  return {
    deps,
    counters,
    setClock: (value: number) => {
      now = value;
    },
    advanceClock: (delta: number) => {
      now += delta;
    },
  };
}

export async function createJointWorldDeps(
  world: JointWorld,
  options: OfflineProviderOptions = {},
) {
  const nine = await createOfflineDeps(world, options);
  const thumbnailContext: ThumbnailContext = {
    endpoint: "https://offline.supabase.test",
    uploader: {
      endpoint: "https://offline.supabase.test",
      async upload({ path, buffer, contentType }) {
        const { error } = await world.client.storage
          .from(THUMBNAIL_BUCKET)
          .upload(path, buffer, { contentType, upsert: false });
        return { error: error ?? null };
      },
    },
  };
  const joint = createJointDeps({
    client: world.client,
    clock: world.clock,
    callIdFactory: () => "joint-call",
    thumbnailContext,
  });
  const creditClient = new ProductOneToOneCreditOperationClient(world.client);
  const attempt = new ProductOneToOneAttemptStartClient(world.client);
  const squareProbe = new CompositionSquareOriginalProbe({ client: world.client });
  const verticalProbe = new CompositionVerticalProbe({ client: world.client });
  const jointClient = new TwoFormatJointFinancialClient(world.client);

  const baseDeps = {
    client: world.client,
    control: nine.deps.control,
    base: nine.deps.base,
    readFrozenState: nine.deps.readFrozenState,
    readInputBytes: nine.deps.reconstruction?.readInputBytes,
    repairEvidence: joint.repairEvidence,
    clock: nine.deps.clock,
  };

  const verticalDeps = {
    resume: (input: { campaignId: string; operationId: string }) =>
      joint.control.resume(input),
    prepare: (input: Parameters<typeof runPreparationStep>[0]) =>
      runPreparationStep(input, {
        prepare: nine.deps.prepare,
        client: world.client,
      }),
    expand: (input: Parameters<typeof runExpansionStep>[0]) =>
      runExpansionStep(input, {
        control: joint.control,
        expand: (expandInput, expandDeps) =>
          nine.deps.expand(expandInput, expandDeps),
        preflightFrozenExpansion: nine.deps.preflightFrozenExpansion,
        clock: joint.clock,
        client: world.client,
      }),
    probeVertical: nine.deps.probeVertical.probeVerticalArtifact.bind(
      nine.deps.probeVertical,
    ),
    beginPublication: joint.credit.beginPublication,
    abortPublication: joint.credit.abortPublication,
    deliverFormat: jointClient.deliverFormat.bind(jointClient),
    clock: joint.clock,
  };

  const squareDeps = {
    probeSquareOriginal: squareProbe.probeSquareOriginal.bind(squareProbe),
    beginPublication: joint.credit.beginPublication,
    abortPublication: joint.credit.abortPublication,
    deliverFormat: jointClient.deliverFormat.bind(jointClient),
    generateThumbnail: joint.generateThumbnail,
    clock: joint.clock,
  };

  const finalizeDeps = {
    finish: (input: Parameters<typeof joint.control.finish>[0]) => joint.control.finish(input),
    recordOutcome: (input: Parameters<typeof joint.control.recordOutcome>[0]) =>
      joint.control.recordOutcome(input),
    recordFormatOutcome: async (input: {
      campaignId: string;
      operationId: string;
      outcome: "failed" | "unknown";
      supportReference?: string | null;
    }) => {
      await attempt.recordOperationOutcome({
        campaignId: input.campaignId,
        operationId: input.operationId,
        outcome: input.outcome,
        supportReference: input.supportReference ?? null,
      });
    },
    probeSquare: squareProbe.probeSquareOriginal.bind(squareProbe),
    probeVertical: verticalProbe.probeVerticalArtifact.bind(verticalProbe),
    getPublicationEpoch: creditClient.getPublicationEpoch.bind(creditClient),
    refundFormat: jointClient.refundFormat.bind(jointClient),
    readFormatStatuses: (input: {
      campaignId: string;
      operationId: string;
      storeId?: string;
    }) => readTwoFormatDelivery(input, { client: world.client }),
  };

  const thumbnails = new Set<string>();
  let thumbnailCalls = 0;
  const resumeDeps = {
    readDelivery: (input: {
      campaignId: string;
      operationId: string;
      storeId?: string;
    }) => readTwoFormatDelivery(input, { client: world.client }),
    readOperationView: (input: { campaignId: string; operationId: string }) =>
      joint.control.getOperationView(input),
    probeSquare: squareProbe.probeSquareOriginal.bind(squareProbe),
    reconstruct: async (input: {
      storeId: string;
      campaignId: string;
      operationId: string;
    }) => {
      const frozen = await nine.deps.readFrozenState({
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      const deps = {
        client: world.client,
        readInputBytes: nine.deps.reconstruction?.readInputBytes,
        readFrozenState: nine.deps.readFrozenState,
      };
      if (frozen.kind === "complete") {
        const result = await reconstructForComplete({ ...input, frozen }, deps);
        return result.ok
          ? { ok: true as const, content: result.content, frozenState: frozen }
          : result;
      }
      if (frozen.kind === "repairable") {
        const result = await reconstructForRepair({ ...input, frozen }, deps);
        return result.ok
          ? { ok: true as const, content: result.content, frozenState: frozen }
          : result;
      }
      if (frozen.kind === "absent") {
        const result = await reconstructFirstExecution({ ...input, frozen }, deps);
        return result.ok
          ? { ok: true as const, content: result.content, frozenState: frozen }
          : result;
      }
      return { ok: false as const, reason: "frozen_state_indeterminate", definitive: true };
    },
    runBase: (input: Parameters<typeof runJointBase>[0]) =>
      runJointBase(input, baseDeps),
    deliverSquare: (input: Parameters<typeof deliverJointSquare>[0]) =>
      deliverJointSquare(input, squareDeps),
    deliverVertical: (input: Parameters<typeof deliverTwoFormatVertical>[0]) =>
      deliverTwoFormatVertical(input, verticalDeps),
    repairProjection: (input: {
      storeId: string;
      campaignId: string;
      operationId: string;
    }) =>
      repairJointProjection(input, {
        readDelivery: (readInput) =>
          readTwoFormatDelivery(readInput, { client: world.client }),
        projectCampaign: (projectInput) =>
          jointClient.projectCampaign(projectInput),
        thumbnailExists: async ({ campaignId, role }) =>
          thumbnails.has(`${campaignId}:${role}`),
        generateThumbnail: async (thumbnailInput) => {
          const result = await joint.generateThumbnail(thumbnailInput);
          thumbnailCalls += 1;
          if (
            typeof result === "object" &&
            result !== null &&
            ((result as { status?: unknown }).status === "created" ||
              (result as { status?: unknown }).status === "already_exists")
          ) {
            thumbnails.add(`${thumbnailInput.campaignId}:${thumbnailInput.role}`);
          }
          return result;
        },
        clock: joint.clock,
      }),
  };

  async function readResolutionState(input: {
    campaignId: string;
    operationId: string;
    deliveryOperationId: string;
  }): Promise<
    | { kind: "found"; state: import("@/lib/product-two-format/orchestration/resolve-joint-pending").JointResolutionState }
    | { kind: "absent" }
    | { kind: "read_failed"; reason: string }
  > {
    const campaign = world.rows.find(
      (row) => row.__table === "campaigns" && row.id === input.campaignId,
    );
    if (!campaign || typeof campaign.store_id !== "string") {
      return { kind: "absent" };
    }
    const own = world.creditRowFor(input.deliveryOperationId);
    const shared = world.creditRowFor(input.operationId);
    if (!own || !shared) return { kind: "absent" };
    const links = world.rows.filter(
      (row) =>
        row.__table === "product_two_format_deliveries" &&
        row.campaign_id === input.campaignId &&
        row.operation_id === input.operationId,
    );
    const square = links.find((row) => row.format === "1:1");
    const vertical = links.find((row) => row.format === "9:16");
    const linkComplete =
      links.length === 2 &&
      square !== undefined &&
      vertical !== undefined &&
      square.delivery_operation_id !== input.operationId &&
      vertical.delivery_operation_id === input.operationId &&
      square.store_id === campaign.store_id &&
      vertical.store_id === campaign.store_id &&
      own.store_id === campaign.store_id &&
      shared.store_id === campaign.store_id;
    const ownOutcome =
      input.deliveryOperationId === input.operationId
        ? world.outcome()
        : world.rows.find(
            (row) =>
              row.__table === "product_1_1_generation_outcomes" &&
              row.operation_id === input.deliveryOperationId,
          ) ?? null;
    const sharedOutcome = world.outcome();
    const kindOf = (row: Record<string, unknown> | null) => {
      if (!row) return "none" as const;
      if (row.outcome === "failed") return "failed" as const;
      if (row.outcome === "unknown") return "unknown" as const;
      return "indeterminate" as const;
    };
    const activeClaim = world.rows.some(
      (row) =>
        row.__table === "product_generation_active_claims_v" &&
        row.campaign_id === input.campaignId &&
        row.operation_id === input.operationId &&
        row.status === "in_progress",
    );
    return {
      kind: "found",
      state: {
        storeId: campaign.store_id,
        creditStatus: own.status,
        outcomeKind: kindOf(ownOutcome as Record<string, unknown> | null),
        sharedOutcomeKind: kindOf(sharedOutcome as Record<string, unknown> | null),
        sharedCreditStatus: shared.status,
        activeClaim,
        linkComplete,
      },
    };
  }

  const adminDeps = {
    readDelivery: (input: {
      campaignId: string;
      operationId: string;
      storeId?: string;
    }) => readTwoFormatDelivery(input, { client: world.client }),
    readResolutionState,
    probeSquare: squareProbe.probeSquareOriginal.bind(squareProbe),
    probeVertical: verticalProbe.probeVerticalArtifact.bind(verticalProbe),
    beginPublication: joint.credit.beginPublication,
    abortPublication: joint.credit.abortPublication,
    getPublicationEpoch: creditClient.getPublicationEpoch.bind(creditClient),
    recordFormatOutcome: async (input: {
      campaignId: string;
      operationId: string;
      outcome: "failed" | "unknown";
    }) => {
      await attempt.recordOperationOutcome(input);
    },
    deliverFormat: jointClient.deliverFormat.bind(jointClient),
    refundFormat: jointClient.refundFormat.bind(jointClient),
    writeAudit: async (entry: {
      actorId: string;
      action: string;
      targetType: "campaign";
      targetId: string;
      reason: string;
      operationId: string;
      metadata: Readonly<Record<string, unknown>>;
    }) => {
      if (
        world.rows.some(
          (row) =>
            row.__table === "admin_audit_log" &&
            row.operation_id === entry.operationId,
        )
      ) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      world.rows.push({
        __table: "admin_audit_log",
        actor_id: entry.actorId,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        reason: entry.reason,
        operation_id: entry.operationId,
        metadata: entry.metadata,
      });
    },
    readAuditByOperationId: async (operationId: string) => {
      const row = world.rows.find(
        (candidate) =>
          candidate.__table === "admin_audit_log" &&
          candidate.operation_id === operationId,
      );
      return row
        ? {
            kind: "found" as const,
            record: {
              action: String(row.action),
              targetType: String(row.target_type),
              targetId: String(row.target_id),
              operationId:
                typeof row.operation_id === "string" ? row.operation_id : null,
              metadata:
                row.metadata !== null && typeof row.metadata === "object"
                  ? (row.metadata as Readonly<Record<string, unknown>>)
                  : null,
            },
          }
        : { kind: "absent" as const };
    },
  };

  return {
    joint,
    nine,
    baseDeps,
    verticalDeps,
    squareDeps,
    finalizeDeps,
    resumeDeps,
    adminDeps,
    counters: nine.counters,
    thumbnailCalls: () => thumbnailCalls,
  };
}

export async function createJointAdminDeps(world: JointWorld) {
  const deps = await createJointWorldDeps(world);
  return deps.adminDeps;
}

export function jointBaseInput(
  overrides: Partial<import("@/lib/product-9-16-two-stage/orchestration/base-step").BaseStepInput> = {},
): import("@/lib/product-9-16-two-stage/orchestration/base-step").BaseStepInput {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    content: {
      briefing: BRIEFING as never,
      briefingText: JSON.stringify(BRIEFING),
      campaignIntent: "offer",
      backgroundDirection: "studio",
      productImagesDataUrls: [PRODUCT_DATA_URL],
      referenceSelections: FROZEN_REFERENCES as never,
      usdBrlRateAtGeneration: 5.1,
      creditValueBrlAtGeneration: 1,
    },
    acquisitionId: "11111111-1111-4111-8111-111111111111",
    attemptReference: "initial",
    attemptTarget: "primary",
    deadlineAtMs: Date.now() + 60_000,
    baseStatus: "pending",
    allowNewPaidStep: true,
    frozenState: { kind: "absent" },
    ...overrides,
  };
}

export function jointVerticalInput(
  overrides: Partial<import("@/lib/product-two-format/orchestration/deliver-joint-vertical").JointVerticalDeliveryInput> = {},
): import("@/lib/product-two-format/orchestration/deliver-joint-vertical").JointVerticalDeliveryInput {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    acquisitionId: "22222222-2222-4222-8222-222222222222",
    attemptReference: "initial",
    attemptTarget: "initial",
    deadlineAtMs: Date.now() + 60_000,
    expansionStatus: "pending",
    selection: CONFIGURED_SELECTION,
    allowNewPaidStep: true,
    ...overrides,
  };
}

export function jointSquareInput(
  overrides: Partial<import("@/lib/product-two-format/orchestration/deliver-square").JointSquareDeliveryInput> = {},
): import("@/lib/product-two-format/orchestration/deliver-square").JointSquareDeliveryInput {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    deliveryOperationId: SQUARE_DELIVERY_ID,
    ...overrides,
  };
}

export function jointOpenInput(
  overrides: Partial<import("@/lib/product-two-format/orchestration/joint-operation-service").JointOpenInput> = {},
): import("@/lib/product-two-format/orchestration/joint-operation-service").JointOpenInput {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    squareDeliveryId: SQUARE_DELIVERY_ID,
    inputSnapshot: {
      generationOrigin: "two_format_two_stage",
      generationContractVersion: "f60.7-two-format-v1",
      campaignFormat: "1:1+9:16",
      formatContractVersion: "f60.7-two-format-v1",
    },
    mode: "new",
    selection: CONFIGURED_SELECTION,
    ...overrides,
  } as import("@/lib/product-two-format/orchestration/joint-operation-service").JointOpenInput;
}

export function initialInput(
  overrides: Partial<RunNineSixteenInput> = {},
): RunNineSixteenInput {
  return {
    mode: "initial",
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    requestStartedAtMs: Date.now(),
    ...overrides,
  };
}

export function continueInput(
  overrides: Partial<RunNineSixteenInput> = {},
): RunNineSixteenInput {
  return {
    mode: "continue",
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    requestStartedAtMs: Date.now(),
    acquisitionIds: {
      base: "11111111-1111-4111-8111-111111111111",
      expansion: "22222222-2222-4222-8222-222222222222",
    },
    ...overrides,
  };
}

export function terminalOf(events: Array<Record<string, unknown>>) {
  return events.at(-1) ?? {};
}

/**
 * Deriva a seleção congelada da operação REALMENTE persistida no mundo falso,
 * usando o cliente de controle REAL e a derivação PURA do orquestrador:
 * v1 → `legacy_sunburst_low` explícito; v2 completa → seleção congelada;
 * v2 incompleta → `invalid`. Nenhum banco/rede.
 */
export async function frozenSelectionOf(deps: RunNineSixteenDeps) {
  const lookup = await deps.control.getOperationView({
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
  });
  if (lookup.kind !== "found") throw new Error(`operation_${lookup.kind}`);
  return deriveFrozenExpansionSelection(lookup.view);
}

export const COMPOSITION_BUCKET = COMPOSITION_ARTIFACT_BUCKET;

/**
 * Sink simulado: o teste mocka `AiCostTracker` para gravar aqui, mantendo o
 * `DefaultAiTelemetrySink`/resolucao de custo REAIS.
 */
export interface TelemetryEvent {
  readonly cost?: {
    readonly estimatedCostUsd?: number | null;
    readonly costSource?: string | null;
    readonly pricingVersion?: string | null;
  } | null;
  readonly tokens?: {
    readonly promptTokens?: number | null;
    readonly completionTokens?: number | null;
    readonly totalTokens?: number | null;
    readonly imageTokens?: number | null;
  } | null;
}

interface TelemetryGlobal {
  __vendeoTelemetryEvents?: TelemetryEvent[];
}

export function telemetryEvents(): TelemetryEvent[] {
  return (globalThis as unknown as TelemetryGlobal).__vendeoTelemetryEvents ?? [];
}

export function resetTelemetryEvents(): void {
  (globalThis as unknown as TelemetryGlobal).__vendeoTelemetryEvents = [];
}

export function recordTelemetryEvent(event: TelemetryEvent): void {
  const store = globalThis as unknown as TelemetryGlobal;
  store.__vendeoTelemetryEvents = [...(store.__vendeoTelemetryEvents ?? []), event];
}
