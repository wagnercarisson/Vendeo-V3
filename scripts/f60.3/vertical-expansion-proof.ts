/**
 * F60.3 / 60.3-04 — Harness da prova real paga de UMA expansão 9:16.
 *
 * Invariante de execução (todas as invocações, inclusive `--dry-run` e
 * `--check-manifest`):
 *
 *   node --import ./scripts/f60.3/server-only-resolve.mjs --import tsx \
 *     scripts/f60.3/vertical-expansion-proof.ts <flags>
 *
 * Nunca `npx`, nunca `node node_modules/tsx/dist/cli.mjs` sem o resolvedor, e
 * nenhum import estático do módulo de produto: `expandVerticalToNineSixteen` e
 * `prepareSquareForExpansion` só são carregados por `await import(...)` dentro de
 * `runProof`/`runPrepareSource` e da asserção de preflight.
 *
 * Modos:
 * - `--dry-run`      cobertura/preflight somente leitura; NUNCA paga; exit 0 mesmo
 *                    com `ready: false` (permite a sequência preparação→preflight);
 * - `--prepare-source` Task 2; grava via F60.1 sob `F60_3_PREPARE_AUTHORIZED=1`;
 * - `--apply`        única chamada paga; exige autorização, orçamento e preflight;
 * - `--check-manifest` verificador não pago de manifesto/intento.
 *
 * Nenhum item do checklist é pulado por env ausente: ausência vira FAIL do item.
 * Nenhum segredo é impresso/persistido: apenas presença/comprimento.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { Client as PostgresClient } from "pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { estimateVerticalCall } from "../../src/lib/product-vertical-9-16/cost/vertical-estimate";
import type { ArtifactRecord } from "../../src/lib/campaign/composition-artifacts/types";
import type {
  ExpandVerticalInput,
  ExpandVerticalResult,
} from "../../src/lib/campaign/vertical-expansion/types";

import {
  createIntentExclusive,
  INTENT_STATUS,
  markIntentTerminal,
  proofIntentPath,
  readIntent,
  type ProofIntentRecord,
  type ProofIntentTerminalRecord,
  type TerminalIntentStatus,
} from "./proof-intent";

/* ------------------------------------------------------------------------- */
/* Constantes do harness                                                      */
/* ------------------------------------------------------------------------- */

export const EVIDENCE_DIR = path.join("scripts", "f60.3", "evidence");

export const PREFLIGHT_MD = path.join(
  ".planning",
  "phases",
  "60.3-f60-3-expansao-por-ia-da-campanha-9-16",
  "60.3-04-PREFLIGHT.md",
);

const F60_1_MIGRATION_VERSION = "20261110202749";
const COMPOSITION_BUCKET = "campaign-internal-artifacts";
/** Bucket privado da arte 1:1 de campanha; somente leitura neste harness. */
const SOURCE_BUCKET = "campaign-images";
const EXPANSION_ARTIFACT_TABLE = "campaign_composition_artifacts";
const DECLARATION_NO_PAID_CALL = "sem chamada paga";
const REQUESTED_SIZE = "1152x2048" as const;

const ENV = Object.freeze({
  storeId: "F60_3_STORE_ID",
  campaignId: "F60_3_CAMPAIGN_ID",
  operationId: "F60_3_OPERATION_ID",
  sourceOperationId: "F60_3_SOURCE_OPERATION_ID",
  preparedOperationId: "F60_3_PREPARED_OPERATION_ID",
  attemptRef: "F60_3_ATTEMPT_REF",
  budget: "F60_3_AUTHORIZED_BUDGET_USD",
  maxCalls: "F60_3_MAX_CALLS",
  homologAuthorized: "F60_3_HOMOLOG_AUTHORIZED",
  prepareAuthorized: "F60_3_PREPARE_AUTHORIZED",
});

/** Nomes de env/flags registrados no intento (nunca valores). */
const INTENT_ENV_IDENTIFIERS: readonly string[] = Object.freeze([
  "F60_1_TARGET",
  "F60_1_HOMOLOG_AUTHORIZED",
  "F60_TEST_ALLOW_WRITES",
  "TEST_DATABASE_URL",
  "SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "OPENAI_API_KEY",
  "F60_3_HOMOLOG_AUTHORIZED",
  "F60_3_MAX_CALLS",
  "F60_3_AUTHORIZED_BUDGET_USD",
  "F60_3_OPERATION_ID",
  "F60_3_STORE_ID",
  "F60_3_CAMPAIGN_ID",
  "F60_3_SOURCE_OPERATION_ID",
  "F60_3_ATTEMPT_REF",
  "--apply",
  "--authorized",
]);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const LOOPBACK_HOSTS = Object.freeze(["127.0.0.1", "localhost", "[::1]", "::1"]);

/** Checklist obrigatório do preflight (ordem fixa, 10 itens). */
export const PREFLIGHT_CHECK_IDS = Object.freeze([
  "module_import",
  "f60_1_target",
  "supabase_env",
  "credentials",
  "f60_1_applied",
  "catalog_pricing",
  "source",
  "destination",
  "campaigns_snapshot",
  "pre_call_cost",
] as const);

type CheckStatus = "PASS" | "FAIL";

/* ------------------------------------------------------------------------- */
/* Tipos públicos                                                             */
/* ------------------------------------------------------------------------- */

export interface PreflightCheck {
  readonly id: string;
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export type SourceStatus = "prepared" | "original_only" | "unresolved";

export interface CampaignSnapshot {
  readonly id: string;
  readonly status: string | null;
  readonly storagePath: string | null;
}

export interface PreflightSummary {
  readonly sourceStatus: SourceStatus;
  readonly provider: string | null;
  readonly model: string | null;
  readonly protocol: string | null;
  readonly quality: string | null;
  readonly pricingVersion: string | null;
  readonly imageUnitUsd: number | null;
  readonly estimatedPreCallUsd: number | null;
  readonly estimateSource: string | null;
  readonly pricingMissing: readonly string[];
  readonly sourceArtifactId: string | null;
  readonly sourceChecksumSha256: string | null;
  readonly sourceByteSize: number | null;
  readonly destinationStatus: string;
  readonly credential: "product" | "missing";
  readonly campaignsBefore: CampaignSnapshot | null;
}

export interface PreflightEnvironmentInfo {
  readonly targetKind: string | null;
  readonly dbTarget: string | null;
  readonly apiTarget: string | null;
  readonly originsConcordant: boolean;
  readonly serviceRoleKey: "present" | "absent";
  readonly anonKey: "present" | "absent";
  readonly credential: "product" | "missing";
}

export interface PreflightResult {
  readonly kind: "f60.3-preflight";
  readonly mode: "dry-run" | "apply" | "prepare-source";
  readonly checkedAt: string;
  readonly ready: boolean;
  readonly providerCalls: 0;
  readonly credential: "product" | "missing";
  readonly declaration: string;
  readonly checks: readonly PreflightCheck[];
  readonly summary: PreflightSummary;
  readonly environment: PreflightEnvironmentInfo;
  readonly evidencePath: string | null;
}

export interface ProofArgs {
  readonly authorized?: string | null;
}

export type ExpandFn = (
  input: ExpandVerticalInput,
) => Promise<ExpandVerticalResult>;

export type PrepareSourceFn = (input: {
  readonly source: {
    readonly storeId: string;
    readonly campaignId: string;
    readonly operationId: string;
    readonly role: "square_original";
  };
  readonly preparedOperationId: string;
  readonly authorization: { readonly kind: "system" };
}) => Promise<PrepareSourceResultLike>;

export interface PrepareSourceResultLike {
  readonly kind: string;
  readonly artifact?: ArtifactRecord;
  readonly persistence?: "created" | "reused";
  readonly reason?: string;
  readonly detail?: string;
}

export type RetrieveSourceArtifactFn = (
  input: {
    readonly identity: {
      readonly storeId: string;
      readonly campaignId: string;
      readonly operationId: string;
      readonly role: "square_original" | "square_prepared";
    };
    readonly authorization: { readonly kind: "system" };
  },
  deps: { readonly client?: SupabaseClient },
) => Promise<
  | { readonly kind: "integral"; readonly artifact: ArtifactRecord; readonly bytes: Buffer }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid"; readonly reason: string }
  | { readonly kind: "metadata_conflict"; readonly reason: string; readonly artifact?: ArtifactRecord }
  | { readonly kind: "indeterminate" }
>;

export type PersistSourceArtifactFn = (
  input: {
    readonly identity: {
      readonly storeId: string;
      readonly campaignId: string;
      readonly operationId: string;
      readonly role: "square_original";
    };
    readonly authorization: { readonly kind: "system" };
    readonly bytes: Buffer;
    readonly origin: "provider_generation";
    readonly source: { readonly kind: "none" };
  },
  deps: { readonly client?: SupabaseClient },
) => Promise<
  | { readonly kind: "created" }
  | { readonly kind: "reused"; readonly adoption: boolean }
  | {
      readonly kind:
        | "content_conflict"
        | "identity_conflict"
        | "metadata_conflict"
        | "provenance_conflict";
      readonly reason: string;
      readonly existing?: ArtifactRecord | null;
    }
  | { readonly kind: "invalid_input"; readonly reason: string }
  | { readonly kind: "integrity_failure"; readonly reason: string }
  | { readonly kind: "persistence_failure"; readonly reason: string; readonly storagePath?: string }
  | { readonly kind: "indeterminate"; readonly reason: string }
>;

export type VerifySourceBytesFn = (
  bytes: Buffer,
  role: "square_original",
) => Promise<
  | {
      readonly ok: true;
      readonly width: number;
      readonly height: number;
      readonly mimeType: string;
      readonly byteSize: number;
      readonly checksumSha256: string;
    }
  | { readonly ok: false; readonly reason: string }
>;

export type DownloadSourceObjectFn = (
  bucket: string,
  objectPath: string,
) => Promise<Buffer>;

export interface HarnessDeps {
  /** Costura de teste: relógio determinístico. */
  readonly now?: () => Date;
  /** Costura de teste: diretório de evidência (nunca o real nos testes). */
  readonly evidenceDir?: string;
  /** Costura de teste: preflight já calculado (sem DB/Storage). */
  readonly preflight?: (
    env: NodeJS.ProcessEnv,
    options: { readonly apply?: boolean; readonly mode?: PreflightResult["mode"] },
  ) => Promise<PreflightResult>;
  /** Costura de teste: substitui o módulo real (uma invocação observável). */
  readonly expand?: ExpandFn;
  /** Costura de teste: substitui `prepareSquareForExpansion`. */
  readonly prepareSource?: PrepareSourceFn;
  /** Costura de teste: retrieve de `square_original`/`square_prepared`. */
  readonly retrieve?: RetrieveSourceArtifactFn;
  /** Costura de teste: leitura read-only do objeto em `campaign-images`. */
  readonly downloadSourceObject?: DownloadSourceObjectFn;
  /** Costura de teste: `persistCompositionArtifact` do `square_original`. */
  readonly persistSource?: PersistSourceArtifactFn;
  /** Costura de teste: `verifyCompositionArtifactBytes` da arte real. */
  readonly verifySourceBytes?: VerifySourceBytesFn;
}

export type ProofTerminalStatus = "completed" | "failed" | "unknown";

export interface ProofOutcome {
  readonly mode: "apply";
  readonly ok: boolean;
  readonly exitCode: number;
  readonly status: "refused" | ProofTerminalStatus | "pending";
  readonly providerCalls: 0 | 1;
  readonly reason?: string;
  readonly operationId?: string;
  readonly intentPath?: string;
  readonly manifestPath?: string;
  readonly latestPath?: string;
  readonly callId?: string | null;
  readonly resultKind?: string | null;
  readonly observedCostUsd?: number | null;
  readonly costSource?: string | null;
  readonly estimatedPreCallUsd?: number | null;
  readonly authorizedBudgetUsd?: number | null;
  readonly campaignsUnchanged?: boolean | null;
  readonly declaration: string;
}

export interface PrepareSourceOutcome {
  readonly mode: "prepare-source";
  readonly ok: boolean;
  readonly exitCode: number;
  readonly result: "prepared" | "reused" | "existing" | "refused" | "failed";
  readonly providerCalls: 0;
  readonly reason?: string;
  readonly preparedOperationId?: string;
  readonly sourceOperationId?: string;
  readonly artifactId?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly mimeType?: string | null;
  readonly byteSize?: number | null;
  readonly checksumSha256?: string | null;
  readonly origin?: string | null;
  readonly evidencePath?: string | null;
  readonly registrationResult?: "created" | "reused" | "existing";
  readonly registrationArtifactId?: string | null;
  readonly registrationChecksumSha256?: string | null;
  readonly sourceBucket?: string;
  readonly sourceObjectPath?: string;
  readonly declaration: string;
}

export interface CheckManifestCheck {
  readonly id: string;
  readonly status: CheckStatus;
  readonly detail: string;
}

export interface CheckManifestOutcome {
  readonly mode: "check-manifest";
  readonly ok: boolean;
  readonly exitCode: number;
  readonly status: "completed" | "failed" | "unknown" | "pending" | "invalid" | "missing";
  readonly manifestPath: string;
  readonly checks: readonly CheckManifestCheck[];
  readonly declaration: string;
}

/* ------------------------------------------------------------------------- */
/* Helpers de ambiente (nunca imprimem valores de segredo)                    */
/* ------------------------------------------------------------------------- */

function trimmed(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function isUuid(value: string | undefined): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function parseHttpUrl(raw: string | undefined): URL | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function parsePostgresUrl(raw: string | undefined): URL | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function httpPort(parsed: URL): string {
  if (parsed.port.length > 0) return parsed.port;
  return parsed.protocol === "https:" ? "443" : "80";
}

function isLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTS.includes(String(hostname));
}

function hostPort(parsed: URL | null): string | null {
  if (parsed === null) return null;
  return `${parsed.hostname}:${httpPort(parsed)}`;
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return typeof code === "string" && code.length > 0 ? `${error.name}:${code}` : error.name;
  }
  return "UnknownError";
}

