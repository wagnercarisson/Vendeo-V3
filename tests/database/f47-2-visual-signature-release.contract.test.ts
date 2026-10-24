// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Contrato ESTÁTICO (offline) da F47.2. Não abre banco, não aplica migration
// e não consulta provider.
const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const F471 = "20261024141422_f47_1_visual_signature_model_config.sql";
const F472 = "20261024141452_f47_2_visual_signature_release_state.sql";
const F503 = "20261021000001_f50_3_cnpj_alfanumerico.sql";

function readSql(file: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
}

function lfNormalizedSha256(sql: string): string {
  return createHash("sha256").update(sql.replace(/\r\n/g, "\n"), "utf8").digest("hex").toUpperCase();
}

const f471 = readSql(F471);
const f472 = readSql(F472);
const active472 = f472
  .split(/\r?\n/)
  .filter((line) => !line.trimStart().startsWith("--") && line.trim().length > 0)
  .join("\n");

describe("F47.2 — migrations e liberação da Assinatura Visual", () => {
  it("preserva a F47.1 renumerada com o hash LF original", () => {
    expect(lfNormalizedSha256(f471)).toBe(
      "B352F93EFA1B2F829E5D97FFAA79F7972CF3D7696C6B7CEB40EBFC517A26AA90",
    );
  });

  it("preserva a F50.3 e não deixa prefixo duplicado", () => {
    expect(readdirSync(MIGRATIONS_DIR)).toContain(F503);
    const versions = readdirSync(MIGRATIONS_DIR)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.split("_")[0]);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("amplia o CHECK de ambiente sem remover local_validation", () => {
    expect(active472).toMatch(
      /chk_vs_environment[\s\S]*?CHECK \(environment_scope IN \('local_validation', 'production'\)\)/,
    );
    expect(active472).not.toMatch(/CHECK \(environment_scope = 'local_validation'\)/);
  });

  it("cria release e allowlist com RLS service_role", () => {
    expect(active472).toMatch(/CREATE TABLE IF NOT EXISTS public\.visual_signature_model_config_release/);
    expect(active472).toMatch(/published_config_version_id/);
    expect(active472).toMatch(/activated_config_version_id/);
    expect(active472).toMatch(/CREATE TABLE IF NOT EXISTS public\.visual_signature_model_config_pilot_stores/);
    expect(active472).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(active472).toMatch(/TO service_role/);
    expect(active472).not.toMatch(/GRANT[^;]+TO (anon|authenticated)/);
  });

  it("set v2 invalida a liberação anterior e limpa allowlist na mesma transação", () => {
    expect(active472).toContain("admin_set_visual_signature_model_config_v2");
    expect(active472).toMatch(/p_environment_scope/);
    expect(active472).toMatch(/preset_not_evaluated/);
    expect(active472).toMatch(
      /published_config_version_id = NULL,[\s\S]*?activated_config_version_id = NULL,[\s\S]*?activation_mode = 'none'/,
    );
    expect(active472).toMatch(/DELETE FROM public\.visual_signature_model_config_pilot_stores/);
    expect(active472).toContain("configuration_replaced_requires_reapproval");
    expect(active472).toContain("previous_pilot_stores");
  });

  it("publicação, ativação e reset exigem versão esperada", () => {
    for (const fn of [
      "admin_publish_visual_signature_model_config",
      "admin_activate_visual_signature_model_config",
      "admin_reset_visual_signature_model_config",
    ]) {
      expect(active472).toContain(`FUNCTION public.${fn}`);
      expect(active472).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn}`);
      expect(active472).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}`);
    }
    expect(active472).toContain("config_version_mismatch");
    expect(active472).toContain("config_not_published");
    expect(active472).toContain("deactivate_required");
    expect(active472).toContain("invalid_pilot_store");
  });

  it("reset limpa allowlist e audita a composição anterior", () => {
    expect(active472).toMatch(
      /DELETE FROM public\.visual_signature_model_config_pilot_stores;[\s\S]*?DELETE FROM public\.visual_signature_model_config/,
    );
    expect(active472).toContain("previous_pilot_stores");
    expect(active472).toContain("previous_activation_mode");
    expect(active472).toContain("previous_published_config_version_id");
  });

  it("remove as assinaturas antigas de set/reset", () => {
    expect(active472).toMatch(
      /DROP FUNCTION IF EXISTS public\.admin_set_visual_signature_model_config\(\s*UUID, TEXT, TEXT, TEXT, TEXT, UUID, TEXT\s*\)/,
    );
    expect(active472).toMatch(
      /DROP FUNCTION IF EXISTS public\.admin_reset_visual_signature_model_config\(\s*UUID, TEXT, UUID, TEXT\s*\)/,
    );
  });

  it("serializa por advisory lock e idempotência por operation_id", () => {
    expect(active472).toMatch(/pg_advisory_xact_lock\(hashtext\('f47_2_visual_signature_model_config_release'\)\)/);
    expect(active472).toContain("operation_id_conflict");
    expect(active472).toMatch(/'operation', 'publish'/);
    expect(active472).toMatch(/'operation', 'activation'/);
    expect(active472).toMatch(/'operation', 'reset'/);
  });

  it("estende auditoria preservando valores anteriores", () => {
    const actionCheck = active472.slice(
      active472.indexOf("admin_audit_log_action_check CHECK"),
      active472.indexOf("admin_audit_log_target_type_check"),
    );
    for (const previous of [
      "credit_grant",
      "access_request_invite",
      "product_1_1_pending_resolution",
      "image_model_pair_config_update",
      "visual_signature_model_config_update",
      "visual_signature_model_config_reset",
    ]) {
      expect(actionCheck).toContain(`'${previous}'`);
    }
    expect(actionCheck).toContain("'visual_signature_model_config_publish'");
    expect(actionCheck).toContain("'visual_signature_model_config_activation'");
  });

  it("não aplica migration, não altera ledger e não chama provider", () => {
    expect(active472).not.toMatch(/db\s+push/i);
    expect(active472).not.toMatch(/migration\s+repair/i);
    expect(active472).not.toMatch(/INSERT INTO public\.supabase_migrations/i);
    expect(active472).not.toMatch(/https?:\/\//i);
  });
});
