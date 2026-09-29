// F48.2.3 — importação LOCAL e explícita da identidade das lojas de teste (parte 1/2).
//
// Materializa localmente a identidade/branding atual das lojas de TESTE por um
// comando explícito, com isolamento absoluto entre laboratório e produção:
//   * a ORIGEM remota é acessada SOMENTE por este comando e SOMENTE em leitura
//     (allowlist estrita de tabelas/colunas/buckets) — nenhuma escrita, update,
//     exclusão ou promoção existe no caminho de origem;
//   * o DESTINO local é validado por `assertLocalHost` antes de qualquer I/O e é
//     o único lugar onde ocorrem escritas;
//   * nenhuma consulta remota é feita pelo runtime da bancada.
//
// Flags (D3):
//   --store <uuid>   repetível; ID explícito de loja de teste.
//   --stores <csv>   lista CSV de IDs explícitos.
//   --dry-run        impede materialização/escrita local (NÃO garante ausência de
//                    leitura remota — ver spec `lab-bench-store-import`).
//   --all            RECUSADO: descoberta ampla não é permitida.
// Sem IDs explícitos → erro.
//
// Credenciais remotas (D2) — SOMENTE por variáveis de ambiente do operador:
//   BENCH_IMPORT_SOURCE_URL / BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY
// Nunca persistidas nem logadas. O runtime da bancada usa apenas o Supabase local.
//
// PARTE 1/2 (este arquivo, plano 02): esqueleto ESM testável, dois clientes,
// allowlist, guard local-only. A cópia de assets, a transação de substituição
// integral, a auditoria local e o upsert do manifesto entram na parte 2 (plano 03).
//
// O módulo NÃO tem efeito colateral no import: as funções puras são exportadas e a
// CLI só roda quando o arquivo é o entry point. Nenhum import de código de produção
// (`src/lib/**`): `sanitizeAiErrorMessage` é espelhado aqui (mesma política de
// redaction de `src/lib/ai/types.ts`) porque scripts `.mjs` não importam TypeScript.

import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

// ─── Erro de bloqueio/execução ───────────────────────────────────────────────

/** Erro de bloqueio/execução da importação (mensagem clara, exit code 1 na CLI). */
export class BenchImportBlockedError extends Error {
  constructor(code, message = code) {
    super(message);
    this.name = "BenchImportBlockedError";
    this.code = code;
  }
}

// ─── Allowlist de tabelas, colunas e buckets (D4) ────────────────────────────

/** Tabelas de identidade/branding permitidas na origem (somente leitura). */
export const SOURCE_TABLES = Object.freeze([
  "stores",
  "store_brand_profiles",
  "store_brand_assets",
  "store_visual_signatures",
]);

/** Buckets de branding permitidos na origem (somente leitura/download). */
export const SOURCE_BUCKETS = Object.freeze([
  "store-logos",
  "store-brand-assets",
  "visual-signatures",
]);

/** Alvos PROIBIDOS explicitamente na origem (campanhas, créditos, logs, histórico). */
export const FORBIDDEN_SOURCE_TARGETS = Object.freeze([
  "campaigns",
  "campaign_images",
  "generation_events",
  "ai_model_selection",
  "admin_audit_log",
  "campaign-images",
  "prompts",
]);

/** Prefixos de alvo proibidos (ex.: `credit_*`). */
const FORBIDDEN_SOURCE_PREFIXES = Object.freeze(["credit_"]);

