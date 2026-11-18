// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  buildEvidenceMetadata,
  buildObjectEvidence,
} from "@/lib/campaign/composition-artifacts/evidence";
import { computeChecksumSha256 } from "@/lib/campaign/composition-artifacts/integrity";
import { compositionArtifactStoragePath } from "@/lib/campaign/composition-artifacts/artifact-path";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";
import {
  SQUARE_BASE_ORIGIN,
  SQUARE_BASE_TARGET,
} from "@/lib/campaign/square-base/policy";

import { CompositionSquareOriginalProbe } from "../orchestration/square-probe";

const { verifyCampaignAccessMock } = vi.hoisted(() => ({
  verifyCampaignAccessMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/campaign/composition-artifacts/access", () => ({
  verifyCampaignAccess: verifyCampaignAccessMock,
}));

const STORE = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN = "22222222-2222-4222-8222-222222222222";
const OPERATION = "33333333-3333-4333-8333-333333333333";
const ARTIFACT_ID = "55555555-5555-4555-8555-555555555555";
const BYTES = Buffer.from("square-original-bytes");

function artifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  const base: ArtifactRecord = {
    id: ARTIFACT_ID,
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: OPERATION,
    role: "square_original",
    format: "1:1",
    origin: SQUARE_BASE_ORIGIN,
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: "campaign-internal-artifacts",
    storagePath: compositionArtifactStoragePath({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      role: "square_original",
    }),
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: BYTES.byteLength,
    checksumSha256: computeChecksumSha256(BYTES),
    provenance: {},
    createdAt: "2026-11-18T00:00:00.000Z",
  };
  return { ...base, ...overrides };
}

function validMetadata(record: ArtifactRecord = artifact()) {
  const expected = buildObjectEvidence({
    storeId: record.storeId,
    campaignId: record.campaignId,
    operationId: record.operationId,
    role: SQUARE_BASE_TARGET.role,
    origin: SQUARE_BASE_ORIGIN,
    sourceKind: "none",
    width: SQUARE_BASE_TARGET.width,
    height: SQUARE_BASE_TARGET.height,
    mimeType: SQUARE_BASE_TARGET.mimeType,
    byteSize: BYTES.byteLength,
    checksumSha256: computeChecksumSha256(BYTES),
    provenance: {},
  });
  if (!expected.ok) throw new Error("fixture evidence failed");
  return buildEvidenceMetadata(expected.evidence);
}

function fakeDeps(config: {
  row?: unknown;
  retrieve?: unknown;
  info?: unknown;
} = {}) {
  return {
    getRow: vi.fn(async () => config.row ?? { kind: "found", record: artifact() }),
    retrieve: vi.fn(async () =>
      config.retrieve ?? { kind: "integral", artifact: artifact(), bytes: BYTES },
    ),
    storage: {
      readObjectInfo: vi.fn(async () =>
        config.info ?? { kind: "found", metadata: validMetadata() },
      ),
    } as never,
  };
}

