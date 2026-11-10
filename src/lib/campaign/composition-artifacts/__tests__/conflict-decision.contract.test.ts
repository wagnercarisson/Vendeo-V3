// @vitest-environment node
import { describe, expect, it } from "vitest";

import { decidePersistOutcome } from "../conflict-decision";
import type { ArtifactRecord } from "../types";

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const OPERATION_ID = "33333333-3333-4333-8333-333333333333";
const SHA = "a".repeat(64);
const OTHER_SHA = "b".repeat(64);

function row(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
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
    storagePath: `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/square_original.jpg`,
    width: 1024,
    height: 1024,
    mimeType: "image/jpeg",
    byteSize: 12345,
    checksumSha256: SHA,
    provenance: {},
    createdAt: "2026-11-10T00:00:00.000Z",
    ...overrides,
  };
}

const computed = {
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  byteSize: 12345,
  checksumSha256: SHA,
  provenanceDigest: SHA,
};

const presented = {
  origin: "provider_generation" as const,
  sourceKind: "none" as const,
  provenance: {},
  provenanceDigest: SHA,
};

describe("decidePersistOutcome", () => {
  it("reuses an existing row only when the object is integral and metadata/provenance match", () => {
    const result = decidePersistOutcome({
      existingRow: row(),
      objectState: {
        kind: "present",
        checksumSha256: SHA,
        evidence: { ok: true },
      },
      computed,
      presented,
    });
    expect(result).toEqual({ kind: "reused", adoption: false });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("rejects an existing row when the object evidence is missing or invalid", () => {
    for (const reason of [
      "evidence_missing",
      "evidence_invalid",
      "evidence_mismatch",
    ] as const) {
      expect(
        decidePersistOutcome({
          existingRow: row(),
          objectState: {
            kind: "present",
            checksumSha256: SHA,
            evidence: { ok: false, reason },
          },
          computed,
          presented,
        }),
      ).toEqual({
        kind: "provenance_conflict",
        existing: row(),
        reason,
      });
    }
  });

  it("reports integrity failure when the existing row's object is absent", () => {
    expect(
      decidePersistOutcome({
        existingRow: row(),
        objectState: { kind: "absent" },
        computed,
        presented,
      }),
    ).toEqual({ kind: "integrity_failure", reason: "object_absent" });
  });

  it("reports indeterminate when the existing row's object cannot be read", () => {
    expect(
      decidePersistOutcome({
        existingRow: row(),
        objectState: { kind: "indeterminate" },
        computed,
        presented,
      }),
    ).toEqual({ kind: "indeterminate", reason: "object_indeterminate" });
  });

  it("reports content conflict for a different checksum", () => {
    const result = decidePersistOutcome({
      existingRow: row(),
      objectState: {
        kind: "present",
        checksumSha256: OTHER_SHA,
        evidence: { ok: true },
      },
      computed: { ...computed, checksumSha256: OTHER_SHA },
      presented,
    });
    expect(result.kind).toBe("content_conflict");
    if (result.kind === "content_conflict") {
      expect(result.existing).not.toBeNull();
      expect(result.reason).toBe("checksum_mismatch");
    }
  });

  it("reports metadata conflict for matching content with divergent metadata", () => {
    const result = decidePersistOutcome({
      existingRow: row(),
      objectState: {
        kind: "present",
        checksumSha256: SHA,
        evidence: { ok: true },
      },
      computed: { ...computed, width: 1080 },
      presented,
    });
    expect(result).toEqual({
      kind: "metadata_conflict",
      existing: row(),
      reason: "width_mismatch",
    });
  });

  it("reports provenance conflict for matching content with divergent provenance", () => {
    const result = decidePersistOutcome({
      existingRow: row(),
      objectState: {
        kind: "present",
        checksumSha256: SHA,
        evidence: { ok: true },
      },
      computed,
      presented: {
        origin: "deterministic_preparation",
        sourceKind: "internal_artifact",
        sourceArtifactId: "99999999-9999-4999-8999-999999999999",
        sourceOrigin: "composition_artifact",
        sourceChecksumSha256: SHA,
        provenance: {
          sourceOrigin: "composition_artifact",
          sourceChecksumSha256: SHA,
          derivedFromArtifactId: "99999999-9999-4999-8999-999999999999",
          sourceStoragePath: "different/source.jpg",
        },
        provenanceDigest: SHA,
      },
    });
    expect(result.kind).toBe("provenance_conflict");
    if (result.kind === "provenance_conflict") {
      expect(result.reason).toBe("provenance_mismatch");
    }
  });

  it("rejects a presented provenance digest that does not match the computed digest", () => {
    const result = decidePersistOutcome({
      existingRow: row(),
      objectState: {
        kind: "present",
        checksumSha256: SHA,
        evidence: { ok: true },
      },
      computed,
      presented: { ...presented, provenanceDigest: OTHER_SHA },
    });
    expect(result).toEqual({
      kind: "provenance_conflict",
      existing: row(),
      reason: "provenance_mismatch",
    });
  });

  it("detects changes in allowed provenance fields such as sourceStoragePath", () => {
    const sourceArtifactId = "99999999-9999-4999-8999-999999999999";
    const result = decidePersistOutcome({
      existingRow: row({
        origin: "deterministic_preparation",
        derivedFromArtifactId: sourceArtifactId,
        provenance: {
          sourceOrigin: "composition_artifact",
          sourceStoragePath: "original/source.jpg",
          sourceChecksumSha256: SHA,
          derivedFromArtifactId: sourceArtifactId,
        },
      }),
      objectState: {
        kind: "present",
        checksumSha256: SHA,
        evidence: { ok: true },
      },
      computed,
      presented: {
        origin: "deterministic_preparation",
        sourceKind: "internal_artifact",
        sourceArtifactId,
        sourceOrigin: "composition_artifact",
        sourceChecksumSha256: SHA,
        provenance: {
          sourceOrigin: "composition_artifact",
          sourceStoragePath: "different/source.jpg",
          sourceChecksumSha256: SHA,
          derivedFromArtifactId: sourceArtifactId,
        },
        provenanceDigest: SHA,
      },
    });
    expect(result.kind).toBe("provenance_conflict");
    if (result.kind === "provenance_conflict") {
      expect(result.reason).toBe("provenance_mismatch");
    }
  });

  it("creates when there is no row and no object", () => {
    expect(
      decidePersistOutcome({
        existingRow: null,
        objectState: { kind: "absent" },
        computed,
        presented,
      }),
    ).toEqual({ kind: "created" });
  });

  it("adopts an integral orphan with matching evidence", () => {
    expect(
      decidePersistOutcome({
        existingRow: null,
        objectState: {
          kind: "present",
          checksumSha256: SHA,
          evidence: { ok: true },
        },
        computed,
        presented,
      }),
    ).toEqual({ kind: "reused", adoption: true });
  });

  it("rejects an orphan with matching bytes but failing evidence", () => {
    for (const reason of [
      "evidence_missing",
      "evidence_invalid",
      "evidence_mismatch",
    ] as const) {
      expect(
        decidePersistOutcome({
          existingRow: null,
          objectState: {
            kind: "present",
            checksumSha256: SHA,
            evidence: { ok: false, reason },
          },
          computed,
          presented,
        }),
      ).toEqual({
        kind: "provenance_conflict",
        existing: null,
        reason,
      });
    }
  });

  it("reports content conflict for an orphan with different bytes", () => {
    expect(
      decidePersistOutcome({
        existingRow: null,
        objectState: {
          kind: "present",
          checksumSha256: OTHER_SHA,
          evidence: { ok: true },
        },
        computed,
        presented,
      }),
    ).toEqual({
      kind: "content_conflict",
      existing: null,
      reason: "checksum_mismatch",
    });
  });

  it("reports indeterminate for an orphan whose object cannot be read", () => {
    expect(
      decidePersistOutcome({
        existingRow: null,
        objectState: { kind: "indeterminate" },
        computed,
        presented,
      }),
    ).toEqual({ kind: "indeterminate", reason: "object_indeterminate" });
  });
});
