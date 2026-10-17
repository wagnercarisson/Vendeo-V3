import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import { ImagePairPricingService } from "../image-pair-pricing";
import { ELIGIBLE_IMAGE_MODELS, ELIGIBLE_IMAGE_QUALITIES } from "@/lib/ai/image-model-pair";
import {
  assertLocalArtifacts, buildPricingSql, MISSING_PRICING, outputTokens,
} from "../../../../scripts/f56-2b2c/complete-homolog-image-pricing.mjs";

const pairs = ELIGIBLE_IMAGE_MODELS.flatMap((model) => ELIGIBLE_IMAGE_QUALITIES.map((quality) => ({ model, quality })));
const expectedRows = [
  { model: "gpt-image-2", quality: "low", image_unit_usd: 0.042 },
  { model: "gpt-image-2", quality: "medium", image_unit_usd: 0.136 },
  ...MISSING_PRICING.map((p) => ({ model: p.model, quality: p.quality, image_unit_usd: p.estimatedUsd })),
];
// Opt-in read-only DB proof: feeds actual persisted facts into the real service.
// The Supabase transport remains an adapter; this is not browser/provider E2E.
const liveProof = process.env.VENDEO_HOMOLOG_PRICING_PROOF === "1";
function readRows() {
  if (!liveProof) return expectedRows;
  assertLocalArtifacts(
    readFileSync("G:/Vendeo-Homolog/supabase/config.toml", "utf8"),
    readFileSync(".env.local", "utf8"),
  );
  const json = execFileSync("docker", ["exec", "supabase_db_vendeo-homolog", "psql", "-U", "postgres", "-d", "postgres", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-c",
    "SELECT json_agg(t ORDER BY model,quality) FROM (SELECT model,quality,image_unit_usd FROM public.ai_model_pricing WHERE provider='openai' AND model IN ('gpt-image-2','gpt-image-2.5-flare','gpt-image-2.5-sunburst') AND quality IS NOT NULL AND effective_until IS NULL) t;",
  ], { encoding: "utf8" });
  return JSON.parse(json) as typeof expectedRows;
}
const rows = readRows();

// Real pricing service, only the database transport is simulated. No provider.
function clientForRows() {
  return {
    from: () => ({ select: () => {
      const filters: Record<string, unknown> = {};
      const builder = {
        eq(key: string, value: unknown) { filters[key] = value; return builder; },
        is(key: string, value: unknown) { filters[key] = value; return builder; },
        async maybeSingle() {
          const row = rows.find((r) => r.model === filters.model && r.quality === filters.quality);
          return { error: null, data: row ? { ...row, provider: "openai", id: `${row.model}-${row.quality}` } : null };
        },
      };
      return builder;
    } }),
  };
}

describe("Homolog six-pair readiness (database transport simulated)", () => {
  it("six pricing facts match the intended local configuration exactly", () => {
    expect(rows).toHaveLength(6);
    expect(rows).toEqual(expect.arrayContaining(expectedRows));
  });
  for (const primary of pairs) for (const fallback of pairs) {
    it(`${primary.model}/${primary.quality} + ${fallback.model}/${fallback.quality} resolves complete and exact estimates`, async () => {
      const service = new ImagePairPricingService(clientForRows() as never);
      const config = { primary, fallback };
      expect((await service.assertExecutable(config)).pricingCoverage).toBe("complete");
      const cost = await service.resolveCost(config);
      expect(cost.primary.costUsd).toBe(rows.find((r) => r.model === primary.model && r.quality === primary.quality)?.image_unit_usd);
      expect(cost.fallback.costUsd).toBe(rows.find((r) => r.model === fallback.model && r.quality === fallback.quality)?.image_unit_usd);
    });
  }

  it("reproduces official 2.5 calculator and explicitly provisions input, not a fixed tariff", () => {
    expect(outputTokens("low")).toBe(196);
    expect(outputTokens("medium")).toBe(439);
    expect(() => outputTokens("high")).toThrow("unsupported_quality");
    for (const row of MISSING_PRICING) {
      expect(row.estimatedUsd).toBeGreaterThanOrEqual(row.outputUsd + 0.03);
      expect(row.estimatedUsd).toBe(row.quality === "low" ? 0.036 : 0.044);
    }
  });

  const config = 'project_id = "vendeo-homolog"';
  const env = 'NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:57781"\nVENDEO_GENERATION_PAUSED=true';
  it("requires real local project, exact API and pause", () => {
    expect(() => assertLocalArtifacts(config, env)).not.toThrow();
    expect(() => assertLocalArtifacts('project_id="other"', env)).toThrow("wrong_project");
    expect(() => assertLocalArtifacts(config, env.replace("127.0.0.1", "remote.supabase.co"))).toThrow("wrong_api_destination");
    expect(() => assertLocalArtifacts(config, env.replace("57781", "56321"))).toThrow("wrong_api_destination");
    expect(() => assertLocalArtifacts(config, env.replace("true", "false"))).toThrow("generation_not_paused");
  });
  it("defaults to rollback, uses versioned admin RPC only for absent prices and never changes active pair", () => {
    const sql = buildPricingSql();
    expect(sql.trim()).toMatch(/ROLLBACK;$/);
    expect(buildPricingSql(true).trim()).toMatch(/COMMIT;$/);
    expect(sql).toContain("public.admin_set_ai_model_price(");
    expect(sql).toContain("protected_state_changed");
    expect(sql).toContain("six_pair_coverage_incomplete");
    expect(sql).not.toMatch(/UPDATE public\.(image_model_pair_config|feature_flags|product_1_1_pilot_spend_state)/);
  });
  it("preparation script cannot call a paid provider or change env", () => {
    const script = readFileSync("scripts/f56-2b2c/complete-homolog-image-pricing.mjs", "utf8");
    expect(script).not.toMatch(/fetch\(|writeFile|OPENAI_API_KEY|api\.openai\.com/);
  });
});
