// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENCH_ACTIVE_STALE_MS,
  BENCH_DRAFT_STALE_MS,
  confirmBenchRun,
  reconcileStaleBenchRuns,
  reserveBenchRun,
} from "../persistence/bench-run-service";

/**
 * Contrato transversal nº 2 (F48.2.2, task 8.2) — **concorrência e recuperação**.
 *
 * Client **100% fake em memória** (nenhuma chamada de rede e nenhuma chamada
 * paga): simula o índice único parcial **global** de geração ativa
 * (`uq_lab_bench_runs_one_active_global`, cobrindo somente `pending`/`running`) e
 * o ciclo `draft → pending → running → terminal`.
 *
 * Prova: (a) duas confirmações simultâneas de `draft → pending` resultam em
 * **exatamente uma** vencedora e a outra recebe `bench_run_already_active` **sem
 * chamada paga**; (b) há **exatamente uma** geração ativa; (c) o reenvio
 * idempotente devolve o run existente **sem novo insert**; (d) uma geração presa é
 * reconciliada como `failed` com `bench_run_orphan_timeout` e **libera o slot**;
 * (e) um `draft` abandonado é reapado (`bench_run_draft_abandoned`) sem bloquear a
 * bancada.
 */

const ACTOR_ID = "66666666-6666-4666-8666-666666666666";
const OP_A = "55555555-5555-4555-8555-555555555551";
const OP_B = "55555555-5555-4555-8555-555555555552";
const OP_C = "55555555-5555-4555-8555-555555555553";

type Row = Record<string, unknown>;

interface FilterDescriptor {
  column: string;
  value: unknown;
  op: "eq" | "in" | "is" | "lt";
}

class FakeQueryBuilder {
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private readonly predicates: Array<(row: Row) => boolean> = [];
  private readonly descriptors: FilterDescriptor[] = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;

  constructor(
    private readonly fake: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    return this;
  }

  insert(values: Row): this {
    this.mode = "insert";
    this.payload = values;
    return this;
  }

  update(values: Row): this {
    this.mode = "update";
    this.payload = values;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.predicates.push((row) => row[column] === value);
    this.descriptors.push({ column, value, op: "eq" });
    return this;
  }

  in(column: string, values: readonly unknown[]): this {
    this.predicates.push((row) => values.includes(row[column]));
    this.descriptors.push({ column, value: values, op: "in" });
    return this;
  }

  is(column: string, value: unknown): this {
    this.predicates.push((row) => (row[column] ?? null) === value);
    this.descriptors.push({ column, value, op: "is" });
    return this;
  }

  lt(column: string, value: unknown): this {
    this.predicates.push((row) => {
      const left = row[column];
      if (typeof left !== "string" || typeof value !== "string") return false;
      return Date.parse(left) < Date.parse(value);
    });
    this.descriptors.push({ column, value, op: "lt" });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderSpec = { column, ascending: options?.ascending !== false };
    return this;
  }

  async maybeSingle(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = Array.isArray(result.data) ? result.data : [];
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const result = await this.execute();
    if (result.error) return { data: null, error: result.error };
    const rows = Array.isArray(result.data) ? result.data : [];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private matched(): Row[] {
    const rows = this.fake.tables[this.table] ?? [];
    return rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
  }

  private async execute(): Promise<{ data: unknown; error: unknown }> {
    this.fake.operations.push({ table: this.table, op: this.mode });

    if (this.mode === "insert") {
      const rows = (this.fake.tables[this.table] ??= []);
      const row: Row = { id: `run-${++this.fake.idCounter}`, ...this.payload };
      rows.push(row);
      this.fake.insertCalls.push({ table: this.table, payload: this.payload });
      return { data: [row], error: null };
    }

    if (this.mode === "update") {
      const matched = this.matched();
      // Espelha o índice único parcial GLOBAL: só um run ativo em toda a tabela.
      if (
        matched.length > 0 &&
        this.table === "lab_bench_runs" &&
        (this.payload.status === "pending" || this.payload.status === "running")
      ) {
        const conflicts = (this.fake.tables[this.table] ?? []).filter(
          (row) => !matched.includes(row) && (row.status === "pending" || row.status === "running"),
        );
        if (conflicts.length > 0) {
          return {
            data: null,
            error: {
              code: "23505",
              message:
                'duplicate key value violates unique constraint "uq_lab_bench_runs_one_active_global"',
            },
          };
        }
      }
      for (const row of matched) Object.assign(row, this.payload);
      this.fake.appliedUpdates.push({
        table: this.table,
        values: this.payload,
        filters: [...this.descriptors],
      });
      return { data: matched, error: null };
    }

    let rows = this.matched();
    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      rows = [...rows].sort((left, right) => {
        const a = String(left[column] ?? "");
        const b = String(right[column] ?? "");
        return ascending ? a.localeCompare(b) : b.localeCompare(a);
      });
    }
    return { data: rows, error: null };
  }
}

