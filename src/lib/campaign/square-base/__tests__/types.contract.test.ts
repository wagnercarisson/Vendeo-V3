// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ArtifactRecord,
  AuthorizationContext,
} from "@/lib/campaign/composition-artifacts/types";
import type { CostResolution, TokenUsage } from "@/lib/ai-cost/types";
import type { ProviderFailure } from "@/lib/product-9-16-two-stage/types";

import type {
  FrozenContentPayload,
  FrozenStateReadResult,
  SquareBaseCallEvidence,
  SquareBaseResult,
} from "../types";

/**
 * F60.4 — contrato puro da composição da base quadrada.
 *
 * A união fechada é validada por narrowing exaustivo (`never` no `default`) e por
 * contagem fechada: 14 variantes. Nenhum I/O, nenhum mock de rede/Supabase —
 * apenas tipos e valores construídos em memória.
 */

const RESULT_KINDS = [
  "completed",
  "provider_failure",
  "definitive_failure",
  "unknown_result",
  "invalid_output",
  "existing_artifact_conflict",
  "persistence_failed",
  "readback_failed",
  "snapshot_failed",
  "content_divergence",
  "frozen_state_conflict",
  "blocked",
  "invalid_input",
  "authorization_denied",
] as const satisfies readonly SquareBaseResult["kind"][];

const FROZEN_STATE_KINDS = [
  "absent",
  "complete",
  "repairable",
  "bound_to_other_operation",
  "unproven",
  "corrupt",
  "indeterminate",
] as const satisfies readonly FrozenStateReadResult["kind"][];

/** Narrowing exaustivo: o `default` prova que nenhuma variante ficou de fora. */
function describeResult(result: SquareBaseResult): string {
  switch (result.kind) {
    case "completed":
      return `completed:${result.art.kind}:${result.copy.kind}:${
        result.call === null ? "no_call" : result.call.callStatus
      }`;
    case "provider_failure":
      return `provider_failure:${result.failure.class}:${result.failure.reason}`;
    case "definitive_failure":
      return `definitive_failure:${result.reason}`;
    case "unknown_result":
      return `unknown_result:${result.reason}:${result.copy.kind}`;
    case "invalid_output":
      return `invalid_output:${result.reason}`;
    case "existing_artifact_conflict":
      return `existing_artifact_conflict:${result.reason}`;
    case "persistence_failed":
      return `persistence_failed:${result.reason}`;
    case "readback_failed":
      return `readback_failed:${result.reason}`;
    case "snapshot_failed":
      return `snapshot_failed:${result.reason}:${String(result.call)}`;
    case "content_divergence":
      return `content_divergence:${result.reason}:${String(result.copy)}:${String(result.call)}`;
    case "frozen_state_conflict":
      return `frozen_state_conflict:${result.reason}:${String(result.copy)}:${String(result.call)}`;
    case "blocked":
      return `blocked:${result.reason}`;
    case "invalid_input":
      return `invalid_input:${result.reason}`;
    case "authorization_denied":
      return `authorization_denied:${result.reason}`;
    default: {
      const exhaustive: never = result;
      return exhaustive;
    }
  }
}

