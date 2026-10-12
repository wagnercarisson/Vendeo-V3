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
 *    `Promise.race`: as escritas de persistência têm orçamento próprio
 *    (`COPY_PERSISTENCE_BUDGET_MS`).
 *
 * P2 (transição/ordem NO BANCO — reconciliado). A garantia de ORDEM/TRANSIÇÃO
 * NÃO vive mais numa fila EM MEMÓRIA (`writeChain`), que morria com o
 * processo/request: cada escrita é uma transição CONDICIONAL no banco via
 * `product_1_1_apply_copy_state` (terminal PROTEGIDO + replay vinculado a
 * CONTEÚDO; a corrida de primeira escrita é resolvida por RE-LEITURA sob trava).
 * O cancelamento usa `product_1_1_cancel_copy` (terminal `failed` + motivo numa
 * ÚNICA transação). Ambas as RPCs são `SECURITY DEFINER` e `service_role` tem
 * SELECT ONLY nas tabelas — um write direto é NEGADO.
 *
 *  - **A1** — "não confirmado" é incerteza LOCAL do CHAMADOR (`timeout`), NÃO um
 *    fato persistido: resolve-se por RE-LEITURA (`readCopyDelivery`), NUNCA por
 *    um segundo write de confirmação. O `state` PERSISTIDO é AUTORITATIVO.
 *  - **A3** — replay terminal EQUIVALENTE ⇒ `idempotent`; conteúdo DIVERGENTE ⇒
 *    `conflict` (o persistido permanece inalterado).
 *  - **C2** — `completed` EXIGE conteúdo ENTREGÁVEL: a RPC devolve
 *    `invalid_content` (nunca persiste `completed` sem texto). O cliente VALIDA
 *    o envelope e FALHA FECHADO.
 *
 * Invariantes:
 *  - falha/cancelamento da copy NUNCA bloqueia a entrega da imagem e NUNCA
 *    reverte a reserva de crédito;
 *  - CANCELAMENTO é registrado SEPARADAMENTE do estado da copy
 *    (`public.product_1_1_copy_cancellations`) e nunca é confundido com falha
 *    de geração;
 *  - NÃO existe ação/endpoint de retry nesta fatia (retry pertence à b2) —
 *    nenhuma retomada automática é prometida.
 *
 * Este módulo define os contratos (RPCs + validação de envelope + drenador
 * determinístico); a correção de persistência vive no Postgres/PostgREST e o
 * client é injetável (seam testável, espelhando
 * `image-generation-diagnosis-repository.ts`).
 */

/** Estados persistidos da copy (nunca inferidos; sempre persistidos). */
export type CopyState = "pending" | "completed" | "failed";

/** Orçamento PADRÃO (ms) da copy dentro do ciclo da requisição. */
export const COPY_BUDGET_MS = 30_000;

/**
 * Orçamento PADRÃO (ms) das ESCRITAS de estado da copy. Uma escrita de store que
 * pendurar NÃO pode prender o drenador além deste teto (gap 3 — as escritas de
 * persistência têm orçamento próprio, distinto do orçamento da task).
 */
export const COPY_PERSISTENCE_BUDGET_MS = 5_000;

/** Motivo determinístico do cancelamento por orçamento esgotado. */
export const COPY_CANCELLATION_REASON = "copy_budget_exceeded" as const;

export const COPY_STATE_TABLE = "product_1_1_copy_state" as const;
export const COPY_CANCELLATION_TABLE = "product_1_1_copy_cancellations" as const;

/** RPCs condicionais (RPC-only writes; `service_role` não escreve direto). */
export const APPLY_COPY_STATE_RPC = "product_1_1_apply_copy_state" as const;
export const CANCEL_COPY_RPC = "product_1_1_cancel_copy" as const;

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

/**
 * P2 — desfecho da transição CONDICIONAL (`product_1_1_apply_copy_state`).
 *   * `applied`         — transição/criação efetivada;
 *   * `idempotent`      — replay EQUIVALENTE (nenhuma escrita);
 *   * `conflict`        — MESMO terminal, conteúdo DIVERGENTE (persistido inalterado);
 *   * `rejected`        — terminal protegido / escrita não-terminal tardia;
 *   * `invalid_content` — `completed` sem texto entregável (C2).
 */
export type CopyStateOutcome =
  | "applied"
  | "idempotent"
  | "conflict"
  | "rejected"
  | "invalid_content";

