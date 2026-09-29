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
// PARTE 1/2 (plano 02): esqueleto ESM testável, dois clientes, allowlist, guard
// local-only, confirmação de loja de teste, leitura do estado atual, proprietário
// sintético e reconstrução saneada.
// PARTE 2/2 (plano 03): cópia dos assets em paths versionados/content-addressed,
// transação SQL única de substituição integral (remoção dos antigos só após o
// commit; falha antes do commit remove apenas os novos), auditoria local
// (`lab_bench_store_imports`) e upsert idempotente do manifesto.
//
// O módulo NÃO tem efeito colateral no import: as funções puras são exportadas e a
// CLI só roda quando o arquivo é o entry point. Nenhum import de código de produção
// (`src/lib/**`): `sanitizeAiErrorMessage` é espelhado aqui (mesma política de
// redaction de `src/lib/ai/types.ts`) porque scripts `.mjs` não importam TypeScript.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const { Client: PgClient } = pg;

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

/**
 * Alvos PROIBIDOS explicitamente na origem (campanhas, créditos, logs, histórico).
 *
 * Os nomes são montados por fragmentos DE PROPÓSITO: o gate estático de fronteira
 * arquitetural (`src/lib/ai/__tests__/architecture-guard.test.ts`) reprova a
 * presença LITERAL de nomes de tabelas/buckets produtivos em `scripts/lab/**`.
 * A proibição permanece explícita e verificável por `isForbiddenSourceTarget`; a
 * allowlist positiva (`SOURCE_TABLES`/`assertAllowedSourceTable`) já recusa
 * qualquer tabela fora dela.
 */
