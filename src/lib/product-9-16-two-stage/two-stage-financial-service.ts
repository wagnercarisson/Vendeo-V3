import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  ProductOneToOneCreditOperationClient,
} from "@/lib/product-1-1/credit-operation/credit-operation-client";
import type { CreditOperationState, CreditOperationStatus } from "@/lib/product-1-1/credit-operation/types";
import {
  SupabasePendingOperationsRepository,
  type PendingOperationsRepository,
} from "@/lib/product-1-1/pending/pending-operations-repository";
import {
  resolvePendingOperation,
  type ResolvePendingInput,
  type PendingResolutionResult,
} from "@/lib/product-1-1/pending/resolve-pending-operation";
import { projectDeliveredCampaign } from "@/lib/product-1-1/orchestration/project-delivered-campaign";
import { projectClosedCampaign } from "@/lib/product-1-1/orchestration/project-closed-campaign";
import { ProductTwoStageOperationClient } from "./two-stage-operation-client";
import type { ProductTwoStageOperationError } from "./types";

const CREDIT_TABLE = "product_1_1_campaign_credit_operations";

/** Sonda tipada da arte vertical FINAL. Vinculada à campanha/operação. */
export interface VerticalArtifactProbeInput {
  readonly storeId: string;
  readonly campaignId: string;
  readonly operationId: string;
}

export type VerticalArtifactProbeResult =
  | {
      readonly kind: "integral";
      readonly format: "9:16";
      readonly width: 1080;
      readonly height: 1920;
      readonly mimeType: "image/jpeg";
      readonly storagePath: string;
      readonly evidenceRef: string;
    }
  | { readonly kind: "absent" }
  | { readonly kind: "invalid" }
  | { readonly kind: "indeterminate" };

export interface VerticalArtifactProbe {
  probeVerticalArtifact(input: VerticalArtifactProbeInput): Promise<VerticalArtifactProbeResult>;
}

function integralVerticalPath(probe: VerticalArtifactProbeResult): string | null {
  if (
    probe.kind !== "integral" ||
    probe.format !== "9:16" ||
    probe.width !== 1080 ||
    probe.height !== 1920 ||
    probe.mimeType !== "image/jpeg" ||
    probe.storagePath.trim() === "" ||
    probe.evidenceRef.trim() === ""
  ) {
    return null;
  }
  return probe.storagePath;
}

export type FinancialServiceErrorCode =
  | "operation_not_found"
  | "amount_mismatch"
  | "invalid_transition"
  | "operation_terminal"
  | "operation_unknown"
  | "insufficient_evidence"
  | "authority_missing"
  | "delivery_required";

export class TwoStageFinancialError extends Error {
  constructor(
    public readonly code: FinancialServiceErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "TwoStageFinancialError";
  }
}

export interface FinancialAuthority {
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly amount: number;
  readonly status: CreditOperationStatus;
  readonly terminal: boolean;
  readonly delivered: boolean;
  readonly refunded: boolean;
  readonly reserved: boolean;
  readonly stateEpoch: number;
  readonly publicationState: string;
}

export interface ReserveOperationResult {
  readonly open: Awaited<ReturnType<ProductTwoStageOperationClient["open"]>>;
  readonly authority: FinancialAuthority;
}

export type ConfirmDeliveryResult = CreditOperationState;

export type RefundResult =
  | { readonly kind: "refunded"; readonly state: CreditOperationState }
  | { readonly kind: "delivery_required"; readonly probe: VerticalArtifactProbeResult & { kind: "integral" } }
  | { readonly kind: "insufficient_evidence"; readonly probeKind: "invalid" | "indeterminate" };

export interface TwoStageFinancialDependencies {
  readonly client?: SupabaseClient;
  readonly credit?: ProductOneToOneCreditOperationClient;
  readonly control?: ProductTwoStageOperationClient;
  readonly repository?: PendingOperationsRepository;
  readonly resolvePending?: typeof resolvePendingOperation;
}

export class TwoStageFinancialService {
  private readonly client: SupabaseClient;
  private readonly credit: ProductOneToOneCreditOperationClient;
  private readonly control: ProductTwoStageOperationClient;
  private readonly repository: PendingOperationsRepository;
  private readonly resolvePending: typeof resolvePendingOperation;

