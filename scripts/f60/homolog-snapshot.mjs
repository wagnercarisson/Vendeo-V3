#!/usr/bin/env node
/**
 * F60 / Plano 60-01 — Snapshot S0 somente leitura do homolog.
 *
 * Uso:
 *   node scripts/f60/homolog-snapshot.mjs snapshot --label before [--out <dir>]
 *   node scripts/f60/homolog-snapshot.mjs compare --before <file> --after <file>
 *
 * Regras:
 * - Alvo único permitido: ALLOWED_HOST/ALLOWED_PORT/ALLOWED_DB (default 127.0.0.1/57782/postgres).
 * - Conexão em transação READ ONLY / REPEATABLE READ.
 * - Compara integridade das linhas PREEXISTENTES separadamente do DELTA esperado.
 * - Nunca escreve no banco. `credit_transactions` é apenas lida.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import pg from "pg";

const ALLOWED_HOST = process.env.ALLOWED_HOST ?? "127.0.0.1";
const ALLOWED_PORT = process.env.ALLOWED_PORT ?? "57782";
const ALLOWED_DB = process.env.ALLOWED_DB ?? "postgres";
const F60_MIGRATION_PREFIX = "20261109174110";

export const TABLES = [
  "auth.users",
  "public.stores",
  "public.credit_balances",
  "public.credit_transactions",
  "public.campaigns",
  "public.product_1_1_campaign_credit_operations",
  "public.product_1_1_generation_attempt_claims",
  "public.product_1_1_generation_outcomes",
  "public.admin_audit_log",
  "public.product_9_16_two_stage_operations",
  "public.product_9_16_two_stage_steps",
  "public.product_9_16_two_stage_attempt_claims",
  "public.product_9_16_two_stage_outcomes",
];

export const TABLE_IDENTITY = {
  "auth.users": "id",
  "public.credit_balances": "store_id",
};

export function identityColumn(table) {
  return TABLE_IDENTITY[table] ?? "id";
}

function assertTarget(connectionString) {
  if (!connectionString) throw new Error("TEST_DATABASE_URL é obrigatório");
  const url = new URL(connectionString);
  const host = url.hostname;
  const port = url.port || "5432";
  const db = url.pathname.replace(/^\//, "");
  if (host !== ALLOWED_HOST || port !== ALLOWED_PORT || db !== ALLOWED_DB) {
    throw new Error(
      `alvo recusado: ${host}:${port}/${db}; permitido ${ALLOWED_HOST}:${ALLOWED_PORT}/${ALLOWED_DB}`,
    );
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

async function withReadOnlyClient(fn) {
  assertTarget(process.env.TEST_DATABASE_URL);
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const result = await fn(client);
    await client.query("ROLLBACK");
    return result;
  } finally {
    await client.end();
  }
}

export async function readLedger(client) {
  const { rows } = await client.query(
    "select version from supabase_migrations.schema_migrations order by version",
  );
  const versions = rows.map((r) => String(r.version));
  const relevant = versions.filter((v) => !v.startsWith(F60_MIGRATION_PREFIX));
  return {
    count: versions.length,
    count_excluding_f60: relevant.length,
    last: versions.length ? versions[versions.length - 1] : null,
    sha256_excluding_f60: sha256(relevant.join("\n")),
    f60_applied: versions.some((v) => v.startsWith(F60_MIGRATION_PREFIX)),
  };
}

export async function readTable(client, table) {
  const exists = await client.query("select to_regclass($1) as regclass", [table]);
  if (!exists.rows[0]?.regclass) return { exists: false, count: 0, rows: {} };

  const identity = identityColumn(table);
  const cols = await client.query(
    `select column_name from information_schema.columns
      where table_schema = $1 and table_name = $2`,
    table.split("."),
  );
  if (!cols.rows.some((c) => c.column_name === identity)) {
    throw new Error(`identidade '${identity}' ausente em ${table}`);
  }
  const { rows } = await client.query(
    `select ${identity}::text as id, md5(row_to_json(t)::text) as hash from ${table} t order by 1`,
  );
  const map = {};
  for (const row of rows) map[row.id] = row.hash;
  return { exists: true, count: rows.length, rows: map };
}

async function snapshot(label, runId) {
  return withReadOnlyClient(async (client) => {
    const tables = {};
    for (const table of TABLES) tables[table] = await readTable(client, table);
    const ledger = await readLedger(client);
    const payload = {
      kind: "f60-homolog-snapshot",
      run_id: runId,
      label,
      captured_at: new Date().toISOString(),
      target: {
        host: ALLOWED_HOST,
        port: ALLOWED_PORT,
        database: ALLOWED_DB,
      },
      ledger,
      tables,
    };
    payload.sha256 = sha256(stableStringify(payload));
    return payload;
  });
}

export function compare(before, after, expectations) {
  const report = {
    kind: "f60-homolog-compare",
    run_id: after.run_id ?? null,
    compared_at: new Date().toISOString(),
    pre_existing_integrity: "PASS",
    expected_delta_status: "PASS",
    expected_delta_by_table: {},
    ledger_status: "PASS",
    unexpected_removals: [],
    unexpected_changes: [],
    unexpected_additions: [],
    missing_expected_additions: [],
    unknown_expected_tables: [],
    unknown_snapshot_tables: [],
    ledger_observed: after.ledger,
    ledger_expected: expectations?.ledger ?? null,
  };

  if (!before.run_id || !after.run_id || before.run_id !== after.run_id) {
    report.pre_existing_integrity = "FAIL";
    report.unexpected_changes.push("run_id_mismatch");
  }

  if (stableStringify(before.target) !== stableStringify(after.target)) {
    report.pre_existing_integrity = "FAIL";
    report.unexpected_changes.push("target_mismatch");
  }

  if (expectations?.run_id && expectations.run_id !== after.run_id) {
    report.expected_delta_status = "FAIL";
    report.unexpected_additions.push("expectations_run_id_mismatch");
  }

  if (expectations?.ledger) {
    if (
      Number(expectations.ledger.count_excluding_f60) !==
        Number(after.ledger?.count_excluding_f60) ||
      expectations.ledger.sha256_excluding_f60 !== after.ledger?.sha256_excluding_f60
    ) {
      report.ledger_status = "FAIL";
    }
  } else {
    report.ledger_status = "FAIL";
  }

  const snapshotTables = new Set([
    ...Object.keys(before.tables ?? {}),
    ...Object.keys(after.tables ?? {}),
  ]);
  const expectedTables = new Set(Object.keys(expectations?.additions ?? {}));
  report.unknown_expected_tables = [...expectedTables].filter((t) => !snapshotTables.has(t));
  report.unknown_snapshot_tables = [...snapshotTables].filter((t) => !expectedTables.has(t));

  const tables = new Set([...snapshotTables, ...expectedTables]);
  for (const table of tables) {
    const b = before.tables?.[table];
    const a = after.tables?.[table];
    if (!b?.exists || !a?.exists) {
      report.expected_delta_status = "FAIL";
      report.unexpected_additions.push({ table, id: "missing_snapshot_table" });
      continue;
    }

    for (const [id, hash] of Object.entries(b.rows ?? {})) {
      if (!(id in (a.rows ?? {}))) report.unexpected_removals.push({ table, id });
      else if (a.rows[id] !== hash) report.unexpected_changes.push({ table, id });
    }

    const added = Object.keys(a.rows ?? {}).filter((id) => !(id in (b.rows ?? {})));
    const expected = new Set(expectations?.additions?.[table] ?? []);
    const extras = added.filter((id) => !expected.has(id));
    const missing = [...expected].filter((id) => !added.includes(id));

    report.unexpected_additions.push(...extras.map((id) => ({ table, id })));
    report.missing_expected_additions.push(...missing.map((id) => ({ table, id })));

    report.expected_delta_by_table[table] = {
      expected_count: expected.size,
      added_count: added.length,
      extras,
      missing,
      matches: extras.length === 0 && missing.length === 0,
    };
  }

  if (report.unexpected_removals.length || report.unexpected_changes.length) {
    report.pre_existing_integrity = "FAIL";
  }
  if (
    report.unexpected_additions.length ||
    report.missing_expected_additions.length ||
    report.unknown_expected_tables.length ||
    report.unknown_snapshot_tables.length
  ) {
    report.expected_delta_status = "FAIL";
  }
  return report;
}

export function validateLedger(
  snapshot,
  expectedCount,
  expectedSha,
  requireF60Absent = false,
  requireF60Applied = false,
) {
  const failures = [];
  if (requireF60Absent && requireF60Applied) {
    return {
      ok: false,
      failures: ["f60_requirement_conflict"],
      ledger: snapshot.ledger,
    };
  }
  if (requireF60Absent && snapshot.ledger?.f60_applied !== false) {
    failures.push("f60_already_applied");
  }
  if (requireF60Applied && snapshot.ledger?.f60_applied !== true) {
    failures.push("f60_not_applied");
  }
  if (Number(expectedCount) !== Number(snapshot.ledger?.count_excluding_f60)) {
    failures.push("ledger_count_mismatch");
  }
  if (String(expectedSha) !== String(snapshot.ledger?.sha256_excluding_f60)) {
    failures.push("ledger_sha256_mismatch");
  }
  return { ok: failures.length === 0, failures, ledger: snapshot.ledger };
}

function parseArgs(argv) {
  const [command, ...rest] = argv.slice(2);
  const args = { command };
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i].startsWith("--")) {
      const key = rest[i].slice(2);
      args[key] = rest[i + 1];
      i += 1;
    }
  }
  return args;
}

function outDir() {
  return resolve(
    process.env.F60_EVIDENCE_DIR ??
      ".planning/phases/60-f60-controle-das-duas-etapas-9-16-e-integracao-financeira/evidence",
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (!["snapshot", "compare", "validate-ledger"].includes(args.command)) {
    throw new Error(
      "uso: snapshot --label <nome> | compare --before <json> --after <json> --expect <json> | validate-ledger --snapshot <json> --expected-ledger-count <n> --expected-ledger-sha256 <hex>",
    );
  }

  if (args.command === "snapshot") {
    const label = args.label ?? "before";
    const runId = args["run-id"] ?? process.env.F60_RUN_ID;
    if (!runId) throw new Error("snapshot exige --run-id (ou F60_RUN_ID)");
    const data = await snapshot(label, runId);
    const dir = outDir();
    mkdirSync(dir, { recursive: true });
    const jsonPath = resolve(dir, `f60-snapshot-${label}.json`);
    const mdPath = resolve(dir, `f60-snapshot-${label}.md`);
    writeFileSync(jsonPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    const lines = [
      `# F60 — Snapshot ${label}`,
      "",
      `- Run: \`${data.run_id}\``,
      `- Alvo: \`${data.target.host}:${data.target.port}/${data.target.database}\``,
      `- Capturado em: ${data.captured_at}`,
      `- Ledger: ${data.ledger.count} (${data.ledger.last}); F60 aplicada: ${data.ledger.f60_applied}`,
      `- SHA-256 do snapshot: \`${data.sha256}\``,
      "",
      "| Tabela | Linhas |",
      "|---|---:|",
      ...Object.entries(data.tables).map(([table, t]) => `| \`${table}\` | ${t.count} |`),
      "",
      "> Somente leitura. Nenhuma linha foi criada, alterada ou removida.",
    ];
    writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
    console.log(JSON.stringify({ ok: true, jsonPath, mdPath, sha256: data.sha256 }));
    return;
  }

  if (args.command === "validate-ledger") {
    if (!args.snapshot) throw new Error("validate-ledger exige --snapshot");
    const data = JSON.parse(readFileSync(args.snapshot, "utf8"));
    const result = validateLedger(
      data,
      args["expected-ledger-count"],
      args["expected-ledger-sha256"],
      args["require-f60-absent"] === "true",
      args["require-f60-applied"] === "true",
    );
    const dir = outDir();
    mkdirSync(dir, { recursive: true });
    const jsonPath = resolve(dir, "f60-ledger-precheck.json");
    writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ ok: result.ok, jsonPath, failures: result.failures }));
    if (!result.ok) process.exitCode = 2;
    return;
  }

  if (!args.before || !args.after) throw new Error("compare exige --before e --after");
  if (!args.expect) throw new Error("compare exige --expect (f60-expected-additions.json)");
  const before = JSON.parse(readFileSync(args.before, "utf8"));
  const after = JSON.parse(readFileSync(args.after, "utf8"));
  const expectations = JSON.parse(readFileSync(args.expect, "utf8"));
  if (args["expected-ledger-count"]) {
    expectations.ledger = expectations.ledger ?? {};
    expectations.ledger.count_excluding_f60 = Number(args["expected-ledger-count"]);
  }
  if (args["expected-ledger-sha256"]) {
    expectations.ledger = expectations.ledger ?? {};
    expectations.ledger.sha256_excluding_f60 = args["expected-ledger-sha256"];
  }
  if (args["run-id"]) {
    if (before.run_id !== args["run-id"] || after.run_id !== args["run-id"]) {
      throw new Error("run_id do snapshot diverge do --run-id");
    }
    expectations.run_id = args["run-id"];
  }
  const report = compare(before, after, expectations);
  const dir = outDir();
  mkdirSync(dir, { recursive: true });
  const jsonPath = resolve(dir, "f60-snapshot-compare.json");
  const mdPath = resolve(dir, "f60-snapshot-compare.md");
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const lines = [
    "# F60 — Comparação S0 / delta esperado",
    "",
    `- Run: \`${report.run_id}\``,
    `- Integridade preexistente: **${report.pre_existing_integrity}**`,
    `- Delta esperado: **${report.expected_delta_status}**`,
    `- Ledger: **${report.ledger_status}**`,
    `- Linhas preexistentes removidas: ${report.unexpected_removals.length}`,
    `- Linhas preexistentes alteradas: ${report.unexpected_changes.length}`,
    `- Adições não manifestadas: ${report.unexpected_additions.length}`,
    `- Adições esperadas ausentes: ${report.missing_expected_additions.length}`,
    `- Tabelas esperadas sem snapshot: ${report.unknown_expected_tables.length}`,
    `- Tabelas do snapshot sem expectativa: ${report.unknown_snapshot_tables.length}`,
    "",
    "| Tabela | Esperadas | Adicionadas | Extras | Ausentes |",
    "|---|---:|---:|---:|---:|",
    ...Object.entries(report.expected_delta_by_table)
      .filter(([, d]) => d && typeof d === "object")
      .map(
        ([table, d]) =>
          `| \`${table}\` | ${d.expected_count} | ${d.added_count} | ${d.extras.length} | ${d.missing.length} |`,
      ),
    "",
    "> Adições fora do manifesto reprovam a prova. O ledger é comparado por contagem/SHA excluindo F60.",
  ];
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");
  const ok =
    report.pre_existing_integrity === "PASS" &&
    report.expected_delta_status === "PASS" &&
    report.ledger_status === "PASS";
  console.log(JSON.stringify({ ok, jsonPath, mdPath }));
  if (!ok) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[f60-snapshot] ${error.message}`);
    process.exitCode = 1;
  });
}
