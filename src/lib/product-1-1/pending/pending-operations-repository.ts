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
const CLAIMS_TABLE = "product_1_1_generation_attempt_claims";
const OUTCOMES_TABLE = "product_1_1_generation_outcomes";

const CREDIT_COLUMNS =
  "campaign_id, operation_id, store_id, amount, status, created_at, updated_at";
const CLAIMS_COLUMNS = "status, attempt_number, updated_at";
const OUTCOME_COLUMNS = "outcome, support_reference";

interface CreditRow {
  campaign_id: string;
  operation_id: string;
  store_id: string;
  amount: number;
  status: CreditOperationStatus;
  created_at: string | null;
  updated_at: string | null;
}

interface ClaimRow {
  status: string;
  attempt_number: number;
  updated_at: string | null;
}

interface OutcomeRow {
  outcome: string;
  support_reference: string | null;
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
  /** E1 — claim `in_progress` presente (execução ativa ou residual). */
  readonly processing: boolean;
  readonly supportReference: string | null;
  readonly createdAt: string | null;
  readonly updatedAt: string | null;
  readonly latestAttemptAt: string | null;
}

/** Estado de uma operação para a LISTA (pendências + evidência derivada). */
export interface PendingOperationView extends PendingOperationState {
  /** C2 — resultado TIPADO da sonda de arte (server-side). */
  readonly artifactKind: ArtifactProbe["kind"];
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
  private readonly artifacts: ProductOneToOneArtifactStore;

  constructor(
    client: SupabaseClient = supabaseAdmin,
    artifacts: ProductOneToOneArtifactStore = new ProductOneToOneArtifactStore(client),
  ) {
    this.client = client;
    this.artifacts = artifacts;
  }

  private async readClaims(campaignId: string, operationId: string): Promise<ClaimRow[]> {
    const { data, error } = await this.client
      .from(CLAIMS_TABLE)
      .select(CLAIMS_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .order("attempt_number", { ascending: false });
    if (error) throw new Error(`pending_operation_claims_read_failed:${error.message}`);
    return (data ?? []) as ClaimRow[];
  }

  private async readOutcome(
    campaignId: string,
    operationId: string,
  ): Promise<OutcomeRow | null> {
    const { data, error } = await this.client
      .from(OUTCOMES_TABLE)
      .select(OUTCOME_COLUMNS)
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw new Error(`pending_operation_outcome_read_failed:${error.message}`);
    return (data as OutcomeRow | null) ?? null;
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
    const claims = await this.readClaims(campaignId, operationId);
    const outcome = await this.readOutcome(campaignId, operationId);

    const terminal = row.status === "delivered" || row.status === "refunded";
    // I2 — precedência terminal: o marcador `unknown` só governa operação NÃO
    // terminal (a linha histórica é imutável, não governa o estado terminal).
    const unknown = outcome?.outcome === "unknown" && !terminal;
    const processing = claims.some((claim) => claim.status === "in_progress");
    const latestAttemptAt = claims.length > 0 ? (claims[0].updated_at ?? null) : null;

    return Object.freeze({
      campaignId: row.campaign_id,
      operationId: row.operation_id,
      storeId: row.store_id,
      status: row.status,
      amount: Number(row.amount ?? 0),
      terminal,
      unknown,
      processing,
      supportReference: unknown ? (outcome?.support_reference ?? null) : null,
      createdAt: row.created_at ?? null,
      updatedAt: row.updated_at ?? null,
      latestAttemptAt,
    });
  }

  async probeArtifact(
    storeId: string,
    campaignId: string,
    operationId: string,
  ): Promise<ArtifactProbe> {
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
      const probe = await this.probeArtifact(
        state.storeId,
        state.campaignId,
        state.operationId,
      );
      views.push(Object.freeze({ ...state, artifactKind: probe.kind }));
    }
    return views;
  }
}