  constructor(deps: TwoStageFinancialDependencies = {}) {
    this.client = deps.client ?? supabaseAdmin;
    this.credit = deps.credit ?? new ProductOneToOneCreditOperationClient(this.client);
    this.control = deps.control ?? new ProductTwoStageOperationClient(this.client);
    this.repository =
      deps.repository ?? new SupabasePendingOperationsRepository(this.client);
    this.resolvePending = deps.resolvePending ?? resolvePendingOperation;
  }

  /**
   * Abertura atômica; a RPC não devolve `amount`, então a conferência de 1
   * crédito é feita na autoridade financeira. Replay de operação entregue ou
   * estornada é legítimo.
   */
  async reserveOperationOnce(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ReserveOperationResult> {
    const open = await this.control.open(input);
    if (!open.success) {
      throw new TwoStageFinancialError(
        open.reason === "operation_terminal" ? "operation_terminal" : "invalid_transition",
        open.reason,
      );
    }
    const authority = await this.readFinancialAuthority(input.campaignId, input.operationId);
    if (!authority) {
      throw new TwoStageFinancialError("authority_missing", "credit_operation_missing");
    }
    if (authority.amount !== 1) {
      throw new TwoStageFinancialError("amount_mismatch", "amount_must_be_one");
    }
    return Object.freeze({ open, authority });
  }

  /**
   * SOMENTE entrega vertical. A sonda é server-side e vinculada à operação;
   * o chamador não fornece evidência. O token deve ter sido adquirido antes.
   */
  async confirmOnVerticalDelivery(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    publicationToken: string;
    verticalArtifactProbe: VerticalArtifactProbe;
  }): Promise<ConfirmDeliveryResult> {
    if (!input.publicationToken) {
      throw new TwoStageFinancialError("invalid_transition", "missing_publication_token");
    }
    const authority = await this.readFinancialAuthority(input.campaignId, input.operationId);
    if (!authority) {
      throw new TwoStageFinancialError("operation_not_found");
    }
    if (authority.storeId !== input.storeId) {
      throw new TwoStageFinancialError("invalid_transition", "store_mismatch");
    }
    if (authority.status === "delivered") {
      const state = await this.credit.get(input.campaignId, input.operationId);
      if (!state) throw new TwoStageFinancialError("operation_not_found");
      return Object.freeze({ ...state, idempotent: true });
    }
    if (authority.status === "refunded" || authority.terminal) {
      throw new TwoStageFinancialError("operation_terminal");
    }

    const resume = await this.control.resume({
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    if (!resume.success) {
      throw new TwoStageFinancialError("operation_not_found", resume.reason);
    }
    if (resume.action === "blocked" || resume.failedOutcome) {
      throw new TwoStageFinancialError("invalid_transition", "operation_blocked");
    }
    if (resume.unknown) throw new TwoStageFinancialError("operation_unknown");
    if (resume.baseStatus !== "done" || resume.expansionStatus !== "done") {
      throw new TwoStageFinancialError("invalid_transition", "steps_not_done");
    }

    const probe = await input.verticalArtifactProbe.probeVerticalArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });
    if (
      probe.kind !== "integral" ||
      probe.format !== "9:16" ||
      probe.width !== 1080 ||
      probe.height !== 1920 ||
      probe.mimeType !== "image/jpeg" ||
      probe.storagePath.trim() === "" ||
      probe.evidenceRef.trim() === ""
    ) {
      throw new TwoStageFinancialError("insufficient_evidence", `artifact_${probe.kind}`);
    }

    await this.credit.markArtUploaded(
      input.campaignId,
      input.operationId,
      input.publicationToken,
    );
    return this.credit.deliver(
      input.campaignId,
      input.operationId,
      input.publicationToken,
    );
  }

