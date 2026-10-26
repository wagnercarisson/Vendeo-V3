import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20261026191931_quick_openai_pricing_sync.sql",
  ),
  "utf8",
);

describe("migration 20261026191931 — contrato de pricing sync", () => {
  it("adiciona dimensões explícitas de entrada/cache de imagem", () => {
    expect(MIGRATION).toContain("image_input_token_usd_per_1m");
    expect(MIGRATION).toContain("image_cached_input_token_usd_per_1m");
    expect(MIGRATION).toContain("chk_ai_model_pricing_at_least_one_price");
  });

  it("cria tabela backend-only e única tentativa running", () => {
    expect(MIGRATION).toContain("CREATE TABLE IF NOT EXISTS public.pricing_sync_attempts");
    expect(MIGRATION).toMatch(
      /CREATE UNIQUE INDEX IF NOT EXISTS uq_pricing_sync_attempts_running[\s\S]*WHERE status = 'running'/,
    );
    expect(MIGRATION).toContain("ENABLE ROW LEVEL SECURITY");
    expect(MIGRATION).toContain("FROM PUBLIC, anon, authenticated");
  });

  it("apply é atômico, bloqueia a linha e marca sucesso na mesma função", () => {
    expect(MIGRATION).toContain("CREATE OR REPLACE FUNCTION public.pricing_sync_apply");
    expect(MIGRATION).toMatch(/pricing_sync_apply[\s\S]*FOR UPDATE/);
    expect(MIGRATION).toMatch(
      /pricing_sync_apply[\s\S]*UPDATE public\.pricing_sync_attempts[\s\S]*status = 'success'/,
    );
    expect(MIGRATION).toMatch(/pricing_sync_apply[\s\S]*RETURN jsonb_build_object\([\s\S]*'success', true/);
  });

  it("preserva image_unit_usd e os IDs históricos ao versionar", () => {
    expect(MIGRATION).toContain("v_cur.image_unit_usd");
    expect(MIGRATION).toContain("SET effective_until = now()");
    // A linha antiga só é fechada; nunca é apagada nem tem ID alterado.
    expect(MIGRATION).not.toMatch(/pricing_sync_apply[\s\S]*DELETE FROM public\.ai_model_pricing/);
  });

  it("não cria usuário fictício para o cron", () => {
    const syncInsert = MIGRATION.match(
      /INSERT INTO public\.ai_model_pricing \([\s\S]*?RETURNING id INTO v_new_id;/g,
    );
    expect(syncInsert?.length).toBeGreaterThan(0);
    expect(MIGRATION).toContain("NULL\n      )\n      RETURNING id INTO v_new_id;");
  });

  it("start recupera execução interrompida sem apagar histórico", () => {
    expect(MIGRATION).toMatch(
      /UPDATE public\.pricing_sync_attempts[\s\S]*failure_code = 'interrupted'/,
    );
    expect(MIGRATION).not.toMatch(/DELETE FROM public\.pricing_sync_attempts/);
  });

  it("RPC manual existente preserva as novas dimensões", () => {
    expect(MIGRATION).toContain("v_prev_image_input");
    expect(MIGRATION).toContain("v_prev_image_cached");
    expect(MIGRATION).toMatch(
      /admin_set_ai_model_price[\s\S]*image_input_token_usd_per_1m, image_cached_input_token_usd_per_1m/,
    );
  });
});
