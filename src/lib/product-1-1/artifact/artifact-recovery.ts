import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProductOneToOneArtifactStore } from "./artifact-store";
import type { ArtifactProbe, ProductOneToOneArtifactRef } from "./types";
import type { CreditOperationStatus } from "@/lib/product-1-1/credit-operation/types";

/**
 * F56.2b2b (B2.2 / B2B-D1, D2 / REQ-56.2.4-01..03, -10) — Recuperação de arte
 * do Produto 1:1 (server-only).
 *
 * A recuperação CONSOME a sonda TIPADA existente (`probeArtifact`) — nunca
 * reimplementa a sonda nem colapsa erro de Storage com ausência — e:
 *   - `integral`      ⇒ recupera a arte EXISTENTE e CONCLUI a entrega usando as
 *                       RPCs b1a (`markArtUploaded` → `deliver`), SEM regenerar
 *                       e SEM chamar provider/`storeArtifact`;
 *   - `invalid`       ⇒ `unresolved` (reverificar/feedback honesto; nunca ausência);
 *   - `indeterminate` ⇒ `unresolved` (erro de Storage; nunca ausência);
 *   - `absent`        ⇒ devolvido como `absent` — ESTA camada NÃO fecha nem
 *                       estorna (o encerramento é governado pelo predicado PF no
 *                       orquestrador, Plano 03).
 *
 * FRONTEIRA ENDURECIDA (confirmação de resultado):
 *   - leitura de crédito AUSENTE ⇒ NÃO muta (não há identidade de crédito provada);
 *   - a leitura precisa ser `success === true`, com `campaign_id`/`operation_id`
 *     EXATOS da requisição e `status` esperado — caso contrário LANÇA (fail-closed);
 *   - só `reserved`/`art_uploaded` prosseguem; `delivered`/`refunded` ⇒ terminal;
 *   - `markArtUploaded` precisa confirmar `art_uploaded`; só então `deliver` roda;
 *   - a entrega só é ANUNCIADA quando `deliver` confirma `success === true` e
 *     `status === 'delivered'` (com identidade exata).
 *
 * A assinatura de URL (`getSignedArtifactUrl`) NUNCA é chamada aqui — ela é
 * SEPARADA e só ocorre no portão de download após `delivered`.
 */

/** Resultado DISCRIMINADO da recuperação (envelope fechado). */
export type ArtifactRecoveryOutcome =
  | "delivered"
  | "unresolved"
  | "absent"
  | "operation_terminal";

export interface ArtifactRecoveryResult {
  readonly outcome: ArtifactRecoveryOutcome;
  /** Tipo da sonda que originou o resultado (`integral|absent|invalid|indeterminate`). */
  readonly kind: ArtifactProbe["kind"];
  /** Estado de crédito observado (quando consultado); `null` para ausência/indefinido. */
  readonly status: CreditOperationStatus | null;
  /** Referência da arte recuperada (apenas no caminho `integral`). */
  readonly ref: ProductOneToOneArtifactRef | null;
}

/** Estado de crédito VALIDADO (identidade + status conferidos contra a requisição). */
export interface ValidatedCreditState {
  readonly campaignId: string;
  readonly operationId: string;
  readonly status: CreditOperationStatus;
}

/** Erros de fronteira da recuperação (resposta financeira contraditória ⇒ fail-closed). */
export type ArtifactRecoveryErrorCode =
  | "invalid_credit_response"
  | "credit_identity_mismatch"
  | "credit_status_unexpected";

export class ArtifactRecoveryError extends Error {
  constructor(
    public readonly code: ArtifactRecoveryErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ArtifactRecoveryError";
  }
}

/** Porta da sonda tipada (satisfeita por `ProductOneToOneArtifactStore`). */
export interface ArtifactRecoveryProbe {
  probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe>;
}

/** Porta do cliente de crédito ESTRITO (validação fechada de identidade/status). */
export interface ArtifactRecoveryCreditOps {
  get(campaignId: string, operationId: string): Promise<ValidatedCreditState | null>;
  /**
   * RECUPERAÇÃO: confirma objeto EXISTENTE via `product_1_1_confirm_existing_art`
   * (SEM token e SEM novo upload). `artKind` é a sonda SERVER-SIDE (`integral`).
   */
  confirmExistingArt(
    campaignId: string,
    operationId: string,
    artKind: ArtifactProbe["kind"],
  ): Promise<ValidatedCreditState>;
}

export interface ArtifactRecoveryDeps {
  readonly artifacts?: ArtifactRecoveryProbe;
  readonly credit?: ArtifactRecoveryCreditOps;
}

export interface RecoverDeliveryInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

const CREDIT_STATUSES: readonly CreditOperationStatus[] = [
  "reserved",
  "art_uploaded",
  "delivered",
  "refunded",
];

const GET_RPC = "product_1_1_get_campaign_credit_operation";

/**
 * Cliente de crédito ESTRITO e LOCAL à recuperação. NÃO altera o cliente
 * compartilhado (`ProductOneToOneCreditOperationClient`), cujos consumidores
 * (orquestrador/testes) preservam o comportamento legado. Aqui cada resposta é
 * validada: `success === true` explícito, identidade EXATA e status esperado.
 */
class StrictProductOneToOneCreditOps implements ArtifactRecoveryCreditOps {
  constructor(private readonly client: SupabaseClient) {}

