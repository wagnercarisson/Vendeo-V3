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
  ExpandVerticalResult,
  ExpansionCallEvidence,
  ExpansionInvalidReason,
} from "../types";

/**
 * F60.3 — contrato puro da expansão.
 *
 * Toda a união é validada por narrowing exaustivo (`never` no `default`) e por
 * contagem fechada: 17 variantes (16 + `blocked`). Nenhum I/O, nenhum mock de
 * rede/Supabase — apenas tipos e valores construídos em memória.
 */

const RESULT_KINDS = [
  "expanded",
  "reused",
  "invalid_input",
  "authorization_denied",
  "source_unavailable",
  "model_unavailable",
  "pricing_unavailable",
  "existing_artifact_conflict",
  "provider_failure",
  "definitive_failure",
  "unknown_result",
  "invalid_output",
  "export_failed",
  "conflict",
  "persistence_failed",
  "readback_failed",
  "blocked",
] as const satisfies readonly ExpandVerticalResult["kind"][];

const INVALID_REASONS = [
  "input_not_object",
  "source_identity_invalid",
  "source_role_not_prepared",
  "operation_id_invalid",
  "attempt_number_invalid",
  "attempt_reference_invalid",
  "authorization_missing",
  "timeout_invalid",
  "path_not_accepted",
  "url_not_accepted",
  "bytes_not_accepted",
  "model_not_accepted",
  "quality_not_accepted",
  "prompt_not_accepted",
  "size_not_accepted",
] as const satisfies readonly ExpansionInvalidReason[];

