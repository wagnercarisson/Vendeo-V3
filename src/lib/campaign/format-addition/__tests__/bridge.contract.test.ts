// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import type {
  ArtifactRecord,
  AuthorizationContext,
  PersistArtifactInput,
  PersistArtifactResult,
  ReusableSquareSource,
  ResolveSquareSourceResult,
  RetrieveArtifactResult,
} from "@/lib/campaign/composition-artifacts/types";

import {
  deriveLegacyRegistrationOperationId,
  ensureFormatAdditionSourceBridge,
  type PrimaryOperationRead,
  type SourceBridgeDeps,
} from "../source-registration";

const STORE = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const PRIMARY = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const ADDITION = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const OTHER_CAMPAIGN = "8b9c0d1e-8b9c-4d1e-8f0a-8b9c0d1e2f3a";

const BYTES = Buffer.from("f62-bridge-bytes");
const CHECKSUM = computeChecksumSha256(BYTES);
const SYSTEM: AuthorizationContext = { kind: "system" };

function sourceFor(
  origin: "new_flow_1_1" | "legacy_campaign",
  overrides: Partial<ReusableSquareSource> = {},
): ReusableSquareSource {
  return {
    origin,
    storeId: STORE,
    campaignId: CAMPAIGN,
    ...(origin === "new_flow_1_1" ? { operationId: PRIMARY } : {}),
    bucket: "campaign-images",
    storagePath:
      origin === "legacy_campaign"
        ? `${STORE}/${CAMPAIGN}.jpg`
        : `${STORE}/${CAMPAIGN}/product-1-1/${PRIMARY}/art-1024.jpg`,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: BYTES.byteLength,
    checksumSha256: CHECKSUM,
    ...overrides,
  };
}

function artifactFor(
  source: ReusableSquareSource,
  registration: string,
  overrides: Partial<ArtifactRecord> = {},
): ArtifactRecord {
  return {
    id: "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d",
    storeId: STORE.toLowerCase(),
    campaignId: CAMPAIGN.toLowerCase(),
    operationId: registration.toLowerCase(),
    role: "square_original",
    format: "1:1",
    origin: "delivered_campaign_reuse",
    derivedFromArtifactId: null,
    sourceCampaignId: CAMPAIGN.toLowerCase(),
    storageBucket: "campaign-internal-artifacts",
    storagePath: `${STORE}/${CAMPAIGN}/${registration}/square_original.jpg`,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: BYTES.byteLength,
    checksumSha256: CHECKSUM,
    provenance: {
      sourceOrigin: source.origin,
      sourceStoragePath: source.storagePath,
      sourceWidth: source.width,
      sourceHeight: source.height,
      sourceMimeType: source.mimeType,
      sourceChecksumSha256: source.checksumSha256,
    },
    createdAt: "2026-11-23T00:00:00.000Z",
    ...overrides,
  };
}

type Captured = {
  persist: PersistArtifactInput[];
  downloads: { path: string; bucket?: string }[];
  primaryReads: number;
};

function depsFor(options: {
  source: ReusableSquareSource;
  registration?: string;
  bytes?: Buffer;
  primary?: PrimaryOperationRead;
  persistResult?: PersistArtifactResult;
  retrieveFactory?: (registration: string) => RetrieveArtifactResult;
  resolveResult?: ResolveSquareSourceResult;
}): { deps: SourceBridgeDeps; captured: Captured } {
  const captured: Captured = { persist: [], downloads: [], primaryReads: 0 };
  const registration = options.registration ?? PRIMARY;
  const bytes = options.bytes ?? BYTES;

  const deps: SourceBridgeDeps = {
    resolveSource: async () =>
      options.resolveResult ?? { kind: "reusable" as const, source: options.source },
    storage: {
      downloadBytes: async (path, bucket) => {
        captured.downloads.push({ path, bucket });
        return { kind: "bytes", bytes };
      },
    },
    persist: async (input) => {
      captured.persist.push(input);
      return options.persistResult ?? { kind: "created" };
    },
    retrieve: async () => {
      if (options.retrieveFactory) return options.retrieveFactory(registration);
      return {
        kind: "integral",
        artifact: artifactFor(options.source, registration),
        bytes,
      };
    },
    readPrimaryOperation: async () => {
      captured.primaryReads += 1;
      return options.primary ?? { kind: "found", operationId: PRIMARY, status: "delivered" };
    },
  };

  return { deps, captured };
}

