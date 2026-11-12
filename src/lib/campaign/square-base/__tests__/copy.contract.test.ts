// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));
vi.mock("@/lib/launch-config/config", () => ({
  getLaunchConfig: () => ({ copyDirectorEnabled: true }),
}));
// O caminho real da copy importa `defaultAiGateway` de `@/lib/ai` (gateway
// padrão). Aqui o invoker é SEMPRE injetado explicitamente no runner; o mock
// evita construir o gateway/resolver persistido no ambiente de teste.
vi.mock("@/lib/ai", () => ({
  defaultAiGateway: {
    invoke: vi.fn(),
    hasFallback: vi.fn(async () => false),
  },
  // Usado pelo CopyDirectorService do runner real; em teste não há onCall.
  withOnCallTelemetry: (telemetry: unknown) => telemetry,
}));

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import type {
  AiTelemetryContext,
  AiInvocationResult,
} from "@/lib/ai/types";
import {
  createDefaultProductOneToOneCopyOps,
  type DefaultProductOneToOneCopyRunnerInput,
} from "@/lib/product-1-1/copy/default-copy-runner";

import {
  copyOutcomeFromAcquisition,
  runSquareBaseCopy,
  type RunSquareBaseCopyInput,
  type SquareBaseCopyDeps,
  type SquareBaseCopyOpsFactory,
} from "../copy";
import type { CopyOutcome, FrozenContentPayload } from "../types";

/**
 * F60.4 — contrato da copy da base quadrada.
 *
 * Sem rede, sem Supabase, sem provider: a aquisição e o dreno rodam contra um
 * client EM MEMÓRIA que espelha as RPCs de estado da copy, e o provider é um
 * invoker SIMULADO com contador. O runner produtivo (`createDefaultProduct...`)
 * permanece REAL nos casos de uma-requisição; a fábrica é injetada apenas para
 * capturar o input entregue ao runner.
 */

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const TOKEN_A = "3b0f6c1a-7d2e-4a1b-9c3f-5e8d2b1a0c4f";
const NOW = 1_780_000_000_000;
const iso = (ms: number): string => new Date(ms).toISOString();

const COPY_JSON = JSON.stringify({
  title: "Oferta Especial",
  caption: "Legenda do provider",
  hashtags: ["#oferta"],
  cta_post: "Aproveite!",
});

const FROZEN: FrozenContentPayload = {
  briefing: {
    backgroundDirection: "studio",
    product: { name: "Café Especial", description: "Grãos selecionados" },
    commercial: {
      intent: "offer",
      originalPriceText: "R$ 40,00",
      discountedPriceText: "R$ 30,00",
      badge: "Oferta",
      validity: "hoje",
    },
    constraints: { mandatoryArtworkText: null },
  },
  copyContext: {
    storeName: "Loja Congelada",
    segment: "alimentacao",
    toneOfVoice: "amigavel",
    badgeText: "Oferta",
    originalPriceCents: 4000,
    discountedPriceCents: 3000,
  },
  identityDirective: null,
  campaignIntent: "offer",
  backgroundDirection: "studio",
  referenceSelections: [],
  promptBaseVersion: "base-v1",
  composerVersion: "composer-v1",
  policyVersions: { intencao: "v1" },
};

const NOOP_TELEMETRY: AiTelemetryContext = {
  operationRunId: OPERATION_ID,
  operationRunType: "campaign_delivery",
  traceId: "trace-1",
  storeId: STORE_ID,
  campaignId: CAMPAIGN_ID,
  sink: { emit: async () => {} },
};

// ---------------------------------------------------------------------------
// DB em memória — espelha `product_1_1_apply_copy_state` / `product_1_1_cancel_copy`.
// ---------------------------------------------------------------------------

type CopyStateValue = "pending" | "completed" | "failed";

interface AttemptRow {
  campaign_id: string;
  operation_id: string;
  attempt_seq: number;
  attempt_token: string | null;
  state: CopyStateValue;
  copy_text: string | null;
  copy_payload: Record<string, unknown> | null;
  lease_at: string | null;
  request_token: string | null;
  updated_at: string;
  created_at: string;
}

type Envelope = { applied: boolean; outcome: string; state: CopyStateValue | null };
type CancelEnvelope = {
  applied: boolean;
  state: CopyStateValue | null;
  canceled: boolean;
  outcome?: string;
};

