// F48.2.2 — bootstrap LOCAL e idempotente do DDL da bancada de geração.
//
// Aplica `supabase/lab/bench-schema.sql` — que vive **fora** de
// `supabase/migrations/` (D17) — apenas no Supabase local. Um `supabase db push`
// geral NUNCA carrega as tabelas da bancada ao remoto: a única via de criação é
// este bootstrap.
//
// LOCAL-ONLY: o host do Supabase é validado e hosts remotos/produção são
// recusados ANTES de qualquer I/O. Nenhum secret é impresso.
//
// Uso:
//   node scripts/lab/48-2-2-bench-bootstrap.mjs                # aplica o DDL + linhas de catálogo (idempotente)
//   node scripts/lab/48-2-2-bench-bootstrap.mjs --no-catalog    # aplica apenas o DDL
//   node scripts/lab/48-2-2-bench-bootstrap.mjs --revert        # executa o bloco REVERT + remove as linhas de catálogo
//
// O bootstrap insere **apenas linhas de catálogo** (`ai_model_catalog`)
// necessárias à validação local dos presets confirmados pelo spike (CHECKPOINT 1),
// de forma idempotente e **sem pricing** (o pricing existe somente em código —
// `bench-pricing.ts`, sem tabela de pricing). Conteúdo igual ⇒ nada; linha nova ⇒
// inserida; nunca sobrescreve. `--with-catalog` é aceito como alias legado.
//
// O módulo NÃO tem efeito colateral no import: as funções são exportadas e a CLI
// só roda quando o arquivo é o entry point.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import pg from "pg";

const { Client } = pg;

/** Caminho canônico do DDL local da bancada. */
export const BENCH_SCHEMA_PATH = path.resolve(process.cwd(), "supabase/lab/bench-schema.sql");

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/** Domínios de produção — bloqueio incondicional. */
export const PRODUCTION_DOMAINS = ["supabase.co", "supabase.in", "supabase.com"];

/** Linhas de catálogo locais da bancada (sem pricing — o pricing vive em código). */
export const BENCH_CATALOG_ROWS = [
  { model: "gpt-image-2", label: "GPT Image 2 (bancada)" },
  { model: "gpt-image-2.5-flare", label: "GPT Image 2.5 Flare (bancada)" },
  { model: "gpt-image-2.5-sunburst", label: "GPT Image 2.5 Sunburst (bancada)" },
];

/** Erro de bloqueio/execução do bootstrap (mensagem clara, exit code 1 na CLI). */
export class BenchBootstrapBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "BenchBootstrapBlockedError";
  }
}

/**
 * Valida que `rawUrl` aponta para um host local e recusa domínios de produção.
 * Devolve o hostname normalizado. Lança antes de qualquer I/O.
 */
export function assertLocalHost(rawUrl, origin) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    throw new BenchBootstrapBlockedError(`Recusando URL invalida (${origin}): ${rawUrl}`);
  }

  if (PRODUCTION_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new BenchBootstrapBlockedError(`Recusando host de producao (${origin}): ${hostname}`);
  }
  if (!LOCAL_HOST_PATTERN.test(hostname)) {
    throw new BenchBootstrapBlockedError(`Recusando host nao local (${origin}): ${hostname}`);
  }
  return hostname;
}

function readSupabaseStatusEnv() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"];
  const output = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const values = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^(API_URL|DB_URL|SERVICE_ROLE_KEY)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

/**
 * Resolve a conexão local. A URL de banco vem de `SUPABASE_DB_URL`/`BENCH_DB_URL`
 * ou do `supabase status -o env` do stack local. A API e o banco são validados
 * como locais **antes** de qualquer I/O.
 */
