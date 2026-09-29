import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase **gravador** compartilhado pelos testes de contrato do
 * laboratório/bancada (extraído de `lab-isolation.contract.test.ts`).
 *
 * Um `Proxy` sobre um client fake em memória que registra cada
 * `from(table)`/`storage.from(bucket)`/`rpc(name)` e **lança**
 * `forbidden_production_access:<alvo>` para qualquer alvo fora da allowlist do
 * laboratório. É o detector que faz um teste falhar ao tocar produção.
 *
 * Este arquivo **não** é um arquivo de teste (não casa com `*.test.ts`) — é um
 * helper compartilhado, como `src/lib/lab/api/__tests__/fake-supabase-client.ts`.
 * Nenhuma chamada de rede é feita.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type Row = Record<string, unknown>;

export interface MemoryState {
  tables: Record<string, Row[]>;
  rpcCalls: Array<{ fn: string; args: Record<string, unknown> }>;
  updateCalls: Array<{ table: string; values: Row }>;
  insertCalls: Array<{ table: string; payload: Row | Row[] }>;
  idSeq: number;
  /** Resultados configuráveis por nome de RPC (default: handlers do laboratório). */
  rpcResults: Record<string, { data?: unknown; error?: { message: string } | null }>;
}

type QueryResult = { data: unknown; error: unknown };

// ─── Builder fake em memória ─────────────────────────────────────────────────

