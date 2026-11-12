import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { AiInvoker } from "@/lib/ai/gateway";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  ProductOneToOneCopyAcquisitionClient,
  type AcquireCopyAttemptInput,
  type CopyAcquisitionResult,
} from "@/lib/product-1-1/copy/copy-acquisition-client";
import {
  COPY_BUDGET_MS,
  createCopyBudgetSignal,
  drainCopyTask,
  readCopyAttempts,
  readCopyDelivery,
  recordCancellation,
  recordCopyState,
  type CopyDeliveryRecord,
  type CopyStateStore,
  type DrainCopyTaskResult,
} from "@/lib/product-1-1/copy/copy-state";
import { classifyCopyFailure } from "@/lib/product-1-1/copy/copy-recovery";
import {
  createDefaultProductOneToOneCopyOps,
  type DefaultProductOneToOneCopyRunnerDeps,
  type DefaultProductOneToOneCopyRunnerInput,
  type ProductOneToOneCopyRunnerOps,
} from "@/lib/product-1-1/copy/default-copy-runner";
import { remainingBeforeDeadline } from "@/lib/product-1-1/orchestration/deadline";
import { getLaunchConfig } from "@/lib/launch-config/config";

import type { CopyOutcome, FrozenContentPayload } from "./types";

/**
 * F60.4 — copy da base quadrada sobre o caminho produtivo EXISTENTE.
 *
 * Este módulo NÃO cria policy, tabela, RPC ou fluxo paralelo: apenas compõe a
 * aquisição atômica (`ProductOneToOneCopyAcquisitionClient`), o runner default
 * (`createDefaultProductOneToOneCopyOps`) e o dreno (`drainCopyTask`), lendo o
 * texto/payload do estado PERSISTIDO (`readCopyDelivery`).
 *
 * Contratos invioláveis:
 *
 * - **Conteúdo congelado**: `briefing`/`copyContext` vêm SEMPRE de
 *   `FrozenContentPayload`. Não existe entrada para o payload recebido na
 *   retomada — ele nunca chega ao runner e nunca substitui preço/selo/tom.
 * - **Identidade do dreno**: `attemptSeq`/`attemptToken` do `drainCopyTask` vêm
 *   EXCLUSIVAMENTE de `CopyAcquisitionResult` (o envelope fechado da RPC de
 *   aquisição). Qualquer tentativa F60 ou índice externo é ignorado.
 * - **`completed` é reutilizada** sem chamada ao provider (`attempt_already_completed`
 *   → leitura do delivery → `origin: "reused"`).
 * - **Nunca lança**: toda falha de aquisição/dreno/leitura vira `CopyOutcome`
 *   próprio. A copy nunca bloqueia, reverte ou apaga a arte.
 * - **Sem gate de gasto do piloto**: a autorização F60 é o controle; nenhuma
 *   política de gasto paralela é criada.
 */

/** Resultado de PERDA da aquisição (o vencedor é drenado por `runSquareBaseCopy`). */
export type CopyAcquisitionLoss = Extract<CopyAcquisitionResult, { acquired: false }>;

/** Entrada do módulo de copy: conteúdo congelado + deadline local. */
export interface RunSquareBaseCopyInput {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  /** Conteúdo congelado da operação (autoridade de briefing/contexto). */
  readonly frozen: FrozenContentPayload;
  /** Instante-limite local (ms epoch) para o orçamento da copy. */
  readonly deadlineAtMs: number;
  readonly usdBrlRateAtGeneration?: number | null;
  readonly creditValueBrlAtGeneration?: number | null;
  readonly traceId?: string;
}

/**
 * Fábrica do runner de copy (seam de teste). O default é o runner produtivo;
 * os testes injetam uma fábrica que captura o input entregue ao runner.
 */
export type SquareBaseCopyOpsFactory = (
  input: DefaultProductOneToOneCopyRunnerInput,
  deps: DefaultProductOneToOneCopyRunnerDeps,
) => ProductOneToOneCopyRunnerOps;

export interface SquareBaseCopyDeps {
  readonly client?: SupabaseClient;
  /**
   * OBRIGATÓRIO. O orquestrador injeta `squareBaseCopyInvoker` (registry
   * no-retry). Nunca há fallback para o gateway padrão: a ausência de invoker é
   * um erro de composição, não um caminho válido.
   */
  readonly invoker: AiInvoker;
  readonly copyOps?: SquareBaseCopyOpsFactory;
  readonly acquireAttempt?: (
    input: AcquireCopyAttemptInput,
  ) => Promise<CopyAcquisitionResult>;
  /** Default: `getLaunchConfig().copyDirectorEnabled` (seam de teste). */
  readonly copyDirectorEnabled?: boolean;
  readonly now?: () => number;
}

