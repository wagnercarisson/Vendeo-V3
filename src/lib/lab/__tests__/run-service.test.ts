// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  LAB_RESERVATION_ERROR_CODES,
  LabReservationError,
  finalizeLabRun,
  isRunTerminal,
  markRunRunning,
  reconcileStaleRuns,
  reserveLabRun,
} from "../run-service";
import type { LabRunStatus } from "../run-service";
import type { LabRunSnapshot } from "../run-snapshot";

/**
 * Serviço de execução do laboratório (F48.1, D7/D8/D14) — reserva atômica,
 * transições e reconciliação de órfãos.
 *
 * Client **100% fake em memória**: nenhuma chamada de rede e nenhuma chamada
 * paga. O RPC `lab_reserve_run` é simulado com filas configuráveis.
 */

const EXPERIMENT_ID = "11111111-1111-4111-8111-111111111111";
const VARIANT_ID = "22222222-2222-4222-8222-222222222222";
const SCENARIO_ID = "33333333-3333-4333-8333-333333333333";
const RUN_ID = "44444444-4444-4444-8444-444444444444";
const OPERATION_ID = "55555555-5555-4555-8555-555555555555";
const ACTOR_ID = "66666666-6666-4666-8666-666666666666";

interface FakeResult {
  data?: unknown;
  error: { message: string } | null;
}

interface RecordedFilter {
  column: string;
  value: unknown;
  op: "eq" | "in";
}

interface RecordedUpdate {
  table: string;
  values: Record<string, unknown>;
  filters: RecordedFilter[];
}

interface RecordedSelect {
  table: string;
  columns: string;
  filters: RecordedFilter[];
}

class FakeQueryBuilder {
  private readonly filters: RecordedFilter[] = [];
  private operation: "select" | "update" | null = null;
  private payload: Record<string, unknown> = {};

  constructor(
    private readonly fake: FakeSupabaseClient,
    private readonly table: string,
  ) {}

  select(columns: string): this {
    this.operation = "select";
    this.fake.selectCalls.push({ table: this.table, columns });
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.operation = "update";
    this.payload = values;
    this.fake.updateCalls.push({ table: this.table, values });
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value, op: "eq" });
    return this;
  }

  in(column: string, value: unknown[]): this {
    this.filters.push({ column, value, op: "in" });
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolve()).then(onfulfilled, onrejected);
  }

  private matches(row: Record<string, unknown>, filter: RecordedFilter): boolean {
    if (filter.op === "eq") return row[filter.column] === filter.value;
    return (filter.value as unknown[]).includes(row[filter.column]);
  }

  private resolve(): FakeResult {
    if (this.operation === "update") {
      this.fake.appliedUpdates.push({
        table: this.table,
        values: this.payload,
        filters: this.filters,
      });
      return this.fake.updateResult;
    }

    const rows = Array.isArray(this.fake.selectRows) ? this.fake.selectRows : [];
    const filtered = rows.filter((row) => this.filters.every((filter) => this.matches(row, filter)));
    this.fake.appliedSelects.push({
      table: this.table,
      columns: this.fake.selectCalls[this.fake.selectCalls.length - 1]?.columns ?? "",
      filters: this.filters,
    });
    return { data: filtered, error: this.fake.selectError };
  }
}

class FakeSupabaseClient {
  readonly rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  readonly updateCalls: Array<{ table: string; values: Record<string, unknown> }> = [];
  readonly selectCalls: Array<{ table: string; columns: string }> = [];
  readonly appliedUpdates: RecordedUpdate[] = [];
  readonly appliedSelects: RecordedSelect[] = [];

  rpcResult: FakeResult = {
    data: { success: true, idempotent: false, run_id: RUN_ID, run_sequence: 1 },
    error: null,
  };
  updateResult: FakeResult = { data: null, error: null };
  selectResult: FakeResult = { data: [], error: null };
  selectError: { message: string } | null = null;
  selectRows: Array<Record<string, unknown>> = [];

  rpc(fn: string, args: Record<string, unknown>): Promise<FakeResult> {
    this.rpcCalls.push({ fn, args });
    return Promise.resolve(this.rpcResult);
  }

  from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this, table);
  }
}

const VALID_SNAPSHOT: LabRunSnapshot = {
  scenarioVersionId: SCENARIO_ID,
  scenarioVersion: 1,
  scenarioContentHash: "c".repeat(64),
  prompt: {
    name: "campaign-image-director-offer",
    content: "conteudo candidato",
    contentHash: "b".repeat(64),
    source: "override",
  },
  capability: "campaign_image",
  modelTarget: { provider: "openai", model: "gpt-5.5", protocol: "responses" },
  params: { size: "1024x1024", quality: "auto", skipInputValidation: true },
  changedDimension: "prompt",
  variantRole: "candidate",
  codeVersion: null,
  baselineConfig: {
    promptName: "campaign-image-director-offer",
    promptContentHash: "a".repeat(64),
    source: "official",
  },
  candidateConfig: {
    promptName: "campaign-image-director-offer",
    promptContentHash: "b".repeat(64),
    source: "override",
  },
  runType: "lab",
};

