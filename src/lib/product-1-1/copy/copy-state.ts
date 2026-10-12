import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * F56.2b1b — Estado da copy não bloqueante do Produto 1:1 (Plano 08, F8 /
 * REQ-56.2.2-11).
 *
 * A copy roda em PARALELO com a geração da imagem. Seu estado é persistido em
 * armazenamento ESCOLHIDO e explícito (`public.product_1_1_copy_state`, uma
 * linha por `campaign_id` + `operation_id`) e a copy é DRENADA dentro do CICLO
 * da requisição com um orçamento de espera/cancelamento — nenhuma task órfã
 * permanece após a resposta.
 *
 * Correção de integração (reconciliação do Plano 08):
 *  - **Gap 1** — o TEXTO entregue pela copy (não só o estado) é persistido
 *    (`copy_text`/`copy_payload`) e recuperável, via `commit(...)` no drenador;
 *  - **Gap 3** — `drainCopyTask` NÃO declara ausência de órfã com base apenas em
 *    `Promise.race`: o commit é LATChado (uma conclusão tardia após o
 *    cancelamento NUNCA persiste/substitui o estado cancelado) e as escritas de
 *    persistência têm orçamento próprio (`COPY_PERSISTENCE_BUDGET_MS`).
 *
 * Invariantes:
 *  - falha/cancelamento da copy NUNCA bloqueia a entrega da imagem e NUNCA
 *    reverte a reserva de crédito;
 *  - CANCELAMENTO é registrado SEPARADamente do estado da copy
 *    (`public.product_1_1_copy_cancellations`) e nunca é confundido com falha
 *    de geração;
 *  - NÃO existe ação/endpoint de retry nesta fatia (retry pertence à b2) —
 *    nenhuma retomada automática é prometida.
 *
 * Este módulo define apenas os contratos e o drenador determinístico; a
 * correção de persistência vive no Postgres/PostgREST e o client é injetável
 * (seam testável, espelhando `image-generation-diagnosis-repository.ts`).
 */

/** Estados persistidos da copy (nunca inferidos; sempre persistidos). */
export type CopyState = "pending" | "completed" | "failed";

/** Orçamento PADRÃO (ms) da copy dentro do ciclo da requisição. */
export const COPY_BUDGET_MS = 30_000;

/**
 * Orçamento PADRÃO (ms) das ESCRITAS de estado da copy. Uma escrita de store que
 * pendurar NÃO pode prender o drenador além deste teto (gap 3 — as escritas
 * `safeRecord` têm orçamento próprio, distinto do orçamento da task).
 */
export const COPY_PERSISTENCE_BUDGET_MS = 5_000;

/** Motivo determinístico do cancelamento por orçamento esgotado. */
export const COPY_CANCELLATION_REASON = "copy_budget_exceeded" as const;

export const COPY_STATE_TABLE = "product_1_1_copy_state" as const;
export const COPY_CANCELLATION_TABLE = "product_1_1_copy_cancellations" as const;

/** Texto/payload ENTREGUE pela copy, persistido junto do estado `completed`. */
export interface CopyDelivery {
  /** Texto principal entregue (ex.: `caption`), persistido em `copy_text`. */
  readonly copyText: string;
  /** Payload estruturado (título/legenda/hashtags/cta) em `copy_payload`. */
  readonly payload?: Record<string, unknown> | null;
}

/** Persiste o texto entregue; NO-OP após o settle (cancelamento/persistência). */
export type CopyCommit = (delivery: CopyDelivery) => Promise<void>;

export interface RecordCopyStateInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly state: CopyState;
  /**
   * Gap 1 — texto entregue (persistido em `copy_text`). Ausente quando o estado
   * é `pending`/`failed` (não há texto entregue).
   */
  readonly copyText?: string | null;
  /** Gap 1 — payload estruturado entregue (persistido em `copy_payload`). */
  readonly copyPayload?: Record<string, unknown> | null;
}

export interface RecordCancellationInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly reason: string;
}

/** Modelo de leitura do estado + texto/payload entregues. */
export interface CopyDeliveryRecord {
  readonly state: CopyState;
  readonly copyText: string | null;
  readonly copyPayload: Record<string, unknown> | null;
}

/** Seam de persistência do estado da copy (injetável; default Supabase). */
export interface CopyStateStore {
  recordCopyState(input: RecordCopyStateInput): Promise<void>;
  recordCancellation(input: RecordCancellationInput): Promise<void>;
}

/** UPSERT do estado CORRENTE da copy (uma linha por operação). */
export async function recordCopyState(
  client: SupabaseClient,
  input: RecordCopyStateInput,
): Promise<void> {
  const { error } = await client.from(COPY_STATE_TABLE).upsert(
    {
      campaign_id: input.campaignId,
      operation_id: input.operationId,
      state: input.state,
      // Gap 1 — o texto/payload entregue acompanha o estado `completed`.
      ...(input.copyText !== undefined ? { copy_text: input.copyText } : {}),
      ...(input.copyPayload !== undefined ? { copy_payload: input.copyPayload } : {}),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "campaign_id,operation_id" },
  );
  if (error) {
    throw new Error(`product_1_1_copy_state_upsert_failed:${error.message}`);
  }
}

