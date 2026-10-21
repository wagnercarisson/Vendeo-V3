/**
 * F47.1 — Preflight de aplicação (read-only) — checagens de banco.
 *
 * Executado por `scripts/f47-1/preflight.ps1` com `npx --no-install tsx`.
 * SOMENTE leituras (`SELECT`) no Postgres local isolado. Não escreve, não
 * aplica migration e não chama provider.
 *
 * Imprime APENAS evidência sanitizada em JSON no stdout: booleans, hosts,
 * portas, contagens e versões. NUNCA imprime connection string, senha, chave
 * ou token.
 */
import { readdirSync } from "node:fs";
import { Client } from "pg";
import {
  assertLocalPostgresEndpoint,
  evaluateLocalValidationStage,
  resolveLocalSupabaseEndpoints,
  VisualSignatureLocalEnvironmentError,
} from "../../src/lib/visual-signature/local-validation/environment-contract";

const STAGE = process.env.PREFLIGHT_STAGE === "post-migration" ? "post-migration" : "pre-migration";
const DATABASE_URL = process.env.DATABASE_URL ?? "";
const EXPECTED_PROJECT_ID = process.env.EXPECTED_PROJECT_ID ?? "";
const EXPECTED_MIGRATION_VERSION = process.env.EXPECTED_MIGRATION_VERSION ?? "";
const EXPECTED_MIGRATION_FILE = process.env.EXPECTED_MIGRATION_FILE ?? "";
const WORKDIR_MIGRATIONS_DIR = process.env.WORKDIR_MIGRATIONS_DIR ?? "";
const REPO_MIGRATIONS_DIR = process.env.REPO_MIGRATIONS_DIR ?? "";
const VALIDATION_INSTANCE = process.env.VISUAL_SIGNATURE_MODEL_VALIDATION_INSTANCE ?? "";
const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_URL = process.env.SUPABASE_URL ?? "";
const EXPECTED_DB_PORT = process.env.EXPECTED_DB_PORT ?? "";
const VALIDATION_FLAG_ENABLED = process.env.VENDEO_VS_VALIDATION_ENABLED === "1";
const CREDENTIAL_PRESENT = (process.env.VENDEO_VS_VALIDATION_OPENAI_API_KEY ?? "").trim() !== "";

const ORCHESTRATORS = ["gpt-5.5", "gpt-6-luna"] as const;
const PRESET_IMAGE_MODELS = ["gpt-image-2.5-flare", "gpt-image-2.5-sunburst"] as const;

interface MigrationFile {
  file: string;
  version: string;
}

function listSqlMigrations(dir: string): MigrationFile[] {
  if (!dir) return [];
  try {
    return readdirSync(dir)
      .filter((name) => name.endsWith(".sql"))
      .map((file) => ({ file, version: file.split("_")[0] }))
      .sort((a, b) => a.file.localeCompare(b.file));
  } catch {
    return [];
  }
}

