/**
 * Preenchimento controlado de miniaturas das campanhas existentes.
 *
 * - inventário canônico: `campaigns.storage_path` com `status = 'ready'`
 * - dry-run por padrão; `--write` exige confirmação e ambiente local
 * - nunca altera campanhas, créditos ou arquivos originais
 * - homolog/produção permanecem bloqueados nesta quick
 *
 * Uso:
 *   tsx scripts/campaign-thumbnails/backfill.ts --env local \
 *     --expected-url http://127.0.0.1:54321 --dry-run
 */

import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildBackfillKeysetFilter,
  encodeBackfillCursor,
  isMissingObjectError,
  parseBackfillCursor,
  type BackfillStorageError,
} from "../../src/lib/campaign/thumbnail/backfill-selection";
import {
  runBackfill,
  validateBackfillPreflight,
  type BackfillCandidate,
  type BackfillDeps,
  type BackfillEnv,
  type BackfillOptions,
} from "../../src/lib/campaign/thumbnail/backfill-runner";
import {
  createTimedSupabaseUploader,
  generateCampaignThumbnail,
  inspectOriginalImage,
  normalizeEndpoint,
  type ThumbnailContext,
} from "../../src/lib/campaign/thumbnail/thumbnail-generator";
import { THUMBNAIL_BUCKET } from "../../src/lib/campaign/thumbnail/thumbnail-path";

const VERSION = "1.0.0";
const DEFAULT_ENV_FILE = ".env.local";

interface ParsedArgs {
  help?: boolean;
  version?: boolean;
  env?: BackfillEnv;
  expectedUrl?: string;
  envFile?: string;
  dryRun: boolean;
  write: boolean;
  confirmEnv?: string;
  limit: number;
  batchSize: number;
  concurrency: number;
  after: string | null;
  report?: string;
  verbose: boolean;
  stores: string[];
  campaigns: string[];
}

