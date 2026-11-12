// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const deadlineCapture = vi.hoisted(() => ({
  imageTimeouts: [] as (number | undefined)[],
}));

// Intercepta SOMENTE o terminal de transporte para observar o orçamento que o
// orquestrador entrega à imagem. O restante do módulo permanece real.
vi.mock("../transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../transport")>();
  return {
    ...actual,
    invokeSquareBaseOnce: vi.fn(async (input: { timeoutMs?: number }) => {
      deadlineCapture.imageTimeouts.push(input.timeoutMs);
      return {
        result: {
          imageBase64: "UE5H",
          mimeType: "image/png",
          model: "gpt-image-2.5-sunburst",
          usage: {
            inputTextTokens: 1,
            inputImageTokens: 2,
            outputTextTokens: 0,
            outputImageTokens: 3,
            cachedInputTextTokens: 0,
            cachedInputImageTokens: 0,
          },
        },
        prepared: null,
        sendEvidence: "confirmed_sent",
      };
    }),
  };
});

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";
import type { ImageGenerationConfigSnapshot } from "@/lib/ai/image-generation-config-snapshot";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import {
  frozenFingerprint,
  hashImageDataUrl,
  serializeFrozenPayload,
} from "../frozen-state";
import { runSquareBase, type SquareBaseDeps } from "../run-square-base";
import type { SquareBaseImageGateway } from "../transport";
import type {
  CopyOutcome,
  FrozenContentPayload,
  FrozenEvidenceRecord,
  FrozenSnapshotRecord,
  FrozenStateReadResult,
  SquareBaseInput,
} from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SNAPSHOT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const CALL_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_ID = "user-owner-1";
const BUDGET_MS = 180_000;

const PRODUCT_URL = "data:image/png;base64,AAAA";
const IDENTITY_URL = "data:image/png;base64,CCCC";

const BRIEFING = {
  backgroundDirection: "studio",
  product: { name: "Cafeteira Italiana", description: "Aço inox" },
  commercial: {
    intent: "offer",
    originalPriceText: "R$ 299,00",
    discountedPriceText: "R$ 199,00",
    badge: "Oferta",
    validity: "até domingo",
  },
  constraints: { mandatoryArtworkText: "Frete grátis" },
} as const;

const COPY_CONTEXT = {
  storeName: "Loja Central",
  segment: "Casa",
  badgeText: "Oferta",
  originalPriceCents: 29900,
  discountedPriceCents: 19900,
};

const IDENTITY_DIRECTIVE = "Aplique o logo no canto superior direito.";

const REFERENCE_SELECTIONS = [
  { kind: "product" as const, id: hashImageDataUrl(PRODUCT_URL), index: 0 },
  { kind: "identity" as const, id: hashImageDataUrl(IDENTITY_URL), index: 1 },
];

const FROZEN_PAYLOAD: FrozenContentPayload = {
  briefing: BRIEFING,
  copyContext: COPY_CONTEXT,
  identityDirective: IDENTITY_DIRECTIVE,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  referenceSelections: REFERENCE_SELECTIONS,
  promptBaseVersion: "48.2.6-produto-1-1-v1",
  composerVersion: "48.2.4-prompt-composer-v7",
  policyVersions: { fundo: "48.2.6-background-direction-v2" },
};

const FROZEN_SNAPSHOT: ImageGenerationConfigSnapshot = {
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
  origin: "human_decision",
  createdAt: "2026-11-12T00:00:00.000Z",
};

const FROZEN_RECORD: FrozenSnapshotRecord = {
  id: SNAPSHOT_ID,
  campaignId: CAMPAIGN_ID,
  primaryModel: FROZEN_SNAPSHOT.primaryModel,
  primaryQuality: FROZEN_SNAPSHOT.primaryQuality,
  fallbackModel: FROZEN_SNAPSHOT.fallbackModel,
  fallbackQuality: FROZEN_SNAPSHOT.fallbackQuality,
  configVersionId: FROZEN_SNAPSHOT.configVersionId,
  origin: FROZEN_SNAPSHOT.origin,
  runId: null,
  traceId: null,
  createdAt: FROZEN_SNAPSHOT.createdAt,
};

const PAIR: ImageModelPairConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
};

const COMPOSITION = {
  text: "prompt composto",
  blocks: {},
  composerVersion: FROZEN_PAYLOAD.composerVersion,
  promptBaseVersion: FROZEN_PAYLOAD.promptBaseVersion,
  policyVersions: FROZEN_PAYLOAD.policyVersions,
};

