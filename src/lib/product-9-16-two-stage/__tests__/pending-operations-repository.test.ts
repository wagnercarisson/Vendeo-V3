import { describe, expect, it, vi } from "vitest";
import {
  FormatUnavailableError,
  SupabasePendingOperationsRepository,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import type { ArtifactProbe } from "@/lib/product-1-1/artifact/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

type Row = Record<string, unknown>;

function chain(rows: Row[]) {
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
    maybeSingle: async () => ({ data: data[0] ?? null, error: null }),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve({ data, error: null }).then(resolve, reject),
  };
  return api;
}

function clientFrom(tables: Record<string, Row[]>) {
  return { from: (table: string) => chain(tables[table] ?? []) } as never;
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
