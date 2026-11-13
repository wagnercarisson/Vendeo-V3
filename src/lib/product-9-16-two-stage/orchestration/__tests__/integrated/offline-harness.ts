import { createHash } from "node:crypto";
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
import { VERTICAL_COMPOSITION_FIXTURES } from "@/lib/product-vertical-9-16/__tests__/fixtures/vertical-briefings";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { AiInvocationResult } from "@/lib/ai/types";
import { AiInvocationError } from "@/lib/ai/types";
import type { SquareBaseDeps } from "@/lib/campaign/square-base/run-square-base";
import type { SquareBaseInput } from "@/lib/campaign/square-base/types";
import type { ExpandVerticalDeps } from "@/lib/campaign/vertical-expansion/expand";
import type {
  RunNineSixteenDeps,
  RunNineSixteenInput,
} from "../../types";
import type { TwoStageStepStatus } from "../../../types";
import { createNineSixteenDeps } from "../../delivery-deps";
import { runNineSixteenTwoStageGeneration } from "../../run-nine-sixteen";

export const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
export const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
export const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";

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
export function createOfflineWorld() {
  const base = createFakeArtifactBackend();
  base.seedStore(STORE_ID, "user-1");
  base.seedCampaign(CAMPAIGN_ID, STORE_ID);

  const rows: Row[] = [];
  const rpcCounts: RpcCounts = {};
  const clockBase = Date.now();

  const tableRows = (table: string) => rows.filter((row) => row.__table === table);
  const creditRow = (): CreditRow | null =>
    (tableRows("product_1_1_campaign_credit_operations")[0] as CreditRow) ?? null;
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

  function from(table: string) {
    if (table === "campaign_composition_artifacts") {
      return base.client.from(table);
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
        generationOrigin: "two_stage_9_16",
        campaignFormat: "9:16",
      },
      identity_snapshot: null,
    });
    base.putObject(PRODUCT_STORAGE_PATH, PRODUCT_BYTES, {}, "campaign-images");
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

  /* ---------------------------------------------------------------------- */
  /* RPCs (contratos das migrations, sem Postgres)                           */
  /* ---------------------------------------------------------------------- */

  function rpc(name: string, params: Record<string, unknown>) {
    rpcCounts[name] = (rpcCounts[name] ?? 0) + 1;
    switch (name) {
      case "product_9_16_open_operation":
        return openOperation(params);
      case "product_9_16_acquire_step":
        return acquireStep(params);
      case "product_9_16_finish_step":
        return finishStep(params);
      case "product_9_16_record_outcome":
        return recordOutcome(params);
      case "product_9_16_resume_operation":
        return resumeOperation();
      case "product_1_1_begin_publication":
        return beginPublication();
      case "product_1_1_mark_campaign_credit_art_uploaded":
        return markArtUploaded(params);
      case "product_1_1_deliver_campaign_credit_operation":
        return deliver(params);
      case "product_1_1_get_campaign_credit_operation":
        return getCredit();
      case "product_1_1_get_publication_epoch":
        return creditRow()?.state_epoch ?? null;
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
      };
    }
    rows.push({
      __table: "product_9_16_two_stage_operations",
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      store_id: params.p_store_id,
      origin: "9_16_two_stage",
      contract_version: 1,
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

  function beginPublication() {
    const credit = creditRow();
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
    credit.publication_token = `pub-${credit.state_epoch + 1}`;
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
        const data = rpc(name, params);
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
    seedScenario,
    seedFrozenState,
    credit: creditRow,
    copyState: () => copyRows().map(copy),
    step: (stage: "base" | "expansion") =>
      step(stage) as { status: TwoStageStepStatus; attempts_used: number } | undefined,
    claims,
    outcome,
    operation,
    clock: () => clockBase,
  };
}

export type OfflineWorld = ReturnType<typeof createOfflineWorld>;

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
 * Compõe as dependências REAIS via `createNineSixteenDeps`, injetando apenas as
 * fronteiras de banco/Storage/provider (seams já previstos nos adaptadores).
 */
export async function createOfflineDeps(
  world: OfflineWorld,
  options: OfflineProviderOptions = {},
) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://offline.supabase.test";
  }
  const counters = {
    baseProviderCalls: 0,
    expansionProviderCalls: 0,
    copyCalls: 0,
    copyInputs: [] as unknown[],
    telemetryEmits: 0,
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
    readFrozenState: (async (
      input: { campaignId: string; operationId: string },
      deps?: { client?: SupabaseClient },
    ) => {
      const mod = await import("@/lib/campaign/square-base/frozen-state");
      return mod.readSquareBaseFrozenState(input, { client: deps?.client ?? world.client });
    }) as never,
    probe: (async () => ({ kind: "proceed" })) as never,
    resolveFirstComposition: (async (input: SquareBaseInput) => {
      const referenceSelections = input.productImagesDataUrls.map(
        (dataUrl: string, index: number) => ({
          kind: index === 0 ? ("product" as const) : ("reference" as const),
          id: sha256(dataUrl),
          index,
        }),
      );
      const content = {
        briefing: input.briefing,
        identityDirective: input.identityDirective ?? null,
        referenceSelections,
        ...(input.references === undefined ? {} : { references: input.references }),
      };
      const composition = composeSquareBasePrompt(content);
      const candidate = buildCandidatePayload(input, {
        promptBase: undefined,
      });
      if (!candidate) throw new Error("candidate_unavailable");
      const serialized = serializeFrozenPayload(candidate);
      const fingerprint = frozenFingerprint(candidate, serialized);
      const snapshotId = "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f";
      world.seedFrozenState({
        snapshotId,
        fingerprint,
        serialized,
        payload: candidate,
      });
      return {
        ok: true,
        snapshot: {
          campaignId: CAMPAIGN_ID,
          primaryModel: "gpt-image-2.5-sunburst",
          primaryQuality: "medium",
          fallbackModel: "gpt-image-2",
          fallbackQuality: "low",
          configVersionId: "cfg-1",
          origin: "selection",
          createdAt: "2026-11-13T00:00:00.000Z",
        },
        evidence: {} as never,
        snapshotOriginalId: snapshotId,
        frozenPayload: candidate,
        composition,
      };
    }) as never,
    resolveResumeConfig: (async () => ({
      ok: true,
      snapshot: {
        id: "7a8b9c0d-7a8b-4c0d-9e1f-7a8b9c0d1e2f",
        campaignId: CAMPAIGN_ID,
        primaryModel: "gpt-image-2.5-sunburst",
        primaryQuality: "medium",
        fallbackModel: "gpt-image-2",
        fallbackQuality: "low",
        configVersionId: "cfg-1",
        origin: "selection",
        runId: null,
        traceId: null,
        createdAt: "2026-11-13T00:00:00.000Z",
      },
      pair: {
        primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
        fallback: { model: "gpt-image-2", quality: "low" },
      },
    })) as never,
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

  const expandSeams: ExpandVerticalDeps = {
    client: world.client,
    clock: () => now,
    callIdFactory: () => `exp-call-${counters.expansionProviderCalls + 1}`,
    invoker: {
      invokePrepared: async () => {
        counters.expansionProviderCalls += 1;
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

  const real = createNineSixteenDeps({
    client: world.client,
    clock: () => now,
    callIdFactory: () => "call",
  });

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

export async function runOffline(
  input: RunNineSixteenInput,
  deps: RunNineSixteenDeps,
): Promise<Array<Record<string, unknown>>> {
  const response = await runNineSixteenTwoStageGeneration(input, deps);
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

export function terminalOf(events: Array<Record<string, unknown>>) {
  return events.at(-1) ?? {};
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
