// @vitest-environment node
/**
 * F60.6 / 60.6-03 — prova OFFLINE da concorrência de abertura.
 *
 * Nenhum Postgres, Docker, `DATABASE_URL` ou rede: o "banco" é um Map com a
 * semântica contratual da RPC v2 (unicidade por `(campaign_id, operation_id)`,
 * serialização como `FOR UPDATE`/UNIQUE, uma reserva por identidade, seleção
 * divergente recusada sem sobrescrever e replay idempotente por conteúdo).
 */
import { describe, expect, it, vi } from "vitest";
import { ProductTwoStageOperationClient } from "../two-stage-operation-client";

vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

const STORE = "s";
const CAMPAIGN = "c";
const OPERATION = "o";

const SELECTION_A = {
  model: "gpt-image-2.5-flare",
  quality: "medium",
  configVersionId: "11111111-1111-4111-8111-111111111111",
  origin: "configured",
} as const;

const SELECTION_B = {
  model: "gpt-image-2.5-sunburst",
  quality: "low",
  configVersionId: "22222222-2222-4222-8222-222222222222",
  origin: "configured",
} as const;

type StoredSelection = {
  model: string;
  quality: string;
  configVersionId: string;
};

type OperationRow = {
  contract_version: 1 | 2;
  selection?: StoredSelection;
};

const STEPS = [
  { stage: "base", status: "pending", attempts_used: 0, failure_class: null },
  { stage: "expansion", status: "pending", attempts_used: 0, failure_class: null },
];

function v2Envelope(selection: StoredSelection, idempotent: boolean) {
  return {
    success: true,
    idempotent,
    status: "reserved",
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    origin: "9_16_two_stage",
    steps: STEPS,
    contract_version: 2,
    expansion_model: selection.model,
    expansion_quality: selection.quality,
    expansion_config_version_id: selection.configVersionId,
    expansion_selection_origin: "configured",
  };
}

/** Envelope v1 REAL: sem `contract_version` e sem colunas `expansion_*`. */
function v1Envelope(idempotent: boolean) {
  return {
    success: true,
    idempotent,
    status: "reserved",
    campaign_id: CAMPAIGN,
    operation_id: OPERATION,
    origin: "9_16_two_stage",
    steps: STEPS,
  };
}

function selectionOf(params: Record<string, unknown>): StoredSelection {
  return {
    model: String(params.p_expansion_model),
    quality: String(params.p_expansion_quality),
    configVersionId: String(params.p_expansion_config_version_id),
  };
}

function sameSelection(a: StoredSelection, b: StoredSelection): boolean {
  return (
    a.model === b.model &&
    a.quality === b.quality &&
    a.configVersionId === b.configVersionId
  );
}

