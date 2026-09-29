import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { sanitizeAiErrorMessage } from "@/lib/ai/types";
import type { BenchRunStatus } from "../domain/schemas";

/**
 * Serviço de persistência da **bancada de geração** (F48.2.2, D9/D10).
 *
 * Concentra o ciclo de vida da geração da bancada, sem herdar o modelo A/B:
 *  1. **reserva em `draft`** (`reserveBenchRun`) — idempotente por `operation_id`,
 *     **sem** ocupar o slot global (vários drafts coexistem);
 *  2. fixação da configuração/snapshot/prompt (`setBenchRunInput`, só em `draft`);
 *  3. **confirmação compare-and-set `draft → pending`** (`confirmBenchRun`) que
 *     adquire o slot global atomicamente (violação do índice ⇒
 *     `bench_run_already_active`, sem chamada paga);
 *  4. transições (`markBenchRunRunning`, `finalizeBenchRun`) e leitura;
 *  5. **reconciliação preguiçosa** (`reconcileStaleBenchRuns`) de gerações presas
 *     (`bench_run_orphan_timeout`) e de drafts abandonados
 *     (`bench_run_draft_abandoned`) — na leitura e no início da reserva, **sem**
 *     scheduler.
 *
 * O client Supabase entra **por parâmetro** em todas as funções — testes usam
 * fakes em memória (nenhuma chamada de rede e nenhuma chamada paga).
 */

// ─── Códigos de erro estáveis ────────────────────────────────────────────────

/** Códigos determinísticos da bancada (a rota mapeia em HTTP). */
export const BENCH_RUN_ERROR_CODES = [
  "bench_run_already_active",
  "missing_operation_id",
  "missing_snapshot",
  "idempotency_conflict",
  "bench_run_not_found",
  "bench_run_transition_failed",
  "bench_run_orphan_timeout",
  "bench_run_draft_abandoned",
] as const;

export type BenchRunErrorCode = (typeof BENCH_RUN_ERROR_CODES)[number];

/** Erro determinístico do serviço de run da bancada. */
export class BenchRunError extends Error {
  readonly code: BenchRunErrorCode;

  constructor(code: BenchRunErrorCode) {
    super(code);
    this.name = "BenchRunError";
    this.code = code;
  }
}

/** Estados terminais da geração (nenhum deles volta a ser executado). */
export type BenchTerminalRunStatus = "succeeded" | "failed" | "cancelled" | "timeout";

// ─── Cutoffs de staleness (reconciliação preguiçosa, sem scheduler) ──────────

/**
 * Cutoff conservador da geração ativa (`pending`/`running`): confortavelmente
 * maior que uma sessão manual de upload/edição, para que uma geração ativa
 * legítima nunca seja reconciliada no meio de uma sessão.
 */
export const BENCH_ACTIVE_STALE_MS = 4 * 60 * 60 * 1000; // 4h

/** Cutoff do reap de drafts abandonados (nunca confirmados). */
export const BENCH_DRAFT_STALE_MS = 24 * 60 * 60 * 1000; // 24h

const BENCH_RUNS_TABLE = "lab_bench_runs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (code === "23505") return true;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" && /unique|duplicate key/i.test(message);
}

function affectedRows(result: { data: unknown; error: unknown }): number {
  if (result.error) return -1;
  return Array.isArray(result.data) ? result.data.length : 0;
}

// ─── Leitura ─────────────────────────────────────────────────────────────────

export interface BenchRunRecord {
  id: string;
  operationId: string;
  status: BenchRunStatus;
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  campaignSnapshot: unknown;
  brandingSnapshot: unknown;
  config: unknown;
  promptSent: string | null;
  /** Evidência mínima do preflight do prompt (F48.2.3, D20). */
  promptBase: string | null;
  promptCompiled: string | null;
  promptApproved: string | null;
  promptBlocks: unknown;
  composerVersion: string | null;
  references: unknown;
  provider: string | null;
  protocol: string | null;
  model: string | null;
  size: string | null;
  quality: string | null;
  intent: string | null;
  contentType: string | null;
  structure: string | null;
  theme: string | null;
  latencyMs: number | null;
  usage: unknown;
  estimatedCostUsd: number | null;
  costDetail: unknown;
  costSource: string | null;
  costRuleVersion: string | null;
  errorType: string | null;
  errorMessage: string | null;
  technicalValidation: unknown;
}