/** Envelope devolvido por `product_1_1_apply_copy_state` (validado, fail-closed). */
export interface CopyStateTransitionResult {
  readonly applied: boolean;
  readonly outcome: CopyStateOutcome;
  /** Estado PERSISTIDO após a operação (`null` apenas em `invalid_content`). */
  readonly state: CopyState | null;
}

/** Envelope devolvido por `product_1_1_cancel_copy` (validado, fail-closed). */
export interface CopyCancellationResult {
  readonly applied: boolean;
  readonly state: CopyState | null;
  readonly canceled: boolean;
}

/** Modelo de leitura do estado + texto/payload entregues. */
export interface CopyDeliveryRecord {
  readonly state: CopyState;
  readonly copyText: string | null;
  readonly copyPayload: Record<string, unknown> | null;
}

/** Seam de persistência do estado da copy (injetável; default Supabase). */
export interface CopyStateStore {
  /** Aplica a transição condicional e devolve o envelope VALIDADO (fail-closed). */
  recordCopyState(input: RecordCopyStateInput): Promise<CopyStateTransitionResult>;
  /** Aplica o terminal `failed` + registra o motivo numa ÚNICA transação. */
  recordCancellation(input: RecordCancellationInput): Promise<CopyCancellationResult>;
}

const COPY_STATES: readonly CopyState[] = ["pending", "completed", "failed"];
const COPY_STATE_OUTCOMES: readonly CopyStateOutcome[] = [
  "applied",
  "idempotent",
  "conflict",
  "rejected",
  "invalid_content",
];

function isCopyState(value: unknown): value is CopyState {
  return typeof value === "string" && (COPY_STATES as readonly string[]).includes(value);
}

/**
 * C2 — VALIDA o envelope da RPC e FALHA FECHADO. Um retorno ausente, de tipo
 * errado ou CONTRADITÓRIO (ex.: `applied:true` com `outcome != 'applied'`, ou
 * `applied:true` sem `state`) NUNCA é tratado como persistência confirmada: o
 * cliente lança e o drenador NÃO declara sucesso.
 */
function parseCopyStateEnvelope(raw: unknown): CopyStateTransitionResult {
  if (raw === null || typeof raw !== "object") {
    throw new Error("product_1_1_apply_copy_state_invalid_envelope");
  }
  const envelope = raw as Record<string, unknown>;
  const applied = envelope.applied;
  const outcome = envelope.outcome;
  const state = envelope.state;

  if (typeof applied !== "boolean") {
    throw new Error("product_1_1_apply_copy_state_invalid_envelope");
  }
  if (
    typeof outcome !== "string" ||
    !(COPY_STATE_OUTCOMES as readonly string[]).includes(outcome)
  ) {
    throw new Error("product_1_1_apply_copy_state_invalid_envelope");
  }
  if (state !== null && state !== undefined && !isCopyState(state)) {
    throw new Error("product_1_1_apply_copy_state_invalid_envelope");
  }
  const normalizedState: CopyState | null = isCopyState(state) ? state : null;

  // Coerência aplicado × desfecho. Contradição ⇒ falha fechada.
  if (applied) {
    if (outcome !== "applied" || normalizedState === null) {
      throw new Error("product_1_1_apply_copy_state_incoherent_envelope");
    }
  } else if (outcome === "applied") {
    throw new Error("product_1_1_apply_copy_state_incoherent_envelope");
  }

  return { applied, outcome: outcome as CopyStateOutcome, state: normalizedState };
}

/** Valida o envelope de `product_1_1_cancel_copy` (fail-closed). */
function parseCopyCancellationEnvelope(raw: unknown): CopyCancellationResult {
  if (raw === null || typeof raw !== "object") {
    throw new Error("product_1_1_cancel_copy_invalid_envelope");
  }
  const envelope = raw as Record<string, unknown>;
  const applied = envelope.applied;
  const canceled = envelope.canceled;
  const state = envelope.state;

  if (typeof applied !== "boolean" || typeof canceled !== "boolean") {
    throw new Error("product_1_1_cancel_copy_invalid_envelope");
  }
  if (state !== null && state !== undefined && !isCopyState(state)) {
    throw new Error("product_1_1_cancel_copy_invalid_envelope");
  }
  // Coerência: `canceled:true` só é válido com estado terminal `failed`.
  if (canceled && state !== "failed") {
    throw new Error("product_1_1_cancel_copy_incoherent_envelope");
  }

  return { applied, canceled, state: isCopyState(state) ? state : null };
}

