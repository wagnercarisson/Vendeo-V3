// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiInvoker } from "@/lib/ai/gateway";
import type {
  AiCallEnvelope,
  AiEnvelopeInternalCost,
  AiInvocationRequest,
  AiInvocationResult,
  AiTelemetryContext,
} from "@/lib/ai/types";
import type {
  ImageGenerationConfigSnapshot,
  CurrentImageGenerationConfig,
} from "@/lib/ai/image-generation-config-snapshot";
import type { ImageModelPairConfig } from "@/lib/ai/image-model-pair";

import {
  COPY_CANCELLATION_REASON,
  createCopyBudgetSignal,
  drainCopyTask,
  readCopyDelivery,
  readCopyState,
  recordCancellation,
  recordCopyState,
  type CopyState,
  type CopyStateStore,
  type CopyStateTransitionResult,
  type RecordCopyStateInput,
  type RecordCancellationInput,
} from "../copy/copy-state";
import {
  buildAttemptTelemetry,
  reconstructAttemptSequence,
  recordFailureDiagnosis,
} from "../orchestration/instrumentation";
import type { CampaignOperationState, AttemptTarget } from "../orchestration/attempt-start-types";
import type { ProductPromptCompositionBriefing } from "../policies/types";
import type { ProductOneToOneArtifactRef } from "../artifact/types";

// ---------------------------------------------------------------------------
// F56.2b1b — Plano 08: estado da copy não bloqueante (F8) + instrumentação por
// tentativa e diagnóstico durável `IMG-001` (REQ-11/REQ-12). Contract test
// estático + simulado: SEM banco, SEM provider, SEM crédito. Provider SIMULADO.
// ---------------------------------------------------------------------------

const PHASE_DIR = path.resolve(
  process.cwd(),
  ".planning/phases/56.2.2-f56-2b1b-n-cleo-entreg-vel-do-produto-1-1",
);
void PHASE_DIR;

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase", "migrations");
const MIGRATION_FILE = "20261009000005_f56_2b1b_copy_state.sql";
const migrationPath = path.join(MIGRATIONS_DIR, MIGRATION_FILE);
const migrationSql = readFileSync(migrationPath, "utf8");

const COPY_STATE_SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/copy/copy-state.ts"),
  "utf8",
);
const INSTRUMENTATION_SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/instrumentation.ts"),
  "utf8",
);
const ORCHESTRATOR_SOURCE = readFileSync(
  path.resolve(process.cwd(), "src/lib/product-1-1/orchestration/generation-orchestrator.ts"),
  "utf8",
);

const CAMPAIGN_ID = "11111111-1111-4111-8111-111111111111";
const OPERATION_ID = "22222222-2222-4222-8222-222222222222";
const STORE_ID = "33333333-3333-4333-8333-333333333333";
const SNAPSHOT_ID = "44444444-4444-4444-8444-444444444444";
// B2A-D4 — identidade da TENTATIVA nos contratos alterados (UUID v4 fixo).
const ATTEMPT_TOKEN = "3b0f6c1a-7d2e-4a1b-9c3f-5e8d2b1a0c4f";

const CONFIG: CurrentImageGenerationConfig = {
  primary: { model: "gpt-image-2.5-sunburst", quality: "medium" },
  fallback: { model: "gpt-image-2", quality: "medium" },
  origin: "human_decision",
  configVersionId: "55555555-5555-4555-8555-555555555555",
};

const SNAPSHOT: ImageGenerationConfigSnapshot = Object.freeze({
  campaignId: CAMPAIGN_ID,
  primaryModel: "gpt-image-2.5-sunburst",
  primaryQuality: "medium",
  fallbackModel: "gpt-image-2",
  fallbackQuality: "medium",
  configVersionId: CONFIG.configVersionId,
  origin: "human_decision",
  createdAt: "2026-10-12T00:00:00.000Z",
  runId: "run-1",
  traceId: "trace-1",
});

const BRIEFING: ProductPromptCompositionBriefing = {
  backgroundDirection: "studio",
  product: { name: "Produto Teste", description: null },
  commercial: {
    intent: "offer",
    originalPriceText: null,
    discountedPriceText: "R$ 19,90",
    badge: null,
    validity: null,
  },
  constraints: { mandatoryArtworkText: null },
};

// ---------------------------------------------------------------------------
// Task 1(a) — migration LOCAL-ONLY do estado/cancelamento da copy
// ---------------------------------------------------------------------------

