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

/** Motivo determinístico do cancelamento por orçamento esgotado. */
export const COPY_CANCELLATION_REASON = "copy_budget_exceeded" as const;

export const COPY_STATE_TABLE = "product_1_1_copy_state" as const;
export const COPY_CANCELLATION_TABLE = "product_1_1_copy_cancellations" as const;

export interface RecordCopyStateInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly state: CopyState;
}

export interface RecordCancellationInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly reason: string;
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

export interface DrainCopyTaskInput {
  readonly campaignId: string;
  readonly operationId: string;
  /** Abortado quando o orçamento esgotar. */
  readonly signal: AbortSignal;
  /** A task da copy; recebe o sinal para cooperar com o cancelamento. */
  readonly run: (signal: AbortSignal) => Promise<void>;
}

async function safeRecord(
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch {
    // Best-effort: persistência do estado da copy nunca bloqueia a entrega.
  }
}

/**
 * Drena a task da copy DENTRO do ciclo da requisição (F8):
 *
 *  1. persiste `pending`;
 *  2. corre a task até o orçamento esgotar OU até terminar;
 *  3. ao terminar com sucesso → persiste `completed`;
 *  4. ao falhar → persiste `failed` (sem cancelamento);
 *  5. ao CANCELAR (orçamento esgotado) → persiste `failed` DETERMINISTICAMENTE e
 *     registra o cancelamento SEPARADO — sem órfã, sem retry.
 *
 * A corrida contra o sinal garante que o retorno acontece MESMO se a task
 * ignorar o abort — o chamador nunca aguarda indefinidamente a copy.
 */
export async function drainCopyTask(
  input: DrainCopyTaskInput,
  store: CopyStateStore,
): Promise<DrainCopyTaskResult> {
  await safeRecord(() =>
    store.recordCopyState({
      campaignId: input.campaignId,
      operationId: input.operationId,
      state: "pending",
    }),
  );

  const aborted = new Promise<DrainCopyTaskResult>((resolve) => {
    if (input.signal.aborted) {
      resolve({ state: "failed", canceled: true });
      return;
    }
    input.signal.addEventListener(
      "abort",
      () => resolve({ state: "failed", canceled: true }),
      { once: true },
    );
  });

  const ran: Promise<DrainCopyTaskResult> = input.run(input.signal).then(
    () => ({ state: "completed" as const, canceled: false }),
    () => ({ state: "failed" as const, canceled: input.signal.aborted }),
  );

  const result = await Promise.race([ran, aborted]);

  await safeRecord(() =>
    store.recordCopyState({
      campaignId: input.campaignId,
      operationId: input.operationId,
      state: result.state,
    }),
  );
  if (result.canceled) {
    await safeRecord(() =>
      store.recordCancellation({
        campaignId: input.campaignId,
        operationId: input.operationId,
        reason: COPY_CANCELLATION_REASON,
      }),
    );
  }

  return result;
}