/** Lê o estado persistido da copy (`null` quando ainda não existe linha). */
export async function readCopyState(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<CopyState | null> {
  const { data, error } = await client
    .from(COPY_STATE_TABLE)
    .select("state")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .maybeSingle<{ state: CopyState }>();

  if (error) {
    throw new Error(`product_1_1_copy_state_read_failed:${error.message}`);
  }
  return data?.state ?? null;
}

/**
 * Gap 1 — lê o estado E o texto/payload ENTREGUES pela copy (`null` quando não
 * existe linha). Permite à campanha recuperar o texto entregue, não apenas o
 * estado.
 */
export async function readCopyDelivery(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<CopyDeliveryRecord | null> {
  const { data, error } = await client
    .from(COPY_STATE_TABLE)
    .select("state, copy_text, copy_payload")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .maybeSingle<{
      state: CopyState;
      copy_text: string | null;
      copy_payload: Record<string, unknown> | null;
    }>();

  if (error) {
    throw new Error(`product_1_1_copy_state_delivery_read_failed:${error.message}`);
  }
  if (!data) return null;
  return {
    state: data.state,
    copyText: data.copy_text ?? null,
    copyPayload: data.copy_payload ?? null,
  };
}

/**
 * Registra o CANCELAMENTO separadamente do estado da copy (tabela própria,
 * append-only). Nunca é confundido com `state = 'failed'` nem com falha de
 * geração.
 */
export async function recordCancellation(
  client: SupabaseClient,
  input: RecordCancellationInput,
): Promise<void> {
  const { error } = await client.from(COPY_CANCELLATION_TABLE).insert({
    campaign_id: input.campaignId,
    operation_id: input.operationId,
    reason: input.reason,
  });
  if (error) {
    throw new Error(`product_1_1_copy_cancellation_insert_failed:${error.message}`);
  }
}

/** Store Supabase-backed com client injetado (default de produção). */
export function createSupabaseCopyStateStore(client: SupabaseClient): CopyStateStore {
  return {
    recordCopyState: (input) => recordCopyState(client, input),
    recordCancellation: (input) => recordCancellation(client, input),
  };
}

/** Orçamento de espera/cancelamento da copy (sinal + dispose do timer). */
export interface CopyBudgetSignal {
  readonly signal: AbortSignal;
  dispose(): void;
}

/**
 * Cria o orçamento da copy como um `AbortSignal`. Ao expirar, a copy é
 * CANCELADA (abort) e o drenador persistirá `failed` + o cancelamento SEPARADO.
 * Determinístico e injetável (testes fornecem seu próprio orçamento).
 */
export function createCopyBudgetSignal(
  budgetMs: number,
  timers: {
    setTimeout: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  } = { setTimeout, clearTimeout },
): CopyBudgetSignal {
  const controller = new AbortController();
  const budget = Math.max(0, budgetMs);
  const id = timers.setTimeout(() => controller.abort(), budget);
  return {
    signal: controller.signal,
    dispose: () => timers.clearTimeout(id),
  };
}

/** Resultado determinístico da drenagem da copy. */
export interface DrainCopyTaskResult {
  readonly state: "completed" | "failed";
  /** `true` quando o orçamento esgotou e a copy foi CANCELADA. */
  readonly canceled: boolean;
}

export interface DrainCopyTaskRunContext {
  /** Abortado quando o orçamento esgotar; a task REAL DEVE respeitá-lo. */
  readonly signal: AbortSignal;
  /**
   * Persiste o TEXTO entregue. É um NO-OP determinístico após o settle (a
   * conclusão tardia após o cancelamento NUNCA persiste/substitui o estado).
   */
  readonly commit: CopyCommit;
}

export interface DrainCopyTaskInput {
  readonly campaignId: string;
  readonly operationId: string;
  /** Abortado quando o orçamento esgotar. */
  readonly signal: AbortSignal;
  /**
   * A task da copy; recebe o sinal (para cooperar com o cancelamento) e o
   * `commit` (para persistir o texto entregue de forma latChada).
   */
  readonly run: (context: DrainCopyTaskRunContext) => Promise<void>;
}

export interface DrainCopyTaskOptions {
  /** Orçamento das escritas de persistência (ms). Default `COPY_PERSISTENCE_BUDGET_MS`. */
  readonly persistenceBudgetMs?: number;
  /** Timers injetáveis (testes provam o teto das escritas). */
  readonly timers?: {
    setTimeout: (handler: () => void, ms: number) => ReturnType<typeof setTimeout>;
    clearTimeout: (id: ReturnType<typeof setTimeout>) => void;
  };
}

/**
 * Executa uma escrita de store com ORÇAMENTO PRÓPRIO (gap 3): nunca prende o
 * drenador além de `budgetMs`, e nunca dispara rejeição não tratada se a escrita
 * pendurar e resolver/rejeitar depois do teto.
 */
function boundedRecord(
  action: () => Promise<void>,
  budgetMs: number,
  timers: NonNullable<DrainCopyTaskOptions["timers"]>,
): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const id = timers.setTimeout(finish, Math.max(0, budgetMs));
    Promise.resolve()
      .then(action)
      .then(
        () => {
          timers.clearTimeout(id);
          finish();
        },
        () => {
          timers.clearTimeout(id);
          finish();
        },
      );
  });
}