describe("Plano 08 — migration do estado da copy (F8)", () => {
  it("cria a tabela de estado com identidade por operação e estados persistidos", () => {
    expect(migrationSql).toContain("public.product_1_1_copy_state");
    expect(migrationSql).toContain("state IN ('pending', 'completed', 'failed')");
    expect(migrationSql).toContain("UNIQUE (campaign_id, operation_id)");
    expect(migrationSql).toContain("updated_at");
  });

  it("Gap 1: persiste o TEXTO/PAYLOAD entregues (copy_text/copy_payload)", () => {
    expect(migrationSql).toContain("copy_text    TEXT");
    expect(migrationSql).toContain("copy_payload JSONB");
  });

  it("registra o cancelamento SEPARADAMENTE (tabela própria, imutável)", () => {
    expect(migrationSql).toContain("public.product_1_1_copy_cancellations");
    expect(migrationSql).toContain("reason       TEXT NOT NULL");
    expect(migrationSql).toMatch(/trg_product_1_1_copy_cancellations_immutable/);
  });

  it("é LOCAL-ONLY/autorada (cabeçalho explícito) com RLS + REVERT", () => {
    expect(migrationSql).toContain("LOCAL-ONLY");
    expect(migrationSql).toContain("apenas AUTORADA");
    expect(migrationSql).toContain("Plano 09");
    expect(migrationSql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(migrationSql).toContain("REVERT");
    // P2 (A2) — RPC-only writes: `service_role` fica com SELECT only; as mutações
    // passam pelas RPCs condicionais (nunca por Upsert/Insert direto).
    expect(migrationSql).toContain(
      "GRANT SELECT ON TABLE public.product_1_1_copy_state TO service_role;",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT ON TABLE public.product_1_1_copy_cancellations TO service_role;",
    );
    expect(migrationSql).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_state FROM service_role;",
    );
    expect(migrationSql).toContain(
      "REVOKE INSERT, UPDATE, DELETE ON TABLE public.product_1_1_copy_cancellations FROM service_role;",
    );
  });

  it("NÃO aplica remoto (sem db push / mutação remota no corpo ativo)", () => {
    const active = migrationSql
      .split(/\r?\n/)
      .filter((line) => !line.trimStart().startsWith("--"))
      .join("\n");
    expect(active).not.toMatch(/db push/i);
  });
});

// ---------------------------------------------------------------------------
// Task 1(b) — persistência do estado/cancelamento (registro separado)
// ---------------------------------------------------------------------------

interface FakeEvents {
  events: Array<{ table: string; op: string; payload?: unknown }>;
}

function makeFakeSupabase(
  selectResponse: { data: { state: CopyState } | null; error: null } = {
    data: null,
    error: null,
  },
): FakeEvents & { client: SupabaseClient } {
  const events: FakeEvents["events"] = [];
  function from(table: string) {
    return {
      select() {
        const chain = {
          eq() {
            return chain;
          },
          // B2A-D4 — `readCopyState`/`readCopyDelivery` leem a MAIOR `attempt_seq`
          // via `.order("attempt_seq", { ascending: false }).limit(1)`.
          order() {
            return chain;
          },
          limit() {
            return chain;
          },
          maybeSingle() {
            return Promise.resolve(selectResponse);
          },
        };
        return chain;
      },
    };
  }
  // P2 — RPCs condicionais (`service_role` NÃO escreve direto nas tabelas).
  const client = {
    from,
    rpc(name: string, params: Record<string, unknown>) {
      events.push({ table: name, op: "rpc", payload: params });
      const state = (params.p_state as CopyState | undefined) ?? null;
      if (name === "product_1_1_cancel_copy") {
        return Promise.resolve({
          data: { applied: true, state: "failed", canceled: true },
          error: null,
        });
      }
      return Promise.resolve({
        data: { applied: true, outcome: "applied", state },
        error: null,
      });
    },
  } as unknown as SupabaseClient;
  return { events, client };
}

describe("Plano 08 — persistência do estado da copy (F8)", () => {
  it("P2: recordCopyState chama a RPC condicional (RPC-only writes; sem Upsert direto)", async () => {
    const { client, events } = makeFakeSupabase();
    await recordCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, attemptSeq: 1, attemptToken: ATTEMPT_TOKEN, state: "pending" });

    expect(events).toHaveLength(1);
    expect(events[0].table).toBe("product_1_1_apply_copy_state");
    expect(events[0].op).toBe("rpc");
    expect(events[0].payload).toMatchObject({
      p_campaign_id: CAMPAIGN_ID,
      p_operation_id: OPERATION_ID,
      p_state: "pending",
    });
  });

  it("readCopyState recupera o estado persistido", async () => {
    const { client } = makeFakeSupabase({ data: { state: "completed" }, error: null });
    await expect(
      readCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    ).resolves.toBe("completed");
  });

  it("Gap 1: readCopyDelivery recupera o TEXTO/PAYLOAD entregues", async () => {
    const client = {
      from() {
        return {
          select() {
            const chain = {
              eq() {
                return chain;
              },
              // B2A-D4 — leitura da MAIOR `attempt_seq` via `.order(...).limit(1)`.
              order() {
                return chain;
              },
              limit() {
                return chain;
              },
              maybeSingle() {
                return Promise.resolve({
                  data: {
                    state: "completed",
                    copy_text: "Legenda da campanha",
                    copy_payload: { caption: "Legenda da campanha" },
                  },
                  error: null,
                });
              },
            };
            return chain;
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(
      readCopyDelivery(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID }),
    ).resolves.toEqual({
      state: "completed",
      copyText: "Legenda da campanha",
      copyPayload: { caption: "Legenda da campanha" },
    });
  });

  it("P2: recordCancellation chama a RPC ATÔMICA (terminal failed + motivo numa transação)", async () => {
    const { client, events } = makeFakeSupabase();
    await recordCancellation(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      reason: "cancelled_by_owner",
      attemptSeq: 1,
      attemptToken: ATTEMPT_TOKEN,
    });

    expect(events).toHaveLength(1);
    expect(events[0].table).toBe("product_1_1_cancel_copy");
    expect(events[0].op).toBe("rpc");
    expect(events[0].payload).toMatchObject({ p_reason: "cancelled_by_owner" });
  });
});