/** `true` se o alvo (tabela/bucket/prefixo) é proibido na origem. */
export function isForbiddenSourceTarget(target) {
  if (typeof target !== "string") return true;
  const value = target.trim().toLowerCase();
  if (!value) return true;
  if (FORBIDDEN_SOURCE_TARGETS.includes(value)) return true;
  return FORBIDDEN_SOURCE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Valida que a tabela está na allowlist de origem. */
export function assertAllowedSourceTable(table) {
  if (!SOURCE_TABLES.includes(table)) {
    throw new BenchImportBlockedError(
      "import_source_table_not_allowed",
      `Tabela de origem fora da allowlist: ${table}`,
    );
  }
  return table;
}

/** Valida que o bucket está na allowlist de origem. */
export function assertAllowedSourceBucket(bucket) {
  if (!SOURCE_BUCKETS.includes(bucket)) {
    throw new BenchImportBlockedError(
      "import_source_bucket_not_allowed",
      `Bucket de origem fora da allowlist: ${bucket}`,
    );
  }
  return bucket;
}

// ─── Allowlist de colunas por tabela (D4) ────────────────────────────────────

/** Colunas de identidade de `stores` (sem `accent_color`; sem `user_id` real). */
export const STORE_COLUMNS =
  "id, name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, brand_color, is_test_store, updated_at";

/** Colunas do perfil de branding atual (inclui a cor inferida e os IDs de FK). */
export const PROFILE_COLUMNS =
  "id, source, status, typography_direction, safe_color_tokens, brand_colors_chosen, logo_colors_detected, visual_style, visual_tone, brand_personality, campaign_guidelines, campaign_brief, inferred_primary_color, active_logo_asset_id, visual_signature_id, updated_at";

/** Colunas dos assets de branding ativos. */
export const ASSET_COLUMNS =
  "id, store_id, asset_type, variant_type, storage_path, mime_type, width, height, size_bytes, checksum, status, metadata, updated_at";

/** Colunas da assinatura visual ativa. */
export const SIGNATURE_COLUMNS =
  "id, store_id, storage_path, asset_url, type, status, metadata, updated_at";

/** Allowlist explícita de colunas por tabela de origem. */
export const SOURCE_COLUMN_ALLOWLIST = Object.freeze({
  stores: Object.freeze(STORE_COLUMNS.split(",").map((column) => column.trim())),
  store_brand_profiles: Object.freeze(PROFILE_COLUMNS.split(",").map((column) => column.trim())),
  store_brand_assets: Object.freeze(ASSET_COLUMNS.split(",").map((column) => column.trim())),
  store_visual_signatures: Object.freeze(SIGNATURE_COLUMNS.split(",").map((column) => column.trim())),
});

/** Valida a tabela E cada coluna solicitada contra a allowlist explícita. */
export function assertAllowedSourceColumns(table, columns) {
  assertAllowedSourceTable(table);
  const allowed = new Set(SOURCE_COLUMN_ALLOWLIST[table]);
  for (const column of String(columns)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)) {
    if (!allowed.has(column)) {
      throw new BenchImportBlockedError(
        "import_source_column_not_allowed",
        `Coluna de origem fora da allowlist (${table}): ${column}`,
      );
    }
  }
  return columns;
}

// ─── Sanitização (D12) ───────────────────────────────────────────────────────

const BEARER_PATTERN = /(bearer\s+)[A-Za-z0-9._-]+/gi;
const KEY_PATTERN = /\b(?:sk|AIza)[A-Za-z0-9._-]{8,}\b/g;
const URL_PATTERN = /https?:\/\/[^\s"')]+/gi;
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const SENSITIVE_METADATA_KEY = /(url|uri|token|secret|key|signature|jwt|signed|password|credential)/i;

/**
 * Remove chave de API, bearer e URL da mensagem (mesma política de
 * `src/lib/ai/types.ts::sanitizeAiErrorMessage`). Nunca logar/persistir secrets.
 */
export function sanitizeAiErrorMessage(message) {
  return String(message)
    .replace(BEARER_PATTERN, "$1[redacted]")
    .replace(KEY_PATTERN, "[redacted-key]")
    .replace(URL_PATTERN, "[redacted-url]");
}

/**
 * Saneia um objeto `metadata`: remove chaves sensíveis (url/token/secret/...) e
 * valores que pareçam URL ou JWT. Nunca persistir URL assinada/token.
 */
export function sanitizeMetadata(value) {
  if (Array.isArray(value)) return value.map((entry) => sanitizeMetadata(entry));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (SENSITIVE_METADATA_KEY.test(key)) continue;
      if (typeof entry === "string" && (URL_PATTERN.test(entry) || JWT_PATTERN.test(entry))) continue;
      out[key] = sanitizeMetadata(entry);
    }
    return out;
  }
  return value;
}