function createStatefulRpc(seed?: { contractVersion: 1 | 2 }) {
  const rows = new Map<string, OperationRow>();
  if (seed !== undefined) {
    rows.set(`${CAMPAIGN}:${OPERATION}`, {
      contract_version: seed.contractVersion,
      ...(seed.contractVersion === 2 ? { selection: { ...SELECTION_A } } : {}),
    });
  }

  const counters = {
    reservations: 0,
    selectionWrites: 0,
    openV2Calls: 0,
    openV1Calls: 0,
  };
  const started: string[] = [];

  // Serializa as "transações" como o banco faria com UNIQUE + FOR UPDATE.
  let tail: Promise<unknown> = Promise.resolve();
  function withLock<T>(work: () => T): Promise<T> {
    const run = tail.then(work, work);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  function openV2(params: Record<string, unknown>) {
    counters.openV2Calls += 1;
    const key = `${CAMPAIGN}:${OPERATION}`;
    const incoming = selectionOf(params);
    const existing = rows.get(key);
    if (existing) {
      if (existing.contract_version !== 2 || existing.selection === undefined) {
        return { success: false, reason: "operation_origin_conflict" };
      }
      if (!sameSelection(existing.selection, incoming)) {
        // Nunca sobrescreve a vencedora nem cria segunda reserva.
        return { success: false, reason: "operation_config_conflict" };
      }
      return v2Envelope(existing.selection, true);
    }
    // Linha nova: seleção + reserva na MESMA transação.
    rows.set(key, { contract_version: 2, selection: incoming });
    counters.selectionWrites += 1;
    counters.reservations += 1;
    return v2Envelope(incoming, false);
  }

  function openV1() {
    counters.openV1Calls += 1;
    const key = `${CAMPAIGN}:${OPERATION}`;
    const existing = rows.get(key);
    if (existing) {
      if (existing.contract_version !== 1) {
        return { success: false, reason: "operation_origin_conflict" };
      }
      return v1Envelope(true);
    }
    rows.set(key, { contract_version: 1 });
    counters.reservations += 1;
    return v1Envelope(false);
  }

  const client = {
    rpc: async (name: string, params: Record<string, unknown>) => {
      started.push(name);
      // Uma volta de microtask garante que ambas as aberturas concorrentes
      // entram em voo antes de qualquer processamento.
      await Promise.resolve();
      const data = await withLock(() => {
        if (name === "product_9_16_open_operation_v2") return openV2(params);
        if (name === "product_9_16_open_operation") return openV1();
        throw new Error(`unexpected_rpc:${name}`);
      });
      return { data, error: null };
    },
  } as never;

  return {
    client,
    rows,
    counters,
    started,
    storedSelection: () => rows.get(`${CAMPAIGN}:${OPERATION}`),
  };
}

const openInput = {
  storeId: STORE,
  campaignId: CAMPAIGN,
  operationId: OPERATION,
};

describe("concorrência da abertura (offline, sem Postgres)", () => {
  it("duas aberturas concorrentes com a MESMA seleção convergem em uma reserva/operação/seleção", async () => {
    const world = createStatefulRpc();
    const client = new ProductTwoStageOperationClient(world.client);

    const results = await Promise.all([
      client.open({ ...openInput, selection: SELECTION_A }),
      client.open({ ...openInput, selection: SELECTION_A }),
    ]);

    expect(results.every((result) => result.success)).toBe(true);
    const idempotent = results.map((result) =>
      result.success ? result.idempotent : null,
    );
    expect(idempotent.filter((value) => value === false)).toHaveLength(1);
    expect(idempotent.filter((value) => value === true)).toHaveLength(1);

    expect(world.rows.size).toBe(1);
    expect(world.counters.reservations).toBe(1);
    expect(world.counters.selectionWrites).toBe(1);
    expect(world.storedSelection()).toEqual({
      contract_version: 2,
      selection: {
        model: SELECTION_A.model,
        quality: SELECTION_A.quality,
        configVersionId: SELECTION_A.configVersionId,
      },
    });
    expect(world.started).toEqual([
      "product_9_16_open_operation_v2",
      "product_9_16_open_operation_v2",
    ]);
  });

  it("seleções divergentes: uma vence, a outra é operation_config_conflict sem sobrescrita", async () => {
    const world = createStatefulRpc();
    const client = new ProductTwoStageOperationClient(world.client);

    const results = await Promise.all([
      client.open({ ...openInput, selection: SELECTION_A }),
      client.open({ ...openInput, selection: SELECTION_B }),
    ]);

    const successes = results.filter((result) => result.success);
    const failures = results.filter((result) => !result.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toEqual({
      success: false,
      reason: "operation_config_conflict",
    });

    // A linha mantém exatamente a seleção vencedora e um único efeito financeiro.
    const winnerIndex = results.findIndex((result) => result.success);
    const winner = winnerIndex === 0 ? SELECTION_A : SELECTION_B;
    expect(world.rows.size).toBe(1);
    expect(world.counters.reservations).toBe(1);
    expect(world.counters.selectionWrites).toBe(1);
    expect(world.storedSelection()).toEqual({
      contract_version: 2,
      selection: {
        model: winner.model,
        quality: winner.quality,
        configVersionId: winner.configVersionId,
      },
    });
  });

  it("mesmo ID e mesmo conteúdo é replay idempotente, sem nova reserva", async () => {
    const world = createStatefulRpc();
    const client = new ProductTwoStageOperationClient(world.client);

    const first = await client.open({ ...openInput, selection: SELECTION_A });
    const second = await client.open({ ...openInput, selection: SELECTION_A });

    expect(first).toMatchObject({ success: true, idempotent: false });
    expect(second).toMatchObject({ success: true, idempotent: true });
    expect(world.counters.reservations).toBe(1);
    expect(world.counters.selectionWrites).toBe(1);
  });

  it("operação v1 existente + tentativa v2 é operation_origin_conflict sem sobrescrever", async () => {
    const world = createStatefulRpc({ contractVersion: 1 });
    const client = new ProductTwoStageOperationClient(world.client);

    const result = await client.open({ ...openInput, selection: SELECTION_A });

    expect(result).toEqual({
      success: false,
      reason: "operation_origin_conflict",
    });
    expect(world.counters.reservations).toBe(0);
    expect(world.counters.selectionWrites).toBe(0);
    expect(world.storedSelection()).toEqual({ contract_version: 1 });
  });

  it("a RPC v1 REAL continua aceita (envelope sem contract_version)", async () => {
    const world = createStatefulRpc();
    const client = new ProductTwoStageOperationClient(world.client);

    const created = await client.open(openInput);
    const replay = await client.open(openInput);

    expect(created).toMatchObject({ success: true, contractVersion: 1 });
    expect(replay).toMatchObject({ success: true, contractVersion: 1, idempotent: true });
    expect(world.counters.openV1Calls).toBe(2);
    expect(world.counters.reservations).toBe(1);
    expect(world.counters.selectionWrites).toBe(0);
  });
});