const ARTIFACT: ArtifactRecord = {
  id: "88888888-8888-4888-8888-888888888888",
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  operationId: OPERATION_ID,
  role: "square_original",
  format: "1:1",
  origin: "provider_generation",
  derivedFromArtifactId: null,
  sourceCampaignId: null,
  storageBucket: "campaign-internal-artifacts",
  storagePath: `campaigns/${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  byteSize: 1234,
  checksumSha256: "a".repeat(64),
  provenance: {},
  createdAt: "2026-11-12T00:00:00.000Z",
};

const COST = { estimatedCostUsd: 0.04, costSource: "pricing_table" as const };

function validInput(overrides: Partial<SquareBaseInput> = {}): SquareBaseInput {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    authorization: { kind: "system" },
    briefing: BRIEFING,
    briefingText: "Cafeteira por R$ 199",
    campaignIntent: "offer",
    backgroundDirection: "studio",
    productImagesDataUrls: [PRODUCT_URL],
    identityImageUrl: IDENTITY_URL,
    identityDirective: IDENTITY_DIRECTIVE,
    copyContext: COPY_CONTEXT,
    attempt: { number: 1, target: "primary", reference: "attempt-ref-1" },
    timeoutMs: BUDGET_MS,
    ...overrides,
  };
}

function accessClient(): SupabaseClient {
  return {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle() {
          if (table === "campaigns") {
            return { data: { store_id: STORE_ID }, error: null };
          }
          if (table === "stores") {
            return { data: { user_id: OWNER_ID }, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

function completeState(): Extract<FrozenStateReadResult, { kind: "complete" }> {
  const evidence: FrozenEvidenceRecord = {
    id: "evidence-1",
    snapshotOriginalId: SNAPSHOT_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    campaignIntent: "offer",
    backgroundDirection: "studio",
    briefing: serializeFrozenPayload(FROZEN_PAYLOAD),
    referenceSelections: FROZEN_PAYLOAD.referenceSelections,
    baseVersion: FROZEN_PAYLOAD.promptBaseVersion,
    composerVersion: FROZEN_PAYLOAD.composerVersion,
    policyVersions: FROZEN_PAYLOAD.policyVersions,
  };
  return {
    kind: "complete",
    snapshot: FROZEN_RECORD,
    evidence,
    fingerprint: frozenFingerprint(
      FROZEN_PAYLOAD,
      serializeFrozenPayload(FROZEN_PAYLOAD),
    ),
    payload: FROZEN_PAYLOAD,
    snapshotOriginalId: SNAPSHOT_ID,
  };
}

function repairableState(): Extract<FrozenStateReadResult, { kind: "repairable" }> {
  return {
    kind: "repairable",
    snapshot: FROZEN_RECORD,
    operationId: OPERATION_ID,
    fingerprint: frozenFingerprint(
      FROZEN_PAYLOAD,
      serializeFrozenPayload(FROZEN_PAYLOAD),
    ),
    snapshotOriginalId: SNAPSHOT_ID,
  };
}

interface DeadlineCapture {
  readonly first: number[];
  readonly resume: number[];
  readonly repair: number[];
}

interface HarnessOptions {
  readonly frozen?: FrozenStateReadResult;
  readonly consumeInRead?: number;
  readonly consumeBeforeImage?: number;
  readonly consumeInRepair?: number;
  readonly consumeInCopy?: number;
  readonly copy?: CopyOutcome;
}

function harness(options: HarnessOptions = {}) {
  let now = 0;
  const clock = (): number => now;
  const configDeadlines: DeadlineCapture = { first: [], resume: [], repair: [] };

  const readFrozenState = vi.fn(async () => {
    if (options.consumeInRead !== undefined) now += options.consumeInRead;
    return options.frozen ?? { kind: "absent" as const };
  });
  const probe = vi.fn(async () => ({ kind: "proceed" }));
  const runCopy = vi.fn(async () => {
    if (options.consumeInCopy !== undefined) now += options.consumeInCopy;
    return options.copy ?? ({ kind: "not_requested" as const } satisfies CopyOutcome);
  });
  const persistArtifact = vi.fn(
    async (input: { snapshotOriginalId: string }) => ({
      kind: "created" as const,
      artifact: ARTIFACT,
      snapshotOriginalId: input.snapshotOriginalId,
    }),
  );
  const convertImage = vi.fn(async () => ({
    ok: true as const,
    bytes: Buffer.from("jpeg-1024"),
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
  }));
  const resolveFirstComposition = vi.fn(
    async (_input: SquareBaseInput, config: { deadlineMs?: number }) => {
      configDeadlines.first.push(config.deadlineMs ?? Number.NaN);
      if (options.consumeBeforeImage !== undefined) {
        now += options.consumeBeforeImage;
      }
      return {
        ok: true as const,
        snapshot: FROZEN_SNAPSHOT,
        evidence: {
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          campaignIntent: "offer",
          backgroundDirection: "studio",
          briefing: serializeFrozenPayload(FROZEN_PAYLOAD),
          referenceSelections: FROZEN_PAYLOAD.referenceSelections,
          baseVersion: FROZEN_PAYLOAD.promptBaseVersion,
          composerVersion: FROZEN_PAYLOAD.composerVersion,
          policyVersions: FROZEN_PAYLOAD.policyVersions,
        },
        snapshotOriginalId: SNAPSHOT_ID,
        frozenPayload: FROZEN_PAYLOAD,
        composition: COMPOSITION,
      };
    },
  );
  const resolveResumeConfig = vi.fn(
    async (_input: unknown, config: { deadlineMs?: number }) => {
      configDeadlines.resume.push(config.deadlineMs ?? Number.NaN);
      return { ok: true as const, snapshot: FROZEN_RECORD, pair: PAIR };
    },
  );
  const repairEvidence = vi.fn(
    async (_input: unknown, config: { deadlineMs?: number }) => {
      configDeadlines.repair.push(config.deadlineMs ?? Number.NaN);
      if (options.consumeInRepair !== undefined) now += options.consumeInRepair;
      return { ok: true as const, snapshotOriginalId: SNAPSHOT_ID, reused: false };
    },
  );

  const gateway = {
    prepare: vi.fn(async (_capability: unknown, target: "primary" | "fallback") => ({
      capability: "campaign_product_image" as const,
      target,
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      protocol: "images" as const,
      resolved: {
        provider: "openai",
        model: "gpt-image-2.5-sunburst",
        protocol: "images" as const,
      },
    })),
    invokePrepared: vi.fn(),
  } as unknown as SquareBaseImageGateway;

  const deps: SquareBaseDeps = {
    client: accessClient(),
    clock,
    callIdFactory: () => CALL_ID,
    readFrozenState: readFrozenState as never,
    probe: probe as never,
    runCopy: runCopy as never,
    persistArtifact: persistArtifact as never,
    convertImage: convertImage as never,
    resolveFirstComposition: resolveFirstComposition as never,
    resolveResumeConfig: resolveResumeConfig as never,
    repairEvidence: repairEvidence as never,
    composePrompt: (() => COMPOSITION) as never,
    imageGateway: gateway,
    createTelemetry: (() => ({
      context: {
        operationRunId: OPERATION_ID,
        operationRunType: "campaign_delivery",
        traceId: CALL_ID,
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        attemptNumber: 1,
        sink: { emit: vi.fn() },
      },
      bufferedEnvelopes: () => 0,
      finalize: () => {},
      resolvedCost: () => COST,
      flush: async () => {},
    })) as never,
  };

  return { deps, configDeadlines };
}

beforeEach(() => {
  deadlineCapture.imageTimeouts.length = 0;
  vi.clearAllMocks();
});

describe("F60.4 deadline único — orçamento restante, nunca renovado", () => {
  it("primeira composição: configuração recebe o orçamento restante e a imagem não renova o prazo", async () => {
    const h = harness({ consumeBeforeImage: 40_000 });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    // Configuração chamada na entrada: orçamento integral ainda disponível.
    expect(h.configDeadlines.first).toEqual([180_000]);
    // 40 s consumidos antes da imagem: ela recebe 140 s, nunca 180 s de novo.
    expect(deadlineCapture.imageTimeouts).toEqual([140_000]);
  });

  it("retomada: configuração de resume recebe o restante do orçamento", async () => {
    const h = harness({ frozen: completeState(), consumeInRead: 50_000 });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    expect(h.configDeadlines.resume).toEqual([130_000]);
    expect(deadlineCapture.imageTimeouts).toEqual([130_000]);
  });

  it("reparo: a evidência recebe o restante no momento do reparo (sem relógio novo)", async () => {
    const h = harness({
      frozen: repairableState(),
      consumeInRead: 20_000,
      consumeInRepair: 30_000,
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("completed");
    expect(h.configDeadlines.resume).toEqual([160_000]);
    expect(h.configDeadlines.repair).toEqual([160_000]);
    expect(deadlineCapture.imageTimeouts).toEqual([130_000]);
  });

  it("orçamento esgotado após a copy recusa a imagem (nenhum novo efeito)", async () => {
    const h = harness({
      consumeInCopy: BUDGET_MS,
      copy: { kind: "not_requested" },
    });

    const result = await runSquareBase(validInput(), h.deps);

    expect(result.kind).toBe("blocked");
    if (result.kind !== "blocked") return;
    expect(result.reason).toBe("persistence_reserve_reached");
    expect(result.call).toBeNull();
    expect(result.copy).toEqual({ kind: "not_requested" });
    expect(deadlineCapture.imageTimeouts).toEqual([]);
  });
});