/**
 * Canonicaliza o host da origem SEM credenciais (apenas `host[:port]`).
 * Nunca devolve usuário/senha, path ou query.
 */
export function canonicalizeSourceHost(rawUrl) {
  try {
    return new URL(rawUrl).host;
  } catch {
    return "";
  }
}

// ─── Guard local-only do destino (mesma canonicalização do bootstrap) ────────

/** Hosts aceitos (Supabase CLI/Docker local). Qualquer outro é recusado. */
const LOCAL_HOST_PATTERN = /^(localhost|127\.0\.0\.1|::1|0\.0\.0\.0)$/i;

/** Domínios de produção — bloqueio incondicional. */
export const PRODUCTION_DOMAINS = Object.freeze(["supabase.co", "supabase.in", "supabase.com"]);

/**
 * Valida que `rawUrl` aponta para um host local e recusa domínios de produção.
 * Devolve o hostname normalizado. Lança antes de qualquer I/O.
 */
export function assertLocalHost(rawUrl, origin) {
  let hostname;
  try {
    hostname = new URL(rawUrl).hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
  } catch {
    throw new BenchImportBlockedError("import_destination_url_invalid", `Recusando URL invalida (${origin}).`);
  }

  if (PRODUCTION_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new BenchImportBlockedError("import_destination_host_production", `Recusando host de producao (${origin}): ${hostname}`);
  }
  if (!LOCAL_HOST_PATTERN.test(hostname)) {
    throw new BenchImportBlockedError("import_destination_host_not_local", `Recusando host nao local (${origin}): ${hostname}`);
  }
  return hostname;
}

// ─── Parsing de flags (puro) ─────────────────────────────────────────────────

/**
 * Faz o parsing das flags da CLI. Função pura (sem I/O) e testável.
 *
 * @returns {{ storeIds: string[], dryRun: boolean }}
 * @throws {BenchImportBlockedError} `import_store_ids_required` | `import_all_not_allowed` | ...
 */
export function parseImportArgs(argv = []) {
  const storeIds = [];
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (token === "--all") {
      throw new BenchImportBlockedError(
        "import_all_not_allowed",
        "Importar todas as lojas nao e permitido; informe IDs explicitos.",
      );
    }
    if (token === "--store") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new BenchImportBlockedError("import_store_id_missing", "A flag --store exige um <uuid>.");
      }
      storeIds.push(value);
      index += 1;
      continue;
    }
    if (token === "--stores") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new BenchImportBlockedError("import_store_ids_missing", "A flag --stores exige uma lista CSV de IDs.");
      }
      for (const part of value.split(",")) storeIds.push(part);
      index += 1;
      continue;
    }

    throw new BenchImportBlockedError("import_flag_unknown", `Flag desconhecida: ${sanitizeAiErrorMessage(token)}`);
  }

  const normalized = [];
  for (const raw of storeIds) {
    const id = String(raw).trim();
    if (!id) continue;
    if (!normalized.includes(id)) normalized.push(id);
  }

  if (normalized.length === 0) {
    throw new BenchImportBlockedError(
      "import_store_ids_required",
      "Informe ao menos um ID explicito (--store <uuid> ou --stores <csv>).",
    );
  }

  return { storeIds: normalized, dryRun };
}

// ─── Destino local (todas as escritas) ───────────────────────────────────────

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
 * Resolve a conexão do DESTINO local. A URL vem de `NEXT_PUBLIC_SUPABASE_URL`/
 * `SUPABASE_URL` (ou do `supabase status -o env`). A URL é validada como local
 * por `assertLocalHost` **antes** de qualquer conexão.
 */
