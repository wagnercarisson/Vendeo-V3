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

/**
 * Lê o CANCELAMENTO registrado para a operação (`null` quando não houve). Permite
 * à campanha distinguir `failed` de `canceled` no feedback seguro — nunca confunde
 * cancelamento por orçamento com falha de geração.
 */
export async function readCopyCancellation(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<{ reason: string } | null> {
  const { data, error } = await client
    .from(COPY_CANCELLATION_TABLE)
    .select("reason")
    .eq("campaign_id", input.campaignId)
    .eq("operation_id", input.operationId)
    .limit(1)
    .maybeSingle<{ reason: string }>();

  if (error) {
    throw new Error(`product_1_1_copy_cancellation_read_failed:${error.message}`);
  }
  return data ?? null;
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
 * Resultado PROVADO de uma escrita de store: `success` (a escrita resolveu),
 * `error` (a escrita rejeitou) ou `timeout` (o teto esgotou antes de resolver).
 * O drenador SÓ confirma `completed` quando a escrita que o estabelece retorna
 * `success` (persistência PROVADA) — `error`/`timeout` NUNCA contam como sucesso.
 */
export type RecordOutcome = "success" | "error" | "timeout";

/**
 * Executa uma escrita de store com ORÇAMENTO PRÓPRIO (gap 3): nunca prende o
 * drenador além de `budgetMs`, e nunca dispara rejeição não tratada se a escrita
 * pendurar e resolver/rejeitar depois do teto. Distingue sucesso × erro × timeout
 * (correção de integração: a confirmação de `completed` depende de persistência
 * PROVADA, nunca de uma escrita apenas DISPARADA).
 */
function boundedRecord(
  action: () => Promise<void>,
  budgetMs: number,
  timers: NonNullable<DrainCopyTaskOptions["timers"]>,
): Promise<RecordOutcome> {
  return new Promise<RecordOutcome>((resolve) => {
    let settled = false;
    const finish = (outcome: RecordOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const id = timers.setTimeout(() => finish("timeout"), Math.max(0, budgetMs));
    Promise.resolve()
      .then(action)
      .then(
        () => {
          timers.clearTimeout(id);
          finish("success");
        },
        () => {
          timers.clearTimeout(id);
          finish("error");
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
 *  4. `completed` é confirmado SOMENTE com persistência PROVADA — uma escrita que
 *     rejeita (`error`) ou que pendura além do teto (`timeout`) NUNCA declara
 *     `completed`;
 *  5. ao falhar → persiste `failed` (sem cancelamento);
 *  6. ao CANCELAR (orçamento esgotado) → persiste `failed` DETERMINISTICAMENTE e
 *     registra o cancelamento SEPARADO — sem órfã, sem retry.
 *
 * Correção de integração (reconciliação do Plano 08):
 *  - o latch só marca `committed` APÓS a escrita do texto resolver com sucesso
 *    (antes, o latch confirmava `completed` apenas com a escrita DISPARADA — o
 *    drenador podia declarar `completed` sem o texto persistido);
 *  - TODAS as escritas de estado são SERIALIZADAS numa fila; assim a escrita do
 *    estado SETTLED (final/cancelado) é aplicada DEPOIS de qualquer escrita em
 *    voo — uma escrita de store atrasada que resolve após o cancelamento NUNCA é
 *    a última a gravar (não sobrescreve o estado final/cancelado);
 *  - o orçamento das escritas (`persistenceBudgetMs`) mantém o drenador limitado
 *    mesmo quando uma escrita pendura (o drenador retorna no teto).
 *
 * O `Promise.race` encerra a ESPERA e o `commit` latChado bloqueia persistência
 * tardia da task; a fila serializada impede que uma escrita em voo sobrescreva o
 * estado já settled.
 */
export async function drainCopyTask(
  input: DrainCopyTaskInput,
  store: CopyStateStore,
  options: DrainCopyTaskOptions = {},
): Promise<DrainCopyTaskResult> {
  const budgetMs = options.persistenceBudgetMs ?? COPY_PERSISTENCE_BUDGET_MS;
  const timers = options.timers ?? { setTimeout, clearTimeout };

  // Latch: `settled` encerra o drenador; `attempted` marca que a task tentou
  // persistir o texto; `committed` só é `true` com persistência PROVADA.
  const latch = { settled: false, committed: false, attempted: false };

  // Fila SERIALIZADA de escritas: cada escrita só roda após a anterior resolver
  // (mesmo se rejeitar). Garante que a escrita do estado settled é a ÚLTIMA
  // aplicada, mesmo com uma escrita em voo que resolve atrasada.
  let writeChain: Promise<unknown> = Promise.resolve();
  const schedule = (action: () => Promise<void>): Promise<void> => {
    const run = writeChain.then(action);
    writeChain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };

  const recordState = (
    state: CopyState,
    extra?: Pick<RecordCopyStateInput, "copyText" | "copyPayload">,
  ): Promise<RecordOutcome> =>
    boundedRecord(
      () =>
        schedule(() =>
          store.recordCopyState({
            campaignId: input.campaignId,
            operationId: input.operationId,
            state,
            ...(extra ?? {}),
          }),
        ),
      budgetMs,
      timers,
    );

  const recordCancellationBounded = (): Promise<RecordOutcome> =>
    boundedRecord(
      () =>
        schedule(() =>
          store.recordCancellation({
            campaignId: input.campaignId,
            operationId: input.operationId,
            reason: COPY_CANCELLATION_REASON,
          }),
        ),
      budgetMs,
      timers,
    );

  const commit: CopyCommit = async (delivery) => {
    // NO-OP determinístico: após o settle, ou após uma tentativa de commit.
    if (latch.settled || latch.attempted) return;
    latch.attempted = true;
    const outcome = await recordState("completed", {
      copyText: delivery.copyText,
      copyPayload: delivery.payload ?? null,
    });
    // Só PROVA a conclusão com a escrita bem-sucedida — erro/timeout NUNCA conta.
    if (outcome === "success") {
      latch.committed = true;
    }
  };

  await recordState("pending");

  const aborted = new Promise<{ canceled: boolean }>((resolve) => {
    if (input.signal.aborted) {
      resolve({ canceled: true });
      return;
    }
    input.signal.addEventListener("abort", () => resolve({ canceled: true }), { once: true });
  });

  const ran: Promise<{ state: "completed" | "failed"; canceled: boolean }> = input
    .run({ signal: input.signal, commit })
    .then(
      () => ({
        // Task resolvida: commit PROVADO ⇒ completed; commit tentado e NÃO provado
        // (erro/timeout) ⇒ failed (nunca `completed` sem persistência); sem commit
        // ⇒ o drenador persiste `completed` abaixo (persistência provada).
        state: latch.committed
          ? ("completed" as const)
          : latch.attempted
            ? ("failed" as const)
            : ("completed" as const),
        canceled: false,
      }),
      () => ({
        state: latch.committed ? ("completed" as const) : ("failed" as const),
        canceled: !latch.committed && input.signal.aborted,
      }),
    );

  const winner = await Promise.race([
    ran.then((value) => ({ kind: "ran" as const, ...value })),
    aborted.then((value) => ({ kind: "aborted" as const, state: "failed" as const, ...value })),
  ]);

  // Settle: a partir daqui, `commit` tardio é NO-OP (nunca sobrescreve o estado
  // cancelado nem escreve `completed` após o cancelamento registrado).
  latch.settled = true;

  if (winner.state === "completed") {
    if (latch.committed) {
      // Texto já persistido com PROVA — exatamente um registro `completed`.
      return { state: "completed", canceled: false };
    }
    // Task concluída sem `commit`: o drenador persiste `completed`, mas SÓ o
    // confirma se a escrita suceder; caso contrário, degrada para `failed`.
    const outcome = await recordState("completed");
    if (outcome === "success") {
      return { state: "completed", canceled: false };
    }
    await recordState("failed");
    return { state: "failed", canceled: false };
  }

  await recordState("failed");
  if (winner.canceled) {
    await recordCancellationBounded();
  }
  return { state: winner.state, canceled: winner.canceled };
}
