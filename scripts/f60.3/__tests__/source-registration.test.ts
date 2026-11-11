// @vitest-environment node
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import {
  runPrepareSource,
  type HarnessDeps,
  type PreflightResult,
  type PrepareSourceResultLike,
} from "../vertical-expansion-proof";

const STORE = "3dc7d274-0b57-45ba-883a-7b235056feda";
const CAMPAIGN = "c06b16f5-f126-429c-b5b0-9567fe4adb95";
const SOURCE_OP = "41c3f33f-3be0-4086-b04e-710258643609";
const PREPARED_OP = "b960bdbd-4b75-4b55-a22c-837945bf69a3";
const SOURCE_PATH = `${STORE}/${CAMPAIGN}/product-1-1/${SOURCE_OP}/art-1024.jpg`;
const SOURCE_CHECKSUM = "f9ed34703ae84f41694bbe265d654616d4b8cdc8b0670149b1c914e8c30970d4";

function artifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    storeId: STORE,
    campaignId: CAMPAIGN,
    operationId: SOURCE_OP,
    role: "square_original",
    format: "1:1",
    origin: "provider_generation",
    derivedFromArtifactId: null,
    sourceCampaignId: null,
    storageBucket: "campaign-internal-artifacts",
    storagePath: `${STORE}/${CAMPAIGN}/${SOURCE_OP}/square_original.jpg`,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: 178_723,
    checksumSha256: SOURCE_CHECKSUM,
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

function preflight(storagePath = SOURCE_PATH): PreflightResult {
  const required = [
    "module_import",
    "f60_1_target",
    "supabase_env",
    "credentials",
    "f60_1_applied",
    "catalog_pricing",
    "campaigns_snapshot",
  ];
  return {
    kind: "f60.3-preflight",
    mode: "prepare-source",
    checkedAt: "2026-11-11T00:00:00.000Z",
    ready: false,
    providerCalls: 0,
    credential: "product",
    declaration: "sem chamada paga",
    checks: required.map((id) => ({
      id,
      name: id,
      status: "PASS" as const,
      detail: "ok",
    })),
    summary: {
      sourceStatus: "original_only",
      provider: "openai",
      model: "gpt-image-2.5-sunburst",
      protocol: "images",
      quality: "low",
      pricingVersion: "pricing-v1",
      imageUnitUsd: 0.036,
      estimatedPreCallUsd: 0.09,
      estimateSource: "imageUnitUsd x 2.5 (f59-vertical-9-16-v1)",
      pricingMissing: [],
      sourceArtifactId: null,
      sourceChecksumSha256: null,
      sourceByteSize: null,
      destinationStatus: "absent",
      credential: "product",
      campaignsBefore: {
        id: CAMPAIGN,
        status: "ready",
        storagePath,
      },
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
    evidencePath: "test-preflight.json",
  };
}

const ENV: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  F60_3_PREPARE_AUTHORIZED: "1",
  F60_3_STORE_ID: STORE,
  F60_3_CAMPAIGN_ID: CAMPAIGN,
  F60_3_SOURCE_OPERATION_ID: SOURCE_OP,
  F60_3_PREPARED_OPERATION_ID: PREPARED_OP,
  SUPABASE_URL: "http://127.0.0.1:57781",
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:57781",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
};

function baseDeps(overrides: Partial<HarnessDeps> = {}): HarnessDeps {
  const evidenceDir = mkdtempSync(path.join(os.tmpdir(), "f60.3-registration-"));
  return {
    evidenceDir,
    now: () => new Date("2026-11-11T00:00:00.000Z"),
    preflight: async () => preflight(),
    downloadSourceObject: async () => Buffer.from("fake-source"),
    verifySourceBytes: async () => ({
      ok: true,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      byteSize: 11,
      checksumSha256: SOURCE_CHECKSUM,
    }),
    ...overrides,
  };
}

