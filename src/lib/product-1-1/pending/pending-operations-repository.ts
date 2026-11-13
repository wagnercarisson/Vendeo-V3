import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProductOneToOneArtifactStore } from "../artifact/artifact-store";
import type { ArtifactProbe } from "../artifact/types";
import type { CreditOperationStatus } from "../credit-operation/types";

/**
 * F56.2b1b (Plano 07, B1B-D5 / REQ-56.2.2-08) — repositório server-only de
 * pendências do Produto 1:1.
 *
 * A "fila de atendimento" é SOMENTE uma lista de pendências: este repositório
 * lê o estado persistido da operação de crédito, os claims de tentativa e o
 * resultado desconhecido — e deriva a evidência de arte pela sonda TIPADA
 * (`probeArtifact`, C2) — SEMPRE server-side. NUNCA re-enfileira, gera novamente
 * ou chama o provider.
 *
 * O cliente Supabase e a sonda de arte são injetáveis (seam testável, como
 * `image-generation-diagnosis-repository.ts`). I3 — a derivação NUNCA assina URL
 * (a sonda devolve evidência/metadados; a assinatura é do portão de download).
 */

const CREDIT_TABLE = "product_1_1_campaign_credit_operations";
const CLAIM_HISTORY_VIEW = "product_generation_claim_history_v";
const ACTIVE_CLAIMS_VIEW = "product_generation_active_claims_v";
const OUTCOMES_VIEW = "product_generation_operation_outcomes_v";
const CANONICAL_OPERATIONS_TABLE = "product_9_16_two_stage_operations";
const CANONICAL_STEPS_TABLE = "product_9_16_two_stage_steps";

const CREDIT_COLUMNS =
  "campaign_id, operation_id, store_id, amount, status, state_epoch, publication_state, created_at, updated_at";
const CLAIM_COLUMNS = "source, stage, status, attempt_number, updated_at";
const OUTCOME_COLUMNS = "source, outcome, stage, support_reference";
const STEP_COLUMNS = "stage, status, attempts_used, updated_at";

interface CreditRow {
  campaign_id: string;
  operation_id: string;
  store_id: string;
  amount: number;
  status: CreditOperationStatus;
  state_epoch: number | null;
  publication_state: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface ClaimRow {
  source: "legacy" | "9_16_two_stage";
  stage: "base" | "expansion" | null;
  status: string;
  attempt_number: number;
  updated_at: string | null;
}

interface OutcomeRow {
  source: "legacy" | "9_16_two_stage";
  outcome: string;
  stage: "base" | "expansion" | null;
  support_reference: string | null;
}

interface StepRow {
  stage: "base" | "expansion";
  status: "pending" | "in_progress" | "done" | "failed" | "abandoned";
  attempts_used: number;
  updated_at: string | null;
}

interface CanonicalOperation {
  readonly origin: "legacy" | "9_16_two_stage";
  readonly stage: "base" | "expansion" | null;
}

/** Estado persistido TIPADO de uma operação pendente (sem assinatura — I3). */
export interface PendingOperationState {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly status: CreditOperationStatus;
  readonly amount: number;
  /** I2 — estado terminal (`delivered`/`refunded`) prevalece sobre `unknown`. */
  readonly terminal: boolean;
  /** Marcador de resultado desconhecido; só governa operação NÃO terminal. */
  readonly unknown: boolean;
  /** Marcador de falha FINAL persistida; só governa operação NÃO terminal (PF). */
  readonly failed: boolean;
  /** E1 — claim `in_progress` presente (execução ativa ou residual). */
  readonly processing: boolean;
  /** Recorte 1 (Plano 08) — frescor da evidência de ausência (capturado ANTES da sonda). */
  readonly stateEpoch: number;
  /** Recorte 1 — estado do FENCE de publicação (separado do `status` do crédito). */
  readonly publicationState: string;
  readonly supportReference: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly latestAttemptAt: string | null;
  /** F60 — origem canônica da operação. */
  readonly origin?: "legacy" | "9_16_two_stage";
  /** F60 — etapa corrente do novo fluxo; `null` para legado/terminal sem pendência. */
  readonly stage?: "base" | "expansion" | null;
  /** F59 — formato resolvido quando o repositório recebe o resolvedor. */
  readonly format?: "1:1" | "9:16" | null;
}

function stageRank(stage: ClaimRow["stage"]): number {
  return stage === "expansion" ? 1 : 0;
}

function currentStage(steps: readonly StepRow[], terminal = false): "base" | "expansion" | null {
  if (terminal) return null;
  const base = steps.find((step) => step.stage === "base");
  const expansion = steps.find((step) => step.stage === "expansion");
  if (base && base.status !== "done") return "base";
  if (base?.status === "done" && expansion && expansion.status !== "done") {
    return "expansion";
  }
  if (expansion?.status === "done") return "expansion";
  return null;
}

export interface PendingArtifactProber {
  probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe>;
}

export type PendingFormatKind = "1:1" | "9:16" | "unavailable";

export class FormatUnavailableError extends Error {
  readonly code = "format_unavailable" as const;

