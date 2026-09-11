// @vitest-environment node
// F37.2 (tasks.md §14): consumo/serialização/recuperação — RPCs validadas por
// fonte (leitura da migration) + comportamento do orquestrador/página.
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

const flows = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260906000002_f37_2_correction_flows.sql"
  ),
  "utf8"
);
const service = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "lib",
    "image-generation",
    "services",
    "image-generation-service.ts"
  ),
  "utf8"
);
const correctionReports = readFileSync(
  path.join(process.cwd(), "src", "lib", "campaign", "correction-reports.ts"),
  "utf8"
);
const page = readFileSync(
  path.join(process.cwd(), "src", "app", "(app)", "campanhas", "[id]", "page.tsx"),
  "utf8"
);
const approveRoute = readFileSync(
  path.join(
    process.cwd(),
    "src",
    "app",
    "api",
    "campaign",
    "[id]",
    "approve",
    "route.ts"
  ),
  "utf8"
);

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}

const begin = extractFunction(flows, "begin_campaign_correction_submission");
const consume = extractFunction(flows, "consume_campaign_correction_opportunity");
const completeV2 = extractFunction(flows, "complete_campaign_correction_v2");
const failV2 = extractFunction(flows, "fail_campaign_correction_v2");
const recover = extractFunction(flows, "recover_campaign_correction_generation");
const approveCandidate = extractFunction(flows, "approve_campaign_candidate");

describe("F37.2 §14 — consumo/serialização/recuperação", () => {
  it("14.1 — falha pré-provider NÃO consome (hook fire-once antes do provider)", () => {
    expect(service).toContain("onBeforeImageProviderCall");
    expect(service).toContain("attempt === 0");
    expect(service).toContain("hookCalled");
    // O orquestrador só marca consumo quando o hook rodou.
    expect(correctionReports).toContain("consumptionStarted");
    expect(correctionReports).toMatch(/if \(!consumptionStarted\)/);
    expect(correctionReports).toContain("preProvider: true");
  });

  it("14.2 — consume valida pendência/relato/candidata/submissão e grava atomicamente", () => {
    expect(consume).toContain("v_status <> 'ready'");
    expect(consume).toContain("v_approval_status <> 'pending_approval'");
    expect(consume).toContain("v_rejection_count <> 0");
    expect(consume).toContain("report_campaign_mismatch");
    expect(consume).toContain("report_not_open");
    expect(consume).toContain("version_mismatch");
    expect(consume).toContain("submission_not_eligible");
    expect(consume).toContain("submission_stale");
    expect(consume).toContain("SET rejection_count = 1");
    expect(consume).toContain("correction_in_progress = true");
    expect(consume).toContain("status = 'generation_started'");
    expect(consume).toContain("generation_started_at = now()");
  });

  it("14.3 — fail mantém rejection_count=1, libera correction_in_progress, failed_no_v2", () => {
    expect(failV2).toContain("correction_in_progress = false");
    expect(failV2).toContain("status = 'failed_no_v2'");
    expect(failV2).toContain("report_not_generation_started");
    expect(failV2).not.toMatch(/SET\s+rejection_count/);
  });

  it("14.4 — fail sem consumo → report_not_generation_started (nada altera)", () => {
    expect(failV2).toMatch(/v_report_status <> 'generation_started'/);
    expect(failV2).toContain("report_not_generation_started");
  });

  it("14.5 — conclusão da v2 NÃO incrementa rejection_count", () => {
    expect(completeV2).toContain("v_rejection_count <> 1");
    expect(completeV2).not.toMatch(/SET\s+rejection_count/);
    expect(completeV2).toContain("asset_status = 'superseded'");
  });

  it("14.6 — segunda tentativa após consumo → 409 independentemente da janela", () => {
    expect(begin).toMatch(
      /v_report_status IN \('generation_started','v2_generated','failed_no_v2'\)/
    );
    expect(begin).toContain("already_consumed");
  });

  it("14.7 — serialização aprovar × consumir (409 em ambos os vencedores)", () => {
    // consumo marca correction_in_progress=true
    expect(consume).toContain("correction_in_progress = true");
    // aprovação protegida recusa com correction_in_progress
    expect(approveCandidate).toMatch(
      /IF v_cip THEN\s*RAISE EXCEPTION 'correction_in_progress'/
    );
    // consumo valida pendência (aprovação venceu → campaign_not_pending)
    expect(consume).toContain("campaign_not_pending");
  });

  it("14.8 — approve_campaign_candidate invoca a RPC F37.1 intacta (locks candidata → campanha)", () => {
    expect(approveCandidate).toContain("public.approve_campaign_art_version(");
    expect(approveCandidate).toContain("FROM public.campaign_art_versions");
    expect(approveCandidate).toContain("FOR UPDATE");
    expect(flows).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.approve_campaign_art_version/
    );
  });

  it("14.9 — recuperação preguiçosa (teto 330s, failed_no_v2, rejection_count=1, reload)", () => {
    expect(recover).toContain("COALESCE(p_stale_before, now() - interval '330 seconds')");
    // O teto é aplicado pela guarda inversa (>= threshold → no-op); logo abaixo
    // da guarda o consumo preso é revertido.
    expect(recover).toMatch(/v_generation_started_at >= v_threshold/);
    expect(recover).toContain("status = 'failed_no_v2'");
    expect(recover).toContain("correction_in_progress = false");
    expect(recover).toContain("'recovered', true");
    expect(recover).toContain("'recovered', false");
    expect(recover).not.toMatch(/SET\s+rejection_count/);

    // Callers: página recarrega quando recovered; rota approve dispara recover.
    expect(page).toContain("recover_campaign_correction_generation");
    expect(page).toContain("recovered");
    expect(page).toContain("getCampaignForDisplay");
    expect(approveRoute).toContain("recover_campaign_correction_generation");
  });
});