interface PersistedContent {
  copyText: string | null;
  copyPayload: Record<string, unknown> | null;
}

class CopyAttemptDb {
  private readonly map = new Map<string, AttemptRow>();
  cancellations = 0;
  readThrows = false;
  /** Transforma o conteúdo ANTES de persistir (prova da leitura pós-dreno). */
  persistTransform: ((content: PersistedContent) => PersistedContent) | null = null;

  private key(campaignId: string, operationId: string, seq: number): string {
    return `${campaignId}:${operationId}:${seq}`;
  }

  seed(row: Partial<AttemptRow> & { attempt_seq: number; state: CopyStateValue }): void {
    const full: AttemptRow = {
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      attempt_token: TOKEN_A,
      copy_text: null,
      copy_payload: null,
      lease_at: null,
      request_token: null,
      updated_at: iso(NOW),
      created_at: iso(NOW),
      ...row,
    };
    this.map.set(this.key(full.campaign_id, full.operation_id, full.attempt_seq), full);
  }

  rowsArray(): AttemptRow[] {
    return [...this.map.values()];
  }

  applyRpc(params: Record<string, unknown>): Envelope {
    const campaignId = String(params.p_campaign_id);
    const operationId = String(params.p_operation_id);
    const state = params.p_state as CopyStateValue;
    const attemptSeq = params.p_attempt_seq as number;
    const attemptToken = params.p_attempt_token as string;
    let copyText = (params.p_copy_text as string | null) ?? null;
    let copyPayload = (params.p_copy_payload as Record<string, unknown> | null) ?? null;

    if (state === "completed" && (copyText === null || copyText.trim() === "")) {
      return { applied: false, outcome: "invalid_content", state: null };
    }
    if (state === "completed" && this.persistTransform) {
      const transformed = this.persistTransform({ copyText, copyPayload });
      copyText = transformed.copyText;
      copyPayload = transformed.copyPayload;
    }

    const keys = [...this.map.keys()]
      .filter((k) => k.startsWith(`${campaignId}:${operationId}:`))
      .map((k) => Number(k.split(":")[2]))
      .sort((a, b) => a - b);
    const maxSeq = keys.length > 0 ? keys[keys.length - 1] : 0;
    const maxRow =
      maxSeq > 0 ? (this.map.get(this.key(campaignId, operationId, maxSeq)) ?? null) : null;

    if (attemptSeq < maxSeq) {
      return { applied: false, outcome: "stale_attempt", state: maxRow ? maxRow.state : null };
    }

    const completedExists = this.rowsArray().some(
      (r) =>
        r.campaign_id === campaignId &&
        r.operation_id === operationId &&
        r.state === "completed",
    );
    if (completedExists && !(maxRow && maxRow.state === "completed" && attemptSeq === maxSeq)) {
      return { applied: false, outcome: "rejected", state: "completed" };
    }

    const existing = this.map.get(this.key(campaignId, operationId, attemptSeq)) ?? null;
    if (existing === null) {
      const stamp = iso(NOW);
      this.map.set(this.key(campaignId, operationId, attemptSeq), {
        campaign_id: campaignId,
        operation_id: operationId,
        attempt_seq: attemptSeq,
        attempt_token: attemptToken,
        state,
        copy_text: copyText,
        copy_payload: copyPayload,
        lease_at: state === "pending" ? stamp : null,
        request_token: null,
        updated_at: stamp,
        created_at: stamp,
      });
      return { applied: true, outcome: "applied", state };
    }

    if (existing.attempt_token !== attemptToken) {
      return { applied: false, outcome: "conflict", state: existing.state };
    }

    const terminal = existing.state === "completed" || existing.state === "failed";
    if (terminal) {
      if (existing.state === state) {
        const equivalent =
          (existing.copy_text ?? null) === copyText &&
          JSON.stringify(existing.copy_payload ?? null) === JSON.stringify(copyPayload);
        return equivalent
          ? { applied: false, outcome: "idempotent", state: existing.state }
          : { applied: false, outcome: "conflict", state: existing.state };
      }
      return { applied: false, outcome: "rejected", state: existing.state };
    }
    if (existing.state === state) {
      return { applied: false, outcome: "idempotent", state: existing.state };
    }
    this.map.set(this.key(campaignId, operationId, attemptSeq), {
      ...existing,
      state,
      copy_text: copyText,
      copy_payload: copyPayload,
      updated_at: iso(NOW + 1),
    });
    return { applied: true, outcome: "applied", state };
  }