function readNumber(raw: string | undefined): number | null {
  const value = trimmed(raw);
  if (value.length === 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, "-");
}

function writeJsonAtomic(filePath: string, payload: unknown): void {
  const tempPath = `${filePath}.tmp`;
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  renameSync(tempPath, filePath);
}

function pass(id: string, name: string, detail: string): PreflightCheck {
  return Object.freeze({ id, name, status: "PASS" as const, detail });
}

function fail(id: string, name: string, detail: string): PreflightCheck {
  return Object.freeze({ id, name, status: "FAIL" as const, detail });
}

/* ------------------------------------------------------------------------- */
/* Conexões auxiliares (somente leitura no preflight)                         */
/* ------------------------------------------------------------------------- */

interface AdminClientHandle {
  readonly client: SupabaseClient;
}

function createAdminClient(env: NodeJS.ProcessEnv): AdminClientHandle | null {
  const url = trimmed(env.NEXT_PUBLIC_SUPABASE_URL);
  const key = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  if (url.length === 0 || key.length === 0) return null;
  return {
    client: createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  };
}

interface PgHandle {
  readonly client: PostgresClient;
}

async function openPgClient(env: NodeJS.ProcessEnv): Promise<PgHandle | null> {
  const raw = trimmed(env.TEST_DATABASE_URL);
  if (raw.length === 0) return null;
  const parsed = parsePostgresUrl(raw);
  if (parsed === null) return null;

  const user =
    decodeURIComponent(parsed.username ?? "").length > 0
      ? decodeURIComponent(parsed.username)
      : trimmed(env.PGUSER) || undefined;
  const password =
    decodeURIComponent(parsed.password ?? "").length > 0
      ? decodeURIComponent(parsed.password)
      : trimmed(env.PGPASSWORD) || undefined;

  const client = new PostgresClient({
    connectionString: raw,
    ...(user === undefined ? {} : { user }),
    ...(password === undefined ? {} : { password }),
    ssl: false,
  });

  try {
    await client.connect();
  } catch {
    try {
      await client.end();
    } catch {
      // encerramento best-effort
    }
    return null;
  }
  return { client };
}