function canonicalIdentity(rawUrl: string): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const failures: string[] = [];
  const evidence: Record<string, unknown> = {
    stage: STAGE,
    read_only: true,
  };

  // Identidade canônica (host:port) — comparada com a allowlist local.
  const canonical = canonicalIdentity(NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL);
  const identityMatches = canonical !== null && canonical === VALIDATION_INSTANCE;
  evidence.identity = {
    canonical,
    expected: VALIDATION_INSTANCE,
    matches: identityMatches,
  };
  if (!identityMatches) failures.push("identity_mismatch");
  if (!VALIDATION_FLAG_ENABLED) failures.push("validation_flag_disabled");
  if ((process.env.VERCEL ?? "") !== "") failures.push("vercel_environment_detected");
  evidence.allowlist = { orchestrators: ORCHESTRATORS, ok: identityMatches };
  evidence.credential_present = CREDENTIAL_PRESENT;
  if (!CREDENTIAL_PRESENT) failures.push("validation_credential_missing");

  // Migrations (arquivos × ledger) — workdir e repositório separados.
  const workdirMigrations = listSqlMigrations(WORKDIR_MIGRATIONS_DIR);
  const repoMigrations = listSqlMigrations(REPO_MIGRATIONS_DIR);
  const workdirVersions = new Set(workdirMigrations.map((item) => item.version));
  const repoOnly = repoMigrations.filter((item) => !workdirVersions.has(item.version));

  if (!DATABASE_URL) {
    console.log(
      JSON.stringify({
        ...evidence,
        ok: false,
        failures: [...failures, "database_url_missing"],
        error: "database_url_missing",
      }),
    );
    process.exitCode = 1;
    return;
  }

  // Fail-closed ANTES de qualquer conexão: valida os endpoints Supabase e o
  // destino Postgres por conta própria, sem confiar apenas no PowerShell.
  try {
    resolveLocalSupabaseEndpoints(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_URL);
  } catch (error) {
    failures.push(
      error instanceof VisualSignatureLocalEnvironmentError
        ? error.code
        : "supabase_endpoint_invalid",
    );
  }

  try {
    const dbTarget = assertLocalPostgresEndpoint(DATABASE_URL, EXPECTED_DB_PORT);
    evidence.database_target = {
      host: dbTarget.host,
      port: dbTarget.port,
      loopback: true,
    };
  } catch (error) {
    failures.push(
      error instanceof VisualSignatureLocalEnvironmentError
        ? error.code
        : "database_endpoint_invalid",
    );
  }

  const preConnectionFailures = Array.from(
    new Set(
      failures.filter(
        (failure) => failure !== "validation_credential_missing",
      ),
    ),
  );
  if (preConnectionFailures.length > 0) {
    console.log(
      JSON.stringify({
        ...evidence,
        ok: false,
        database_connection_attempted: false,
        failures: Array.from(new Set(failures)),
        error: "preflight_isolation_failed_before_database_connection",
      }),
    );
    process.exitCode = 1;
    return;
  }

  const client = new Client({ connectionString: DATABASE_URL });
  evidence.database_connection_attempted = true;
  await client.connect();
  try {
    const databaseResult = await client.query<{ current_database: string }>(
      "SELECT current_database() AS current_database",
    );
    const currentDatabase = databaseResult.rows[0]?.current_database ?? null;
    evidence.database = { current_database: currentDatabase };
    if (currentDatabase !== "postgres") failures.push("unexpected_database");

    const ledgerResult = await client.query<{ version: string }>(
      "SELECT version::text AS version FROM supabase_migrations.schema_migrations",
    );
    const ledgerVersions = new Set(ledgerResult.rows.map((row) => row.version));
    evidence.ledger = { count: ledgerVersions.size };

    const authorizedInWorkdir = workdirMigrations.some(
      (item) => item.version === EXPECTED_MIGRATION_VERSION,
    );
    const authorizedApplied = ledgerVersions.has(EXPECTED_MIGRATION_VERSION);

    const pendingWorkdir = workdirMigrations.filter(
      (item) => !ledgerVersions.has(item.version),
    );
    const pending: MigrationFile[] = [...pendingWorkdir];
    if (!authorizedApplied && !authorizedInWorkdir && EXPECTED_MIGRATION_FILE) {
      pending.push({
        file: EXPECTED_MIGRATION_FILE,
        version: EXPECTED_MIGRATION_VERSION,
      });
    }
    const unexpectedPending = pending.filter(
      (item) => item.version !== EXPECTED_MIGRATION_VERSION,
    );

    evidence.migrations = {
      expected_version: EXPECTED_MIGRATION_VERSION,
      expected_file: EXPECTED_MIGRATION_FILE,
      authorized_in_workdir: authorizedInWorkdir,
      authorized_applied: authorizedApplied,
      workdir_file_count: workdirMigrations.length,
      ledger_count: ledgerVersions.size,
      pending: pending.map((item) => item.file),
      pending_count: pending.length,
      unexpected_pending: unexpectedPending.map((item) => item.file),
      // Diagnóstico sanitizado: arquivos do repo ausentes no workdir deste lote
      // (ex.: as 5 migrations F50.2 `20261020000001..05` de outro lote).
      repo_only_count: repoOnly.length,
      repo_only_files: repoOnly.map((item) => item.file),
    };

    if (unexpectedPending.length > 0) failures.push("unexpected_pending_migrations");

    if (STAGE === "pre-migration") {
      // A migration autorada está no repo e ainda não foi copiada/aplicada:
      // é exatamente a única pendência esperada deste lote.
      if (pending.length !== 1) failures.push("pre_migration_pending_not_exactly_one");
      if (authorizedApplied) failures.push("migration_unexpectedly_applied");
    } else {
      if (!authorizedApplied) failures.push("migration_not_applied");
      if (pending.length !== 0) failures.push("pending_after_migration");
    }

    // Catálogo da capacidade da VS.
    const catalogResult = await client.query<{
      model: string;
      protocol: string;
      segment: string;
      status: string;
    }>(
      `SELECT model, protocol, segment, status
         FROM public.ai_model_catalog
        WHERE capability = 'visual_signature_image'`,
    );
    const catalogRows = catalogResult.rows;
    const gpt55 = catalogRows.find(
      (row) => row.model === "gpt-5.5" && row.protocol === "responses",
    );
    const luna = catalogRows.find(
      (row) => row.model === "gpt-6-luna" && row.protocol === "responses",
    );
    const gpt55Present =
      Boolean(gpt55) && gpt55?.status === "active" && gpt55?.segment === "image";
    const lunaPresent = Boolean(luna);
    const lunaIntegrity =
      lunaPresent && luna?.status === "active" && luna?.segment === "image";

    evidence.catalog = {
      gpt_5_5_present: gpt55Present,
      luna_present: lunaPresent,
      luna_status: luna?.status ?? null,
      luna_segment: luna?.segment ?? null,
      luna_integrity_ok: lunaIntegrity,
      luna_expected: STAGE === "pre-migration" ? "absent_or_consistent" : "active",
      row_count: catalogRows.length,
    };

    const stageResult = evaluateLocalValidationStage(STAGE, {
      gpt55Present,
      lunaPresent,
      lunaIntegrityOk: lunaIntegrity,
    });
    for (const failure of stageResult.failures) {
      if (!failures.includes(failure)) failures.push(failure);
    }

    // Pricing — ADVISORY (nunca bloqueia a aplicação).
    const pricingResult = await client.query<{
      model: string;
      has_text_price: boolean;
      has_image_price: boolean;
    }>(
      `SELECT model,
              (input_token_usd_per_1m IS NOT NULL OR output_token_usd_per_1m IS NOT NULL) AS has_text_price,
              (image_unit_usd IS NOT NULL OR image_token_usd_per_1m IS NOT NULL) AS has_image_price
         FROM public.ai_model_pricing
        WHERE provider = 'openai' AND effective_until IS NULL
          AND model = ANY($1::text[])`,
      [[...ORCHESTRATORS, ...PRESET_IMAGE_MODELS]],
    );
    const pricingByModel = new Map(pricingResult.rows.map((row) => [row.model, row]));
    const presetCoverage = PRESET_IMAGE_MODELS.map((model) => ({
      image_model: model,
      image_price_present: pricingByModel.get(model)?.has_image_price ?? false,
      orchestrator_prices_present: ORCHESTRATORS.map((orchestrator) => ({
        orchestrator,
        text_price_present: pricingByModel.get(orchestrator)?.has_text_price ?? false,
      })),
    }));
    evidence.pricing = {
      advisory: true,
      preset_coverage: presetCoverage,
      all_presets_covered: presetCoverage.every(
        (item) =>
          item.image_price_present &&
          item.orchestrator_prices_present.every((orchestrator) => orchestrator.text_price_present),
      ),
    };

    // Flags relevantes (somente leitura).
    const flagsResult = await client.query<{ key: string; enabled: boolean }>(
      `SELECT key, enabled FROM public.feature_flags
        WHERE key LIKE 'visual_signature%' OR key LIKE 'product_1_1%'
        ORDER BY key`,
    );
    evidence.flags = {
      env_validation_enabled: VALIDATION_FLAG_ENABLED,
      rows: flagsResult.rows,
    };

    evidence.ok = failures.length === 0;
    evidence.failures = failures;
    console.log(JSON.stringify(evidence));
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "unknown_error";
  // Sanitiza: nunca ecoa connection string nem detalhes de credencial.
  const safe = /password|postgres(ql)?:\/\//i.test(message)
    ? "database_connection_failed"
    : message.slice(0, 200);
  console.log(JSON.stringify({ stage: STAGE, read_only: true, ok: false, error: safe }));
  process.exitCode = 1;
});