describe("F62-03 — ponte de proveniência", () => {
  it("fluxo novo usa a operação primária entregue como identidade", async () => {
    const source = sourceFor("new_flow_1_1");
    const { deps, captured } = depsFor({ source });

    const result = await ensureFormatAdditionSourceBridge(
      { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "new_flow_1_1", authorization: SYSTEM },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceRegistrationOperationId).toBe(PRIMARY);
    expect(result.persistence).toBe("created");
    expect(captured.primaryReads).toBe(1);
    expect(captured.downloads).toEqual([
      { path: source.storagePath, bucket: "campaign-images" },
    ]);
    expect(captured.persist).toHaveLength(1);
    expect(captured.persist[0]).toMatchObject({
      identity: {
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: PRIMARY,
        role: "square_original",
      },
      origin: "delivered_campaign_reuse",
      acceptLegacy1024: true,
      source: { kind: "delivered_campaign_source" },
    });
  });

  it("legado usa identidade sintética determinística e não lê operação primária", async () => {
    const source = sourceFor("legacy_campaign");
    const { deps, captured } = depsFor({
      source,
      registration: deriveLegacyRegistrationOperationId(STORE, CAMPAIGN),
    });

    const result = await ensureFormatAdditionSourceBridge(
      { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
      deps,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sourceRegistrationOperationId).toBe(
      deriveLegacyRegistrationOperationId(STORE, CAMPAIGN),
    );
    expect(captured.primaryReads).toBe(0);
    expect(captured.persist[0]).toMatchObject({
      identity: {
        operationId: deriveLegacyRegistrationOperationId(STORE, CAMPAIGN),
        role: "square_original",
      },
      origin: "delivered_campaign_reuse",
      acceptLegacy1024: true,
    });
  });

  it("identidade sintética é estável, UUID válido e distinta por campanha", () => {
    const one = deriveLegacyRegistrationOperationId(STORE, CAMPAIGN);
    const again = deriveLegacyRegistrationOperationId(STORE, CAMPAIGN);
    const other = deriveLegacyRegistrationOperationId(STORE, OTHER_CAMPAIGN);

    expect(one).toBe(again);
    expect(one).not.toBe(other);
    expect(one).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(one).not.toBe(PRIMARY);
    expect(one).not.toBe(ADDITION);
  });

  it("recusa operação primária ausente, não entregue ou ilegível antes de baixar bytes", async () => {
    const source = sourceFor("new_flow_1_1");

    for (const [primary, reason] of [
      [{ kind: "missing" }, "primary_operation_missing"],
      [
        { kind: "found", operationId: PRIMARY, status: "reserved" },
        "primary_operation_not_delivered",
      ],
      [
        { kind: "read_failed", detail: "boom" },
        "primary_operation_read_failed",
      ],
    ] as const) {
      const { deps, captured } = depsFor({ source, primary });
      const result = await ensureFormatAdditionSourceBridge(
        { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "new_flow_1_1", authorization: SYSTEM },
        deps,
      );

      expect(result).toMatchObject({ ok: false, reason });
      expect(captured.downloads).toHaveLength(0);
      expect(captured.persist).toHaveLength(0);
    }
  });

  it("recusa path que não corresponde à operação primária", async () => {
    const source = sourceFor("new_flow_1_1", {
      storagePath: `${STORE}/${CAMPAIGN}/product-1-1/${ADDITION}/art-1024.jpg`,
    });
    const { deps, captured } = depsFor({ source });

    const result = await ensureFormatAdditionSourceBridge(
      { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "new_flow_1_1", authorization: SYSTEM },
      deps,
    );

    expect(result).toMatchObject({
      ok: false,
      reason: "source_operation_artifact_mismatch",
    });
    expect(captured.downloads).toHaveLength(0);
    expect(captured.persist).toHaveLength(0);
  });

  it("revalida o checksum da fonte antes de reutilizar a ponte", async () => {
    const source = sourceFor("legacy_campaign");
    const { deps, captured } = depsFor({
      source,
      bytes: Buffer.from("divergent-bytes"),
    });

    const result = await ensureFormatAdditionSourceBridge(
      { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
      deps,
    );

    expect(result).toMatchObject({ ok: false, reason: "source_checksum_mismatch" });
    expect(captured.persist).toHaveLength(0);
  });

  it("conflito de conteúdo na ponte não é sucesso nem novo upload", async () => {
    const source = sourceFor("legacy_campaign");
    const { deps } = depsFor({
      source,
      persistResult: {
        kind: "content_conflict",
        existing: artifactFor(source, deriveLegacyRegistrationOperationId(STORE, CAMPAIGN)),
        reason: "checksum_mismatch",
      },
    });

    const result = await ensureFormatAdditionSourceBridge(
      { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
      deps,
    );

    expect(result).toMatchObject({ ok: false, reason: "source_checksum_mismatch" });
  });

  it("conflito de identidade/proveniência é fechado e não vira sucesso", async () => {
    const source = sourceFor("legacy_campaign");
    for (const persistResult of [
      { kind: "identity_conflict", existing: null, reason: "invalid_identity" },
      { kind: "metadata_conflict", existing: null, reason: "checksum_mismatch" },
      { kind: "provenance_conflict", existing: null, reason: "provenance_mismatch" },
    ] as const) {
      const { deps } = depsFor({ source, persistResult });
      const result = await ensureFormatAdditionSourceBridge(
        { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
        deps,
      );
      expect(result.ok).toBe(false);
    }
  });

  it("readback divergente (path/origem/proveniência) falha fechado", async () => {
    const source = sourceFor("legacy_campaign");
    const registration = deriveLegacyRegistrationOperationId(STORE, CAMPAIGN);

    for (const override of [
      { storagePath: "other/path.jpg" },
      { origin: "ai_expansion" as const },
      { provenance: { sourceOrigin: "new_flow_1_1" } },
      { checksumSha256: "f".repeat(64) },
    ]) {
      const { deps } = depsFor({
        source,
        registration,
        retrieveFactory: () => ({
          kind: "integral",
          artifact: artifactFor(source, registration, override),
          bytes: BYTES,
        }),
      });

      const result = await ensureFormatAdditionSourceBridge(
        { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
        deps,
      );

      expect(result).toMatchObject({ ok: false, reason: "bridge_readback_failed" });
    }
  });

  it("fonte não reutilizável preserva o motivo fechado", async () => {
    const source = sourceFor("legacy_campaign");
    const { deps } = depsFor({
      source,
      resolveResult: { kind: "not_reusable", reason: "unsupported_dimensions" },
    });

    await expect(
      ensureFormatAdditionSourceBridge(
        { storeId: STORE, campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign", authorization: SYSTEM },
        deps,
      ),
    ).resolves.toMatchObject({
      ok: false,
      reason: "unsupported_dimensions",
    });
  });

  it("recusa identidade/origem inválidas sem I/O", async () => {
    const source = sourceFor("legacy_campaign");
    const { deps, captured } = depsFor({ source });

    for (const input of [
      { storeId: "not-uuid", campaignId: CAMPAIGN, sourceOrigin: "legacy_campaign" as const },
      { storeId: STORE, campaignId: "not-uuid", sourceOrigin: "legacy_campaign" as const },
      {
        storeId: STORE,
        campaignId: CAMPAIGN,
        sourceOrigin: "composition_artifact" as unknown as "legacy_campaign",
      },
    ]) {
      const result = await ensureFormatAdditionSourceBridge(
        { ...input, authorization: SYSTEM },
        deps,
      );
      expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    }

    expect(captured.primaryReads).toBe(0);
    expect(captured.downloads).toHaveLength(0);
    expect(captured.persist).toHaveLength(0);
  });

  it("módulo é server-only e não chama provider/financeiro/fluxo conjunto", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(
        "src/lib/campaign/format-addition/source-registration.ts",
        "utf8",
      ),
    );

    expect(source).toContain('import "server-only"');
    expect(source).not.toMatch(/@\/lib\/ai\//);
    expect(source).not.toMatch(/from\s+["'][^"']*provider/i);
    expect(source).not.toMatch(/product_two_format/);
    expect(source).not.toMatch(/product_1_1_reserve|reserve_credit/);
    expect(source).not.toMatch(/campaigns\s+SET|UPDATE\s+public\.campaigns/i);
  });
});