describe("sonda de composição do square_original", () => {
  it("Teste 1: linha+objeto+evidência válidos ⇒ integral", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const deps = fakeDeps();
    const probe = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...deps,
    });

    const result = await probe.probeSquareOriginal({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
    });

    expect(result).toEqual({
      kind: "integral",
      storagePath: artifact().storagePath,
      artifactId: ARTIFACT_ID,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
    });
    expect(deps.getRow.mock.invocationCallOrder[0]).toBeLessThan(
      deps.retrieve.mock.invocationCallOrder[0],
    );
  });

  it("Teste 2: sem linha e sem objeto ⇒ absent", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const probe = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ row: { kind: "absent" }, info: { kind: "absent" } }),
    });
    expect(
      await probe.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "absent" });
  });

  it("Teste 3: objeto presente sem linha ⇒ invalid", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const probe = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ row: { kind: "absent" }, info: { kind: "found", metadata: {} } }),
    });
    expect(
      await probe.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "object_without_row" });
  });

  it("Teste 4: linha incompatível (papel/formato/dimensão/MIME/origem/proveniência) ⇒ invalid", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const cases: ArtifactRecord[] = [
      artifact({ role: "square_prepared" as never }),
      artifact({ format: "9:16" as never }),
      artifact({ width: 1152 }),
      artifact({ height: 1152 }),
      artifact({ mimeType: "image/png" }),
      artifact({ origin: "deterministic_preparation" }),
      artifact({ derivedFromArtifactId: ARTIFACT_ID }),
      artifact({ sourceCampaignId: CAMPAIGN }),
      artifact({ provenance: { sourceOrigin: "legacy_campaign" } }),
    ];
    for (const record of cases) {
      const probe = new CompositionSquareOriginalProbe({
        client: {} as never,
        ...fakeDeps({
          row: { kind: "found", record },
          retrieve: { kind: "integral", artifact: record, bytes: BYTES },
        }),
      });
      const result = await probe.probeSquareOriginal({
        storeId: STORE,
        campaignId: CAMPAIGN,
        operationId: OPERATION,
      });
      expect(result.kind, JSON.stringify(record)).toBe("invalid");
    }
  });

  it("Teste 5: retrieve com metadata_conflict ⇒ invalid", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const probe = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ retrieve: { kind: "metadata_conflict" } }),
    });
    expect(
      await probe.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "object_invalid" });
  });

  it("Teste 6: falha de leitura em qualquer etapa ⇒ indeterminate", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const rowFailure = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ row: { kind: "read_failed" } }),
    });
    expect(
      await rowFailure.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "indeterminate" });

    const retrieveFailure = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ retrieve: { kind: "indeterminate" } }),
    });
    expect(
      await retrieveFailure.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "indeterminate" });

    const infoFailure = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ info: { kind: "indeterminate" } }),
    });
    expect(
      await infoFailure.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "indeterminate" });
  });

  it("Teste 7: square_prepared nunca é integral", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const absent = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ row: { kind: "absent" }, info: { kind: "absent" } }),
    });
    expect(
      await absent.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "absent" });

    const orphan = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ row: { kind: "absent" }, info: { kind: "found", metadata: {} } }),
    });
    expect(
      await orphan.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "object_without_row" });
  });

  it("Teste 8: presença de objeto não é prova; linha sem objeto não é integral", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });
    const withoutObject = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ retrieve: { kind: "absent" } }),
    });
    expect(
      await withoutObject.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "absent" });
  });

  it("Teste 9: vínculo campanha→loja falha ⇒ indeterminate", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: false, reason: "not_found" });
    const deps = fakeDeps();
    const probe = new CompositionSquareOriginalProbe({ client: {} as never, ...deps });
    expect(
      await probe.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "indeterminate" });
    expect(deps.getRow).not.toHaveBeenCalled();
  });

  it("Teste 10: evidência ausente/adulterada/indisponível não vira integral", async () => {
    verifyCampaignAccessMock.mockResolvedValue({ ok: true });

    const missing = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ info: { kind: "found", metadata: {} } }),
    });
    expect(
      await missing.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "object_unverified" });

    const tamperedEvidence = buildObjectEvidence({
      storeId: STORE,
      campaignId: CAMPAIGN,
      operationId: OPERATION,
      role: SQUARE_BASE_TARGET.role,
      origin: SQUARE_BASE_ORIGIN,
      sourceKind: "none",
      width: SQUARE_BASE_TARGET.width,
      height: SQUARE_BASE_TARGET.height,
      mimeType: SQUARE_BASE_TARGET.mimeType,
      byteSize: BYTES.byteLength,
      checksumSha256: "0".repeat(64),
      provenance: {},
    });
    if (!tamperedEvidence.ok) throw new Error("fixture evidence failed");
    const tampered = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({
        info: {
          kind: "found",
          metadata: buildEvidenceMetadata(tamperedEvidence.evidence),
        },
      }),
    });
    expect(
      await tampered.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "object_unverified" });

    const missingObject = new CompositionSquareOriginalProbe({
      client: {} as never,
      ...fakeDeps({ info: { kind: "absent" } }),
    });
    expect(
      await missingObject.probeSquareOriginal({ storeId: STORE, campaignId: CAMPAIGN, operationId: OPERATION }),
    ).toEqual({ kind: "invalid", reason: "row_object_missing" });
  });
});