export function resolveLocalDestination(env = process.env) {
  let url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL;
  let serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY ?? env.BENCH_LOCAL_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    const status = readSupabaseStatusEnv();
    url = url ?? status.API_URL;
    serviceRoleKey = serviceRoleKey ?? status.SERVICE_ROLE_KEY;
  }

  if (!url) {
    throw new BenchImportBlockedError(
      "import_destination_url_missing",
      "Defina NEXT_PUBLIC_SUPABASE_URL ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }
  if (!serviceRoleKey) {
    throw new BenchImportBlockedError(
      "import_destination_key_missing",
      "Defina SUPABASE_SERVICE_ROLE_KEY do destino local.",
    );
  }

  const hostname = assertLocalHost(url, "destino local");
  return { url, serviceRoleKey, hostname };
}

/**
 * Cria o cliente de DESTINO local (service role). É o único ponto onde escritas
 * locais podem ocorrer. A URL é validada por `assertLocalHost` antes do cliente.
 */
export function createLocalDestination(env = process.env, clientFactory = createClient) {
  const { url, serviceRoleKey, hostname } = resolveLocalDestination(env);
  const client = clientFactory(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    host: hostname,
    client,
  };
}

// ─── Origem somente-leitura (nenhuma mutação no caminho) ─────────────────────

/**
 * Cria o cliente de ORIGEM remota. Expõe **somente** `select` e storage `download`
 * (mais o `host` canonicalizado). Nenhum método de mutação existe no caminho.
 *
 * As credenciais vêm **exclusivamente** de `params.url`/`params.serviceRoleKey`,
 * que o chamador obtém de `BENCH_IMPORT_SOURCE_URL`/`BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY`.
 * Nunca são persistidas nem logadas.
 */
export function createReadOnlySourceClient(params = {}, clientFactory = createClient) {
  const url = params.url;
  const serviceRoleKey = params.serviceRoleKey;

  if (!url) {
    throw new BenchImportBlockedError(
      "import_source_url_missing",
      "Defina BENCH_IMPORT_SOURCE_URL para ler a origem (somente leitura).",
    );
  }
  if (!serviceRoleKey) {
    throw new BenchImportBlockedError(
      "import_source_key_missing",
      "Defina BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY para ler a origem (somente leitura).",
    );
  }

  const host = canonicalizeSourceHost(url);
  const client = clientFactory(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    host,

    /** Leitura allowlisted: valida tabela/colunas antes de consultar. */
    async select(table, columns, filters = {}) {
      assertAllowedSourceColumns(table, columns);

      let query = client.from(table).select(columns);
      const eq = filters.eq ?? {};
      for (const [key, value] of Object.entries(eq)) query = query.eq(key, value);
      if (filters.order) {
        query = query.order(filters.order.column, { ascending: filters.order.ascending !== false });
      }
      if (filters.limit) query = query.limit(filters.limit);
      if (filters.maybeSingle) query = query.maybeSingle();

      const { data, error } = await query;
      if (error) {
        throw new BenchImportBlockedError(
          "import_source_read_failed",
          sanitizeAiErrorMessage(`import_source_read_failed:${error.message}`),
        );
      }
      return data ?? null;
    },

    /** Download allowlisted de um objeto de bucket de branding (somente leitura). */
    async download(bucket, objectPath) {
      assertAllowedSourceBucket(bucket);
      const { data, error } = await client.storage.from(bucket).download(objectPath);
      if (error) {
        throw new BenchImportBlockedError(
          "import_source_download_failed",
          sanitizeAiErrorMessage(`import_source_download_failed:${error.message}`),
        );
      }
      return data ?? null;
    },
  };
}

// ─── Orquestração ────────────────────────────────────────────────────────────

/**
 * Executa a importação. `deps` permite injetar clientes falsos em teste
 * (`deps.destination`/`deps.source`) sem rede nem banco real.
 *
 * O guard local-only (`assertLocalHost`) roda dentro de `createLocalDestination`
 * **antes** de qualquer I/O. A origem é construída a partir das variáveis de
 * ambiente do operador (somente leitura).
 */
export async function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const options = parseImportArgs(argv);

  const destination = deps.destination ?? createLocalDestination(env);
  const source =
    deps.source ??
    createReadOnlySourceClient({
      url: env.BENCH_IMPORT_SOURCE_URL,
      serviceRoleKey: env.BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY,
    });

  return {
    sourceHost: source.host,
    destinationHost: destination.host,
    dryRun: options.dryRun,
    storeCount: options.storeIds.length,
    storeIds: options.storeIds,
  };
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
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[bench-import] ${sanitizeAiErrorMessage(message)}`);
      process.exitCode = 1;
    });
}
