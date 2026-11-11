// @vitest-environment node
import { describe, expect, it } from "vitest";

import { COMPOSITION_ARTIFACT_BUCKET } from "@/lib/campaign/composition-artifacts/artifact-path";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import {
  isCompatiblePreparedArtifact,
  type PreparedCompatibilityInput,
} from "../reuse-compatibility";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const PREPARED_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const OTHER_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const PREPARED_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";

const SOURCE_PATH = `${STORE_ID}/${CAMPAIGN_ID}/${SOURCE_OPERATION_ID}/square_original.jpg`;
const PREPARED_PATH = `${STORE_ID}/${CAMPAIGN_ID}/${PREPARED_OPERATION_ID}/square_prepared.jpg`;
const SOURCE_CHECKSUM = "a".repeat(64);
const PREPARED_CHECKSUM = "b".repeat(64);

/** Fonte já validada pela F60.1 (bytes reais do `square_original`). */
function compatibleSource(): PreparedCompatibilityInput["source"] {
  return {
    artifactId: SOURCE_ARTIFACT_ID,
    storagePath: SOURCE_PATH,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    checksumSha256: SOURCE_CHECKSUM,
  };
}

/** Linha `square_prepared` compatível, derivada da fonte acima. */
function compatibleArtifact(
  overrides: Partial<ArtifactRecord> = {},
): ArtifactRecord {
  return {
    id: PREPARED_ARTIFACT_ID,
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: PREPARED_OPERATION_ID,
    role: "square_prepared",
    format: "1:1",
    origin: "deterministic_preparation",
    derivedFromArtifactId: SOURCE_ARTIFACT_ID,
    sourceCampaignId: null,
    storageBucket: COMPOSITION_ARTIFACT_BUCKET,
    storagePath: PREPARED_PATH,
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: 98_765,
    checksumSha256: PREPARED_CHECKSUM,
    provenance: {
      sourceOrigin: "composition_artifact",
      sourceStoragePath: SOURCE_PATH,
      sourceWidth: 1024,
      sourceHeight: 1024,
      sourceMimeType: "image/jpeg",
      sourceChecksumSha256: SOURCE_CHECKSUM,
      derivedFromArtifactId: SOURCE_ARTIFACT_ID,
    },
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

function evaluate(
  artifactOverrides: Partial<ArtifactRecord> = {},
  sourceOverrides: Partial<PreparedCompatibilityInput["source"]> = {},
): boolean {
  return isCompatiblePreparedArtifact({
    artifact: compatibleArtifact(artifactOverrides),
    source: { ...compatibleSource(), ...sourceOverrides },
  });
}

describe("isCompatiblePreparedArtifact", () => {
  it("aceita uma linha prepared derivada da mesma fonte", () => {
    expect(evaluate()).toBe(true);
  });

  it("recusa origem diferente de deterministic_preparation", () => {
    expect(evaluate({ origin: "ai_expansion" })).toBe(false);
    expect(evaluate({ origin: "provider_generation" })).toBe(false);
  });

  it("recusa derivedFromArtifactId de coluna apontando para outro artefato", () => {
    expect(evaluate({ derivedFromArtifactId: OTHER_ARTIFACT_ID })).toBe(false);
    expect(evaluate({ derivedFromArtifactId: null })).toBe(false);
  });

  it("recusa sourceCampaignId preenchido (derivado interno nunca tem campanha de origem)", () => {
    expect(evaluate({ sourceCampaignId: CAMPAIGN_ID })).toBe(false);
  });

  it("recusa papel e formato diferentes do alvo", () => {
    expect(evaluate({ role: "square_original" })).toBe(false);
    expect(evaluate({ role: "vertical" })).toBe(false);
    expect(evaluate({ format: "9:16" })).toBe(false);
  });

  it("recusa dimensões divergentes do papel square_prepared", () => {
    expect(evaluate({ width: 1024 })).toBe(false);
    expect(evaluate({ height: 1024 })).toBe(false);
    expect(evaluate({ width: 1152, height: 1023 })).toBe(false);
  });

  it("recusa MIME diferente de image/jpeg", () => {
    expect(evaluate({ mimeType: "image/png" })).toBe(false);
  });

  it("recusa proveniência com sourceOrigin diferente de composition_artifact", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceOrigin: "new_flow_1_1" },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceOrigin: "legacy_campaign" },
      }),
    ).toBe(false);
  });

  it("recusa proveniência cujo derivedFromArtifactId aponta para outro artefato", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: {
          ...artifact.provenance,
          derivedFromArtifactId: OTHER_ARTIFACT_ID,
        },
      }),
    ).toBe(false);
  });

  it("recusa checksum de fonte diferente na proveniência", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceChecksumSha256: "c".repeat(64) },
      }),
    ).toBe(false);
    expect(
      evaluate({}, { checksumSha256: "d".repeat(64) }),
    ).toBe(false);
  });

  it("recusa sourceStoragePath, dimensões e MIME de fonte divergentes", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: {
          ...artifact.provenance,
          sourceStoragePath: `${STORE_ID}/${CAMPAIGN_ID}/outra/square_original.jpg`,
        },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceWidth: 1080 },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceHeight: 1080 },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: { ...artifact.provenance, sourceMimeType: "image/png" },
      }),
    ).toBe(false);
    expect(evaluate({}, { storagePath: `${STORE_ID}/${CAMPAIGN_ID}/x/y.jpg` })).toBe(
      false,
    );
  });

  it("recusa proveniência ausente (chaves obrigatórias faltando)", () => {
    expect(
      evaluate({
        provenance: undefined as unknown as Record<string, unknown>,
      }),
    ).toBe(false);
    expect(evaluate({ provenance: {} })).toBe(false);

    const artifact = compatibleArtifact();
    const withoutDerived: Record<string, unknown> = { ...artifact.provenance };
    delete withoutDerived.derivedFromArtifactId;
    expect(evaluate({ provenance: withoutDerived })).toBe(false);
  });

  it("recusa proveniência com chave extra irrelevante (conjunto exato)", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: { ...artifact.provenance, extra: "irrelevante" },
      }),
    ).toBe(false);
  });

  it("compara o checksum da fonte sem diferenciar maiúsculas/minúsculas", () => {
    const artifact = compatibleArtifact();
    expect(
      evaluate({
        provenance: {
          ...artifact.provenance,
          sourceChecksumSha256: SOURCE_CHECKSUM.toUpperCase(),
        },
      }),
    ).toBe(true);
    expect(evaluate({}, { checksumSha256: SOURCE_CHECKSUM.toUpperCase() })).toBe(
      true,
    );
  });

  it("retorna false sem lançar para entrada malformada", () => {
    expect(
      isCompatiblePreparedArtifact({
        artifact: compatibleArtifact({
          provenance: null as unknown as Record<string, unknown>,
        }),
        source: compatibleSource(),
      }),
    ).toBe(false);

    expect(
      isCompatiblePreparedArtifact({
        artifact: compatibleArtifact({
          role: "square_prepared",
          width: Number.NaN,
        }),
        source: compatibleSource(),
      }),
    ).toBe(false);

    expect(
      isCompatiblePreparedArtifact(
        null as unknown as PreparedCompatibilityInput,
      ),
    ).toBe(false);

    expect(
      isCompatiblePreparedArtifact({
        artifact: compatibleArtifact(),
        source: null as unknown as PreparedCompatibilityInput["source"],
      }),
    ).toBe(false);

    expect(
      isCompatiblePreparedArtifact({
        artifact: compatibleArtifact(),
        source: { ...compatibleSource(), artifactId: 42 as unknown as string },
      }),
    ).toBe(false);
  });
});
