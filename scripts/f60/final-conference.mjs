#!/usr/bin/env node
/**
 * F60 / Plano 60-01 — Conferência final read-only (sem repetir harness).
 *
 * Comprova:
 * - os 13 UUIDs removidos da run 01 estão ausentes;
 * - todas as linhas preexistentes do baseline (status antes de F60/run 01)
 *   permanecem presentes e com o mesmo hash;
 * - adições observadas correspondem ao manifesto da run 02;
 * - o ledger evoluiu de 153 (F60 ausente) para 154 (F60 presente), mantendo
 *   contagem/SHA excluindo F60;
 * - a exclusão dos 13 UUIDs é registrada como delta autorizado da run 01.
 *
 * Somente leitura. Não executa harness, migration ou cleanup.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";
import { TABLES, readLedger, readTable } from "./homolog-snapshot.mjs";

const ALLOWED_HOST = "127.0.0.1";
const ALLOWED_PORT = "57782";
const ALLOWED_DB = "postgres";

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

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

async function main() {
  assertTarget();
  const baselinePath = resolve(
    arg("baseline") ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence/f60-20261109-status/f60-snapshot-status.json",
  );
  const expectPath = resolve(
    arg("expect") ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence/f60-20261109-02/f60-expected-additions.json",
  );
  const removedPath = resolve(
    arg("removed") ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence/f60-20261109-01/cleanup-manifest.json",
  );
  const runId = arg("run-id", "f60-20261109-02");

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const expectations = JSON.parse(readFileSync(expectPath, "utf8"));
  const removedManifest = JSON.parse(readFileSync(removedPath, "utf8"));
  const removed = removedManifest.deleted ?? [];

  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  let current;
  let ledger;
  let removedAbsent;
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    current = {};
    for (const table of TABLES) current[table] = await readTable(client, table);
    ledger = await readLedger(client);
    const { rows } = await client.query(
      "select id from auth.users where id = any($1::uuid[])",
      [removed],
    );
    removedAbsent = rows.length === 0;
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  const report = {
    kind: "f60-final-conference",
    run_id: runId,
    executed_at: new Date().toISOString(),
    removed_uuids: removed,
    removed_uuids_absent: removedAbsent,
    pre_existing_integrity: "PASS",
    expected_delta_status: "PASS",
    ledger_status: "PASS",
    authorized_removals: {
      run_id: "f60-20261109-01",
      count: removed.length,
      reason: "usuários de teste órfãos criados antes da falha de fixture; sem loja, campanha ou transação financeira",
      verified_absent: removedAbsent,
    },
    unexpected_removals: [],
    unexpected_changes: [],
    unexpected_additions: [],
    missing_expected_additions: [],
    ledger_before: baseline.ledger,
    ledger_after: ledger,
    tables: {},
  };

  for (const table of TABLES) {
    const b = baseline.tables?.[table];
    const c = current[table];
    const expected = new Set(expectations.additions?.[table] ?? []);

    if (!b?.exists) {
      // Tabela nova (criada pela F60): todas as linhas devem estar no manifesto da run 02.
      const extras = Object.keys(c.rows ?? {}).filter((id) => !expected.has(id));
      report.unexpected_additions.push(...extras.map((id) => ({ table, id, reason: "new_table" })));
      report.tables[table] = {
        baseline_exists: false,
        current_count: c.count,
        expected_count: expected.size,
        extras: extras.length,
      };
      continue;
    }

    for (const [id, hash] of Object.entries(b.rows ?? {})) {
      if (!(id in (c.rows ?? {}))) report.unexpected_removals.push({ table, id });
      else if (c.rows[id] !== hash) report.unexpected_changes.push({ table, id });
    }

    const added = Object.keys(c.rows ?? {}).filter((id) => !(id in (b.rows ?? {})));
    const extras = added.filter((id) => !expected.has(id));
    const missing = [...expected].filter((id) => !(id in (c.rows ?? {})));

    report.unexpected_additions.push(...extras.map((id) => ({ table, id })));
    report.missing_expected_additions.push(...missing.map((id) => ({ table, id })));

    report.tables[table] = {
      baseline_exists: true,
      baseline_count: b.count,
      current_count: c.count,
      expected_additions: expected.size,
      added: added.length,
      extras: extras.length,
      missing: missing.length,
    };
  }

  if (report.unexpected_removals.length || report.unexpected_changes.length) {
    report.pre_existing_integrity = "FAIL";
  }
  if (report.unexpected_additions.length || report.missing_expected_additions.length) {
    report.expected_delta_status = "FAIL";
  }

  const ledgerBefore = baseline.ledger ?? {};
  const countOk =
    Number(ledgerBefore.count_excluding_f60) === Number(ledger?.count_excluding_f60) &&
    Number(ledgerBefore.count) + 1 === Number(ledger?.count);
  const shaOk =
    String(ledgerBefore.sha256_excluding_f60) === String(ledger?.sha256_excluding_f60);
  const appliedOk = ledgerBefore.f60_applied === false && ledger?.f60_applied === true;
  if (!countOk || !shaOk || !appliedOk) report.ledger_status = "FAIL";

  if (!removedAbsent) report.pre_existing_integrity = "FAIL";

  const ok =
    report.removed_uuids_absent &&
    report.pre_existing_integrity === "PASS" &&
    report.expected_delta_status === "PASS" &&
    report.ledger_status === "PASS";

  const dir = resolve(
    process.env.F60_EVIDENCE_DIR ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence",
  );
  mkdirSync(dir, { recursive: true });
  const jsonPath = resolve(dir, "f60-final-conference.json");
  const mdPath = resolve(dir, "f60-final-conference.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  writeFileSync(
    mdPath,
    [
      "# F60 — Conferência final read-only",
      "",
      `- Run: \`${runId}\``,
      `- Executado em: ${report.executed_at}`,
      `- 13 UUIDs removidos ausentes: **${report.removed_uuids_absent ? "SIM" : "NÃO"}**`,
      `- Integridade preexistente: **${report.pre_existing_integrity}**`,
      `- Delta esperado: **${report.expected_delta_status}**`,
      `- Ledger: **${report.ledger_status}**`,
      `- Remoções autorizadas (run 01): ${report.authorized_removals.count}`,
      "",
      "## Delta autorizado da run 01",
      "",
      "13 usuários de teste órfãos, criados antes da falha de fixture, sem loja/campanha/transação.",
      "A ausência foi verificada diretamente em `auth.users`.",
      "",
      "## Integridade",
      "",
      `- Linhas preexistentes removidas inesperadamente: ${report.unexpected_removals.length}`,
      `- Linhas preexistentes alteradas: ${report.unexpected_changes.length}`,
      `- Adições fora do manifesto da run 02: ${report.unexpected_additions.length}`,
      `- Adições esperadas ausentes: ${report.missing_expected_additions.length}`,
      "",
      "> Conferência somente leitura; o harness não foi reexecutado.",
    ].join("\n") + "\n",
    "utf8",
  );

  console.log(JSON.stringify({ ok, jsonPath, mdPath, report }));
  if (!ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`[f60-final-conference] ${error.message}`);
  process.exitCode = 1;
});