function usage(): string {
  return `Miniaturas de campanhas — preenchimento controlado

Uso:
  tsx scripts/campaign-thumbnails/backfill.ts [opções]

Ambiente:
  --env <local|homolog|production>  Obrigatório. Homolog permanece bloqueado.
  --expected-url <origem>           Obrigatório. Protocolo+host+porta exatos.
  --env-file <path>                 Default: ${DEFAULT_ENV_FILE}
  --confirm-env <env>               Obrigatório com --write; igual ao --env.

Modo:
  --dry-run                         Padrão. Lê e classifica; NÃO gera nem envia.
  --write                           Preenche miniaturas ausentes (local ou produção).

Escopo:
  --store <uuid>                    Repetível. Filtra por loja.
  --campaign <uuid>                 Repetível. Filtra por campanha.
  --limit <n>                       Default 50 (máx. 500).
  --batch-size <n>                  Default 25.
  --concurrency <n>                 Default 2 (máx. 4).
  --after <cursor>                  Retoma no cursor keyset <createdAt ISO>|<id>
                                    emitido no relatório anterior.
  --report <path>                   Grava o relatório JSON.
  --verbose                         Loga cada item no stderr.

Segurança:
  - origem exata de --expected-url (protocolo+host+porta) é obrigatória;
  - local exige loopback; produção NÃO aceita loopback;
  - homolog permanece bloqueado nesta autorização (exit 2);
  - escrita exige --write E --confirm-env igual ao --env;
  - guardas são avaliadas antes de criar client/rede (zero chamadas externas);
  - miniaturas existentes são ignoradas (idempotente);
  - timeout de upload não prova ausência: a próxima execução confere antes.

Saída: 0 ok; 1 falhas/pendências; 2 guarda; 3 configuração.
`;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    dryRun: false,
    write: false,
    limit: 50,
    batchSize: 25,
    concurrency: 2,
    after: null,
    verbose: false,
    stores: [],
    campaigns: [],
  };

  const takeValue = (index: number, name: string): [string, number] => {
    const inline = argv[index].split("=");
    if (inline.length > 1) return [inline.slice(1).join("="), index];
    const value = argv[index + 1];
    if (value === undefined) throw new Error(`missing_value:${name}`);
    return [value, index + 1];
  };

  for (let i = 0; i < argv.length; i += 1) {
    const raw = argv[i];
    const name = raw.split("=")[0];
    switch (name) {
      case "--help":
      case "-h":
        args.help = true;
        break;
      case "--version":
        args.version = true;
        break;
      case "--env": {
        const [value, next] = takeValue(i, name);
        if (!["local", "homolog", "production"].includes(value)) {
          throw new Error("invalid_env");
        }
        args.env = value as BackfillEnv;
        i = next;
        break;
      }
      case "--expected-url": {
        const [value, next] = takeValue(i, name);
        args.expectedUrl = value;
        i = next;
        break;
      }
      case "--env-file": {
        const [value, next] = takeValue(i, name);
        args.envFile = value;
        i = next;
        break;
      }
      case "--confirm-env": {
        const [value, next] = takeValue(i, name);
        args.confirmEnv = value;
        i = next;
        break;
      }
      case "--store": {
        const [value, next] = takeValue(i, name);
        args.stores.push(value);
        i = next;
        break;
      }
      case "--campaign": {
        const [value, next] = takeValue(i, name);
        args.campaigns.push(value);
        i = next;
        break;
      }
      case "--limit":
      case "--batch-size":
      case "--concurrency": {
        const [value, next] = takeValue(i, name);
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) {
          throw new Error(`invalid_number:${name}`);
        }
        if (name === "--limit") args.limit = parsed;
        if (name === "--batch-size") args.batchSize = parsed;
        if (name === "--concurrency") args.concurrency = parsed;
        i = next;
        break;
      }
      case "--after": {
        const [value, next] = takeValue(i, name);
        args.after = value;
        i = next;
        break;
      }
      case "--report": {
        const [value, next] = takeValue(i, name);
        args.report = value;
        i = next;
        break;
      }
      case "--verbose":
        args.verbose = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--write":
        args.write = true;
        break;
      default:
        throw new Error(`unknown_arg:${name}`);
    }
  }

  if (args.dryRun && args.write) {
    throw new Error("dry_run_and_write_conflict");
  }
  if (!args.dryRun && !args.write) args.dryRun = true;
  return args;
}

function parseEnvFile(content: string): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (const line of content.replace(/\r\n?/g, "\n").split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  }
  return parsed;
}

function loadEnv(file: string): Record<string, string | undefined> {
  let fileEnv: Record<string, string> = {};
  try {
    fileEnv = parseEnvFile(readFileSync(file, "utf8"));
  } catch {
    fileEnv = {};
  }
  const merged: Record<string, string | undefined> = { ...fileEnv };
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}