/**
 * Drena a task da copy DENTRO do ciclo da requisição (F8):
 *
 *  1. persiste `pending`;
 *  2. corre a task até o orçamento esgotar OU até terminar;
 *  3. a task persiste o TEXTO entregue via `commit` (latch: uma conclusão tardia
 *     após o cancelamento nunca persiste);
 *  4. ao terminar sem `commit` → persiste `completed` (estado, sem texto);
 *  5. ao falhar → persiste `failed` (sem cancelamento);
 *  6. ao CANCELAR (orçamento esgotado) → persiste `failed` DETERMINISTICAMENTE e
 *     registra o cancelamento SEPARADO — sem órfã, sem retry.
 *
 * O `Promise.race` encerra a ESPERA, e o ORÇAMENTO das escritas
 * (`persistenceBudgetMs`) garante que nem uma escrita pendurada nem uma
 * conclusão tardia da task prendem/poluem o resultado. A ausência de órfã NÃO é
 * declarada apenas pelo `race`: o `commit` latChado bloqueia persistência tardia.
 */
export async function drainCopyTask(
  input: DrainCopyTaskInput,
  store: CopyStateStore,
  options: DrainCopyTaskOptions = {},
): Promise<DrainCopyTaskResult> {
  const budgetMs = options.persistenceBudgetMs ?? COPY_PERSISTENCE_BUDGET_MS;
  const timers = options.timers ?? { setTimeout, clearTimeout };

  // Latch: após o settle, qualquer `commit` (tardio) é um NO-OP determinístico.
  const latch = { settled: false, committed: false };

  const commit: CopyCommit = async (delivery) => {
    if (latch.settled || latch.committed) return;
    latch.committed = true;
    await boundedRecord(
      () =>
        store.recordCopyState({
          campaignId: input.campaignId,
          operationId: input.operationId,
          state: "completed",
          copyText: delivery.copyText,
          copyPayload: delivery.payload ?? null,
        }),
      budgetMs,
      timers,
    );
  };

  await boundedRecord(
    () =>
      store.recordCopyState({
        campaignId: input.campaignId,
        operationId: input.operationId,
        state: "pending",
      }),
    budgetMs,
    timers,
  );

  const aborted = new Promise<DrainCopyTaskResult & { committed: boolean }>((resolve) => {
    if (input.signal.aborted) {
      resolve({ state: "failed", canceled: true, committed: false });
      return;
    }
    input.signal.addEventListener(
      "abort",
      () => resolve({ state: "failed", canceled: true, committed: false }),
      { once: true },
    );
  });

  const ran: Promise<DrainCopyTaskResult & { committed: boolean }> = input
    .run({ signal: input.signal, commit })
    .then(
      () => ({
        // Uma task que commitou o texto É bem-sucedida, mesmo se resolver depois.
        state: "completed" as const,
        canceled: false,
        committed: latch.committed,
      }),
      () => ({
        // Falha/abort: se o commit já ocorreu, o texto prevalece; senão `failed`.
        state: latch.committed ? ("completed" as const) : ("failed" as const),
        canceled: !latch.committed && input.signal.aborted,
        committed: latch.committed,
      }),
    );

  const result = await Promise.race([ran, aborted]);

  // Settle: a partir daqui, `commit` tardio é NO-OP (nunca sobrescreve o estado
  // cancelado nem escreve `completed` após o cancelamento registrado).
  latch.settled = true;

  if (result.state === "completed") {
    if (!latch.committed) {
      await boundedRecord(
        () =>
          store.recordCopyState({
            campaignId: input.campaignId,
            operationId: input.operationId,
            state: "completed",
          }),
        budgetMs,
        timers,
      );
    }
  } else {
    await boundedRecord(
      () =>
        store.recordCopyState({
          campaignId: input.campaignId,
          operationId: input.operationId,
          state: "failed",
        }),
      budgetMs,
      timers,
    );
    if (result.canceled) {
      await boundedRecord(
        () =>
          store.recordCancellation({
            campaignId: input.campaignId,
            operationId: input.operationId,
            reason: COPY_CANCELLATION_REASON,
          }),
        budgetMs,
        timers,
      );
    }
  }

  return { state: result.state, canceled: result.canceled };
}
