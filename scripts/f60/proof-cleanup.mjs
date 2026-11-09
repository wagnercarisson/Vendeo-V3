#!/usr/bin/env node
/**
 * F60 / Plano 60-01 — Cleanup conservador com classificação deleted/retained.
 *
 * Política: em ambiente não descartável, NADA é apagado por padrão. A origem
 * canônica (`product_9_16_two_stage_operations`) e os registros financeiros são
 * preservados. O script valida o manifesto da execução e produz o relatório
 * `deleted` (vazio) / `retained` (com motivos). Itens explicitamente elegíveis
 * só seriam removidos se listados em `manifest.purgeable` — o harness não lista
 * nenhum.
 *
 * NUNCA apaga nem atualiza `credit_transactions`.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const ALLOWED_HOST = "127.0.0.1";
const ALLOWED_PORT = "57782";
const ALLOWED_DB = "postgres";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertTarget() {
  if (!process.env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL é obrigatório");
  const url = new URL(process.env.TEST_DATABASE_URL);
  const host = url.hostname;
  const port = url.port || "5432";
  const db = url.pathname.replace(/^\//, "");
  if (host !== ALLOWED_HOST || port !== ALLOWED_PORT || db !== ALLOWED_DB) {
    throw new Error(`alvo recusado: ${host}:${port}/${db}`);
  }
}

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function assertUuidList(value, field) {
  if (!Array.isArray(value)) throw new Error(`manifest inválido: ${field} não é array`);
  for (const id of value) {
    if (!UUID_RE.test(String(id))) throw new Error(`manifest inválido: ${field} contém UUID inválido`);
  }
  return value;
}

function validateManifest(manifest, runId) {
  if (!manifest || typeof manifest !== "object") throw new Error("manifest ausente");
  assertUuidList(manifest.users ?? [], "users");
  assertUuidList(manifest.stores ?? [], "stores");
  assertUuidList(manifest.campaigns ?? [], "campaigns");
  if (!Array.isArray(manifest.auditResolutionIds ?? [])) {
    throw new Error("manifest inválido: auditResolutionIds não é array");
  }
  for (const id of manifest.auditResolutionIds ?? []) {
    if (!UUID_RE.test(String(id))) throw new Error("manifest inválido: auditResolutionIds contém UUID inválido");
  }
  for (const key of ["operations", "legacyOperations"]) {
    const list = manifest[key] ?? [];
    if (!Array.isArray(list)) throw new Error(`manifest inválido: ${key} não é array`);
    for (const item of list) {
      if (!UUID_RE.test(String(item.campaignId)) || !UUID_RE.test(String(item.operationId))) {
        throw new Error(`manifest inválido: ${key} contém par inválido`);
      }
    }
  }
  if (!runId) throw new Error("--run-id é obrigatório");
  return true;
}

async function main() {
  assertTarget();
  const runId = arg("run-id");
  const evidencePath = resolve(
    arg("evidence") ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence/f60-proof-evidence.json",
  );
  const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
  if (evidence.run_id !== runId) {
    throw new Error("manifest/evidência pertencem a outra execução; nada será apagado");
  }
  const manifest = evidence.manifest ?? {};
  validateManifest(manifest, runId);

  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  const report = {
    kind: "f60-cleanup-manifest",
    run_id: runId,
    executed_at: new Date().toISOString(),
    policy: "retain_all_non_disposable",
    deleted: [],
    retained: [],
    expected_financial_delta: {},
    unclassified: [],
  };

  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");

    for (const operation of [...(manifest.operations ?? []), ...(manifest.legacyOperations ?? [])]) {
      const { rows } = await client.query(
        `select
           (select status from public.product_1_1_campaign_credit_operations
             where campaign_id=$1 and operation_id=$2) as credit_status,
           exists(select 1 from public.product_9_16_two_stage_operations
                   where campaign_id=$1 and operation_id=$2) as is_new_flow,
           exists(select 1 from public.product_9_16_two_stage_outcomes
                   where campaign_id=$1 and operation_id=$2) as has_outcome,
           exists(select 1 from public.admin_audit_log
                   where target_id=$1 and metadata->>'operation_id'=$2::text) as has_audit`,
        [operation.campaignId, operation.operationId],
      );
      const row = rows[0] ?? {};
      const reasons = [];
      if (row.is_new_flow) reasons.push("canonical_origin");
      if (row.credit_status === "reserved" || row.credit_status === "art_uploaded") {
        reasons.push("pending_financial_operation");
      } else if (row.credit_status) {
        reasons.push("financial_authority_reference");
      }
      if (row.has_outcome) reasons.push("immutable_outcome");
      if (row.has_audit) reasons.push("audit_reference");
      if (reasons.length === 0) reasons.push("unresolved_reference");

      report.retained.push({
        kind: "operation",
        ...operation,
        credit_status: row.credit_status ?? null,
        reasons,
      });
    }

    for (const campaignId of manifest.campaigns ?? []) {
      report.retained.push({
        kind: "campaign",
        id: campaignId,
        reasons: ["financial_operation_reference"],
      });
    }
    for (const storeId of manifest.stores ?? []) {
      report.retained.push({
        kind: "store",
        id: storeId,
        reasons: ["ledger_append_only_and_balance"],
      });
    }
    for (const userId of manifest.users ?? []) {
      report.retained.push({
        kind: "user",
        id: userId,
        reasons: ["store_ownership"],
      });
    }

    const { rows: financial } = await client.query(
      `select count(*)::int as n, coalesce(sum(amount), 0)::int as amount
         from public.credit_transactions
        where store_id = any($1::uuid[])`,
      [manifest.stores ?? []],
    );
    report.expected_financial_delta = {
      credit_transactions: financial[0]?.n ?? 0,
      amount: financial[0]?.amount ?? 0,
      note: "Append-only; retido por design, nunca apagado.",
    };

    const classified = new Set([
      ...report.retained.filter((r) => r.id).map((r) => r.id),
      ...report.retained
        .filter((r) => r.operationId)
        .map((r) => `${r.campaignId}/${r.operationId}`),
    ]);
    report.unclassified = [
      ...(manifest.users ?? []).filter((id) => !classified.has(id)),
      ...(manifest.stores ?? []).filter((id) => !classified.has(id)),
      ...(manifest.campaigns ?? []).filter((id) => !classified.has(id)),
      ...(manifest.operations ?? [])
        .map((o) => `${o.campaignId}/${o.operationId}`)
        .filter((key) => !classified.has(key)),
      ...(manifest.legacyOperations ?? [])
        .map((o) => `${o.campaignId}/${o.operationId}`)
        .filter((key) => !classified.has(key)),
    ];

    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  const dir = resolve(
    process.env.F60_EVIDENCE_DIR ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence",
  );
  mkdirSync(dir, { recursive: true });
  const jsonPath = resolve(dir, "cleanup-manifest.json");
  const mdPath = resolve(dir, "cleanup-manifest.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    mdPath,
    [
      "# F60 — Cleanup manifest",
      "",
      `- Run: \`${runId}\``,
      `- Executado em: ${report.executed_at}`,
      `- Política: ${report.policy}`,
      `- Deletados: ${report.deleted.length}`,
      `- Retidos: ${report.retained.length}`,
      `- Não classificados: ${report.unclassified.length}`,
      "",
      "> Em homolog não descartável, nada é apagado: origem canônica, operações pendentes,",
      "> ledger append-only, desfechos imutáveis e auditoria são preservados.",
      "> `credit_transactions` nunca é apagada nem atualizada.",
    ].join("\n") + "\n",
    "utf8",
  );

  const ok = report.unclassified.length === 0;
  console.log(
    JSON.stringify({
      ok,
      jsonPath,
      mdPath,
      deleted: report.deleted.length,
      retained: report.retained.length,
    }),
  );
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[f60-cleanup] ${error.message}`);
  process.exitCode = 1;
});
