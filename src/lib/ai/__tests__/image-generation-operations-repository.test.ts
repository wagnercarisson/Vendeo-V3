import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  SupabaseImageGenerationOperationsRepository,
  type ImageGenerationOperation,
  type RecordImageGenerationOperationInput,
} from "../image-generation-operations-repository";

const OPERATION_ID = "11111111-1111-4111-8111-111111111111";
const CAMPAIGN_ID = "22222222-2222-4222-8222-222222222222";
const SNAPSHOT_ID = "33333333-3333-4333-8333-333333333333";

function operationInput(
  overrides: Partial<RecordImageGenerationOperationInput> = {},
): RecordImageGenerationOperationInput {
  return {
    campaignId: CAMPAIGN_ID,
    snapshotOriginalId: SNAPSHOT_ID,
    operationId: OPERATION_ID,
    attemptNumber: 1,
    target: "primary",
    model: "gpt-image-2.5-sunburst",
    quality: "medium",
    runId: "44444444-4444-4444-8444-444444444444",
    traceId: "trace-attempt-1",
    ...overrides,
  };
}

function createMemoryClient() {
  const rows: ImageGenerationOperation[] = [];
  const insertCalls: Record<string, unknown>[] = [];
  const selectFilters: Record<string, string>[] = [];
  const orderCalls: Array<{ column: string; ascending: boolean }> = [];
  let nextId = 1;

  const client = {
    from: vi.fn((table: string) => {
      if (table !== "image_generation_operations") {
        throw new Error(`unexpected_table:${table}`);
      }

      return {
        insert: vi.fn((values: Record<string, unknown>) => {
          insertCalls.push(values);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const id = `operation-row-${nextId++}`;
                const row: ImageGenerationOperation = {
                  id,
                  campaignId: String(values.campaign_id),
                  snapshotOriginalId: String(values.snapshot_original_id),
                  operationId: String(values.operation_id),
                  attemptNumber: Number(values.attempt_number),
                  target: values.target as ImageGenerationOperation["target"],
                  model: String(values.model),
                  quality: values.quality as ImageGenerationOperation["quality"],
                  ...(values.run_id ? { runId: String(values.run_id) } : {}),
                  ...(values.trace_id ? { traceId: String(values.trace_id) } : {}),
                  createdAt: `2026-10-07T00:00:0${nextId - 1}.000Z`,
                };
                rows.push(row);
                return { data: { id, operation_id: row.operationId }, error: null };
              }),
            })),
          };
        }),
        select: vi.fn(() => {
          const filters: Record<string, string> = {};
          selectFilters.push(filters);
          const query = {
            eq(column: string, value: string) {
              filters[column] = value;
              return query;
            },
            order(column: string, options: { ascending: boolean }) {
              orderCalls.push({ column, ascending: options.ascending });
              return query;
            },
            async returns<T>() {
              const filtered = rows
                .filter((row) => row.campaignId === filters.campaign_id)
                .filter((row) => row.operationId === filters.operation_id)
                .sort((a, b) =>
                  orderCalls.at(-1)?.ascending
                    ? a.attemptNumber - b.attemptNumber
                    : b.attemptNumber - a.attemptNumber,
                );
              return {
                data: filtered.map((row) => ({
                  id: row.id,
                  campaign_id: row.campaignId,
                  snapshot_original_id: row.snapshotOriginalId,
                  operation_id: row.operationId,
                  attempt_number: row.attemptNumber,
                  target: row.target,
                  model: row.model,
                  quality: row.quality,
                  run_id: row.runId ?? null,
                  trace_id: row.traceId ?? null,
                  created_at: row.createdAt,
                })) as T,
                error: null,
              };
            },
          };
          return query;
        }),
      };
    }),
  } as unknown as SupabaseClient;

  return { client, rows, insertCalls, selectFilters, orderCalls };
}

describe("image-generation-operations-repository — append-only", () => {
  it("acrescenta duas tentativas sem reescrever o registro anterior", async () => {
    const memory = createMemoryClient();
    const repository = new SupabaseImageGenerationOperationsRepository(memory.client);

    const first = await repository.recordOperation(operationInput());
    const firstSaved = { ...memory.rows[0] };
    const second = await repository.recordOperation(
      operationInput({
        attemptNumber: 2,
        target: "fallback",
        model: "gpt-image-2",
        runId: "55555555-5555-4555-8555-555555555555",
        traceId: "trace-attempt-2",
      }),
    );

    expect(first).toEqual({ id: "operation-row-1", operationId: OPERATION_ID });
    expect(second).toEqual({ id: "operation-row-2", operationId: OPERATION_ID });
    expect(memory.rows).toHaveLength(2);
    expect(memory.rows[0]).toEqual(firstSaved);
    expect(memory.insertCalls).toHaveLength(2);
    expect(memory.insertCalls[0]).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      snapshot_original_id: SNAPSHOT_ID,
      operation_id: OPERATION_ID,
      attempt_number: 1,
      target: "primary",
      model: "gpt-image-2.5-sunburst",
      quality: "medium",
    });
  });

  it("mapeia snake_case para camelCase e mantém alvo e par modelo–qualidade", async () => {
    const memory = createMemoryClient();
    const repository = new SupabaseImageGenerationOperationsRepository(memory.client);

    await repository.recordOperation(operationInput({
      attemptNumber: 2,
      target: "fallback",
      model: "gpt-image-2",
      quality: "low",
    }));

    await expect(
      repository.listByOperationId({ campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    ).resolves.toEqual([
      expect.objectContaining({
        campaignId: CAMPAIGN_ID,
        snapshotOriginalId: SNAPSHOT_ID,
        operationId: OPERATION_ID,
        attemptNumber: 2,
        target: "fallback",
        model: "gpt-image-2",
        quality: "low",
        runId: "44444444-4444-4444-8444-444444444444",
        traceId: "trace-attempt-1",
      }),
    ]);
  });

  it("filtra simultaneamente por campanha/operação e ordena por attempt_number", async () => {
    const memory = createMemoryClient();
    const repository = new SupabaseImageGenerationOperationsRepository(memory.client);

    await repository.recordOperation(operationInput({ attemptNumber: 2, target: "fallback" }));
    await repository.recordOperation(operationInput({ attemptNumber: 1 }));
    await repository.recordOperation(
      operationInput({ campaignId: "66666666-6666-4666-8666-666666666666" }),
    );
    await repository.recordOperation(
      operationInput({ operationId: "77777777-7777-4777-8777-777777777777" }),
    );

    const attempts = await repository.listByOperationId({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
    });

    expect(attempts.map((attempt) => attempt.attemptNumber)).toEqual([1, 2]);
    expect(memory.selectFilters[0]).toEqual({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
    });
    expect(memory.orderCalls).toEqual([{ column: "attempt_number", ascending: true }]);
  });
});