  cancelRpc(params: Record<string, unknown>): CancelEnvelope {
    const apply = this.applyRpc({ ...params, p_state: "failed", p_copy_text: null });
    if (apply.outcome === "stale_attempt") {
      return { applied: false, state: apply.state, canceled: false, outcome: "stale_attempt" };
    }
    if (apply.outcome === "applied" || apply.outcome === "idempotent") {
      this.cancellations += 1;
      return { applied: apply.applied, state: "failed", canceled: true, outcome: apply.outcome };
    }
    return { applied: false, state: apply.state, canceled: false, outcome: apply.outcome };
  }
}

function makeClient(
  db: CopyAttemptDb,
  acquireResponder?: (params: Record<string, unknown>) => unknown,
): { client: SupabaseClient; rpcNames: string[] } {
  const rpcNames: string[] = [];

  const makeQueryChain = () => {
    const filters: Record<string, unknown> = {};
    let desc = false;
    let lim: number | undefined;
    const chain: Record<string, unknown> = {
      eq(col: string, val: unknown) {
        filters[col] = val;
        return chain;
      },
      order(_col: string, opts?: { ascending?: boolean }) {
        desc = opts ? opts.ascending === false : false;
        return chain;
      },
      limit(n: number) {
        lim = n;
        return chain;
      },
      maybeSingle() {
        if (db.readThrows) return Promise.reject(new Error("copy_read_failure"));
        return Promise.resolve({ data: pick()[0] ?? null, error: null });
      },
      then(onFulfilled?: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        if (db.readThrows) {
          return Promise.reject(new Error("copy_read_failure")).then(onFulfilled, onRejected);
        }
        return Promise.resolve({ data: pick(), error: null }).then(onFulfilled, onRejected);
      },
    };
    function pick(): AttemptRow[] {
      const rows = db
        .rowsArray()
        .filter(
          (r) =>
            r.campaign_id === filters.campaign_id && r.operation_id === filters.operation_id,
        );
      rows.sort((a, b) => (desc ? b.attempt_seq - a.attempt_seq : a.attempt_seq - b.attempt_seq));
      return typeof lim === "number" ? rows.slice(0, lim) : rows;
    }
    return chain;
  };

  const client = {
    from() {
      return {
        select() {
          return makeQueryChain();
        },
      };
    },
    rpc(name: string, params: Record<string, unknown>) {
      rpcNames.push(name);
      if (name === "product_1_1_acquire_copy_attempt") {
        const data = acquireResponder
          ? acquireResponder(params)
          : {
              acquired: true,
              attempt_seq: 1,
              attempt_token: TOKEN_A,
              mode: params.p_mode,
            };
        return Promise.resolve({ data, error: null });
      }
      if (name === "product_1_1_apply_copy_state") {
        return Promise.resolve({ data: db.applyRpc(params), error: null });
      }
      if (name === "product_1_1_cancel_copy") {
        return Promise.resolve({ data: db.cancelRpc(params), error: null });
      }
      return Promise.resolve({ data: null, error: { message: `unknown rpc ${name}` } });
    },
  } as unknown as SupabaseClient;

  return { client, rpcNames };
}

// ---------------------------------------------------------------------------
// Invoker simulado com contador de requisições ao provider.
// ---------------------------------------------------------------------------

interface CountingInvokerResult {
  readonly invoker: AiInvoker;
  readonly callCount: () => number;
}

function makeCountingInvoker(
  impl?: (request: { prompt: string }) => Promise<AiInvocationResult>,
): CountingInvokerResult {
  let count = 0;
  const invoker: AiInvoker = {
    invoke: async (_capability, request) => {
      count += 1;
      if (impl) return impl(request);
      return { content: COPY_JSON, model: "gpt-4o" };
    },
    hasFallback: async () => false,
  };
  return { invoker, callCount: () => count };
}

/** Fábrica que usa o runner REAL, mas com telemetria no-op (offline). */
const realOpsFactory: SquareBaseCopyOpsFactory = (input, deps) =>
  createDefaultProductOneToOneCopyOps(input, {
    ...deps,
    createTelemetry: () => NOOP_TELEMETRY,
  });

