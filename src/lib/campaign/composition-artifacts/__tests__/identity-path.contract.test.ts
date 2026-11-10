// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  COMPOSITION_ARTIFACT_BUCKET,
  COMPOSITION_ARTIFACT_MIME_TYPE,
  compositionArtifactStoragePath,
  isCompositionArtifactPath,
  parseCompositionArtifactPath,
} from "../artifact-path";
import {
  checkCampaignStoreBinding,
  isArtifactUuid,
  validateArtifactIdentity,
  validateAuthorizationContext,
} from "../identity";
import {
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACT_PIXELS,
  ROLE_POLICY,
  checkRolePolicy,
} from "../role-policy";
import type { ArtifactIdentity, ArtifactRole } from "../types";

const STORE_ID = "1a2b3c4d-1a2b-4c3d-8e4f-1a2b3c4d5e6f";
const CAMPAIGN_ID = "2b3c4d5e-2b3c-4d5e-8f6a-2b3c4d5e6f7a";
const OPERATION_ID = "3c4d5e6f-3c4d-4e5f-8a7b-3c4d5e6f7a8b";
const OTHER_OPERATION_ID = "4d5e6f7a-4d5e-4f6a-8b8c-4d5e6f7a8b9c";

const ROLES: ArtifactRole[] = [
  "square_original",
  "square_prepared",
  "vertical",
];

function identity(role: ArtifactRole, operationId = OPERATION_ID): ArtifactIdentity {
  return { storeId: STORE_ID, campaignId: CAMPAIGN_ID, operationId, role };
}

describe("artifact-path", () => {
  it("builds a deterministic path for each role and round-trips through the parser", () => {
    for (const role of ROLES) {
      const path = compositionArtifactStoragePath(identity(role));
      expect(path).toBe(`${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/${role}.jpg`);
      expect(parseCompositionArtifactPath(path)).toEqual(identity(role));
      expect(isCompositionArtifactPath(path)).toBe(true);
    }
  });

  it("keeps distinct operations on distinct paths", () => {
    const first = compositionArtifactStoragePath(identity("square_original"));
    const second = compositionArtifactStoragePath(
      identity("square_original", OTHER_OPERATION_ID),
    );
    expect(first).not.toBe(second);
    expect(first.startsWith(second)).toBe(false);
    expect(second.startsWith(first)).toBe(false);
    expect(parseCompositionArtifactPath(first)?.operationId).toBe(OPERATION_ID);
    expect(parseCompositionArtifactPath(second)?.operationId).toBe(
      OTHER_OPERATION_ID,
    );
  });

  it("rejects malformed, traversal and extra-segment paths without throwing", () => {
    const valid = compositionArtifactStoragePath(identity("vertical"));
    const cases = [
      "",
      "/" + valid,
      valid + "/extra",
      valid.replace("/vertical.jpg", "/vertical/extra.jpg"),
      `${STORE_ID}/${CAMPAIGN_ID}/../${OPERATION_ID}/vertical.jpg`,
      `${STORE_ID}/${CAMPAIGN_ID}/%2e%2e/${OPERATION_ID}/vertical.jpg`,
      `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/unknown.jpg`,
      `${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.png`,
      `bucket/${STORE_ID}/${CAMPAIGN_ID}/${OPERATION_ID}/vertical.jpg`,
      `${STORE_ID}/${CAMPAIGN_ID}/not-a-uuid/vertical.jpg`,
      null,
      42,
    ];

    for (const value of cases) {
      expect(() => parseCompositionArtifactPath(value as string)).not.toThrow();
      expect(parseCompositionArtifactPath(value as string)).toBeNull();
    }
  });

  it("exposes the internal bucket and JPEG MIME constants", () => {
    expect(COMPOSITION_ARTIFACT_BUCKET).toBe("campaign-internal-artifacts");
    expect(COMPOSITION_ARTIFACT_MIME_TYPE).toBe("image/jpeg");
  });
});

describe("role-policy", () => {
  it("accepts exactly the three contract dimensions", () => {
    expect(checkRolePolicy("square_original", 1024, 1024, "image/jpeg")).toEqual({
      ok: true,
      format: "1:1",
    });
    expect(checkRolePolicy("square_prepared", 1152, 1152, "image/jpeg")).toEqual({
      ok: true,
      format: "1:1",
    });
    expect(checkRolePolicy("vertical", 1080, 1920, "image/jpeg")).toEqual({
      ok: true,
      format: "9:16",
    });
  });

  it("fails closed for unknown role, wrong MIME, wrong dimension and pixel limit", () => {
    expect(checkRolePolicy("unknown", 1024, 1024, "image/jpeg")).toEqual({
      ok: false,
      reason: "unsupported_role",
    });
    expect(checkRolePolicy("square_original", 1024, 1024, "image/png")).toEqual({
      ok: false,
      reason: "mime_not_jpeg",
    });
    expect(checkRolePolicy("square_original", 1080, 1080, "image/jpeg")).toEqual({
      ok: false,
      reason: "dimension_mismatch",
    });
    expect(
      checkRolePolicy("square_original", 8192, 8192, "image/jpeg"),
    ).toEqual({ ok: false, reason: "pixel_limit_exceeded" });
  });

  it("declares the contract constants", () => {
    expect(MAX_ARTIFACT_BYTES).toBe(10_485_760);
    expect(MAX_ARTIFACT_PIXELS).toBe(16_777_216);
    expect(ROLE_POLICY.square_original.width).toBe(1024);
    expect(ROLE_POLICY.square_prepared.height).toBe(1152);
    expect(ROLE_POLICY.vertical.format).toBe("9:16");
  });
});