// ---------------------------------------------------------------------------
// Task 1(c) — drenagem no ciclo da requisição com orçamento (sem órfã)
// ---------------------------------------------------------------------------

interface CasRow {
  state: CopyState;
  copyText: string | null;
  copyPayload: Record<string, unknown> | null;
}

/**
 * Simulador FIEL das RPCs condicionais (`product_1_1_apply_copy_state` /
 * `product_1_1_cancel_copy`): transição CONDICIONAL + terminal PROTEGIDO +
 * replay por CONTEÚDO + `invalid_content` (C2). Prova o comportamento do
 * DRENADOR; as RPCs reais (SQL) são provadas por asserções estáticas e pela
 * suíte de integração isolada do Plano 09.
 */
function makeCasStore() {
  let row: CasRow | null = null;
  const stateCalls: CopyState[] = [];
  const cancelCalls: string[] = [];

  const apply = (
    state: CopyState,
    copyText: string | null = null,
    copyPayload: Record<string, unknown> | null = null,
  ): CopyStateTransitionResult => {
    // C2 — `completed` exige conteúdo entregável.
    if (state === "completed" && (copyText === null || copyText.trim() === "")) {
      return { applied: false, outcome: "invalid_content", state: null };
    }
    if (row === null) {
      row = { state, copyText, copyPayload };
      return { applied: true, outcome: "applied", state };
    }
    const terminal = row.state === "completed" || row.state === "failed";
    if (terminal) {
      if (row.state === state) {
        const equivalent =
          row.copyText === copyText &&
          JSON.stringify(row.copyPayload) === JSON.stringify(copyPayload);
        return equivalent
          ? { applied: false, outcome: "idempotent", state }
          : { applied: false, outcome: "conflict", state };
      }
      return { applied: false, outcome: "rejected", state: row.state };
    }
    if (row.state === state) {
      return { applied: false, outcome: "idempotent", state };
    }
    row = { state, copyText, copyPayload };
    return { applied: true, outcome: "applied", state };
  };

  const store: CopyStateStore = {
    async recordCopyState(input) {
      stateCalls.push(input.state);
      return apply(input.state, input.copyText ?? null, input.copyPayload ?? null);
    },
    async recordCancellation(input) {
      cancelCalls.push(input.reason);
      const res = apply("failed");
      if (res.state === "failed") {
        return { applied: res.applied, state: "failed", canceled: true };
      }
      return { applied: res.applied, state: res.state, canceled: false };
    },
  };
  return { store, stateCalls, cancelCalls, getRow: () => row };
}

/** Envolve o simulador CAS registrando os textos entregues (`commit`). */
function makeDeliveryRecordingStore() {
  const deliveries: Array<{ state: CopyState; copyText?: string | null }> = [];
  const inner = makeCasStore();
  const store: CopyStateStore = {
    async recordCopyState(input) {
      deliveries.push({ state: input.state, copyText: input.copyText });
      return inner.store.recordCopyState(input);
    },
    recordCancellation: inner.store.recordCancellation,
  };
  return { store, deliveries };
}