/**
 * P2 — aplica a transição CONDICIONAL via RPC e valida o envelope (fail-closed).
 * O cliente NUNCA afirma persistência a partir de um envelope inválido.
 */
export async function recordCopyState(
  client: SupabaseClient,
  input: RecordCopyStateInput,
): Promise<CopyStateTransitionResult> {
  const { data, error } = await client.rpc(APPLY_COPY_STATE_RPC, {
    p_campaign_id: input.campaignId,
    p_operation_id: input.operationId,
    p_state: input.state,
    p_copy_text: input.copyText ?? null,
    p_copy_payload: input.copyPayload ?? null,
  });
  if (error) {
    throw new Error(`product_1_1_apply_copy_state_rpc_failed:${error.message}`);
  }
  return parseCopyStateEnvelope(data);
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
 * estado. O `state` PERSISTIDO é AUTORITATIVO (A1) — NÃO existe campo
 * `confirmation`: uma incerteza LOCAL (timeout) é resolvida por ESTA RE-LEITURA,
 * NUNCA por um segundo write.
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
 * P2 — CANCELAMENTO ATÔMICO via RPC: aplica o terminal `failed` E registra o
 * motivo numa ÚNICA transação; RECUSA cancelar sobre um `completed` persistido
 * (`canceled:false`). O envelope é validado (fail-closed).
 */
export async function recordCancellation(
  client: SupabaseClient,
  input: RecordCancellationInput,
): Promise<CopyCancellationResult> {
  const { data, error } = await client.rpc(CANCEL_COPY_RPC, {
    p_campaign_id: input.campaignId,
    p_operation_id: input.operationId,
    p_reason: input.reason,
  });
  if (error) {
    throw new Error(`product_1_1_cancel_copy_rpc_failed:${error.message}`);
  }
  return parseCopyCancellationEnvelope(data);
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

/**
 * Resultado determinístico da drenagem da copy.
 *   * `completed`   — o estado `completed` foi PROVADO persistido (apply/idempotent);
 *   * `failed`      — o estado `failed` foi PROVADO persistido (falha/cancelamento);
 *   * `unconfirmed` — INCERTEZA LOCAL do CHAMADOR (timeout): NADA é afirmado sobre
 *     a persistência — resolve-se por RE-LEITURA (`readCopyDelivery`), NUNCA por um
 *     segundo write (A1). NÃO é persistido.
 */
export type CopyDrainState = "completed" | "failed" | "unconfirmed";

export interface DrainCopyTaskResult {
  readonly state: CopyDrainState;
  /** `true` quando o orçamento esgotou e a copy foi CANCELADA (`canceled:true`). */
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
 * Desfecho de uma escrita de store com orçamento próprio: o envelope VALIDADO
 * (`result`), uma rejeição (`error`) ou o teto esgotado (`timeout`). O drenador
 * SÓ confirma um terminal quando o envelope PROVA o estado pedido — `error` e
 * `timeout` NUNCA contam como sucesso.
 */
type RecordSettle =
  | { readonly kind: "result"; readonly result: CopyStateTransitionResult }
  | { readonly kind: "error" }
  | { readonly kind: "timeout" };

/**
 * C2 — `true` somente quando o envelope PROVA o estado pedido: `applied` (a
 * transição aconteceu) ou `idempotent` (o persistido JÁ é esse estado). `conflict`,
 * `rejected`, `invalid_content`, `error` e `timeout` NUNCA confirmam.
 */
function confirmsPersistedState(settle: RecordSettle, expected: CopyState): boolean {
  return (
    settle.kind === "result" &&
    settle.result.state === expected &&
    (settle.result.outcome === "applied" || settle.result.outcome === "idempotent")
  );
}

/**
 * Executa uma escrita de store com ORÇAMENTO PRÓPRIO (gap 3): nunca prende o
 * drenador além de `budgetMs`, e nunca dispara rejeição não tratada se a escrita
 * pendurar e resolver/rejeitar depois do teto. Distingue o envelope devolvido
 * (persistência) de erro/timeout — a confirmação de terminal depende de
 * persistência PROVADA, nunca de uma escrita apenas DISPARADA.
 */
function boundedRecord(
  action: () => Promise<CopyStateTransitionResult>,
  budgetMs: number,
  timers: NonNullable<DrainCopyTaskOptions["timers"]>,
): Promise<RecordSettle> {
  return new Promise<RecordSettle>((resolve) => {
    let settled = false;
    const finish = (outcome: RecordSettle) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };
    const id = timers.setTimeout(() => finish({ kind: "timeout" }), Math.max(0, budgetMs));
    Promise.resolve()
      .then(action)
      .then(
        (result) => {
          timers.clearTimeout(id);
          finish({ kind: "result", result });
        },
        () => {
          timers.clearTimeout(id);
          finish({ kind: "error" });
        },
      );
  });
}

/**
 * Drena a task da copy DENTRO do ciclo da requisição (F8):
 *
 *  1. aplica `pending` (transição condicional; a corrida de primeira escrita é
 *     resolvida pelo BANCO — C1);
 *  2. corre a task até o orçamento esgotar OU até terminar;
 *  3. a task persiste o TEXTO entregue via `commit` (transição CONDICIONAL);
 *  4. `completed` só é afirmado com a RPC PROVANDO o estado (`applied`/
 *     `idempotent`) — `conflict`/`rejected`/`invalid_content`/`error`/`timeout`
 *     NUNCA declaram `completed` (C2: nunca `completed` sem texto entregável);
 *  5. ao CANCELAR (orçamento esgotado) → `product_1_1_cancel_copy` aplica o
 *     terminal `failed` E registra o motivo numa ÚNICA transação; se um
 *     `completed` já estiver PERSISTIDO, o cancelamento é RECUSADO e o estado
 *     persistido prevalece;
 *  6. `timeout` de escrita ⇒ o drenador devolve `"unconfirmed"` (incerteza LOCAL
 *     do CHAMADOR) — sem segundo write; resolve-se por RE-LEITURA.
 *
 * A ORDEM/TRANSIÇÃO é imposta pelo BANCO (transição condicional + terminal
 * protegido); o drenador NÃO depende de uma fila em memória para garanti-la.
 * Cada escrita tem orçamento próprio, então o drenador nunca é preso por uma
 * escrita que pendura. Sem retry; a copy nunca bloqueia a arte nem reverte a
 * reserva.
 */
export async function drainCopyTask(
  input: DrainCopyTaskInput,
  store: CopyStateStore,
  options: DrainCopyTaskOptions = {},
): Promise<DrainCopyTaskResult> {
  const budgetMs = options.persistenceBudgetMs ?? COPY_PERSISTENCE_BUDGET_MS;
  const timers = options.timers ?? { setTimeout, clearTimeout };

  // Latch: `settled` encerra o drenador; `attempted` marca que a task tentou
  // persistir o texto; `committed` só é `true` com o estado PROVADO persistido.
  const latch: {
    settled: boolean;
    attempted: boolean;
    committed: boolean;
    commitSettle: RecordSettle | null;
  } = { settled: false, attempted: false, committed: false, commitSettle: null };

  const recordState = (
    state: CopyState,
    extra?: Pick<RecordCopyStateInput, "copyText" | "copyPayload">,
  ): Promise<RecordSettle> =>
    boundedRecord(
      () =>
        store.recordCopyState({
          campaignId: input.campaignId,
          operationId: input.operationId,
          state,
          ...(extra ?? {}),
        }),
      budgetMs,
      timers,
    );

  const cancelBounded = (): Promise<RecordSettle | { kind: "cancel"; result: CopyCancellationResult }> =>
    new Promise((resolve) => {
      let settled = false;
      const finish = (value: RecordSettle | { kind: "cancel"; result: CopyCancellationResult }) => {
        if (settled) return;
        settled = true;
        resolve(value);
      };
      const id = timers.setTimeout(() => finish({ kind: "timeout" }), Math.max(0, budgetMs));
      Promise.resolve()
        .then(() =>
          store.recordCancellation({
            campaignId: input.campaignId,
            operationId: input.operationId,
            reason: COPY_CANCELLATION_REASON,
          }),
        )
        .then(
          (result) => {
            timers.clearTimeout(id);
            finish({ kind: "cancel", result });
          },
          () => {
            timers.clearTimeout(id);
            finish({ kind: "error" });
          },
        );
    });

  const commit: CopyCommit = async (delivery) => {
    // NO-OP determinístico: após o settle, ou após uma tentativa de commit.
    if (latch.settled || latch.attempted) return;
    latch.attempted = true;
    const settle = await recordState("completed", {
      copyText: delivery.copyText,
      copyPayload: delivery.payload ?? null,
    });
    latch.commitSettle = settle;
    // Só PROVA a conclusão quando a RPC confirma o estado `completed` persistido.
    if (confirmsPersistedState(settle, "completed")) {
      latch.committed = true;
    }
  };

  /**
   * Terminal `failed`: a DECISÃO depende do DESFECHO da PRÓPRIA escrita —
   * nunca se declara `failed` sem inspecionar o settle/envelope devolvido por
   * `recordState("failed")`.
   *   * `timeout`/`error` ⇒ incerteza LOCAL do CHAMADOR ⇒ `unconfirmed`
   *     (resolve-se por RE-LEITURA; nunca por um 2º write);
   *   * envelope cujo estado PERSISTIDO é `completed` ⇒ a transição para
   *     `failed` foi RECUSADA (terminal PROTEGIDO) ⇒ o terminal PERSISTIDO
   *     prevalece (`completed`), nunca um `failed` enganoso;
   *   * caso contrário ⇒ o terminal `failed` foi aplicado/persistido.
   */
  const settleFailTerminal = async (): Promise<DrainCopyTaskResult> => {
    const settle = await recordState("failed");
    if (settle.kind === "timeout" || settle.kind === "error") {
      return { state: "unconfirmed", canceled: false };
    }
    if (settle.result.state === "completed") {
      return { state: "completed", canceled: false };
    }
    return { state: "failed", canceled: false };
  };

  await recordState("pending");

  const aborted = new Promise<{ canceled: boolean }>((resolve) => {
    if (input.signal.aborted) {
      resolve({ canceled: true });
      return;
    }
    input.signal.addEventListener("abort", () => resolve({ canceled: true }), { once: true });
  });

  const ran = input.run({ signal: input.signal, commit }).then(
    (): { resolved: true; canceled: false } => ({ resolved: true, canceled: false }),
    // Task rejeitada: `canceled` só quando o orçamento (sinal) abortou.
    (): { resolved: false; canceled: boolean } => ({
      resolved: false,
      canceled: input.signal.aborted,
    }),
  );

  const winner = await Promise.race([
    ran.then((value) => ({ kind: "ran" as const, ...value })),
    aborted.then(() => ({ kind: "aborted" as const, resolved: false as const, canceled: true })),
  ]);

  // Settle: a partir daqui, `commit` tardio é NO-OP (nunca sobrescreve o estado
  // cancelado nem escreve `completed` após o cancelamento registrado).
  latch.settled = true;

  // O BANCO é autoritativo: um `completed` PROVADO persistido é a verdade.
  if (latch.committed) {
    return { state: "completed", canceled: false };
  }

  if (winner.canceled) {
    // Orçamento esgotado ⇒ CANCELA atomicamente (terminal `failed` + motivo numa
    // ÚNICA transação). Se um `completed` já estiver PERSISTIDO, o cancelamento é
    // recusado e o estado persistido prevalece.
    const settle = await cancelBounded();
    if (settle.kind === "cancel") {
      if (!settle.result.canceled && settle.result.state === "completed") {
        return { state: "completed", canceled: false };
      }
      return { state: "failed", canceled: true };
    }
    // Incerteza LOCAL sobre o cancelamento: sem segundo write; re-ler resolve.
    return { state: "unconfirmed", canceled: true };
  }

  if (latch.attempted) {
    // Commit tentado e NÃO provado pelo envelope.
    if (latch.commitSettle?.kind === "timeout") {
      // Incerteza LOCAL do CHAMADOR (timeout): NADA é afirmado; re-ler resolve.
      return { state: "unconfirmed", canceled: false };
    }
    // `error`/`conflict`/`rejected`/`invalid_content`: o texto NÃO foi persistido.
    // O desfecho da escrita do `failed`, porém, é INSPECIONADO: timeout/erro ⇒
    // incerteza LOCAL (`unconfirmed`); recusa por `completed` JÁ persistido ⇒ o
    // terminal persistido prevalece; caso contrário ⇒ `failed` (nunca `completed`
    // enganoso).
    return await settleFailTerminal();
  }

  // Task resolvida SEM `commit` (nenhum texto entregável): C2 proíbe persistir
  // `completed` sem conteúdo ⇒ o terminal é decidido pelo DESFECHO da escrita de
  // `failed` (timeout/erro ⇒ `unconfirmed`; `completed` JÁ persistido prevalece).
  return await settleFailTerminal();
}