function rowsOf(result: unknown): readonly Record<string, unknown>[] {
  if (result === null || typeof result !== "object") return [];
  const rows = (result as { rows?: unknown }).rows;
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

async function readCampaignSnapshot(
  pg: PgHandle | null,
  storeId: string | undefined,
  campaignId: string | undefined,
): Promise<CampaignSnapshot | null> {
  if (pg === null || !isUuid(storeId) || !isUuid(campaignId)) return null;
  try {
    const result = await pg.client.query(
      `select id, status, storage_path
         from public.campaigns
        where id = $1 and store_id = $2`,
      [campaignId, storeId],
    );
    const rows = rowsOf(result);
    if (rows.length !== 1) return null;
    const row = rows[0];
    return Object.freeze({
      id: String(row.id),
      status: typeof row.status === "string" ? row.status : null,
      storagePath: typeof row.storage_path === "string" ? row.storage_path : null,
    });
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------------- */
/* Preflight                                                                  */
/* ------------------------------------------------------------------------- */

export interface PreflightOptions {
  readonly apply?: boolean;
  readonly mode?: PreflightResult["mode"];
  readonly persist?: boolean;
  readonly evidenceDir?: string;
  readonly now?: () => Date;
}

/**
 * Checklist obrigatório, somente leitura. Nunca chama provider, nunca escreve em
 * banco/Storage. Grava `preflight-<timestamp>.json` (evidência) por padrão.
 */
export async function runPreflight(
  env: NodeJS.ProcessEnv = process.env,
  options: PreflightOptions = {},
): Promise<PreflightResult> {
  const mode = options.mode ?? (options.apply === true ? "apply" : "dry-run");
  const apply = mode === "apply" || options.apply === true;
  const now = options.now ?? (() => new Date());
  const evidenceDir = options.evidenceDir ?? EVIDENCE_DIR;
  const checks: PreflightCheck[] = [];

  // ---------------------------------------------------------------- item 1
  let expandModuleLoaded = false;
  try {
    const expandModule = await import("../../src/lib/campaign/vertical-expansion/expand");
    const candidate = (expandModule as { expandVerticalToNineSixteen?: unknown })
      .expandVerticalToNineSixteen;
    if (typeof candidate !== "function") {
      checks.push(
        fail("module_import", "Import do módulo", "expandVerticalToNineSixteen ausente"),
      );
    } else {
      expandModuleLoaded = true;
      checks.push(
        pass(
          "module_import",
          "Import do módulo",
          "expandVerticalToNineSixteen carregado por import dinâmico SEM executar (server-only resolvido)",
        ),
      );
    }
  } catch (error) {
    checks.push(
      fail(
        "module_import",
        "Import do módulo",
        `falha ao importar sob o resolvedor (${describeError(error)}); rode com --import ./scripts/f60.3/server-only-resolve.mjs`,
      ),
    );
  }

  // ---------------------------------------------------------------- item 2
  const gateSpecifier: string = "../testing/f60-1-gate.mjs";
  let gateTargetKind: string | null = null;
  try {
    const gateModule = (await import(gateSpecifier)) as {
      evaluateF601Target?: (value: NodeJS.ProcessEnv) => {
        ready: boolean;
        reasons: readonly unknown[];
        targetKind: string | null;
      };
    };
    if (typeof gateModule.evaluateF601Target !== "function") {
      checks.push(fail("f60_1_target", "Alvo F60.1", "evaluateF601Target ausente"));
    } else {
      const gate = gateModule.evaluateF601Target(env);
      gateTargetKind = gate.targetKind ?? null;
      const reasons = Array.isArray(gate.reasons) ? gate.reasons.map(String) : [];
      if (gate.ready && gateTargetKind === "homolog-existing") {
        checks.push(
          pass(
            "f60_1_target",
            "Alvo F60.1",
            "homolog-existing autorizado (DB 127.0.0.1:57782/postgres, API 127.0.0.1:57781)",
          ),
        );
      } else {
        checks.push(
          fail(
            "f60_1_target",
            "Alvo F60.1",
            `alvo não autorizado (${gateTargetKind ?? "sem F60_1_TARGET"}): ${reasons.join("; ") || "motivo não informado"}`,
          ),
        );
      }
    }
  } catch (error) {
    checks.push(
      fail("f60_1_target", "Alvo F60.1", `falha ao avaliar o gate (${describeError(error)})`),
    );
  }

  // ---------------------------------------------------------------- item 3
  const nextUrl = parseHttpUrl(trimmed(env.NEXT_PUBLIC_SUPABASE_URL));
  const gateUrl = parseHttpUrl(trimmed(env.SUPABASE_URL));
  let originsConcordant = false;
  {
    const nextOk =
      nextUrl !== null && isLoopback(nextUrl.hostname) && httpPort(nextUrl) === "57781";
    const gateOk =
      gateUrl !== null && isLoopback(gateUrl.hostname) && httpPort(gateUrl) === "57781";
    originsConcordant =
      nextOk &&
      gateOk &&
      nextUrl !== null &&
      gateUrl !== null &&
      nextUrl.protocol === gateUrl.protocol &&
      nextUrl.hostname === gateUrl.hostname &&
      httpPort(nextUrl) === httpPort(gateUrl);

    if (originsConcordant) {
      checks.push(
        pass(
          "supabase_env",
          "Env do Supabase do módulo",
          `NEXT_PUBLIC_SUPABASE_URL=${hostPort(nextUrl)} e SUPABASE_URL=${hostPort(gateUrl)} concordantes (loopback 57781)`,
        ),
      );
    } else {
      checks.push(
        fail(
          "supabase_env",
          "Env do Supabase do módulo",
          `origens divergentes/ inválidas: NEXT_PUBLIC_SUPABASE_URL=${hostPort(nextUrl) ?? "ausente"}, SUPABASE_URL=${hostPort(gateUrl) ?? "ausente"} (exigido 127.0.0.1:57781 nos dois)`,
        ),
      );
    }
  }

  // ---------------------------------------------------------------- item 4
  const serviceKey = trimmed(env.SUPABASE_SERVICE_ROLE_KEY);
  const anonKey = trimmed(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const productKey = trimmed(env.OPENAI_API_KEY);
  const benchKey = trimmed(env.OPENAI_BENCH_API_KEY);
  let credential: "product" | "missing" = "missing";
  {
    if (serviceKey.length === 0) {
      checks.push(
        fail("credentials", "Chaves", "SUPABASE_SERVICE_ROLE_KEY ausente/vazia"),
      );
    } else if (anonKey.length === 0) {
      checks.push(
        fail("credentials", "Chaves", "NEXT_PUBLIC_SUPABASE_ANON_KEY ausente/vazia"),
      );
    } else if (productKey.length === 0) {
      checks.push(
        fail(
          "credentials",
          "Chaves",
          benchKey.length > 0
            ? "somente OPENAI_BENCH_API_KEY presente — a chave da bancada NÃO é usada silenciosamente"
            : "OPENAI_API_KEY ausente/vazia",
        ),
      );
    } else {
      credential = "product";
      checks.push(
        pass(
          "credentials",
          "Chaves",
          `serviceRoleKey: present(${serviceKey.length}); anonKey: present; openai: product(present)`,
        ),
      );
    }
  }

  // ---------------------------------------------------------------- item 5
  const pgTarget = parsePostgresUrl(trimmed(env.TEST_DATABASE_URL));
  const pg = await openPgClient(env);
  try {
    if (pg === null) {
      checks.push(
        fail(
          "f60_1_applied",
          "F60.1 aplicada",
          pgTarget === null
            ? "TEST_DATABASE_URL ausente/inválida"
            : "conexão PostgreSQL somente leitura indisponível (credencial local ausente?)",
        ),
      );
    } else {
      try {
        const repositoryModule = (await import(
          "../../src/lib/campaign/composition-artifacts/repository"
        )) as { ARTIFACT_SELECT_COLUMNS?: string };
        const requiredColumns = (repositoryModule.ARTIFACT_SELECT_COLUMNS ?? "")
          .split(",")
          .map((column) => column.trim())
          .filter((column) => column.length > 0);

        const columnsResult = await pg.client.query(
          `select column_name
             from information_schema.columns
            where table_schema = 'public' and table_name = $1`,
          [EXPANSION_ARTIFACT_TABLE],
        );
        const presentColumns = new Set(
          rowsOf(columnsResult).map((row) => String(row.column_name)),
        );
        const missingColumns = requiredColumns.filter((column) => !presentColumns.has(column));

        const bucketResult = await pg.client.query(
          `select id from storage.buckets where id = $1`,
          [COMPOSITION_BUCKET],
        );
        const ledgerResult = await pg.client.query(
          `select version from supabase_migrations.schema_migrations where version = $1`,
          [F60_1_MIGRATION_VERSION],
        );

        const bucketPresent = rowsOf(bucketResult).length === 1;
        const ledgerPresent = rowsOf(ledgerResult).length === 1;

        if (missingColumns.length === 0 && bucketPresent && ledgerPresent) {
          checks.push(
            pass(
              "f60_1_applied",
              "F60.1 aplicada",
              `tabela com ${requiredColumns.length} colunas de ARTIFACT_SELECT_COLUMNS, bucket ${COMPOSITION_BUCKET} e versão ${F60_1_MIGRATION_VERSION} no ledger (somente leitura)`,
            ),
          );
        } else {
          checks.push(
            fail(
              "f60_1_applied",
              "F60.1 aplicada",
              [
                missingColumns.length > 0 ? `colunas ausentes: ${missingColumns.join(",")}` : null,
                bucketPresent ? null : "bucket ausente",
                ledgerPresent ? null : `versão ${F60_1_MIGRATION_VERSION} ausente no ledger`,
              ]
                .filter((value): value is string => value !== null)
                .join("; "),
            ),
          );
        }
      } catch (error) {
        checks.push(
          fail(
            "f60_1_applied",
            "F60.1 aplicada",
            `leitura somente leitura falhou (${describeError(error)})`,
          ),
        );
      }
    }

    // -------------------------------------------------------------- item 6
    const admin = createAdminClient(env);
    let provider: string | null = null;
    let model: string | null = null;
    let protocol: string | null = null;
    let quality: string | null = null;
    let pricingVersion: string | null = null;
    let imageUnitUsd: number | null = null;
    let pricingMissing: readonly string[] = Object.freeze([]);
    let estimatedPreCallUsd: number | null = null;
    let estimateSource: string | null = null;
    let catalogPricingOk = false;

    if (admin === null) {
      checks.push(
        fail(
          "catalog_pricing",
          "Catálogo/pricing",
          "cliente admin indisponível (NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes)",
        ),
      );
    } else {
      try {
        const modelModule = (await import("../../src/lib/campaign/vertical-expansion/model")) as {
          resolveExpansionTarget: (deps: { client?: SupabaseClient }) => Promise<
            | {
                ok: true;
                provider: string;
                model: string;
                protocol: string;
                quality: string;
              }
            | { ok: false; reason: string; detail?: string }
          >;
          resolveExpansionPricing: (
            target: { provider: string; model: string; quality: string },
            deps: { client?: SupabaseClient },
          ) => Promise<
            | {
                ok: true;
                pricing: { imageUnitCostUsd?: unknown };
                versionId: string;
                imageUnitUsd: number;
              }
            | { ok: false; reason: string; missing: readonly string[] }
          >;
        };

        const target = await modelModule.resolveExpansionTarget({ client: admin.client });
        if (!target.ok) {
          checks.push(
            fail(
              "catalog_pricing",
              "Catálogo/pricing",
              `catálogo: ${target.reason}${target.detail === undefined ? "" : ` (${target.detail})`}`,
            ),
          );
        } else {
          provider = target.provider;
          model = target.model;
          protocol = target.protocol;
          quality = target.quality;

          const pricing = await modelModule.resolveExpansionPricing(
            { provider: target.provider, model: target.model, quality: target.quality },
            { client: admin.client },
          );

          if (!pricing.ok) {
            pricingMissing = pricing.missing;
            checks.push(
              fail(
                "catalog_pricing",
                "Catálogo/pricing",
                `pricing ${pricing.reason}: ${pricing.missing.join(",")}`,
              ),
            );
          } else {
            pricingVersion = pricing.versionId;
            imageUnitUsd = pricing.imageUnitUsd;
            catalogPricingOk = true;
            checks.push(
              pass(
                "catalog_pricing",
                "Catálogo/pricing",
                `${target.provider}/${target.model}/${target.protocol} quality=${target.quality}; pricingVersion=${pricing.versionId}; imageUnitUsd=${pricing.imageUnitUsd.toFixed(6)}; cobertura completa`,
              ),
            );
          }
        }
      } catch (error) {
        checks.push(
          fail(
            "catalog_pricing",
            "Catálogo/pricing",
            `resolução falhou (${describeError(error)})`,
          ),
        );
      }
    }

    // -------------------------------------------------------------- item 7
    const storeId = isUuid(env.F60_3_STORE_ID) ? env.F60_3_STORE_ID : undefined;
    const campaignId = isUuid(env.F60_3_CAMPAIGN_ID) ? env.F60_3_CAMPAIGN_ID : undefined;
    const sourceOperationId = isUuid(env.F60_3_SOURCE_OPERATION_ID)
      ? env.F60_3_SOURCE_OPERATION_ID
      : undefined;

    let sourceStatus: SourceStatus = "unresolved";
    let sourceArtifactId: string | null = null;
    let sourceChecksumSha256: string | null = null;
    let sourceByteSize: number | null = null;

    if (admin === null || storeId === undefined || campaignId === undefined || sourceOperationId === undefined) {
      checks.push(
        fail(
          "source",
          "Fonte",
          "identidade da fonte ausente/inválida (F60_3_STORE_ID/F60_3_CAMPAIGN_ID/F60_3_SOURCE_OPERATION_ID ou cliente admin)",
        ),
      );
    } else {
      try {
        const retrieveModule = (await import(
          "../../src/lib/campaign/composition-artifacts/retrieve"
        )) as {
          retrieveCompositionArtifact: (
            input: {
              identity: {
                storeId: string;
                campaignId: string;
                operationId: string;
                role: "square_prepared";
              };
              authorization: { kind: "system" };
            },
            deps: { client?: SupabaseClient },
          ) => Promise<
            | { kind: "integral"; artifact: ArtifactRecord }
            | { kind: "absent" }
            | { kind: "invalid"; reason: string }
            | { kind: "metadata_conflict"; reason: string }
            | { kind: "indeterminate" }
          >;
        };

        const retrieved = await retrieveModule.retrieveCompositionArtifact(
          {
            identity: {
              storeId,
              campaignId,
              operationId: sourceOperationId,
              role: "square_prepared",
            },
            authorization: { kind: "system" },
          },
          { client: admin.client },
        );

        if (retrieved.kind === "integral") {
          const artifact = retrieved.artifact;
          if (
            artifact.role !== "square_prepared" ||
            artifact.format !== "1:1" ||
            artifact.width !== 1152 ||
            artifact.height !== 1152 ||
            artifact.mimeType !== "image/jpeg"
          ) {
            checks.push(
              fail(
                "source",
                "Fonte",
                `artefato fora da política (role=${artifact.role}, ${artifact.width}x${artifact.height}, ${artifact.mimeType})`,
              ),
            );
          } else {
            sourceStatus = "prepared";
            sourceArtifactId = artifact.id;
            sourceChecksumSha256 = artifact.checksumSha256;
            sourceByteSize = artifact.byteSize;
            checks.push(
              pass(
                "source",
                "Fonte",
                `square_prepared 1152x1152 JPEG íntegro (artifactId=${artifact.id}; byteSize=${artifact.byteSize}; checksum=${artifact.checksumSha256.slice(0, 12)}…)`,
              ),
            );
          }
        } else if (retrieved.kind === "absent") {
          sourceStatus = "original_only";
          checks.push(
            fail(
              "source",
              "Fonte",
              `sourceStatus: original_only — só existe a arte 1024; rode a preparação autorizada (--prepare-source com F60_3_PREPARE_AUTHORIZED=1) antes do preflight final`,
            ),
          );
        } else {
          const reason = "reason" in retrieved ? retrieved.reason : "indeterminate";
          checks.push(
            fail("source", "Fonte", `fonte ${retrieved.kind} (${reason}) — arte 1080x1080 nunca é fonte válida`),
          );
        }
      } catch (error) {
        checks.push(fail("source", "Fonte", `leitura falhou (${describeError(error)})`));
      }
    }

    // -------------------------------------------------------------- item 8
    let destinationStatus = "unset";
    const destinationOperationId = isUuid(env.F60_3_OPERATION_ID)
      ? env.F60_3_OPERATION_ID
      : undefined;
    if (admin === null || storeId === undefined || campaignId === undefined) {
      checks.push(
        fail(
          "destination",
          "Destino",
          "identidade de destino não avaliável (loja/campanha/cliente admin ausentes)",
        ),
      );
    } else if (destinationOperationId === undefined) {
      checks.push(
        fail(
          "destination",
          "Destino",
          "F60_3_OPERATION_ID ausente — destino não selecionado (o --apply exige a identidade de destino)",
        ),
      );
    } else {
      try {
        const repositoryModule = (await import(
          "../../src/lib/campaign/composition-artifacts/repository"
        )) as {
          getArtifactByIdentity: (
            identity: {
              storeId: string;
              campaignId: string;
              operationId: string;
              role: "vertical";
            },
            client?: SupabaseClient,
          ) => Promise<
            | { kind: "found"; record: ArtifactRecord }
            | { kind: "absent" }
            | { kind: "read_failed"; message: string }
          >;
        };
        const storageModule = (await import(
          "../../src/lib/campaign/composition-artifacts/storage"
        )) as {
          CompositionArtifactStorage: new (client?: SupabaseClient) => {
            readObjectInfo: (
              value: string,
            ) => Promise<{ kind: "found" } | { kind: "absent" } | { kind: "indeterminate" }>;
          };
        };
        const pathModule = (await import(
          "../../src/lib/campaign/composition-artifacts/artifact-path"
        )) as {
          compositionArtifactStoragePath: (identity: {
            storeId: string;
            campaignId: string;
            operationId: string;
            role: "vertical";
          }) => string;
        };

        const identity = {
          storeId,
          campaignId,
          operationId: destinationOperationId,
          role: "vertical" as const,
        };
        const row = await repositoryModule.getArtifactByIdentity(identity, admin.client);
        const storage = new storageModule.CompositionArtifactStorage(admin.client);
        const info = await storage.readObjectInfo(
          pathModule.compositionArtifactStoragePath(identity),
        );

        if (row.kind === "read_failed" || info.kind === "indeterminate") {
          checks.push(
            fail(
              "destination",
              "Destino",
              `leitura indeterminada (${row.kind === "read_failed" ? "row_read_failed" : "object_indeterminate"})`,
            ),
          );
        } else if (row.kind === "found") {
          destinationStatus = "existing_row";
          checks.push(
            fail(
              "destination",
              "Destino",
              `existing_artifact_conflict: linha vertical já existe (artifactId=${row.record.id})`,
            ),
          );
        } else if (info.kind === "found") {
          destinationStatus = "existing_object";
          checks.push(
            fail(
              "destination",
              "Destino",
              "existing_artifact_conflict: objeto vertical já existe sem linha",
            ),
          );
        } else {
          destinationStatus = "absent";
          checks.push(
            pass(
              "destination",
              "Destino",
              "linha e objeto do vertical comprovadamente ausentes (somente leitura)",
            ),
          );
        }
      } catch (error) {
        checks.push(fail("destination", "Destino", `leitura falhou (${describeError(error)})`));
      }
    }

    // -------------------------------------------------------------- item 9
    const campaignsBefore = await readCampaignSnapshot(pg, storeId, campaignId);
    if (campaignsBefore === null) {
      checks.push(
        fail(
          "campaigns_snapshot",
          "Snapshot de campaigns",
          "campanha alvo não encontrada (ou leitura indisponível) para o par loja↔campanha",
        ),
      );
    } else {
      checks.push(
        pass(
          "campaigns_snapshot",
          "Snapshot de campaigns",
          `campaignsBefore: status=${campaignsBefore.status ?? "null"}; storagePath presente=${campaignsBefore.storagePath === null ? "não" : "sim"}`,
        ),
      );
    }

    // ------------------------------------------------------------- item 10
    if (catalogPricingOk && imageUnitUsd !== null && model !== null && quality !== null) {
      const estimate = estimateVerticalCall({ model, quality, imageUnitUsd });
      if (estimate.available) {
        estimatedPreCallUsd = estimate.estimatedUsd;
        estimateSource = `imageUnitUsd x ${estimate.multiplier} (${estimate.pricingVersion})`;
      }
    }

    const maxCalls = trimmed(env[ENV.maxCalls]);
    const budget = readNumber(env[ENV.budget]);

    if (!catalogPricingOk || estimatedPreCallUsd === null) {
      checks.push(
        fail(
          "pre_call_cost",
          "Custo pré-chamada",
          "estimativa indisponível (pricing incompleto ou image_unit_usd ausente/≤ 0)",
        ),
      );
    } else if (!apply) {
      checks.push(
        pass(
          "pre_call_cost",
          "Custo pré-chamada",
          `estimatedPreCallUsd=${estimatedPreCallUsd.toFixed(6)} (pré-chamada; não é limite rígido do custo final); pricingVersion=${pricingVersion ?? "null"}`,
        ),
      );
    } else if (maxCalls !== "1") {
      checks.push(
        fail(
          "pre_call_cost",
          "Custo pré-chamada",
          `F60_3_MAX_CALLS deve ser exatamente 1 (recebido: ${maxCalls.length === 0 ? "ausente" : maxCalls})`,
        ),
      );
    } else if (budget === null || budget < estimatedPreCallUsd) {
      checks.push(
        fail(
          "pre_call_cost",
          "Custo pré-chamada",
          `F60_3_AUTHORIZED_BUDGET_USD (${budget === null ? "ausente" : budget.toFixed(6)}) < estimatedPreCallUsd (${estimatedPreCallUsd.toFixed(6)})`,
        ),
      );
    } else {
      checks.push(
        pass(
          "pre_call_cost",
          "Custo pré-chamada",
          `estimatedPreCallUsd=${estimatedPreCallUsd.toFixed(6)}; authorizedBudgetUsd=${budget.toFixed(6)} (>= estimativa); maxCalls=1; pricingVersion=${pricingVersion ?? "null"}`,
        ),
      );
    }

    const ready = checks.every((check) => check.status === "PASS");
    const checkedAt = now().toISOString();

    const summary: PreflightSummary = Object.freeze({
      sourceStatus,
      provider,
      model,
      protocol,
      quality,
      pricingVersion,
      imageUnitUsd,
      estimatedPreCallUsd,
      estimateSource,
      pricingMissing,
      sourceArtifactId,
      sourceChecksumSha256,
      sourceByteSize,
      destinationStatus,
      credential,
      campaignsBefore,
    });

    const environment: PreflightEnvironmentInfo = Object.freeze({
      targetKind: gateTargetKind,
      dbTarget:
        pgTarget === null
          ? null
          : `${pgTarget.hostname}:${pgTarget.port}/${pgTarget.pathname.replace(/^\//, "")}`,
      apiTarget: hostPort(nextUrl),
      originsConcordant,
      serviceRoleKey: serviceKey.length > 0 ? "present" : "absent",
      anonKey: anonKey.length > 0 ? "present" : "absent",
      credential,
    });

    let evidencePath: string | null = null;
    if (options.persist !== false) {
      evidencePath = path.join(evidenceDir, `preflight-${stamp(new Date(checkedAt))}.json`);
      writeJsonAtomic(evidencePath, {
        kind: "f60.3-preflight",
        mode,
        checkedAt,
        ready,
        providerCalls: 0,
        credential,
        declaration: DECLARATION_NO_PAID_CALL,
        checks,
        summary,
        environment,
      });
    }

    return Object.freeze({
      kind: "f60.3-preflight" as const,
      mode,
      checkedAt,
      ready,
      providerCalls: 0 as const,
      credential,
      declaration: DECLARATION_NO_PAID_CALL,
      checks: Object.freeze(checks),
      summary,
      environment,
      evidencePath,
    });
  } finally {
    if (pg !== null) {
      try {
        await pg.client.end();
      } catch {
        // encerramento best-effort de conexão somente leitura
      }
    }
  }
}

/* ------------------------------------------------------------------------- */
/* Manifestos                                                                 */
/* ------------------------------------------------------------------------- */

interface ProofManifestSummary {
  readonly operationId?: unknown;
  readonly status?: unknown;
}

function listProofManifestFiles(evidenceDir: string): readonly string[] {
  if (!existsSync(evidenceDir)) return Object.freeze([]);
  return Object.freeze(
    readdirSync(evidenceDir)
      .filter(
        (name) =>
          name.startsWith("proof-") &&
          !name.startsWith("proof-intent-") &&
          name !== "proof-latest.json" &&
          name.endsWith(".json"),
      )
      .sort(),
  );
}

function readManifestFile(filePath: string): ProofManifestSummary | null {
  try {
    const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (raw === null || typeof raw !== "object") return null;
    return raw as ProofManifestSummary;
  } catch {
    return null;
  }
}

/** Manifesto terminal já existente para a mesma identidade de operação. */
function findTerminalManifest(
  operationId: string,
  evidenceDir: string,
): string | null {
  for (const name of listProofManifestFiles(evidenceDir)) {
    const filePath = path.join(evidenceDir, name);
    const manifest = readManifestFile(filePath);
    if (manifest === null) continue;
    if (typeof manifest.operationId === "string" && manifest.operationId === operationId) {
      return filePath;
    }
  }
  return null;
}

/* ------------------------------------------------------------------------- */
/* runProof — a única chamada paga                                            */
/* ------------------------------------------------------------------------- */

export interface ApplyGateInput {
  readonly env: NodeJS.ProcessEnv;
  readonly args: ProofArgs;
}

interface ApplyGateResult {
  readonly refusal: string | null;
  readonly budget: number | null;
}

function evaluateApplyGate(input: ApplyGateInput): ApplyGateResult {
  const authorized = input.args.authorized;
  if (typeof authorized !== "string" || authorized.trim().length < 8) {
    return { refusal: "authorization_token_missing", budget: null };
  }
  if (trimmed(input.env[ENV.homologAuthorized]) !== "1") {
    return { refusal: "homolog_authorization_missing", budget: null };
  }
  if (trimmed(input.env[ENV.maxCalls]) !== "1") {
    return { refusal: "max_calls_not_one", budget: null };
  }
  const budget = readNumber(input.env[ENV.budget]);
  if (budget === null || budget <= 0) {
    return { refusal: "authorized_budget_missing", budget: null };
  }

  const identityChecks: readonly (readonly [string, string | undefined])[] = [
    ["operation_id_invalid", input.env[ENV.operationId]],
    ["store_id_invalid", input.env[ENV.storeId]],
    ["campaign_id_invalid", input.env[ENV.campaignId]],
    ["source_operation_id_invalid", input.env[ENV.sourceOperationId]],
  ];
  for (const [reason, value] of identityChecks) {
    if (!isUuid(value)) return { refusal: reason, budget };
  }

  const attemptRef = trimmed(input.env[ENV.attemptRef]);
  if (attemptRef.length === 0 || attemptRef.length > 200) {
    return { refusal: "attempt_ref_invalid", budget };
  }

  return { refusal: null, budget };
}

function terminalStatusFor(result: ExpandVerticalResult | null, thrown: unknown): ProofTerminalStatus {
  if (thrown !== null || result === null) return "unknown";
  switch (result.kind) {
    case "expanded":
    case "reused":
      return "completed";
    case "unknown_result":
      return "unknown";
    default:
      return "failed";
  }
}

interface CallEvidenceShape {
  readonly callId?: unknown;
  readonly returnedSize?: unknown;
  readonly durationMs?: unknown;
  readonly usage?: unknown;
  readonly errorType?: unknown;
  readonly cost?: { readonly estimatedCostUsd?: unknown; readonly costSource?: unknown };
  readonly requestedSize?: unknown;
  readonly model?: unknown;
  readonly quality?: unknown;
  readonly provider?: unknown;
}

function callEvidenceOf(result: ExpandVerticalResult | null): {
  readonly call: CallEvidenceShape | null;
} {
  if (result === null) return { call: null };
  const withCall = result as { call?: unknown };
  if (withCall.call === undefined || withCall.call === null) return { call: null };
  if (typeof withCall.call !== "object") return { call: null };
  return { call: withCall.call as CallEvidenceShape };
}

function artifactSummaryOf(result: ExpandVerticalResult | null): Record<string, unknown> | null {
  if (result === null) return null;
  if (result.kind !== "expanded" && result.kind !== "reused") return null;
  const artifact: ArtifactRecord = result.artifact;
  return {
    id: artifact.id,
    role: artifact.role,
    format: artifact.format,
    origin: artifact.origin,
    width: artifact.width,
    height: artifact.height,
    mimeType: artifact.mimeType,
    byteSize: artifact.byteSize,
    checksumSha256: artifact.checksumSha256,
    derivedFromArtifactId: artifact.derivedFromArtifactId,
    sourceCampaignId: artifact.sourceCampaignId,
    storagePath: artifact.storagePath,
    storageBucket: artifact.storageBucket,
  };
}

function sameCampaigns(
  before: CampaignSnapshot | null,
  after: CampaignSnapshot | null,
): boolean | null {
  if (before === null || after === null) return null;
  return (
    before.id === after.id &&
    before.status === after.status &&
    before.storagePath === after.storagePath
  );
}

/**
 * Executa a prova: preflight → recusa se já existe intento/prova → intento
 * exclusivo `sending` → UMA chamada → manifesto terminal → intento terminal →
 * `proof-latest.json`. Sem retry em nenhum desfecho.
 */
export async function runProof(
  env: NodeJS.ProcessEnv = process.env,
  args: ProofArgs = {},
  deps: HarnessDeps = {},
): Promise<ProofOutcome> {
  const now = deps.now ?? (() => new Date());
  const evidenceDir = deps.evidenceDir ?? EVIDENCE_DIR;
  const preflight = deps.preflight ?? runPreflight;

  const refuse = (reason: string): ProofOutcome =>
    Object.freeze({
      mode: "apply" as const,
      ok: false,
      exitCode: 2,
      status: "refused" as const,
      providerCalls: 0 as const,
      reason,
      declaration: DECLARATION_NO_PAID_CALL,
    });

  const gate = evaluateApplyGate({ env, args });
  if (gate.refusal !== null) return refuse(gate.refusal);

  const operationId = trimmed(env[ENV.operationId]);
  const storeId = trimmed(env[ENV.storeId]);
  const campaignId = trimmed(env[ENV.campaignId]);
  const sourceOperationId = trimmed(env[ENV.sourceOperationId]);
  const attemptRef = trimmed(env[ENV.attemptRef]);
  const budget = gate.budget ?? 0;

  // (1) Preflight inteiro recalculado antes de qualquer escrita.
  const preflightResult = await preflight(env, { apply: true, mode: "apply" });
  if (!preflightResult.ready) return refuse("preflight_not_ready");

  const estimatedPreCallUsd = preflightResult.summary.estimatedPreCallUsd;
  if (estimatedPreCallUsd === null) return refuse("estimate_unavailable");
  if (budget < estimatedPreCallUsd) return refuse("authorized_budget_below_estimate");
  if (trimmed(env[ENV.maxCalls]) !== "1") return refuse("max_calls_not_one");

  // (2) Guarda de execução única: intento (qualquer status) ou prova terminal.
  const existingIntent: ProofIntentRecord | ProofIntentTerminalRecord | null = readIntent(
    operationId,
    evidenceDir,
  );
  if (existingIntent !== null) {
    return refuse(
      existingIntent.status === INTENT_STATUS.sending ? "intent_pending" : "intent_terminal_exists",
    );
  }
  if (findTerminalManifest(operationId, evidenceDir) !== null) {
    return refuse("terminal_manifest_exists");
  }

  // (3) Intento durável ANTES do envio, com criação exclusiva.
  let intentPath: string;
  try {
    const created = createIntentExclusive(
      {
        storeId,
        campaignId,
        operationId,
        sourceOperationId,
        attemptRef,
        sourceArtifactId: preflightResult.summary.sourceArtifactId ?? "",
        sourceChecksumSha256: preflightResult.summary.sourceChecksumSha256 ?? "",
        estimatedPreCallUsd,
        authorizedBudgetUsd: budget,
        pricingVersion: preflightResult.summary.pricingVersion ?? "",
        command: "node --import ./scripts/f60.3/server-only-resolve.mjs --import tsx scripts/f60.3/vertical-expansion-proof.ts --apply --authorized=<token> --print-json",
        envIdentifiers: INTENT_ENV_IDENTIFIERS,
      },
      evidenceDir,
    );
    intentPath = created.path;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return refuse(code === "EEXIST" ? "intent_exists" : "intent_create_failed");
  }

  // (4) UMA chamada, sem laço e sem segunda tentativa.
  const input: ExpandVerticalInput = {
    source: { storeId, campaignId, operationId: sourceOperationId, role: "square_prepared" },
    operationId,
    attempt: { number: 1, reference: attemptRef },
    authorization: { kind: "system" },
  };

  const expand: ExpandFn =
    deps.expand ??
    (async (value) => {
      const expandModule = (await import("../../src/lib/campaign/vertical-expansion/expand")) as {
        expandVerticalToNineSixteen: (input: ExpandVerticalInput) => Promise<ExpandVerticalResult>;
      };
      return expandModule.expandVerticalToNineSixteen(value);
    });

  let result: ExpandVerticalResult | null = null;
  let thrown: unknown = null;
  try {
    result = await expand(input);
  } catch (error) {
    thrown = error;
  }

  const status = terminalStatusFor(result, thrown);
  const { call } = callEvidenceOf(result);
  // Uma exceção após a invocação é tratada como possível envio: conta 1 chamada
  // (desfecho desconhecido) e nunca autoriza repetição.
  const providerCalls: 0 | 1 = call !== null || thrown !== null ? 1 : 0;
  const observedCostUsd =
    typeof call?.cost?.estimatedCostUsd === "number" ? call.cost.estimatedCostUsd : null;
  const costSource =
    typeof call?.cost?.costSource === "string" ? call.cost.costSource : "not_available";

  // (5) Snapshot posterior de `campaigns` (somente leitura).
  const pgAfter = await openPgClient(env);
  const campaignsAfter = await readCampaignSnapshot(pgAfter, storeId, campaignId);
  if (pgAfter !== null) {
    try {
      await pgAfter.client.end();
    } catch {
      // encerramento best-effort
    }
  }
  const campaignsUnchanged = sameCampaigns(
    preflightResult.summary.campaignsBefore,
    campaignsAfter,
  );

  // (6) Manifesto terminal ANTES de atualizar o intento.
  const createdAt = now().toISOString();
  const manifestPath = path.join(evidenceDir, `proof-${stamp(new Date(createdAt))}.json`);
  const manifest = {
    kind: "f60.3-vertical-expansion-proof",
    mode: "apply",
    status,
    operationId,
    storeId,
    campaignId,
    sourceOperationId,
    attemptRef,
    callId: typeof call?.callId === "string" ? call.callId : null,
    outcomeKind: result?.kind ?? "exception",
    errorType:
      typeof call?.errorType === "string"
        ? call.errorType
        : thrown === null
          ? null
          : describeError(thrown),
    provider: typeof call?.provider === "string" ? call.provider : null,
    model: typeof call?.model === "string" ? call.model : null,
    quality: typeof call?.quality === "string" ? call.quality : null,
    requestedSize: typeof call?.requestedSize === "string" ? call.requestedSize : REQUESTED_SIZE,
    returnedSize: typeof call?.returnedSize === "string" ? call.returnedSize : null,
    durationMs: typeof call?.durationMs === "number" ? call.durationMs : null,
    usage: call?.usage ?? null,
    cost: { observedCostUsd, costSource },
    observedCostUsd,
    costSource,
    estimatedPreCallUsd,
    authorizedBudgetUsd: budget,
    maxCalls: 1,
    pricingVersion: preflightResult.summary.pricingVersion,
    providerCalls,
    artifact: artifactSummaryOf(result),
    campaignsBefore: preflightResult.summary.campaignsBefore,
    campaignsAfter,
    campaignsUnchanged,
    intentPath,
    createdAt,
  };
  writeJsonAtomic(manifestPath, manifest);

  // (7) Só depois do manifesto terminal, o intento vira terminal.
  markIntentTerminal(
    operationId,
    { status, terminalManifest: manifestPath, observedCostUsd },
    evidenceDir,
  );

  // (8) `proof-latest.json` só existe/aponta para status terminal.
  const latestPath = path.join(evidenceDir, "proof-latest.json");
  writeFileSync(latestPath, readFileSync(manifestPath, "utf8"), "utf8");

  return Object.freeze({
    mode: "apply" as const,
    ok: status === "completed",
    exitCode: status === "completed" ? 0 : 1,
    status,
    providerCalls,
    operationId,
    intentPath,
    manifestPath,
    latestPath,
    callId: typeof call?.callId === "string" ? call.callId : null,
    resultKind: result?.kind ?? "exception",
    observedCostUsd,
    costSource,
    estimatedPreCallUsd,
    authorizedBudgetUsd: budget,
    campaignsUnchanged,
    declaration:
      status === "completed"
        ? `status terminal gravado; providerCalls=${providerCalls}`
        : `status terminal ${status} gravado sem retry; providerCalls=${providerCalls}`,
  });
}

/* ------------------------------------------------------------------------- */
/* runPrepareSource — Task 2 (escrita determinística via F60.1)                */
/* ------------------------------------------------------------------------- */

/** Path canônico da arte de campanha: dentro da loja/campanha e sem segmentos perigosos. */
function isSafeSourceObjectPath(
  objectPath: string,
  storeId: string,
  campaignId: string,
): boolean {
  return (
    objectPath.length > 0 &&
    !objectPath.startsWith("/") &&
    !objectPath.startsWith("\\") &&
    !objectPath.includes("\\") &&
    !objectPath.includes("..") &&
    !objectPath.includes("://") &&
    objectPath.startsWith(`${storeId}/${campaignId}/`) &&
    /\.jpe?g$/i.test(objectPath)
  );
}

/**
 * Prepara a fonte 1024→1152 de forma DETERMINÍSTICA (sem IA, sem provider) sob
 * `F60_3_PREPARE_AUTHORIZED=1`. Se a arte real ainda não existir como
 * `square_original`, registra os bytes canônicos de `campaigns.storage_path`
 * (bucket `campaign-images`, somente leitura) pela F60.1 antes de preparar.
 * Se a fonte prepared já existir, não reescreve.
 */
export async function runPrepareSource(
  env: NodeJS.ProcessEnv = process.env,
  args: ProofArgs = {},
  deps: HarnessDeps = {},
): Promise<PrepareSourceOutcome> {
  const now = deps.now ?? (() => new Date());
  const evidenceDir = deps.evidenceDir ?? EVIDENCE_DIR;
  const preflight =
    deps.preflight ??
    ((currentEnv, currentOptions) => runPreflight(currentEnv, currentOptions));

  const refuse = (reason: string): PrepareSourceOutcome =>
    Object.freeze({
      mode: "prepare-source" as const,
      ok: false,
      exitCode: 2,
      result: "refused" as const,
      providerCalls: 0 as const,
      reason,
      declaration: "nenhuma escrita executada",
    });

  const authorized = args.authorized;
  if (trimmed(env[ENV.prepareAuthorized]) !== "1") return refuse("prepare_not_authorized");
  if (typeof authorized !== "string" || authorized.trim().length < 8) {
    return refuse("authorization_token_missing");
  }
  if (!isUuid(env[ENV.storeId])) return refuse("store_id_invalid");
  if (!isUuid(env[ENV.campaignId])) return refuse("campaign_id_invalid");
  if (!isUuid(env[ENV.sourceOperationId])) return refuse("source_operation_id_invalid");
  if (!isUuid(env[ENV.preparedOperationId])) return refuse("prepared_operation_id_invalid");

  const storeId = trimmed(env[ENV.storeId]);
  const campaignId = trimmed(env[ENV.campaignId]);
  const sourceOperationId = trimmed(env[ENV.sourceOperationId]);
  const preparedOperationId = trimmed(env[ENV.preparedOperationId]);

  // (1) Itens 1–6 e 9 do preflight (somente leitura), sem exigir a fonte pronta.
  const preflightResult = await preflight(env, { apply: false, mode: "prepare-source" });
  const requiredIds = [
    "module_import",
    "f60_1_target",
    "supabase_env",
    "credentials",
    "f60_1_applied",
    "catalog_pricing",
    "campaigns_snapshot",
  ];
  for (const id of requiredIds) {
    const check = preflightResult.checks.find((candidate) => candidate.id === id);
    if (check === undefined || check.status !== "PASS") {
      return refuse(`preflight_${id}_failed`);
    }
  }

  const admin = createAdminClient(env);
  if (admin === null) return refuse("admin_client_unavailable");

  // (2) Arte real de campanha: só leitura em `campaign-images`, depois o
  // registro `square_original` pela F60.1 quando ele ainda não existir.
  const sourceStoragePath =
    preflightResult.summary.campaignsBefore?.storagePath ?? null;
  if (
    sourceStoragePath === null ||
    !isSafeSourceObjectPath(sourceStoragePath, storeId, campaignId)
  ) {
    return refuse("source_storage_path_invalid");
  }

  const retrieve: RetrieveSourceArtifactFn =
    deps.retrieve ??
    (async (input, retrieveDeps) => {
      const retrieveModule = (await import(
        "../../src/lib/campaign/composition-artifacts/retrieve"
      )) as { retrieveCompositionArtifact: RetrieveSourceArtifactFn };
      return retrieveModule.retrieveCompositionArtifact(input, retrieveDeps);
    });

  const downloadSource: DownloadSourceObjectFn =
    deps.downloadSourceObject ??
    (async (bucket, objectPath) => {
      const { data, error } = await admin.client.storage
        .from(bucket)
        .download(objectPath);
      if (error || !data) {
        throw new Error(error?.message ?? "source_download_failed");
      }
      return Buffer.from(await data.arrayBuffer());
    });

  const verifySource: VerifySourceBytesFn =
    deps.verifySourceBytes ??
    (async (bytes, role) => {
      const integrityModule = (await import(
        "../../src/lib/campaign/composition-artifacts/integrity"
      )) as { verifyCompositionArtifactBytes: VerifySourceBytesFn };
      return integrityModule.verifyCompositionArtifactBytes(bytes, role);
    });

  const persistSource: PersistSourceArtifactFn =
    deps.persistSource ??
    (async (input, persistDeps) => {
      const persistModule = (await import(
        "../../src/lib/campaign/composition-artifacts/persist"
      )) as { persistCompositionArtifact: PersistSourceArtifactFn };
      return persistModule.persistCompositionArtifact(input, persistDeps);
    });

  let sourceBytes: Buffer;
  try {
    sourceBytes = await downloadSource(SOURCE_BUCKET, sourceStoragePath);
  } catch (error) {
    return refuse(`source_download_failed:${describeError(error)}`);
  }

  const sourceVerification = await verifySource(sourceBytes, "square_original");
  if (!sourceVerification.ok) {
    return refuse(`source_verify_failed:${sourceVerification.reason}`);
  }
  if (
    sourceVerification.width !== 1024 ||
    sourceVerification.height !== 1024 ||
    sourceVerification.mimeType !== "image/jpeg"
  ) {
    return refuse("source_policy_mismatch");
  }

  const sourceIdentity = {
    storeId,
    campaignId,
    operationId: sourceOperationId,
    role: "square_original" as const,
  };
  const sourceProbe = await retrieve(
    { identity: sourceIdentity, authorization: { kind: "system" } },
    { client: admin.client },
  );

  let registrationResult: "created" | "reused" | "existing";
  let registrationArtifactId: string | null;
  let registrationChecksumSha256: string | null;

  if (sourceProbe.kind === "integral") {
    if (
      sourceProbe.artifact.checksumSha256.toLowerCase() !==
      sourceVerification.checksumSha256.toLowerCase()
    ) {
      return refuse("source_checksum_mismatch");
    }
    registrationResult = "existing";
    registrationArtifactId = sourceProbe.artifact.id;
    registrationChecksumSha256 = sourceProbe.artifact.checksumSha256;
  } else if (sourceProbe.kind === "absent") {
    const persisted = await persistSource(
      {
        identity: sourceIdentity,
        authorization: { kind: "system" },
        bytes: sourceBytes,
        origin: "provider_generation",
        source: { kind: "none" },
      },
      { client: admin.client },
    );
    if (persisted.kind !== "created" && persisted.kind !== "reused") {
      return refuse(`source_registration_${persisted.kind}:${persisted.reason}`);
    }
    registrationResult = persisted.kind;
    const readback = await retrieve(
      { identity: sourceIdentity, authorization: { kind: "system" } },
      { client: admin.client },
    );
    if (readback.kind !== "integral") {
      return refuse(`source_registration_readback_${readback.kind}`);
    }
    if (
      readback.artifact.checksumSha256.toLowerCase() !==
      sourceVerification.checksumSha256.toLowerCase()
    ) {
      return refuse("source_registration_checksum_mismatch");
    }
    registrationArtifactId = readback.artifact.id;
    registrationChecksumSha256 = readback.artifact.checksumSha256;
  } else {
    const detail =
      "reason" in sourceProbe ? sourceProbe.reason : sourceProbe.kind;
    return refuse(`source_probe_${sourceProbe.kind}:${detail}`);
  }

  const registrationEvidence = {
    result: registrationResult,
    artifactId: registrationArtifactId,
    checksumSha256: registrationChecksumSha256,
    width: sourceVerification.width,
    height: sourceVerification.height,
    mimeType: sourceVerification.mimeType,
    byteSize: sourceVerification.byteSize,
    sourceBucket: SOURCE_BUCKET,
    sourceObjectPath: sourceStoragePath,
  };

  // (3) Se a fonte prepared já existir, não reescreve.
  try {
    const preparedProbe = await retrieve(
      {
        identity: {
          storeId,
          campaignId,
          operationId: preparedOperationId,
          role: "square_prepared",
        },
        authorization: { kind: "system" },
      },
      { client: admin.client },
    );

    if (preparedProbe.kind === "integral") {
      const artifact = preparedProbe.artifact;
      const evidencePath = path.join(
        evidenceDir,
        `source-preparation-${stamp(now())}.json`,
      );
      writeJsonAtomic(evidencePath, {
        kind: "f60.3-source-preparation",
        result: "existing",
        providerCalls: 0,
        preparedOperationId,
        sourceOperationId,
        artifactId: artifact.id,
        width: artifact.width,
        height: artifact.height,
        mimeType: artifact.mimeType,
        byteSize: artifact.byteSize,
        checksumSha256: artifact.checksumSha256,
        origin: artifact.origin,
        registration: registrationEvidence,
        declaration: "fonte já preparada; nenhuma escrita e nenhuma IA",
      });
      return Object.freeze({
        mode: "prepare-source" as const,
        ok: true,
        exitCode: 0,
        result: "existing" as const,
        providerCalls: 0 as const,
        preparedOperationId,
        sourceOperationId,
        artifactId: artifact.id,
        width: artifact.width,
        height: artifact.height,
        mimeType: artifact.mimeType,
        byteSize: artifact.byteSize,
        checksumSha256: artifact.checksumSha256,
        origin: artifact.origin,
        evidencePath,
        registrationResult,
        registrationArtifactId,
        registrationChecksumSha256,
        sourceBucket: SOURCE_BUCKET,
        sourceObjectPath: sourceStoragePath,
        declaration: "fonte já preparada; nenhuma escrita e nenhuma IA",
      });
    }
  } catch (error) {
    return refuse(`prepared_probe_failed:${describeError(error)}`);
  }

  // (3) preparação ÚNICA, determinística, sem IA.
  const prepareSource: PrepareSourceFn =
    deps.prepareSource ??
    (async (input) => {
      const prepareModule = (await import(
        "../../src/lib/campaign/square-preparation/prepare"
      )) as { prepareSquareForExpansion: PrepareSourceFn };
      return prepareModule.prepareSquareForExpansion(input);
    });

  let prepared: PrepareSourceResultLike | null = null;
  let thrown: unknown = null;
  try {
    prepared = await prepareSource({
      source: {
        storeId,
        campaignId,
        operationId: sourceOperationId,
        role: "square_original",
      },
      preparedOperationId,
      authorization: { kind: "system" },
    });
  } catch (error) {
    thrown = error;
  }

  const evidencePath = path.join(
    evidenceDir,
    `source-preparation-${stamp(now())}.json`,
  );

  if (thrown !== null || prepared === null || prepared.kind !== "prepared") {
    const reason =
      thrown !== null
        ? `exception:${describeError(thrown)}`
        : `${prepared?.kind ?? "unknown"}:${prepared?.reason ?? "unknown"}`;
    writeJsonAtomic(evidencePath, {
      kind: "f60.3-source-preparation",
      result: "failed",
      providerCalls: 0,
      preparedOperationId,
      sourceOperationId,
      reason,
      registration: registrationEvidence,
      declaration: "preparação falhou; nenhuma IA e nenhuma chamada paga",
    });
    return Object.freeze({
      mode: "prepare-source" as const,
      ok: false,
      exitCode: 1,
      result: "failed" as const,
      providerCalls: 0 as const,
      reason,
      preparedOperationId,
      sourceOperationId,
      evidencePath,
      registrationResult,
      registrationArtifactId,
      registrationChecksumSha256,
      sourceBucket: SOURCE_BUCKET,
      sourceObjectPath: sourceStoragePath,
      declaration: "preparação falhou; nenhuma IA e nenhuma chamada paga",
    });
  }

  const artifact = prepared.artifact ?? null;
  const resultKind: "prepared" | "reused" =
    prepared.persistence === "reused" ? "reused" : "prepared";

  writeJsonAtomic(evidencePath, {
    kind: "f60.3-source-preparation",
    result: resultKind,
    providerCalls: 0,
    preparedOperationId,
    sourceOperationId,
    artifactId: artifact?.id ?? null,
    width: artifact?.width ?? null,
    height: artifact?.height ?? null,
    mimeType: artifact?.mimeType ?? null,
    byteSize: artifact?.byteSize ?? null,
    checksumSha256: artifact?.checksumSha256 ?? null,
    origin: artifact?.origin ?? null,
    registration: registrationEvidence,
    declaration: "preparação determinística via F60.1; sem IA e sem chamada paga",
  });

  return Object.freeze({
    mode: "prepare-source" as const,
    ok: true,
    exitCode: 0,
    result: resultKind,
    providerCalls: 0 as const,
    preparedOperationId,
    sourceOperationId,
    artifactId: artifact?.id ?? null,
    width: artifact?.width ?? null,
    height: artifact?.height ?? null,
    mimeType: artifact?.mimeType ?? null,
    byteSize: artifact?.byteSize ?? null,
    checksumSha256: artifact?.checksumSha256 ?? null,
    origin: artifact?.origin ?? null,
    evidencePath,
    registrationResult,
    registrationArtifactId,
    registrationChecksumSha256,
    sourceBucket: SOURCE_BUCKET,
    sourceObjectPath: sourceStoragePath,
    declaration: "preparação determinística via F60.1; sem IA e sem chamada paga",
  });
}

/* ------------------------------------------------------------------------- */
/* runCheckManifest — verificador não pago                                    */
/* ------------------------------------------------------------------------- */

/** Valida o manifesto terminal; nunca constrói provider nem chama o módulo. */
export async function runCheckManifest(
  manifestPath: string,
  env: NodeJS.ProcessEnv = process.env,
  deps: HarnessDeps = {},
): Promise<CheckManifestOutcome> {
  const evidenceDir = deps.evidenceDir ?? EVIDENCE_DIR;
  const resolvedPath = path.resolve(manifestPath);
  const checks: CheckManifestCheck[] = [];

  const operationId = trimmed(env[ENV.operationId]);
  if (isUuid(operationId)) {
    const intent = readIntent(operationId, evidenceDir);
    if (intent !== null && intent.status === INTENT_STATUS.sending) {
      return Object.freeze({
        mode: "check-manifest" as const,
        ok: false,
        exitCode: 1,
        status: "pending" as const,
        manifestPath: resolvedPath,
        checks: Object.freeze([
          Object.freeze({
            id: "intent_terminal",
            status: "FAIL" as const,
            detail: `intento ${path.basename(proofIntentPath(operationId, evidenceDir))} permanece "sending" (pendente/desconhecido); nenhuma reconciliação por nova chamada`,
          }),
        ]),
        declaration: "prova pendente/desconhecida; nenhuma chamada paga foi feita",
      });
    }
  }

  if (!existsSync(resolvedPath)) {
    return Object.freeze({
      mode: "check-manifest" as const,
      ok: false,
      exitCode: 1,
      status: "missing" as const,
      manifestPath: resolvedPath,
      checks: Object.freeze([
        Object.freeze({ id: "manifest_exists", status: "FAIL" as const, detail: "manifesto ausente" }),
      ]),
      declaration: DECLARATION_NO_PAID_CALL,
    });
  }

  const raw = readManifestFile(resolvedPath);
  if (raw === null) {
    return Object.freeze({
      mode: "check-manifest" as const,
      ok: false,
      exitCode: 1,
      status: "invalid" as const,
      manifestPath: resolvedPath,
      checks: Object.freeze([
        Object.freeze({
          id: "manifest_parse",
          status: "FAIL" as const,
          detail: "manifesto ilegível/malformado",
        }),
      ]),
      declaration: DECLARATION_NO_PAID_CALL,
    });
  }

  const manifest = raw as Record<string, unknown>;
  const artifact =
    manifest.artifact !== null && typeof manifest.artifact === "object"
      ? (manifest.artifact as Record<string, unknown>)
      : null;
  const cost = manifest.cost !== null && typeof manifest.cost === "object"
    ? (manifest.cost as Record<string, unknown>)
    : null;

  const add = (id: string, ok: boolean, detail: string): void => {
    checks.push(
      Object.freeze({ id, status: ok ? ("PASS" as const) : ("FAIL" as const), detail }),
    );
  };

  add(
    "provider_calls",
    manifest.providerCalls === 1,
    `providerCalls=${String(manifest.providerCalls ?? "null")} (exigido 1)`,
  );
  add(
    "max_calls",
    manifest.maxCalls === 1,
    `maxCalls=${String(manifest.maxCalls ?? "null")} (exigido 1)`,
  );
  add(
    "returned_size",
    manifest.returnedSize === REQUESTED_SIZE,
    `returnedSize=${String(manifest.returnedSize ?? "null")} (exigido ${REQUESTED_SIZE})`,
  );
  add(
    "artifact_role",
    artifact?.role === "vertical" && artifact?.format === "9:16",
    `role=${String(artifact?.role ?? "null")}; format=${String(artifact?.format ?? "null")}`,
  );
  add(
    "artifact_origin",
    artifact?.origin === "ai_expansion",
    `origin=${String(artifact?.origin ?? "null")} (exigido ai_expansion)`,
  );
  add(
    "artifact_dimensions",
    artifact?.width === 1080 && artifact?.height === 1920 && artifact?.mimeType === "image/jpeg",
    `${String(artifact?.width ?? "null")}x${String(artifact?.height ?? "null")} ${String(artifact?.mimeType ?? "null")}`,
  );
  add(
    "derived_from",
    typeof artifact?.derivedFromArtifactId === "string" && artifact.derivedFromArtifactId.length > 0,
    `derivedFromArtifactId=${String(artifact?.derivedFromArtifactId ?? "null")}`,
  );
  add(
    "cost_source",
    typeof cost?.costSource === "string" &&
      cost.costSource !== "not_available" &&
      typeof manifest.observedCostUsd === "number",
    `costSource=${String(cost?.costSource ?? "null")}; observedCostUsd=${String(manifest.observedCostUsd ?? "null")}`,
  );

  const observedCostUsd = manifest.observedCostUsd;
  const authorizedBudgetUsd = manifest.authorizedBudgetUsd;
  add(
    "budget_post_check",
    typeof observedCostUsd === "number" &&
      typeof authorizedBudgetUsd === "number" &&
      observedCostUsd <= authorizedBudgetUsd,
    `observedCostUsd=${String(observedCostUsd ?? "null")} <= authorizedBudgetUsd=${String(authorizedBudgetUsd ?? "null")}`,
  );

  const failures = checks.filter((check) => check.status === "FAIL").length;
  const status =
    typeof manifest.status === "string" &&
    (manifest.status === "completed" ||
      manifest.status === "failed" ||
      manifest.status === "unknown")
      ? (manifest.status as "completed" | "failed" | "unknown")
      : ("invalid" as const);

  return Object.freeze({
    mode: "check-manifest" as const,
    ok: failures === 0 && status === "completed",
    exitCode: failures === 0 && status === "completed" ? 0 : 1,
    status,
    manifestPath: resolvedPath,
    checks: Object.freeze(checks),
    declaration: failures === 0 ? "manifesto validado (sem nova chamada)" : "manifesto reprovado",
  });
}

/* ------------------------------------------------------------------------- */
/* Renderização do preflight em Markdown                                      */
/* ------------------------------------------------------------------------- */

function renderPreflightSection(result: PreflightResult, section: string): string {
  const lines: string[] = [];
  lines.push(`## ${section}`);
  lines.push("");
  lines.push(`- **Executado em:** ${result.checkedAt}`);
  lines.push(`- **Modo:** \`${result.mode}\``);
  lines.push(`- **Ready:** \`${result.ready}\``);
  lines.push(`- **providerCalls:** \`0\``);
  lines.push(
    `- **Ambiente:** target=\`${result.environment.targetKind ?? "null"}\`; DB=\`${result.environment.dbTarget ?? "null"}\`; API=\`${result.environment.apiTarget ?? "null"}\`; origens concordantes=\`${result.environment.originsConcordant}\``,
  );
  lines.push(
    `- **Credencial:** \`${result.environment.credential}\`; serviceRoleKey=\`${result.environment.serviceRoleKey}\`; anonKey=\`${result.environment.anonKey}\``,
  );
  lines.push(
    `- **Catálogo/pricing:** provider=\`${result.summary.provider ?? "null"}\`; model=\`${result.summary.model ?? "null"}\`; protocol=\`${result.summary.protocol ?? "null"}\`; quality=\`${result.summary.quality ?? "null"}\`; pricingVersion=\`${result.summary.pricingVersion ?? "null"}\`; imageUnitUsd=\`${result.summary.imageUnitUsd === null ? "null" : result.summary.imageUnitUsd.toFixed(6)}\``,
  );
  lines.push(
    `- **Fonte:** sourceStatus=\`${result.summary.sourceStatus}\`; artifactId=\`${result.summary.sourceArtifactId ?? "null"}\`; byteSize=\`${result.summary.sourceByteSize ?? "null"}\`; checksum=\`${result.summary.sourceChecksumSha256 ?? "null"}\``,
  );
  lines.push(`- **Destino:** \`${result.summary.destinationStatus}\``);
  lines.push(
    `- **estimatedPreCallUsd:** \`${result.summary.estimatedPreCallUsd === null ? "null" : result.summary.estimatedPreCallUsd.toFixed(6)}\` (${result.summary.estimateSource ?? "indisponível"})`,
  );
  lines.push(
    `- **campaignsBefore:** \`${result.summary.campaignsBefore === null ? "null" : JSON.stringify(result.summary.campaignsBefore)}\``,
  );
  lines.push(`- **Evidência JSON:** \`${result.evidencePath ?? "não persistida"}\``);
  lines.push("");
  lines.push("| # | Verificação | Status | Detalhe |");
  lines.push("|---|---|---|---|");
  result.checks.forEach((check, index) => {
    lines.push(
      `| ${index + 1} | \`${check.id}\` | **${check.status}** | ${check.detail.replace(/\|/g, "\\|")} |`,
    );
  });
  lines.push("");
  lines.push(`**Declaração:** ${DECLARATION_NO_PAID_CALL} (\`providerCalls: 0\`).`);
  lines.push("");
  return lines.join("\n");
}

/** Escreve/atualiza uma seção idempotente de `60.3-04-PREFLIGHT.md`. */
export function writePreflightMarkdown(result: PreflightResult, section: string): string {
  const filePath = PREFLIGHT_MD;
  const start = `<!-- f60.3-preflight:start:${section} -->`;
  const end = `<!-- f60.3-preflight:end:${section} -->`;
  const block = `${start}\n${renderPreflightSection(result, section)}${end}\n`;

  mkdirSync(path.dirname(filePath), { recursive: true });
  let existing = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  if (existing.trim().length === 0) {
    existing =
      "# F60.3 / 60.3-04 — Preflight da prova paga\n\n" +
      "Documento gerado pelo harness `scripts/f60.3/vertical-expansion-proof.ts`.\n" +
      "Somente leitura: **sem chamada paga** em qualquer seção.\n\n";
  }

  const startIndex = existing.indexOf(start);
  const endIndex = existing.indexOf(end);
  let next: string;
  if (startIndex >= 0 && endIndex > startIndex) {
    const afterEnd = existing.indexOf("\n", endIndex);
    const tail = afterEnd < 0 ? "" : existing.slice(afterEnd + 1);
    next = `${existing.slice(0, startIndex)}${block}${tail}`;
  } else {
    next = `${existing.trimEnd()}\n\n${block}`;
  }
  writeFileSync(filePath, next, "utf8");
  return filePath;
}

/* ------------------------------------------------------------------------- */
/* CLI                                                                        */
/* ------------------------------------------------------------------------- */

function flagValue(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  const found = argv.find((value) => value.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function positionalAfter(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(`--${name}`);
  if (index < 0) return null;
  const next = argv[index + 1];
  if (next === undefined || next.startsWith("--")) return null;
  return next;
}

function printHumanPreflight(result: PreflightResult): void {
  console.log(`[f60.3] preflight (${result.mode}) ready=${result.ready} providerCalls=0`);
  for (const [index, check] of result.checks.entries()) {
    console.log(
      `  ${String(index + 1).padStart(2, "0")} ${check.status} ${check.id}: ${check.detail}`,
    );
  }
  console.log(`  sourceStatus=${result.summary.sourceStatus}`);
  console.log(
    `  estimatedPreCallUsd=${result.summary.estimatedPreCallUsd === null ? "null" : result.summary.estimatedPreCallUsd.toFixed(6)} pricingVersion=${result.summary.pricingVersion ?? "null"}`,
  );
  console.log(`  ${DECLARATION_NO_PAID_CALL}`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const printJson = hasFlag(argv, "print-json");
  const dryRun = hasFlag(argv, "dry-run");
  const apply = hasFlag(argv, "apply");
  const prepare = hasFlag(argv, "prepare-source");
  const checkManifestFlag =
    hasFlag(argv, "check-manifest") || flagValue(argv, "check-manifest") !== null;

  const modes = [dryRun, apply, prepare, checkManifestFlag].filter(Boolean).length;
  if (modes === 0) {
    console.error(
      "uso: vertical-expansion-proof.ts --dry-run | --prepare-source | --apply | --check-manifest <path>",
    );
    process.exitCode = 2;
    return;
  }
  if (modes > 1) {
    console.error("recusado: escolha exatamente UM modo (--dry-run/--apply/--prepare-source/--check-manifest)");
    process.exitCode = 2;
    return;
  }

  if (dryRun) {
    const result = await runPreflight(process.env, { apply: false, mode: "dry-run" });
    const section = flagValue(argv, "section") ?? "cobertura inicial";
    if (hasFlag(argv, "write-md")) writePreflightMarkdown(result, section);
    if (printJson) console.log(JSON.stringify(result, null, 2));
    else printHumanPreflight(result);
    process.exitCode = 0;
    return;
  }

  if (prepare) {
    const outcome = await runPrepareSource(process.env, {
      authorized: flagValue(argv, "authorized"),
    });
    if (printJson) console.log(JSON.stringify(outcome, null, 2));
    else console.log(`[f60.3] prepare-source result=${outcome.result} reason=${outcome.reason ?? "-"}`);
    process.exitCode = outcome.exitCode;
    return;
  }

  if (apply) {
    const outcome = await runProof(process.env, {
      authorized: flagValue(argv, "authorized"),
    });
    if (printJson) console.log(JSON.stringify(outcome, null, 2));
    else console.log(`[f60.3] apply status=${outcome.status} providerCalls=${outcome.providerCalls} reason=${outcome.reason ?? "-"}`);
    process.exitCode = outcome.exitCode;
    return;
  }

  const target =
    flagValue(argv, "check-manifest") ?? positionalAfter(argv, "check-manifest");
  if (target === null) {
    console.error("uso: --check-manifest <path>");
    process.exitCode = 2;
    return;
  }
  const outcome = await runCheckManifest(target, process.env);
  if (printJson) console.log(JSON.stringify(outcome, null, 2));
  else {
    console.log(`[f60.3] check-manifest status=${outcome.status}`);
    for (const check of outcome.checks) {
      console.log(`  ${check.status} ${check.id}: ${check.detail}`);
    }
  }
  process.exitCode = outcome.exitCode;
}

function isDirectInvocation(): boolean {
  const entry = process.argv[1];
  if (typeof entry !== "string" || entry.length === 0) return false;
  try {
    return pathToFileURL(path.resolve(entry)).href === import.meta.url;
  } catch {
    return false;
  }
}

if (isDirectInvocation()) {
  main().catch((error: unknown) => {
    console.error(`[f60.3] falha: ${describeError(error)}`);
    process.exitCode = 1;
  });
}