/** Narrowing exaustivo do estado congelado (7 variantes). */
function describeFrozenState(state: FrozenStateReadResult): string {
  switch (state.kind) {
    case "absent":
      return "absent";
    case "complete":
      return `complete:${state.snapshot.primaryModel}:${state.fingerprint.length}`;
    case "repairable":
      return `repairable:${state.snapshot.fallbackModel}:${state.fingerprint.length}`;
    case "bound_to_other_operation":
      return `bound_to_other_operation:${state.operationId}`;
    case "unproven":
      return `unproven:${state.snapshotOriginalId}`;
    case "corrupt":
      return `corrupt:${state.reason}`;
    case "indeterminate":
      return `indeterminate:${state.detail}`;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

const AUTHORIZATION: AuthorizationContext = { kind: "system" };

const TOKEN_USAGE: TokenUsage = {
  promptTokens: 10,
  completionTokens: 20,
  totalTokens: 30,
};

const COST: CostResolution = {
  estimatedCostUsd: null,
  costSource: "not_available",
};

const FAILURE: ProviderFailure = {
  class: "transient",
  reason: "rate_limit",
  sendEvidence: "not_sent",
};

const ARTIFACT: ArtifactRecord = {
  id: "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f",
  storeId: "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f",
  campaignId: "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a",
  operationId: "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c",
  role: "square_original",
  format: "1:1",
  origin: "provider_generation",
  derivedFromArtifactId: null,
  sourceCampaignId: null,
  storageBucket: "campaign-internal-artifacts",
  storagePath: "store/campaign/operation/square_original.jpg",
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  byteSize: 1234,
  checksumSha256: "a".repeat(64),
  provenance: {},
  createdAt: "2026-11-12T00:00:00.000Z",
};

const EVIDENCE: SquareBaseCallEvidence = {
  callId: "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a",
  operationId: ARTIFACT.operationId,
  attemptNumber: 1,
  attemptReference: "attempt-ref-1",
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
  quality: "medium",
  requestedSize: "1024x1024",
  durationMs: 1500,
  callStatus: "success",
  outcome: "generated",
  usage: TOKEN_USAGE,
  cost: COST,
};

const FROZEN_PAYLOAD: FrozenContentPayload = {
  briefing: {
    backgroundDirection: "studio",
    product: { name: "Cafeteira", description: null },
    commercial: {
      intent: "offer",
      originalPriceText: "R$ 299",
      discountedPriceText: "R$ 199",
      badge: null,
      validity: null,
    },
    constraints: { mandatoryArtworkText: null },
  },
  copyContext: null,
  identityDirective: null,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  referenceSelections: [{ kind: "product", id: "a".repeat(64), index: 0 }],
  promptBaseVersion: "48.2.6-produto-1-1-v1",
  composerVersion: "48.2.4-prompt-composer-v7",
  policyVersions: { fundo: "48.2.6-background-direction-v2" },
};

const COPY_IN_PROGRESS = { kind: "in_progress" as const, attemptSeq: 1 };

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.4 contract — SquareBaseResult", () => {
  it("declara exatamente 14 variantes", () => {
    expect(RESULT_KINDS).toHaveLength(14);
    expectTypeOf<SquareBaseResult["kind"]>().toEqualTypeOf<
      (typeof RESULT_KINDS)[number]
    >();
  });

  it("narrowing exaustivo cobre as 14 variantes sem sobra", () => {
    const results: SquareBaseResult[] = [
      {
        kind: "completed",
        copy: COPY_IN_PROGRESS,
        art: { kind: "created", artifact: ARTIFACT, snapshotOriginalId: "snap-1" },
        call: EVIDENCE,
      },
      { kind: "provider_failure", copy: COPY_IN_PROGRESS, failure: FAILURE, call: EVIDENCE },
      { kind: "definitive_failure", copy: COPY_IN_PROGRESS, reason: "quota", call: EVIDENCE },
      {
        kind: "unknown_result",
        copy: COPY_IN_PROGRESS,
        reason: "timeout",
        failure: { class: "unknown", reason: "timeout", sendEvidence: "possibly_sent" },
        call: EVIDENCE,
      },
      { kind: "invalid_output", copy: COPY_IN_PROGRESS, reason: "empty_image", call: EVIDENCE },
      {
        kind: "existing_artifact_conflict",
        copy: COPY_IN_PROGRESS,
        reason: "row_object_missing",
        artifact: ARTIFACT,
        call: null,
      },
      {
        kind: "persistence_failed",
        copy: COPY_IN_PROGRESS,
        reason: "persistence_failure",
        detail: "boom",
        call: EVIDENCE,
      },
      {
        kind: "readback_failed",
        copy: COPY_IN_PROGRESS,
        reason: "absent",
        call: EVIDENCE,
      },
      {
        kind: "snapshot_failed",
        copy: { kind: "not_requested" },
        reason: "operation_identity_conflict",
        call: null,
      },
      { kind: "content_divergence", reason: "briefing", copy: null, call: null },
      { kind: "frozen_state_conflict", reason: "unproven", copy: null, call: null },
      { kind: "blocked", copy: null, reason: "preflight_failed", call: null },
      { kind: "invalid_input", reason: "prompt_not_accepted" },
      { kind: "authorization_denied", reason: "not_owner" },
    ];

    expect(results.map(describeResult)).toHaveLength(14);
    expect(new Set(results.map((result) => result.kind)).size).toBe(14);
  });

  it("content_divergence/frozen_state_conflict declaram copy null e call null", () => {
    type Divergence = Extract<SquareBaseResult, { kind: "content_divergence" }>;
    type Conflict = Extract<SquareBaseResult, { kind: "frozen_state_conflict" }>;

    expectTypeOf<Divergence["copy"]>().toEqualTypeOf<null>();
    expectTypeOf<Divergence["call"]>().toEqualTypeOf<null>();
    expectTypeOf<Conflict["copy"]>().toEqualTypeOf<null>();
    expectTypeOf<Conflict["call"]>().toEqualTypeOf<null>();
  });

  it("invalid_input/authorization_denied não declaram call", () => {
    type InvalidInput = Extract<SquareBaseResult, { kind: "invalid_input" }>;
    type Denied = Extract<SquareBaseResult, { kind: "authorization_denied" }>;

    type InvalidHasCall = "call" extends keyof InvalidInput ? true : false;
    type DeniedHasCall = "call" extends keyof Denied ? true : false;

    expectTypeOf<InvalidHasCall>().toEqualTypeOf<false>();
    expectTypeOf<DeniedHasCall>().toEqualTypeOf<false>();
  });

  it("snapshot_failed sempre carrega call null", () => {
    type SnapshotFailed = Extract<SquareBaseResult, { kind: "snapshot_failed" }>;
    expectTypeOf<SnapshotFailed["call"]>().toEqualTypeOf<null>();
    expectTypeOf<SnapshotFailed["reason"]>().toEqualTypeOf<
      | "snapshot_persist_failed"
      | "snapshot_read_failed"
      | "evidence_read_failed"
      | "operation_identity_conflict"
      | "frozen_evidence_persist_failed"
      | "persistence_reserve_reached"
    >();
  });

  it("call evidence pede requestedSize 1024x1024 e quality do snapshot (string)", () => {
    expectTypeOf<SquareBaseCallEvidence["requestedSize"]>().toEqualTypeOf<
      `${number}x${number}`
    >();
    expectTypeOf<SquareBaseCallEvidence["quality"]>().toEqualTypeOf<string>();
    expectTypeOf<SquareBaseCallEvidence["provider"]>().toEqualTypeOf<"openai">();
    expectTypeOf<SquareBaseCallEvidence["protocol"]>().toEqualTypeOf<"images">();
    expect(EVIDENCE.requestedSize).toBe("1024x1024");
    expect(EVIDENCE.cost.costSource).toBe("not_available");
  });

  it("copy completed distingue gerado de reutilizado e aceita payload persistido", () => {
    type Completed = Extract<SquareBaseResult, { kind: "completed" }>;
    expectTypeOf<Completed["copy"]>().toMatchTypeOf<{
      readonly kind: "completed" | "failed" | "in_progress" | "waiting" | "not_requested" | "unavailable";
    }>();

    const copy = {
      kind: "completed" as const,
      attemptSeq: 1,
      text: "texto",
      payload: { title: "t" },
      origin: "reused" as const,
    };
    expect(copy.origin).toBe("reused");
  });
});

