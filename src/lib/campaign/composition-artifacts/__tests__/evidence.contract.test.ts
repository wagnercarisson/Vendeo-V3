// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  COMPOSITION_EVIDENCE_METADATA_KEY,
  buildEvidenceMetadata,
  buildObjectEvidence,
  canonicalJson,
  computeEvidenceDigest,
  computeProvenanceDigest,
  normalizeProvenance,
  readEvidenceMetadata,
  verifyObjectEvidence,
} from "../evidence";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const ARTIFACT_ID = "55555555-5555-4555-8555-555555555555";
const SOURCE_CAMPAIGN_ID = "66666666-6666-4666-8666-666666666666";
const SHA = "a".repeat(64);

function internalEvidence() {
  const result = buildObjectEvidence({
    storeId: STORE_ID,
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    role: "square_prepared",
    origin: "deterministic_preparation",
    sourceKind: "internal_artifact",
    sourceArtifactId: ARTIFACT_ID,
    sourceOrigin: "composition_artifact",
    sourceChecksumSha256: SHA,
    width: 1152,
    height: 1152,
    mimeType: "image/jpeg",
    byteSize: 12345,
    checksumSha256: SHA,
    provenance: {
      sourceOrigin: "composition_artifact",
      sourceStoragePath: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
      sourceWidth: 1024,
      sourceHeight: 1024,
      sourceMimeType: "image/jpeg",
      sourceChecksumSha256: SHA,
      derivedFromArtifactId: ARTIFACT_ID,
    },
  });
  if (!result.ok) throw new Error("internal evidence should build");
  return result.evidence;
}

describe("canonicalJson", () => {
  it("sorts keys recursively and ignores insertion order", () => {
    const first = canonicalJson({ b: 1, a: { d: 2, c: [3, { f: 4, e: 5 }] } });
    const second = canonicalJson({ a: { c: [3, { e: 5, f: 4 }], d: 2 }, b: 1 });
    expect(first).toBe(second);
    expect(first).toBe('{"a":{"c":[3,{"e":5,"f":4}],"d":2},"b":1}');
  });

  it("rejects undefined, non-finite numbers, functions, symbols and cycles", () => {
    expect(() => canonicalJson(undefined)).toThrow();
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson(Number.NaN)).toThrow();
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow();
    expect(() => canonicalJson(() => 1)).toThrow();
    expect(() => canonicalJson(Symbol("x"))).toThrow();
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;
    expect(() => canonicalJson(cycle)).toThrow();
  });
});

describe("digests", () => {
  it("are stable across key order and sensitive to changes", () => {
    expect(computeProvenanceDigest({ a: 1, b: 2 })).toBe(
      computeProvenanceDigest({ b: 2, a: 1 }),
    );
    expect(computeProvenanceDigest({ a: 1 })).not.toBe(
      computeProvenanceDigest({ a: 2 }),
    );
    const evidence = internalEvidence();
    expect(computeEvidenceDigest(evidence)).toBe(
      computeEvidenceDigest({ ...evidence }),
    );
  });
});

describe("normalizeProvenance", () => {
  it("drops unknown keys and keeps the allowlist", () => {
    const result = normalizeProvenance({
      sourceOrigin: "composition_artifact",
      sourceStoragePath: "path",
      sourceWidth: 1024,
      sourceHeight: 1024,
      sourceMimeType: "image/jpeg",
      sourceChecksumSha256: SHA.toUpperCase(),
      derivedFromArtifactId: ARTIFACT_ID,
      unknown: "dropped",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provenance).toEqual({
        sourceOrigin: "composition_artifact",
        sourceStoragePath: "path",
        sourceWidth: 1024,
        sourceHeight: 1024,
        sourceMimeType: "image/jpeg",
        sourceChecksumSha256: SHA,
        derivedFromArtifactId: ARTIFACT_ID,
      });
      expect(result.provenance).not.toHaveProperty("unknown");
    }
  });

  it("rejects malformed known values", () => {
    expect(normalizeProvenance(null)).toEqual({
      ok: false,
      reason: "provenance_malformed",
    });
    expect(normalizeProvenance({ sourceOrigin: "other" })).toEqual({
      ok: false,
      reason: "provenance_malformed",
    });
    expect(normalizeProvenance({ sourceChecksumSha256: "abc" })).toEqual({
      ok: false,
      reason: "provenance_malformed",
    });
    expect(normalizeProvenance({ derivedFromArtifactId: "nope" })).toEqual({
      ok: false,
      reason: "provenance_malformed",
    });
  });
});