  constructor() {
    super("format_unavailable");
    this.name = "FormatUnavailableError";
  }
}

export interface PendingRepositoryOptions {
  readonly resolveFormat?: (
    campaignId: string,
  ) => Promise<{ kind: PendingFormatKind }>;
  readonly verticalArtifacts?: PendingArtifactProber;
  /**
   * F60.5 — sonda de composição para a origem canônica `9_16_two_stage`.
   * Ausente ⇒ `FormatUnavailableError` (nunca cai no prober direto).
   */
  readonly twoStageArtifacts?: PendingArtifactProber;
}

/** Estado de uma operação para a LISTA (pendências + evidência derivada). */
export interface PendingOperationView extends PendingOperationState {
  /** C2 — resultado TIPADO da sonda de arte (server-side). */
  readonly artifactKind: ArtifactProbe["kind"];
  readonly format?: "1:1" | "9:16" | null;
  readonly formatUnavailable?: boolean;
}

/** Contrato estrutural consumido pelo serviço de resolução. */
export interface PendingOperationsRepository {
  findPendingOperation(
    campaignId: string,
    operationId: string,
  ): Promise<PendingOperationState | null>;
  probeArtifact(
    storeId: string,
    campaignId: string,
    operationId: string,
  ): Promise<ArtifactProbe>;
  listPendingOperations(): Promise<PendingOperationView[]>;
}

export class SupabasePendingOperationsRepository implements PendingOperationsRepository {
  private readonly client: SupabaseClient;
  private readonly artifacts: PendingArtifactProber;
  private readonly resolveFormat?: PendingRepositoryOptions["resolveFormat"];
  private readonly verticalArtifacts?: PendingArtifactProber;
  private readonly twoStageArtifacts?: PendingArtifactProber;

  constructor(
    client: SupabaseClient = supabaseAdmin,
    artifacts: PendingArtifactProber = new ProductOneToOneArtifactStore(client),
    options: PendingRepositoryOptions = {},
  ) {
    this.client = client;
    this.artifacts = artifacts;
    this.resolveFormat = options.resolveFormat;
    this.verticalArtifacts = options.verticalArtifacts;
    this.twoStageArtifacts = options.twoStageArtifacts;
  }

  private async formatFor(campaignId: string): Promise<PendingFormatKind> {
    if (!this.resolveFormat) return "1:1";
    try {
      return (await this.resolveFormat(campaignId)).kind;
    } catch {
      return "unavailable";
    }
  }

  private async readClaimHistory(
    campaignId: string,
    operationId: string,
  ): Promise<ClaimRow[]> {
    const { data, error } = await this.client
      .from(CLAIM_HISTORY_VIEW)
      .select(CLAIM_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId);
    if (error) throw new Error(`pending_operation_claim_history_read_failed:${error.message}`);
    return (data ?? []) as ClaimRow[];
  }

  private async hasActiveExecution(
    campaignId: string,
    operationId: string,
  ): Promise<boolean> {
    const { data, error } = await this.client
      .from(ACTIVE_CLAIMS_VIEW)
      .select("status")
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId);
    if (error) throw new Error(`pending_operation_active_read_failed:${error.message}`);
    return (data ?? []).length > 0;
  }

