// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { COMPOSITION_ARTIFACT_BUCKET } from "@/lib/campaign/composition-artifacts/artifact-path";
import type { ArtifactRecord } from "@/lib/campaign/composition-artifacts/types";

import {
  EXPECTED_EXPANSION_PROVENANCE_KEYS,
  isCompatibleExpansionArtifact,
  type ExpansionCompatibilityInput,
} from "../reuse-compatibility";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const SOURCE_OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const DEST_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";
const SOURCE_ARTIFACT_ID = "5e6f7a8b-5e6f-4a8b-9c8d-5e6f7a8b9c0d";
const OTHER_ARTIFACT_ID = "6f7a8b9c-6f7a-4b9c-8d9e-6f7a8b9c0d1e";
const VERTICAL_ARTIFACT_ID = "7a8b9c0d-7a8b-4c0d-8e9f-7a8b9c0d1e2f";

const SOURCE_PATH = `${STORE_ID}/${CAMPAIGN_ID}/${SOURCE_OPERATION_ID}/square_prepared.jpg`;
const VERTICAL_PATH = `${STORE_ID}/${CAMPAIGN_ID}/${DEST_OPERATION_ID}/vertical.jpg`;
const SOURCE_CHECKSUM = "a".repeat(64);
const VERTICAL_CHECKSUM = "b".repeat(64);

/**
 * Fábrica LOCAL de `ArtifactRecord` (nunca importa o fake de banco). O módulo é
 * puro: a compatibilidade é decidida apenas com os dois registros.
 */
function compatibleSource(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
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
    storageBucket: COMPOSITION_ARTIFACT_BUCKET,
    storagePath: SOURCE_PATH,
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: 120_000,
    checksumSha256: SOURCE_CHECKSUM,
    provenance: {},
    createdAt: "2026-11-11T00:00:00.000Z",
    ...overrides,
  };
}