describe("Plano 08 — drenagem da copy com orçamento (F8)", () => {
  it("sucesso (commit provado) ⇒ persiste pending → completed, SEM cancelamento", async () => {
    const { store, stateCalls, cancelCalls } = makeCasStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "Legenda", payload: { caption: "Legenda" } });
        },
      },
      store,
    );

    expect(result).toEqual({ state: "completed", canceled: false });
    expect(stateCalls).toEqual(["pending", "completed"]);
    expect(cancelCalls).toEqual([]);
  });

  it("C2: task resolvida SEM `commit` (sem texto entregável) ⇒ NUNCA persiste `completed`", async () => {
    const { store, stateCalls, getRow } = makeCasStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {},
      },
      store,
    );

    expect(result).toEqual({ state: "failed", canceled: false });
    expect(stateCalls).toEqual(["pending", "failed"]);
    expect(getRow()?.state).toBe("failed");
  });

  it("falha (não cancelada) ⇒ persiste failed e NÃO registra cancelamento", async () => {
    const { store, stateCalls, cancelCalls } = makeCasStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async () => {
          throw new Error("copy_director_failed");
        },
      },
      store,
    );

    expect(result).toEqual({ state: "failed", canceled: false });
    expect(stateCalls).toEqual(["pending", "failed"]);
    expect(cancelCalls).toEqual([]);
  });

  it("orçamento esgotado ⇒ CANCELA atomicamente (`failed` + motivo numa ÚNICA chamada RPC)", async () => {
    const { store, stateCalls, cancelCalls, getRow } = makeCasStore();
    const budget = createCopyBudgetSignal(0);
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: budget.signal,
        run: ({ signal }) =>
          new Promise<void>((_resolve, reject) => {
            if (signal.aborted) {
              reject(new DOMException("aborted", "AbortError"));
              return;
            }
            signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), {
              once: true,
            });
          }),
      },
      store,
    );
    budget.dispose();

    expect(result).toEqual({ state: "failed", canceled: true });
    // ATÔMICO: o drenador NÃO faz um write separado de `failed` — o terminal
    // `failed` é aplicado DENTRO do cancelamento.
    expect(stateCalls).toEqual(["pending"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);
    expect(getRow()?.state).toBe("failed");
  });

  it("Gap 1: o texto entregue é persistido via `commit` (estado `completed` + copyText)", async () => {
    const { store, deliveries } = makeDeliveryRecordingStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "Legenda da campanha", payload: { caption: "Legenda da campanha" } });
        },
      },
      store,
    );

    expect(result).toEqual({ state: "completed", canceled: false });
    expect(deliveries).toEqual([
      { state: "pending", copyText: undefined },
      { state: "completed", copyText: "Legenda da campanha" },
    ]);
  });

  it("Gap 3: task que IGNORA o abort ⇒ drain retorna determinístico (canceled) e a conclusão TARDIA não persiste nada", async () => {
    const { store, stateCalls, cancelCalls } = makeCasStore();
    const budget = createCopyBudgetSignal(0);
    let lateCommit: (() => Promise<void>) | undefined;
    let releaseLate: (() => void) | undefined;
    const lateGate = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });

    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: budget.signal,
        // IGNORA o abort: continua rodando ALÉM do orçamento.
        run: async ({ commit }) => {
          await lateGate;
          lateCommit = () => commit({ copyText: "tarde demais" });
        },
      },
      store,
      { persistenceBudgetMs: 100 },
    );
    budget.dispose();

    // O drenador retornou determinístico como CANCELADO, mesmo com a task viva.
    expect(result).toEqual({ state: "failed", canceled: true });
    expect(stateCalls).toEqual(["pending"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);

    // A conclusão TARDIA tenta persistir, mas o latch bloqueia: nada é escrito.
    releaseLate?.();
    await new Promise((r) => setTimeout(r, 10));
    await lateCommit?.();
    expect(stateCalls).toEqual(["pending"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);
  });

  it("Gap 3/P2: escritas de persistência têm orçamento PRÓPRIO (store pendurado não prende o drenador) e persistência NÃO provada vira `unconfirmed` (incerteza LOCAL)", async () => {
    const store: CopyStateStore = {
      async recordCopyState() {
        // Escrita que NUNCA resolve — o teto das escritas deve liberar o drenador.
        await new Promise<void>(() => {});
        return { applied: true, outcome: "applied", state: "pending" };
      },
      async recordCancellation() {
        await new Promise<void>(() => {});
        return { applied: true, state: "failed", canceled: true };
      },
    };
    const started = Date.now();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto" });
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );
    // Determinístico apesar da escrita pendurada — e NUNCA `completed` sem
    // persistência PROVADA: incerteza LOCAL ⇒ `unconfirmed` (A1 — re-ler resolve).
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("P2(a): FALHA de persistência do texto ⇒ NÃO declara `completed` (terminal `failed`)", async () => {
    const attempts: CopyState[] = [];
    const inner = makeCasStore();
    const store: CopyStateStore = {
      async recordCopyState(input) {
        attempts.push(input.state);
        if (input.state === "completed") {
          throw new Error("product_1_1_apply_copy_state_rpc_failed");
        }
        return inner.store.recordCopyState(input);
      },
      recordCancellation: inner.store.recordCancellation,
    };
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto" });
        },
      },
      store,
    );

    expect(result).toEqual({ state: "failed", canceled: false });
    // A tentativa de persistir o texto ocorreu, mas falhou — e o estado final é
    // `failed`, nunca `completed` (sem sucesso enganoso).
    expect(attempts).toEqual(["pending", "completed", "failed"]);
  });

  it("P2(b): escrita do texto que PENDURA ⇒ `unconfirmed` (nunca `completed`) e o drenador é LIMITADO", async () => {
    const attempts: CopyState[] = [];
    const inner = makeCasStore();
    const store: CopyStateStore = {
      async recordCopyState(input) {
        attempts.push(input.state);
        if (input.state === "completed") {
          // Pendura SOMENTE a escrita do texto além do teto.
          await new Promise<void>(() => {});
        }
        return inner.store.recordCopyState(input);
      },
      recordCancellation: inner.store.recordCancellation,
    };
    const started = Date.now();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto" });
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );

    // Persistência não provada (timeout) ⇒ incerteza LOCAL (`unconfirmed`) e o
    // drenador retorna no teto (A1: resolve-se por RE-LEITURA, nunca por 2º write).
    expect(result).toEqual({ state: "unconfirmed", canceled: false });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("P2(c): escrita ATRASADA que resolve APÓS o cancelamento NÃO sobrescreve o estado final (CAS no BANCO)", async () => {
    const inner = makeCasStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store: CopyStateStore = {
      async recordCopyState(input) {
        // A escrita do texto é ATRASADA: só resolve quando liberada (depois do
        // cancelamento). Não é um `commit` tardio da task — é uma escrita em voo
        // que resolve após o settle.
        if (input.state === "completed") {
          await gate;
        }
        return inner.store.recordCopyState(input);
      },
      recordCancellation: inner.store.recordCancellation,
    };
    const controller = new AbortController();

    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        recoveryKind: "auto",
        signal: controller.signal,
        run: async ({ commit }) => {
          void commit({ copyText: "tarde demais" });
          // Cancela logo após disparar a escrita (orçamento esgotado), ignorando
          // o abort — a escrita permanece EM VOO.
          queueMicrotask(() => controller.abort());
          await new Promise<void>(() => {});
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );

    expect(result).toEqual({ state: "failed", canceled: true });
    // A escrita atrasada ainda não resolveu ⇒ o cancelamento já persistiu `failed`.
    expect(inner.getRow()?.state).toBe("failed");

    // Liberamos a escrita atrasada: o BANCO rejeita a transição para `completed`
    // (terminal PROTEGIDO) — uma escrita em voo NUNCA sobrescreve o estado final.
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(inner.getRow()?.state).toBe("failed");
  });


  it("NÃO existe ação/endpoint de retry (source)", () => {
    // Nenhuma AÇÃO/função de retry exportada nesta fatia (a palavra pode aparecer
    // em comentários explicando que o retry pertence à b2).
    expect(COPY_STATE_SOURCE).not.toMatch(/export\s+(?:async\s+)?(?:function\s+)?\w*[Rr]etry/);
    expect(COPY_STATE_SOURCE).not.toMatch(/\bretry\s*\(/);
    expect(ORCHESTRATOR_SOURCE).not.toMatch(/copyRetry|retryCopy|copy\/retry|retry\s*\(/);
  });
});

// ---------------------------------------------------------------------------
// Task 2(a) — envelope REAL por tentativa + sequência reconstruível (P1)
// ---------------------------------------------------------------------------

/** Envelope REAL do gateway (modelo/qualidade/alvo/attempt_number reais). */
function gatewayEnvelope(overrides: Partial<AiCallEnvelope> = {}): AiCallEnvelope {
  return {
    capability: "campaign_product_image",
    protocol: "images",
    status: "success",
    provider: "openai",
    model: SNAPSHOT.primaryModel,
    durationMs: 12,
    quality: SNAPSHOT.primaryQuality,
    target: "primary",
    attemptNumber: 1,
    ...overrides,
  };
}

describe("Plano 08 — envelope por tentativa REAL do gateway (REQ-12 / P1)", () => {
  it("P1: a sequência principal (×2) + fallback (×1) é reconstruível a partir dos envelopes REAIS", () => {
    const envelopes: AiCallEnvelope[] = [
      gatewayEnvelope({ attemptNumber: 1, target: "primary", status: "failed" }),
      gatewayEnvelope({ attemptNumber: 2, target: "primary", status: "failed" }),
      gatewayEnvelope({
        attemptNumber: 3,
        target: "fallback",
        status: "success",
        model: SNAPSHOT.fallbackModel,
      }),
    ];

    const sequence = reconstructAttemptSequence(SNAPSHOT, envelopes);
    expect(sequence).toEqual([
      { attemptNumber: 1, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 2, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 3, target: "fallback", model: "gpt-image-2", quality: "medium" },
    ]);
  });

  it("P1: buildAttemptTelemetry REUSA o caminho existente e propaga `internalCost` no contexto", () => {
    const internalCost: AiEnvelopeInternalCost = {
      estimatedCostUsd: 0.041,
      pricingVersion: "pricing-ver-1",
      origin: "new_flow_pair_pricing",
      source: "pricing_table",
      model: SNAPSHOT.primaryModel,
      quality: SNAPSHOT.primaryQuality,
    };
    const context = buildAttemptTelemetry({
      operationRunId: "run-1",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      internalCost,
    });
    expect(context).toMatchObject({
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      internalCost,
    });
    expect(typeof context.sink.emit).toBe("function");
  });

  it("P1: a instrumentação NÃO reconstrói o envelope (sem `emitAttemptEnvelope`/`createDurableAttemptEnvelopeSink`)", () => {
    expect(INSTRUMENTATION_SOURCE).toContain("createDefaultTelemetryContext");
    // Custo do NOVO FLUXO (modelo + qualidade + versão + origem) — nunca a
    // resolução legada sem qualidade.
    expect(INSTRUMENTATION_SOURCE).toContain("resolveImagePairCost");
    expect(INSTRUMENTATION_SOURCE).toContain("defaultResolveAttemptCost");
    expect(INSTRUMENTATION_SOURCE).not.toMatch(/resolveAiCost\s*\(/);
    // P1 (Opção A): a reconstrução zero-duration foi REMOVIDA do novo fluxo; o
    // envelope REAL do gateway é persistido pelo sink ÚNICO via `internalCost`.
    expect(INSTRUMENTATION_SOURCE).toContain("internalCost");
    expect(INSTRUMENTATION_SOURCE).not.toContain("createDurableAttemptEnvelopeSink");
    expect(INSTRUMENTATION_SOURCE).not.toContain("emitAttemptEnvelope");
  });
});

// ---------------------------------------------------------------------------
// Task 2(b) — diagnóstico durável correlacionado a IMG-001
// ---------------------------------------------------------------------------

describe("Plano 08 — diagnóstico durável (REQ-12)", () => {
  it("persiste via repositório injetado e reduz o erro ao conjunto FECHADO", async () => {
    const records: Array<Record<string, unknown>> = [];
    const record = vi.fn(async (input: Record<string, unknown>) => {
      records.push(input);
      return { reference: String(input.reference) };
    });

    const result = await recordFailureDiagnosis(record, {
      reference: "66666666-6666-4666-8666-666666666666",
      category: "generation_failed",
      normalizedError: "sk-secret-key-and-https://provider.example/leak",
      model: "gpt-image-2",
      quality: "medium",
      target: "primary",
      attemptNumber: 3,
      runId: "run-1",
      traceId: "trace-1",
    });

    expect(result.reference).toBe("66666666-6666-4666-8666-666666666666");
    expect(record).toHaveBeenCalledTimes(1);
    expect(records[0]).toMatchObject({
      reference: "66666666-6666-4666-8666-666666666666",
      internalCategory: "generation_failed",
      // Texto cru/chave/URL NUNCA persistido — reduzido ao conjunto fechado.
      normalizedError: "unknown_provider_error",
      target: "primary",
      attemptNumber: 3,
    });
  });

  it("distingue falha CONFIRMADA de resultado DESCONHECIDO pela categoria interna", async () => {
    const categories: string[] = [];
    const record = async (input: Record<string, unknown>) => {
      categories.push(String(input.internalCategory));
      return { reference: String(input.reference) };
    };

    await recordFailureDiagnosis(record, {
      reference: "ref-confirmed",
      category: "generation_failed",
      normalizedError: "provider_error",
    });
    await recordFailureDiagnosis(record, {
      reference: "ref-unknown",
      category: "generation_unknown",
      normalizedError: "timeout",
    });

    expect(categories).toEqual(["generation_failed", "generation_unknown"]);
  });

  it("best-effort: falha de persistência nunca lança (mantém a referência)", async () => {
    const record = async () => {
      throw new Error("diagnosis_repository_down");
    };
    await expect(
      recordFailureDiagnosis(record, {
        reference: "ref-1",
        category: "generation_failed",
        normalizedError: "provider_error",
      }),
    ).resolves.toEqual({ reference: "ref-1" });
  });
});

// ---------------------------------------------------------------------------
// Orquestrador (provider SIMULADO) — copy não bloqueia delivered + envelopes
// ---------------------------------------------------------------------------

interface OrchestratorHarness {
  readonly deps: Parameters<
    typeof import("../orchestration/generation-orchestrator").runProductOneToOneGeneration
  >[1];
  readonly calls: {
    deliver: ReturnType<typeof vi.fn>;
    refund: ReturnType<typeof vi.fn>;
    providerCalls: number;
  };
  readonly envelopes: AiCallEnvelope[];
  readonly copyStates: CopyState[];
  readonly copyCancellations: string[];
  setProviderSequence(seq: Array<AiInvocationResult | Error>): void;
}

function makeInput() {
  return {
    campaignId: CAMPAIGN_ID,
    operationId: OPERATION_ID,
    storeId: STORE_ID,
    briefing: BRIEFING,
    briefingText: "briefing congelado",
    campaignIntent: "offer" as const,
    backgroundDirection: "studio" as const,
    productImagesDataUrls: ["data:image/png;base64,primary"],
    runId: "run-1",
    traceId: "trace-1",
  };
}

async function buildOrchestratorHarness(): Promise<OrchestratorHarness> {
  let providerSequence: Array<AiInvocationResult | Error> = [];
  let providerIndex = 0;
  let providerCalls = 0;
  const envelopes: AiCallEnvelope[] = [];
  const copyStates: CopyState[] = [];
  const copyCancellations: string[] = [];
  let currentTarget: AttemptTarget = "primary";

  const baseState = (overrides: Partial<CampaignOperationState> = {}): CampaignOperationState =>
    Object.freeze({
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      status: "reserved",
      amount: 1,
      creditTxId: "tx-1",
      refundTxId: null,
      consumedDefinitive: false,
      terminal: false,
      unknown: false,
      outcome: null,
      supportReference: null,
      ...overrides,
    });

  const deliver = vi.fn(async () =>
    baseState({ status: "delivered", terminal: true, consumedDefinitive: true }),
  );
  const refund = vi.fn(async () => baseState({ status: "refunded", terminal: true }));

  const createGateway = vi.fn((_pair: ImageModelPairConfig): AiInvoker => ({
    async invoke(_capability, request, telemetry, target = "primary"): Promise<AiInvocationResult> {
      providerCalls += 1;
      const next = providerSequence[providerIndex] ?? {
        imageBase64: "AAAA",
        mimeType: "image/png",
        model: "gpt-image-2.5-sunburst",
      };
      providerIndex += 1;
      // Simula fielmente o `AiGateway`: emite EXATAMENTE UM envelope REAL por
      // tentativa (sucesso/falha/timeout) ao sink da telemetria — durationMs/
      // usage/model/quality/status reais.
      const model =
        target === "fallback" ? SNAPSHOT.fallbackModel : SNAPSHOT.primaryModel;
      if (next instanceof Error) {
        await telemetry.sink.emit({
          capability: "campaign_product_image",
          protocol: "images",
          status: "failed",
          provider: "openai",
          model,
          durationMs: 7,
          errorType: "provider_error",
          quality: request.quality,
          target,
          attemptNumber: telemetry.attemptNumber,
        });
        throw next;
      }
      await telemetry.sink.emit({
        capability: "campaign_product_image",
        protocol: "images",
        status: "success",
        provider: "openai",
        model: next.model ?? model,
        usage: { promptTokens: 10, completionTokens: 20 },
        durationMs: 12,
        quality: request.quality,
        target,
        attemptNumber: telemetry.attemptNumber,
      });
      return next;
    },
    async hasFallback() {
      return true;
    },
  }));

  const deps = {
    runPreflight: async () => ({
      config: CONFIG,
      pricing: {
        primary: {} as never,
        fallback: {} as never,
        missingComponents: [],
        pricingCoverage: "complete" as const,
      },
    }),
    buildSnapshot: () => SNAPSHOT,
    persistSnapshot: async () => ({ snapshotOriginalId: SNAPSHOT_ID, reused: false }),
    credit: {
      reserve: vi.fn(async () => baseState()),
      markArtUploaded: vi.fn(async () => baseState({ status: "art_uploaded" })),
      deliver,
      refund,
    } as never,
    attempts: {
      acquire: vi.fn(async (input: { target: AttemptTarget; attemptNumber: number }) => {
        currentTarget = input.target;
        return {
          acquired: true,
          reason: null,
          campaignId: CAMPAIGN_ID,
          operationId: OPERATION_ID,
          attemptNumber: input.attemptNumber,
          target: input.target,
        };
      }),
      finish: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        attemptNumber: 1,
        target: currentTarget,
        status: "done",
        idempotent: false,
      })),
      recordOperationOutcome: vi.fn(async () => ({
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        outcome: "unknown",
        supportReference: null,
        idempotent: false,
      })),
      getCampaignOperation: vi.fn(async () => null),
    } as never,
    artifact: {
      storeArtifact: vi.fn(async (): Promise<ProductOneToOneArtifactRef> => ({
        storagePath: `${STORE_ID}/${CAMPAIGN_ID}/product-1-1/${OPERATION_ID}/art-1024.jpg`,
        width: 1024,
        height: 1024,
        mimeType: "image/jpeg",
      })),
      probeArtifact: vi.fn(async () => ({ kind: "absent" as const })),
    } as never,
    createGateway,
    createTelemetry: (input: { attemptNumber: number }): AiTelemetryContext => ({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: input.attemptNumber,
      sink: { emit: async () => {} },
    }),
    recordAttempt: vi.fn(async () => ({ id: "op-row-1", operationId: OPERATION_ID })),
    recordDiagnosis: vi.fn(async () => ({ reference: "ref-test" })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    onAttemptEnvelope: (envelope: AiCallEnvelope) => {
      envelopes.push(envelope);
    },
  };

  return {
    deps,
    calls: {
      deliver,
      refund,
      get providerCalls() {
        return providerCalls;
      },
    },
    envelopes,
    copyStates,
    copyCancellations,
    setProviderSequence(seq) {
      providerSequence = seq;
      providerIndex = 0;
    },
  };
}