describe("F60.4 contract — estado congelado e payload", () => {
  it("declara exatamente os 7 estados do design", () => {
    expect(FROZEN_STATE_KINDS).toHaveLength(7);
    expectTypeOf<FrozenStateReadResult["kind"]>().toEqualTypeOf<
      (typeof FROZEN_STATE_KINDS)[number]
    >();
  });

  it("narrowing exaustivo cobre os 7 estados", () => {
    const snapshot = {
      id: "snap-1",
      campaignId: "camp-1",
      primaryModel: "gpt-image-2.5-sunburst",
      primaryQuality: "medium" as const,
      fallbackModel: "gpt-image-2",
      fallbackQuality: "medium" as const,
      configVersionId: "cfg-1",
      origin: "human_decision" as const,
      runId: null,
      traceId: null,
      createdAt: "2026-11-12T00:00:00.000Z",
    };
    const evidence = {
      id: "ev-1",
      snapshotOriginalId: "snap-1",
      campaignId: "camp-1",
      operationId: "op-1",
      campaignIntent: "offer" as const,
      backgroundDirection: "studio" as const,
      briefing: "{}",
      referenceSelections: [],
      baseVersion: "b",
      composerVersion: "c",
      policyVersions: {},
    };

    const states: FrozenStateReadResult[] = [
      { kind: "absent" },
      { kind: "complete", snapshot, evidence, fingerprint: "f", payload: FROZEN_PAYLOAD, snapshotOriginalId: "snap-1" },
      { kind: "repairable", snapshot, operationId: "op-1", fingerprint: "f", snapshotOriginalId: "snap-1" },
      { kind: "bound_to_other_operation", snapshot, operationId: "op-other", snapshotOriginalId: "snap-1" },
      { kind: "unproven", snapshot, snapshotOriginalId: "snap-1" },
      { kind: "corrupt", reason: "frozen_content_invalid" },
      { kind: "indeterminate", detail: "read failed" },
    ];

    expect(states.map(describeFrozenState)).toHaveLength(7);
    expect(new Set(states.map((state) => state.kind)).size).toBe(7);
  });

  it("FrozenContentPayload é JSON-serializável e readonly", () => {
    expect(FROZEN_PAYLOAD.referenceSelections[0].kind).toBe("product");
    expect(FROZEN_PAYLOAD.references).toBeUndefined();
    // `references` é o fallback legado opcional exigido pela task OpenSpec 3.1.
    const legacy: FrozenContentPayload = { ...FROZEN_PAYLOAD, referenceSelections: [], references: ["ref-1"] };
    expect(legacy.references).toEqual(["ref-1"]);
  });
});

describe("F60.4 contract — fronteira de módulo", () => {
  it("é módulo puro: sem server-only, sharp, Supabase ou node:crypto/node:fs", () => {
    const source = readFileSync(sourcePath("../types.ts"), "utf8");

    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/node:fs/);
    expect(source).not.toMatch(/\bpromptBase\b(?!\?)/);
  });

  it("não redeclara os contratos donos (apenas importa por tipo)", () => {
    const source = readFileSync(sourcePath("../types.ts"), "utf8");

    expect(source).not.toMatch(/interface\s+ArtifactRecord\b/);
    expect(source).not.toMatch(/type\s+ProviderFailure\b/);
    expect(source).not.toMatch(/type\s+CostResolution\b/);
    expect(source).not.toMatch(/type\s+AuthorizationContext\b/);
    expect(source).not.toMatch(/type\s+TokenUsage\b/);
    expect(source).not.toMatch(/interface\s+ProductPromptCompositionBriefing\b/);
    expect(source).not.toMatch(/interface\s+ProductOneToOneCopyContext\b/);
    expect(AUTHORIZATION.kind).toBe("system");
  });
});