export interface CopyOutcomeFromAcquisitionDeps {
  readonly campaignId: string;
  readonly operationId: string;
  readonly client?: SupabaseClient;
}

const FAILURE_CLASSES: readonly string[] = ["transient", "definitive"];

/** Lê `copy_payload.recovery.failureClass` persistido (nunca inventa classe). */
function readPersistedFailureClass(
  payload: Record<string, unknown> | null,
): "transient" | "definitive" | null {
  if (payload === null || typeof payload !== "object") return null;
  const recovery = payload.recovery;
  if (recovery === null || typeof recovery !== "object") return null;
  const failureClass = (recovery as Record<string, unknown>).failureClass;
  return typeof failureClass === "string" && FAILURE_CLASSES.includes(failureClass)
    ? (failureClass as "transient" | "definitive")
    : null;
}

/**
 * Lê a copy `completed` persistida (texto/payload) e a sequência da tentativa
 * corrente. `null` quando a leitura falha ou o estado persistido não é
 * `completed` — o chamador decide o desfecho (`read_failed`).
 *
 * O envelope de `attempt_already_completed` NÃO carrega `attempt_seq`; por isso
 * a sequência é lida do histórico persistido (mesma tabela), nunca inventada.
 */
async function readPersistedCompletion(
  client: SupabaseClient,
  input: { campaignId: string; operationId: string },
): Promise<{ delivery: CopyDeliveryRecord; attemptSeq: number } | null> {
  const delivery = await readCopyDelivery(client, input);
  if (delivery === null || delivery.state !== "completed") return null;
  const attempts = await readCopyAttempts(client, input);
  const latest = attempts[attempts.length - 1];
  return { delivery, attemptSeq: latest ? latest.attemptSeq : 0 };
}

/**
 * Mapeia uma PERDA de aquisição para `CopyOutcome` (1:1 com o envelope fechado).
 *
 * `attempt_already_completed` lê o delivery persistido e devolve `completed`
 * com `origin: "reused"` (zero chamadas ao provider). Erro de leitura →
 * `unavailable("read_failed")`. Os demais motivos mapeiam para
 * `in_progress`/`waiting`/`unavailable` sem qualquer I/O adicional.
 */
export async function copyOutcomeFromAcquisition(
  acquisition: CopyAcquisitionLoss,
  deps: CopyOutcomeFromAcquisitionDeps,
): Promise<CopyOutcome> {
  const client = deps.client ?? supabaseAdmin;

  switch (acquisition.reason) {
    case "attempt_already_completed": {
      try {
        const persisted = await readPersistedCompletion(client, {
          campaignId: deps.campaignId,
          operationId: deps.operationId,
        });
        if (persisted === null) {
          return { kind: "unavailable", reason: "read_failed" };
        }
        return {
          kind: "completed",
          attemptSeq: persisted.attemptSeq,
          text: persisted.delivery.copyText,
          payload: persisted.delivery.copyPayload,
          origin: "reused",
        };
      } catch {
        return { kind: "unavailable", reason: "read_failed" };
      }
    }
    case "attempt_in_progress":
    case "already_acquired":
      return acquisition.attemptSeq === undefined
        ? { kind: "in_progress" }
        : { kind: "in_progress", attemptSeq: acquisition.attemptSeq };
    case "wait_not_elapsed":
      return { kind: "waiting", waitRemainingMs: acquisition.waitRemainingMs ?? 0 };
    case "attempt_limit_reached":
      return { kind: "unavailable", reason: "attempt_limit" };
    case "automatic_closed":
      return { kind: "unavailable", reason: "automatic_closed" };
    default: {
      // União FECHADA: um motivo novo quebra a compilação aqui (nunca silencioso).
      const unreachable: never = acquisition.reason;
      void unreachable;
      return { kind: "unavailable", reason: "acquisition_failed" };
    }
  }
}

