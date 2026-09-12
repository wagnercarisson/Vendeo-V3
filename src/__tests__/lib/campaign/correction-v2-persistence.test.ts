// @vitest-environment node
// F37.2 (tasks.md §15): única v2, geração e persistência (15.1-15.9) — validado
// por fonte (migration/arquivos) + paridade SQL×TS da allowlist de categoria.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

// F46-03: o CorrectionIntentService importa `@/lib/ai` (gateway default) →
// cost-estimator → supabase/server. Sem env, o módulo lança na importação.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon-key";
  process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";
});

vi.mock("@/lib/ai-cost", () => ({
  AiCostTracker: class {
    record() {}
  },
  resolveAiCost: vi.fn(),
}));
vi.mock("@/lib/text-provider/factory", () => ({
  createTextProvider: vi.fn(() => ({ name: "mock", generateText: vi.fn() })),
}));

import { CORRECTION_ELIGIBLE_CATEGORIES } from "@/lib/campaign/correction-intent-service";

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
const M4 = readFileSync(
  path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260906000003_f37_2_generation_events_type.sql"
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
const intentService = readFileSync(
  path.join(process.cwd(), "src", "lib", "campaign", "correction-intent-service.ts"),
  "utf8"
);
const client = readFileSync(
  path.join(process.cwd(), "src", "app", "(app)", "campanhas", "[id]", "client.tsx"),
  "utf8"
);
const types = readFileSync(
  path.join(process.cwd(), "src", "lib", "visual-signature", "types.ts"),
  "utf8"
);

function extractFunction(sql: string, name: string): string {
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

const completeV2 = extractFunction(M2, "complete_campaign_correction_v2");
const approveCandidate = extractFunction(M2, "approve_campaign_candidate");
const completeAnalysis = extractFunction(M2, "complete_campaign_correction_analysis");

describe("F37.2 §15 — única v2 / geração / persistência", () => {
  it("15.1 — sem v3 e sem galeria/retorno à v1", () => {
    // A conclusão sempre insere a v2; nenhum caminho produz v3.
    expect(completeV2).toContain("p_campaign_id, 2, 'pending', 'active'");
    expect(M2).not.toMatch(/version_number\s*=\s*3/);
    // UI não oferece galeria nem recuperação da v1.
    expect(client).not.toContain("listArtVersions");
    expect(client).not.toContain("galeria");
  });

  it("15.2 — brief imutável: sem snapshot do cliente e sem candidateArtDataUrl", () => {
    expect(completeV2).not.toContain("p_brief_snapshot");
    expect(completeV2).toContain("v_v1_brief");
    expect(completeV2).toContain("brief_snapshot");
    // A v1 nunca é usada como referência (não é passada como valor/arg).
    expect(correctionReports).not.toMatch(/candidateArtDataUrl\s*[:=]/);
    expect(correctionReports).not.toMatch(/candidateArtDataUrl\s*[,)]/);
  });

  it("15.3 — os 4 .md do diretor permanecem intocados (bloco só em runtime)", () => {
    const mdFiles = readdirSync(path.join(process.cwd(), "prompts")).filter((f) =>
      f.startsWith("campaign-image-director")
    );
    expect(mdFiles).toHaveLength(4);
    for (const file of mdFiles) {
      const content = readFileSync(path.join(process.cwd(), "prompts", file), "utf8");
      expect(content).not.toContain("Ajuste de Não Conformidade");
      expect(content).not.toContain("INSTRUÇÃO_DE_CORREÇÃO");
    }
    // O bloco é montado em runtime no serviço.
    expect(service).toContain("buildNonConformityBlock");
    expect(service).toContain("INSTRUÇÃO_DE_CORREÇÃO");
  });

  it("15.4 — revisor intocado, input_validation skipped, eventos no mesmo run, sem crédito", () => {
    expect(service).toContain("this.imageReview.review(");
    expect(service).toContain("brief_review_confirmed");
    expect(correctionReports).toContain("campaign_delivery");
    expect(correctionReports).toContain("operationRunId");
    expect(correctionReports).not.toContain("reserveCredit");
    expect(correctionReports).not.toContain("credit_transactions");
    expect(correctionReports).not.toContain("operation_key");
  });

  it("15.5 — v1 preservada (superseded com path) e não aprovável após a v2", () => {
    expect(M1).toContain("asset_status IN ('active','discarded','superseded')");
    expect(completeV2).toContain("asset_status = 'superseded'");
    // A demissão NÃO zera o storage_path da v1.
    expect(completeV2).not.toMatch(/storage_path\s*=\s*NULL/);
    // v1 superseded/não active → version_not_active (409).
    expect(approveCandidate).toContain("v_asset_status <> 'active'");
    expect(approveCandidate).toContain("version_not_active");
  });

  it("15.6 — contrato fechado da conclusão (sem p_mime_type, sem snapshot)", () => {
    expect(completeV2).toContain("p_campaign_id uuid");
    expect(completeV2).toContain("p_report_id uuid");
    expect(completeV2).toContain("p_submission_id uuid");
    expect(completeV2).toContain("p_storage_path text");
    expect(completeV2).toContain("p_generation_metadata jsonb");
    expect(completeV2).toContain("p_render_snapshot jsonb");
    expect(completeV2).not.toContain("p_mime_type");
    expect(completeV2).not.toContain("p_brief_snapshot");

    expect(completeV2).toContain("v_rejection_count <> 1");
    expect(completeV2).toContain("MAX(attempt_number)");
    expect(completeV2).toContain("version_number = 2");
    expect(completeV2).toContain("version_mismatch");
  });

  it("15.7 — evento campaign_correction_analysis (CHECK + union) sem crédito", () => {
    expect(M4).toContain("campaign_correction_analysis");
    expect(types).toContain("campaign_correction_analysis");
    expect(intentService).toContain("campaign_correction_analysis");
    // F46-03 (D9): a telemetria/status passa a vir do envelope do gateway — o
    // serviço apenas delega a capacidade (não grava evento manualmente).
    expect(intentService).toContain("invoke");
    expect(intentService).not.toContain("AiCostTracker");
    expect(correctionReports).not.toContain("reserveCredit");
    expect(correctionReports).not.toContain("operation_key");
  });

  it("15.8 — aprovação não espelhada + decisão corrente por attempt_number", () => {
    const reportsTable = M1.slice(
      M1.indexOf("CREATE TABLE IF NOT EXISTS public.campaign_correction_reports"),
      M1.indexOf(");", M1.indexOf("CREATE TABLE IF NOT EXISTS public.campaign_correction_reports"))
    );
    expect(reportsTable).not.toContain("approved_version_id");
    expect(reportsTable).not.toContain("approved_at");
    expect(correctionReports).toContain("approved_version_id");
    expect(correctionReports).toContain("attempt_number");
  });

  it("15.9 — paridade exata SQL×TS da allowlist de categoria", () => {
    const arrayStart = completeAnalysis.indexOf("v_eligible_categories text[] := ARRAY[");
    expect(arrayStart).toBeGreaterThanOrEqual(0);
    const arrayEnd = completeAnalysis.indexOf("];", arrayStart);
    const sqlCategories = [
      ...completeAnalysis.slice(arrayStart, arrayEnd).matchAll(/'([^']+)'/g),
    ].map((m) => m[1]);

    expect(new Set(sqlCategories)).toEqual(new Set(CORRECTION_ELIGIBLE_CATEGORIES));
    expect(sqlCategories).toHaveLength(7);
  });
});