function inputFor(overrides: Partial<RunSquareBaseCopyInput> = {}): RunSquareBaseCopyInput {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    frozen: FROZEN,
    deadlineAtMs: NOW + 120_000,
    usdBrlRateAtGeneration: 5.5,
    creditValueBrlAtGeneration: 1.25,
    traceId: "trace-1",
    ...overrides,
  };
}

function depsFor(
  client: SupabaseClient,
  invoker: AiInvoker,
  overrides: Partial<SquareBaseCopyDeps> = {},
): SquareBaseCopyDeps {
  return {
    client,
    invoker,
    now: () => NOW,
    copyOps: realOpsFactory,
    ...overrides,
  };
}

let db: CopyAttemptDb;

beforeEach(() => {
  db = new CopyAttemptDb();
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Task 1 — comportamento
// ---------------------------------------------------------------------------

describe("runSquareBaseCopy — conteúdo congelado e desfechos próprios", () => {
  it("sem copyContext congelado devolve not_requested e não adquire nem drena", async () => {
    const { client, rpcNames } = makeClient(db);
    const { invoker, callCount } = makeCountingInvoker();
    const acquire = vi.fn();

    const outcome = await runSquareBaseCopy(
      inputFor({ frozen: { ...FROZEN, copyContext: null } }),
      depsFor(client, invoker, { acquireAttempt: acquire }),
    );

    expect(outcome).toEqual({ kind: "not_requested" });
    expect(acquire).not.toHaveBeenCalled();
    expect(rpcNames).toEqual([]);
    expect(callCount()).toBe(0);
    expect(db.rowsArray()).toHaveLength(0);
  });

  it("attempt_already_completed lê o delivery e devolve completed reused sem provider", async () => {
    db.seed({
      attempt_seq: 3,
      state: "completed",
      copy_text: "texto persistido",
      copy_payload: { caption: "texto persistido" },
    });
    const { client } = makeClient(db);
    const { invoker, callCount } = makeCountingInvoker();

    const outcome = await runSquareBaseCopy(
      inputFor(),
      depsFor(client, invoker, {
        acquireAttempt: async () => ({ acquired: false, reason: "attempt_already_completed" }),
      }),
    );

    expect(outcome).toEqual({
      kind: "completed",
      attemptSeq: 3,
      text: "texto persistido",
      payload: { caption: "texto persistido" },
      origin: "reused",
    });
    expect(callCount()).toBe(0);
    // Nenhuma escrita de estado: só leitura.
    expect(db.rowsArray()).toHaveLength(1);
  });

  it("mapeia todos os motivos de perda da aquisição para a união fechada", async () => {
    const { client } = makeClient(db);
    const { invoker } = makeCountingInvoker();
    const deps = { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, client };

    await expect(
      copyOutcomeFromAcquisition({ acquired: false, reason: "attempt_in_progress" }, deps),
    ).resolves.toEqual({ kind: "in_progress" });

    await expect(
      copyOutcomeFromAcquisition(
        { acquired: false, reason: "already_acquired", attemptSeq: 4, attemptToken: TOKEN_A },
        deps,
      ),
    ).resolves.toEqual({ kind: "in_progress", attemptSeq: 4 });

    await expect(
      copyOutcomeFromAcquisition(
        { acquired: false, reason: "wait_not_elapsed", waitRemainingMs: 5_000 },
        deps,
      ),
    ).resolves.toEqual({ kind: "waiting", waitRemainingMs: 5_000 });

    await expect(
      copyOutcomeFromAcquisition({ acquired: false, reason: "attempt_limit_reached" }, deps),
    ).resolves.toEqual({ kind: "unavailable", reason: "attempt_limit" });

    await expect(
      copyOutcomeFromAcquisition({ acquired: false, reason: "automatic_closed" }, deps),
    ).resolves.toEqual({ kind: "unavailable", reason: "automatic_closed" });

    // Erro de aquisição (RPC fora do envelope) → unavailable acquisition_failed.
    const acquisitionError = await runSquareBaseCopy(
      inputFor(),
      depsFor(client, invoker, {
        acquireAttempt: async () => {
          throw new Error("acquire_failed");
        },
      }),
    );
    expect(acquisitionError).toEqual({ kind: "unavailable", reason: "acquisition_failed" });
  });

  it("erro de leitura no attempt_already_completed vira unavailable read_failed", async () => {
    db.seed({ attempt_seq: 1, state: "completed", copy_text: "x" });
    const { client } = makeClient(db);
    const { invoker } = makeCountingInvoker();
    db.readThrows = true;

    const outcome = await runSquareBaseCopy(
      inputFor(),
      depsFor(client, invoker, {
        acquireAttempt: async () => ({ acquired: false, reason: "attempt_already_completed" }),
      }),
    );

    expect(outcome).toEqual({ kind: "unavailable", reason: "read_failed" });
  });

  it("vencedor drena uma única vez e devolve o texto do estado PERSISTIDO", async () => {
    // A escrita persiste um texto DIFERENTE do commit em memória: o resultado
    // só pode vir da leitura pós-dreno.
    db.persistTransform = ({ copyText, copyPayload }) => ({
      copyText: copyText === null ? null : `persistido:${copyText}`,
      copyPayload,
    });
    const { client } = makeClient(db);
    const { invoker, callCount } = makeCountingInvoker();

    const outcome = await runSquareBaseCopy(inputFor(), depsFor(client, invoker));

    expect(outcome).toEqual({
      kind: "completed",
      attemptSeq: 1,
      text: "persistido:Legenda do provider",
      payload: {
        title: "Oferta Especial",
        caption: "Legenda do provider",
        hashtags: ["#oferta"],
        cta_post: "Aproveite!",
      },
      origin: "generated",
    });
    // Exatamente UMA requisição ao provider nesta execução.
    expect(callCount()).toBe(1);
    // Uma linha persistida, terminal completed.
    expect(db.rowsArray()).toHaveLength(1);
    expect(db.rowsArray()[0]?.state).toBe("completed");
  });

  it("orçamento zero devolve budget_exhausted sem drenar e sem provider", async () => {
    const { client, rpcNames } = makeClient(db);
    const { invoker, callCount } = makeCountingInvoker();
    const factory = vi.fn(realOpsFactory);

    const outcome = await runSquareBaseCopy(
      // remainingBeforeDeadline subtrai a reserva de 20 s ⇒ 0.
      inputFor({ deadlineAtMs: NOW + 20_000 }),
      depsFor(client, invoker, { copyOps: factory }),
    );

    expect(outcome).toEqual({ kind: "unavailable", reason: "budget_exhausted" });
    expect(factory).not.toHaveBeenCalled();
    expect(callCount()).toBe(0);
    // Só a RPC de aquisição aconteceu; nenhuma escrita de estado.
    expect(rpcNames).toEqual(["product_1_1_acquire_copy_attempt"]);
    expect(db.rowsArray()).toHaveLength(0);
  });

  it("o orçamento é min(COPY_BUDGET_MS, restante até o deadline)", async () => {
    vi.useFakeTimers();
    try {
      const { client } = makeClient(db);
      const { invoker } = makeCountingInvoker();
      const signals: AbortSignal[] = [];

      const promise = runSquareBaseCopy(
        // restante = 25_000 - 0 - 20_000 = 5_000 ⇒ orçamento de 5 s (menor que 30 s).
        inputFor({ deadlineAtMs: 25_000 }),
        depsFor(client, invoker, {
          now: () => 0,
          copyOps: () => ({
            runCopy: async ({ signal }) => {
              signals.push(signal);
              await new Promise<void>(() => {});
            },
          }),
        }),
      );

      await vi.advanceTimersByTimeAsync(4_999);
      expect(signals[0]?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      expect(signals[0]?.aborted).toBe(true);

      const outcome = await promise;
      // Orçamento esgotado ⇒ cancelamento atômico ⇒ falha confirmada.
      expect(outcome.kind).toBe("failed");
    } finally {
      vi.useRealTimers();
    }
  });

  it("o runner recebe briefing/copyContext congelados, runId = operationId e precificação", async () => {
    const { client } = makeClient(db);
    const { invoker } = makeCountingInvoker();
    let captured: DefaultProductOneToOneCopyRunnerInput | null = null;

    const factory: SquareBaseCopyOpsFactory = (input) => {
      captured = input;
      return {
        runCopy: async ({ commit }) => {
          await commit({ copyText: "texto do runner", payload: { caption: "texto do runner" } });
        },
      };
    };

    // Payload "recebido" com preço/tom DIVERGENTES: nunca é passado ao módulo
    // (a entrada só aceita o congelado), então nunca chega ao runner.
    const received = {
      copyContext: { storeName: "Outra Loja", segment: "outros", toneOfVoice: "formal", discountedPriceCents: 999 },
      briefing: { product: { name: "Outro Produto" } },
    };
    void received;

    const outcome = await runSquareBaseCopy(
      inputFor(),
      depsFor(client, invoker, { copyOps: factory }),
    );

    expect(outcome.kind).toBe("completed");
    const input = captured as DefaultProductOneToOneCopyRunnerInput | null;
    expect(input).not.toBeNull();
    expect(input?.briefing).toBe(FROZEN.briefing);
    expect(input?.copyContext).toBe(FROZEN.copyContext);
    expect(input?.copyContext?.discountedPriceCents).toBe(3_000);
    expect(input?.copyContext?.toneOfVoice).toBe("amigavel");
    expect(input?.runId).toBe(OPERATION_ID);
    expect(input?.campaignId).toBe(CAMPAIGN_ID);
    expect(input?.operationId).toBe(OPERATION_ID);
    expect(input?.storeId).toBe(STORE_ID);
    expect(input?.usdBrlRateAtGeneration).toBe(5.5);
    expect(input?.creditValueBrlAtGeneration).toBe(1.25);
    expect(input?.traceId).toBe("trace-1");
  });

  it("dreno failed mapeia para failed com a classe persistida e sem nova tentativa", async () => {
    const { client } = makeClient(db);
    const transient = Object.assign(new Error("network"), { retryable: true });
    const { invoker, callCount } = makeCountingInvoker(async () => {
      throw transient;
    });

    const outcome = await runSquareBaseCopy(inputFor(), depsFor(client, invoker));

    expect(outcome).toEqual({
      kind: "failed",
      attemptSeq: 1,
      failureClass: "transient",
      unconfirmed: false,
    });
    // Falha transitória NÃO gera segunda requisição.
    expect(callCount()).toBe(1);
  });

  it("dreno failed com falha definitiva persiste a classe definitiva", async () => {
    const { client } = makeClient(db);
    const definitive = Object.assign(new Error("auth"), { retryable: false });
    const { invoker } = makeCountingInvoker(async () => {
      throw definitive;
    });

    const outcome = await runSquareBaseCopy(inputFor(), depsFor(client, invoker));

    expect(outcome).toEqual({
      kind: "failed",
      attemptSeq: 1,
      failureClass: "definitive",
      unconfirmed: false,
    });
  });

  it("dreno unconfirmed (escritas de estado falham) vira failed unconfirmed", async () => {
    const { client } = makeClient(db);
    // Todas as escritas de estado falham ⇒ o dreno não confirma nenhum terminal.
    (client as unknown as { rpc: (name: string, params: Record<string, unknown>) => Promise<unknown> }).rpc =
      async () => ({ data: null, error: { message: "state_write_failed" } });
    const { invoker } = makeCountingInvoker();

    const outcome = await runSquareBaseCopy(inputFor(), depsFor(client, invoker, {
      acquireAttempt: async () => ({
        acquired: true,
        attemptSeq: 1,
        attemptToken: TOKEN_A,
        mode: "auto",
      }),
    }));

    expect(outcome).toEqual({
      kind: "failed",
      attemptSeq: 1,
      failureClass: null,
      unconfirmed: true,
    });
  });

  it("fábrica que falha devolve unavailable not_attempted", async () => {
    const { client } = makeClient(db);
    const { invoker, callCount } = makeCountingInvoker();

    const outcome = await runSquareBaseCopy(
      inputFor(),
      depsFor(client, invoker, {
        copyOps: () => {
          throw new Error("factory_failed");
        },
      }),
    );

    expect(outcome).toEqual({ kind: "unavailable", reason: "not_attempted" });
    expect(callCount()).toBe(0);
  });

  it("falha da copy nunca lança e não altera o desfecho da arte (fake combinado)", async () => {
    const { client } = makeClient(db);
    const { invoker } = makeCountingInvoker(async () => {
      throw Object.assign(new Error("network"), { retryable: true });
    });

    // O módulo devolve apenas a copy; o chamador combina com a arte criada.
    const copy = await runSquareBaseCopy(inputFor(), depsFor(client, invoker));
    const combined = {
      copy,
      art: {
        kind: "created" as const,
        artifact: { id: "artifact-1" },
        snapshotOriginalId: "snapshot-1",
      },
    };

    expect(combined.copy.kind).toBe("failed");
    expect(combined.art.kind).toBe("created");
  });

  it("todos os motivos de CopyOutcome são alcançáveis (união fechada)", async () => {
    const { client } = makeClient(db);
    const { invoker } = makeCountingInvoker();
    const { invoker: failingInvoker } = makeCountingInvoker(async () => {
      throw Object.assign(new Error("x"), { retryable: true });
    });
    const { client: failingClient } = makeClient(new CopyAttemptDb());

    const collected: string[] = [];
    const push = (outcome: CopyOutcome): void => {
      collected.push(outcome.kind === "unavailable" ? `unavailable:${outcome.reason}` : outcome.kind);
    };

    push(await runSquareBaseCopy(inputFor({ frozen: { ...FROZEN, copyContext: null } }), depsFor(client, invoker)));
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => ({ acquired: false, reason: "attempt_in_progress" }),
        }),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => ({ acquired: false, reason: "wait_not_elapsed", waitRemainingMs: 1 }),
        }),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => ({ acquired: false, reason: "attempt_limit_reached" }),
        }),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => ({ acquired: false, reason: "automatic_closed" }),
        }),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => {
            throw new Error("acquire");
          },
        }),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor({ deadlineAtMs: NOW + 20_000 }),
        depsFor(client, invoker),
      ),
    );
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          copyOps: () => {
            throw new Error("factory");
          },
        }),
      ),
    );
    db.seed({ attempt_seq: 2, state: "completed", copy_text: "ok" });
    push(
      await runSquareBaseCopy(
        inputFor(),
        depsFor(client, invoker, {
          acquireAttempt: async () => ({ acquired: false, reason: "attempt_already_completed" }),
        }),
      ),
    );
    push(await runSquareBaseCopy(inputFor(), depsFor(failingClient, failingInvoker)));

    expect(new Set(collected)).toEqual(
      new Set([
        "not_requested",
        "in_progress",
        "waiting",
        "unavailable:attempt_limit",
        "unavailable:automatic_closed",
        "unavailable:acquisition_failed",
        "unavailable:budget_exhausted",
        "unavailable:not_attempted",
        "completed",
        "failed",
      ]),
    );
  });
});