  private async readOutcome(
    campaignId: string,
    operationId: string,
  ): Promise<OutcomeRow | null> {
    const { data, error } = await this.client
      .from(OUTCOMES_VIEW)
      .select(OUTCOME_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw new Error(`pending_operation_outcome_read_failed:${error.message}`);
    return (data as OutcomeRow | null) ?? null;
  }

  private async readCanonicalOperation(
    campaignId: string,
    operationId: string,
    terminal: boolean,
  ): Promise<CanonicalOperation> {
    const { data, error } = await this.client
      .from(CANONICAL_OPERATIONS_TABLE)
      .select("campaign_id, operation_id")
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw new Error(`pending_operation_canonical_read_failed:${error.message}`);
    if (!data) return { origin: "legacy", stage: null };

    const { data: steps, error: stepsError } = await this.client
      .from(CANONICAL_STEPS_TABLE)
      .select(STEP_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId);
    if (stepsError) {
      throw new Error(`pending_operation_steps_read_failed:${stepsError.message}`);
    }
    return {
      origin: "9_16_two_stage",
      stage: currentStage((steps ?? []) as StepRow[], terminal),
    };
  }

  private orderHistory(claims: ClaimRow[], origin: "legacy" | "9_16_two_stage"): ClaimRow[] {
    return [...claims].sort((a, b) => {
      if (origin === "legacy") {
        const byNumber = b.attempt_number - a.attempt_number;
        if (byNumber !== 0) return byNumber;
        return (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      }
      const byTime = (b.updated_at ?? "").localeCompare(a.updated_at ?? "");
      if (byTime !== 0) return byTime;
      const rank = stageRank(b.stage) - stageRank(a.stage);
      if (rank !== 0) return rank;
      return b.attempt_number - a.attempt_number;
    });
  }

  async findPendingOperation(
    campaignId: string,
    operationId: string,
  ): Promise<PendingOperationState | null> {
    const { data, error } = await this.client
      .from(CREDIT_TABLE)
      .select(CREDIT_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw new Error(`pending_operation_read_failed:${error.message}`);
    if (!data) return null;

    const row = data as CreditRow;
    const terminal = row.status === "delivered" || row.status === "refunded";
    const canonical = await this.readCanonicalOperation(campaignId, operationId, terminal);
    const claims = this.orderHistory(
      await this.readClaimHistory(campaignId, operationId),
      canonical.origin,
    );
    const processing = await this.hasActiveExecution(campaignId, operationId);
    const outcome = await this.readOutcome(campaignId, operationId);

    // I2 — precedência terminal: o marcador `unknown` só governa operação NÃO
    // terminal (a linha histórica é imutável, não governa o estado terminal).
    const unknown = outcome?.outcome === "unknown" && !terminal;
    // P2 — falha FINAL persistida (`failed`) só governa operação NÃO terminal.
    const failed = outcome?.outcome === "failed" && !terminal;
    const latestAttemptAt = claims.length > 0 ? (claims[0].updated_at ?? null) : null;
    const formatKind = await this.formatFor(campaignId);

    return Object.freeze({
      campaignId: row.campaign_id,
      operationId: row.operation_id,
      storeId: row.store_id,
      status: row.status,
      amount: Number(row.amount ?? 0),
      terminal,
      unknown,
      failed,
      processing,
      stateEpoch: Number(row.state_epoch ?? 0),
      publicationState: String(row.publication_state ?? "none"),
      // P2 — a referência de suporte é exposta para QUALQUER marcador PERSISTIDO
      // NÃO terminal (`unknown` OU `failed`), sem alterar o significado de `unknown`.
      supportReference: !terminal ? (outcome?.support_reference ?? null) : null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      latestAttemptAt,
      origin: canonical.origin,
      stage: canonical.stage,
      format: formatKind === "unavailable" ? null : formatKind,
    });
  }

  async probeArtifact(
    storeId: string,
    campaignId: string,
    operationId: string,
  ): Promise<ArtifactProbe> {
    // F60 — a origem canônica MANDA sobre o formato resolvido. Uma operação do
    // fluxo de duas etapas só pode ser comprovada pela sonda VERTICAL final;
    // sem essa sonda o resultado é INCONCLUSIVO (nunca cai na sonda quadrada).
    const canonical = await this.readCanonicalOperation(campaignId, operationId, false);
    if (canonical.origin === "9_16_two_stage") {
      if (!this.twoStageArtifacts) throw new FormatUnavailableError();
      return this.twoStageArtifacts.probeArtifact({
        storeId,
        campaignId,
        operationId,
      });
    }

    const format = await this.formatFor(campaignId);
    if (format === "unavailable") throw new FormatUnavailableError();
    if (format === "9:16") {
      if (!this.verticalArtifacts) throw new FormatUnavailableError();
      return this.verticalArtifacts.probeArtifact({ storeId, campaignId, operationId });
    }
    return this.artifacts.probeArtifact({ storeId, campaignId, operationId });
  }

  /**
   * Lista SOMENTE-LEITURA das operações pendentes (`reserved`/`art_uploaded`),
   * com a evidência de arte TIPADA derivada server-side. Nunca executa nada.
   */
  async listPendingOperations(): Promise<PendingOperationView[]> {
    const { data, error } = await this.client
      .from(CREDIT_TABLE)
      .select(CREDIT_COLUMNS)
      .in("status", ["reserved", "art_uploaded"])
      .order("updated_at", { ascending: true });
    if (error) throw new Error(`pending_operations_read_failed:${error.message}`);

    const rows = (data ?? []) as CreditRow[];
    const views: PendingOperationView[] = [];
    for (const row of rows) {
      const state = await this.findPendingOperation(row.campaign_id, row.operation_id);
      if (!state) continue;
      try {
        const probe = await this.probeArtifact(
          state.storeId,
          state.campaignId,
          state.operationId,
        );
        views.push(
          Object.freeze({
            ...state,
            format: state.format ?? null,
            artifactKind: probe.kind,
          }),
        );
      } catch (error) {
        if (!(error instanceof FormatUnavailableError)) throw error;
        views.push(
          Object.freeze({
            ...state,
            format: null,
            formatUnavailable: true,
            artifactKind: "indeterminate" as const,
          }),
        );
      }
    }
    return views;
  }
}