class FakeSupabaseClient {
  readonly tables: Record<string, Row[]> = {};
  readonly operations: Array<{ table: string; op: string }> = [];
  readonly insertCalls: Array<{ table: string; payload: Row }> = [];
  readonly appliedUpdates: Array<{ table: string; values: Row; filters: FilterDescriptor[] }> = [];
  idCounter = 0;

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

function asClient(fake: FakeSupabaseClient): SupabaseClient {
  return fake as unknown as SupabaseClient;
}

function runs(fake: FakeSupabaseClient): Row[] {
  return fake.tables.lab_bench_runs ?? [];
}

function runById(fake: FakeSupabaseClient, id: string): Row | undefined {
  return runs(fake).find((row) => row.id === id);
}

function activeRuns(fake: FakeSupabaseClient): Row[] {
  return runs(fake).filter((row) => row.status === "pending" || row.status === "running");
}

let fake: FakeSupabaseClient;

beforeEach(() => {
  fake = new FakeSupabaseClient();
});

// ─── Concorrência: exatamente uma geração ativa ──────────────────────────────

describe("concorrência — exatamente uma geração ativa (CAS draft → pending)", () => {
  it("duas confirmações simultâneas: exatamente uma vence; a outra recebe bench_run_already_active", async () => {
    const a = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const b = await reserveBenchRun({ client: asClient(fake), operationId: OP_B, createdBy: ACTOR_ID });

    const results = await Promise.allSettled([
      confirmBenchRun({ client: asClient(fake), runId: a.runId }),
      confirmBenchRun({ client: asClient(fake), runId: b.runId }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({
      name: "BenchRunError",
      code: "bench_run_already_active",
    });

    // Exatamente uma geração ativa em toda a bancada.
    expect(activeRuns(fake)).toHaveLength(1);
    const winnerId = activeRuns(fake)[0].id;
    const loserId = winnerId === a.runId ? b.runId : a.runId;
    expect(runById(fake, loserId)?.status).toBe("draft");

    // Sem chamada paga: só a tabela da bancada foi tocada (nenhum provider).
    expect(fake.operations.every((operation) => operation.table === "lab_bench_runs")).toBe(true);
  });
});

// ─── Idempotência ────────────────────────────────────────────────────────────

describe("reenvio idempotente", () => {
  it("o mesmo operation_id devolve o run existente sem novo insert", async () => {
    const first = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const second = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    expect(second.idempotent).toBe(true);
    expect(second.runId).toBe(first.runId);
    expect(fake.insertCalls.filter((call) => call.table === "lab_bench_runs")).toHaveLength(1);
    // Nenhuma transição de estado: nenhuma geração foi iniciada (sem chamada paga).
    expect(runs(fake).every((run) => run.status === "draft")).toBe(true);
  });
});

// ─── Recuperação: geração presa ──────────────────────────────────────────────

describe("reconciliação — geração presa (bench_run_orphan_timeout)", () => {
  const NOW = new Date("2026-09-28T12:00:00.000Z");

  it("marca running e pending órfãos como failed sem tocar a geração recente", async () => {
    const old = new Date(NOW.getTime() - BENCH_ACTIVE_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "old-running", status: "running", started_at: old, created_at: old },
      { id: "old-pending", status: "pending", started_at: null, created_at: old },
      { id: "recent-running", status: "running", started_at: NOW.toISOString(), created_at: NOW.toISOString() },
    ];

    const result = await reconcileStaleBenchRuns({ client: asClient(fake), now: NOW });

    expect(result.reconciled).toBe(2);
    expect(runById(fake, "old-running")?.status).toBe("failed");
    expect(runById(fake, "old-running")?.error_type).toBe("bench_run_orphan_timeout");
    expect(runById(fake, "old-pending")?.error_type).toBe("bench_run_orphan_timeout");
    expect(runById(fake, "recent-running")?.status).toBe("running");
  });

  it("libera o slot global: uma nova geração pode ser confirmada após a reconciliação", async () => {
    const old = new Date(Date.now() - BENCH_ACTIVE_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "stuck-running", status: "running", started_at: old, created_at: old },
    ];

    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    expect(runById(fake, "stuck-running")?.error_type).toBe("bench_run_orphan_timeout");
    await confirmBenchRun({ client: asClient(fake), runId: reserved.runId });
    expect(runById(fake, reserved.runId)?.status).toBe("pending");
    expect(activeRuns(fake)).toHaveLength(1);
  });
});

// ─── Recuperação: draft abandonado ───────────────────────────────────────────

describe("reconciliação — draft abandonado (bench_run_draft_abandoned)", () => {
  it("reap o draft abandonado e a bancada continua operável", async () => {
    const now = new Date("2026-09-28T12:00:00.000Z");
    const old = new Date(now.getTime() - BENCH_DRAFT_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "abandoned-draft", status: "draft", started_at: null, created_at: old },
    ];

    const result = await reconcileStaleBenchRuns({ client: asClient(fake), now });

    expect(result.draftsReaped).toBe(1);
    expect(runById(fake, "abandoned-draft")?.status).toBe("failed");
    expect(runById(fake, "abandoned-draft")?.error_type).toBe("bench_run_draft_abandoned");

    // O draft nunca ocupou o slot: uma nova reserva funciona normalmente.
    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_C, createdBy: ACTOR_ID });
    expect(runById(fake, reserved.runId)?.status).toBe("draft");
    await confirmBenchRun({ client: asClient(fake), runId: reserved.runId });
    expect(activeRuns(fake)).toHaveLength(1);
    expect(fake.operations.every((operation) => operation.table === "lab_bench_runs")).toBe(true);
  });
});
