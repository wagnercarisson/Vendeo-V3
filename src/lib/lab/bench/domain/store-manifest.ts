import "server-only";

import { promises as fsp } from "node:fs";
import path from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Manifesto/allowlist local das lojas de teste da **bancada de geração**
 * (F48.2.2, D4).
 *
 * Responsabilidades:
 *  - carregar `fixtures/lab/bench/stores.json` com confinamento de caminho
 *    anti-traversal (padrão `assertWithinRoot` de `src/lib/lab/scenarios/service.ts`);
 *  - cruzar o manifesto com a tabela `stores` do Supabase **local** em modo
 *    **somente leitura** (`.select(...)`), devolvendo apenas as lojas presentes
 *    **no manifesto E** materializadas localmente;
 *  - expor `assertBenchTestStore` para ser exigido em **todos** os pontos de
 *    entrada da bancada (branding GET, estimativa e execução POST) **antes** de
 *    qualquer leitura de branding, tabela de loja ou storage.
 *
 * Garantias:
 *  - nenhuma escrita em `stores` (somente `.select(...)`);
 *  - nenhuma sincronização/importação de lojas remotas — a leitura é local;
 *  - nenhum campo produtivo novo é criado para marcar lojas de teste.
 */

// ─── Constantes (D4) ─────────────────────────────────────────────────────────

/** Diretório versionado do manifesto da bancada (relativo à raiz do projeto). */
export const BENCH_STORES_MANIFEST_DIR = "fixtures/lab/bench";

/** Nome do arquivo do manifesto dentro do diretório. */
export const BENCH_STORES_MANIFEST_FILE = "stores.json";

/** Caminho relativo versionado do manifesto. */
export const BENCH_STORES_MANIFEST_PATH = `${BENCH_STORES_MANIFEST_DIR}/${BENCH_STORES_MANIFEST_FILE}`;

/** Código de erro do confinamento de caminho do manifesto. */
export const INVALID_BENCH_MANIFEST_PATH = "invalid_bench_manifest_path";

/** Código de erro do manifesto ausente/inválido. */
export const BENCH_MANIFEST_NOT_FOUND = "bench_manifest_not_found";
export const BENCH_MANIFEST_INVALID = "bench_manifest_invalid";

/** Código de erro da leitura de `stores` no Supabase local. */
export const BENCH_STORES_READ_FAILED = "bench_stores_read_failed";

/** Código de erro da loja ausente do manifesto (recusa sem leitura/geração). */
export const STORE_NOT_IN_MANIFEST = "store_not_in_manifest";

/** Código de erro da loja no manifesto mas ausente do Supabase local. */
export const BENCH_STORE_NOT_MATERIALIZED = "bench_store_not_materialized";

/** Código de erro do `identity_state` inválido/ausente na loja local. */
export const BENCH_STORE_IDENTITY_STATE_INVALID = "bench_store_identity_state_invalid";

/** Conjunto FECHADO de `stores.identity_state` (espelha o CHECK do banco). */
export const BENCH_STORE_IDENTITY_STATES = ["text_only", "logo", "visual_signature"] as const;

export type BenchStoreIdentityState = (typeof BENCH_STORE_IDENTITY_STATES)[number];

/**
 * Valida `stores.identity_state` contra o conjunto fechado (fail-closed). Ausente
 * ou desconhecido lança `bench_store_identity_state_invalid` — nunca é convertido
 * silenciosamente para `text_only`.
 */
export function resolveBenchStoreIdentityState(value: unknown, storeId: string): BenchStoreIdentityState {
  if (
    typeof value === "string" &&
    (BENCH_STORE_IDENTITY_STATES as readonly string[]).includes(value)
  ) {
    return value as BenchStoreIdentityState;
  }
  throw new Error(`${BENCH_STORE_IDENTITY_STATE_INVALID}:${storeId}`);
}

// ─── Schema do manifesto ─────────────────────────────────────────────────────

const BenchManifestStoreSchema = z
  .object({
    id: z.string().uuid(),
    label: z.string().min(1).max(200),
    notes: z.string().max(2000).optional(),
  })
  .strict();