/** Linha `vertical` compatível, derivada da fonte acima. */
function compatibleArtifact(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
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
    storageBucket: COMPOSITION_ARTIFACT_BUCKET,
    storagePath: VERTICAL_PATH,
    width: 1080,
    height: 1920,
    mimeType: "image/jpeg",
    byteSize: 210_000,
    checksumSha256: VERTICAL_CHECKSUM,
    provenance: {
      sourceOrigin: "composition_artifact",
      sourceStoragePath: SOURCE_PATH,
      sourceWidth: 1152,
      sourceHeight: 1152,
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
  sourceOverrides: Partial<ArtifactRecord> = {},
): boolean {
  return isCompatibleExpansionArtifact({
    artifact: compatibleArtifact(artifactOverrides),
    source: compatibleSource(sourceOverrides),
  });
}

describe("isCompatibleExpansionArtifact", () => {
  it("aceita uma linha vertical derivada da mesma fonte", () => {
    expect(evaluate()).toBe(true);
  });

  it("recusa papel, formato e origem fora do contrato do destino", () => {
    expect(evaluate({ role: "square_prepared" })).toBe(false);
    expect(evaluate({ role: "square_original" })).toBe(false);
    expect(evaluate({ format: "1:1" })).toBe(false);
    expect(evaluate({ origin: "deterministic_preparation" })).toBe(false);
    expect(evaluate({ origin: "provider_generation" })).toBe(false);
  });

  it("recusa dimensões e MIME divergentes do papel vertical", () => {
    expect(evaluate({ width: 1152, height: 2048 })).toBe(false);
    expect(evaluate({ width: 1080, height: 1081 })).toBe(false);
    expect(evaluate({ height: 1920, width: 1079 })).toBe(false);
    expect(evaluate({ mimeType: "image/png" })).toBe(false);
  });

  it("recusa derivedFromArtifactId de coluna apontando para outra fonte", () => {
    expect(evaluate({ derivedFromArtifactId: OTHER_ARTIFACT_ID })).toBe(false);
    expect(evaluate({ derivedFromArtifactId: null })).toBe(false);
  });

  it("recusa sourceCampaignId preenchido (derivado interno nunca tem campanha de origem)", () => {
    expect(evaluate({ sourceCampaignId: CAMPAIGN_ID })).toBe(false);
  });

  it("recusa proveniência com chave extra, chave faltando ou tipo errado", () => {
    const withExtra: Record<string, unknown> = {
      ...compatibleArtifact().provenance,
      extraKey: "irrelevante",
    };
    expect(evaluate({ provenance: withExtra })).toBe(false);

    const withoutKey: Record<string, unknown> = {
      ...compatibleArtifact().provenance,
    };
    delete withoutKey.derivedFromArtifactId;
    expect(evaluate({ provenance: withoutKey })).toBe(false);

    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceWidth: "1152" as unknown as number,
        },
      }),
    ).toBe(false);

    expect(evaluate({ provenance: null as unknown as Record<string, unknown> })).toBe(
      false,
    );
  });

  it("recusa proveniência cujo sourceOrigin não é composition_artifact", () => {
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceOrigin: "new_flow_1_1",
        },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceOrigin: "legacy_campaign",
        },
      }),
    ).toBe(false);
  });

  it("recusa proveniência cujo derivedFromArtifactId aponta para outra fonte", () => {
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          derivedFromArtifactId: OTHER_ARTIFACT_ID,
        },
      }),
    ).toBe(false);
  });

  it("compara o checksum da fonte sem diferenciar maiúsculas/minúsculas", () => {
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceChecksumSha256: SOURCE_CHECKSUM.toUpperCase(),
        },
      }),
    ).toBe(true);

    expect(
      evaluate({}, { checksumSha256: SOURCE_CHECKSUM.toUpperCase() }),
    ).toBe(true);

    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceChecksumSha256: "c".repeat(64),
        },
      }),
    ).toBe(false);

    expect(evaluate({}, { checksumSha256: "d".repeat(64) })).toBe(false);
  });

  it("recusa path, dimensões e MIME da fonte divergentes", () => {
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceStoragePath: `${STORE_ID}/${CAMPAIGN_ID}/outra/square_prepared.jpg`,
        },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceWidth: 1024,
        },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceHeight: 1024,
        },
      }),
    ).toBe(false);
    expect(
      evaluate({
        provenance: {
          ...compatibleArtifact().provenance,
          sourceMimeType: "image/png",
        },
      }),
    ).toBe(false);
    expect(evaluate({}, { storagePath: `${STORE_ID}/${CAMPAIGN_ID}/x/y.jpg` })).toBe(
      false,
    );
  });

  it("é total: null, undefined e objetos sem campos devolvem false sem lançar", () => {
    expect(
      isCompatibleExpansionArtifact(null as unknown as ExpansionCompatibilityInput),
    ).toBe(false);
    expect(
      isCompatibleExpansionArtifact(
        undefined as unknown as ExpansionCompatibilityInput,
      ),
    ).toBe(false);
    expect(isCompatibleExpansionArtifact({} as ExpansionCompatibilityInput)).toBe(
      false,
    );
    expect(
      isCompatibleExpansionArtifact({
        artifact: compatibleArtifact(),
        source: {} as ArtifactRecord,
      }),
    ).toBe(false);
    expect(
      isCompatibleExpansionArtifact({
        artifact: {} as ArtifactRecord,
        source: compatibleSource(),
      }),
    ).toBe(false);
  });
});

describe("EXPECTED_EXPANSION_PROVENANCE_KEYS", () => {
  it("tem exatamente as sete chaves derivadas pela F60.1 e é congelado", () => {
    expect([...EXPECTED_EXPANSION_PROVENANCE_KEYS]).toEqual([
      "sourceOrigin",
      "sourceStoragePath",
      "sourceWidth",
      "sourceHeight",
      "sourceMimeType",
      "sourceChecksumSha256",
      "derivedFromArtifactId",
    ]);
    expect(Object.isFrozen(EXPECTED_EXPANSION_PROVENANCE_KEYS)).toBe(true);
  });
});

describe("reuse-compatibility.ts — fronteiras do módulo puro", () => {
  const source = readFileSync(
    path.resolve(
      process.cwd(),
      "src/lib/campaign/vertical-expansion/reuse-compatibility.ts",
    ),
    "utf8",
  );

  it("não importa server-only, banco/armazenamento, imagem, criptografia ou filesystem", () => {
    for (const token of [
      'import "server-only"',
      "sharp",
      "@supabase/",
      "node:crypto",
      "node:fs",
    ]) {
      expect(source).not.toContain(token);
    }
  });

  it("deriva o alvo de EXPANSION_TARGET/EXPANSION_ORIGIN sem literais próprios", () => {
    expect(source).toContain("EXPANSION_TARGET");
    expect(source).toContain("EXPANSION_ORIGIN");
    // Os valores do alvo vivem em policy.ts; o predicado não os repete.
    expect(source).not.toContain("1080");
    expect(source).not.toContain("1920");
    expect(source).not.toContain("9:16");
  });
});
