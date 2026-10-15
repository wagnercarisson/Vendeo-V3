import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/server";
import { ProductOneToOneArtifactStore } from "./artifact-store";
import type { ArtifactProbe, ProductOneToOneArtifactRef } from "./types";
import { ProductOneToOneCreditOperationClient } from "@/lib/product-1-1/credit-operation/credit-operation-client";
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
 * Escopo financeiro LIMITADO a operações NÃO terminais: se a operação estiver
 * `delivered`/`refunded`, nenhum efeito de ledger é aplicado (`operation_terminal`).
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

/** Porta da sonda tipada (satisfeita por `ProductOneToOneArtifactStore`). */
export interface ArtifactRecoveryProbe {
  probeArtifact(input: {
    storeId: string;
    campaignId: string;
    operationId: string;
  }): Promise<ArtifactProbe>;
}

/** Porta do cliente de crédito (subconjunto de `ProductOneToOneCreditOperationClient`). */
export interface ArtifactRecoveryCreditOps {
  get(
    campaignId: string,
    operationId: string,
  ): Promise<{ readonly status: CreditOperationStatus } | null>;
  markArtUploaded(
    campaignId: string,
    operationId: string,
  ): Promise<{ readonly status: CreditOperationStatus }>;
  deliver(
    campaignId: string,
    operationId: string,
  ): Promise<{ readonly status: CreditOperationStatus }>;
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

export class ProductOneToOneArtifactRecovery {
  private readonly artifacts: ArtifactRecoveryProbe;
  private readonly credit: ArtifactRecoveryCreditOps;

  constructor(
    private readonly client: SupabaseClient = supabaseAdmin,
    deps: ArtifactRecoveryDeps = {},
  ) {
    this.artifacts = deps.artifacts ?? new ProductOneToOneArtifactStore(client);
    this.credit = deps.credit ?? new ProductOneToOneCreditOperationClient(client);
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

    // `integral`: recuperar arte EXISTENTE e CONCLUIR a entrega SEM regenerar.
    // Escopo financeiro LIMITADO a operações NÃO terminais.
    const current = await this.credit.get(input.campaignId, input.operationId);
    const currentStatus = current?.status ?? null;
    if (currentStatus === "delivered" || currentStatus === "refunded") {
      // Terminal: NENHUM efeito de ledger (refunded NÃO retorna a delivered).
      return Object.freeze({
        outcome: "operation_terminal" as const,
        kind: "integral" as const,
        status: currentStatus,
        ref: probe.ref,
      });
    }

    // `reserved → art_uploaded → delivered` (idempotente quando já `art_uploaded`).
    await this.credit.markArtUploaded(input.campaignId, input.operationId);
    const delivered = await this.credit.deliver(input.campaignId, input.operationId);

    return Object.freeze({
      outcome: "delivered" as const,
      kind: "integral" as const,
      status: delivered.status,
      ref: probe.ref,
    });
  }
}
