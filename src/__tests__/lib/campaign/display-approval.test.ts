// @vitest-environment node
// F37.1 (tasks.md 13.1-13.7): testes dos estados de aprovação — funções puras
// de display.ts, sem banco. Fixtures locais seguem o padrão de display.test.ts.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  CampaignArtVersion,
  CampaignRecord,
} from "@/lib/campaign/types";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: vi.fn(),
  supabaseAdmin: {
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/lib/image-generation/config", () => ({
  IMAGE_GENERATION_GLOBAL_TIMEOUT_MS: 300_000,
}));

import {
  computeApprovalState,
  isDeliveryReleased,
} from "@/lib/campaign/display";

function campaignReady(overrides: Partial<CampaignRecord> = {}): CampaignRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440000",
    store_id: "store-123",
    status: "ready",
    product_name: "Produto Teste",
    input_snapshot: null,
    identity_snapshot: null,
    generation_metadata: null,
    render_snapshot: null,
    publication_copy_snapshot: { caption: "Texto", hashtags: ["#tag"], cta_post: "Compre" },
    publication_copy_current: null,
    storage_path: "store-123/camp.jpg",
    error_message: null,
    approval_status: "pending_approval",
    rejection_count: 0,
    approved_version_id: null,
    approved_at: null,
    created_at: "2026-09-01T10:00:00Z",
    updated_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

function versionV1(overrides: Partial<CampaignArtVersion> = {}): CampaignArtVersion {
  return {
    id: "version-1",
    campaign_id: "550e8400-e29b-41d4-a716-446655440000",
    version_number: 1,
    status: "pending",
    storage_path: "store-123/camp.jpg",
    asset_status: "active",
    asset_deleted_at: null,
    brief_snapshot: {},
    render_snapshot: null,
    generation_metadata: null,
    rejection_reason: null,
    correction_in_progress: false,
    created_at: "2026-09-01T10:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ApprovalDisplayState", () => {
  it("13.1 — flag off → not_enabled (comportamento atual preservado)", () => {
    expect(computeApprovalState(campaignReady(), [], false)).toEqual({
      status: "not_enabled",
    });
  });

  it("13.2 — flag on + zero versões → legacy (campanha antiga entregue)", () => {
    expect(computeApprovalState(campaignReady(), [], true)).toEqual({
      status: "legacy",
    });
  });

  it("13.3 — flag on + versões + sem aprovada → pending", () => {
    expect(computeApprovalState(campaignReady(), [versionV1()], true)).toEqual({
      status: "pending",
    });
  });

  it("13.4 — approved_version_id → approved + approvedAt", () => {
    const state = computeApprovalState(
      campaignReady({
        approved_version_id: "version-1",
        approved_at: "2026-09-01T10:00:00Z",
        approval_status: "approved",
      }),
      [versionV1({ status: "approved" })],
      true,
    );
    expect(state).toEqual({
      status: "approved",
      approvedAt: "2026-09-01T10:00:00Z",
    });
  });

  it("13.5 — isDeliveryReleased true para not_enabled/legacy/approved; false para pending/regenerating", () => {
    expect(isDeliveryReleased({ status: "not_enabled" })).toBe(true);
    expect(isDeliveryReleased({ status: "legacy" })).toBe(true);
    expect(
      isDeliveryReleased({ status: "approved", approvedAt: "2026-09-01T10:00:00Z" }),
    ).toBe(true);
    expect(isDeliveryReleased({ status: "pending" })).toBe(false);
    expect(isDeliveryReleased({ status: "regenerating" })).toBe(false);
  });

  it("13.6 — índice único parcial 1-approved verificado por fonte na migration", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase",
      "migrations",
      "20260901000001_f37_1_create_campaign_art_versions.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("campaign_art_versions_one_approved_per_campaign");
    expect(sql).toContain("WHERE status = 'approved'");
  });

  it("13.7 — contrato: correction_in_progress → regenerating e campaign.status permanece ready", () => {
    const campaign = campaignReady();
    const state = computeApprovalState(
      campaign,
      [versionV1({ correction_in_progress: true })],
      true,
    );
    expect(state).toEqual({ status: "regenerating" });
    expect(campaign.status).toBe("ready");
  });
});
