/**
 * F56.2b2b — Plano 10 (Recorte 3): validador PURO das pós-condições de uma
 * fixture de UAT existente. Sem banco: recebe FATOS coletados (inclusive das
 * transações de ledger e do snapshot) e decide se a fixture está COMPLETA
 * (terminal coerente) ou PARCIAL (⇒ parada explícita).
 *
 * Verifica:
 *  - status terminal `refunded`;
 *  - marcador `failed` da MESMA operação;
 *  - `credit_tx_id`/`refund_tx_id` EXISTEM, pertencem à LOJA e o refund é `refund`;
 *  - EVIDÊNCIA congelada (direção) esperada conforme o cenário;
 *  - SNAPSHOT esperado: marcador do novo fluxo presente e restaurável compatível.
 */

export type Direction = "studio" | "original" | "ambient";

export interface FixtureFacts {
  readonly key: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly storeId: string;
  readonly status: string | null;
  readonly outcome: string | null;
  readonly outcomeOperationId: string | null;
  readonly creditTxId: string | null;
  readonly creditTxExists: boolean;
  readonly creditTxStoreId: string | null;
  readonly refundTxId: string | null;
  readonly refundTxExists: boolean;
  readonly refundTxStoreId: string | null;
  readonly refundTxType: string | null;
  readonly evidenceDirection: string | null;
  readonly expectedDirection: Direction | null;
  readonly snapshotHasNewFlowMarker: boolean;
  readonly snapshotIsRestorable: boolean;
  readonly expectedRestorable: boolean;
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly reason?: string;
}

export function validateFixturePostconditions(facts: FixtureFacts): ValidationResult {
  if (facts.status !== "refunded") {
    return { ok: false, reason: `status=${String(facts.status)}` };
  }
  if (facts.outcome !== "failed") {
    return { ok: false, reason: `outcome=${String(facts.outcome)}` };
  }
  if (facts.outcomeOperationId !== facts.operationId) {
    return { ok: false, reason: "outcome_operation_mismatch" };
  }
  // Ledger: a reserva precisa EXISTIR e ser da MESMA loja.
  if (!facts.creditTxId || !facts.creditTxExists || facts.creditTxStoreId !== facts.storeId) {
    return { ok: false, reason: "credit_tx_mismatch" };
  }
  // Ledger: o estorno precisa EXISTIR, ser da MESMA loja e ser do tipo `refund`.
  if (
    !facts.refundTxId ||
    !facts.refundTxExists ||
    facts.refundTxStoreId !== facts.storeId ||
    facts.refundTxType !== "refund"
  ) {
    return { ok: false, reason: "refund_tx_mismatch" };
  }
  // Snapshot esperado do cenário.
  if (!facts.snapshotHasNewFlowMarker) {
    return { ok: false, reason: "snapshot_marker_missing" };
  }
  if (facts.snapshotIsRestorable !== facts.expectedRestorable) {
    return { ok: false, reason: `snapshot_restorable=${facts.snapshotIsRestorable}` };
  }
  // Evidência congelada (direção) esperada.
  if (facts.expectedDirection) {
    if (facts.evidenceDirection !== facts.expectedDirection) {
      return { ok: false, reason: `direction=${String(facts.evidenceDirection)}` };
    }
  } else if (facts.evidenceDirection !== null) {
    return { ok: false, reason: `unexpected_evidence=${String(facts.evidenceDirection)}` };
  }
  return { ok: true };
}
