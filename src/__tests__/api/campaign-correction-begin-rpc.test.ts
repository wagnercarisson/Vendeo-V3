// @vitest-environment node
// F37.2 (tasks.md §13): lifecycle da tentativa — begin/complete_analysis validados
// POR FONTE (leitura da migration do disco; padrão campaign-approve-route.test.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const M1 = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260906000001_f37_2_create_campaign_correction_tables.sql"
);
const M2 = path.join(
  process.cwd(),
  "supabase",
  "migrations",
  "20260906000002_f37_2_correction_flows.sql"
);

const tables = readFileSync(M1, "utf8");
const flows = readFileSync(M2, "utf8");

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

const begin = extractFunction(flows, "begin_campaign_correction_submission");
const complete = extractFunction(flows, "complete_campaign_correction_analysis");

describe("F37.2 §13 — lifecycle da tentativa (begin/complete_analysis por fonte)", () => {
  it("13.1 — begin trava candidata → campanha → relato (ordem) + UNIQUE(campaign_id)", () => {
    const iCandidate = begin.indexOf("FROM public.campaign_art_versions");
    const iCampaign = begin.indexOf("FROM public.campaigns");
    const iReport = begin.indexOf("FROM public.campaign_correction_reports");

    expect(iCandidate).toBeGreaterThanOrEqual(0);
    expect(iCampaign).toBeGreaterThan(iCandidate);
    expect(iReport).toBeGreaterThan(iCampaign);
    expect(begin).toContain("FOR UPDATE");

    expect(tables).toContain("UNIQUE (campaign_id)");
  });

  it("13.2 — begin valida pendência/candidata/ausência de v2", () => {
    expect(begin).toContain("v_status <> 'ready'");
    expect(begin).toContain("v_approval_status <> 'pending_approval'");
    expect(begin).toContain("v_approved_version_id IS NOT NULL");
    expect(begin).toContain("v_rejection_count <> 0");
    expect(begin).toContain("version_number = 2");
    expect(begin).toContain("campaign_not_pending");
    expect(begin).toContain("already_consumed");
    expect(begin).toContain("no_active_candidate");
  });

  it("13.3 — finaliza analyzing expiradas como analysis_failed", () => {
    expect(begin).toContain("analysis_expires_at < now()");
    expect(begin).toContain("analysis_state = 'analysis_failed'");
    expect(begin).toContain("completed_at = now()");
  });

  it("13.4 — completed_at + janela 30min + analysis_expires_at no nascimento", () => {
    expect(begin).toContain("completed_at");
    expect(begin).toContain("interval '30 minutes'");
    expect(begin).toContain("analysis_expires_at");
    expect(begin).toContain("interval '2 minutes'");
  });

  it("13.5 — teto absoluto 3/30min → rate_limit_exceeded", () => {
    expect(begin).toContain("v_window_count >= 3");
    expect(begin).toContain("rate_limit_exceeded");
  });

  it("13.6 — relato travado antes do MAX(attempt_number)", () => {
    const iReportLock = begin.indexOf("FROM public.campaign_correction_reports");
    const iMax = begin.indexOf("MAX(attempt_number)");
    expect(iReportLock).toBeGreaterThanOrEqual(0);
    expect(iMax).toBeGreaterThan(iReportLock);
  });

  it("13.7 — analyzing válida → analysis_in_progress", () => {
    expect(begin).toContain("analysis_in_progress");
    expect(begin).toContain("analysis_state = 'analyzing'");
  });

  it("13.8 — conclusão condicionada a analyzing + lease + vigência", () => {
    expect(complete).toContain("analysis_state = 'analyzing'");
    expect(complete).toContain("analysis_expires_at >= now()");
    expect(complete).toContain("MAX(attempt_number)");
    expect(complete).toContain("submission_not_analyzing");
    expect(complete).toContain("analysis_lease_expired");
    expect(complete).toContain("submission_stale");
  });

  it("13.9 — validação semântica + CHECKs de tabela (defesa em profundidade)", () => {
    expect(complete).toContain("invalid_analysis_state");
    expect(complete).toContain("eligible_requires_category_and_instruction");
    expect(complete).toContain("non_eligible_must_not_have_generation_fields");

    expect(tables).toContain("chk_correction_submissions_completed_at_final");
    expect(tables).toContain("chk_correction_submissions_eligible_fields");
    expect(tables).toContain("chk_correction_submissions_non_eligible_fields");
  });

  it("13.10 — attempt_number sequencial + UNIQUE(report_id, attempt_number)", () => {
    expect(begin).toMatch(/COALESCE\(MAX\(attempt_number\),\s*0\)\s*\+\s*1/);
    expect(tables).toContain("UNIQUE (report_id, attempt_number)");
    expect(complete).toMatch(
      /attempt_number\s*=\s*\(\s*SELECT MAX\(attempt_number\)/
    );
  });
});
