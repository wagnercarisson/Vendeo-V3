#!/usr/bin/env node
/**
 * F63 — identidade e baseline somente leitura do homolog existente.
 *
 * Escopo (63-01):
 *   - Provar o alvo antes de qualquer escrita: container, mapeamento de porta,
 *     banco e versão do servidor.
 *   - Registrar ledger/fingerprint, presença de tabelas, estado pré-migração,
 *     guardas de schema e baseline determinístico das tabelas preservadas.
 *   - Gerar JSON versionável e Markdown de preflight, sem credenciais.
 *
 * Este módulo é somente leitura: usa `docker inspect`, `docker port` e
 * consultas de leitura via `docker exec psql`. Não há DDL nem DML, não cria
 * banco, não reseta ambiente e não dispara suítes de teste.
 *
 * Uso:
 *   node scripts/f63/homolog-identity.mjs --dry-run
 *   node scripts/f63/homolog-identity.mjs --out <json> --md-out <md>
 *   node scripts/f63/homolog-identity.mjs --verify <json>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const HOMOLOG_CONTAINER = 'supabase_db_vendeo-homolog';
export const HOMOLOG_HOST = '127.0.0.1';
export const HOMOLOG_PORT = '57782';
export const HOMOLOG_CONTAINER_PORT = '5432';
export const HOMOLOG_DATABASE = 'postgres';
export const HOMOLOG_WORKDIR = 'G:\\Vendeo-Homolog';

/** Publicações aceitas para o mapeamento host -> container (5432). */
export const PUBLISHED_ALLOWED = [
  `0.0.0.0:${HOMOLOG_PORT}`,
  `127.0.0.1:${HOMOLOG_PORT}`,
  `[::]:${HOMOLOG_PORT}`,
];

/** Tabelas cuja contagem+checksum precisam ser idênticas antes/depois. */
export const PRESERVED_TABLES = [
  { table: 'trial_offer_enrollments', key: 'id' },
  { table: 'credit_balances', key: 'store_id' },
  { table: 'credit_transactions', key: 'id' },
  { table: 'freemium_entitlements', key: 'id' },
];

/** Tabelas da oferta cuja presença é registrada no baseline. */
export const TRACKED_TABLES = [
  'trial_offer_settings',
  'trial_offer_enrollments',
  'credit_balances',
  'credit_transactions',
  'freemium_entitlements',
  'trial_offer_versions',
];

/** Colunas pré-existentes de trial_offer_settings (oito campos do guard). */
export const SETTINGS_COLUMNS = [
  'id',
  'offer_key',
  'enabled',
  'launch_at',
  'individual_launch_at',
  'updated_by',
  'updated_at',
  'created_at',
];

/** Assinaturas das cinco RPCs atuais da oferta, congeladas por hash. */
export const SCHEMA_FUNCTION_SIGNATURES = [
  'public.start_trial_offer_enrollment(uuid,timestamptz)',
  'public.grant_trial_offer_installment(uuid,integer,timestamptz)',
  'public.process_trial_offer_installments(timestamptz)',
  'public.trial_offer_eligibility(uuid,timestamptz)',
  'public.admin_set_trial_offer_enabled(boolean,uuid,text,uuid)',
];

export const BASELINE_REQUIRED_KEYS = [
  'phase',
  'captured_at_utc',
  'read_only',
  'environment',
  'ledger',
  'tables_present',
  'pre_state',
  'settings_guard',
  'schema_guards',
  'preserved',
  'fingerprint_scope',
  'commands',
];

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const LEDGER_TABLE = 'supabase_migrations.schema_migrations';
const DOCKER_TIMEOUT_MS = 60_000;

/**
 * Regex de conteúdo semelhante a credencial, ancorado em atribuição/segredo.
 * Não casa o nome do container `supabase_db_vendeo-homolog`.
 */
const CREDENTIAL_LIKE = new RegExp(
  [
    '(postgres(ql)?:\\/\\/\\S+)',
    '(password\\s*=\\s*\\S+)',
    '(PGPASSWORD\\s*=\\s*\\S+)',
    '(SUPABASE_(ACCESS_TOKEN|DB_URL|SERVICE_ROLE_KEY|ANON_KEY|URL)\\s*=\\s*\\S+)',
    '(service_role_key\\s*=\\s*\\S+)',
    '(eyJ[A-Za-z0-9_-]{20,})',
  ].join('|'),
  'i',
);

