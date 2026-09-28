// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BENCH_ACTIVE_STALE_MS,
  BENCH_DRAFT_STALE_MS,
  BenchRunError,
  confirmBenchRun,
  finalizeBenchRun,
  getBenchRun,
  getBenchRunByOperationId,
  markBenchRunRunning,
  reconcileStaleBenchRuns,
  reserveBenchRun,
  setBenchRunInput,
} from "../persistence/bench-run-service";

/**
 * Serviço de run da bancada (F48.2.2, D9/D10).
 *
 * Client **100% fake em memória**: nenhuma chamada de rede e nenhuma chamada
 * paga. Simula o índice único parcial global (uma geração ativa) e o ciclo
 * `draft → pending → running → terminal`.
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
interface AppliedUpdate {
  table: string;
  values: Row;
  filters: FilterDescriptor[];
}

class FakeQueryBuilder {
  private mode: "select" | "insert" | "update" = "select";
  private payload: Row = {};
  private predicates: Array<(row: Row) => boolean> = [];
  private descriptors: FilterDescriptor[] = [];
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
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const rows = Array.isArray(res.data) ? res.data : [];
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: unknown; error: unknown }> {
    const res = await this.execute();
    if (res.error) return { data: null, error: res.error };
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length !== 1) return { data: null, error: { message: "not_single" } };
    return { data: rows[0], error: null };
  }

  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
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
      const row: Row = {
        id: `run-${++this.fake.idCounter}`,
        created_at: this.fake.nowIso(),
        ...this.payload,
      };
      rows.push(row);
      this.fake.insertCalls.push({ table: this.table, payload: this.payload });
      return { data: [row], error: null };
    }

    if (this.mode === "update") {
      const matched = this.matched();
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
      rows = [...rows].sort((a, b) => {
        const left = String(a[column] ?? "");
        const right = String(b[column] ?? "");
        return ascending ? left.localeCompare(right) : right.localeCompare(left);
      });
    }
    this.fake.selectCalls.push({ table: this.table, descriptors: [...this.descriptors] });
    return { data: rows, error: this.fake.readErrors[this.table] ?? null };
  }
}

class FakeSupabaseClient {
  readonly tables: Record<string, Row[]> = {};
  readonly operations: Array<{ table: string; op: string }> = [];
  readonly insertCalls: Array<{ table: string; payload: Row }> = [];
  readonly appliedUpdates: AppliedUpdate[] = [];
  readonly selectCalls: Array<{ table: string; descriptors: FilterDescriptor[] }> = [];
  readonly readErrors: Record<string, { message: string } | undefined> = {};
  idCounter = 0;

  nowIso(): string {
    return new Date().toISOString();
  }

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

function benchUpdates(fake: FakeSupabaseClient): AppliedUpdate[] {
  return fake.appliedUpdates.filter((update) => update.table === "lab_bench_runs");
}

let fake: FakeSupabaseClient;

beforeEach(() => {
  fake = new FakeSupabaseClient();
});

// ─── Reserva em draft ────────────────────────────────────────────────────────

describe("reserveBenchRun — reserva em draft (sem ocupar o slot)", () => {
  it("cria o run em draft com operation_id/created_by e reconcilia antes do insert", async () => {
    const result = await reserveBenchRun({
      client: asClient(fake),
      operationId: OP_A,
      createdBy: ACTOR_ID,
    });

    expect(result.idempotent).toBe(false);
    expect(fake.insertCalls).toHaveLength(1);
    expect(fake.insertCalls[0].table).toBe("lab_bench_runs");
    expect(fake.insertCalls[0].payload).toEqual({
      operation_id: OP_A,
      created_by: ACTOR_ID,
      status: "draft",
    });
    // O draft não ocupa o slot: nenhuma config/snapshot é gravada na reserva.
    expect(fake.insertCalls[0].payload).not.toHaveProperty("campaign_snapshot");
    expect(fake.insertCalls[0].payload).not.toHaveProperty("config");

    // A reconciliação (select) precede o insert.
    const insertIndex = fake.operations.findIndex((op) => op.op === "insert");
    const selectIndex = fake.operations.findIndex((op) => op.op === "select");
    expect(selectIndex).toBeGreaterThanOrEqual(0);
    expect(selectIndex).toBeLessThan(insertIndex);
  });

  it("é idempotente por operation_id: reenvio devolve o existente sem novo insert", async () => {
    const first = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const second = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    expect(second.idempotent).toBe(true);
    expect(second.runId).toBe(first.runId);
    expect(fake.insertCalls).toHaveLength(1);
  });

  it("recusa operation_id ausente antes de qualquer I/O", async () => {
    await expect(
      reserveBenchRun({ client: asClient(fake), operationId: "", createdBy: ACTOR_ID }),
    ).rejects.toMatchObject({ name: "BenchRunError", code: "missing_operation_id" });
    expect(fake.insertCalls).toHaveLength(0);
    expect(fake.operations).toHaveLength(0);
  });

  it("permite múltiplos drafts coexistindo (draft fora do índice global)", async () => {
    const a = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const b = await reserveBenchRun({ client: asClient(fake), operationId: OP_B, createdBy: ACTOR_ID });

    expect(a.runId).not.toBe(b.runId);
    expect(runs(fake)).toHaveLength(2);
  });
});

// ─── Fixação da configuração em draft ────────────────────────────────────────

describe("setBenchRunInput — configuração só em draft", () => {
  it("define config/snapshot/prompt/referências enquanto draft", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    await setBenchRunInput({
      client: asClient(fake),
      runId,
      campaignSnapshot: { product: "x" },
      brandingSnapshot: { typographyDirection: "serif" },
      config: { pipeline: "manual-direto" },
      promptSent: "prompt manual",
      references: [`bench/${runId}/inputs/0.png`],
    });

    const update = benchUpdates(fake).at(-1);
    expect(update?.values).toMatchObject({
      campaign_snapshot: { product: "x" },
      branding_snapshot: { typographyDirection: "serif" },
      config: { pipeline: "manual-direto" },
      prompt_sent: "prompt manual",
      references: [`bench/${runId}/inputs/0.png`],
    });
    expect(update?.filters).toContainEqual({ column: "status", value: "draft", op: "eq" });
  });

  it("é recusada após a confirmação (draft → pending)", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    await setBenchRunInput({ client: asClient(fake), runId, campaignSnapshot: { product: "x" } });
    await confirmBenchRun({ client: asClient(fake), runId });

    await expect(
      setBenchRunInput({ client: asClient(fake), runId, campaignSnapshot: { product: "y" } }),
    ).rejects.toMatchObject({ code: "bench_run_transition_failed" });
  });

  it("recusa campaignSnapshot ausente antes de qualquer I/O", async () => {
    await expect(
      setBenchRunInput({ client: asClient(fake), runId: "run-1", campaignSnapshot: undefined }),
    ).rejects.toMatchObject({ code: "missing_snapshot" });
    expect(fake.appliedUpdates).toHaveLength(0);
  });
});

// ─── Confirmação compare-and-set ─────────────────────────────────────────────

describe("confirmBenchRun — CAS draft → pending (adquire o slot)", () => {
  it("faz draft → pending por compare-and-set", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    await confirmBenchRun({ client: asClient(fake), runId });

    expect(runById(fake, runId)?.status).toBe("pending");
    const update = benchUpdates(fake).at(-1);
    expect(update?.values.status).toBe("pending");
    expect(update?.filters).toContainEqual({ column: "status", value: "draft", op: "eq" });
    expect(update?.filters).toContainEqual({ column: "id", value: runId, op: "eq" });
  });

  it("a segunda confirmação concorrente recebe bench_run_already_active (sem chamada paga)", async () => {
    const a = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const b = await reserveBenchRun({ client: asClient(fake), operationId: OP_B, createdBy: ACTOR_ID });

    await confirmBenchRun({ client: asClient(fake), runId: a.runId });

    await expect(confirmBenchRun({ client: asClient(fake), runId: b.runId })).rejects.toMatchObject({
      name: "BenchRunError",
      code: "bench_run_already_active",
    });
    // O run perdedor permanece em draft (nenhum slot adquirido).
    expect(runById(fake, b.runId)?.status).toBe("draft");
  });

  it("recusa confirmação quando o run não está mais em draft", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    await confirmBenchRun({ client: asClient(fake), runId });

    await expect(confirmBenchRun({ client: asClient(fake), runId })).rejects.toMatchObject({
      code: "bench_run_transition_failed",
    });
  });
});

// ─── Transições ──────────────────────────────────────────────────────────────

describe("markBenchRunRunning / finalizeBenchRun", () => {
  it("markBenchRunRunning só promove quem está pending", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    // Ainda em draft: o CAS `.eq("status","pending")` não casa ⇒ transição falha.
    await expect(
      markBenchRunRunning({ client: asClient(fake), runId }),
    ).rejects.toMatchObject({ code: "bench_run_transition_failed" });

    await confirmBenchRun({ client: asClient(fake), runId });
    await markBenchRunRunning({ client: asClient(fake), runId, startedAt: "2026-09-28T10:00:00.000Z" });

    expect(runById(fake, runId)?.status).toBe("running");
    expect(runById(fake, runId)?.started_at).toBe("2026-09-28T10:00:00.000Z");
  });

  it("finalizeBenchRun não sobrescreve um estado terminal", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    await confirmBenchRun({ client: asClient(fake), runId });
    await markBenchRunRunning({ client: asClient(fake), runId });
    await finalizeBenchRun({ client: asClient(fake), runId, status: "succeeded" });

    await expect(
      finalizeBenchRun({ client: asClient(fake), runId, status: "failed", errorType: "late" }),
    ).rejects.toMatchObject({ code: "bench_run_transition_failed" });
    expect(runById(fake, runId)?.status).toBe("succeeded");
  });

  it("finalizeBenchRun com failed sobre um draft registra o erro e libera o slot global", async () => {
    const a = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    await finalizeBenchRun({
      client: asClient(fake),
      runId: a.runId,
      status: "failed",
      errorType: "artifact_persistence_failed",
    });

    expect(runById(fake, a.runId)?.status).toBe("failed");
    expect(runById(fake, a.runId)?.error_type).toBe("artifact_persistence_failed");
    const update = benchUpdates(fake).at(-1);
    expect(update?.filters).toContainEqual({
      column: "status",
      value: ["draft", "pending", "running"],
      op: "in",
    });

    // O slot está livre: uma nova geração pode ser confirmada.
    const b = await reserveBenchRun({ client: asClient(fake), operationId: OP_B, createdBy: ACTOR_ID });
    await confirmBenchRun({ client: asClient(fake), runId: b.runId });
    expect(runById(fake, b.runId)?.status).toBe("pending");
  });

  it("sanitiza a mensagem de erro antes de persistir", async () => {
    const { runId } = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    await finalizeBenchRun({
      client: asClient(fake),
      runId,
      status: "failed",
      errorType: "provider_error",
      errorMessage: "falha com Bearer sk-abc123456789 em https://api.exemplo.com/v1",
    });

    const written = runById(fake, runId)?.error_message as string;
    expect(written).not.toContain("sk-");
    expect(written).not.toContain("https://api.exemplo.com");
    expect(written).toContain("[redacted]");
  });
});

// ─── Reconciliação preguiçosa ────────────────────────────────────────────────

describe("reconcileStaleBenchRuns — gerações presas e drafts abandonados", () => {
  const NOW = new Date("2026-09-28T12:00:00.000Z");

  it("marca running e pending órfãos como failed com bench_run_orphan_timeout", async () => {
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

  it("reap drafts abandonados como bench_run_draft_abandoned sem bloquear a bancada", async () => {
    const old = new Date(NOW.getTime() - BENCH_DRAFT_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "old-draft", status: "draft", started_at: null, created_at: old },
    ];

    const result = await reconcileStaleBenchRuns({ client: asClient(fake), now: NOW });

    expect(result.draftsReaped).toBe(1);
    expect(runById(fake, "old-draft")?.status).toBe("failed");
    expect(runById(fake, "old-draft")?.error_type).toBe("bench_run_draft_abandoned");
  });

  it("é disparada no início de reserveBenchRun (libera o slot de uma geração presa)", async () => {
    const old = new Date(Date.now() - BENCH_ACTIVE_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "stuck-running", status: "running", started_at: old, created_at: old },
    ];

    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    expect(runById(fake, "stuck-running")?.status).toBe("failed");
    expect(runById(fake, "stuck-running")?.error_type).toBe("bench_run_orphan_timeout");
    expect(runById(fake, reserved.runId)?.status).toBe("draft");
  });

  it("reap draft abandonado no início da reserva e ainda assim cria a nova geração", async () => {
    const old = new Date(Date.now() - BENCH_DRAFT_STALE_MS - 60_000).toISOString();
    fake.tables.lab_bench_runs = [
      { id: "abandoned-draft", status: "draft", started_at: null, created_at: old },
    ];

    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    expect(runById(fake, "abandoned-draft")?.error_type).toBe("bench_run_draft_abandoned");
    expect(reserved.runId).not.toBe("abandoned-draft");
  });
});

// ─── Leitura ─────────────────────────────────────────────────────────────────

describe("getBenchRun / getBenchRunByOperationId", () => {
  it("getBenchRunByOperationId devolve o run existente e null quando não há", async () => {
    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });

    const found = await getBenchRunByOperationId({ client: asClient(fake), operationId: OP_A });
    expect(found?.id).toBe(reserved.runId);
    expect(found?.status).toBe("draft");

    const missing = await getBenchRunByOperationId({ client: asClient(fake), operationId: OP_C });
    expect(missing).toBeNull();
  });

  it("getBenchRun dispara a reconciliação e devolve o run", async () => {
    const reserved = await reserveBenchRun({ client: asClient(fake), operationId: OP_A, createdBy: ACTOR_ID });
    const before = fake.operations.length;

    const run = await getBenchRun({ client: asClient(fake), runId: reserved.runId });

    expect(run?.id).toBe(reserved.runId);
    // A leitura fez a reconciliação (select de status ativos/drafts) antes do select do run.
    expect(fake.operations.length).toBeGreaterThan(before);
    expect(run?.createdBy).toBe(ACTOR_ID);
  });
});

// ─── Contrato de erros ───────────────────────────────────────────────────────

describe("contrato de erros da bancada", () => {
  it("expõe BenchRunError com código determinístico", () => {
    const error = new BenchRunError("bench_run_already_active");
    expect(error.name).toBe("BenchRunError");
    expect(error.code).toBe("bench_run_already_active");
  });
});