describe("runPrepareSource — registro do square_original real", () => {
  it("registra a arte canônica quando o square_original não existe e prepara 1152", async () => {
    let registered = false;
    const sourceArtifact = artifact();
    const preparedArtifact = artifact({
      id: "22222222-2222-4222-8222-222222222222",
      operationId: PREPARED_OP,
      role: "square_prepared",
      origin: "deterministic_preparation",
      width: 1152,
      height: 1152,
      storagePath: `${STORE}/${CAMPAIGN}/${PREPARED_OP}/square_prepared.jpg`,
      checksumSha256: "prepared-checksum",
    });
    const persistSource = vi.fn(async () => {
      registered = true;
      return { kind: "created" as const };
    });
    const prepareSource = vi.fn(
      async (): Promise<PrepareSourceResultLike> => ({
        kind: "prepared",
        artifact: preparedArtifact,
        persistence: "created",
      }),
    );
    const retrieve = vi.fn(async (input: { identity: { role: string } }) => {
      if (input.identity.role === "square_original") {
        return registered
          ? { kind: "integral" as const, artifact: sourceArtifact, bytes: Buffer.from("fake-source") }
          : { kind: "absent" as const };
      }
      return { kind: "absent" as const };
    });

    const result = await runPrepareSource(
      ENV,
      { authorized: "authorized-token" },
      baseDeps({ persistSource, prepareSource, retrieve }),
    );

    expect(result.ok).toBe(true);
    expect(result.result).toBe("prepared");
    expect(result.registrationResult).toBe("created");
    expect(result.providerCalls).toBe(0);
    expect(result.sourceBucket).toBe("campaign-images");
    expect(result.sourceObjectPath).toBe(SOURCE_PATH);
    expect(persistSource).toHaveBeenCalledTimes(1);
    expect(prepareSource).toHaveBeenCalledTimes(1);
  });

  it("reutiliza o square_original existente quando o checksum confere", async () => {
    const sourceArtifact = artifact();
    const persistSource = vi.fn();
    const prepareSource = vi.fn(
      async (): Promise<PrepareSourceResultLike> => ({
        kind: "prepared",
        artifact: artifact({
          id: "33333333-3333-4333-8333-333333333333",
          operationId: PREPARED_OP,
          role: "square_prepared",
          origin: "deterministic_preparation",
          width: 1152,
          height: 1152,
          checksumSha256: "prepared-checksum",
        }),
        persistence: "created",
      }),
    );
    const retrieve = vi.fn(async (input: { identity: { role: string } }) => {
      if (input.identity.role === "square_original") {
        return { kind: "integral" as const, artifact: sourceArtifact, bytes: Buffer.from("fake-source") };
      }
      return { kind: "absent" as const };
    });

    const result = await runPrepareSource(
      ENV,
      { authorized: "authorized-token" },
      baseDeps({ persistSource, prepareSource, retrieve }),
    );

    expect(result.ok).toBe(true);
    expect(result.registrationResult).toBe("existing");
    expect(persistSource).not.toHaveBeenCalled();
    expect(prepareSource).toHaveBeenCalledTimes(1);
  });

  it("recusa quando o square_original existente diverge do objeto canônico", async () => {
    const prepareSource = vi.fn();
    const retrieve = vi.fn(async (input: { identity: { role: string } }) => {
      if (input.identity.role === "square_original") {
        return {
          kind: "integral" as const,
          artifact: artifact({ checksumSha256: "different-checksum" }),
          bytes: Buffer.from("fake-source"),
        };
      }
      return { kind: "absent" as const };
    });

    const result = await runPrepareSource(
      ENV,
      { authorized: "authorized-token" },
      baseDeps({ prepareSource, retrieve }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("source_checksum_mismatch");
    expect(prepareSource).not.toHaveBeenCalled();
  });

  it("recusa sem preparar quando a persistência do square_original conflita", async () => {
    const prepareSource = vi.fn();
    const persistSource = vi.fn(async () => ({
      kind: "content_conflict" as const,
      reason: "checksum_mismatch",
      existing: null,
    }));
    const retrieve = vi.fn(async () => ({ kind: "absent" as const }));

    const result = await runPrepareSource(
      ENV,
      { authorized: "authorized-token" },
      baseDeps({ persistSource, prepareSource, retrieve }),
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toContain("source_registration_content_conflict");
    expect(prepareSource).not.toHaveBeenCalled();
  });

  it("não prepara de novo quando o square_prepared já existe", async () => {
    const preparedArtifact = artifact({
      id: "44444444-4444-4444-8444-444444444444",
      operationId: PREPARED_OP,
      role: "square_prepared",
      origin: "deterministic_preparation",
      width: 1152,
      height: 1152,
      checksumSha256: "prepared-checksum",
    });
    const prepareSource = vi.fn();
    const retrieve = vi.fn(async (input: { identity: { role: string } }) => {
      if (input.identity.role === "square_original") {
        return { kind: "integral" as const, artifact: artifact(), bytes: Buffer.from("fake-source") };
      }
      return { kind: "integral" as const, artifact: preparedArtifact, bytes: Buffer.from("prepared") };
    });

    const result = await runPrepareSource(
      ENV,
      { authorized: "authorized-token" },
      baseDeps({ prepareSource, retrieve }),
    );

    expect(result.ok).toBe(true);
    expect(result.result).toBe("existing");
    expect(result.registrationResult).toBe("existing");
    expect(prepareSource).not.toHaveBeenCalled();
  });
});