function runDocker(args) {
  try {
    return execFileSync('docker', args, {
      encoding: 'utf8',
      timeout: DOCKER_TIMEOUT_MS,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = String(error?.stderr ?? error?.message ?? '').trim();
    throw new Error(`docker ${args[0]} failed${detail ? `: ${detail}` : ''}`);
  }
}

function runSql(sql) {
  const args = [
    'exec',
    HOMOLOG_CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    HOMOLOG_DATABASE,
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-tAXq',
    '-c',
    sql,
  ];
  return runDocker(args).replace(/\r\n/g, '\n').trim();
}

function lastLine(text) {
  const lines = text.split('\n').filter((line) => line.length > 0);
  if (lines.length === 0) return '';
  return lines[lines.length - 1];
}

function splitHostPort(value) {
  const idx = value.lastIndexOf(':');
  if (idx <= 0) return [value, ''];
  return [value.slice(0, idx), value.slice(idx + 1)];
}

export function parsePublishedMappings(raw) {
  const lines = raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return lines.map((line) => {
    const arrow = line.match(/^(\d+)\/tcp\s*->\s*(\S+)$/);
    if (arrow) {
      const [host, hostPort] = splitHostPort(arrow[2]);
      return { raw: line, host, hostPort, containerPort: Number(arrow[1]) };
    }
    const [host, hostPort] = splitHostPort(line);
    return {
      raw: line,
      host,
      hostPort,
      containerPort: Number(HOMOLOG_CONTAINER_PORT),
    };
  });
}

function isLoopbackHostname(hostname) {
  return ['127.0.0.1', 'localhost', '[::1]', '::1'].includes(hostname);
}

/**
 * Valida uma URL de banco sem imprimir nem persistir o valor.
 * Aceita apenas loopback em 127.0.0.1:57782/postgres.
 */
export function validateTargetUrl(rawUrl) {
  if (rawUrl === undefined || rawUrl === null || rawUrl === '') {
    return { present: false, matches: false };
  }
  let parsed;
  try {
    parsed = new URL(String(rawUrl));
  } catch {
    throw new Error('target URL is not parseable (value withheld)');
  }
  const protocolOk = parsed.protocol === 'postgresql:' || parsed.protocol === 'postgres:';
  const matches =
    protocolOk &&
    parsed.hostname === HOMOLOG_HOST &&
    parsed.port === HOMOLOG_PORT &&
    parsed.pathname === `/${HOMOLOG_DATABASE}`;
  if (!isLoopbackHostname(parsed.hostname) || !matches) {
    throw new Error(
      `target URL must be ${HOMOLOG_HOST}:${HOMOLOG_PORT}/${HOMOLOG_DATABASE} (value withheld)`,
    );
  }
  return { present: true, matches: true };
}

/** Recusa execução com tokens de acesso remoto no ambiente. */
export function assertNoRemoteSupabaseEnv(env = process.env) {
  if (env.SUPABASE_ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN must be absent in the homolog workflow');
  }
  if (env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL must be absent in the homolog workflow');
  }
  validateTargetUrl(env.TEST_DATABASE_URL);
}

/**
 * Coleta a identidade do alvo. Apenas coleta: não lança por divergência.
 * `assertHomologIdentity()` é quem valida as invariantes.
 */
export async function readHomologIdentity() {
  assertNoRemoteSupabaseEnv();

  if (!fs.existsSync(HOMOLOG_WORKDIR)) {
    throw new Error(`homolog workdir not found: ${HOMOLOG_WORKDIR}`);
  }

  const inspectOut = runDocker([
    'inspect',
    '-f',
    '{{.Name}}|{{.State.Running}}|{{.Config.Image}}',
    HOMOLOG_CONTAINER,
  ]).trim();
  const [inspectName, runningRaw, image] = inspectOut.split('|');

  const portOut = runDocker(['port', HOMOLOG_CONTAINER, HOMOLOG_CONTAINER_PORT]);
  const mappings = parsePublishedMappings(portOut);
  const published = mappings.map((mapping) => mapping.raw).join(',');

  const serverRow = lastLine(
    runSql(
      "select current_database(), current_user, coalesce(inet_server_port(), current_setting('port')::int), current_setting('server_version');",
    ),
  );
  const [database, user, internalPortRaw, serverVersion] = serverRow.split('|');
  const containerPort = mappings.length > 0
    ? mappings[0].containerPort
    : Number(HOMOLOG_CONTAINER_PORT);

  return {
    container: HOMOLOG_CONTAINER,
    running: runningRaw === 'true',
    image: image ?? '',
    published,
    containerPort,
    database: database ?? '',
    serverVersion: serverVersion ?? '',
    workdir: HOMOLOG_WORKDIR,
    internalPort: Number(internalPortRaw),
    user: user ?? '',
    containerName: inspectName ?? '',
  };
}

/**
 * Valida as invariantes de identidade e devolve o alvo confirmado.
 * Lança erro com mensagem específica quando qualquer invariante falha.
 */
export async function assertHomologIdentity() {
  const identity = await readHomologIdentity();

  if (identity.containerName !== `/${HOMOLOG_CONTAINER}`) {
    throw new Error(
      `unexpected container name: ${identity.containerName} (expected /${HOMOLOG_CONTAINER})`,
    );
  }
  if (!identity.running) {
    throw new Error(`container ${HOMOLOG_CONTAINER} is not running`);
  }
  if (identity.database !== HOMOLOG_DATABASE) {
    throw new Error(`unexpected database: ${identity.database} (expected ${HOMOLOG_DATABASE})`);
  }
  if (identity.internalPort !== Number(HOMOLOG_CONTAINER_PORT)) {
    throw new Error(
      `unexpected internal port: ${identity.internalPort} (expected ${HOMOLOG_CONTAINER_PORT})`,
    );
  }
  if (!identity.serverVersion) {
    throw new Error('server_version is empty');
  }
  if (!fs.existsSync(HOMOLOG_WORKDIR)) {
    throw new Error(`homolog workdir not found: ${HOMOLOG_WORKDIR}`);
  }

  if (identity.published.length === 0) {
    throw new Error(`no published mapping for container port ${HOMOLOG_CONTAINER_PORT}`);
  }
  for (const raw of identity.published.split(',')) {
    if (!PUBLISHED_ALLOWED.includes(raw)) {
      throw new Error(
        `unexpected published mapping: ${raw} (expected host ${HOMOLOG_PORT} -> container ${HOMOLOG_CONTAINER_PORT})`,
      );
    }
  }
  if (!identity.published.includes(`:${HOMOLOG_PORT}`)) {
    throw new Error(`published mapping does not expose host port ${HOMOLOG_PORT}`);
  }

  return identity;
}

/**
 * Fingerprint do ledger sobre TODAS as linhas (`version|name` por linha).
 * Semântica `all_rows`, diferente do F57.2, que exclui nomes com `f57_2_`.
 * O F57.2 não é executado nesta fase.
 */
export async function readLedgerFingerprint() {
  const out = runSql(
    `select version, coalesce(name, '') from ${LEDGER_TABLE} order by version;`,
  );
  const rows = out.length === 0
    ? []
    : out.split('\n').map((line) => {
      const idx = line.indexOf('|');
      const version = idx === -1 ? line : line.slice(0, idx);
      const nameRaw = idx === -1 ? '' : line.slice(idx + 1);
      return { version, name: nameRaw.length > 0 ? nameRaw : null };
    });

  const payload = rows.map((row) => `${row.version}|${row.name ?? ''}`).join('\n');
  const sha256 = crypto.createHash('sha256').update(payload, 'utf8').digest('hex');

  return {
    count: rows.length,
    maxVersion: rows.length > 0 ? rows[rows.length - 1].version : null,
    sha256,
    lastRows: rows.slice(-5).map((row) => ({ version: row.version, name: row.name })),
  };
}

/**
 * Baseline determinístico de contagem+checksum (md5 e sha256) por tabela.
 * Sessão fixa em UTC/ISO para que o texto das linhas não dependa do ambiente.
 */
export async function readPreservedSnapshot() {
  const snapshot = {};
  for (const { table, key } of PRESERVED_TABLES) {
    const sql = [
      "SET TIME ZONE 'UTC';",
      "SET DateStyle TO 'ISO, YMD';",
      `select count(*)::bigint, md5(coalesce(string_agg(t::text, E'\\n' order by t.${key}), '')), encode(extensions.digest(coalesce(string_agg(t::text, E'\\n' order by t.${key}), ''), 'sha256'), 'hex') from public.${table} t;`,
    ].join('\n');
    const line = lastLine(runSql(sql));
    const [countRaw, md5, sha256] = line.split('|');
    if (!countRaw || !md5 || !sha256) {
      throw new Error(`unexpected checksum output for ${table}`);
    }
    snapshot[table] = {
      count: Number(countRaw),
      row_checksum_md5: md5,
      sha256,
    };
  }
  return snapshot;
}

/** Guardas de schema: hashes das cinco RPCs e nomes bare das colunas. */
export async function readSchemaGuards() {
  const fnQuery = SCHEMA_FUNCTION_SIGNATURES.map(
    (signature) =>
      `select '${signature}' as signature, coalesce(md5(pg_get_functiondef(to_regprocedure('${signature}'))), '') as hash`,
  ).join(' union all ');
  const fnOut = runSql(`${fnQuery} order by signature;`);

  const functions = {};
  for (const line of fnOut.split('\n').filter((entry) => entry.length > 0)) {
    const idx = line.indexOf('|');
    const signature = line.slice(0, idx);
    const hash = line.slice(idx + 1);
    if (!hash) {
      throw new Error(`missing function definition: ${signature}`);
    }
    functions[signature] = hash;
  }
  for (const signature of SCHEMA_FUNCTION_SIGNATURES) {
    if (!functions[signature]) {
      throw new Error(`missing function definition: ${signature}`);
    }
  }

  const columnOut = runSql(
    "select table_name, column_name from information_schema.columns where table_schema = 'public' and table_name in ('trial_offer_enrollments', 'trial_offer_settings') order by table_name, ordinal_position;",
  );
  const enrollmentColumns = [];
  const settingsColumns = [];
  for (const line of columnOut.split('\n').filter((entry) => entry.length > 0)) {
    const [tableName, columnName] = line.split('|');
    if (tableName === 'trial_offer_enrollments') enrollmentColumns.push(columnName);
    if (tableName === 'trial_offer_settings') settingsColumns.push(columnName);
  }

  return {
    functions,
    trial_offer_enrollments_columns: enrollmentColumns,
    trial_offer_settings_columns: settingsColumns,
  };
}

/** Linha singleton de trial_offer_settings com os oito campos do guard. */
export async function readSettingsGuard() {
  const selector = SETTINGS_COLUMNS.map((column) => `'${column}', ${column}`).join(', ');
  const sql = [
    "SET TIME ZONE 'UTC';",
    "SET DateStyle TO 'ISO, YMD';",
    `select json_build_object(${selector})::text from public.trial_offer_settings where offer_key = 'trial_28d_v1';`,
  ].join('\n');
  const line = lastLine(runSql(sql));
  if (!line) {
    throw new Error('trial_offer_settings singleton not found (offer_key = trial_28d_v1)');
  }
  return JSON.parse(line);
}

/** Estado de vigência/versões, usado pelo relatório de preservação. */
export async function readVersionState() {
  const present = lastLine(runSql("select to_regclass('public.trial_offer_versions') is not null;"));
  if (present !== 't') {
    return {
      table_present: false,
      current_version_id: null,
      current_version_id_nullable: true,
      current_version_label: null,
      total: 0,
      published_count: 0,
      draft_count: 0,
      rows: [],
    };
  }

  const sql = [
    "SET TIME ZONE 'UTC';",
    "SET DateStyle TO 'ISO, YMD';",
    "select coalesce((select current_version_id::text from public.trial_offer_settings where offer_key = 'trial_28d_v1'), ''),",
    "(select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'trial_offer_settings' and column_name = 'current_version_id'),",
    "coalesce((select v.version_label from public.trial_offer_settings s left join public.trial_offer_versions v on v.id = s.current_version_id where s.offer_key = 'trial_28d_v1'), ''),",
    "(select count(*) from public.trial_offer_versions),",
    "(select count(*) from public.trial_offer_versions where published_at is not null),",
    "(select count(*) from public.trial_offer_versions where published_at is null);",
  ].join('\n');
  const stateLine = lastLine(runSql(sql));
  const [currentVersionId, nullable, currentLabel, total, published, drafts] = stateLine.split('|');

  const rowsOut = runSql(
    "SET TIME ZONE 'UTC';\nSET DateStyle TO 'ISO, YMD';\nselect version_label, coalesce(published_at::text, ''), id::text from public.trial_offer_versions order by version_label, id;",
  );
  const rows = rowsOut.length === 0
    ? []
    : rowsOut.split('\n').map((line) => {
      const [versionLabel, publishedAt, id] = line.split('|');
      return { version_label: versionLabel, published_at: publishedAt || null, id };
    });

  return {
    table_present: true,
    current_version_id: currentVersionId || null,
    current_version_id_nullable: nullable === 'YES',
    current_version_label: currentLabel || null,
    total: Number(total),
    published_count: Number(published),
    draft_count: Number(drafts),
    rows,
  };
}

async function readTablesPresent() {
  const out = runSql(
    `select tablename from pg_tables where schemaname = 'public' and tablename in (${TRACKED_TABLES.map((name) => `'${name}'`).join(', ')});`,
  );
  const found = new Set(out.split('\n').filter((line) => line.length > 0));
  const result = {};
  for (const name of TRACKED_TABLES) result[name] = found.has(name);
  return result;
}

async function readPreState() {
  const sql = [
    "select (to_regclass('public.trial_offer_versions') is null)::text,",
    "(not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'trial_offer_settings' and column_name = 'current_version_id'))::text,",
    '(select count(*) from public.trial_offer_settings)::text;',
  ].join('\n');
  const [versionsAbsent, currentVersionIdAbsent, singletonCount] = lastLine(runSql(sql)).split('|');
  return {
    trial_offer_versions_absent: versionsAbsent === 'true' || versionsAbsent === 't',
    current_version_id_absent: currentVersionIdAbsent === 'true' || currentVersionIdAbsent === 't',
    settings_singleton_count: Number(singletonCount),
  };
}

function commandsUsed() {
  return [
    `docker inspect -f '{{.Name}}|{{.State.Running}}|{{.Config.Image}}' ${HOMOLOG_CONTAINER}`,
    `docker port ${HOMOLOG_CONTAINER} ${HOMOLOG_CONTAINER_PORT}`,
    `docker exec ${HOMOLOG_CONTAINER} psql -U postgres -d ${HOMOLOG_DATABASE} -tAXq -c "<select only>"`,
    'node scripts/f63/homolog-identity.mjs --out <json> --md-out <md>',
    'node scripts/f63/homolog-identity.mjs --verify <json>',
  ];
}

export async function buildBaseline() {
  const identity = await assertHomologIdentity();
  const ledger = await readLedgerFingerprint();
  const preserved = await readPreservedSnapshot();
  const schemaGuards = await readSchemaGuards();
  const settingsGuard = await readSettingsGuard();
  const preState = await readPreState();
  const tablesPresent = await readTablesPresent();

  return {
    phase: '63',
    captured_at_utc: new Date().toISOString(),
    read_only: true,
    environment: {
      workdir: identity.workdir,
      container: identity.container,
      published: identity.published,
      container_port: identity.containerPort,
      database: identity.database,
      server_version: identity.serverVersion,
      image: identity.image,
    },
    ledger: {
      count: ledger.count,
      max_version: ledger.maxVersion,
      sha256: ledger.sha256,
      last_rows: ledger.lastRows,
    },
    tables_present: tablesPresent,
    pre_state: preState,
    settings_guard: settingsGuard,
    schema_guards: schemaGuards,
    preserved,
    fingerprint_scope: 'all_rows',
    commands: commandsUsed(),
  };
}

function verifyBaseline(file) {
  const errors = [];
  let raw;
  let data;
  try {
    raw = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    data = JSON.parse(raw);
  } catch (error) {
    return { ok: false, errors: [`unreadable baseline: ${error.message}`] };
  }

  for (const key of BASELINE_REQUIRED_KEYS) {
    if (!(key in data)) errors.push(`missing key: ${key}`);
  }
  if (data.read_only !== true) errors.push('read_only must be true');
  if (data.phase !== '63') errors.push('phase must be "63"');
  if (data.fingerprint_scope !== 'all_rows') errors.push('fingerprint_scope must be "all_rows"');
  if (!data.pre_state || data.pre_state.trial_offer_versions_absent !== true) {
    errors.push('pre_state.trial_offer_versions_absent must be true');
  }
  if (!data.pre_state || data.pre_state.current_version_id_absent !== true) {
    errors.push('pre_state.current_version_id_absent must be true');
  }
  if (!data.pre_state || data.pre_state.settings_singleton_count !== 1) {
    errors.push('pre_state.settings_singleton_count must be 1');
  }
  if (!data.settings_guard || !('individual_launch_at' in data.settings_guard)) {
    errors.push('settings_guard.individual_launch_at is missing');
  }
  for (const column of SETTINGS_COLUMNS) {
    if (!data.settings_guard || !(column in data.settings_guard)) {
      errors.push(`settings_guard missing ${column}`);
    }
  }
  const functions = data.schema_guards?.functions ?? {};
  for (const signature of SCHEMA_FUNCTION_SIGNATURES) {
    if (!/^[0-9a-f]{32}$/.test(String(functions[signature] ?? ''))) {
      errors.push(`schema_guards.functions missing hash for ${signature}`);
    }
  }
  if (!Array.isArray(data.schema_guards?.trial_offer_enrollments_columns)) {
    errors.push('schema_guards.trial_offer_enrollments_columns must be an array');
  }
  if (!Array.isArray(data.schema_guards?.trial_offer_settings_columns)) {
    errors.push('schema_guards.trial_offer_settings_columns must be an array');
  }
  if (!data.preserved || Object.keys(data.preserved).length !== PRESERVED_TABLES.length) {
    errors.push('preserved must contain the four preserved tables');
  }
  for (const { table } of PRESERVED_TABLES) {
    const entry = data.preserved?.[table];
    if (!entry) {
      errors.push(`preserved missing ${table}`);
      continue;
    }
    if (typeof entry.count !== 'number' || typeof entry.row_checksum_md5 !== 'string' || typeof entry.sha256 !== 'string') {
      errors.push(`preserved.${table} must contain count, row_checksum_md5 and sha256`);
    }
  }
  if (typeof data.environment?.published !== 'string' || !new RegExp(`:${HOMOLOG_PORT}`).test(data.environment.published)) {
    errors.push(`environment.published must expose host port ${HOMOLOG_PORT}`);
  }
  if (typeof data.ledger?.count !== 'number' || !/^[0-9a-f]{64}$/.test(String(data.ledger?.sha256 ?? ''))) {
    errors.push('ledger must contain count and sha256');
  }
  if ('reserved_migration_timestamps' in data) {
    errors.push('reserved_migration_timestamps must not be present');
  }
  const keyLeak = JSON.stringify(Object.keys(flatKeys(data))).toLowerCase();
  if (keyLeak.includes('f57_2')) {
    errors.push('baseline must not contain F57.2 baseline fields');
  }
  if (CREDENTIAL_LIKE.test(raw)) {
    errors.push('baseline contains credential-like content');
  }

  return { ok: errors.length === 0, errors, data };
}

function flatKeys(object, prefix = '', out = {}) {
  if (object === null || typeof object !== 'object' || Array.isArray(object)) {
    out[prefix] = true;
    return out;
  }
  for (const [key, value] of Object.entries(object)) {
    const next = prefix ? `${prefix}.${key}` : key;
    out[next] = true;
    flatKeys(value, next, out);
  }
  return out;
}

function writeArtifact(file, content) {
  const abs = path.resolve(process.cwd(), file);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return abs;
}

function renderMarkdown(baseline) {
  const env = baseline.environment;
  const targetUrlPresent = Boolean(process.env.TEST_DATABASE_URL);
  const ledgerRows = baseline.ledger.last_rows
    .map((row) => `| ${row.version} | ${row.name ?? '(sem nome)'} |`)
    .join('\n');
  const preservedRows = PRESERVED_TABLES.map(({ table }) => {
    const entry = baseline.preserved[table];
    return `| ${table} | ${entry.count} | \`${entry.row_checksum_md5}\` | \`${entry.sha256}\` |`;
  }).join('\n');
  const functionRows = Object.entries(baseline.schema_guards.functions)
    .map(([signature, hash]) => `| \`${signature}\` | \`${hash}\` |`)
    .join('\n');
  const settingsRows = SETTINGS_COLUMNS
    .map((column) => `| ${column} | ${baseline.settings_guard[column] === null ? 'NULL' : String(baseline.settings_guard[column])} |`)
    .join('\n');
  const tableRows = Object.entries(baseline.tables_present)
    .map(([name, present]) => `| ${name} | ${present ? 'presente' : 'ausente'} |`)
    .join('\n');

  return `# F63 / 63-01 — Preflight somente leitura do homolog

**Fase:** 63 — base versionada de ofertas (subfatia 2A)
**Plano:** 63-01
**Capturado (UTC):** ${baseline.captured_at_utc}
**Modo:** somente leitura (\`read_only: true\`)

## 1. Identidade do alvo

| Campo | Valor |
|---|---|
| Workdir | \`${env.workdir}\` |
| Container | \`${env.container}\` |
| Imagem | \`${env.image}\` |
| Publicação real | \`${env.published}\` |
| Porta interna do container | ${env.container_port} |
| Banco | \`${env.database}\` |
| Versão do servidor | ${env.server_version} |

Invariante confirmada: host ${HOMOLOG_PORT} -> container ${HOMOLOG_CONTAINER_PORT}, banco \`${HOMOLOG_DATABASE}\`.
O mapeamento publicado é aceito como \`0.0.0.0:${HOMOLOG_PORT}\`, \`127.0.0.1:${HOMOLOG_PORT}\` ou \`[::]:${HOMOLOG_PORT}\`;
o alvo lógico de conexão permanece \`${HOMOLOG_HOST}:${HOMOLOG_PORT}/${HOMOLOG_DATABASE}\` e qualquer host não-loopback é recusado.

A sessão \`docker exec psql\` conecta pelo socket local do container, onde \`inet_server_port()\` é nulo; por isso a porta interna é derivada de \`current_setting('port')\` e conferida contra o mapeamento \`docker port\` (ambas resultam em 5432).

## 2. Ledger (fingerprint \`all_rows\`)

| Campo | Valor |
|---|---|
| Contagem | ${baseline.ledger.count} |
| Maior versão | \`${baseline.ledger.max_version ?? 'NULL'}\` |
| SHA-256 | \`${baseline.ledger.sha256}\` |

Últimas linhas:

| Versão | Nome |
|---|---|
${ledgerRows}

## 3. Presença de tabelas

| Tabela | Estado |
|---|---|
${tableRows}

## 4. Estado pré-migração

| Chave | Valor |
|---|---|
| \`trial_offer_versions\` ausente | ${baseline.pre_state.trial_offer_versions_absent} |
| \`current_version_id\` ausente | ${baseline.pre_state.current_version_id_absent} |
| Linhas em \`trial_offer_settings\` | ${baseline.pre_state.settings_singleton_count} |

## 5. Baseline das tabelas preservadas

| Tabela | Contagem | MD5 (ordem por chave) | SHA-256 |
|---|---|---|---|
${preservedRows}

O checksum é calculado sobre \`t.<coluna>::text\` de todas as linhas, ordenado pela chave da tabela,
com sessão fixa em \`TimeZone = UTC\` e \`DateStyle = ISO, YMD\`.
As chaves usadas são \`id\` para \`trial_offer_enrollments\`, \`credit_transactions\` e \`freemium_entitlements\`, e \`store_id\` para \`credit_balances\`.

## 6. Guardas de schema

| Função | MD5 da definição |
|---|---|
${functionRows}

Colunas de \`trial_offer_enrollments\` (bare, ordem posicional):
${baseline.schema_guards.trial_offer_enrollments_columns.map((column) => `- ${column}`).join('\n')}

Colunas de \`trial_offer_settings\` (bare, ordem posicional):
${baseline.schema_guards.trial_offer_settings_columns.map((column) => `- ${column}`).join('\n')}

## 7. \`settings_guard\` (oito campos pré-existentes)

| Campo | Valor |
|---|---|
${settingsRows}

## 8. Semântica de fingerprint: F57.2 versus F63

- O F57.2 calcula o fingerprint do ledger sobre todas as linhas **exceto** nomes que contenham \`f57_2_\`.
- O F63 usa \`fingerprint_scope: "all_rows"\`: todas as linhas, sem filtro.
- As duas migrations do F63 (estrutura e seed) somam duas linhas ao ledger. Por isso o fingerprint armazenado do F57.2 muda **necessariamente** depois da fase.
- O F57.2 **não** é executado nesta fase. O re-baseline do F57.2 está **explicitamente fora do escopo** desta subfatia e não haverá atualização silenciosa de expectativas.

## 9. Declaração de somente leitura

- Nenhuma escrita de schema ou de dado foi executada.
- Nenhum banco foi criado; nenhum reset de banco ocorreu; nenhum backup foi exigido.
- Nenhuma suíte de testes foi executada.
- Acesso ao banco limitado a consultas de leitura via \`docker exec psql\` no container do homolog.
- A variável de conexão de teste ${targetUrlPresent ? 'estava presente no ambiente e foi validada como loopback' : 'não estava presente no ambiente desta execução'}; o acesso SQL ocorreu exclusivamente dentro do container. Qualquer URL de teste futura deve apontar para \`${HOMOLOG_HOST}:${HOMOLOG_PORT}/${HOMOLOG_DATABASE}\`; hosts não-loopback são recusados e valores nunca são impressos.
- Produção e bancos remotos não foram acessados.

## 10. Comandos utilizados (sem valores de ambiente)

${baseline.commands.map((command) => `- \`${command}\``).join('\n')}

## 11. Política de evidência para os próximos planos

- Logs em UTF-8, sem credenciais e sem valores de variáveis de ambiente.
- Comparação contra este baseline por \`count\` e \`row_checksum_md5\` exatos; \`sha256\` é informativo.
- \`settings_guard\` comparado pelos oito campos pré-existentes; \`current_version_id\` é efeito de migration separado.
- Diferenças classificadas como efeito esperado da migration ou dado criado pelos testes; nunca atribuir dados de teste à migration.
- Ledger sempre registrado com \`count\`, \`max_version\` e \`sha256\` em todos os estágios.

## 12. Nota de inventário (L3)

Qualquer arquivo novo \`*.postgres.test.ts\` criado antes de entrar em \`scripts/testing/test-categories.json\` faz \`test:gates\` falhar transitoriamente. O plano 63-05 deve adicionar a categoria no mesmo passo em que criar o primeiro arquivo. Este plano não cria testes de integração.
`;
}