function reservationParams(client: FakeSupabaseClient) {
  return {
    client: client as unknown as SupabaseClient,
    experimentId: EXPERIMENT_ID,
    variantId: VARIANT_ID,
    scenarioVersionId: SCENARIO_ID,
    repetitionIndex: 1,
    supersedesRunId: null,
    snapshot: VALID_SNAPSHOT,
    operationId: OPERATION_ID,
    actorId: ACTOR_ID,
  };
}

let client: FakeSupabaseClient;

beforeEach(() => {
  client = new FakeSupabaseClient();
});

describe("reserveLabRun — reserva atômica antes de qualquer chamada paga", () => {
  it("chama lab_reserve_run com os 8 parâmetros p_* e snapshot não vazio", async () => {
    const result = await reserveLabRun(reservationParams(client));

    expect(client.rpcCalls).toHaveLength(1);
    const call = client.rpcCalls[0];
    expect(call.fn).toBe("lab_reserve_run");
    expect(Object.keys(call.args).sort()).toEqual(
      [
        "p_actor_id",
        "p_experiment_id",
        "p_operation_id",
        "p_repetition_index",
        "p_scenario_version_id",
        "p_snapshot",
        "p_supersedes_run_id",
        "p_variant_id",
      ].sort(),
    );
    expect(call.args.p_snapshot).toEqual(VALID_SNAPSHOT);
    expect(JSON.stringify(call.args.p_snapshot)).not.toBe("{}");
    expect(call.args.p_operation_id).toBe(OPERATION_ID);
    expect(call.args.p_actor_id).toBe(ACTOR_ID);
    expect(result).toEqual({ runId: RUN_ID, runSequence: 1, idempotent: false });
  });

  it("usa o run_sequence devolvido pela RPC, nunca um valor calculado", async () => {
    client.rpcResult = {
      data: { success: true, idempotent: false, run_id: RUN_ID, run_sequence: 7 },
      error: null,
    };

    const result = await reserveLabRun(reservationParams(client));

    expect(result.runSequence).toBe(7);
    expect(client.rpcCalls[0].args).not.toHaveProperty("p_run_sequence");
  });

  it("runSequence é null quando a RPC não devolve a sequência", async () => {
    client.rpcResult = { data: { success: true, idempotent: false, run_id: RUN_ID }, error: null };

    const result = await reserveLabRun(reservationParams(client));

    expect(result.runSequence).toBeNull();
  });

  it("reserva idempotente devolve o run existente", async () => {
    client.rpcResult = { data: { success: true, idempotent: true, run_id: RUN_ID }, error: null };

    const result = await reserveLabRun(reservationParams(client));

    expect(result).toEqual({ runId: RUN_ID, runSequence: null, idempotent: true });
  });

  it("snapshot incompleto é recusado antes de qualquer I/O", async () => {
    const params = reservationParams(client);
    params.snapshot = { ...VALID_SNAPSHOT, prompt: { ...VALID_SNAPSHOT.prompt, content: "" } };

    await expect(reserveLabRun(params)).rejects.toThrow("missing_snapshot");
    expect(client.rpcCalls).toHaveLength(0);
  });

  for (const code of LAB_RESERVATION_ERROR_CODES) {
    it(`mapeia o erro ${code} para LabReservationError`, async () => {
      client.rpcResult = { data: null, error: { message: `P0001: ${code}` } };

      await expect(reserveLabRun(reservationParams(client))).rejects.toMatchObject({
        name: "LabReservationError",
        code,
      });
    });
  }

  it("erro desconhecido vira lab_reservation_failed", async () => {
    client.rpcResult = { data: null, error: { message: "connection reset" } };

    const rejection = await reserveLabRun(reservationParams(client)).catch((err: unknown) => err);

    expect(rejection).toBeInstanceOf(LabReservationError);
    expect((rejection as LabReservationError).code).toBe("lab_reservation_failed");
  });
});

