// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const captured = vi.hoisted(() => ({ events: [] as Record<string, unknown>[] }));

vi.mock("@/lib/ai-cost/tracker", () => ({
  AiCostTracker: class {
    async record(event: unknown): Promise<void> {
      captured.events.push(event as Record<string, unknown>);
    }
  },
}));

import type { AiModelCatalogRow } from "@/lib/ai/ai-model-catalog-service";
import type { ModelPricing } from "@/lib/ai-cost/ai-model-pricing";
import {
  AiInvocationError,
  type AiInvocationRequest,
  type AiInvocationResult,
  type AiTelemetryContext,
} from "@/lib/ai/types";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import type {
  ArtifactIdentity,
  ArtifactRecord,
} from "@/lib/campaign/composition-artifacts/types";
import {
  DEFAULT_BUCKET,
  createFakeArtifactBackend,
  type FakeArtifactBackend,
} from "@/lib/campaign/__tests__/support/fake-artifact-backend";
import {
  buildJpeg,
  buildPng,
  buildVertical1080x1920Fixture,
} from "@/lib/campaign/__tests__/support/jpeg-fixtures";

import { expandVerticalToNineSixteen, type ExpandVerticalDeps } from "../expand";
import type { ExpansionInvoker } from "../transport";
import type { ExpandVerticalInput, ExpandVerticalResult } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const VERTICAL_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";
const OWNER_USER_ID = "user-owner";
const MODEL = "gpt-image-2.5-sunburst";
const CALL_ID = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";

const FULL_USAGE = {
  inputTextTokens: 10,
  inputImageTokens: 20,
  outputTextTokens: 0,
  outputImageTokens: 30,
  cachedInputTextTokens: 0,
  cachedInputImageTokens: 0,
};

const COMPLETE_PRICING: ModelPricing = {
  inputCostUsd: 1,
  cachedInputCostUsd: 0.5,
  outputCostUsd: 2,
  imageInputTokenUsdPer1M: 10,
  imageCachedInputTokenUsdPer1M: 5,
  imageTokenUsdPer1M: 40,
  imageUnitCostUsd: 0.04,
};

let sourceImage: Buffer;
let providerPng: Buffer;
let deliveredBytes: Buffer;

beforeAll(async () => {
  sourceImage = await buildJpeg(1152, 1152);
  providerPng = await buildPng(1152, 2048);
  deliveredBytes = await buildVertical1080x1920Fixture();
});

beforeEach(() => {
  captured.events.length = 0;
});

function sourceIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
  };
}

function destinationIdentity(): ArtifactIdentity {
  return {
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: DEST_OPERATION_ID,
    role: "vertical",
  };
}

function destinationPath(): string {
  return compositionArtifactStoragePath(destinationIdentity());
}

function sourceRecord(): ArtifactRecord {
  return {
    id: SOURCE_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: SOURCE_OPERATION_ID,
    role: "square_prepared",
    format: "1:1",
    origin: "deterministic_preparation",
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: compositionArtifactStoragePath(sourceIdentity()),
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: sourceImage.byteLength,
    checksumSha256: computeChecksumSha256(sourceImage),
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
  };
}

function derivedProvenance(
  source: ArtifactRecord = sourceRecord(),
): Record<string, unknown> {
  return {
    sourceOrigin: "composition_artifact",
    sourceStoragePath: source.storagePath,
    sourceWidth: source.width,
    sourceHeight: source.height,
    sourceMimeType: source.mimeType,
    sourceChecksumSha256: source.checksumSha256,
    derivedFromArtifactId: source.id,
  };
}

