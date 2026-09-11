// @vitest-environment node
// F37.2 (§17): persistência pai/filha + RPCs por fonte.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const { mockFrom, mockRpc } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseAdmin: {
    from: mockFrom,
    rpc: mockRpc,
    storage: { from: vi.fn() },
  },
  createServerClient: vi.fn(),
}));

import {
  getCorrectionReport,
  listCorrectionSubmissions,
  completeCorrectionAnalysis,
  markReportReviewedBySupport,
} from "@/lib/campaign/correction-reports";

const M1 = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260906000001_f37_2_create_campaign_correction_tables.sql"
  ),
  "utf8"
);
const M2 = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260906000002_f37_2_correction_flows.sql"
  ),
  "utf8"
);

type ChainResult = { data?: unknown; error?: unknown };

function makeBuilder(result: ChainResult) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.in = vi.fn(self);
  builder.update = vi.fn(self);
  builder.insert = vi.fn(self);
  builder.order = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.single = vi.fn(() => Promise.resolve(result));
  return builder;
}

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("F37.2 §17 — persistência pai/filha", () => {
  it("getCorrectionReport lê o pai por campaign_id", async () => {
    const report = { id: "r1", campaign_id: "c1", status: "open" };
    const builder = makeBuilder({ data: report, error: null });
    mockFrom.mockReturnValue(builder);

    const result = await getCorrectionReport("c1");

    expect(mockFrom).toHaveBeenCalledWith("campaign_correction_reports");
    expect(builder.eq).toHaveBeenCalledWith("campaign_id", "c1");
    expect(result).toEqual(report);
  });

  it("getCorrectionReport lança em erro", async () => {
    mockFrom.mockReturnValue(makeBuilder({ data: null, error: { message: "boom" } }));
    await expect(getCorrectionReport("c1")).rejects.toThrow("boom");
  });

  it("listCorrectionSubmissions ordena por attempt_number", async () => {
    const builder = makeBuilder({
      data: [{ attempt_number: 1 }, { attempt_number: 2 }],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const rows = await listCorrectionSubmissions("r1");

    expect(mockFrom).toHaveBeenCalledWith("campaign_correction_submissions");
    expect(builder.eq).toHaveBeenCalledWith("report_id", "r1");
    expect(builder.order).toHaveBeenCalledWith("attempt_number", { ascending: true });
    expect(rows).toHaveLength(2);
  });

  it("completeCorrectionAnalysis delega à RPC (nunca UPDATE TS direto)", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await completeCorrectionAnalysis({
      reportId: "r1",
      submissionId: "s1",
      attemptNumber: 2,
      analysisState: "eligible",
      category: "truncated_element",
      normalizedInstruction: "Corrija o corte.",
    });

    expect(mockRpc).toHaveBeenCalledWith("complete_campaign_correction_analysis", {
      p_report_id: "r1",
      p_submission_id: "s1",
      p_attempt_number: 2,
      p_analysis_state: "eligible",
      p_category: "truncated_element",
      p_normalized_instruction: "Corrija o corte.",
    });
  });

  it("completeCorrectionAnalysis lança em erro da RPC", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "submission_stale" } });
    await expect(
      completeCorrectionAnalysis({
        reportId: "r1",
        submissionId: "s1",
        attemptNumber: 1,
        analysisState: "unclear",
      })
    ).rejects.toThrow("submission_stale");
  });

  it("markReportReviewedBySupport atualiza apenas campos ortogonais", async () => {
    const builder = makeBuilder({ data: null, error: null });
    mockFrom.mockReturnValue(builder);

    await markReportReviewedBySupport("r1", "admin-1");

    expect(builder.update).toHaveBeenCalledTimes(1);
    const payload = builder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual([
      "reviewed_by_support_at",
      "reviewed_by_support_user",
    ]);
    expect(payload.reviewed_by_support_user).toBe("admin-1");
    expect(builder.eq).toHaveBeenCalledWith("id", "r1");
  });
});

describe("F37.2 §17 — RPCs por fonte", () => {
  it("filha sem campaign_id + UNIQUE(report_id, attempt_number)", () => {
    const start = M1.indexOf(
      "CREATE TABLE IF NOT EXISTS public.campaign_correction_submissions"
    );
    expect(start).toBeGreaterThanOrEqual(0);
    const block = M1.slice(start, M1.indexOf(");", start));
    expect(block).not.toMatch(/\bcampaign_id\b/);
    expect(M1).toContain("UNIQUE (report_id, attempt_number)");
  });

  it("begin trava candidata → campanha → relato", () => {
    const begin = extractFunction(M2, "begin_campaign_correction_submission");
    const iCandidate = begin.indexOf("FROM public.campaign_art_versions");
    const iCampaign = begin.indexOf("FROM public.campaigns");
    const iReport = begin.indexOf("FROM public.campaign_correction_reports");
    expect(iCandidate).toBeGreaterThanOrEqual(0);
    expect(iCampaign).toBeGreaterThan(iCandidate);
    expect(iReport).toBeGreaterThan(iCampaign);
  });

  it("complete_analysis valida semântica + lease + vigência", () => {
    const complete = extractFunction(M2, "complete_campaign_correction_analysis");
    expect(complete).toContain("invalid_analysis_state");
    expect(complete).toContain("eligible_requires_category_and_instruction");
    expect(complete).toContain("non_eligible_must_not_have_generation_fields");
    expect(complete).toContain("analysis_expires_at >= now()");
    expect(complete).toContain("MAX(attempt_number)");
  });

  it("fail mantém rejection_count e grava failed_no_v2", () => {
    const fail = extractFunction(M2, "fail_campaign_correction_v2");
    expect(fail).toContain("status = 'failed_no_v2'");
    expect(fail).toContain("correction_in_progress = false");
    expect(fail).not.toMatch(/SET\s+rejection_count/);
  });

  it("recover usa p_stale_before com default 330s (sem env)", () => {
    const recover = extractFunction(M2, "recover_campaign_correction_generation");
    expect(recover).toContain("p_stale_before timestamptz DEFAULT NULL");
    expect(recover).toContain("COALESCE(p_stale_before, now() - interval '330 seconds')");
  });

  it("consume valida a submissão mais recente por attempt_number", () => {
    const consume = extractFunction(M2, "consume_campaign_correction_opportunity");
    expect(consume).toContain("MAX(attempt_number)");
    expect(consume).toContain("submission_stale");
    expect(consume).toContain("submission_not_eligible");
  });
});