function printDryRun() {
  console.log('[dry-run] alvo homolog (nenhum comando docker executado)');
  console.log(`[dry-run] workdir: ${HOMOLOG_WORKDIR}`);
  console.log(`[dry-run] container: ${HOMOLOG_CONTAINER}`);
  console.log(`[dry-run] publicacao esperada: host ${HOMOLOG_PORT} -> container ${HOMOLOG_CONTAINER_PORT}`);
  console.log(`[dry-run] banco: ${HOMOLOG_DATABASE}`);
  console.log('[dry-run] comandos previstos: docker inspect, docker port, docker exec psql (somente SELECT)');
  console.log(`[dry-run] tabelas preservadas: ${PRESERVED_TABLES.map((entry) => entry.table).join(', ')}`);
  console.log(`[dry-run] guardas de schema: ${SCHEMA_FUNCTION_SIGNATURES.length} funcoes, colunas de enrollments e settings`);
  console.log('[dry-run] nenhuma escrita, nenhum banco criado, nenhum reset, nenhum backup');
}

function printUsage() {
  console.log('Uso: node scripts/f63/homolog-identity.mjs [--dry-run | --out <json> [--md-out <md>] | --verify <json>]');
}

function parseArgs(argv) {
  const args = { out: null, mdOut: null, verify: null, dryRun: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    if (current === '--dry-run') {
      args.dryRun = true;
    } else if (current === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (current === '--md-out') {
      args.mdOut = argv[i + 1];
      i += 1;
    } else if (current === '--verify') {
      args.verify = argv[i + 1];
      i += 1;
    } else if (current === '--help' || current === '-h') {
      args.help = true;
    } else {
      throw new Error(`argumento desconhecido: ${current}`);
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    return 0;
  }

  if (args.verify) {
    const result = verifyBaseline(args.verify);
    if (result.ok) {
      console.log(`baseline verify: OK (${args.verify})`);
      return 0;
    }
    console.error('baseline verify: FAILED');
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }

  if (args.dryRun) {
    printDryRun();
    return 0;
  }

  const baseline = await buildBaseline();
  if (args.out) {
    const written = writeArtifact(args.out, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`baseline json: ${written}`);
  }
  if (args.mdOut) {
    const written = writeArtifact(args.mdOut, renderMarkdown(baseline));
    console.log(`preflight markdown: ${written}`);
  }

  console.log(
    `alvo confirmado: ${baseline.environment.container} | ${baseline.environment.published} | ${baseline.environment.database} | ${baseline.environment.server_version}`,
  );
  console.log(
    `ledger: count=${baseline.ledger.count} max=${baseline.ledger.max_version} sha256=${baseline.ledger.sha256}`,
  );
  for (const { table } of PRESERVED_TABLES) {
    const entry = baseline.preserved[table];
    console.log(`preservado: ${table} count=${entry.count} md5=${entry.row_checksum_md5}`);
  }
  console.log(
    `pre_state: versions_absent=${baseline.pre_state.trial_offer_versions_absent} current_version_id_absent=${baseline.pre_state.current_version_id_absent} singleton=${baseline.pre_state.settings_singleton_count}`,
  );
  return 0;
}

const ENTRYPOINT = fileURLToPath(import.meta.url);

if (process.argv[1] && path.resolve(process.argv[1]) === ENTRYPOINT) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(`f63 homolog identity: ${error.message}`);
      process.exitCode = 1;
    });
}

export { REPO_ROOT, CREDENTIAL_LIKE, readTablesPresent, readPreState };