class MemoryBuilder implements PromiseLike<QueryResult> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: Row | Row[] | null = null;

  constructor(
    private readonly state: MemoryState,
    private readonly table: string,
  ) {}

  select(_columns?: string, _options?: unknown): this {
    return this;
  }

  insert(payload: Row | Row[]): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: Row): this {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  is(column: string, value: unknown): this {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }

  lt(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] ?? "") < String(value));
    return this;
  }

  gt(column: string, value: unknown): this {
    this.filters.push((row) => String(row[column] ?? "") > String(value));
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orders.push({ column, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitCount = count;
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    return { data: (result.data as Row[])[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as Row[];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    const rows = this.state.tables[this.table] ?? [];
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  /** Ids gerados em formato de UUID — os builders de path da bancada os exigem. */
  private nextId(): string {
    this.state.idSeq += 1;
    return `00000000-0000-4000-8000-${String(this.state.idSeq).padStart(12, "0")}`;
  }

  private async execute(): Promise<QueryResult> {
    if (this.mode === "insert") {
      const rows = this.state.tables[this.table] ?? (this.state.tables[this.table] = []);
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted = payloads.map((payload) => {
        const row: Row = { id: this.nextId(), ...payload };
        rows.push(row);
        return row;
      });
      this.state.insertCalls.push({ table: this.table, payload: this.payload as Row | Row[] });
      return { data: inserted, error: null };
    }

    if (this.mode === "update") {
      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload ?? {});
      this.state.updateCalls.push({ table: this.table, values: this.payload as Row });
      return { data: matched, error: null };
    }

    if (this.mode === "delete") {
      const rows = this.state.tables[this.table] ?? [];
      const matched = this.matched();
      for (const row of matched) {
        const index = rows.indexOf(row);
        if (index >= 0) rows.splice(index, 1);
      }
      return { data: matched, error: null };
    }

    let result = this.matched();
    for (const { column, ascending } of [...this.orders].reverse()) {
      result = [...result].sort((left, right) => {
        const a = String(left[column] ?? "");
        const b = String(right[column] ?? "");
        return ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);
    return { data: result, error: null };
  }
}

interface MemoryStorageOps {
  upload: (storagePath: string, body: unknown, options?: unknown) => Promise<unknown>;
  remove: (paths: string[]) => Promise<unknown>;
  createSignedUrl: (storagePath: string, ttl: number) => Promise<unknown>;
}

interface MemoryClient {
  from: (table: string) => MemoryBuilder;
  rpc: (name: string, args: Record<string, unknown>) => Promise<QueryResult>;
  storage: { from: (bucket: string) => MemoryStorageOps };
}

// ─── Constantes dos handlers de RPC do laboratório A/B ───────────────────────

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const RUN_ID = "44444444-4444-4444-8444-444444444444";

/**
 * Client fake em memória. Os handlers de RPC espelham o efeito mínimo das RPCs do
 * laboratório (inserir o run `pending` na reserva e devolver o id), sem nenhuma
 * chamada de rede.
 */
function createMemoryClient(state: MemoryState): MemoryClient {
  return {
    from(table: string) {
      return new MemoryBuilder(state, table);
    },
    rpc(name: string, args: Record<string, unknown>) {
      state.rpcCalls.push({ fn: name, args });
      const configured = state.rpcResults[name];
      if (configured) return Promise.resolve(configured as QueryResult);

      if (name === "lab_create_experiment") {
        return Promise.resolve({ data: { experiment_id: EXPERIMENT_ID }, error: null });
      }
      if (name === "lab_reserve_run") {
        // Fail-closed (F48.2.1 C1/C2): quando o experimento aponta para um
        // programa, a reserva exige `status='authorized'` — `draft`/`closed`
        // recusam antes de qualquer chamada paga (espelha `lab_reserve_run`).
        const experiment = (state.tables.lab_experiments ?? []).find(
          (row) => row.id === args.p_experiment_id,
        );
        const programId = experiment?.program_id;
        if (programId) {
          const program = (state.tables.lab_prompt_programs ?? []).find(
            (row) => row.id === programId,
          );
          if (!program || program.status !== "authorized") {
            return Promise.resolve({ data: null, error: { message: "program_not_authorized" } });
          }
        }
        const runs = state.tables.lab_runs ?? (state.tables.lab_runs = []);
        runs.push({
          id: RUN_ID,
          experiment_id: args.p_experiment_id,
          variant_id: args.p_variant_id,
          status: "pending",
          snapshot: args.p_snapshot,
        });
        return Promise.resolve({
          data: { run_id: RUN_ID, run_sequence: 1, idempotent: false },
          error: null,
        });
      }
      // Liquidação de orçamento (F48.2.1, D2/D5): idempotente e best-effort.
      if (name === "lab_settle_run_budget" || name === "lab_release_run_budget") {
        return Promise.resolve({ data: { success: true, settled: true }, error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unexpected_rpc:${name}` } });
    },
    storage: {
      from(_bucket: string) {
        return {
          upload: async (storagePath: string) => ({ data: { path: storagePath }, error: null }),
          remove: async () => ({ data: null, error: null }),
          createSignedUrl: async (storagePath: string) => ({
            data: { signedUrl: `signed:${storagePath}` },
            error: null,
          }),
        };
      },
    },
  };
}

// ─── Allowlist + detector de acesso produtivo ────────────────────────────────

/**
 * Tabelas `lab_*` permitidas + o catálogo da F47 (somente leitura) + a persistência
 * própria da bancada e as tabelas de loja/branding **local** (somente leitura).
 */
export const ALLOWED_TABLES = new Set([
  "lab_scenarios",
  "lab_scenario_versions",
  "lab_experiments",
  "lab_experiment_variants",
  "lab_experiment_scenarios",
  "lab_runs",
  "lab_artifacts",
  "lab_human_evaluations",
  "ai_model_catalog",
  // F48.2.2 — persistência própria da bancada (D1/D9).
  "lab_bench_runs",
  "lab_bench_artifacts",
  // F48.2.3 — auditoria local da importação de identidade (D11). É o único
  // destino de escrita ADITIVO permitido ao runtime; loja/branding permanecem
  // somente leitura (READ_ONLY_TABLES abaixo).
  "lab_bench_store_imports",
  // F48.2.2 — leitura somente-leitura de lojas/branding do Supabase **local** (D3/D4).
  "stores",
  "store_brand_profiles",
  "store_brand_assets",
  "store_visual_signatures",
]);

/** Bucket próprio do laboratório (nunca `campaign-images`). */
export const ALLOWED_BUCKETS = new Set(["lab-artifacts"]);

/**
 * F48.2.2 — buckets locais de branding, **somente leitura** (apenas
 * `createSignedUrl`; `upload`/`remove`/`list` lançam). Nunca aceitam bucket/path
 * informado pelo cliente: o signer resolve o path do registro persistido (D3).
 */
export const READ_ONLY_BUCKETS = new Set(["store-logos", "store-brand-assets", "visual-signatures"]);

/** RPCs do laboratório. */
export const ALLOWED_RPCS = new Set([
  "lab_reserve_run",
  "lab_create_experiment",
  // Liquidação de orçamento do run (F48.2.1, D2/D5).
  "lab_settle_run_budget",
  "lab_release_run_budget",
  // F48.2.2 — reserva atômica da bancada (`draft → pending` compare-and-set).
  "lab_bench_reserve_run",
]);

/** RPC da bancada é permitida por prefixo (`lab_bench_*`), aditivamente. */
export function isAllowedRpc(name: string): boolean {
  return ALLOWED_RPCS.has(name) || name.startsWith("lab_bench_");
}

/** Leitura permitida, escrita proibida. */
export const READ_ONLY_TABLES = new Set([
  "ai_model_catalog",
  // F48.2.2 — lojas/branding local: nunca criam/alteram linhas (D3/D4).
  "stores",
  "store_brand_profiles",
  "store_brand_assets",
  "store_visual_signatures",
]);

export const ALLOWED_ENTRY_RE =
  /^(?:from:(?:lab_scenarios|lab_scenario_versions|lab_experiments|lab_experiment_variants|lab_experiment_scenarios|lab_runs|lab_artifacts|lab_human_evaluations|ai_model_catalog|lab_bench_runs|lab_bench_artifacts|lab_bench_store_imports|stores|store_brand_profiles|store_brand_assets|store_visual_signatures)|rpc:(?:lab_reserve_run|lab_create_experiment|lab_settle_run_budget|lab_release_run_budget|lab_bench_\w+)|storage\.from:lab-artifacts|storage\.(?:upload|remove|createSignedUrl):lab-artifacts|storage\.from:(?:store-logos|store-brand-assets|visual-signatures)|storage\.createSignedUrl:(?:store-logos|store-brand-assets|visual-signatures))/;

/** Alvos produtivos que jamais podem aparecer no `accessLog`. */
export const FORBIDDEN_TARGETS = [
  "campaigns",
  "campaign_art_versions",
  "generation_events",
  "ai_model_selection",
  "admin_audit_log",
  "credit_transactions",
  "campaign-images",
];

export interface RecordingClient {
  client: SupabaseClient;
  accessLog: string[];
  state: MemoryState;
}

export function forbiddenProductionAccess(target: string): Error {
  return new Error(`forbidden_production_access:${target}`);
}

/** Envolve o catálogo para permitir somente `select` (qualquer escrita lança). */
export function wrapReadOnlyTable(builder: object, table: string, accessLog: string[]): object {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (prop === "insert" || prop === "update" || prop === "delete") {
        const operation = String(prop);
        return () => {
          accessLog.push(`write:${table}:${operation}`);
          throw forbiddenProductionAccess(`${table}:${operation}`);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

/** Operações de um bucket de branding local: somente `createSignedUrl` (D3). */
export interface ReadOnlyBucketOps {
  createSignedUrl: (storagePath: string, ttl: number) => Promise<unknown>;
  upload: (storagePath: string, body: unknown, options?: unknown) => never;
  remove: (paths: string[]) => never;
  list: (path?: string, options?: unknown) => never;
}

/**
 * Envolve um bucket de branding local para permitir **somente** `createSignedUrl`
 * (espelha `wrapReadOnlyTable`): `upload`/`remove`/`list` lançam
 * `forbidden_production_access:storage:{bucket}:{operation}`.
 */
export function wrapReadOnlyBucket(
  bucket: string,
  ops: MemoryStorageOps,
  accessLog: string[],
): ReadOnlyBucketOps {
  const deny = (operation: string): never => {
    accessLog.push(`storage.${operation}:${bucket}`);
    throw forbiddenProductionAccess(`storage:${bucket}:${operation}`);
  };
  return {
    createSignedUrl: (storagePath: string, ttl: number) => {
      accessLog.push(`storage.createSignedUrl:${bucket}:${storagePath}`);
      return ops.createSignedUrl(storagePath, ttl);
    },
    upload: () => deny("upload"),
    remove: () => deny("remove"),
    list: () => deny("list"),
  };
}

/**
 * Client gravador: registra cada alvo acessado e **lança** quando ele está fora da
 * allowlist do laboratório. É o detector que faz o teste falhar ao tocar produção.
 */
export function createRecordingClient(seed: Record<string, Row[]> = {}): RecordingClient {
  const state: MemoryState = {
    tables: seed,
    rpcCalls: [],
    updateCalls: [],
    insertCalls: [],
    idSeq: 0,
    rpcResults: {},
  };
  const accessLog: string[] = [];
  const memory = createMemoryClient(state);

  const client = new Proxy(memory, {
    get(target, prop, receiver) {
      if (prop === "from") {
        return (table: string) => {
          accessLog.push(`from:${table}`);
          if (!ALLOWED_TABLES.has(table)) throw forbiddenProductionAccess(table);
          const builder = target.from(table);
          return READ_ONLY_TABLES.has(table) ? wrapReadOnlyTable(builder, table, accessLog) : builder;
        };
      }

      if (prop === "rpc") {
        return (name: string, args: Record<string, unknown>) => {
          accessLog.push(`rpc:${name}`);
          if (!isAllowedRpc(name)) throw forbiddenProductionAccess(`rpc:${name}`);
          return target.rpc(name, args);
        };
      }

      if (prop === "storage") {
        return {
          from: (bucket: string) => {
            accessLog.push(`storage.from:${bucket}`);
            const readOnly = READ_ONLY_BUCKETS.has(bucket);
            if (!ALLOWED_BUCKETS.has(bucket) && !readOnly) {
              throw forbiddenProductionAccess(`storage:${bucket}`);
            }
            const ops = target.storage.from(bucket);
            // F48.2.2 — bucket de branding local: somente leitura (`createSignedUrl`).
            if (readOnly) return wrapReadOnlyBucket(bucket, ops, accessLog);
            return {
              upload: (storagePath: string, body: unknown, options?: unknown) => {
                accessLog.push(`storage.upload:${bucket}:${storagePath}`);
                return ops.upload(storagePath, body, options);
              },
              remove: (paths: string[]) => {
                accessLog.push(`storage.remove:${bucket}`);
                return ops.remove(paths);
              },
              createSignedUrl: (storagePath: string, ttl: number) => {
                accessLog.push(`storage.createSignedUrl:${bucket}:${storagePath}`);
                return ops.createSignedUrl(storagePath, ttl);
              },
            };
          },
        };
      }

      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as unknown as SupabaseClient;

  return { client, accessLog, state };
}
