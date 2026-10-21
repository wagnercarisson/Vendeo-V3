// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrato ESTÁTICO (offline) da migration local-only da F47.1.
// NÃO abre conexão, NÃO aplica migration e NÃO consulta provider.
const MIGRATION_PATH = path.resolve(
  process.cwd(),
  "supabase",
  "migrations",
  "20261021000001_f47_1_visual_signature_model_config.sql",
);

const sql = readFileSync(MIGRATION_PATH, "utf8");

const activeSql = sql
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0)
  .join("\n");

describe("F47.1 — migration visual_signature_model_config (contrato estático)", () => {
  it("é local-only e não contém comando mutável remoto", () => {
    expect(sql).toMatch(/LOCAL-ONLY/);
    expect(sql).toMatch(/REVERT/);
    expect(activeSql).not.toMatch(/db\s+push/i);
    expect(activeSql).not.toMatch(/--linked/i);
    expect(activeSql).not.toMatch(/migration\s+repair/i);
    expect(activeSql).not.toMatch(/\bdrop\s+database\b/i);
    expect(activeSql).not.toMatch(/\btruncate\b/i);
  });

  it("cria a tabela singleton com todas as colunas obrigatórias", () => {
    expect(activeSql).toMatch(
      /CREATE TABLE IF NOT EXISTS public\.visual_signature_model_config/,
    );
    for (const column of [
      "scope",
      "environment_scope",
      "instance_identity",
      "orchestrator_model",
      "image_preset",
      "image_model",
      "image_quality",
      "reasoning_effort",
      "config_version_id",
      "reason",
      "updated_by",
      "updated_at",
      "created_at",
    ]) {
      expect(activeSql).toContain(column);
    }
    expect(activeSql).toMatch(
      /scope\s+TEXT PRIMARY KEY DEFAULT 'visual_signature'/,
    );
    expect(activeSql).toMatch(
      /environment_scope\s+TEXT NOT NULL DEFAULT 'local_validation'/,
    );
    expect(activeSql).toMatch(/config_version_id\s+UUID NOT NULL DEFAULT gen_random_uuid\(\)/);
    expect(activeSql).toMatch(/updated_by\s+UUID REFERENCES auth\.users\(id\)/);
  });

  it("declara todos os CHECKs, incluindo as quatro tuples fechadas", () => {
    for (const constraint of [
      "chk_vs_scope",
      "chk_vs_environment",
      "chk_vs_orchestrator",
      "chk_vs_quality",
      "chk_vs_reasoning",
      "chk_vs_preset_tuple",
    ]) {
      expect(activeSql).toContain(constraint);
    }
    expect(activeSql).toMatch(/orchestrator_model IN \('gpt-5\.5', 'gpt-6-luna'\)/);
    expect(activeSql).toMatch(/image_quality IN \('low', 'medium'\)/);
    expect(activeSql).toMatch(/reasoning_effort = 'low'/);
    expect(activeSql).not.toMatch(/image-2-low/);
    for (const tuple of [
      "flare_low",
      "flare_medium",
      "sunburst_low",
      "sunburst_medium",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]) {
      expect(activeSql).toContain(tuple);
    }
  });

  it("habilita RLS service_role only e não concede a anon/authenticated", () => {
    expect(activeSql).toMatch(
      /ALTER TABLE public\.visual_signature_model_config ENABLE ROW LEVEL SECURITY/,
    );
    expect(activeSql).toMatch(
      /CREATE POLICY "Service role can manage visual signature model config"[\s\S]*?FOR ALL TO service_role/,
    );
    expect(activeSql).toMatch(
      /REVOKE ALL ON TABLE public\.visual_signature_model_config FROM PUBLIC, anon, authenticated/,
    );
    expect(activeSql).toMatch(
      /GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public\.visual_signature_model_config TO service_role/,
    );
    expect(activeSql).not.toMatch(
      /GRANT[^;]+ON TABLE public\.visual_signature_model_config TO (anon|authenticated)/,
    );
    expect(activeSql).not.toMatch(
      /GRANT ALL ON TABLE public\.visual_signature_model_config/,
    );
  });

  it("define as duas RPCs com SECURITY DEFINER e search_path vazio", () => {
    for (const fn of [
      "admin_set_visual_signature_model_config",
      "admin_reset_visual_signature_model_config",
    ]) {
      expect(activeSql).toContain(`FUNCTION public.${fn}`);
      expect(activeSql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}`);
      expect(activeSql).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }

    const setFn = activeSql.slice(
      activeSql.indexOf("admin_set_visual_signature_model_config"),
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
    );
    expect(setFn).toMatch(/SECURITY DEFINER/);
    expect(setFn).toMatch(/SET search_path = ''/);
    expect(setFn).toMatch(/p_actor_id UUID/);
    expect(setFn).toMatch(/p_orchestrator_model TEXT/);
    expect(setFn).toMatch(/p_image_preset TEXT/);
    expect(setFn).toMatch(/p_reasoning_effort TEXT/);
    expect(setFn).toMatch(/p_reason TEXT/);
    expect(setFn).toMatch(/p_operation_id UUID/);
    expect(setFn).toMatch(/p_instance_identity TEXT/);
  });

  it("deriva modelo/qualidade do preset no servidor (nunca aceita do corpo)", () => {
    const setFn = activeSql.slice(
      activeSql.indexOf("admin_set_visual_signature_model_config"),
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
    );
    expect(setFn).toMatch(/CASE p_image_preset/);
    expect(setFn).toMatch(
      /WHEN 'flare_low' THEN\s+v_image_model := 'gpt-image-2\.5-flare'; v_image_quality := 'low';/,
    );
    expect(setFn).toMatch(
      /WHEN 'sunburst_medium' THEN\s+v_image_model := 'gpt-image-2\.5-sunburst'; v_image_quality := 'medium';/,
    );
    expect(setFn).toMatch(/ELSE\s+RAISE EXCEPTION 'invalid_preset';/);
  });

  it("valida ator, motivo, operation_id, instância, reasoning e catálogo", () => {
    const setFn = activeSql.slice(
      activeSql.indexOf("admin_set_visual_signature_model_config"),
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
    );
    for (const code of [
      "missing_actor_id",
      "missing_reason",
      "missing_operation_id",
      "missing_instance_identity",
      "invalid_reasoning",
      "invalid_orchestrator",
      "orchestrator_not_in_catalog",
    ]) {
      expect(setFn).toContain(code);
    }
    expect(setFn).toMatch(
      /capability = 'visual_signature_image'[\s\S]*?model = p_orchestrator_model[\s\S]*?protocol = 'responses'[\s\S]*?status = 'active'/,
    );
  });

  it("sincroniza set/reset antes da idempotência e implementa conflito explícito", () => {
    const setFn = activeSql.slice(
      activeSql.indexOf("admin_set_visual_signature_model_config"),
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
    );
    const resetFn = activeSql.slice(
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
      activeSql.indexOf("ALTER TABLE public.admin_audit_log DROP CONSTRAINT"),
    );

    // A trava de transação deve preceder a consulta por operation_id em AMBAS
    // as RPCs. Sem isso, concorrentes com o mesmo ID podem colidir no índice
    // único da auditoria em vez de retornar replay/conflito tipado.
    expect(setFn).toMatch(
      /pg_advisory_xact_lock\([\s\S]*?hashtext\('f47_1_visual_signature_model_config'\)[\s\S]*?\)[\s\S]*?WHERE operation_id = p_operation_id/,
    );
    expect(resetFn).toMatch(
      /pg_advisory_xact_lock\([\s\S]*?hashtext\('f47_1_visual_signature_model_config'\)[\s\S]*?\)[\s\S]*?WHERE operation_id = p_operation_id/,
    );

    expect(setFn).toContain("operation_id_conflict");
    expect(setFn).toMatch(/'idempotent', true/);
    expect(setFn).toMatch(/'idempotent', false/);
    expect(activeSql).toContain("operation_id_conflict");
    expect(activeSql).toMatch(/'operation', 'reset'/);
    expect(activeSql).toMatch(/'removed', \(v_deleted > 0\)/);
  });

  it("audita set/reset na mesma transação com action, target_type e metadata", () => {
    expect(activeSql).toMatch(
      /INSERT INTO public\.admin_audit_log \(\s*actor_id, action, target_type, target_id, reason, operation_id, metadata\s*\)/,
    );
    expect(activeSql).toContain("'visual_signature_model_config_update'");
    expect(activeSql).toContain("'visual_signature_model_config_reset'");
    expect(activeSql).toContain("'visual_signature_model_config'");
    const setFn = activeSql.slice(
      activeSql.indexOf("admin_set_visual_signature_model_config"),
      activeSql.indexOf("admin_reset_visual_signature_model_config"),
    );
    for (const field of [
      "actor_id",
      "reason",
      "image_preset",
      "image_model",
      "image_quality",
      "reasoning_effort",
      "config_version_id",
    ]) {
      expect(setFn).toContain(`'${field}'`);
    }
  });

  it("registra a tupla de catálogo Luna/Responses de forma idempotente e falha em divergência", () => {
    expect(activeSql).toMatch(
      /INSERT INTO public\.ai_model_catalog[\s\S]*?'visual_signature_image', 'image', 'openai', 'gpt-6-luna', 'responses'[\s\S]*?ON CONFLICT \(capability, provider, model, protocol\) DO NOTHING/,
    );
    expect(activeSql).toContain("f47_1_catalog_row_missing");
    expect(activeSql).toContain("f47_1_catalog_row_divergent");
    expect(activeSql).toMatch(/validated_at[\s\S]*?NULL/);
    expect(activeSql).not.toMatch(/'campaign_image', 'image', 'openai', 'gpt-6-luna', 'responses'/);
    expect(activeSql).not.toMatch(
      /'visual_signature_validation', 'vision', 'openai', 'gpt-6-luna', 'responses'/,
    );
  });

  it("não insere nem altera ai_model_pricing", () => {
    expect(activeSql).not.toMatch(/INSERT INTO public\.ai_model_pricing/i);
    expect(activeSql).not.toMatch(/UPDATE public\.ai_model_pricing/i);
    expect(activeSql).not.toMatch(/DELETE FROM public\.ai_model_pricing/i);
    expect(activeSql).not.toMatch(/ALTER TABLE public\.ai_model_pricing/i);
  });

  it("estende os CHECKs de auditoria preservando os valores anteriores", () => {
    const actionCheck = activeSql.slice(
      activeSql.indexOf("admin_audit_log_action_check CHECK"),
      activeSql.indexOf("admin_audit_log_target_type_check"),
    );
    for (const previous of [
      "credit_grant",
      "access_request_invite",
      "product_1_1_pending_resolution",
      "image_model_pair_config_update",
      "ai_model_selection_update",
      "data_subject_request_cancel_rejected",
    ]) {
      expect(actionCheck).toContain(`'${previous}'`);
    }
    expect(actionCheck).toContain("'visual_signature_model_config_update'");
    expect(actionCheck).toContain("'visual_signature_model_config_reset'");

    const targetCheck = activeSql.slice(
      activeSql.indexOf("admin_audit_log_target_type_check CHECK"),
    );
    for (const previous of [
      "store",
      "user",
      "campaign",
      "access_request",
      "feature_flag",
      "ai_model_selection",
      "support_credit_request",
      "data_subject_request",
      "image_model_pair_config",
    ]) {
      expect(targetCheck).toContain(`'${previous}'`);
    }
    expect(targetCheck).toContain("'visual_signature_model_config'");
  });

  it("não toca tabelas de outros fluxos", () => {
    expect(activeSql).not.toMatch(/INSERT INTO public\.ai_model_selection/i);
    expect(activeSql).not.toMatch(/UPDATE public\.ai_model_selection/i);
    expect(activeSql).not.toMatch(/INSERT INTO public\.image_model_pair_config/i);
    expect(activeSql).not.toMatch(/UPDATE public\.image_model_pair_config/i);
    expect(activeSql).not.toMatch(/ALTER TABLE public\.image_model_pair_config/i);
  });
});