describe("identity", () => {
  it("accepts valid identities and rejects malformed UUIDs/roles", () => {
    const result = validateArtifactIdentity(identity("square_prepared"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.identity).toEqual(identity("square_prepared"));
    }

    expect(validateArtifactIdentity(null)).toEqual({
      ok: false,
      reason: "invalid_input",
    });
    expect(
      validateArtifactIdentity({ ...identity("square_original"), storeId: "nope" }),
    ).toEqual({ ok: false, reason: "invalid_uuid" });
    expect(
      validateArtifactIdentity({ ...identity("square_original"), role: "other" }),
    ).toEqual({ ok: false, reason: "invalid_role" });
  });

  it("rejects any path/bucket key as an identity input", () => {
    for (const key of ["storagePath", "path", "bucket", "storageBucket"]) {
      expect(
        validateArtifactIdentity({ ...identity("vertical"), [key]: "x" }),
      ).toEqual({ ok: false, reason: "path_not_accepted" });
    }
  });

  it("canonicalizes UUIDs to lowercase in identities and paths", () => {
    const upper = {
      storeId: STORE_ID.toUpperCase(),
      campaignId: CAMPAIGN_ID.toUpperCase(),
      operationId: OPERATION_ID.toUpperCase(),
      role: "square_original" as const,
    };
    const validated = validateArtifactIdentity(upper);
    expect(validated.ok).toBe(true);
    if (validated.ok) {
      expect(validated.identity).toEqual(identity("square_original"));
    }

    const upperPath = `${STORE_ID.toUpperCase()}/${CAMPAIGN_ID.toUpperCase()}/${OPERATION_ID.toUpperCase()}/square_original.jpg`;
    expect(compositionArtifactStoragePath(upper)).toBe(
      compositionArtifactStoragePath(identity("square_original")),
    );
    expect(parseCompositionArtifactPath(upperPath)).toEqual(
      identity("square_original"),
    );
  });

  it("validates UUIDs case-insensitively and rejects malformed values", () => {
    expect(isArtifactUuid(STORE_ID.toUpperCase())).toBe(true);
    expect(isArtifactUuid("not-a-uuid")).toBe(false);
    expect(isArtifactUuid(42)).toBe(false);
  });

  it("validates owner/system authorization contexts", () => {
    expect(validateAuthorizationContext({ kind: "system" })).toEqual({
      ok: true,
      authorization: { kind: "system" },
    });
    expect(
      validateAuthorizationContext({ kind: "owner", userId: "user-1" }),
    ).toEqual({
      ok: true,
      authorization: { kind: "owner", userId: "user-1" },
    });
    expect(validateAuthorizationContext(null)).toEqual({
      ok: false,
      reason: "authorization_missing",
    });
    expect(validateAuthorizationContext({ kind: "owner", userId: "" })).toEqual({
      ok: false,
      reason: "authorization_invalid",
    });
    expect(validateAuthorizationContext({ kind: "other" })).toEqual({
      ok: false,
      reason: "authorization_invalid",
    });
  });

  it("checks the campaign-store binding", () => {
    expect(checkCampaignStoreBinding(STORE_ID, STORE_ID)).toEqual({ ok: true });
    expect(checkCampaignStoreBinding(STORE_ID, CAMPAIGN_ID)).toEqual({
      ok: false,
      reason: "store_mismatch",
    });
  });
});

describe("purity", () => {
  it("pure modules do not import server runtime, sharp or Supabase", () => {
    const root = path.resolve(process.cwd(), "src", "lib", "campaign", "composition-artifacts");
    const pureFiles = ["types.ts", "artifact-path.ts", "role-policy.ts", "identity.ts"];

    for (const file of pureFiles) {
      const source = readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(
        /(?:import|from)\s+["']server-only["']/,
      );
      expect(source).not.toMatch(/(?:import|from)\s+["']sharp["']/);
      expect(source).not.toMatch(/(?:import|from)\s+["']@supabase/);
      expect(source).not.toMatch(
        /(?:import|from)\s+["']@\/lib\/supabase\/server["']/,
      );
    }
  });
});