function makeDeps(client: SupabaseClient): BackfillDeps {
  return {
    async listCampaignsPage({ after, limit, stores, campaigns }) {
      // Keyset consistente por (created_at, id): imune a inserções/remoções no
      // meio do inventário. O cursor é opaco e sempre emitido/consumido no
      // mesmo formato `<createdAt ISO>|<campaignId>`.
      const parsedCursor = parseBackfillCursor(after);
      if (after && !parsedCursor) {
        throw new Error("invalid_cursor");
      }

      let query = client
        .from("campaigns")
        .select("id, store_id, storage_path, status, created_at", {
          count: "exact",
        })
        .eq("status", "ready")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(limit);

      if (parsedCursor) {
        query = query.or(buildBackfillKeysetFilter(parsedCursor));
      }
      if (stores && stores.length > 0) query = query.in("store_id", stores);
      if (campaigns && campaigns.length > 0) query = query.in("id", campaigns);

      const { data, error } = await query;
      if (error) throw new Error(`inventory_failed:${error.message}`);

      const items: BackfillCandidate[] = (data ?? [])
        .filter((row) => typeof row.storage_path === "string")
        .map((row) => ({
          campaignId: String(row.id),
          storeId: String(row.store_id),
          originalPath: String(row.storage_path),
          // Texto EXATO do banco: preserva microssegundos (nunca `Date`).
          createdAt: String(row.created_at),
        }));

      const last = items[items.length - 1];
      return {
        items,
        nextCursor:
          items.length === limit && last
            ? encodeBackfillCursor({
                createdAt: last.createdAt,
                campaignId: last.campaignId,
              })
            : null,
      };
    },

    async downloadOriginal(path) {
      const { data, error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .download(path);
      if (error) {
        return {
          data: null,
          error: error as unknown as BackfillStorageError,
        };
      }
      if (!data) return { data: null, error: null };
      return { data: Buffer.from(await data.arrayBuffer()), error: null };
    },

    async thumbnailExists(path) {
      const { data, error } = await client.storage
        .from(THUMBNAIL_BUCKET)
        .download(path);
      if (!error && data) return { exists: true };
      if (error && isMissingObjectError(error)) return { exists: false };
      return { exists: false, error: error ?? new Error("thumbnail_probe_failed") };
    },

    async inspectOriginal(buffer) {
      return inspectOriginalImage(buffer);
    },

    async generate({ originalPath, originalBuffer, context }) {
      return generateCampaignThumbnail({
        originalPath,
        originalBuffer,
        context,
      });
    },
  };
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (error) {
    console.error(
      `config_error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 3;
  }

  if (args.help) {
    process.stdout.write(usage());
    return 0;
  }
  if (args.version) {
    process.stdout.write(`${VERSION}\n`);
    return 0;
  }

  if (!args.env || !args.expectedUrl) {
    console.error("config_error: --env e --expected-url são obrigatórios");
    return 3;
  }

  if (args.after && !parseBackfillCursor(args.after)) {
    console.error(
      "config_error: --after inválido (formato <createdAt ISO>|<campaignId>)",
    );
    return 3;
  }

  const env = loadEnv(args.envFile ?? DEFAULT_ENV_FILE);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "config_error: NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes",
    );
    return 3;
  }

  const actualEndpoint = normalizeEndpoint(url);
  const expectedEndpoint = normalizeEndpoint(args.expectedUrl);
  if (!actualEndpoint || !expectedEndpoint) {
    console.error("config_error: URL de ambiente inválida");
    return 3;
  }

  const mode = args.write ? "write" : "dry-run";
  const preflight = validateBackfillPreflight({
    mode,
    env: args.env,
    expectedEndpoint,
    actualEndpoint,
    confirmEnv: args.confirmEnv ?? null,
  });
  if (preflight) {
    // Antes de criar qualquer client: zero chamadas externas.
    console.error(`guard: ${preflight}`);
    return 2;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let context: ThumbnailContext | null = null;
  if (args.write) {
    try {
      const uploader = createTimedSupabaseUploader({ url, key });
      context = { endpoint: uploader.endpoint, uploader };
    } catch (error) {
      console.error(
        `config_error: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 3;
    }
  }

  const options: BackfillOptions = {
    mode: args.write ? "write" : "dry-run",
    env: args.env,
    expectedEndpoint,
    actualEndpoint,
    confirmEnv: args.confirmEnv ?? null,
    limit: args.limit,
    batchSize: args.batchSize,
    concurrency: args.concurrency,
    after: args.after,
    context,
    stores: args.stores,
    campaigns: args.campaigns,
  };

  const result = await runBackfill({ deps: makeDeps(client), options });

  if (args.report) {
    writeFileSync(args.report, `${JSON.stringify(result.report, null, 2)}\n`);
  }

  if (args.verbose) {
    for (const item of result.report.items) {
      console.error(
        `${item.outcome}\t${item.campaignId}\t${item.originalPath}${
          item.reason ? `\t${item.reason}` : ""
        }`,
      );
    }
  }

  console.log(
    JSON.stringify({
      mode: result.report.mode,
      env: result.report.env,
      endpoint: result.report.endpoint,
      blockedReason: result.blockedReason ?? null,
      cursor: result.report.cursor,
      counters: result.report.counters,
    }),
  );

  if (result.blockedReason) return 2;
  const { failed, accessError, missingOriginal } = result.report.counters;
  return failed + accessError + missingOriginal > 0 ? 1 : 0;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(
        `fatal: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 3;
    });
}