/** Mapeia o desfecho do dreno para `CopyOutcome` (nunca lança). */
async function copyOutcomeFromDrain(
  drain: DrainCopyTaskResult,
  input: RunSquareBaseCopyInput,
  attemptSeq: number,
  client: SupabaseClient,
): Promise<CopyOutcome> {
  if (drain.state === "unconfirmed") {
    // Incerteza LOCAL do chamador: nada é afirmado sobre a persistência.
    return {
      kind: "failed",
      attemptSeq,
      failureClass: null,
      unconfirmed: true,
    };
  }

  if (drain.state === "completed") {
    // O TEXTO é lido do estado PERSISTIDO (nunca do retorno em memória).
    let persisted: { delivery: CopyDeliveryRecord; attemptSeq: number } | null;
    try {
      persisted = await readPersistedCompletion(client, {
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
    } catch {
      return { kind: "unavailable", reason: "read_failed" };
    }
    if (persisted === null) {
      return { kind: "unavailable", reason: "read_failed" };
    }
    return {
      kind: "completed",
      attemptSeq,
      text: persisted.delivery.copyText,
      payload: persisted.delivery.copyPayload,
      origin: "generated",
    };
  }

  // `failed` provado pelo dreno: o estado persistido é a fonte da classe.
  let delivery: CopyDeliveryRecord | null = null;
  try {
    delivery = await readCopyDelivery(client, {
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
  } catch {
    delivery = null;
  }
  return {
    kind: "failed",
    attemptSeq,
    failureClass: readPersistedFailureClass(delivery?.copyPayload ?? null),
    unconfirmed: false,
  };
}

/**
 * Executa a copy da base quadrada e devolve um `CopyOutcome` — nunca lança.
 *
 * Fluxo: sem `copyContext` congelado → `not_requested`; aquisição atômica
 * (`mode: "auto"`, `requestToken` server-side); perdedor mapeado 1:1;
 * vencedor com orçamento `min(COPY_BUDGET_MS, restante até o deadline)` e
 * dreno único com `attemptSeq`/`attemptToken` da aquisição.
 */
export async function runSquareBaseCopy(
  input: RunSquareBaseCopyInput,
  deps: SquareBaseCopyDeps,
): Promise<CopyOutcome> {
  const copyContext = input.frozen.copyContext;
  if (copyContext === null) {
    return { kind: "not_requested" };
  }

  const client = deps.client ?? supabaseAdmin;
  const acquireAttempt =
    deps.acquireAttempt ??
    ((acquisitionInput: AcquireCopyAttemptInput) =>
      new ProductOneToOneCopyAcquisitionClient(client).acquire(acquisitionInput));

  let acquired: CopyAcquisitionResult;
  try {
    acquired = await acquireAttempt({
      campaignId: input.campaignId,
      operationId: input.operationId,
      mode: "auto",
      requestToken: crypto.randomUUID(),
    });
  } catch {
    // Aquisição fail-closed ⇒ desfecho próprio; a arte segue.
    return { kind: "unavailable", reason: "acquisition_failed" };
  }

  if (!acquired.acquired) {
    return copyOutcomeFromAcquisition(acquired, {
      campaignId: input.campaignId,
      operationId: input.operationId,
      client,
    });
  }

  const now = deps.now ?? (() => Date.now());
  const budgetMs = Math.max(
    0,
    Math.min(COPY_BUDGET_MS, remainingBeforeDeadline(now(), input.deadlineAtMs)),
  );
  if (budgetMs === 0) {
    // Reserva esgotada: não drena e não chama provider.
    return { kind: "unavailable", reason: "budget_exhausted" };
  }

  const factory = deps.copyOps ?? createDefaultProductOneToOneCopyOps;
  const copyDirectorEnabled =
    deps.copyDirectorEnabled ?? getLaunchConfig().copyDirectorEnabled;

  let ops: ProductOneToOneCopyRunnerOps;
  try {
    ops = factory(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        storeId: input.storeId,
        briefing: input.frozen.briefing,
        copyContext,
        copyDirectorEnabled,
        usdBrlRateAtGeneration: input.usdBrlRateAtGeneration ?? null,
        creditValueBrlAtGeneration: input.creditValueBrlAtGeneration ?? null,
        runId: input.operationId,
        traceId: input.traceId,
      },
      { invoker: deps.invoker, attemptSeq: acquired.attemptSeq },
    );
  } catch {
    // A copy não pôde ser construída: nada foi tentado e nada foi pago.
    return { kind: "unavailable", reason: "not_attempted" };
  }

  const store: CopyStateStore = {
    recordCopyState: (record) => recordCopyState(client, record),
    recordCancellation: (record) => recordCancellation(client, record),
  };
  const budget = createCopyBudgetSignal(budgetMs);

  let drain: DrainCopyTaskResult;
  try {
    drain = await drainCopyTask(
      {
        campaignId: input.campaignId,
        operationId: input.operationId,
        // Identidade EXCLUSIVA do envelope de aquisição.
        attemptSeq: acquired.attemptSeq,
        attemptToken: acquired.attemptToken,
        recoveryKind: "auto",
        signal: budget.signal,
        classifyFailure: classifyCopyFailure,
        run: ({ signal, commit }) =>
          ops.runCopy({
            campaignId: input.campaignId,
            operationId: input.operationId,
            signal,
            commit,
          }),
      },
      store,
    );
  } catch {
    // Defensivo: o dreno não deveria lançar. Incerteza local ⇒ falha não
    // confirmada, sem retry e sem segundo write.
    return {
      kind: "failed",
      attemptSeq: acquired.attemptSeq,
      failureClass: null,
      unconfirmed: true,
    };
  } finally {
    budget.dispose();
  }

  return copyOutcomeFromDrain(drain, input, acquired.attemptSeq, client);
}
