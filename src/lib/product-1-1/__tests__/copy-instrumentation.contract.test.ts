// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ supabaseAdmin: {} }));

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiInvoker } from "@/lib/ai/gateway";
import type { AiInvocationRequest, AiInvocationResult, AiTelemetryContext } from "@/lib/ai/types";
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
} from "../copy/copy-state";
import {
  buildAttemptTelemetry,
  emitAttemptEnvelope,
  reconstructAttemptSequence,
  recordFailureDiagnosis,
  type AttemptEnvelope,
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
    // Estado corrente é mutável (UPDATE); cancelamento é append-only (SELECT/INSERT).
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON TABLE public.product_1_1_copy_state TO service_role;",
    );
    expect(migrationSql).toContain(
      "GRANT SELECT, INSERT ON TABLE public.product_1_1_copy_cancellations TO service_role;",
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
      upsert(payload: unknown) {
        events.push({ table, op: "upsert", payload });
        return Promise.resolve({ error: null });
      },
      insert(payload: unknown) {
        events.push({ table, op: "insert", payload });
        return Promise.resolve({ error: null });
      },
      select() {
        const chain = {
          eq() {
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
  return { events, client: { from } as unknown as SupabaseClient };
}

describe("Plano 08 — persistência do estado da copy (F8)", () => {
  it("recordCopyState faz UPSERT na tabela dedicada (identidade por operação)", async () => {
    const { client, events } = makeFakeSupabase();
    await recordCopyState(client, { campaignId: CAMPAIGN_ID, operationId: OPERATION_ID, state: "pending" });

    expect(events).toHaveLength(1);
    expect(events[0].table).toBe("product_1_1_copy_state");
    expect(events[0].op).toBe("upsert");
    expect(events[0].payload).toMatchObject({
      campaign_id: CAMPAIGN_ID,
      operation_id: OPERATION_ID,
      state: "pending",
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

  it("recordCancellation grava numa tabela SEPARADA (nunca no estado da copy)", async () => {
    const { client, events } = makeFakeSupabase();
    await recordCancellation(client, {
      campaignId: CAMPAIGN_ID,
      operationId: OPERATION_ID,
      reason: "cancelled_by_owner",
    });

    expect(events).toHaveLength(1);
    expect(events[0].table).toBe("product_1_1_copy_cancellations");
    expect(events[0].op).toBe("insert");
    expect(events[0].payload).toMatchObject({ reason: "cancelled_by_owner" });
  });
});

// ---------------------------------------------------------------------------
// Task 1(c) — drenagem no ciclo da requisição com orçamento (sem órfã)
// ---------------------------------------------------------------------------

function makeDrainStore() {
  const stateCalls: CopyState[] = [];
  const cancelCalls: string[] = [];
  const store = {
    async recordCopyState(input: { state: CopyState }) {
      stateCalls.push(input.state);
    },
    async recordCancellation(input: { reason: string }) {
      cancelCalls.push(input.reason);
    },
  };
  return { store, stateCalls, cancelCalls };
}

describe("Plano 08 — drenagem da copy com orçamento (F8)", () => {
  it("sucesso ⇒ persiste pending → completed, SEM cancelamento", async () => {
    const { store, stateCalls, cancelCalls } = makeDrainStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        signal: new AbortController().signal,
        run: async () => {},
      },
      store,
    );

    expect(result).toEqual({ state: "completed", canceled: false });
    expect(stateCalls).toEqual(["pending", "completed"]);
    expect(cancelCalls).toEqual([]);
  });

  it("falha (não cancelada) ⇒ persiste failed e NÃO registra cancelamento", async () => {
    const { store, stateCalls, cancelCalls } = makeDrainStore();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
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

  it("orçamento esgotado ⇒ CANCELA, persiste failed determinístico e registra cancelamento SEPARADO", async () => {
    const { store, stateCalls, cancelCalls } = makeDrainStore();
    const budget = createCopyBudgetSignal(0);
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
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
    expect(stateCalls).toEqual(["pending", "failed"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);
  });

  it("Gap 1: o texto entregue é persistido via `commit` (estado `completed` + copyText)", async () => {
    const deliveries: Array<{ state: CopyState; copyText?: string | null }> = [];
    const store = {
      async recordCopyState(input: { state: CopyState; copyText?: string | null }) {
        deliveries.push({ state: input.state, copyText: input.copyText });
      },
      async recordCancellation() {},
    };
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
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
    const { store, stateCalls, cancelCalls } = makeDrainStore();
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
    expect(stateCalls).toEqual(["pending", "failed"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);

    // A conclusão TARDIA tenta persistir, mas o latch bloqueia: nada é escrito.
    releaseLate?.();
    await new Promise((r) => setTimeout(r, 10));
    await lateCommit?.();
    expect(stateCalls).toEqual(["pending", "failed"]);
    expect(cancelCalls).toEqual([COPY_CANCELLATION_REASON]);
  });

  it("Gap 3/P2: escritas de persistência têm orçamento PRÓPRIO (store pendurado não prende o drenador) e persistência NÃO provada não vira `completed`", async () => {
    const store = {
      async recordCopyState() {
        // Escrita que NUNCA resolve — o teto das escritas deve liberar o drenador.
        await new Promise<void>(() => {});
      },
      async recordCancellation() {
        await new Promise<void>(() => {});
      },
    };
    const started = Date.now();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto" });
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );
    // Determinístico apesar da escrita pendurada — e NUNCA `completed` sem
    // persistência PROVADA (a escrita do texto pendurou ⇒ timeout).
    expect(result).toEqual({ state: "failed", canceled: false });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("P2(a): FALHA de persistência do texto ⇒ NÃO declara `completed`", async () => {
    const attempts: CopyState[] = [];
    const store = {
      async recordCopyState(input: { state: CopyState }) {
        attempts.push(input.state);
        if (input.state === "completed") {
          throw new Error("product_1_1_copy_state_upsert_failed");
        }
      },
      async recordCancellation() {},
    };
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
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

  it("P2(b): escrita do texto que PENDURA ⇒ NÃO declara `completed` e o drenador é LIMITADO", async () => {
    const attempts: CopyState[] = [];
    const store = {
      async recordCopyState(input: { state: CopyState }) {
        attempts.push(input.state);
        if (input.state === "completed") {
          // Pendura SOMENTE a escrita do texto além do teto.
          await new Promise<void>(() => {});
        }
      },
      async recordCancellation() {},
    };
    const started = Date.now();
    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        signal: new AbortController().signal,
        run: async ({ commit }) => {
          await commit({ copyText: "texto" });
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );

    // Persistência não provada (timeout) ⇒ `failed`, e o drenador retorna no teto.
    expect(result).toEqual({ state: "failed", canceled: false });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("P2(c): escrita de store ATRASADA que resolve APÓS o cancelamento NÃO sobrescreve o estado final", async () => {
    let persisted: CopyState | null = null;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = {
      async recordCopyState(input: { state: CopyState }) {
        // A escrita do texto é ATRASADA: só resolve quando liberada (depois do
        // cancelamento). Não é um `commit` tardio da task — é uma escrita de
        // STORE em voo que resolve após o settle.
        if (input.state === "completed") {
          await gate;
        }
        persisted = input.state;
      },
      async recordCancellation() {},
    };
    const controller = new AbortController();

    const result = await drainCopyTask(
      {
        campaignId: CAMPAIGN_ID,
        operationId: OPERATION_ID,
        signal: controller.signal,
        run: async ({ commit }) => {
          void commit({ copyText: "tarde demais" });
          // Cancela logo após disparar a escrita (orçamento esgotado), ignorando
          // o abort — a escrita do store permanece EM VOO.
          queueMicrotask(() => controller.abort());
          await new Promise<void>(() => {});
        },
      },
      store,
      { persistenceBudgetMs: 5 },
    );

    expect(result).toEqual({ state: "failed", canceled: true });
    // A escrita atrasada ainda não resolveu ⇒ nada a sobrescreveu ainda.
    expect(persisted).toBe("pending");

    // Liberamos a escrita atrasada: ela grava `completed`, mas a escrita do estado
    // SETTLED (`failed`) está SERIALIZADA depois e, portanto, prevalece — uma
    // escrita em voo NUNCA é a última a gravar após o settle.
    release();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(persisted).toBe("failed");
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
// Task 2(a) — envelope/custo por tentativa + sequência reconstruível
// ---------------------------------------------------------------------------

describe("Plano 08 — envelope por tentativa (REQ-12)", () => {
  it("emitAttemptEnvelope resolve o par do SNAPSHOT (modelo/qualidade/alvo/attempt_number)", async () => {
    const emitted: AttemptEnvelope[] = [];
    const envelope = await emitAttemptEnvelope(
      {
        snapshot: SNAPSHOT,
        attemptNumber: 2,
        target: "fallback",
        result: "success",
        internalCostUsd: 0.03,
        runId: "run-1",
        traceId: "trace-1",
      },
      { emit: (e) => {
          emitted.push(e);
        } },
    );

    expect(envelope).toMatchObject({
      attemptNumber: 2,
      target: "fallback",
      model: "gpt-image-2",
      quality: "medium",
      result: "success",
      internalCostUsd: 0.03,
    });
    expect(emitted).toEqual([envelope]);
  });

  it("Gap 4: a emissão AGUARDA o sink e uma falha do sink NÃO vira rejeição não tratada", async () => {
    let resolved = false;
    const envelope = await emitAttemptEnvelope(
      {
        snapshot: SNAPSHOT,
        attemptNumber: 1,
        target: "primary",
        result: "success",
      },
      {
        emit: async () => {
          await new Promise((r) => setTimeout(r, 5));
          resolved = true;
          throw new Error("sink_down");
        },
      },
    );
    // A emissão foi AGUARDADA (o sink completou) e a falha foi contida.
    expect(resolved).toBe(true);
    expect(envelope.internalCostUsd).toBeNull();
  });

  it("custo ausente nunca vira valor inventado (null)", async () => {
    const envelope = await emitAttemptEnvelope({
      snapshot: SNAPSHOT,
      attemptNumber: 1,
      target: "primary",
      result: "failed",
    });
    expect(envelope.internalCostUsd).toBeNull();
  });

  it("a sequência principal (×2) + fallback (×1) é reconstruível", async () => {
    const envelopes: AttemptEnvelope[] = await Promise.all(
      [1, 2, 3].map((n, index) =>
        emitAttemptEnvelope({
          snapshot: SNAPSHOT,
          attemptNumber: n,
          target: index < 2 ? "primary" : "fallback",
          result: index < 2 ? "failed" : "success",
          runId: "run-1",
          traceId: "trace-1",
        }),
      ),
    );

    const sequence = reconstructAttemptSequence(SNAPSHOT, envelopes);
    expect(sequence).toEqual([
      { attemptNumber: 1, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 2, target: "primary", model: "gpt-image-2.5-sunburst", quality: "medium" },
      { attemptNumber: 3, target: "fallback", model: "gpt-image-2", quality: "medium" },
    ]);
  });

  it("buildAttemptTelemetry REUSA o caminho existente (createDefaultTelemetryContext)", () => {
    const context = buildAttemptTelemetry({
      operationRunId: "run-1",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
    });
    expect(context).toMatchObject({ campaignId: CAMPAIGN_ID, attemptNumber: 1 });
    expect(typeof context.sink.emit).toBe("function");
  });

  it("a instrumentação do novo fluxo NÃO usa a resolução legada sem qualidade (`resolveAiCost`)", () => {
    expect(INSTRUMENTATION_SOURCE).toContain("createDefaultTelemetryContext");
    expect(INSTRUMENTATION_SOURCE).not.toMatch(/resolveAiCost\s*\(/);
    // Gap 4 — o custo interno vem da pricing do NOVO FLUXO (modelo + qualidade).
    expect(INSTRUMENTATION_SOURCE).toContain("resolveImagePairCost");
    expect(INSTRUMENTATION_SOURCE).toContain("defaultResolveAttemptCost");
    // Destino persistente do envelope reutiliza o caminho existente (AiCostTracker).
    expect(INSTRUMENTATION_SOURCE).toContain("createDurableAttemptEnvelopeSink");
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
  readonly envelopes: AttemptEnvelope[];
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
  const envelopes: AttemptEnvelope[] = [];
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
    async invoke(_capability, request): Promise<AiInvocationResult> {
      providerCalls += 1;
      const next = providerSequence[providerIndex] ?? {
        imageBase64: "AAAA",
        mimeType: "image/png",
        model: "gpt-image-2.5-sunburst",
      };
      providerIndex += 1;
      void request;
      if (next instanceof Error) throw next;
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
    createTelemetry: (): AiTelemetryContext => ({
      operationRunId: "run-1",
      operationRunType: "campaign_delivery",
      traceId: "trace-1",
      storeId: STORE_ID,
      campaignId: CAMPAIGN_ID,
      attemptNumber: 1,
      sink: { emit: async () => {} },
    }),
    recordAttempt: vi.fn(async () => ({ id: "op-row-1", operationId: OPERATION_ID })),
    recordDiagnosis: vi.fn(async () => ({ reference: "ref-test" })),
    generateSupportReference: () => "66666666-6666-4666-8666-666666666666",
    onAttemptEnvelope: (envelope: AttemptEnvelope) => {
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
    (harness.deps as Record<string, unknown>).copy = {
      runCopy: async () => {
        throw new Error("copy_director_failed");
      },
      recordCopyState: async (input: { state: CopyState }) => {
        harness.copyStates.push(input.state);
      },
      recordCancellation: async (input: { reason: string }) => {
        harness.copyCancellations.push(input.reason);
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
    (harness.deps as Record<string, unknown>).copy = {
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
      recordCopyState: async (input: { state: CopyState }) => {
        harness.copyStates.push(input.state);
      },
      recordCancellation: async (input: { reason: string }) => {
        harness.copyCancellations.push(input.reason);
      },
    };

    const { terminal } = await runOrchestrator(harness);

    // A entrega da imagem é independente do estado da copy.
    expect(terminal).toMatchObject({ type: "result" });
    expect(harness.calls.deliver).toHaveBeenCalledTimes(1);
    // A copy foi cancelada (orçamento) e o estado foi persistido ANTES de encerrar.
    expect(harness.copyStates).toEqual(["pending", "failed"]);
    expect(harness.copyCancellations).toEqual([COPY_CANCELLATION_REASON]);
  });
});

describe("Plano 08 — envelope por tentativa no orquestrador (REQ-12)", () => {
  it("cada tentativa real emite exatamente um envelope; a sequência é reconstruível", async () => {
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
    // UM envelope por tentativa real (2 principal + 1 fallback).
    expect(harness.envelopes).toHaveLength(3);
    expect(harness.envelopes.map((e) => e.target)).toEqual(["primary", "primary", "fallback"]);
    expect(harness.envelopes.map((e) => e.attemptNumber)).toEqual([1, 2, 3]);
    expect(harness.envelopes.map((e) => e.result)).toEqual(["failed", "failed", "success"]);

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

  it("o orquestrador emite envelope por tentativa e persiste o diagnóstico durável centralizado", () => {
    expect(ORCHESTRATOR_SOURCE).toContain("emitAttemptEnvelope");
    expect(ORCHESTRATOR_SOURCE).toContain("recordFailureDiagnosis");
    expect(ORCHESTRATOR_SOURCE).not.toContain("toInternalDiagnosis(");
  });
});
