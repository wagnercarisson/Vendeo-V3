// @vitest-environment node
/**
 * F60.3 / 60.3-04 — Testes NÃO PAGOS do intento durável e da ordem crash-safe.
 *
 * Sem provider, sem `server-only`, sem banco, sem Storage e sem rede: o módulo
 * de produto é substituído por uma costura (`deps.expand`) e o preflight é
 * injetado. O diretório de evidência é um `mkdtempSync`.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createIntentExclusive,
  INTENT_STATUS,
  proofIntentPath,
  readIntent,
  type ProofIntentPayload,
} from "../proof-intent";
import {
  runCheckManifest,
  runProof,
  type HarnessDeps,
  type PreflightResult,
} from "../vertical-expansion-proof";
import type { ExpandVerticalResult } from "../../../src/lib/campaign/vertical-expansion/types";

const STORE_ID = "0189ed0a-83ad-4d52-bcef-2f0db0f9dd0a";
const CAMPAIGN_ID = "ec1bd3fa-36d7-43d3-b7de-9405a83eb74e";
const SOURCE_OPERATION_ID = "1c3299b4-be5b-4e54-93df-3a1a1378257d";
const OPERATION_ID = "4b3d4f49-cd62-4e22-a079-6b056f8ca93b";
const SOURCE_ARTIFACT_ID = "11111111-1111-4111-8111-111111111111";
const DEST_ARTIFACT_ID = "22222222-2222-4222-8222-222222222222";
const AUTHORIZED_TOKEN = "test-token-0001";

let evidenceDir: string;

beforeEach(() => {
  evidenceDir = mkdtempSync(path.join(os.tmpdir(), "f60.3-intent-"));
});

afterEach(() => {
  rmSync(evidenceDir, { recursive: true, force: true });
});

function applyEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    F60_3_HOMOLOG_AUTHORIZED: "1",
    F60_3_MAX_CALLS: "1",
    F60_3_AUTHORIZED_BUDGET_USD: "0.5",
    F60_3_OPERATION_ID: OPERATION_ID,
    F60_3_STORE_ID: STORE_ID,
    F60_3_CAMPAIGN_ID: CAMPAIGN_ID,
    F60_3_SOURCE_OPERATION_ID: SOURCE_OPERATION_ID,
    F60_3_ATTEMPT_REF: "attempt-1",
    ...overrides,
  } as unknown as NodeJS.ProcessEnv;
}

function preflightFixture(overrides: Partial<PreflightResult["summary"]> = {}): PreflightResult {
  return {
    kind: "f60.3-preflight",
    mode: "apply",
    checkedAt: "2026-11-11T12:00:00.000Z",
    ready: true,
    providerCalls: 0,
    credential: "product",
    declaration: "sem chamada paga",
    checks: [],
    summary: {
      sourceStatus: "prepared",
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      protocol: "images",
      quality: "low",
      pricingVersion: "pricing-v1",
      imageUnitUsd: 0.02,
      estimatedPreCallUsd: 0.05,
      estimateSource: "imageUnitUsd x 2.5 (f59-vertical-9-16-v1)",
      pricingMissing: [],
      sourceArtifactId: SOURCE_ARTIFACT_ID,
      sourceChecksumSha256: "a".repeat(64),
      sourceByteSize: 1234,
      destinationStatus: "absent",
      credential: "product",
      campaignsBefore: {
        id: CAMPAIGN_ID,
        status: "ready",
        storagePath: `${STORE_ID}/${CAMPAIGN_ID}/art-1024.jpg`,
      },
      ...overrides,
    },
    environment: {
      targetKind: "homolog-existing",
      dbTarget: "127.0.0.1:57782/postgres",
      apiTarget: "127.0.0.1:57781",
      originsConcordant: true,
      serviceRoleKey: "present",
      anonKey: "present",
      credential: "product",
    },
    evidencePath: null,
  };
}

function intentPayload(): ProofIntentPayload {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    sourceOperationId: SOURCE_OPERATION_ID,
    attemptRef: "attempt-1",
    sourceArtifactId: SOURCE_ARTIFACT_ID,
    sourceChecksumSha256: "a".repeat(64),
    estimatedPreCallUsd: 0.05,
    authorizedBudgetUsd: 0.5,
    pricingVersion: "pricing-v1",
    command: "node --import ./scripts/f60.3/server-only-resolve.mjs --import tsx scripts/f60.3/vertical-expansion-proof.ts --apply --authorized=<token>",
    envIdentifiers: ["F60_3_OPERATION_ID", "F60_3_MAX_CALLS"],
  };
}

function callEvidence(overrides: Record<string, unknown> = {}) {
  return {
    callId: "call-0001",
    operationId: OPERATION_ID,
    attemptNumber: 1,
    attemptReference: "attempt-1",
    provider: "openai",
    model: "gpt-image-2.5-sunburst",
    protocol: "images",
    quality: "low",
    requestedSize: "1152x2048",
    returnedSize: "1152x2048",
    durationMs: 1234,
    callStatus: "success",
    outcome: "expanded",
    cost: { estimatedCostUsd: 0.041, costSource: "pricing_table" },
    ...overrides,
  };
}

function expandedResult(): ExpandVerticalResult {
  const call = callEvidence() as unknown as Extract<
    ExpandVerticalResult,
    { kind: "expanded" }
  >["call"];
  return {
    kind: "expanded",
    artifact: {
      id: DEST_ARTIFACT_ID,
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "vertical",
      format: "9:16",
      origin: "ai_expansion",
      derivedFromArtifactId: SOURCE_ARTIFACT_ID,
      sourceCampaignId: null,
      storageBucket: "campaign-internal-artifacts",
      storagePath: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`,
      width: 1080,
      height: 1920,
      mimeType: "image/jpeg",
      byteSize: 900,
      checksumSha256: "b".repeat(64),
      provenance: {},
      createdAt: "2026-11-11T12:00:01.000Z",
    },
    bytes: Buffer.from([1, 2, 3]),
    persistence: "created",
    call,
  };
}

function failedResult(): ExpandVerticalResult {
  const call = callEvidence({
    callStatus: "success",
    outcome: "invalid_output",
  }) as unknown as Extract<ExpandVerticalResult, { kind: "invalid_output" }>["call"];
  return { kind: "invalid_output", reason: "not_image", returnedSize: null, call };
}

function unknownResult(): ExpandVerticalResult {
  const call = callEvidence({
    callStatus: "timeout",
    outcome: "unknown",
    cost: { estimatedCostUsd: null, costSource: "not_available" },
  }) as unknown as Extract<ExpandVerticalResult, { kind: "unknown_result" }>["call"];
  return {
    kind: "unknown_result",
    reason: "timeout",
    failure: {
      reason: "timeout",
      class: "unknown",
      sendEvidence: "possibly_sent",
    } as unknown as Extract<ExpandVerticalResult, { kind: "unknown_result" }>["failure"],
    call,
  };
}

function harnessDeps(overrides: Partial<HarnessDeps> = {}): HarnessDeps {
  return {
    preflight: async () => preflightFixture(),
    now: () => new Date("2026-11-11T12:00:00.000Z"),
    evidenceDir,
    ...overrides,
  };
}

describe("proof-intent", () => {
  it("cria o intento com status: sending", () => {
    const created = createIntentExclusive(intentPayload(), evidenceDir);
    expect(created.path).toBe(proofIntentPath(OPERATION_ID, evidenceDir));
    expect(created.record.status).toBe(INTENT_STATUS.sending);
    expect(readIntent(OPERATION_ID, evidenceDir)?.status).toBe("sending");
  });

  it("recusa a criação exclusiva existente sem sobrescrever", () => {
    const created = createIntentExclusive(intentPayload(), evidenceDir);
    const before = readFileSync(created.path, "utf8");
    expect(() => createIntentExclusive(intentPayload(), evidenceDir)).toThrow();
    expect(readFileSync(created.path, "utf8")).toBe(before);
  });
});

describe("runProof — intento antes do envio", () => {
  it("grava o intento 'sending' ANTES de invocar o módulo", async () => {
    const observed: string[] = [];
    const expand = vi.fn(async () => {
      const intent = readIntent(OPERATION_ID, evidenceDir);
      observed.push(intent?.status ?? "missing");
      expect(intent?.status).toBe(INTENT_STATUS.sending);
      expect(intent?.operationId).toBe(OPERATION_ID);
      expect(intent?.estimatedPreCallUsd).toBe(0.05);
      return expandedResult();
    });

    const outcome = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));

    expect(observed).toEqual(["sending"]);
    expect(expand).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("completed");
    expect(outcome.providerCalls).toBe(1);
    expect(outcome.exitCode).toBe(0);
  });

  it("intento existente bloqueia o --apply sem chamar o módulo", async () => {
    const created = createIntentExclusive(intentPayload(), evidenceDir);
    const before = readFileSync(created.path);
    const expand = vi.fn(async () => expandedResult());

    const outcome = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));

    expect(outcome.exitCode).not.toBe(0);
    expect(outcome.providerCalls).toBe(0);
    expect(outcome.reason).toBe("intent_pending");
    expect(expand).not.toHaveBeenCalled();
    expect(readFileSync(created.path).equals(before)).toBe(true);
    expect(existsSync(path.join(evidenceDir, "proof-latest.json"))).toBe(false);
  });
});

describe("runProof — crash após envio", () => {
  it("exceção após o envio vira status terminal 'unknown' e nunca retry", async () => {
    const expand = vi.fn(async () => {
      expect(readIntent(OPERATION_ID, evidenceDir)?.status).toBe(INTENT_STATUS.sending);
      throw new Error("simulated_process_death_after_send");
    });

    const outcome = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));

    expect(expand).toHaveBeenCalledTimes(1);
    expect(outcome.status).toBe("unknown");
    expect(outcome.providerCalls).toBe(1);
    expect(outcome.exitCode).not.toBe(0);

    const second = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));
    expect(second.exitCode).not.toBe(0);
    expect(second.providerCalls).toBe(0);
    expect(expand).toHaveBeenCalledTimes(1);
  });

  it("intento 'sending' órfão (processo morreu antes do terminal) recusa e reporta pendente", async () => {
    createIntentExclusive(intentPayload(), evidenceDir);
    const expand = vi.fn(async () => expandedResult());

    const outcome = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));

    expect(outcome.reason).toBe("intent_pending");
    expect(outcome.providerCalls).toBe(0);
    expect(expand).not.toHaveBeenCalled();
    expect(readIntent(OPERATION_ID, evidenceDir)?.status).toBe(INTENT_STATUS.sending);
    expect(existsSync(path.join(evidenceDir, "proof-latest.json"))).toBe(false);

    const check = await runCheckManifest(
      path.join(evidenceDir, "proof-latest.json"),
      applyEnv(),
      { evidenceDir },
    );
    expect(check.status).toBe("pending");
    expect(check.exitCode).not.toBe(0);
  });
});

describe("runProof — manifesto terminal atualiza o intento", () => {
  it("expanded → completed com observedCostUsd e referência ao manifesto", async () => {
    const outcome = await runProof(
      applyEnv(),
      { authorized: AUTHORIZED_TOKEN },
      harnessDeps({ expand: async () => expandedResult() }),
    );

    expect(outcome.status).toBe("completed");
    const intent = readIntent(OPERATION_ID, evidenceDir);
    expect(intent?.status).toBe("completed");
    expect(intent !== null && "terminalManifest" in intent ? intent.terminalManifest : null).toBe(
      outcome.manifestPath,
    );
    expect(intent !== null && "observedCostUsd" in intent ? intent.observedCostUsd : null).toBe(0.041);

    const manifest = JSON.parse(readFileSync(outcome.manifestPath as string, "utf8")) as Record<
      string,
      unknown
    >;
    expect(manifest.status).toBe("completed");
    expect(manifest.providerCalls).toBe(1);
    expect(manifest.returnedSize).toBe("1152x2048");
    expect((manifest.artifact as Record<string, unknown>).role).toBe("vertical");
  });

  it("saída inválida → failed", async () => {
    const outcome = await runProof(
      applyEnv(),
      { authorized: AUTHORIZED_TOKEN },
      harnessDeps({ expand: async () => failedResult() }),
    );

    expect(outcome.status).toBe("failed");
    expect(readIntent(OPERATION_ID, evidenceDir)?.status).toBe("failed");
    expect(outcome.exitCode).not.toBe(0);
  });

  it("resultado desconhecido → unknown (nunca definitivo)", async () => {
    const outcome = await runProof(
      applyEnv(),
      { authorized: AUTHORIZED_TOKEN },
      harnessDeps({ expand: async () => unknownResult() }),
    );

    expect(outcome.status).toBe("unknown");
    expect(readIntent(OPERATION_ID, evidenceDir)?.status).toBe("unknown");
    expect(outcome.observedCostUsd).toBeNull();
  });
});

describe("runProof — nunca segunda chamada paga", () => {
  it("após status terminal, novo --apply recusa e o módulo continua com 1 invocação", async () => {
    const expand = vi.fn(async () => expandedResult());

    const first = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));
    expect(first.status).toBe("completed");
    expect(first.providerCalls).toBe(1);
    expect(existsSync(path.join(evidenceDir, "proof-latest.json"))).toBe(true);

    const second = await runProof(applyEnv(), { authorized: AUTHORIZED_TOKEN }, harnessDeps({ expand }));

    expect(second.exitCode).not.toBe(0);
    expect(second.providerCalls).toBe(0);
    expect(second.reason).toBe("intent_terminal_exists");
    expect(expand).toHaveBeenCalledTimes(1);
  });

  it("--apply sem autorização/orçamento não cria intento nem chama o módulo", async () => {
    const expand = vi.fn(async () => expandedResult());

    const noToken = await runProof(applyEnv(), { authorized: "" }, harnessDeps({ expand }));
    expect(noToken.reason).toBe("authorization_token_missing");
    expect(noToken.providerCalls).toBe(0);

    const lowBudget = await runProof(
      applyEnv({ F60_3_AUTHORIZED_BUDGET_USD: "0.01" }),
      { authorized: AUTHORIZED_TOKEN },
      harnessDeps({ expand }),
    );
    expect(lowBudget.reason).toBe("authorized_budget_below_estimate");
    expect(lowBudget.providerCalls).toBe(0);

    const notReady = await runProof(
      applyEnv(),
      { authorized: AUTHORIZED_TOKEN },
      harnessDeps({ preflight: async () => ({ ...preflightFixture(), ready: false }) }),
    );
    expect(notReady.reason).toBe("preflight_not_ready");
    expect(notReady.providerCalls).toBe(0);

    expect(expand).not.toHaveBeenCalled();
    expect(existsSync(path.join(evidenceDir, "proof-latest.json"))).toBe(false);
  });
});
