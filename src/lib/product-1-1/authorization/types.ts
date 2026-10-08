/**
 * F56.2b1a — Tipos da autorização independente de estágio do Produto 1:1.
 *
 * A autorização é separada das feature flags: o estágio concedido vive no
 * histórico append-only `product_flow_stage_authorizations` e é revalidado a
 * cada decisão (escopo, instância, expiração e revogação). Nesta change o estado
 * operacional permanece sempre `off`.
 */

export type ProductFlowStage =
  | "off"
  | "isolated_pilot"
  | "test_stores"
  | "all_stores";

export const PRODUCT_FLOW_STAGES = Object.freeze([
  "off",
  "isolated_pilot",
  "test_stores",
  "all_stores",
] as const satisfies readonly ProductFlowStage[]);

export type ProductFlowScope = "test_stores" | "all_stores";

export const PRODUCT_FLOW_SCOPES = Object.freeze([
  "test_stores",
  "all_stores",
] as const satisfies readonly ProductFlowScope[]);

/**
 * Ambiente em que a autorização é revalidada. O piloto isolado só é válido no
 * ambiente isolado; nunca autoriza lojas operacionais.
 */
export type ProductFlowEnvironment = "isolated" | "operational";

export const PRODUCT_FLOW_ENVIRONMENTS = Object.freeze([
  "isolated",
  "operational",
] as const satisfies readonly ProductFlowEnvironment[]);

export type StageAuthorizationEventType = "granted" | "revoked" | "refused";

/** Evento append-only do histórico de autorizações. */
export interface StageAuthorizationEvent {
  readonly eventType: StageAuthorizationEventType;
  readonly stage: ProductFlowStage;
  readonly scope: ProductFlowScope;
  readonly instanceIdentity: string;
  readonly grantedBy: string | null;
  readonly reason: string;
  readonly operationId: string;
  readonly expiresAtMs: number | null;
  readonly createdAtMs: number;
  /** Ordem autoritativa de inserção (desempate determinístico de timestamps). */
  readonly seq: number;
}

/** Estado corrente derivado do histórico (nunca persistido como UPDATE). */
export interface CurrentStageAuthorization {
  readonly stage: ProductFlowStage;
  readonly scope: ProductFlowScope;
  readonly instanceIdentity: string;
  readonly expiresAtMs: number | null;
  readonly revokedAtMs: number | null;
}
