#!/usr/bin/env node
// F50.3 — verificação da constraint de CNPJ alfanumérico no PostgreSQL local isolado.
//
// Alvo FIXO e fail-closed:
//   - container: supabase_db_vendeo-f562a-isolated
//   - DB:        postgresql://postgres:postgres@127.0.0.1:56322/postgres
//
// Qualquer host/porta/banco diferente de 127.0.0.1|localhost:56322/postgres
// aborta ANTES de abrir conexão. Nenhuma URL remota é aceita.
//
// Modos:
//   (sem flags)            executa todas as asserções e imprime o fingerprint atual
//   --print-fingerprint    imprime somente o md5 e sai 0 (nenhuma outra asserção)
//   --pre-fingerprint <md5> executa todas as asserções e compara o fingerprint com <md5>
//   --self-test            exercita expectCheckViolation com client simulado (sem banco)
//
// A matriz de constraint usa INSERT real dentro de uma transação com
// `session_replication_role = replica` (desliga triggers/FK, MANTÉM CHECK/NOT NULL)
// e `SAVEPOINT` por vetor, seguida de `ROLLBACK` final. Nenhuma fixture persiste.

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { Client } from "pg";

const EXPECTED_HOSTS = new Set(["127.0.0.1", "localhost"]);
const EXPECTED_PORT = "56322";
const EXPECTED_DATABASE = "postgres";
const EXPECTED_CONTAINER = "supabase_db_vendeo-f562a-isolated";
const CONTAINER_PORT_KEY = "5432/tcp";
const DEFAULT_DB_URL = "postgresql://postgres:postgres@127.0.0.1:56322/postgres";
const DB_URL = process.env.F50_3_DB_URL ?? DEFAULT_DB_URL;

const EXPECTED_STORES = 327;
const EXPECTED_WITH_CNPJ = 5;
const EXPECTED_ALPHANUMERIC = 0;
const EXPECTED_CACHE_ROWS = 1;
const CONSTRAINT_NAME = "chk_stores_cnpj_atomic";
const CHECK_VIOLATION = "23514";
const ALPHANUMERIC_PATTERN = "[A-Z0-9]{12}[0-9]{2}";

const FINGERPRINT_SQL = `
  SELECT md5(string_agg(
    id::text || '|' || coalesce(cnpj_normalized, '') || '|' || cnpj_root_hash,
    ',' ORDER BY id
  )) AS fingerprint
  FROM public.stores
`;

const results = [];
let suppressAssertOutput = false;
const assert = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  if (!suppressAssertOutput) console.log(`${ok ? "PASS" : "FAIL"} ${name}${ok ? "" : ` — ${detail}`}`);
};

// ---------------------------------------------------------------------------
// Guards — executados antes de qualquer conexão
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const options = { mode: "verify", preFingerprint: null };
  if (argv.includes("--print-fingerprint")) {
    options.mode = "print-fingerprint";
    return options;
  }
  if (argv.includes("--self-test")) {
    options.mode = "self-test";
    return options;
  }
  const preIndex = argv.indexOf("--pre-fingerprint");
  if (preIndex !== -1) {
    const value = argv[preIndex + 1];
    if (!value || !/^[0-9a-f]{32}$/i.test(value)) {
      throw new Error("--pre-fingerprint exige um md5 de 32 caracteres hexadecimais");
    }
    options.mode = "verify";
    options.preFingerprint = value.toLowerCase();
  }
  return options;
}

function assertFixedTarget(rawUrl) {
  if (/^https?:\/\//i.test(rawUrl)) {
    throw new Error(`Recusando alvo HTTP: ${rawUrl}`);
  }

  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error(`F50_3_DB_URL inválida: ${rawUrl}`);
  }

  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`Recusando protocolo ${parsed.protocol} — esperado postgresql://`);
  }
  if (!EXPECTED_HOSTS.has(parsed.hostname)) {
    throw new Error(`Recusando host remoto ${parsed.hostname} — esperado 127.0.0.1|localhost`);
  }
  if (parsed.port !== EXPECTED_PORT) {
    throw new Error(`Recusando porta ${parsed.port || "(default)"} — esperado ${EXPECTED_PORT}`);
  }
  const database = parsed.pathname.replace(/^\//, "");
  if (database !== EXPECTED_DATABASE) {
    throw new Error(`Recusando database ${database} — esperado ${EXPECTED_DATABASE}`);
  }
  if (/supabase\.(co|in)/i.test(parsed.hostname)) {
    throw new Error("Recusando host de projeto Supabase remoto");
  }
}