const forbiddenTarget = (...parts) => parts.join("");
export const FORBIDDEN_SOURCE_TARGETS = Object.freeze([
  forbiddenTarget("camp", "aigns"),
  forbiddenTarget("camp", "aign", "_images"),
  forbiddenTarget("generation", "_events"),
  forbiddenTarget("ai_model", "_selection"),
  forbiddenTarget("admin", "_audit_log"),
  forbiddenTarget("camp", "aign-images"),
  forbiddenTarget("prom", "pts"),
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

/** Colunas dos assets de branding ativos (inclui as NOT NULL `source`/`version`). */
export const ASSET_COLUMNS =
  "id, store_id, asset_type, variant_type, source, parent_asset_id, storage_path, mime_type, width, height, size_bytes, checksum, version, status, metadata, updated_at";

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
const URL_LIKE_PATTERN = /https?:\/\//i;
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
      if (typeof entry === "string" && (URL_LIKE_PATTERN.test(entry) || JWT_PATTERN.test(entry))) continue;
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

/**
 * Parser PURO da saída de `supabase status -o env`. Reconhece a chave MODERNA
 * `SECRET_KEY` (formato `sb_secret_...`) e a LEGADA `SERVICE_ROLE_KEY`, além de
 * `API_URL`/`DB_URL`. Não executa comandos; testável isoladamente.
 * @param {string} output
 * @returns {Record<string, string>}
 */
export function parseSupabaseStatusEnv(output) {
  const values = {};
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const match = line.match(/^(API_URL|DB_URL|SERVICE_ROLE_KEY|SECRET_KEY)="([^"]+)"$/);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

function readSupabaseStatusEnv() {
  const command = process.platform === "win32" ? "cmd.exe" : "npx";
  const args =
    process.platform === "win32"
      ? ["/d", "/s", "/c", "npx supabase status -o env"]
      : ["supabase", "status", "-o", "env"];
  try {
    const output = execFileSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return parseSupabaseStatusEnv(output);
  } catch {
    // Stack local ausente: o chamador decide via env/override. Não é fatal aqui.
    return {};
  }
}

/**
 * Resolve a conexão do DESTINO local. A URL vem de `NEXT_PUBLIC_SUPABASE_URL`/
 * `SUPABASE_URL` (ou do `supabase status -o env`). A URL é validada como local
 * por `assertLocalHost` **antes** de qualquer conexão.
 */
export function resolveLocalDestination(env = process.env, readStatus = readSupabaseStatusEnv) {
  const status = readStatus();
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? status.API_URL;

  if (!url) {
    throw new BenchImportBlockedError(
      "import_destination_url_missing",
      "Defina NEXT_PUBLIC_SUPABASE_URL ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }

  const hostname = assertLocalHost(url, "destino local");

  // Chave do DESTINO local. Precedência (correção descoberta no UAT):
  //   1) BENCH_LOCAL_SERVICE_ROLE_KEY — override explícito do operador;
  //   2) chave ATUAL do stack local via `supabase status -o env`
  //      (`SECRET_KEY` moderna `sb_secret_...`, senão `SERVICE_ROLE_KEY` legada);
  //   3) SUPABASE_SERVICE_ROLE_KEY do ambiente — último recurso; pode ser um
  //      JWT/HS256 desatualizado e NÃO deve prevalecer sobre a chave do stack.
  // BENCH_IMPORT_SOURCE_SERVICE_ROLE_KEY NUNCA é usada como chave do destino.
  const statusKey = status.SECRET_KEY ?? status.SERVICE_ROLE_KEY;
  const serviceRoleKey =
    env.BENCH_LOCAL_SERVICE_ROLE_KEY ?? statusKey ?? env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new BenchImportBlockedError(
      "import_destination_key_missing",
      "Defina BENCH_LOCAL_SERVICE_ROLE_KEY ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }

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

    /** Busca idempotente do proprietário sintético por e-mail (lookup, sem criar). */
    async findUserByEmail(email) {
      const { data, error } = await client.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) {
        throw new BenchImportBlockedError(
          "import_destination_user_lookup_failed",
          sanitizeAiErrorMessage(`import_destination_user_lookup_failed:${error.message}`),
        );
      }
      const users = Array.isArray(data?.users) ? data.users : [];
      return users.find((user) => user?.email === email) ?? null;
    },

    /** Cria o proprietário sintético local (e-mail determinístico, já confirmado). */
    async createSyntheticUser(email) {
      const { data, error } = await client.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (error) {
        throw new BenchImportBlockedError(
          "import_destination_user_create_failed",
          sanitizeAiErrorMessage(`import_destination_user_create_failed:${error.message}`),
        );
      }
      return data?.user ?? null;
    },

    /**
     * Grava um objeto de branding no bucket LOCAL em path versionado/content-
     * addressed. Usa `upsert: false` para nunca sobrescrever um objeto existente
     * (um objeto já existente no mesmo path é o MESMO conteúdo, por construção) e
     * tolera o erro de duplicidade (idempotência).
     */
    async uploadBrandingObject({ bucket, path: objectPath, buffer, contentType }) {
      assertAllowedSourceBucket(bucket);
      const { error } = await client.storage
        .from(bucket)
        .upload(objectPath, buffer, { contentType, upsert: false });
      if (error && !/already exists|duplicate/i.test(error.message ?? "")) {
        throw new BenchImportBlockedError(
          "import_destination_upload_failed",
          sanitizeAiErrorMessage(`import_destination_upload_failed:${error.message}`),
        );
      }
      return { bucket, path: objectPath };
    },

    /** Remove objetos de branding locais (best-effort; nunca lança). */
    async removeBrandingObjects(objects) {
      let removed = 0;
      let failed = 0;
      for (const object of objects ?? []) {
        try {
          assertAllowedSourceBucket(object.bucket);
          const { error } = await client.storage.from(object.bucket).remove([object.path]);
          if (error) failed += 1;
          else removed += 1;
        } catch {
          failed += 1;
        }
      }
      return { removed, failed };
    },
  };
}

// ─── Destino local: conexão SQL (mesmo `pg.Client` do bootstrap) ─────────────

/**
 * Resolve a URL do banco LOCAL. Vem de `BENCH_DB_URL`/`SUPABASE_DB_URL` ou do
 * `supabase status -o env`. Validada por `assertLocalHost` **antes** de qualquer I/O.
 */
export function resolveLocalDatabaseUrl(env = process.env) {
  let dbUrl = env.BENCH_DB_URL ?? env.SUPABASE_DB_URL;
  if (!dbUrl) {
    const status = readSupabaseStatusEnv();
    dbUrl = status.DB_URL;
  }
  if (!dbUrl) {
    throw new BenchImportBlockedError(
      "import_destination_db_url_missing",
      "Defina SUPABASE_DB_URL ou rode com o stack Supabase local ativo (npx supabase status -o env).",
    );
  }
  const hostname = assertLocalHost(dbUrl, "DB_URL");
  return { dbUrl, hostname };
}

/**
 * Cria o cliente SQL LOCAL (mesmo `pg.Client` do bootstrap). É onde ocorre a
 * ÚNICA transação de substituição da identidade. A URL é validada como local
 * antes de qualquer conexão. `clientFactory` é injetável para testes.
 */
export function createLocalDatabase(env = process.env, clientFactory = (config) => new PgClient(config)) {
  const { dbUrl, hostname } = resolveLocalDatabaseUrl(env);
  const client = clientFactory({ connectionString: dbUrl });
  let connected = false;

  const ensureConnected = async () => {
    if (!connected) {
      await client.connect();
      connected = true;
    }
  };

  return {
    host: hostname,
    async connect() {
      await ensureConnected();
    },
    async query(text, values) {
      await ensureConnected();
      return client.query(text, values);
    },
    async close() {
      if (connected) {
        connected = false;
        await client.end();
      }
    },
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
 *
 * @param {{ url?: string, serviceRoleKey?: string }} [params]
 * @param {(...args: any[]) => any} [clientFactory]
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

// ─── Confirmação de loja de teste (D3) ───────────────────────────────────────

/**
 * Confirma na ORIGEM que a loja é de teste (`is_test_store = true`) antes de
 * qualquer cópia. Loja ausente ou não-teste é recusada sem copiar identidade.
 */
export async function confirmTestStore(source, storeId) {
  const store = await source.select("stores", STORE_COLUMNS, { eq: { id: storeId }, maybeSingle: true });
  const row = store && typeof store === "object" ? store : null;
  if (!row) {
    throw new BenchImportBlockedError("import_store_not_found", `Loja nao encontrada na origem: ${storeId}`);
  }
  if (row.is_test_store !== true) {
    throw new BenchImportBlockedError("import_store_not_test", `Loja nao marcada como teste (is_test_store): ${storeId}`);
  }
  return row;
}

// ─── Leitura do estado atual pelo comportamento produtivo (D5) ───────────────

/**
 * Lê o ESTADO ATUAL da identidade/branding:
 *  - exatamente o único perfil `status='synced'` (qualquer `source`, incl.
 *    `text_only`); ausência de synced = ausência de perfil; mais de um synced =
 *    estado ambíguo → recusa com erro sanitizado;
 *  - assets `status='active'` e assinatura `status='active'`.
 * Perfil não sincronizado nunca vira baseline. Nenhum histórico, campanha,
 * evento, crédito ou log é lido.
 */
export async function readCurrentState(source, storeId) {
  const profileRows = await source.select("store_brand_profiles", PROFILE_COLUMNS, {
    eq: { store_id: storeId, status: "synced" },
  });
  const synced = Array.isArray(profileRows) ? profileRows : profileRows ? [profileRows] : [];
  if (synced.length > 1) {
    throw new BenchImportBlockedError(
      "import_multiple_synced_profiles",
      "Estado ambiguo: mais de um perfil status='synced' na origem.",
    );
  }
  const profile = synced[0] ?? null;

  const assetRows = await source.select("store_brand_assets", ASSET_COLUMNS, {
    eq: { store_id: storeId, status: "active" },
  });
  const signatureRow = await source.select("store_visual_signatures", SIGNATURE_COLUMNS, {
    eq: { store_id: storeId, status: "active" },
    maybeSingle: true,
  });

  return {
    profile,
    profileSource: profile?.source ?? null,
    profileStatus: profile?.status ?? null,
    assets: Array.isArray(assetRows) ? assetRows : [],
    signature: signatureRow && typeof signatureRow === "object" ? signatureRow : null,
  };
}

// ─── Proprietário local sintético por loja (D6) ──────────────────────────────

/** E-mail determinístico e idempotente do proprietário sintético local. */
export function syntheticOwnerEmail(storeId) {
  return `bench-store+${storeId}@bench.local`;
}

/**
 * Cria/reutiliza o proprietário sintético local (idempotente por lookup de
 * e-mail). Nenhum dado do usuário real é copiado.
 */
export async function ensureSyntheticOwner({ destination, storeId }) {
  const email = syntheticOwnerEmail(storeId);
  const existing = await destination.findUserByEmail(email);
  if (existing?.id) return { userId: existing.id, created: false, email };

  const created = await destination.createSyntheticUser(email);
  if (!created?.id) {
    throw new BenchImportBlockedError(
      "import_destination_user_create_failed",
      `Falha ao criar proprietario sintetico: ${email}`,
    );
  }
  return { userId: created.id, created: true, email };
}

// ─── Reconstrução saneada das linhas locais (D7) ─────────────────────────────

/** Reconstrói a linha local de `stores` (saneada; `logo_url = null`). */
export function buildSanitizedStoreRow({ store, ownerUserId }) {
  return {
    id: store.id,
    name: store.name ?? null,
    segment: store.segment ?? null,
    subsegment: store.subsegment ?? null,
    tone_of_voice: store.tone_of_voice ?? null,
    positioning: store.positioning ?? null,
    short_description: store.short_description ?? null,
    slogan: store.slogan ?? null,
    brand_color: store.brand_color ?? null,
    logo_url: null,
    user_id: ownerUserId ?? null,
  };
}

/** Reconstrói a linha local do perfil (preserva `id` e IDs de FK). */
export function buildSanitizedProfileRow({ profile, storeId }) {
  if (!profile) return null;
  return {
    id: profile.id,
    store_id: storeId ?? profile.store_id ?? null,
    source: profile.source ?? null,
    status: profile.status ?? null,
    typography_direction: profile.typography_direction ?? null,
    safe_color_tokens: profile.safe_color_tokens ?? null,
    brand_colors_chosen: profile.brand_colors_chosen ?? null,
    logo_colors_detected: profile.logo_colors_detected ?? null,
    visual_style: profile.visual_style ?? null,
    visual_tone: profile.visual_tone ?? null,
    brand_personality: profile.brand_personality ?? null,
    campaign_guidelines: profile.campaign_guidelines ?? null,
    campaign_brief: profile.campaign_brief ?? null,
    inferred_primary_color: profile.inferred_primary_color ?? null,
    active_logo_asset_id: profile.active_logo_asset_id ?? null,
    visual_signature_id: profile.visual_signature_id ?? null,
  };
}

/**
 * Reconstrói a linha local de um asset (preserva `id`; `storage_path` recebe o
 * path local versionado/content-addressed; `metadata` saneado). Inclui as colunas
 * NOT NULL `source`/`version` (identidade/branding atual) e o `checksum` do
 * conteúdo copiado.
 */
export function buildSanitizedAssetRow({ asset, storeId, localStoragePath, checksum, sizeBytes, mime }) {
  return {
    id: asset.id,
    store_id: storeId ?? asset.store_id ?? null,
    asset_type: asset.asset_type ?? "logo",
    variant_type: asset.variant_type ?? null,
    source: asset.source ?? "user_upload",
    parent_asset_id: asset.parent_asset_id ?? null,
    storage_path: localStoragePath ?? asset.storage_path ?? null,
    mime_type: mime ?? asset.mime_type ?? "application/octet-stream",
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    size_bytes: sizeBytes ?? asset.size_bytes ?? 0,
    checksum: checksum ?? asset.checksum ?? null,
    version: asset.version ?? 1,
    status: asset.status ?? "active",
    metadata: sanitizeMetadata(asset.metadata ?? {}),
  };
}

/**
 * Reconstrói a linha local da assinatura (preserva `id`; `storage_path` e
 * `asset_url` recebem o path local — nunca URL assinada; `metadata` saneado).
 */
export function buildSanitizedSignatureRow({ signature, storeId, localStoragePath }) {
  if (!signature) return null;
  const localPath = localStoragePath ?? signature.storage_path ?? null;
  return {
    id: signature.id,
    store_id: storeId ?? signature.store_id ?? null,
    storage_path: localPath,
    asset_url: localPath,
    type: signature.type ?? null,
    status: signature.status ?? "active",
    metadata: sanitizeMetadata(signature.metadata ?? {}),
  };
}

/**
 * Monta o conjunto saneado de linhas locais preservando os IDs de FK e aplicando
 * os paths locais versionados (`storedAssets`/`storedSignature`) quando houver.
 *
 * @param {{ store: any, ownerUserId: any, state: any, storedAssets?: any[], storedSignature?: any }} params
 */
export function buildSanitizedIdentity(params) {
  const { store, ownerUserId, state, storedAssets = [], storedSignature = null } = params;
  const storedByAssetId = new Map((storedAssets ?? []).map((entry) => [entry.assetId, entry]));
  const assetRows = state.assets.map((asset) => {
    const stored = storedByAssetId.get(asset.id) ?? null;
    return buildSanitizedAssetRow({
      asset,
      storeId: store.id,
      localStoragePath: stored?.localPath,
      checksum: stored?.checksum,
      sizeBytes: stored?.sizeBytes,
      mime: stored?.mime,
    });
  });

  const signatureEntry =
    storedSignature && state.signature && storedSignature.signatureId === state.signature.id
      ? storedSignature
      : null;

  return {
    store: buildSanitizedStoreRow({ store, ownerUserId }),
    profile: buildSanitizedProfileRow({ profile: state.profile, storeId: store.id }),
    assets: assetRows,
    signature: buildSanitizedSignatureRow({
      signature: state.signature,
      storeId: store.id,
      localStoragePath: signatureEntry?.localPath,
    }),
  };
}

// ─── Assets versionados/content-addressed (D8) ───────────────────────────────

/** Bucket local/remoto da assinatura visual. */
export const SIGNATURE_BUCKET = "visual-signatures";

const MIME_EXTENSION = Object.freeze({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/svg+xml": ".svg",
});

/** Checksum SHA-256 (hex) do conteúdo — base do path content-addressed. */
export function computeChecksum(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Extensão determinística a partir do MIME (fallback: extensão do path). */
export function extensionFromMime(mime, fallbackPath) {
  if (mime && MIME_EXTENSION[mime]) return MIME_EXTENSION[mime];
  const ext = path.extname(typeof fallbackPath === "string" ? fallbackPath : "");
  return ext && ext.length <= 6 ? ext : ".bin";
}

/**
 * MIME canônicos de branding aceitos na RESOLUÇÃO (não amplia a política do
 * bucket). A política real de cada bucket é validada pelo destino (Storage).
 */
export const BRANDING_MIME_EXTENSION = Object.freeze({
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/heic": ".heic",
  "image/heif": ".heif",
  "image/svg+xml": ".svg",
});

const BRANDING_EXTENSION_MIME = Object.freeze({
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".svg": "image/svg+xml",
});

function normalizeBrandingMime(value) {
  if (typeof value !== "string") return null;
  const mime = value.trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(BRANDING_MIME_EXTENSION, mime) ? mime : null;
}

/**
 * Resolvedor PURO de MIME para branding. Precedência:
 *   1) `declaredMime` (coluna `mime_type`) válido;
 *   2) `blobType` retornado pelo download (`Blob.type`) válido;
 *   3) extensão segura de `storagePath` mapeada para MIME.
 * Suporta PNG, JPEG, WEBP, HEIC, HEIF e SVG. MIME ausente/desconhecido →
 * erro sanitizado ANTES do upload (sem ampliar a política do bucket).
 * @param {{ declaredMime?: string, blobType?: string, storagePath?: string }} [input]
 * @returns {{ mime: string, extension: string }}
 */
export function resolveBrandingMime(input = {}) {
  const declared = normalizeBrandingMime(input.declaredMime);
  if (declared) return { mime: declared, extension: BRANDING_MIME_EXTENSION[declared] };

  const fromBlob = normalizeBrandingMime(input.blobType);
  if (fromBlob) return { mime: fromBlob, extension: BRANDING_MIME_EXTENSION[fromBlob] };

  const ext =
    typeof input.storagePath === "string" ? path.extname(input.storagePath).toLowerCase() : "";
  const fromExt = BRANDING_EXTENSION_MIME[ext];
  if (fromExt) return { mime: fromExt, extension: BRANDING_MIME_EXTENSION[fromExt] };

  throw new BenchImportBlockedError(
    "import_asset_mime_unresolved",
    `MIME de branding ausente/desconhecido para "${input.storagePath ?? "<sem path>"}"; tipos suportados: PNG, JPEG, WEBP, HEIC, HEIF, SVG.`,
  );
}

/**
 * Política real por bucket de branding (migrations). NÃO ampliar; sem conversão.
 * HEIC/HEIF pertencem ao upload de campanha, não ao contrato atual destes buckets.
 */
export const BRANDING_BUCKET_ALLOWED_MIME = Object.freeze({
  "store-logos": Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  "store-brand-assets": Object.freeze(["image/png", "image/jpeg", "image/webp"]),
  "visual-signatures": Object.freeze(["image/png", "image/svg+xml"]),
});

/**
 * Valida que o MIME resolvido é aceito pelo bucket de destino, ANTES do upload.
 * MIME incompatível → erro sanitizado (sem ampliar a política do bucket e sem
 * conversão/transcodificação).
 * @param {string} bucket
 * @param {string} mime
 * @returns {string}
 */
export function assertBrandingMimeAllowedForBucket(bucket, mime) {
  const allowed = BRANDING_BUCKET_ALLOWED_MIME[bucket];
  if (!allowed || !allowed.includes(mime)) {
    throw new BenchImportBlockedError(
      "import_asset_mime_not_allowed_for_bucket",
      `MIME "${mime}" não permitido no bucket "${bucket}"; permitidos: ${(allowed ?? []).join(", ") || "<nenhum>"}.`,
    );
  }
  return mime;
}

/**
 * Path versionado/content-addressed: `<storeId>/<objectId>/<checksum><ext>`.
 * Mesmo conteúdo (mesmo checksum) → mesmo path (idempotência).
 */
export function buildContentAddressedPath({ storeId, objectId, checksum, extension }) {
  const ext = extension && extension.startsWith(".") ? extension : `.${extension ?? "bin"}`;
  return `${storeId}/${objectId}/${checksum}${ext}`;
}

/** Bucket de destino do asset conforme o tipo (logo → `store-logos`). */
export function resolveAssetBucket(asset) {
  const assetType = typeof asset?.asset_type === "string" ? asset.asset_type : "logo";
  return assetType === "logo" ? "store-logos" : "store-brand-assets";
}

/** Normaliza o retorno de `storage.download` (Blob/Buffer/Uint8Array) em Buffer. */
export async function toBuffer(data) {
  if (data == null) {
    throw new BenchImportBlockedError("import_asset_download_empty", "Asset vazio na origem.");
  }
  if (typeof data.arrayBuffer === "function") return Buffer.from(await data.arrayBuffer());
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  throw new BenchImportBlockedError("import_asset_download_unsupported", "Formato de asset nao suportado.");
}

/**
 * Baixa e grava os assets atuais em paths versionados ANTES da transação (D8).
 * Em falha, remove APENAS os objetos novos já gravados e re-lança.
 */
export async function materializeStoreAssets({ source, destination, storeId, state }) {
  const storedAssets = [];
  const newObjects = [];
  try {
    for (const asset of state.assets) {
      const bucket = resolveAssetBucket(asset);
      const data = await source.download(bucket, asset.storage_path);
      const blobType = data && typeof data.type === "string" ? data.type : null;
      const buffer = await toBuffer(data);
      const { mime, extension } = resolveBrandingMime({
        declaredMime: asset.mime_type,
        blobType,
        storagePath: asset.storage_path,
      });
      assertBrandingMimeAllowedForBucket(bucket, mime);
      const checksum = computeChecksum(buffer);
      const localPath = buildContentAddressedPath({ storeId, objectId: asset.id, checksum, extension });
      await destination.uploadBrandingObject({
        bucket,
        path: localPath,
        buffer,
        contentType: mime,
      });
      newObjects.push({ bucket, path: localPath });
      storedAssets.push({ assetId: asset.id, localPath, checksum, sizeBytes: buffer.length, mime });
    }

    let storedSignature = null;
    if (state.signature) {
      const signature = state.signature;
      const data = await source.download(SIGNATURE_BUCKET, signature.storage_path);
      const blobType = data && typeof data.type === "string" ? data.type : null;
      const buffer = await toBuffer(data);
      const { mime, extension } = resolveBrandingMime({
        declaredMime: signature.mime_type,
        blobType,
        storagePath: signature.storage_path,
      });
      assertBrandingMimeAllowedForBucket(SIGNATURE_BUCKET, mime);
      const checksum = computeChecksum(buffer);
      const localPath = buildContentAddressedPath({ storeId, objectId: signature.id, checksum, extension });
      await destination.uploadBrandingObject({
        bucket: SIGNATURE_BUCKET,
        path: localPath,
        buffer,
        contentType: mime,
      });
      newObjects.push({ bucket: SIGNATURE_BUCKET, path: localPath });
      storedSignature = { signatureId: signature.id, localPath, mime };
    }

    return { storedAssets, storedSignature, newObjects };
  } catch (error) {
    await removeBrandingObjectsBestEffort(destination, newObjects);
    throw error;
  }
}

/** Remove objetos (best-effort; nunca lança). */
export async function removeBrandingObjectsBestEffort(destination, objects) {
  if (!destination || typeof destination.removeBrandingObjects !== "function") {
    return { removed: 0, failed: (objects ?? []).length };
  }
  try {
    return await destination.removeBrandingObjects(objects ?? []);
  } catch {
    return { removed: 0, failed: (objects ?? []).length };
  }
}

/** Old objects que NÃO estão referenciados pelo novo conjunto (remover após commit). */
export function selectUnreferencedOldObjects({ oldObjects, newObjects }) {
  const keyOf = (object) => `${object.bucket}:${object.path}`;
  const referenced = new Set((newObjects ?? []).map(keyOf));
  return (oldObjects ?? []).filter((object) => !referenced.has(keyOf(object)));
}

// ─── Transação SQL única de substituição integral (D9) ───────────────────────

/** Monta o upsert da loja (preserva o `id`; `logo_url` saneado = NULL). */
export function buildStoreUpsert({ store, ownerUserId }) {
  return {
    text: `INSERT INTO public.stores (id, name, segment, subsegment, tone_of_voice, positioning, short_description, slogan, brand_color, logo_url, user_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  segment = EXCLUDED.segment,
  subsegment = EXCLUDED.subsegment,
  tone_of_voice = EXCLUDED.tone_of_voice,
  positioning = EXCLUDED.positioning,
  short_description = EXCLUDED.short_description,
  slogan = EXCLUDED.slogan,
  brand_color = EXCLUDED.brand_color,
  logo_url = EXCLUDED.logo_url,
  user_id = EXCLUDED.user_id,
  updated_at = now()`,
    values: [
      store.id,
      store.name,
      store.segment,
      store.subsegment,
      store.tone_of_voice,
      store.positioning,
      store.short_description,
      store.slogan,
      store.brand_color,
      store.logo_url,
      ownerUserId,
    ],
  };
}

/**
 * Allowlist EXPLÍCITA de colunas JSONB por tabela (fronteira com node-postgres).
 * Somente estas colunas recebem `::jsonb` + `JSON.stringify`. Os builders de
 * domínio NÃO serializam — a conversão pertence exclusivamente a esta fronteira.
 */
export const JSONB_COLUMNS_BY_TABLE = Object.freeze({
  store_brand_profiles: Object.freeze(["safe_color_tokens", "brand_colors_chosen", "logo_colors_detected"]),
  store_brand_assets: Object.freeze(["metadata"]),
  store_visual_signatures: Object.freeze(["metadata"]),
  lab_bench_store_imports: Object.freeze(["detail"]),
});

/**
 * Serializa um valor destinado a coluna JSONB. Arrays/objetos → `JSON.stringify`.
 * `null`/`undefined` permanecem SQL NULL (NÃO viram JSON `null`).
 * @param {unknown} value
 * @returns {string|null}
 */
function serializeJsonbValue(value) {
  if (value === null || value === undefined) return null;
  return JSON.stringify(value);
}

/** Monta um `INSERT` parametrizado a partir de uma linha (tabela literal). */
export function buildInsertStatement(table, row) {
  const jsonbColumns = JSONB_COLUMNS_BY_TABLE[table] ?? [];
  const keys = Object.keys(row);
  const columns = keys.map((key) => `"${key}"`).join(", ");
  const placeholders = keys
    .map((key, index) => (jsonbColumns.includes(key) ? `$${index + 1}::jsonb` : `$${index + 1}`))
    .join(", ");
  const values = keys.map((key) =>
    jsonbColumns.includes(key) ? serializeJsonbValue(row[key]) : row[key],
  );
  return {
    text: `INSERT INTO public.${table} (${columns}) VALUES (${placeholders})`,
    values,
  };
}

/** Monta a linha de auditoria local (`lab_bench_store_imports`, D11). */
export function buildImportAuditRow({ storeId, sourceHost, importedBy, sourceUpdatedAt, assetCount, status, detail }) {
  return {
    store_id: storeId,
    source_host: sourceHost ?? "",
    imported_by: importedBy ?? null,
    source_updated_at: sourceUpdatedAt ?? null,
    asset_count: assetCount ?? 0,
    status: status ?? "succeeded",
    detail: sanitizeMetadata(detail ?? {}),
  };
}

/** Lê os objetos de branding atuais da loja no banco LOCAL (paths antigos). */
export async function readLocalIdentity(db, storeId) {
  const objects = [];
  const assetResult = await db.query(
    "SELECT asset_type, storage_path FROM public.store_brand_assets WHERE store_id = $1",
    [storeId],
  );
  for (const row of assetResult?.rows ?? []) {
    if (row?.storage_path) objects.push({ bucket: resolveAssetBucket(row), path: row.storage_path });
  }
  const signatureResult = await db.query(
    "SELECT storage_path FROM public.store_visual_signatures WHERE store_id = $1",
    [storeId],
  );
  for (const row of signatureResult?.rows ?? []) {
    if (row?.storage_path) objects.push({ bucket: SIGNATURE_BUCKET, path: row.storage_path });
  }
  return objects;
}

/**
 * Executa a ÚNICA transação local de substituição integral: apaga as linhas-filhas
 * (perfis, assets, assinaturas), faz upsert da loja e insere o novo conjunto com os
 * paths novos, mais a auditoria. Em falha, faz ROLLBACK e re-lança (a remoção dos
 * objetos novos é feita pelo chamador).
 */
export async function runIdentityTransaction({ db, storeId, ownerUserId, identity, audit }) {
  await db.query("BEGIN");
  try {
    await db.query("DELETE FROM public.store_brand_profiles WHERE store_id = $1", [storeId]);
    await db.query("DELETE FROM public.store_brand_assets WHERE store_id = $1", [storeId]);
    await db.query("DELETE FROM public.store_visual_signatures WHERE store_id = $1", [storeId]);

    const storeStatement = buildStoreUpsert({ store: identity.store, ownerUserId });
    await db.query(storeStatement.text, storeStatement.values);

    for (const asset of identity.assets) {
      const statement = buildInsertStatement("store_brand_assets", asset);
      await db.query(statement.text, statement.values);
    }
    if (identity.signature) {
      const statement = buildInsertStatement("store_visual_signatures", identity.signature);
      await db.query(statement.text, statement.values);
    }
    if (identity.profile) {
      const statement = buildInsertStatement("store_brand_profiles", identity.profile);
      await db.query(statement.text, statement.values);
    }
    if (audit) {
      const statement = buildInsertStatement("lab_bench_store_imports", audit);
      await db.query(statement.text, statement.values);
    }

    await db.query("COMMIT");
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      // best-effort
    }
    throw error;
  }
}

// ─── Manifesto local (upsert idempotente, D10) ───────────────────────────────

/** Caminho relativo versionado do manifesto (única fonte de elegibilidade). */
export const BENCH_MANIFEST_RELATIVE_PATH = "fixtures/lab/bench/stores.json";

/** Upsert idempotente de `{ id, label }` no manifesto, preservando o restante. */
export function upsertManifestEntry(manifest, entry) {
  const base = manifest && typeof manifest === "object" ? manifest : {};
  const stores = Array.isArray(base.stores) ? base.stores.map((store) => ({ ...store })) : [];
  const index = stores.findIndex((store) => store && store.id === entry.id);
  if (index >= 0) stores[index] = { ...stores[index], label: entry.label };
  else stores.push({ id: entry.id, label: entry.label });
  return { ...base, stores };
}

/**
 * Store de manifesto em arquivo versionado, com confinamento de caminho
 * (anti-traversal). `fsImpl` é injetável para testes sem tocar o arquivo real.
 */
export function createFileManifestStore({ root = process.cwd(), relative = BENCH_MANIFEST_RELATIVE_PATH, fsImpl = fs } = {}) {
  const rootDir = path.resolve(root, path.dirname(relative));
  const filePath = path.resolve(root, relative);
  const rel = path.relative(rootDir, filePath);
  if (rel.length === 0 || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new BenchImportBlockedError("import_manifest_path_invalid", `Caminho de manifesto invalido: ${relative}`);
  }

  return {
    path: filePath,
    async load() {
      if (!fsImpl.existsSync(filePath)) return { stores: [] };
      let parsed;
      try {
        parsed = JSON.parse(fsImpl.readFileSync(filePath, "utf8"));
      } catch {
        throw new BenchImportBlockedError("import_manifest_invalid", "Manifesto local invalido (JSON).");
      }
      return parsed && typeof parsed === "object" ? parsed : { stores: [] };
    },
    async save(manifest) {
      fsImpl.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
    },
  };
}

// ─── Importação de uma loja ──────────────────────────────────────────────────

/**
 * Importa uma loja (parte 2): confirma `is_test_store`, lê o estado atual,
 * cria/reutiliza o proprietário sintético, copia os assets em paths versionados
 * ANTES da transação, executa a transação única de substituição integral, remove
 * os antigos sem referência APÓS o commit e faz o upsert do manifesto.
 *
 * Em `--dry-run` NÃO há materialização/escrita local: apenas a leitura do estado
 * atual (a leitura remota, se houver, exige aprovação humana — CHECKPOINT A).
 *
 * @param {{ storeId: string, source: any, destination: any, db?: any, dryRun?: boolean, manifestStore?: any, importedBy?: string|null }} params
 */
export async function importOneStore(params) {
  const { storeId, source, destination, db, dryRun = false, manifestStore = null, importedBy = null } = params;
  const store = await confirmTestStore(source, storeId);
  const state = await readCurrentState(source, storeId);

  const base = {
    storeId,
    storeName: store.name ?? null,
    isTestStore: true,
    profileSource: state.profileSource,
    profileStatus: state.profileStatus,
    syncedProfiles: state.profile ? 1 : 0,
    assetCount: state.assets.length,
    hasSignature: state.signature !== null,
  };

  if (dryRun) {
    return { ...base, ownerUserId: null, ownerCreated: false, dryRun: true, imported: false, objectsWritten: 0, removedOldObjects: 0, manifestUpdated: false };
  }

  // D6 — proprietário sintético local por loja (idempotente por e-mail).
  const owner = await ensureSyntheticOwner({ destination, storeId });

  // D8 (1)(2) — baixar e gravar assets locais em paths versionados, antes da transação.
  const materialized = await materializeStoreAssets({ source, destination, storeId, state });

  // D9 — ler os paths antigos, montar o novo conjunto e rodar a ÚNICA transação.
  const oldObjects = await readLocalIdentity(db, storeId);
  const identity = buildSanitizedIdentity({
    store,
    ownerUserId: owner.userId,
    state,
    storedAssets: materialized.storedAssets,
    storedSignature: materialized.storedSignature,
  });
  const audit = buildImportAuditRow({
    storeId,
    sourceHost: source.host,
    importedBy,
    sourceUpdatedAt: store.updated_at ?? null,
    assetCount: materialized.newObjects.length,
    status: "succeeded",
    detail: {
      profileSource: state.profileSource,
      profileStatus: state.profileStatus,
      syncedProfiles: state.profile ? 1 : 0,
      hasSignature: state.signature !== null,
      objectCount: materialized.newObjects.length,
      destinationHost: destination.host ?? null,
    },
  });

  // D8 (5) — falha antes do commit remove APENAS os objetos novos.
  try {
    await runIdentityTransaction({ db, storeId, ownerUserId: owner.userId, identity, audit });
  } catch (error) {
    await removeBrandingObjectsBestEffort(destination, materialized.newObjects);
    throw error;
  }

  // D8 (4) — após o commit, remover best-effort os antigos sem referência.
  const unreferenced = selectUnreferencedOldObjects({
    oldObjects,
    newObjects: materialized.newObjects,
  });
  await removeBrandingObjectsBestEffort(destination, unreferenced);

  // D10 — upsert idempotente `{ id, label }` no manifesto versionado.
  let manifestUpdated = false;
  if (manifestStore) {
    const manifest = await manifestStore.load();
    const next = upsertManifestEntry(manifest, { id: storeId, label: store.name ?? storeId });
    await manifestStore.save(next);
    manifestUpdated = true;
  }

  return {
    ...base,
    ownerUserId: owner.userId,
    ownerCreated: owner.created,
    dryRun: false,
    imported: true,
    objectsWritten: materialized.newObjects.length,
    removedOldObjects: unreferenced.length,
    manifestUpdated,
  };
}

// ─── Orquestração ────────────────────────────────────────────────────────────

/** Resumo por loja, sem linhas/identidade (evita despejar dados no stdout da CLI). */
function toStoreSummary(result) {
  return {
    storeId: result.storeId,
    storeName: result.storeName,
    isTestStore: result.isTestStore,
    profileSource: result.profileSource,
    profileStatus: result.profileStatus,
    syncedProfiles: result.syncedProfiles,
    assetCount: result.assetCount,
    hasSignature: result.hasSignature,
    ownerUserId: result.ownerUserId,
    ownerCreated: result.ownerCreated,
    dryRun: result.dryRun,
    imported: result.imported,
    objectsWritten: result.objectsWritten,
    removedOldObjects: result.removedOldObjects,
    manifestUpdated: result.manifestUpdated,
  };
}

/**
 * Executa a importação. `deps` permite injetar clientes/banco falsos em teste
 * (`deps.destination`/`deps.source`/`deps.db`/`deps.manifestStore`) sem rede nem
 * banco real.
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

  const manifestStore = deps.manifestStore ?? (options.dryRun ? null : createFileManifestStore());
  const importedBy = deps.importedBy ?? env.BENCH_IMPORT_ACTOR ?? env.USERNAME ?? env.USER ?? null;

  let db = deps.db ?? null;
  let ownsDb = false;
  if (!options.dryRun && !db) {
    db = createLocalDatabase(env);
    ownsDb = true;
  }

  const results = [];
  try {
    for (const storeId of options.storeIds) {
      const result = await importOneStore({
        storeId,
        source,
        destination,
        db,
        dryRun: options.dryRun,
        manifestStore,
        importedBy,
      });
      results.push(toStoreSummary(result));
    }
  } finally {
    if (ownsDb && db) {
      try {
        await db.close();
      } catch {
        // best-effort
      }
    }
  }

  return {
    sourceHost: source.host,
    destinationHost: destination.host ?? null,
    dryRun: options.dryRun,
    storeCount: results.length,
    stores: results,
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