function verticalRecord(
  bytes: Buffer = deliveredBytes,
  overrides: Partial<ArtifactRecord> = {},
): ArtifactRecord {
  return {
    id: VERTICAL_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: DEST_OPERATION_ID,
    role: "vertical",
    format: "9:16",
    origin: "ai_expansion",
    derivedFromArtifactId: SOURCE_ARTIFACT_ID,
    sourceCampaignId: null,
    storageBucket: DEFAULT_BUCKET,
    storagePath: destinationPath(),
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    byteSize: bytes.byteLength,
    checksumSha256: computeChecksumSha256(bytes),
    provenance: derivedProvenance(),
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

function rowOf(record: ArtifactRecord): Record<string, unknown> {
  return {
    id: record.id,
    store_id: record.storeId,
    campaign_id: record.campaignId,
    operation_id: record.operationId,
    role: record.role,
    format: record.format,
    origin: record.origin,
    derived_from_artifact_id: record.derivedFromArtifactId,
    source_campaign_id: record.sourceCampaignId,
    storage_bucket: record.storageBucket,
    storage_path: record.storagePath,
    width: record.width,
    height: record.height,
    mime_type: record.mimeType,
    byte_size: record.byteSize,
    checksum_sha256: record.checksumSha256,
    provenance: record.provenance,
    created_at: record.createdAt,
  };
}

function evidenceMetadataFor(record: ArtifactRecord): Record<string, unknown> {
  const built = buildObjectEvidence({
    storeId: record.storeId,
    campaignId: record.campaignId,
    operationId: record.operationId,
    role: record.role,
    origin: record.origin,
    sourceKind: "internal_artifact",
    sourceArtifactId: SOURCE_ARTIFACT_ID,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: sourceRecord().checksumSha256,
    width: record.width,
    height: record.height,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    checksumSha256: record.checksumSha256,
    provenance: record.provenance,
  });
  if (!built.ok) throw new Error("fixture evidence invalid");
  return buildEvidenceMetadata(built.evidence);
}

function createBackend(): FakeArtifactBackend {
  const backend = createFakeArtifactBackend();
  backend.seedStore(STORE_ID, OWNER_USER_ID);
  backend.seedCampaign(CAMPAIGN_ID, STORE_ID);
  return backend;
}

function seedSource(backend: FakeArtifactBackend): ArtifactRecord {
  const record = sourceRecord();
  backend.putObject(record.storagePath, sourceImage);
  backend.seedArtifactRow(rowOf(record));
  return record;
}

function seedVertical(backend: FakeArtifactBackend): ArtifactRecord {
  const record = verticalRecord();
  backend.seedArtifactRow(rowOf(record));
  backend.putObject(record.storagePath, deliveredBytes, evidenceMetadataFor(record));
  return record;
}

function expandInput(): ExpandVerticalInput {
  return {
    source: {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: SOURCE_OPERATION_ID,
      role: "square_prepared",
    },
    operationId: DEST_OPERATION_ID,
    attempt: { number: 1, reference: "attempt-1" },
    authorization: { kind: "system" },
  };
}

function catalogRow(): AiModelCatalogRow {
  return {
    id: "catalog-row-1",
    capability: "campaign_product_image",
    segment: "image",
    provider: "openai",
    model: MODEL,
    protocol: "images",
    label: null,
    status: "active",
    source_note: null,
    validated_at: null,
    created_at: "2026-11-11T00:00:00.000Z",
    updated_at: "2026-11-11T00:00:00.000Z",
  };
}

function pngResult(): AiInvocationResult {
  return {
    imageBase64: providerPng.toString("base64"),
    mimeType: "image/png",
    model: MODEL,
    usage: FULL_USAGE,
  };
}

interface InvokerHandle {
  readonly invoker: ExpansionInvoker;
  calls: number;
}

function fakeInvoker(
  behavior: () => Promise<AiInvocationResult> = async () => pngResult(),
): InvokerHandle {
  const handle: InvokerHandle = {
    calls: 0,
    invoker: {
      invokePrepared: async (
        prepared,
        request: AiInvocationRequest,
        telemetry: AiTelemetryContext,
      ): Promise<AiInvocationResult> => {
        handle.calls += 1;
        try {
          const result = await behavior();
          await telemetry.sink.emit({
            capability: "campaign_product_image",
            protocol: "images",
            status: "success",
            provider: "openai",
            model: result.model,
            durationMs: 5,
            quality: request.quality,
            attemptNumber: telemetry.attemptNumber,
            usage: result.usage,
          });
          return result;
        } catch (error) {
          await telemetry.sink.emit({
            capability: "campaign_product_image",
            protocol: "images",
            status: "failed",
            provider: "openai",
            model: prepared.model,
            durationMs: 5,
            errorType: error instanceof AiInvocationError ? error.kind : "unknown",
            quality: request.quality,
            attemptNumber: telemetry.attemptNumber,
          });
          throw error;
        }
      },
    },
  };
  return handle;
}

function baseDeps(
  backend: FakeArtifactBackend,
  invoker: ExpansionInvoker,
  overrides: Partial<ExpandVerticalDeps> = {},
): ExpandVerticalDeps {
  return {
    client: backend.client,
    clock: () => 1000,
    callIdFactory: () => CALL_ID,
    invoker,
    catalog: { getActiveCatalogRows: async () => [catalogRow()] },
    pricing: {
      getModelPricing: async () => ({
        pricing: COMPLETE_PRICING,
        versionId: "pricing-version-1",
      }),
    },
    ...overrides,
  };
}

interface Scenario {
  readonly label: string;
  readonly result: ExpandVerticalResult;
  readonly backend: FakeArtifactBackend;
}

describe("expandVerticalToNineSixteen — fronteiras proibidas", () => {
  async function runScenarios(): Promise<readonly Scenario[]> {
    const scenarios: Scenario[] = [];

    // 1) sucesso (expanded).
    {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );
      scenarios.push({ label: "expanded", result, backend });
    }

    // 2) falha de provider.
    {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker(async () => {
        throw new AiInvocationError({
          kind: "rate_limit",
          retryable: true,
          message: "rate limited",
        });
      });
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );
      scenarios.push({ label: "provider_failure", result, backend });
    }

    // 3) falha de exportação.
    {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          exportJpeg: async () => ({ ok: false, reason: "source_decode_failed" }),
        }),
      );
      scenarios.push({ label: "export_failed", result, backend });
    }

    // 4) conflito de persistência.
    {
      const backend = createBackend();
      seedSource(backend);
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker, {
          persist: async () => ({
            kind: "content_conflict",
            existing: null,
            reason: "checksum_mismatch",
          }),
        }),
      );
      scenarios.push({ label: "conflict", result, backend });
    }

    // 5) conflito pré-chamada (vertical incompatível).
    {
      const backend = createBackend();
      seedSource(backend);
      const artifact = verticalRecord(deliveredBytes, {
        provenance: {},
      });
      backend.seedArtifactRow(rowOf(artifact));
      backend.putObject(artifact.storagePath, deliveredBytes);
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );
      scenarios.push({ label: "existing_artifact_conflict", result, backend });
    }

    // 6) adoção de órfão.
    {
      const backend = createBackend();
      seedSource(backend);
      const orphan = verticalRecord();
      backend.putObject(
        destinationPath(),
        deliveredBytes,
        evidenceMetadataFor(orphan),
      );
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );
      scenarios.push({ label: "adopted", result, backend });
    }

    // 7) reutilização pré-chamada.
    {
      const backend = createBackend();
      seedSource(backend);
      seedVertical(backend);
      const invoker = fakeInvoker();
      const result = await expandVerticalToNineSixteen(
        expandInput(),
        baseDeps(backend, invoker.invoker),
      );
      scenarios.push({ label: "reused", result, backend });
    }

    return scenarios;
  }

  it("não chama RPC/crédito, não assina URL, não remove nem atualiza nada", async () => {
    const scenarios = await runScenarios();

    for (const scenario of scenarios) {
      expect(scenario.backend.handles.rpcCalls, scenario.label).toBe(0);
      expect(scenario.backend.handles.signed, scenario.label).toBe(0);
      expect(scenario.backend.handles.removes, scenario.label).toBe(0);
      expect(scenario.backend.handles.updates, scenario.label).toBe(0);
      expect(scenario.backend.handles.lists, scenario.label).toBe(0);
    }
  });

  it("nunca insere ou atualiza em campaigns (somente artefatos)", async () => {
    const scenarios = await runScenarios();

    for (const scenario of scenarios) {
      for (const row of scenario.backend.handles.inserts) {
        expect(row, scenario.label).not.toHaveProperty("status");
        expect(row, scenario.label).toHaveProperty("role");
        expect(row, scenario.label).not.toHaveProperty("__table");
      }
      // A linha de campanha só foi semeada; nenhuma escrita partiu do módulo.
      expect(
        scenario.backend.rowsForTable("campaigns"),
        scenario.label,
      ).toHaveLength(1);
    }
  });

  it("nenhum resultado expõe URL, crédito, entrega ou status de campanha", async () => {
    const scenarios = await runScenarios();

    const forbiddenKeys = new Set([
      "url",
      "publicUrl",
      "signedUrl",
      "downloadUrl",
      "delivery",
      "credit",
      "status",
    ]);
    const seenKeys = new Set<string>();
    const strings: string[] = [];

    function walk(value: unknown): void {
      if (typeof value === "string") {
        strings.push(value);
        return;
      }
      if (value === null || typeof value !== "object") return;
      if (Buffer.isBuffer(value)) return;
      if (Array.isArray(value)) {
        for (const entry of value) walk(entry);
        return;
      }
      for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        seenKeys.add(key);
        walk(entry);
      }
    }

    for (const scenario of scenarios) {
      walk(scenario.result);
      expect(
        JSON.stringify(scenario.result, (_key, value) =>
          Buffer.isBuffer(value) ? "[buffer]" : value,
        ),
        scenario.label,
      ).not.toMatch(/https?:/);
    }

    for (const key of forbiddenKeys) {
      expect([...seenKeys], `chave proibida: ${key}`).not.toContain(key);
    }
    for (const value of strings) {
      expect(value).not.toContain("http://");
      expect(value).not.toContain("https://");
      expect(value).not.toContain("signedUrl");
      expect(value).not.toContain("downloadUrl");
      expect(value).not.toContain("credit");
      expect(value).not.toContain("delivery");
    }
  });
});

describe("vertical-expansion — fronteiras de arquitetura", () => {
  function collectProductionFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "__tests__" || entry === "node_modules") continue;
        out.push(...collectProductionFiles(full));
        continue;
      }
      if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) out.push(full);
    }
    return out;
  }

  it("não chama o SDK de imagem, resolveAiCost nem AiCostTracker.record", () => {
    const files = collectProductionFiles(
      path.resolve(process.cwd(), "src/lib/campaign/vertical-expansion"),
    );

    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const code = readFileSync(file, "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1");
      if (/\.images\.edit\s*\(/.test(code)) violations.push(`${file} → images.edit(`);
      if (/resolveAiCost\s*\(/.test(code)) violations.push(`${file} → resolveAiCost(`);
      if (/AiCostTracker\.record\s*\(/.test(code)) {
        violations.push(`${file} → AiCostTracker.record(`);
      }
    }

    expect(violations).toEqual([]);
  });
});