/** Narrowing exaustivo: o `default` prova que nenhuma variante ficou de fora. */
function describeResult(result: ExpandVerticalResult): string {
  switch (result.kind) {
    case "expanded":
      return `expanded:${result.persistence}:${result.call.callStatus}`;
    case "reused":
      return `reused:${String(result.adoption)}:${
        result.call === null ? "no_call" : "with_call"
      }`;
    case "invalid_input":
      return `invalid_input:${result.reason}`;
    case "authorization_denied":
      return `authorization_denied:${result.reason}`;
    case "source_unavailable":
      return `source_unavailable:${result.reason}`;
    case "model_unavailable":
      return `model_unavailable:${result.reason}`;
    case "pricing_unavailable":
      return `pricing_unavailable:${result.reason}`;
    case "existing_artifact_conflict":
      return `existing_artifact_conflict:${result.reason}`;
    case "provider_failure":
      return `provider_failure:${result.failure.class}:${result.failure.reason}`;
    case "definitive_failure":
      return `definitive_failure:${result.reason}`;
    case "unknown_result":
      return `unknown_result:${result.reason}:${result.failure.class}`;
    case "invalid_output":
      return `invalid_output:${result.reason}`;
    case "export_failed":
      return `export_failed:${result.reason}`;
    case "conflict":
      return `conflict:${result.reason}`;
    case "persistence_failed":
      return `persistence_failed:${result.reason}`;
    case "readback_failed":
      return `readback_failed:${result.reason}`;
    case "blocked":
      return `blocked:${result.reason}`;
    default: {
      const exhaustive: never = result;
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

const FAILURE: ProviderFailure & { readonly class: "unknown" } = {
  class: "unknown",
  reason: "comm_lost",
  sendEvidence: "possibly_sent",
};

const ARTIFACT: ArtifactRecord = {
  id: "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f",
  storeId: "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f",
  campaignId: "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a",
  operationId: "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c",
  role: "vertical",
  format: "9:16",
  origin: "ai_expansion",
  derivedFromArtifactId: "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d",
  sourceCampaignId: null,
  storageBucket: "campaign-internal-artifacts",
  storagePath: "store/campaign/operation/vertical.jpg",
  width: 1080,
  height: 1920,
  mimeType: "image/jpeg",
  byteSize: 1234,
  checksumSha256: "a".repeat(64),
  provenance: { sourceOrigin: "composition_artifact" },
  createdAt: "2026-11-11T00:00:00.000Z",
};

const EVIDENCE: ExpansionCallEvidence = {
  callId: "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a",
  operationId: ARTIFACT.operationId,
  attemptNumber: 1,
  attemptReference: "attempt-ref-1",
  provider: "openai",
  model: "gpt-image-2.5-sunburst",
  protocol: "images",
  quality: "low",
  requestedSize: "1152x2048",
  returnedSize: "1152x2048",
  durationMs: 1500,
  callStatus: "success",
  outcome: "expanded",
  usage: TOKEN_USAGE,
  cost: COST,
};

function sourcePath(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

describe("F60.3 contract — ExpandVerticalResult", () => {
  it("declara exatamente 17 variantes (16 + blocked)", () => {
    expect(RESULT_KINDS).toHaveLength(17);
    expectTypeOf<ExpandVerticalResult["kind"]>().toEqualTypeOf<
      (typeof RESULT_KINDS)[number]
    >();
  });

  it("declara exatamente 15 motivos fechados de entrada inválida", () => {
    expect(INVALID_REASONS).toHaveLength(15);
    expectTypeOf<ExpansionInvalidReason>().toEqualTypeOf<
      (typeof INVALID_REASONS)[number]
    >();
  });

  it("narrowing exaustivo cobre as 17 variantes sem sobra", () => {
    const results: ExpandVerticalResult[] = [
      { kind: "expanded", artifact: ARTIFACT, bytes: Buffer.alloc(1), persistence: "created", call: EVIDENCE },
      { kind: "reused", artifact: ARTIFACT, bytes: Buffer.alloc(1), adoption: false, call: null },
      { kind: "invalid_input", reason: "path_not_accepted" },
      { kind: "authorization_denied", reason: "not_owner" },
      { kind: "source_unavailable", reason: "absent" },
      { kind: "model_unavailable", reason: "catalog_row_missing" },
      { kind: "pricing_unavailable", reason: "incomplete_coverage", missing: ["image_unit_usd"] },
      { kind: "existing_artifact_conflict", reason: "row_object_missing", artifact: ARTIFACT },
      { kind: "provider_failure", failure: { class: "transient", reason: "rate_limit", sendEvidence: "not_sent" }, call: EVIDENCE },
      { kind: "definitive_failure", reason: "quota", call: EVIDENCE },
      { kind: "unknown_result", reason: "timeout", failure: FAILURE, call: EVIDENCE },
      { kind: "invalid_output", reason: "dimensions_mismatch", returnedSize: "1024x1024", call: EVIDENCE },
      { kind: "export_failed", reason: "source_dimension_mismatch", call: EVIDENCE },
      { kind: "conflict", reason: "content_conflict", detail: "checksum", existing: null, call: EVIDENCE },
      { kind: "persistence_failed", reason: "persistence_failure", detail: "boom", call: EVIDENCE },
      { kind: "readback_failed", reason: "absent", call: EVIDENCE },
      { kind: "blocked", reason: "pre_call_probe_indeterminate", call: null },
    ];

    expect(results.map(describeResult)).toHaveLength(17);
    expect(new Set(results.map((result) => result.kind)).size).toBe(17);
  });

  it("provider_failure nunca carrega a classe desconhecida; unknown_result só a desconhecida", () => {
    type ProviderFailureVariant = Extract<ExpandVerticalResult, { kind: "provider_failure" }>;
    type UnknownVariant = Extract<ExpandVerticalResult, { kind: "unknown_result" }>;

    expectTypeOf<ProviderFailureVariant["failure"]["class"]>().toEqualTypeOf<
      "transient" | "definitive"
    >();
    expectTypeOf<UnknownVariant["failure"]["class"]>().toEqualTypeOf<"unknown">();
  });

  it("reused antes da chamada aceita call null; expanded exige persistência created", () => {
    type ReusedVariant = Extract<ExpandVerticalResult, { kind: "reused" }>;
    type ExpandedVariant = Extract<ExpandVerticalResult, { kind: "expanded" }>;

    expectTypeOf<ReusedVariant["call"]>().toEqualTypeOf<ExpansionCallEvidence | null>();
    expectTypeOf<ExpandedVariant["persistence"]>().toEqualTypeOf<"created">();
    expectTypeOf<Extract<ExpandVerticalResult, { kind: "blocked" }>["call"]>().toEqualTypeOf<null>();
  });
});

describe("F60.3 contract — reuso de tipos existentes", () => {
  it("ExpansionCallEvidence consome AuthorizationContext/ProviderFailure/CostResolution/ArtifactRecord importados", () => {
    // Atribuições bidirecionais provam que os tipos usados são os importados,
    // não redeclarações locais do contrato do módulo.
    const authorization: AuthorizationContext = AUTHORIZATION;
    const providerFailure: ProviderFailure = FAILURE;
    const cost: CostResolution = EVIDENCE.cost;
    const usage: TokenUsage | undefined = EVIDENCE.usage;
    const role: ArtifactRecord["role"] = ARTIFACT.role;

    expect(cost.costSource).toBe("not_available");
    expect(providerFailure.class).toBe("unknown");
    expect(authorization.kind).toBe("system");
    expect(usage?.totalTokens).toBe(30);
    expect(role).toBe("vertical");
    expect(EVIDENCE.cost.costSource).toBe("not_available");
    expect(ARTIFACT.origin).toBe("ai_expansion");
  });

  it("não redeclara os contratos da F60/F60.1 (apenas importa por tipo)", () => {
    const source = readFileSync(sourcePath("../types.ts"), "utf8");

    expect(source).not.toMatch(/interface\s+ArtifactRecord\b/);
    expect(source).not.toMatch(/type\s+ProviderFailure\b/);
    expect(source).not.toMatch(/type\s+CostResolution\b/);
    expect(source).not.toMatch(/type\s+AuthorizationContext\b/);
    expect(source).not.toMatch(/type\s+TokenUsage\b/);
  });

  it("é módulo puro: sem server-only, sharp, Supabase ou node:crypto/node:fs", () => {
    const source = readFileSync(sourcePath("../types.ts"), "utf8");

    expect(source).not.toMatch(/import\s+"server-only"/);
    expect(source).not.toMatch(/\bsharp\b/);
    expect(source).not.toMatch(/@supabase\//);
    expect(source).not.toMatch(/node:crypto/);
    expect(source).not.toMatch(/node:fs/);
  });
});