async function runOrchestrator(harness: OrchestratorHarness) {
  const { runProductOneToOneGeneration } = await import(
    "../orchestration/generation-orchestrator"
  );
  const response = await runProductOneToOneGeneration(makeInput(), harness.deps);
  const text = await response.text();
  const events = text
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  return { response, events, terminal: events.at(-1) };
}

describe("Plano 08 — copy não bloqueia delivered (F8)", () => {
  it("falha da copy NÃO impede `delivered` (terminal result) e persiste failed", async () => {
    const harness = await buildOrchestratorHarness();
    harness.setProviderSequence([{ imageBase64: "AAAA", mimeType: "image/png", model: "m" }]);
    const cas = makeCasStore();
    (harness.deps as Record<string, unknown>).copy = {
      // F56.2b2a (Plano 02) — tentativa INICIAL identificada: a aquisição é
      // injetada como VENCEDORA (o mock `supabaseAdmin={}` não implementa `rpc`).
      acquireAttempt: async () => ({
        acquired: true as const,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        mode: "auto" as const,
      }),
      runCopy: async () => {
        throw new Error("copy_director_failed");
      },
      recordCopyState: async (input: RecordCopyStateInput) => {
        harness.copyStates.push(input.state);
        return cas.store.recordCopyState(input);
      },
      recordCancellation: async (input: RecordCancellationInput) => {
        harness.copyCancellations.push(input.reason);
        return cas.store.recordCancellation(input);
      },
    };

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    expect(harness.copyStates).toEqual(["pending", "failed"]);
    expect(harness.copyCancellations).toEqual([]);
  });

  it("copy LENTA além do orçamento é CANCELADA/persistida e ainda entrega a imagem (sem órfã)", async () => {
    const harness = await buildOrchestratorHarness();
    harness.setProviderSequence([{ imageBase64: "AAAA", mimeType: "image/png", model: "m" }]);
    let budgetController: AbortController | undefined;
    const cas = makeCasStore();
    (harness.deps as Record<string, unknown>).copy = {
      // F56.2b2a (Plano 02) — tentativa INICIAL identificada (aquisição vencedora
      // injetada; `supabaseAdmin={}` não implementa `rpc`).
      acquireAttempt: async () => ({
        acquired: true as const,
        attemptSeq: 1,
        attemptToken: ATTEMPT_TOKEN,
        mode: "auto" as const,
      }),
      makeBudgetSignal: () => {
        budgetController = new AbortController();
        return { signal: budgetController.signal, dispose: () => {} };
      },
      runCopy: ({ signal }: { signal: AbortSignal }) =>
        new Promise<void>((_resolve, reject) => {
          if (signal.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
          // Simula o orçamento estourando logo após a copy iniciar (determinístico).
          queueMicrotask(() => budgetController?.abort());
        }),
      recordCopyState: async (input: RecordCopyStateInput) => {
        harness.copyStates.push(input.state);
        return cas.store.recordCopyState(input);
      },
      recordCancellation: async (input: RecordCancellationInput) => {
        harness.copyCancellations.push(input.reason);
        return cas.store.recordCancellation(input);
      },
    };

    const { terminal } = await runOrchestrator(harness);

    // A entrega da imagem é independente do estado da copy.
    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    // O cancelamento é ATÔMICO: o terminal `failed` é aplicado DENTRO de
    // `product_1_1_cancel_copy` (sem write separado de estado).
    expect(harness.copyStates).toEqual(["pending"]);
    expect(harness.copyCancellations).toEqual([COPY_CANCELLATION_REASON]);
  });
});

describe("Plano 08 — envelope por tentativa no orquestrador (REQ-12 / P1)", () => {
  it("cada tentativa real emite exatamente um envelope REAL; a sequência é reconstruível", async () => {
    const harness = await buildOrchestratorHarness();
    const providerError = () => Object.assign(new Error("provider down"), { kind: "provider_error" });
    harness.setProviderSequence([
      providerError(),
      providerError(),
      { imageBase64: "CCCC", mimeType: "image/png", model: "gpt-image-2" },
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.providerCalls).toBe(3);
    // UM envelope REAL por tentativa real (2 principal + 1 fallback), emitido
    // pelo gateway e observado via `withOnCallTelemetry` — sem reconstrução.
    expect(harness.envelopes).toHaveLength(3);
    expect(harness.envelopes.map((e) => e.target)).toEqual(["primary", "primary", "fallback"]);
    expect(harness.envelopes.map((e) => e.attemptNumber)).toEqual([1, 2, 3]);
    expect(harness.envelopes.map((e) => e.status)).toEqual(["failed", "failed", "success"]);
    expect(harness.envelopes[0].quality).toBe(SNAPSHOT.primaryQuality);

    const sequence = reconstructAttemptSequence(SNAPSHOT, harness.envelopes);
    expect(sequence).toHaveLength(3);
    expect(sequence[2]).toMatchObject({ target: "fallback", model: "gpt-image-2" });
  });

  it("falha confirmada + ausência comprovada ⇒ diagnóstico durável correlacionado a IMG-001", async () => {
    const harness = await buildOrchestratorHarness();
    harness.setProviderSequence([
      Object.assign(new Error("content policy violation"), { kind: "content_filter" }),
    ]);

    const { terminal } = await runOrchestrator(harness);

    expect(terminal).toMatchObject({ type: "error", code: "IMG-001" });
    expect(harness.calls.refund).toHaveBeenCalledTimes(1);
    const recordDiagnosis = (harness.deps as Record<string, unknown>).recordDiagnosis as ReturnType<
      typeof vi.fn
    >;
    expect(recordDiagnosis).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Guardas estáticas de wiring
// ---------------------------------------------------------------------------

describe("Plano 08 — wiring estático", () => {
  it("o orquestrador drena a copy no ciclo da requisição (orçamento/cancelamento)", () => {
    expect(ORCHESTRATOR_SOURCE).toContain("drainCopyTask");
    expect(ORCHESTRATOR_SOURCE).toContain("COPY_BUDGET_MS");
    expect(ORCHESTRATOR_SOURCE).toContain("recordCancellation");
    expect(ORCHESTRATOR_SOURCE).toContain("await copyDrain");
  });

  it("o orquestrador persiste o envelope REAL (via sink) e o diagnóstico durável centralizado", () => {
    // P1 (Opção A): o envelope REAL do gateway é persistido pelo sink ÚNICO
    // (observado em teste via `withOnCallTelemetry`) — sem reconstrução.
    expect(ORCHESTRATOR_SOURCE).toContain("withOnCallTelemetry");
    expect(ORCHESTRATOR_SOURCE).toContain("internalCost");
    expect(ORCHESTRATOR_SOURCE).not.toContain("emitAttemptEnvelope");
    expect(ORCHESTRATOR_SOURCE).not.toContain("createDurableAttemptEnvelopeSink");
    expect(ORCHESTRATOR_SOURCE).toContain("recordFailureDiagnosis");
    expect(ORCHESTRATOR_SOURCE).not.toContain("toInternalDiagnosis(");
  });
});