function mapBenchRunRow(row: Record<string, unknown>): BenchRunRecord {
  return {
    id: row.id as string,
    operationId: row.operation_id as string,
    status: row.status as BenchRunStatus,
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
    startedAt: (row.started_at as string | null) ?? null,
    finishedAt: (row.finished_at as string | null) ?? null,
    campaignSnapshot: row.campaign_snapshot ?? null,
    brandingSnapshot: row.branding_snapshot ?? null,
    config: row.config ?? null,
    promptSent: (row.prompt_sent as string | null) ?? null,
    promptBase: (row.prompt_base as string | null) ?? null,
    promptCompiled: (row.prompt_compiled as string | null) ?? null,
    promptApproved: (row.prompt_approved as string | null) ?? null,
    promptBlocks: row.prompt_blocks ?? null,
    composerVersion: (row.composer_version as string | null) ?? null,
    references: row.references ?? null,
    provider: (row.provider as string | null) ?? null,
    protocol: (row.protocol as string | null) ?? null,
    model: (row.model as string | null) ?? null,
    size: (row.size as string | null) ?? null,
    quality: (row.quality as string | null) ?? null,
    intent: (row.intent as string | null) ?? null,
    contentType: (row.content_type as string | null) ?? null,
    structure: (row.structure as string | null) ?? null,
    theme: (row.theme as string | null) ?? null,
    latencyMs: (row.latency_ms as number | null) ?? null,
    usage: row.usage ?? null,
    estimatedCostUsd: (row.estimated_cost_usd as number | null) ?? null,
    costDetail: row.cost_detail ?? null,
    costSource: (row.cost_source as string | null) ?? null,
    costRuleVersion: (row.cost_rule_version as string | null) ?? null,
    errorType: (row.error_type as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    technicalValidation: row.technical_validation ?? null,
  };
}

/**
 * Leitura **read-only** de um run por `operation_id` (ou `null`). Usada pela
 * confirmação (`POST /runs`, plano 06) para resolver o `draft` existente por
 * `operation_id` **sem criar run**. Não dispara reconciliação.
 */
export async function getBenchRunByOperationId(params: {
  client: SupabaseClient;
  operationId: string;
}): Promise<BenchRunRecord | null> {
  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .select("*")
    .eq("operation_id", params.operationId)
    .maybeSingle();

  if (error) throw new BenchRunError("bench_run_transition_failed");
  if (!data) return null;
  return mapBenchRunRow(data as Record<string, unknown>);
}

/**
 * Leitura de um run por `id`, disparando a **reconciliação preguiçosa** antes de
 * retornar (D10). Devolve `null` quando o run não existe.
 */
export async function getBenchRun(params: {
  client: SupabaseClient;
  runId: string;
}): Promise<BenchRunRecord | null> {
  await reconcileStaleBenchRuns({ client: params.client });

  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .select("*")
    .eq("id", params.runId)
    .maybeSingle();

  if (error) throw new BenchRunError("bench_run_transition_failed");
  if (!data) return null;
  return mapBenchRunRow(data as Record<string, unknown>);
}

// ─── Reserva em draft (idempotente, sem ocupar o slot) ───────────────────────

/**
 * Reserva o run em **`draft`** (preparação/upload), idempotente por
 * `operation_id`. Como `draft` **não** ocupa o slot global, a reserva não pode
 * violar o índice único parcial. É a **mesma reserva** usada pela rota de upload
 * (`POST /inputs`) e pela rota de execução (`POST /runs`).
 *
 * Antes do INSERT, dispara a reconciliação preguiçosa (libera gerações presas e
 * reap drafts abandonados) — sem scheduler.
 */
export async function reserveBenchRun(params: {
  client: SupabaseClient;
  operationId: string;
  createdBy: string;
}): Promise<{ runId: string; idempotent: boolean }> {
  const { client, operationId, createdBy } = params;

  if (typeof operationId !== "string" || operationId.length === 0) {
    throw new BenchRunError("missing_operation_id");
  }

  await reconcileStaleBenchRuns({ client });

  const existing = await getBenchRunByOperationId({ client, operationId });
  if (existing) return { runId: existing.id, idempotent: true };

  const { data, error } = await client
    .from(BENCH_RUNS_TABLE)
    .insert({ operation_id: operationId, created_by: createdBy, status: "draft" })
    .select("id")
    .single();

  if (error || !data || !(data as { id?: string }).id) {
    // Corrida: `operation_id` já existe ⇒ idempotente se coincide.
    if (isUniqueViolation(error)) {
      const raced = await getBenchRunByOperationId({ client, operationId });
      if (raced) return { runId: raced.id, idempotent: true };
      throw new BenchRunError("idempotency_conflict");
    }
    throw new BenchRunError("bench_run_transition_failed");
  }

  return { runId: (data as { id: string }).id, idempotent: false };
}

// ─── Fixação da configuração em draft ────────────────────────────────────────

/**
 * Define a configuração/snapshot/prompt/referências do run **em `draft`** via CAS
 * (`.eq("status","draft")`) — depois da confirmação (`draft → pending`) a
 * alteração é recusada. Valida `campaignSnapshot` antes de qualquer I/O.
 */
export async function setBenchRunInput(params: {
  client: SupabaseClient;
  runId: string;
  campaignSnapshot: unknown;
  brandingSnapshot?: unknown;
  config?: unknown;
  promptSent?: string;
  /** Evidência mínima do preflight (F48.2.3, D20) — persistida no run `draft`. */
  promptBase?: string;
  promptCompiled?: string;
  promptApproved?: string;
  promptBlocks?: unknown;
  composerVersion?: string;
  references?: unknown;
  provider?: string | null;
  protocol?: string | null;
  model?: string | null;
  size?: string | null;
  quality?: string | null;
  intent?: string | null;
  contentType?: string | null;
  structure?: string | null;
  theme?: string | null;
}): Promise<void> {
  if (params.campaignSnapshot === undefined || params.campaignSnapshot === null) {
    throw new BenchRunError("missing_snapshot");
  }

  const update: Record<string, unknown> = {
    campaign_snapshot: params.campaignSnapshot,
    updated_at: new Date().toISOString(),
  };
  if (params.brandingSnapshot !== undefined) update.branding_snapshot = params.brandingSnapshot;
  if (params.config !== undefined) update.config = params.config;
  // Evidência do preflight (D20): `prompt_sent` é gravado **idêntico** ao prompt
  // final aprovado — nenhuma transformação após a aprovação.
  if (params.promptBase !== undefined) update.prompt_base = params.promptBase;
  if (params.promptCompiled !== undefined) update.prompt_compiled = params.promptCompiled;
  if (params.promptApproved !== undefined) {
    update.prompt_approved = params.promptApproved;
    update.prompt_sent = params.promptApproved;
  } else if (params.promptSent !== undefined) {
    update.prompt_sent = params.promptSent;
  }
  if (params.promptBlocks !== undefined) update.prompt_blocks = params.promptBlocks;
  if (params.composerVersion !== undefined) update.composer_version = params.composerVersion;
  if (params.references !== undefined) update["references"] = params.references;
  if (params.provider !== undefined) update.provider = params.provider;
  if (params.protocol !== undefined) update.protocol = params.protocol;
  if (params.model !== undefined) update.model = params.model;
  if (params.size !== undefined) update.size = params.size;
  if (params.quality !== undefined) update.quality = params.quality;
  if (params.intent !== undefined) update.intent = params.intent;
  if (params.contentType !== undefined) update.content_type = params.contentType;
  if (params.structure !== undefined) update.structure = params.structure;
  if (params.theme !== undefined) update.theme = params.theme;

  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .update(update)
    .eq("id", params.runId)
    .eq("status", "draft")
    .select("id");

  if (error || affectedRows({ data, error }) !== 1) {
    throw new BenchRunError("bench_run_transition_failed");
  }
}

// ─── Confirmação compare-and-set `draft → pending` (adquire o slot) ──────────

/**
 * Confirma a geração: CAS `.update({status:"pending"}).eq("id",runId)
 * .eq("status","draft")` — **adquire o slot global atomicamente**. Se o run não
 * está mais em `draft`, lança `bench_run_transition_failed`; se o banco levantar
 * `unique_violation` do índice global (já existe geração ativa), lança
 * `bench_run_already_active` — **sem** disparar chamada paga.
 */
export async function confirmBenchRun(params: {
  client: SupabaseClient;
  runId: string;
}): Promise<void> {
  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .update({ status: "pending", updated_at: new Date().toISOString() })
    .eq("id", params.runId)
    .eq("status", "draft")
    .select("id");

  if (error) {
    if (isUniqueViolation(error)) throw new BenchRunError("bench_run_already_active");
    throw new BenchRunError("bench_run_transition_failed");
  }
  if (affectedRows({ data, error }) !== 1) {
    throw new BenchRunError("bench_run_transition_failed");
  }
}

// ─── Transições de estado ────────────────────────────────────────────────────

/**
 * Promove o run a `running` — CAS `.eq("status","pending")`: só promove quem
 * ainda está `pending`; senão `bench_run_transition_failed`.
 */
export async function markBenchRunRunning(params: {
  client: SupabaseClient;
  runId: string;
  startedAt?: string;
}): Promise<void> {
  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .update({
      status: "running",
      started_at: params.startedAt ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.runId)
    .eq("status", "pending")
    .select("id");

  if (error || affectedRows({ data, error }) !== 1) {
    throw new BenchRunError("bench_run_transition_failed");
  }
}

/**
 * Grava o estado terminal da geração com as evidências do resultado.
 *
 * CAS `.in("status", ["draft","pending","running"])` — nunca sobrescreve terminal.
 * `errorMessage` passa por `sanitizeAiErrorMessage` **antes** de gravar (nenhuma
 * chave/URL/segredo é persistido). Grava `finished_at`.
 */
export async function finalizeBenchRun(params: {
  client: SupabaseClient;
  runId: string;
  status: BenchTerminalRunStatus;
  latencyMs?: number;
  usage?: unknown;
  estimatedCostUsd?: number | null;
  costDetail?: unknown;
  costSource?: string | null;
  costRuleVersion?: string | null;
  errorType?: string | null;
  errorMessage?: string | null;
  technicalValidation?: unknown;
  finishedAt?: string;
}): Promise<void> {
  const update: Record<string, unknown> = {
    status: params.status,
    finished_at: params.finishedAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (params.latencyMs !== undefined) update.latency_ms = params.latencyMs;
  if (params.usage !== undefined) update.usage = params.usage;
  if (params.estimatedCostUsd !== undefined) update.estimated_cost_usd = params.estimatedCostUsd;
  if (params.costDetail !== undefined) update.cost_detail = params.costDetail;
  if (params.costSource !== undefined) update.cost_source = params.costSource;
  if (params.costRuleVersion !== undefined) update.cost_rule_version = params.costRuleVersion;
  if (params.errorType !== undefined) update.error_type = params.errorType;
  if (params.errorMessage !== undefined && params.errorMessage !== null) {
    update.error_message = sanitizeAiErrorMessage(params.errorMessage);
  }
  if (params.technicalValidation !== undefined) {
    update.technical_validation = params.technicalValidation;
  }

  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .update(update)
    .eq("id", params.runId)
    .in("status", ["draft", "pending", "running"])
    .select("id");

  if (error || affectedRows({ data, error }) !== 1) {
    throw new BenchRunError("bench_run_transition_failed");
  }
}

// ─── Reconciliação preguiçosa (sem scheduler) ────────────────────────────────

/**
 * Reconciliação preguiçosa: chamada **na leitura** (`getBenchRun`) **e no início
 * de `reserveBenchRun`**, sem scheduler.
 *
 *  - marca `running` além do cutoff (`started_at < cutoff`) e `pending` órfãos
 *    (`started_at IS NULL AND created_at < cutoff`) como `failed` com
 *    `error_type: "bench_run_orphan_timeout"`, liberando o slot global;
 *  - reap `draft` abandonados (`created_at < draftCutoff`) marcando-os como
 *    `failed` com `error_type: "bench_run_draft_abandoned"` — nunca bloqueiam a
 *    bancada (draft não ocupa o slot).
 *
 * O cutoff é reaplicado no próprio `UPDATE` (fecha a corrida entre select/update).
 */
export async function reconcileStaleBenchRuns(params: {
  client: SupabaseClient;
  now?: Date;
  staleMs?: number;
  draftStaleMs?: number;
}): Promise<{ reconciled: number; draftsReaped: number }> {
  const now = params.now ?? new Date();
  const staleMs = params.staleMs ?? BENCH_ACTIVE_STALE_MS;
  const draftStaleMs = params.draftStaleMs ?? BENCH_DRAFT_STALE_MS;
  const activeCutoffMs = now.getTime() - staleMs;
  const draftCutoffMs = now.getTime() - draftStaleMs;

  const { data, error } = await params.client
    .from(BENCH_RUNS_TABLE)
    .select("id, status, started_at, created_at")
    .in("status", ["pending", "running", "draft"]);

  if (error) throw new BenchRunError("bench_run_transition_failed");

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const staleActive = rows.filter((row) => {
    if (row.status !== "pending" && row.status !== "running") return false;
    const reference = (row.started_at as string | null) ?? (row.created_at as string | null);
    if (typeof reference !== "string") return false;
    const referenceMs = Date.parse(reference);
    return Number.isFinite(referenceMs) && referenceMs < activeCutoffMs;
  });
  const staleDrafts = rows.filter((row) => {
    if (row.status !== "draft") return false;
    const reference = row.created_at as string | null;
    if (typeof reference !== "string") return false;
    const referenceMs = Date.parse(reference);
    return Number.isFinite(referenceMs) && referenceMs < draftCutoffMs;
  });

  let reconciled = 0;
  let draftsReaped = 0;

  if (staleActive.length > 0) {
    const staleIds = staleActive.map((row) => row.id);
    const activeCutoffIso = new Date(activeCutoffMs).toISOString();
    const terminal = {
      status: "failed",
      error_type: "bench_run_orphan_timeout",
      error_message: "Geração órfã marcada como falha",
      finished_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const runningResult = await params.client
      .from(BENCH_RUNS_TABLE)
      .update(terminal)
      .in("id", staleIds)
      .eq("status", "running")
      .lt("started_at", activeCutoffIso)
      .select("id");
    if (runningResult.error) throw new BenchRunError("bench_run_transition_failed");

    const pendingResult = await params.client
      .from(BENCH_RUNS_TABLE)
      .update(terminal)
      .in("id", staleIds)
      .eq("status", "pending")
      .is("started_at", null)
      .lt("created_at", activeCutoffIso)
      .select("id");
    if (pendingResult.error) throw new BenchRunError("bench_run_transition_failed");

    reconciled =
      (Array.isArray(runningResult.data) ? runningResult.data.length : 0) +
      (Array.isArray(pendingResult.data) ? pendingResult.data.length : 0);
  }

  if (staleDrafts.length > 0) {
    const draftIds = staleDrafts.map((row) => row.id);
    const draftCutoffIso = new Date(draftCutoffMs).toISOString();

    const reapedResult = await params.client
      .from(BENCH_RUNS_TABLE)
      .update({
        status: "failed",
        error_type: "bench_run_draft_abandoned",
        error_message: "Draft abandonado reconciliado",
        finished_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .in("id", draftIds)
      .eq("status", "draft")
      .lt("created_at", draftCutoffIso)
      .select("id");
    if (reapedResult.error) throw new BenchRunError("bench_run_transition_failed");

    draftsReaped = Array.isArray(reapedResult.data) ? reapedResult.data.length : 0;
  }

  return { reconciled, draftsReaped };
}