export function resolveLocalConnection(env = process.env) {
  const status = readSupabaseStatusEnv();

  const dbUrl = env.BENCH_DB_URL ?? env.SUPABASE_DB_URL ?? status.DB_URL;
  if (!dbUrl) {
    throw new BenchBootstrapBlockedError(
      "Defina SUPABASE_DB_URL ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }
  const hostname = assertLocalHost(dbUrl, "DB_URL");

  const apiUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? status.API_URL;
  if (apiUrl) assertLocalHost(apiUrl, "API_URL");

  return { dbUrl, hostname };
}

/** Lê o DDL local da bancada. Falha clara se o arquivo não existir. */
export function readBenchSchema(schemaPath = BENCH_SCHEMA_PATH) {
  if (!fs.existsSync(schemaPath)) {
    throw new BenchBootstrapBlockedError(`DDL local nao encontrado: ${schemaPath}`);
  }
  return fs.readFileSync(schemaPath, "utf8");
}

/**
 * Extrai as instruções do bloco REVERT (linhas comentadas após o marcador
 * `REVERT`). Cada instrução é uma linha `-- <sql>;`. Separadores (`-- ===`) e o
 * cabeçalho são ignorados.
 */
export function extractRevertStatements(sql) {
  const lines = sql.split(/\r?\n/);
  const markerIndex = lines.findIndex((line) => /^--\s*REVERT\b/.test(line));
  if (markerIndex < 0) {
    throw new BenchBootstrapBlockedError("Bloco REVERT ausente no DDL da bancada.");
  }

  const statements = [];
  for (const line of lines.slice(markerIndex + 1)) {
    const match = line.match(/^--\s+(\S.*)$/);
    if (!match) continue;
    const statement = match[1].trim();
    if (!statement.endsWith(";")) continue;
    statements.push(statement);
  }

  if (statements.length === 0) {
    throw new BenchBootstrapBlockedError("Bloco REVERT sem instrucoes executaveis.");
  }
  return statements;
}

async function withClient(dbUrl, fn) {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Aplica o DDL local (idempotente) no Supabase local. */
export async function applyBenchSchema(dbUrl, schemaPath = BENCH_SCHEMA_PATH) {
  const sql = readBenchSchema(schemaPath);
  await withClient(dbUrl, async (client) => {
    await client.query(sql);
  });
}

/** Executa o bloco REVERT do DDL local. */
export async function revertBenchSchema(dbUrl, schemaPath = BENCH_SCHEMA_PATH) {
  const sql = readBenchSchema(schemaPath);
  const statements = extractRevertStatements(sql);
  await withClient(dbUrl, async (client) => {
    for (const statement of statements) {
      await client.query(statement);
    }
  });
  return { statements: statements.length };
}

/**
 * Insere **apenas** linhas de catálogo locais da bancada (`ai_model_catalog`),
 * idempotente (ON CONFLICT DO NOTHING) e **sem pricing**. Conteúdo igual ⇒ nada;
 * linha nova ⇒ inserida; nunca sobrescreve. Nenhuma promoção ao remoto e nenhuma
 * alteração de comportamento produtivo.
 */
export async function insertBenchCatalogRows(dbUrl) {
  return withClient(dbUrl, async (client) => {
    let inserted = 0;
    for (const row of BENCH_CATALOG_ROWS) {
      const result = await client.query(
        `INSERT INTO public.ai_model_catalog
           (capability, segment, provider, model, protocol, label, status, source_note, validated_at)
         VALUES ('campaign_image', 'image', 'openai', $1, 'images', $2, 'active', $3, now())
         ON CONFLICT (capability, provider, model, protocol) DO NOTHING`,
        [row.model, row.label, "F48.2.2 bancada local (sem pricing)"],
      );
      inserted += result.rowCount ?? 0;
    }
    return { inserted };
  });
}

/**
 * Remove **apenas** as linhas de catálogo locais inseridas por este bootstrap
 * (`capability='campaign_image'`, `provider='openai'`, `protocol='images'` nos
 * modelos da bancada). Local-only; nunca toca outras linhas do catálogo.
 */
export async function revertBenchCatalogRows(dbUrl) {
  return withClient(dbUrl, async (client) => {
    const result = await client.query(
      `DELETE FROM public.ai_model_catalog
         WHERE capability = 'campaign_image'
           AND provider = 'openai'
           AND protocol = 'images'
           AND model = ANY($1::text[])`,
      [BENCH_CATALOG_ROWS.map((row) => row.model)],
    );
    return { removed: result.rowCount ?? 0 };
  });
}

/**
 * Executa o bootstrap. Aplica o DDL e, por padrão, as linhas de catálogo locais
 * confirmadas pelo spike (idempotente; `"nada a fazer"` quando já existem).
 * `--no-catalog` aplica apenas o DDL; `--revert` executa o bloco REVERT e remove
 * as linhas de catálogo locais. `--with-catalog` é aceito como alias legado.
 * Devolve o resumo sem secrets.
 */
export async function main(argv = process.argv.slice(2), env = process.env) {
  const revert = argv.includes("--revert");
  const skipCatalog = argv.includes("--no-catalog");

  const connection = resolveLocalConnection(env);

  if (revert) {
    const result = await revertBenchSchema(connection.dbUrl);
    const catalog = await revertBenchCatalogRows(connection.dbUrl);
    return {
      host: connection.hostname,
      reverted: true,
      statements: result.statements,
      catalog: `removed:${catalog.removed}`,
    };
  }

  await applyBenchSchema(connection.dbUrl);

  if (skipCatalog) {
    return { host: connection.hostname, applied: true, reverted: false, catalog: "skipped" };
  }

  const result = await insertBenchCatalogRows(connection.dbUrl);
  const catalog = result.inserted === 0 ? "nada a fazer" : `inserted:${result.inserted}`;

  return { host: connection.hostname, applied: true, reverted: false, catalog };
}

const invokedDirectly =
  typeof process.argv[1] === "string" &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  main()
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2));
    })
    .catch((error) => {
      console.error(
        `[bench-bootstrap] ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    });
}