describe("markRunRunning / finalizeLabRun — transições do run", () => {
  it("markRunRunning grava status running, started_at e attempts", async () => {
    await markRunRunning({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      startedAt: "2026-09-16T10:00:00.000Z",
    });

    expect(client.updateCalls).toHaveLength(1);
    expect(client.updateCalls[0].table).toBe("lab_runs");
    expect(client.updateCalls[0].values).toMatchObject({
      status: "running",
      started_at: "2026-09-16T10:00:00.000Z",
      attempts: 1,
    });
  });

  it("finalizeLabRun grava status/finished_at e as evidências do resultado", async () => {
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "succeeded",
      latencyMs: 8123,
      usage: { totalTokens: 120 },
      estimatedCostUsd: 0.0421,
      costDetail: { estimatedCostUsd: 0.0421, costSource: "pricing_table" },
      calls: [{ capability: "campaign_image" }],
      technicalValidation: { decodable: true },
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      capability: "campaign_image",
      attempts: 1,
      finishedAt: "2026-09-16T10:00:10.000Z",
    });

    expect(client.updateCalls[0].values).toMatchObject({
      status: "succeeded",
      finished_at: "2026-09-16T10:00:10.000Z",
      latency_ms: 8123,
      estimated_cost_usd: 0.0421,
      provider: "openai",
      model: "gpt-5.5",
      protocol: "responses",
      capability: "campaign_image",
      attempts: 1,
    });
  });

  it("finalizeLabRun sanitiza a mensagem de erro antes de gravar", async () => {
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "failed",
      errorType: "provider_error",
      errorMessage: "falha com Bearer sk-abc123456789 na chamada",
    });

    const written = client.updateCalls[0].values.error_message as string;
    expect(written).not.toContain("sk-");
    expect(written).toContain("[redacted]");
  });

  it("nenhuma transição grava a coluna snapshot (imutabilidade)", async () => {
    await markRunRunning({ client: client as unknown as SupabaseClient, runId: RUN_ID });
    await finalizeLabRun({
      client: client as unknown as SupabaseClient,
      runId: RUN_ID,
      status: "failed",
      errorType: "provider_error",
      errorMessage: "erro",
    });

    for (const call of client.updateCalls) {
      expect(call.values).not.toHaveProperty("snapshot");
    }
  });

  it("isRunTerminal reconhece apenas os estados terminais", () => {
    const terminal: LabRunStatus[] = ["succeeded", "failed", "cancelled", "timeout"];
    const active: LabRunStatus[] = ["pending", "running"];

    for (const status of terminal) expect(isRunTerminal(status)).toBe(true);
    for (const status of active) expect(isRunTerminal(status)).toBe(false);
  });
});

describe("reconcileStaleRuns — runs órfãos em pending E running", () => {
  const NOW = new Date("2026-09-16T12:00:00.000Z");
  const OLD = "2026-09-16T10:00:00.000Z";
  const RECENT = "2026-09-16T11:59:00.000Z";

  it("marca pending e running antigos como failed com orphan_run_timeout", async () => {
    client.selectRows = [
      { id: "old-pending", status: "pending", started_at: null, created_at: OLD },
      { id: "old-running", status: "running", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(2);
    expect(client.appliedUpdates).toHaveLength(1);
    expect(client.appliedUpdates[0].values).toMatchObject({
      status: "failed",
      error_type: "orphan_run_timeout",
      finished_at: NOW.toISOString(),
    });
    const idFilter = client.appliedUpdates[0].filters.find((filter) => filter.column === "id");
    expect(idFilter?.value).toEqual(["old-pending", "old-running"]);
  });

  it("ignora runs recentes (dentro da janela de inatividade)", async () => {
    client.selectRows = [
      { id: "recent-pending", status: "pending", started_at: null, created_at: RECENT },
      { id: "recent-running", status: "running", started_at: RECENT, created_at: RECENT },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(0);
    expect(client.appliedUpdates).toHaveLength(0);
  });

  it("ignora runs já terminais (o filtro de status ativo os exclui)", async () => {
    client.selectRows = [
      { id: "old-succeeded", status: "succeeded", started_at: OLD, created_at: OLD },
      { id: "old-failed", status: "failed", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    expect(result.reconciled).toBe(0);
    expect(client.appliedUpdates).toHaveLength(0);
    expect(client.selectCalls[0].columns).toContain("status");
  });

  it("respeita staleMs customizado (janela maior ignora o run antigo)", async () => {
    client.selectRows = [
      { id: "old-running", status: "running", started_at: OLD, created_at: OLD },
    ];

    const result = await reconcileStaleRuns({
      client: client as unknown as SupabaseClient,
      now: NOW,
      staleMs: 3 * 60 * 60 * 1000,
    });

    expect(result.reconciled).toBe(0);
  });

  it("cobre os dois estados ativos na consulta", async () => {
    client.selectRows = [];

    await reconcileStaleRuns({ client: client as unknown as SupabaseClient, now: NOW });

    const statusFilter = client.appliedSelects[0].filters.find(
      (filter) => filter.column === "status",
    );
    expect(statusFilter?.value).toEqual(["pending", "running"]);
  });
});