describe("buildObjectEvidence", () => {
  it("builds internal evidence with composition_artifact origin", () => {
    const evidence = internalEvidence();
    expect(evidence.sourceKind).toBe("internal_artifact");
    expect(evidence.sourceOrigin).toBe("composition_artifact");
    expect(evidence.sourceArtifactId).toBe(ARTIFACT_ID);
    expect(evidence.provenanceDigest).toHaveLength(64);
    expect(evidence).not.toHaveProperty("sourceCampaignId");
  });

  it("builds delivered-campaign evidence for legacy and new 1:1", () => {
    for (const origin of ["legacy_campaign", "new_flow_1_1"] as const) {
      const result = buildObjectEvidence({
        storeId: STORE_ID,
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        role: "square_prepared",
        origin: "deterministic_preparation",
        sourceKind: "delivered_campaign_source",
        sourceCampaignId: SOURCE_CAMPAIGN_ID,
        sourceOrigin: origin,
        sourceChecksumSha256: SHA,
        width: 1152,
        height: 1152,
        mimeType: "image/jpeg",
        byteSize: 12345,
        checksumSha256: SHA,
        provenance: { sourceOrigin: origin, sourceChecksumSha256: SHA },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.evidence.sourceOrigin).toBe(origin);
        expect(result.evidence.sourceCampaignId).toBe(SOURCE_CAMPAIGN_ID);
        expect(result.evidence).not.toHaveProperty("sourceArtifactId");
      }
    }
  });

  it("rejects incoherent source references", () => {
    const base = {
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      role: "square_original" as const,
      origin: "provider_generation" as const,
      width: 1024,
      height: 1024,
      mimeType: "image/jpeg",
      byteSize: 12345,
      checksumSha256: SHA,
      provenance: {},
    };

    expect(
      buildObjectEvidence({
        ...base,
        sourceKind: "none",
        sourceOrigin: "legacy_campaign",
      }),
    ).toEqual({ ok: false, reason: "evidence_invalid" });

    expect(
      buildObjectEvidence({
        ...base,
        sourceKind: "internal_artifact",
        sourceArtifactId: ARTIFACT_ID,
        sourceOrigin: "legacy_campaign",
      }),
    ).toEqual({ ok: false, reason: "evidence_invalid" });

    expect(
      buildObjectEvidence({
        ...base,
        sourceKind: "delivered_campaign_source",
        sourceCampaignId: SOURCE_CAMPAIGN_ID,
        sourceOrigin: "composition_artifact",
      }),
    ).toEqual({ ok: false, reason: "evidence_invalid" });
  });
});

describe("metadata and verification", () => {
  it("wraps evidence under the exact snake_case key", () => {
    const evidence = internalEvidence();
    const metadata = buildEvidenceMetadata(evidence);
    expect(metadata).toHaveProperty(COMPOSITION_EVIDENCE_METADATA_KEY);
    expect(metadata[COMPOSITION_EVIDENCE_METADATA_KEY]).toEqual({
      evidence,
      evidenceDigest: computeEvidenceDigest(evidence),
    });
  });

  it("reads snake_case and camelCase metadata", () => {
    const evidence = internalEvidence();
    const metadata = buildEvidenceMetadata(evidence);
    const payload = metadata[COMPOSITION_EVIDENCE_METADATA_KEY];
    expect(readEvidenceMetadata(metadata)).toEqual(payload);
    expect(
      readEvidenceMetadata({ vendeoCompositionArtifact: payload }),
    ).toEqual(payload);
  });

  it("classifies missing, invalid and mismatched evidence", () => {
    const evidence = internalEvidence();
    const metadata = buildEvidenceMetadata(evidence);

    expect(verifyObjectEvidence({}, evidence)).toEqual({
      ok: false,
      reason: "evidence_missing",
    });
    expect(
      verifyObjectEvidence(
        { vendeo_composition_artifact: "{not-json" },
        evidence,
      ),
    ).toEqual({ ok: false, reason: "evidence_invalid" });
    expect(
      verifyObjectEvidence(
        {
          vendeoCompositionArtifact: {
            evidence,
            evidenceDigest: "b".repeat(64),
          },
        },
        evidence,
      ),
    ).toEqual({ ok: false, reason: "evidence_mismatch" });
    expect(verifyObjectEvidence(metadata, evidence)).toEqual({ ok: true });
  });

  it("rejects evidence whose identity/provenance diverges from expected", () => {
    const evidence = internalEvidence();
    const metadata = buildEvidenceMetadata(evidence);
    expect(
      verifyObjectEvidence(metadata, {
        ...evidence,
        operationId: "77777777-7777-4777-8777-777777777777",
      }),
    ).toEqual({ ok: false, reason: "evidence_mismatch" });
  });
});
