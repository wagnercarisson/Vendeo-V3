import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase fake em memória para os testes da API do laboratório
 * (F48.1, 48-1-08).
 *
 * Implementa **apenas** o subconjunto de encadeamentos usado pelos módulos de
 * `src/lib/lab/api/**` e pelo serviço de artefatos: `select/insert/update/delete`,
 * filtros `eq/in/is/lt/gt`, `order`, `limit`, `maybeSingle/single` e o
 * `storage.from(...).createSignedUrl/remove/upload`. Nenhuma chamada de rede.
 *
 * Helper de teste compartilhado (não é arquivo de teste — não é coletado pelo
 * vitest) para evitar duplicar ~150 linhas em cada suíte.
 */

export type FakeRow = Record<string, unknown>;

export interface FakeClientOptions {
  tables?: Record<string, FakeRow[]>;
  /** Erro devolvido por leitura (`select`) da tabela. */
  readErrors?: Record<string, { message: string } | undefined>;
  /** Erro devolvido por insert da tabela. */
  insertErrors?: Record<string, { message: string } | undefined>;
  /** Erro devolvido por update da tabela. */
  updateErrors?: Record<string, { message: string } | undefined>;
  /** Erro devolvido por `storage.createSignedUrl`. */
  signedUrlErrors?: Record<string, { message: string } | undefined>;
  /** Erro devolvido por `storage.upload`. */
  uploadErrors?: Record<string, { message: string } | undefined>;
  /** Monta a URL assinada (default: `signed:<path>`). */
  signedUrl?: (path: string) => string;
}

export interface FakeSupabaseClient {
  client: SupabaseClient;
  tables: Record<string, FakeRow[]>;
  operations: Array<{ table: string; op: string }>;
  insertCalls: Array<{ table: string; payload: FakeRow | FakeRow[] }>;
  updateCalls: Array<{ table: string; payload: FakeRow }>;
  deleteCalls: Array<{ table: string }>;
}

interface FakeState {
  tables: Record<string, FakeRow[]>;
  readErrors: Record<string, { message: string } | undefined>;
  insertErrors: Record<string, { message: string } | undefined>;
  updateErrors: Record<string, { message: string } | undefined>;
  signedUrlErrors: Record<string, { message: string } | undefined>;
  uploadErrors: Record<string, { message: string } | undefined>;
  signedUrl: (path: string) => string;
  operations: Array<{ table: string; op: string }>;
  insertCalls: Array<{ table: string; payload: FakeRow | FakeRow[] }>;
  updateCalls: Array<{ table: string; payload: FakeRow }>;
  deleteCalls: Array<{ table: string }>;
  idCounter: number;
  timestampCounter: number;
}

type Filter = (row: FakeRow) => boolean;

type QueryResult = { data: unknown; error: unknown; count?: number };

class FakeQueryBuilder implements PromiseLike<QueryResult> {
  private readonly filters: Filter[] = [];
  private readonly orders: Array<{ column: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private mode: "select" | "insert" | "update" | "delete" = "select";
  private payload: FakeRow | FakeRow[] | null = null;

  constructor(
    private readonly state: FakeState,
    private readonly table: string,
  ) {}

  select(_columns?: string, _options?: { count?: string; head?: boolean }): this {
    return this;
  }

  insert(payload: FakeRow | FakeRow[]): this {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }

  update(payload: FakeRow): this {
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
    return { data: (result.data as FakeRow[])[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = result.data as FakeRow[];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matched(): FakeRow[] {
    const rows = this.state.tables[this.table] ?? [];
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }

  private async execute(): Promise<QueryResult> {
    const { state, table } = this;
    state.operations.push({ table, op: this.mode });

    if (this.mode === "insert") {
      const insertError = state.insertErrors[table];
      if (insertError) return { data: null, error: insertError };

      const rows = state.tables[table] ?? (state.tables[table] = []);
      const payloads = Array.isArray(this.payload) ? this.payload : [this.payload ?? {}];
      const inserted = payloads.map((payload) => {
        state.idCounter += 1;
        state.timestampCounter += 1;
        const row: FakeRow = {
          id: `generated-${state.idCounter}`,
          created_at: `2026-09-16T00:00:${String(state.timestampCounter).padStart(2, "0")}.000Z`,
          ...payload,
        };
        rows.push(row);
        return row;
      });

      state.insertCalls.push({ table, payload: this.payload as FakeRow | FakeRow[] });
      return { data: inserted, error: null };
    }

    if (this.mode === "update") {
      const updateError = state.updateErrors[table];
      if (updateError) return { data: null, error: updateError };

      const matched = this.matched();
      for (const row of matched) Object.assign(row, this.payload ?? {});
      state.updateCalls.push({ table, payload: this.payload as FakeRow });
      return { data: matched, error: null };
    }

    if (this.mode === "delete") {
      const rows = state.tables[table] ?? [];
      const matched = this.matched();
      for (const row of matched) {
        const index = rows.indexOf(row);
        if (index >= 0) rows.splice(index, 1);
      }
      state.deleteCalls.push({ table });
      return { data: matched, error: null };
    }

    const readError = state.readErrors[table];
    if (readError) return { data: null, error: readError };

    let result = this.matched();
    for (const { column, ascending } of [...this.orders].reverse()) {
      result = [...result].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    if (this.limitCount !== null) result = result.slice(0, this.limitCount);

    return { data: result, error: null, count: result.length };
  }
}

export function createFakeSupabaseClient(options: FakeClientOptions = {}): FakeSupabaseClient {
  const state: FakeState = {
    tables: options.tables ?? {},
    readErrors: options.readErrors ?? {},
    insertErrors: options.insertErrors ?? {},
    updateErrors: options.updateErrors ?? {},
    signedUrlErrors: options.signedUrlErrors ?? {},
    uploadErrors: options.uploadErrors ?? {},
    signedUrl: options.signedUrl ?? ((path: string) => `signed:${path}`),
    operations: [],
    insertCalls: [],
    updateCalls: [],
    deleteCalls: [],
    idCounter: 0,
    timestampCounter: 0,
  };

  const client = {
    from: (table: string) => new FakeQueryBuilder(state, table),
    storage: {
      from: (_bucket: string) => ({
        createSignedUrl: async (path: string, _ttl: number) => {
          const error = state.signedUrlErrors[path];
          if (error) return { data: null, error };
          return { data: { signedUrl: state.signedUrl(path) }, error: null };
        },
        upload: async (path: string, _body: unknown, _opts?: unknown) => {
          const error = state.uploadErrors[path];
          return { data: error ? null : { path }, error: error ?? null };
        },
        remove: async (_paths: string[]) => ({ data: null, error: null }),
      }),
    },
  } as unknown as SupabaseClient;

  return {
    client,
    tables: state.tables,
    operations: state.operations,
    insertCalls: state.insertCalls,
    updateCalls: state.updateCalls,
    deleteCalls: state.deleteCalls,
  };
}