function assertContainerIdentity() {
  let output;
  try {
    output = execFileSync(
      "docker",
      ["inspect", EXPECTED_CONTAINER, "--format", "{{.Name}} {{json .NetworkSettings.Ports}}"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    ).trim();
  } catch (error) {
    throw new Error(
      `Não foi possível inspecionar o container ${EXPECTED_CONTAINER}: ${error.message}. ` +
        "A verificação exige o alvo isolado explícito; nada foi executado.",
    );
  }

  const [name, portsJson] = output.split(" ", 2);
  if (name !== `/${EXPECTED_CONTAINER}`) {
    throw new Error(`Container inesperado: ${name} — esperado /${EXPECTED_CONTAINER}`);
  }

  let ports;
  try {
    ports = JSON.parse(portsJson);
  } catch {
    throw new Error(`Não foi possível interpretar o mapeamento de portas: ${portsJson}`);
  }

  const bindings = ports[CONTAINER_PORT_KEY] ?? [];
  const hostBindings = bindings.map((binding) => `${binding.HostIp}:${binding.HostPort}`);
  const expectedBindings = [`127.0.0.1:${EXPECTED_PORT}`, `0.0.0.0:${EXPECTED_PORT}`];
  if (!hostBindings.some((binding) => expectedBindings.includes(binding))) {
    throw new Error(
      `Mapeamento de porta inesperado (${hostBindings.join(", ") || "vazio"}); ` +
        `esperado ${CONTAINER_PORT_KEY} → ${EXPECTED_PORT}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function newActorId() {
  return crypto.randomUUID();
}

function randomBody(numeric) {
  const alphabet = numeric
    ? "0123456789"
    : "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let body = "";
  for (let index = 0; index < 12; index += 1) {
    body += alphabet[crypto.randomInt(alphabet.length)];
  }
  return body;
}

function randomCnpj({ numeric = false } = {}) {
  let body = randomBody(numeric);
  if (!numeric) {
    while (!/[A-Z]/.test(body)) body = randomBody(false);
  }
  const firstDigit = String(crypto.randomInt(10));
  const secondDigit = String(crypto.randomInt(10));
  return `${body}${firstDigit}${secondDigit}`;
}

async function generateUniqueCnpj(client, options) {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = randomCnpj(options);
    const existing = await client.query(
      "SELECT 1 FROM public.stores WHERE cnpj_normalized = $1 LIMIT 1",
      [candidate],
    );
    if (existing.rowCount === 0) return candidate;
  }
  throw new Error("Não foi possível gerar um CNPJ único para o vetor positivo");
}

async function insertStore(client, vector) {
  return client.query(
    `INSERT INTO public.stores
       (user_id, name, segment, cnpj_normalized, cnpj_root_hash, razao_social, nome_fantasia)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      newActorId(),
      vector.name,
      "outros",
      vector.cnpjNormalized,
      vector.cnpjRootHash,
      vector.razaoSocial ?? null,
      vector.nomeFantasia ?? null,
    ],
  );
}

async function expectCheckViolation(client, label, vector, savepoint) {
  await client.query(`SAVEPOINT ${savepoint}`);
  let error = null;
  try {
    await insertStore(client, vector);
  } catch (caught) {
    error = caught;
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  }

  const isCheckViolation = error?.code === CHECK_VIOLATION;
  const isSameConstraint = error?.constraint === CONSTRAINT_NAME;
  assert(
    `${label}: rejeitado com ${CHECK_VIOLATION} em ${CONSTRAINT_NAME}`,
    isCheckViolation && isSameConstraint,
    error
      ? `code=${error.code ?? "?"} constraint=${error.constraint ?? "?"} message=${error.message}`
      : "INSERT foi aceito (nenhum erro retornado)",
  );
}

async function expectAccepted(client, label, vector, savepoint) {
  await client.query(`SAVEPOINT ${savepoint}`);
  let error = null;
  try {
    await insertStore(client, vector);
  } catch (caught) {
    error = caught;
  } finally {
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
  }

  assert(
    `${label}: aceito pela constraint`,
    error === null,
    error ? `code=${error.code ?? "?"} message=${error.message}` : "",
  );
}

async function readBaseline(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public.stores) AS stores,
      (SELECT count(*)::int FROM public.stores WHERE cnpj_normalized IS NOT NULL) AS with_cnpj,
      (SELECT count(*)::int FROM public.stores WHERE cnpj_normalized ~ '[A-Z]') AS alphanumeric,
      (SELECT count(*)::int FROM public.cnpj_lookup_cache) AS cache_rows
  `);
  return rows[0];
}

async function readFingerprint(client) {
  const { rows } = await client.query(FINGERPRINT_SQL);
  return rows[0]?.fingerprint ?? null;
}

// ---------------------------------------------------------------------------
// Self-test offline — exercita expectCheckViolation sem conectar ao banco
// ---------------------------------------------------------------------------

function createSimulatedCheckClient(outcome) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql, params });
      if (sql.trimStart().toUpperCase().startsWith("INSERT")) {
        if (outcome.accept) return { rowCount: 1, rows: [] };
        throw outcome.error;
      }
      return { rowCount: 0, rows: [] };
    },
  };
}

async function runSelfTest() {
  console.log("\nF50.3 CNPJ alfanumerico verifier self-test (sem banco)\n");
  const startIndex = results.length;
  const cases = [
    {
      name: "23514 + chk_stores_cnpj_atomic aceita a rejeicao esperada",
      outcome: {
        accept: false,
        error: {
          code: CHECK_VIOLATION,
          constraint: CONSTRAINT_NAME,
          message: "new row violates check constraint",
        },
      },
      expectedOk: true,
      expectedDetailPattern: null,
    },
    {
      name: "23505 registra falha",
      outcome: {
        accept: false,
        error: {
          code: "23505",
          constraint: "stores_user_id_key",
          message: "duplicate key value violates unique constraint",
        },
      },
      expectedOk: false,
      expectedDetailPattern: "code=23505",
    },
    {
      name: "ausencia de erro registra falha",
      outcome: { accept: true, error: null },
      expectedOk: false,
      expectedDetailPattern: "INSERT foi aceito",
    },
  ];

  for (const [index, testCase] of cases.entries()) {
    const position = index + 1;
    const client = createSimulatedCheckClient(testCase.outcome);
    const savepoint = `self_test_sp_${position}`;
    suppressAssertOutput = true;
    try {
      await expectCheckViolation(
        client,
        `self-test ${position}`,
        { name: "F50.3 self-test", cnpjNormalized: "12ABC34501DE35", cnpjRootHash: "root" },
        savepoint,
      );
    } finally {
      suppressAssertOutput = false;
    }

    // Remove a asserção exercitada do tally: o self-test avalia o efeito dela
    // separadamente e não deve contá-la como falha própria.
    const entry = results.pop();
    assert(
      `self-test ${position}: ${testCase.name}`,
      entry.ok === testCase.expectedOk,
      `esperado ok=${testCase.expectedOk}, obtido ok=${entry.ok} (${entry.detail})`,
    );
    if (testCase.expectedDetailPattern) {
      assert(
        `self-test ${position}: detalhe contem "${testCase.expectedDetailPattern}"`,
        String(entry.detail).includes(testCase.expectedDetailPattern),
        `detalhe=${entry.detail}`,
      );
    }

    const inserts = client.calls.filter((call) =>
      call.sql.trimStart().toUpperCase().startsWith("INSERT"),
    );
    assert(`self-test ${position}: INSERT tentado uma vez`, inserts.length === 1, `tentativas=${inserts.length}`);

    const rollbacks = client.calls.filter(
      (call) => call.sql === `ROLLBACK TO SAVEPOINT ${savepoint}`,
    );
    assert(
      `self-test ${position}: rollback ao savepoint executado uma vez`,
      rollbacks.length === 1,
      `rollbacks=${rollbacks.length}`,
    );

    const savepointIndex = client.calls.findIndex((call) => call.sql === `SAVEPOINT ${savepoint}`);
    const rollbackIndex = client.calls.findIndex(
      (call) => call.sql === `ROLLBACK TO SAVEPOINT ${savepoint}`,
    );
    assert(
      `self-test ${position}: savepoint antes do rollback`,
      savepointIndex !== -1 && rollbackIndex > savepointIndex,
      `savepoint=${savepointIndex} rollback=${rollbackIndex}`,
    );
  }

  const failed = results.slice(startIndex).filter((result) => !result.ok);
  console.log(
    `\nSelf-test: ${results.length - startIndex - failed.length} passed / ${failed.length} failed / ${results.length - startIndex} total`,
  );
  if (failed.length > 0) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Verificação principal
// ---------------------------------------------------------------------------

async function verify(client, options) {
  const identity = await client.query(
    "SELECT current_database() AS database, current_setting('server_version') AS version",
  );
  assert(
    "banco conectado é o esperado (postgres)",
    identity.rows[0]?.database === EXPECTED_DATABASE,
    `database=${identity.rows[0]?.database}`,
  );
  assert(
    "servidor é PostgreSQL 17.x",
    String(identity.rows[0]?.version ?? "").startsWith("17."),
    `version=${identity.rows[0]?.version}`,
  );

  const baseline = await readBaseline(client);
  assert("baseline de lojas = 327", baseline.stores === EXPECTED_STORES, `stores=${baseline.stores}`);
  assert(
    "baseline de lojas com CNPJ = 5",
    baseline.with_cnpj === EXPECTED_WITH_CNPJ,
    `with_cnpj=${baseline.with_cnpj}`,
  );
  assert(
    "baseline de CNPJs alfanuméricos = 0",
    baseline.alphanumeric === EXPECTED_ALPHANUMERIC,
    `alphanumeric=${baseline.alphanumeric}`,
  );
  assert(
    "baseline de linhas em cnpj_lookup_cache = 1",
    baseline.cache_rows === EXPECTED_CACHE_ROWS,
    `cache_rows=${baseline.cache_rows}`,
  );

  const constraint = await client.query(
    `SELECT pg_get_constraintdef(oid) AS definition, convalidated
       FROM pg_constraint
      WHERE conname = $1
        AND conrelid = 'public.stores'::regclass`,
    [CONSTRAINT_NAME],
  );
  const definition = constraint.rows[0]?.definition ?? "";
  assert(
    `constraint ${CONSTRAINT_NAME} contém ${ALPHANUMERIC_PATTERN}`,
    definition.includes(ALPHANUMERIC_PATTERN),
    `definition=${definition}`,
  );
  assert(
    `constraint ${CONSTRAINT_NAME} está validada (convalidated = true)`,
    constraint.rows[0]?.convalidated === true,
    `convalidated=${constraint.rows[0]?.convalidated}`,
  );

  const indexes = await client.query(
    `SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'stores'
        AND indexname = ANY($1::text[])`,
    [["idx_stores_cnpj_normalized", "idx_stores_cnpj_root_hash"]],
  );
  const indexNames = new Set(indexes.rows.map((row) => row.indexname));
  assert(
    "índice idx_stores_cnpj_normalized existe",
    indexNames.has("idx_stores_cnpj_normalized"),
    `indexes=${[...indexNames].join(",")}`,
  );
  assert(
    "índice idx_stores_cnpj_root_hash existe",
    indexNames.has("idx_stores_cnpj_root_hash"),
    `indexes=${[...indexNames].join(",")}`,
  );

  const fingerprintBeforeVectors = await readFingerprint(client);

  // Matriz de constraint — transação única, isolamento por SAVEPOINT.
  await client.query("BEGIN");
  try {
    await client.query("SET LOCAL session_replication_role = replica");

    const positiveAlpha = await generateUniqueCnpj(client, { numeric: false });
    await expectAccepted(
      client,
      `positivo alfanumérico ${positiveAlpha}`,
      { name: "F50.3 vetor positivo alfa", cnpjNormalized: positiveAlpha, cnpjRootHash: "root-alfa" },
      "vector_positive_alpha",
    );

    const positiveNumeric = await generateUniqueCnpj(client, { numeric: true });
    await expectAccepted(
      client,
      `positivo numérico ${positiveNumeric}`,
      { name: "F50.3 vetor positivo numerico", cnpjNormalized: positiveNumeric, cnpjRootHash: "root-num" },
      "vector_positive_numeric",
    );

    const badFormats = [
      ["formato minúsculo", "12abc34501de35"],
      ["formato DV alfanumérico", "12ABC34501DE3A"],
      ["formato com 13 caracteres", "12ABC34501DE3"],
      ["formato com 15 caracteres", "12ABC34501DE355"],
    ];
    for (const [label, cnpj] of badFormats) {
      await expectCheckViolation(
        client,
        `rejeição ${label} (${cnpj})`,
        { name: "F50.3 vetor invalido", cnpjNormalized: cnpj, cnpjRootHash: "root-invalid" },
        `vector_bad_${badFormats.findIndex(([, value]) => value === cnpj)}`,
      );
    }

    await expectCheckViolation(
      client,
      "atomicidade B1: razao_social sem cnpj_normalized",
      { name: "F50.3 B1", cnpjNormalized: null, cnpjRootHash: "", razaoSocial: "EMPRESA X" },
      "vector_b1",
    );
    await expectCheckViolation(
      client,
      "atomicidade B2: nome_fantasia sem cnpj_normalized",
      { name: "F50.3 B2", cnpjNormalized: null, cnpjRootHash: "", nomeFantasia: "X" },
      "vector_b2",
    );
    await expectCheckViolation(
      client,
      "atomicidade B3: cnpj_normalized sem cnpj_root_hash",
      { name: "F50.3 B3", cnpjNormalized: "12ABC34501DE35", cnpjRootHash: "" },
      "vector_b3",
    );
  } finally {
    await client.query("ROLLBACK");
  }

  // Pós-rollback: nenhuma fixture pode ter persistido.
  const after = await readBaseline(client);
  assert("pós-vetores: lojas = 327", after.stores === EXPECTED_STORES, `stores=${after.stores}`);
  assert(
    "pós-vetores: lojas com CNPJ = 5",
    after.with_cnpj === EXPECTED_WITH_CNPJ,
    `with_cnpj=${after.with_cnpj}`,
  );
  assert(
    "pós-vetores: CNPJs alfanuméricos = 0",
    after.alphanumeric === EXPECTED_ALPHANUMERIC,
    `alphanumeric=${after.alphanumeric}`,
  );
  assert(
    "pós-vetores: linhas em cnpj_lookup_cache = 1",
    after.cache_rows === EXPECTED_CACHE_ROWS,
    `cache_rows=${after.cache_rows}`,
  );

  const fingerprintAfter = await readFingerprint(client);
  console.log(`\nFingerprint atual: ${fingerprintAfter}`);
  assert(
    "fingerprint não mudou durante a matriz de vetores",
    fingerprintAfter === fingerprintBeforeVectors,
    `antes=${fingerprintBeforeVectors} depois=${fingerprintAfter}`,
  );

  if (options.preFingerprint) {
    assert(
      "fingerprint pós-migration é idêntico ao pré-migration",
      fingerprintAfter === options.preFingerprint,
      `pre=${options.preFingerprint} pos=${fingerprintAfter}`,
    );
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));

  if (options.mode === "self-test") {
    await runSelfTest();
    return;
  }

  assertFixedTarget(DB_URL);

  if (options.mode !== "print-fingerprint") {
    console.log("\nF50.3 CNPJ alfanumérico verification (alvo isolado 127.0.0.1:56322)\n");
  }

  assertContainerIdentity();

  const client = new Client({ connectionString: DB_URL, application_name: "f50_3_verify" });
  await client.connect();
  try {
    if (options.mode === "print-fingerprint") {
      const fingerprint = await readFingerprint(client);
      if (!fingerprint) throw new Error("Fingerprint indisponível (tabela stores vazia?)");
      console.log(fingerprint);
      return;
    }

    await verify(client, options);

    const failed = results.filter((result) => !result.ok);
    console.log(
      `\nResults: ${results.length - failed.length} passed / ${failed.length} failed / ${results.length} total`,
    );
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error(`\nBLOCKED/FAILED: ${error.message}`);
  process.exitCode = 1;
});
