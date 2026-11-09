import type { PoolClient } from "pg";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Adaptador mínimo Postgres → superfície usada pelos serviços reais nas suítes
 * F60. Não é um cliente Supabase completo: cobre SOMENTE `from().select/eq/in/
 * order/maybeSingle/single()` e `rpc(name, params)` — o suficiente para exercitar
 * `TwoStageFinancialService`, `SupabasePendingOperationsRepository`, os clientes
 * de crédito/controle e as projeções pós-resolução contra o Postgres real.
 *
 * O objetivo é permitir dependências controladas (sonda de arte e alvo) sem
 * iniciar PostgREST/Supabase local nem tocar rede.
 */

type Row = Record<string, unknown>;
type Action = "select" | "update" | "insert";

const IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function identifier(value: string): string {
  if (!IDENTIFIER.test(value)) throw new Error(`pg_supabase_invalid_identifier:${value}`);
  return value;
}

function columns(value: string | undefined): string {
  if (!value || value.trim() === "" || value.trim() === "*") return "*";
  return value
    .split(",")
    .map((part) => identifier(part.trim()))
    .join(", ");
}

interface Filter {
  readonly op: "eq" | "in";
  readonly column: string;
  readonly value: unknown;
}

function normalizeRows(rows: Row[]): Row[] {
  return rows.map((row) => {
    const normalized: Row = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key] = value instanceof Date ? value.toISOString() : value;
    }
    return normalized;
  });
}

class QueryBuilder implements PromiseLike<{ data: Row[] | null; error: { message: string } | null }> {
  private action: Action = "select";
  private values: Row | null = null;
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;

  constructor(
    private readonly client: PoolClient,
    private readonly table: string,
  ) {}

  select(): this {
    return this;
  }

  update(values: Row): this {
    this.action = "update";
    this.values = values;
    return this;
  }

  insert(values: Row | Row[]): this {
    this.action = "insert";
    this.values = Array.isArray(values) ? values[0] : values;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ op: "eq", column, value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ op: "in", column, value: values });
    return this;
  }

  order(column: string, options: { ascending?: boolean } = {}): this {
    this.orderBy = { column, ascending: options.ascending !== false };
    return this;
  }

  async maybeSingle(): Promise<{ data: Row | null; error: { message: string } | null }> {
    const result = await this.run();
    if (result.error) return { data: null, error: result.error };
    return { data: (result.data ?? [])[0] ?? null, error: null };
  }

  async single(): Promise<{ data: Row | null; error: { message: string } | null }> {
    const result = await this.maybeSingle();
    if (result.error) return result;
    if (!result.data) return { data: null, error: { message: "no_rows" } };
    return result;
  }

  then<TResult1 = { data: Row[] | null; error: { message: string } | null }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: Row[] | null; error: { message: string } | null }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.run().then(onfulfilled, onrejected);
  }

  private where(parameters: unknown[]): string {
    if (this.filters.length === 0) return "";
    const clauses = this.filters.map((filter) => {
      const column = identifier(filter.column);
      if (filter.op === "in") {
        parameters.push(filter.value);
        return `${column} = any($${parameters.length})`;
      }
      parameters.push(filter.value);
      return `${column} = $${parameters.length}`;
    });
    return ` where ${clauses.join(" and ")}`;
  }

  private async run(): Promise<{ data: Row[] | null; error: { message: string } | null }> {
    const table = `public.${identifier(this.table)}`;
    const parameters: unknown[] = [];
    try {
      if (this.action === "update") {
        const values = this.values ?? {};
        const set = Object.entries(values).map(([column, value]) => {
          parameters.push(value);
          return `${identifier(column)} = $${parameters.length}`;
        });
        const sql = `update ${table} set ${set.join(", ")}${this.where(parameters)} returning *`;
        const result = await this.client.query(sql, parameters);
        return { data: normalizeRows(result.rows as Row[]), error: null };
      }

      if (this.action === "insert") {
        const values = this.values ?? {};
        const keys = Object.keys(values);
        const placeholders = keys.map((key) => {
          parameters.push(values[key]);
          return `$${parameters.length}`;
        });
        const sql = `insert into ${table} (${keys.map(identifier).join(", ")}) values (${placeholders.join(", ")}) returning *`;
        const result = await this.client.query(sql, parameters);
        return { data: normalizeRows(result.rows as Row[]), error: null };
      }

      const order = this.orderBy
        ? ` order by ${identifier(this.orderBy.column)} ${this.orderBy.ascending ? "asc" : "desc"}`
        : "";
      const sql = `select * from ${table}${this.where(parameters)}${order}`;
      const result = await this.client.query(sql, parameters);
      return { data: normalizeRows(result.rows as Row[]), error: null };
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }
}

export interface PgSupabaseClient {
  from(table: string): QueryBuilder;
  rpc(
    name: string,
    params?: Row,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

export function createPgSupabase(client: PoolClient): PgSupabaseClient {
  return {
    from: (table: string) => new QueryBuilder(client, table),
    rpc: async (name: string, params: Row = {}) => {
      const functionName = `public.${identifier(name)}`;
      const keys = Object.keys(params);
      const values = keys.map((key) => params[key]);
      const args = keys
        .map((key, index) => `${identifier(key)} => $${index + 1}`)
        .join(", ");
      try {
        const { rows } = await client.query<{ result: unknown }>(
          `select ${functionName}(${args}) as result`,
          values,
        );
        return { data: rows[0]?.result ?? null, error: null };
      } catch (error) {
        return {
          data: null,
          error: { message: error instanceof Error ? error.message : String(error) },
        };
      }
    },
  };
}

export function asSupabaseClient(client: PgSupabaseClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}
