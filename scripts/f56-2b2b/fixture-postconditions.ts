/**
 * F56.2b2b — Plano 10 (Recorte 3): validador PURO das pós-condições de uma
 * fixture de UAT existente. Sem banco: recebe FATOS coletados e decide se a
 * fixture está COMPLETA (terminal coerente) ou PARCIAL (⇒ parada explícita).
 *
 * Verifica: status terminal `refunded`; marcador `failed` da MESMA operação;
 * `credit_tx_id` e `refund_tx_id` (efeito de ledger); e a EVIDÊNCIA congelada
 * esperada (direção) conforme o cenário.
 */

export type Direction = "studio" | "original" | "ambient";

export interface FixtureFacts {
  readonly key: string;
  readonly campaignId: string;
  readonly operationId: string;
  readonly status: string | null;
  readonly creditTxId: string | null;
  readonly refundTxId: string | null;
  readonly outcome: string | null;
  readonly outcomeOperationId: string | null;
  readonly evidenceDirection: string | null;
  /** Direção ESPERADA pelo cenário (`null` ⇒ NÃO deve haver evidência). */
  readonly expectedDirection: Direction | null;
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
  if (!facts.creditTxId) {
    return { ok: false, reason: "missing_credit_tx" };
  }
  if (!facts.refundTxId) {
    return { ok: false, reason: "missing_refund_tx" };
  }
  if (facts.expectedDirection) {
    if (facts.evidenceDirection !== facts.expectedDirection) {
      return { ok: false, reason: `direction=${String(facts.evidenceDirection)}` };
    }
  } else if (facts.evidenceDirection !== null) {
    return { ok: false, reason: `unexpected_evidence=${String(facts.evidenceDirection)}` };
  }
  return { ok: true };
}