  async get(
    campaignId: string,
    operationId: string,
  ): Promise<ValidatedCreditState | null> {
    const { data, error } = await this.client.rpc(GET_RPC, {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
    });
    if (error) {
      throw new ArtifactRecoveryError(
        "invalid_credit_response",
        error.message ?? "credit_read_error",
      );
    }
    // Operação genuinamente AUSENTE (o RPC devolve NULL) — distinta de resposta inválida.
    if (data === null || data === undefined) return null;
    return this.validate(data, campaignId, operationId);
  }

  async confirmExistingArt(
    campaignId: string,
    operationId: string,
    artKind: ArtifactProbe["kind"],
  ): Promise<ValidatedCreditState> {
    const { data, error } = await this.client.rpc("product_1_1_confirm_existing_art", {
      p_campaign_id: campaignId,
      p_operation_id: operationId,
      p_art_kind: artKind,
    });
    if (error) {
      throw new ArtifactRecoveryError(
        "invalid_credit_response",
        error.message ?? "credit_rpc_error",
      );
    }
    return this.validate(data, campaignId, operationId, "delivered");
  }

  private validate(
    data: unknown,
    campaignId: string,
    operationId: string,
    expected?: CreditOperationStatus,
  ): ValidatedCreditState {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      throw new ArtifactRecoveryError("invalid_credit_response", "empty_credit_response");
    }
    const record = data as Record<string, unknown>;
    // Suporte EXPLÍCITO: ausência de `success:true` NUNCA é sucesso.
    if (record.success !== true) {
      throw new ArtifactRecoveryError("invalid_credit_response", "missing_success");
    }
    const status = record.status;
    if (
      typeof status !== "string" ||
      !CREDIT_STATUSES.includes(status as CreditOperationStatus)
    ) {
      throw new ArtifactRecoveryError("credit_status_unexpected", "invalid_credit_status");
    }
    const returnedCampaign = String(record.campaign_id ?? "");
    const returnedOperation = String(record.operation_id ?? "");
    if (returnedCampaign !== campaignId || returnedOperation !== operationId) {
      throw new ArtifactRecoveryError(
        "credit_identity_mismatch",
        "credit_identity_mismatch",
      );
    }
    if (expected !== undefined && status !== expected) {
      throw new ArtifactRecoveryError(
        "credit_status_unexpected",
        `expected_${expected}`,
      );
    }
    return Object.freeze({
      campaignId: returnedCampaign,
      operationId: returnedOperation,
      status: status as CreditOperationStatus,
    });
  }
}

export class ProductOneToOneArtifactRecovery {
  private readonly artifacts: ArtifactRecoveryProbe;
  private readonly credit: ArtifactRecoveryCreditOps;

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    deps: ArtifactRecoveryDeps = {},
  ) {
    this.artifacts = deps.artifacts ?? new ProductOneToOneArtifactStore(client);
    this.credit = deps.credit ?? new StrictProductOneToOneCreditOps(client);
  }

  /**
   * Recupera a arte íntegra existente e conclui a entrega SEM regenerar; diferencia
   * os demais tipos da sonda sem nunca colapsar erro/indefinido com ausência.
   */
  async recoverDelivery(input: RecoverDeliveryInput): Promise<ArtifactRecoveryResult> {
    const probe = await this.artifacts.probeArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });

    // `invalid`/`indeterminate` NUNCA são ausência: reverificar / feedback honesto,
    // sem conclusão de ausência e sem estorno (nenhum efeito de ledger).
    if (probe.kind === "invalid" || probe.kind === "indeterminate") {
      return Object.freeze({
        outcome: "unresolved" as const,
        kind: probe.kind,
        status: null,
        ref: null,
      });
    }

    // `absent`: esta camada NÃO fecha nem estorna (o PF no orquestrador decide).
    if (probe.kind === "absent") {
      return Object.freeze({
        outcome: "absent" as const,
        kind: "absent" as const,
        status: null,
        ref: null,
      });
    }

    // `integral` — a leitura de crédito é a FRONTEIRA: sem identidade de crédito
    // válida NÃO há mutação. Ausente ⇒ `unresolved` (NÃO prossegue).
    const current = await this.credit.get(input.campaignId, input.operationId);
    if (current === null) {
      return Object.freeze({
        outcome: "unresolved" as const,
        kind: "integral" as const,
        status: null,
        ref: probe.ref,
      });
    }

    // Terminal: NENHUM efeito de ledger (`refunded` NÃO retorna a `delivered`).
    if (current.status === "delivered" || current.status === "refunded") {
      return Object.freeze({
        outcome: "operation_terminal" as const,
        kind: "integral" as const,
        status: current.status,
        ref: probe.ref,
      });
    }

    // Só `reserved`/`art_uploaded` chegam aqui (o leitor estrito garante o union).
    // Confirma o OBJETO EXISTENTE (sonda server-side `integral`) SEM novo upload;
    // a RPC exige crédito não-terminal e NUNCA reabre terminais.
    const delivered = await this.credit.confirmExistingArt(
      input.campaignId,
      input.operationId,
      "integral",
    );

    return Object.freeze({
      outcome: "delivered" as const,
      kind: "integral" as const,
      status: delivered.status,
      ref: probe.ref,
    });
  }
}
