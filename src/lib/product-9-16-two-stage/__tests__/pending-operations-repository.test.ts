import { describe, expect, it, vi } from "vitest";
import {
  FormatUnavailableError,
  SupabasePendingOperationsRepository,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import type { ArtifactProbe } from "@/lib/product-1-1/artifact/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

type Row = Record<string, unknown>;

function chain(rows: Row[], error: { code?: string; message: string } | null = null) {
  let data = rows;
  const api = {
    select: () => api,
    eq: (column: string, value: unknown) => {
      data = data.filter((row) => row[column] === value);
      return api;
    },
    in: (column: string, values: unknown[]) => {
      data = data.filter((row) => values.includes(row[column]));
      return api;
    },
    order: () => api,
    maybeSingle: async () => ({ data: error ? null : (data[0] ?? null), error }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data: error ? null : data, error }).then(resolve, reject),
  };
  return api;
}

function clientFrom(
  tables: Record<string, Row[]>,
  errors: Record<string, { code?: string; message: string }> = {},
) {
  return {
    from: (table: string) => chain(tables[table] ?? [], errors[table] ?? null),
  } as never;
}

const integral: ArtifactProbe = {
  kind: "integral",
  ref: { storagePath: "p", width: 1024, height: 1024, mimeType: "image/jpeg" },
  width: 1024,
  height: 1024,
  mimeType: "image/jpeg",
  storagePath: "p",
};

const canonical = {
  "product_9_16_two_stage_operations": [{ campaign_id: "c", operation_id: "o" }],
  "product_9_16_two_stage_steps": [
    { campaign_id: "c", operation_id: "o", stage: "base", status: "in_progress", attempts_used: 1, updated_at: "2026-01-01T00:00:00Z" },
  ],
};

describe("sonda de arte por origem canônica", () => {
  it("origem nova SEM sonda de composicao falha fechado e nunca usa a sonda quadrada/direta", async () => {
    const square = { probeArtifact: vi.fn(async () => integral) };
    const direct = { probeArtifact: vi.fn(async () => integral) };
    const repository = new SupabasePendingOperationsRepository(
      clientFrom(canonical),
      square,
      { verticalArtifacts: direct },
    );

    await expect(repository.probeArtifact("s", "c", "o")).rejects.toBeInstanceOf(
      FormatUnavailableError,
    );
    expect(square.probeArtifact).not.toHaveBeenCalled();
    expect(direct.probeArtifact).not.toHaveBeenCalled();
  });

  it("origem nova usa SOMENTE a sonda de composicao", async () => {
    const square = { probeArtifact: vi.fn(async () => integral) };
    const direct = { probeArtifact: vi.fn(async () => integral) };
    const composition = { probeArtifact: vi.fn(async () => integral) };
    const repository = new SupabasePendingOperationsRepository(
      clientFrom(canonical),
      square,
      { verticalArtifacts: direct, twoStageArtifacts: composition },
    );

    await expect(repository.probeArtifact("s", "c", "o")).resolves.toBe(integral);
    expect(composition.probeArtifact).toHaveBeenCalledWith({
      storeId: "s",
      campaignId: "c",
      operationId: "o",
    });
    expect(square.probeArtifact).not.toHaveBeenCalled();
    expect(direct.probeArtifact).not.toHaveBeenCalled();
  });

  it("exclui adições verticais da fila de pendências 1:1", async () => {
    const prober = { probeArtifact: vi.fn(async () => integral) };
    const repository = new SupabasePendingOperationsRepository(
      clientFrom({
        product_1_1_campaign_credit_operations: [
          {
            campaign_id: "c",
            operation_id: "addition",
            store_id: "s",
            amount: 1,
            status: "reserved",
            state_epoch: 1,
            publication_state: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
          {
            campaign_id: "c",
            operation_id: "normal",
            store_id: "s",
            amount: 1,
            status: "reserved",
            state_epoch: 1,
            publication_state: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        campaign_format_additions: [{ operation_id: "addition" }],
      }),
      prober,
    );

    const result = await repository.listPendingOperations();
    expect(result.map((item) => item.operationId)).toEqual(["normal"]);
  });

  it("resolução direta também exclui a adição antes de probe/RPC", async () => {
    const prober = { probeArtifact: vi.fn(async () => integral) };
    const repository = new SupabasePendingOperationsRepository(
      clientFrom({
        product_1_1_campaign_credit_operations: [
          {
            campaign_id: "c",
            operation_id: "addition",
            store_id: "s",
            amount: 1,
            status: "reserved",
            state_epoch: 1,
            publication_state: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-01T00:00:00Z",
          },
        ],
        campaign_format_additions: [{ operation_id: "addition" }],
      }),
      prober,
    );

    await expect(
      repository.findPendingOperation("c", "addition"),
    ).resolves.toBeNull();
    expect(prober.probeArtifact).not.toHaveBeenCalled();
  });

  it("erro indeterminado da classificação bloqueia a consulta", async () => {
    const repository = new SupabasePendingOperationsRepository(
      clientFrom(
        {
          product_1_1_campaign_credit_operations: [
            {
              campaign_id: "c",
              operation_id: "op",
              store_id: "s",
              amount: 1,
              status: "reserved",
              state_epoch: 1,
              publication_state: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
        {
          campaign_format_additions: { message: "permission denied" },
        },
      ),
      { probeArtifact: vi.fn(async () => integral) },
    );

    await expect(
      repository.findPendingOperation("c", "op"),
    ).rejects.toThrow(/addition_classification_failed/);
    await expect(repository.listPendingOperations()).rejects.toThrow(
      /addition_classification_failed/,
    );
  });

  it("tabela comprovadamente ausente preserva operações normais", async () => {
    const prober = { probeArtifact: vi.fn(async () => integral) };
    const repository = new SupabasePendingOperationsRepository(
      clientFrom(
        {
          product_1_1_campaign_credit_operations: [
            {
              campaign_id: "c",
              operation_id: "normal",
              store_id: "s",
              amount: 1,
              status: "reserved",
              state_epoch: 1,
              publication_state: null,
              created_at: "2026-01-01T00:00:00Z",
              updated_at: "2026-01-01T00:00:00Z",
            },
          ],
        },
        {
          campaign_format_additions: {
            code: "42P01",
            message: 'relation "campaign_format_additions" does not exist',
          },
        },
      ),
      prober,
    );

    await expect(
      repository.findPendingOperation("c", "normal"),
    ).resolves.toMatchObject({ operationId: "normal" });
    const list = await repository.listPendingOperations();
    expect(list.map((item) => item.operationId)).toEqual(["normal"]);
  });

  it("origem legada preserva a sonda por formato (1:1 e 9:16 direto)", async () => {
    const square = { probeArtifact: vi.fn(async () => integral) };
    const vertical = { probeArtifact: vi.fn(async () => integral) };

    const legacy11 = new SupabasePendingOperationsRepository(
      clientFrom({}),
      square,
      { resolveFormat: async () => ({ kind: "1:1" }), verticalArtifacts: vertical },
    );
    await expect(legacy11.probeArtifact("s", "c", "o")).resolves.toBe(integral);
    expect(square.probeArtifact).toHaveBeenCalledTimes(1);
    expect(vertical.probeArtifact).not.toHaveBeenCalled();

    const legacy916 = new SupabasePendingOperationsRepository(
      clientFrom({}),
      square,
      { resolveFormat: async () => ({ kind: "9:16" }), verticalArtifacts: vertical },
    );
    await expect(legacy916.probeArtifact("s", "c", "o")).resolves.toBe(integral);
    expect(vertical.probeArtifact).toHaveBeenCalledTimes(1);
  });
});