const BenchStoreManifestSchema = z
  .object({
    stores: z.array(BenchManifestStoreSchema),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export type BenchManifestStore = z.infer<typeof BenchManifestStoreSchema>;

export interface BenchStoreManifest {
  stores: BenchManifestStore[];
  notes?: string;
}

// ─── Confinamento de caminho (anti-traversal) ────────────────────────────────

function benchManifestRoot(): string {
  return path.resolve(process.cwd(), BENCH_STORES_MANIFEST_DIR);
}

/**
 * Verifica **lexicalmente** que o caminho resolvido é um descendente estrito do
 * diretório permitido. Rejeita `..`, caminho absoluto e o próprio diretório raiz.
 */
export function assertWithinRoot(candidate: string, root: string, label: string): string {
  const resolved = path.resolve(candidate);
  const relative = path.relative(root, resolved);
  if (relative.length === 0 || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${INVALID_BENCH_MANIFEST_PATH}:${label}`);
  }
  return resolved;
}

/**
 * Resolve um caminho relativo confinado ao diretório do manifesto. Qualquer
 * tentativa de escapar da raiz (`../`) é recusada com `invalid_bench_manifest_path`.
 */
export function resolveBenchManifestPath(relative: string): string {
  const root = benchManifestRoot();
  return assertWithinRoot(path.resolve(root, relative), root, relative);
}

// ─── Erro determinístico da elegibilidade ────────────────────────────────────

export type BenchStoreManifestErrorCode =
  | typeof STORE_NOT_IN_MANIFEST
  | typeof BENCH_STORE_NOT_MATERIALIZED;

/**
 * Lançado quando a loja não é elegível para a bancada: ausente do manifesto
 * (`store_not_in_manifest`) ou ausente do Supabase local
 * (`bench_store_not_materialized`). Carrega o `storeId` recusado.
 */
export class BenchStoreManifestError extends Error {
  readonly code: BenchStoreManifestErrorCode;
  readonly storeId: string;

  constructor(code: BenchStoreManifestErrorCode, storeId: string) {
    super(`${code}:${storeId}`);
    this.name = "BenchStoreManifestError";
    this.code = code;
    this.storeId = storeId;
  }
}

// ─── Helpers de narrowing ────────────────────────────────────────────────────

type Row = Record<string, unknown>;

function asRow(data: unknown): Row | null {
  return data && typeof data === "object" ? (data as Row) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// ─── Carregamento do manifesto ───────────────────────────────────────────────

/**
 * Lê e valida `fixtures/lab/bench/stores.json`. Caminho confinado ao diretório do
 * manifesto (anti-traversal) e schema validado por Zod; arquivo ausente ou
 * inválido é recusado (fail-closed).
 */
export async function loadBenchStoreManifest(): Promise<BenchStoreManifest> {
  const filePath = resolveBenchManifestPath(BENCH_STORES_MANIFEST_FILE);

  let raw: string;
  try {
    raw = await fsp.readFile(filePath, "utf8");
  } catch {
    throw new Error(`${BENCH_MANIFEST_NOT_FOUND}:${BENCH_STORES_MANIFEST_PATH}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`${BENCH_MANIFEST_INVALID}:json`);
  }

  const result = BenchStoreManifestSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${BENCH_MANIFEST_INVALID}:${JSON.stringify(
        result.error.issues.map((issue) => ({ path: issue.path, message: issue.message })),
      )}`,
    );
  }

  return result.data;
}

// ─── Leitura cruzada com o Supabase local ────────────────────────────────────

export interface BenchTestStoreSummary {
  id: string;
  label: string;
  notes?: string;
  name: string;
  segment: string;
}

export interface BenchTestStoreRecord {
  id: string;
  name: string;
  segment: string;
  subsegment: string | null;
  toneOfVoice: string | null;
  positioning: string | null;
  shortDescription: string | null;
  slogan: string | null;
  /** `stores.identity_state` — estado real da loja (fonte de verdade da bancada). */
  identityState: BenchStoreIdentityState;
}

/**
 * Lista as lojas de teste elegíveis: presentes **no manifesto E** materializadas
 * no Supabase local. Leitura **somente leitura** (`.select(...)`) de `stores`; o
 * manifesto é a única fonte de elegibilidade (nenhuma loja fora dele é listada).
 * A ordem de saída segue a ordem do manifesto.
 */
export async function listBenchTestStores(params: {
  client: SupabaseClient;
  manifest?: readonly BenchManifestStore[];
}): Promise<BenchTestStoreSummary[]> {
  const manifest = params.manifest ?? (await loadBenchStoreManifest()).stores;
  if (manifest.length === 0) return [];

  const ids = manifest.map((entry) => entry.id);
  const { data, error } = await params.client
    .from("stores")
    .select("id,name,segment")
    .in("id", ids);

  if (error) {
    throw new Error(`${BENCH_STORES_READ_FAILED}:${error.message}`);
  }

  const rows = Array.isArray(data) ? (data as Row[]) : [];
  const byId = new Map(rows.map((row) => [text(row.id), row]));

  const summaries: BenchTestStoreSummary[] = [];
  for (const entry of manifest) {
    const row = byId.get(entry.id);
    if (!row) continue;
    const summary: BenchTestStoreSummary = {
      id: entry.id,
      label: entry.label,
      name: text(row.name),
      segment: text(row.segment),
    };
    if (entry.notes !== undefined) summary.notes = entry.notes;
    summaries.push(summary);
  }
  return summaries;
}

/**
 * Exige que `storeId` seja uma loja de teste elegível — presente **no manifesto E**
 * materializada no Supabase local — e devolve o registro local da loja.
 *
 * É o contrato exigido por **todos** os pontos de entrada da bancada (branding
 * GET, estimativa e execução POST) **antes** de qualquer leitura de branding,
 * tabela de loja ou storage. Loja fora do manifesto é recusada com
 * `store_not_in_manifest` **sem** consultar loja remota.
 */
export async function assertBenchTestStore(params: {
  client: SupabaseClient;
  storeId: string;
  manifest?: readonly BenchManifestStore[];
}): Promise<BenchTestStoreRecord> {
  const manifest = params.manifest ?? (await loadBenchStoreManifest()).stores;

  if (!manifest.some((entry) => entry.id === params.storeId)) {
    throw new BenchStoreManifestError(STORE_NOT_IN_MANIFEST, params.storeId);
  }

  const { data, error } = await params.client
    .from("stores")
    .select("id,name,segment,subsegment,tone_of_voice,positioning,short_description,slogan,identity_state")
    .eq("id", params.storeId)
    .maybeSingle();

  if (error) {
    throw new Error(`${BENCH_STORES_READ_FAILED}:${error.message}`);
  }

  const row = asRow(data);
  if (!row) {
    throw new BenchStoreManifestError(BENCH_STORE_NOT_MATERIALIZED, params.storeId);
  }

  return {
    id: text(row.id),
    name: text(row.name),
    segment: text(row.segment),
    subsegment: nullableText(row.subsegment),
    toneOfVoice: nullableText(row.tone_of_voice),
    positioning: nullableText(row.positioning),
    shortDescription: nullableText(row.short_description),
    slogan: nullableText(row.slogan),
    identityState: resolveBenchStoreIdentityState(row.identity_state, params.storeId),
  };
}