  /**
   * Captura o epoch ANTES da sonda e usa o `artKind` REAL. `integral` não
   * estorna e não entrega automaticamente: apenas indica o caminho de entrega.
   */
  async refundOnDefinitiveFailure(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
    verticalArtifactProbe: VerticalArtifactProbe;
    reason?: string;
  }): Promise<RefundResult> {
    // A sonda é vinculada à loja da AUTORIDADE financeira. Um `storeId`
    // divergente não pode direcionar a busca para outro local e autorizar um
    // encerramento indevido.
    const authority = await this.readFinancialAuthority(input.campaignId, input.operationId);
    if (!authority) throw new TwoStageFinancialError("operation_not_found");
    if (authority.storeId !== input.storeId) {
      throw new TwoStageFinancialError("invalid_transition", "store_mismatch");
    }

    const observedEpoch = await this.credit.getPublicationEpoch(
      input.campaignId,
      input.operationId,
    );
    const probe = await input.verticalArtifactProbe.probeVerticalArtifact({
      storeId: input.storeId,
      campaignId: input.campaignId,
      operationId: input.operationId,
    });

    if (probe.kind === "integral") {
      return Object.freeze({ kind: "delivery_required", probe });
    }
    if (probe.kind === "invalid" || probe.kind === "indeterminate") {
      return Object.freeze({ kind: "insufficient_evidence", probeKind: probe.kind });
    }

    const state = await this.credit.closeFailedOperation({
      campaignId: input.campaignId,
      operationId: input.operationId,
      artKind: "absent",
      observedEpoch,
      reason: input.reason ?? "refund_definitive_failure",
    });
    return Object.freeze({ kind: "refunded", state });
  }

  /** Leitura da autoridade financeira; nenhum cache/segunda verdade. */
  async readFinancialAuthority(
    campaignId: string,
    operationId: string,
  ): Promise<FinancialAuthority | null> {
    const { data, error } = await this.client
      .from(CREDIT_TABLE)
      .select("campaign_id, operation_id, store_id, amount, status, state_epoch, publication_state")
      .eq("campaign_id", campaignId)
      .eq("operation_id", operationId)
      .maybeSingle();
    if (error) throw new TwoStageFinancialError("authority_missing", error.message);
    if (!data) return null;

    const status = data.status as CreditOperationStatus;
    return Object.freeze({
      campaignId: String(data.campaign_id),
      operationId: String(data.operation_id),
      storeId: String(data.store_id),
      amount: Number(data.amount ?? 0),
      status,
      terminal: status === "delivered" || status === "refunded",
      delivered: status === "delivered",
      refunded: status === "refunded",
      reserved: status === "reserved",
      stateEpoch: Number(data.state_epoch ?? 0),
      publicationState: String(data.publication_state ?? "none"),
    });
  }

  /**
   * Resolução administrativa auditada: a evidência é derivada server-side pelo
   * serviço existente; o chamador fornece apenas ator, motivo e identidade da
   * resolução.
   */
  async resolveUnknown(input: {
    actorId: string;
    campaignId: string;
    operationId: string;
    decision: "deliver" | "refund";
    reason: string;
    resolutionOperationId: string;
    /**
     * Dependência controlada para a projeção de entrega: a MESMA sonda vertical
     * server-side que valida a arte administrativa fornece o caminho real. Sem
     * ela, `decision='deliver'` falha fechado em vez de presumir `art-1024.jpg`.
     */
    verticalArtifactProbe?: VerticalArtifactProbe;
  }): Promise<PendingResolutionResult> {
    const action = input.decision === "deliver" ? "deliver_existing_art" : "refund_once";

    let expectedArtifactPath: string | undefined;
    if (input.decision === "deliver") {
      if (!input.verticalArtifactProbe) {
        throw new TwoStageFinancialError("insufficient_evidence", "vertical_probe_required");
      }
      const authority = await this.readFinancialAuthority(
        input.campaignId,
        input.operationId,
      );
      if (!authority) throw new TwoStageFinancialError("operation_not_found");
      const probe = await input.verticalArtifactProbe.probeVerticalArtifact({
        storeId: authority.storeId,
        campaignId: input.campaignId,
        operationId: input.operationId,
      });
      const path = integralVerticalPath(probe);
      if (!path) {
        throw new TwoStageFinancialError(
          "insufficient_evidence",
          `artifact_${probe.kind}`,
        );
      }
      expectedArtifactPath = path;
    }

    const resolutionInput: ResolvePendingInput = {
      actorId: input.actorId,
      campaignId: input.campaignId,
      operationId: input.operationId,
      action,
      reason: input.reason,
      resolutionOperationId: input.resolutionOperationId,
      authorizeAbandon: true,
      authorizePublicationClosure: true,
    };
    return this.resolvePending(resolutionInput, {
      repository: this.repository,
      client: this.client,
      // A projeção pós-resolução deve usar o MESMO cliente injetado (nunca o
      // global) e, na entrega, o caminho VERTICAL validado — nunca o default 1:1.
      projectDeliveredCampaign: (projectionInput, deps = {}) =>
        projectDeliveredCampaign(
          expectedArtifactPath
            ? { ...projectionInput, expectedArtifactPath }
            : projectionInput,
          { ...deps, client: this.client },
        ),
      projectClosedCampaign: (projectionInput, deps = {}) =>
        projectClosedCampaign(projectionInput, { ...deps, client: this.client }),
    });
  }
}

export type { ProductTwoStageOperationError };