// ---------------------------------------------------------------------------
// Asserções de fonte (fronteiras do módulo)
// ---------------------------------------------------------------------------

describe("copy.ts — fronteiras de fonte", () => {
  const source = readFileSync(
    path.resolve(process.cwd(), "src", "lib", "campaign", "square-base", "copy.ts"),
    "utf8",
  );

  it("não usa gate de gasto do piloto, orquestrador 1:1, crédito ou estorno", () => {
    // Identificadores montados em runtime para o próprio teste não aparecerem no rg.
    expect(source).not.toMatch(new RegExp("pilot" + "Spend"));
    expect(source).not.toMatch(new RegExp("runProductOneToOne" + "Generation"));
    expect(source).not.toMatch(/product_1_1_campaign_credit/);
    expect(source).not.toMatch(/reserve/);
    expect(source).not.toMatch(/confirmCredit/);
    expect(source).not.toMatch(/refund/);
  });

  it("passa invoker obrigatório e attemptSeq da aquisição ao runner", () => {
    expect(source).toMatch(/\{ invoker: deps\.invoker, attemptSeq: acquired\.attemptSeq \}/);
    expect(source).toMatch(/attemptSeq: acquired\.attemptSeq/);
    expect(source).toMatch(/attemptToken: acquired\.attemptToken/);
  });

  it("não lê attempt/attemptSeq/attemptToken de SquareBaseInput nem da tentativa de imagem", () => {
    expect(source).not.toMatch(/SquareBaseInput/);
    expect(source).not.toMatch(/input\.attempt\b/);
    expect(source).not.toMatch(/imageAttempt/);
  });

  it("nunca constrói o gateway padrão (invoker é obrigatório)", () => {
    expect(source).not.toMatch(/defaultAiGateway/);
    expect(source).not.toMatch(/@\/lib\/ai"|@\/lib\/ai'/);
  });
});
