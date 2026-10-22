import "server-only";

import { supabaseAdmin } from "@/lib/supabase/server";

export type TrialOfferStatus =
  | "started"
  | "existing"
  | "not_ready"
  | "offer_disabled"
  | "not_eligible"
  | "expired_window"
  | "retryable_failure";

/**
 * Motivos seguros expostos ao chamador (UI/rota). A allowlist é fechada: o
 * payload JSONB das RPCs nunca é repassado cru, de modo que campos internos
 * (identidade do beneficiário, hashes de raiz, ids de outra loja) não vazam.
 *
 * F50.4 adiciona os motivos por coorte:
 * - `beneficiary_already_enrolled`: o CNPJ completo já possui inscrição;
 * - `root_used_other_beneficiary`: a raiz já consumiu o benefício legado em
 *   outra filial (somente coorte `root_legacy`);
 * - `beneficiary_already_used`: restrição por CNPJ reportada pela RPC;
 * - `prior_benefit_ambiguous`: benefício anterior ambíguo (fail-closed,
 *   diagnóstico administrativo — nunca compensação automática).
 */
export type TrialOfferReason =
  | "beneficiary_already_enrolled"
  | "root_used_other_beneficiary"
  | "beneficiary_already_used"
  | "prior_benefit_ambiguous"
  | "prior_benefit"
  | "not_ready"
  | "not_completed"
  | "expired_window"
  | "offer_disabled"
  | "launch_not_set"
  | "account_before_launch"
  | "account_not_found"
  | "store_not_found"
  | "no_root"
  | "test_store"
  | "not_eligible"
  | "record_failed"
  | "start_failed"
  | "unexpected_error";

export interface TrialOfferResult {
  status: TrialOfferStatus;
  reason?: TrialOfferReason;
  enrollment?: {
    id: string;
    startedAt: string;
    expiresAt: string;
    grantedTotal: number;
    lastGrantedSeq: number;
  };
}

const SAFE_REASONS: ReadonlySet<string> = new Set<TrialOfferReason>([
  "beneficiary_already_enrolled",
  "root_used_other_beneficiary",
  "beneficiary_already_used",
  "prior_benefit_ambiguous",
  "prior_benefit",
  "not_ready",
  "not_completed",
  "expired_window",
  "offer_disabled",
  "launch_not_set",
  "account_before_launch",
  "account_not_found",
  "store_not_found",
  "no_root",
  "test_store",
  "not_eligible",
  "record_failed",
  "start_failed",
  "unexpected_error",
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

/** Descarta qualquer motivo fora da allowlist; nunca repassa payload externo. */
function sanitizeReason(value: unknown, fallback: TrialOfferReason): TrialOfferReason {
  const candidate = typeof value === "string" ? value.trim() : "";
  return SAFE_REASONS.has(candidate) ? (candidate as TrialOfferReason) : fallback;
}

function mapStartResult(data: unknown): TrialOfferResult {
  const record = asRecord(data);
  const status = String(record.status ?? "not_eligible");

  if (status === "started" || status === "existing") {
    const enrollmentRaw = asRecord(record.enrollment);
    const grant = asRecord(record.grant);
    const id = String(record.enrollment_id ?? enrollmentRaw.id ?? "");
    const startedAt = String(record.started_at ?? enrollmentRaw.started_at ?? "");
    const expiresAt = String(record.expires_at ?? enrollmentRaw.expires_at ?? "");
    const grantedTotal = Number(
      record.granted_total ?? enrollmentRaw.granted_total ?? grant.granted_total ?? 0,
    );
    const lastGrantedSeq = Number(
      record.last_granted_seq ?? enrollmentRaw.last_granted_seq ?? 0,
    );

    // `existing` só chega aqui quando a RPC devolve o enrollment da própria
    // loja (escopo por `store_id`); nenhum dado de outra filial é montado.
    return {
      status,
      enrollment: id
        ? {
            id,
            startedAt,
            expiresAt,
            grantedTotal: Number.isFinite(grantedTotal) ? grantedTotal : 0,
            lastGrantedSeq: Number.isFinite(lastGrantedSeq) ? lastGrantedSeq : 0,
          }
        : undefined,
    };
  }

  if (status === "offer_disabled") {
    return {
      status: "offer_disabled",
      reason: sanitizeReason(record.reason, "offer_disabled"),
    };
  }

  if (status === "expired_window") {
    return {
      status: "expired_window",
      reason: sanitizeReason(record.reason, "expired_window"),
    };
  }

  if (status === "not_ready") {
    return { status: "not_ready", reason: sanitizeReason(record.reason, "not_ready") };
  }

  // Motivos por coorte (F50.4) e demais recusas seguras permanecem como
  // `not_eligible` + motivo allowlisted.
  return {
    status: "not_eligible",
    reason: sanitizeReason(record.reason ?? record.status, "not_eligible"),
  };
}

async function runTrialOffer(storeId: string): Promise<TrialOfferResult> {
  try {
    const recordResult = await supabaseAdmin.rpc("record_onboarding_completion", {
      p_store_id: storeId,
    });

    if (recordResult.error) {
      return { status: "retryable_failure", reason: "record_failed" };
    }

    const record = asRecord(recordResult.data);
    if (record.completed !== true) {
      const status = String(record.status ?? "not_ready");
      if (status === "not_ready") return { status: "not_ready", reason: "not_ready" };
      return {
        status: "not_eligible",
        reason: sanitizeReason(record.reason ?? status, "not_eligible"),
      };
    }

    const startResult = await supabaseAdmin.rpc("start_trial_offer_enrollment", {
      p_store_id: storeId,
    });

    if (startResult.error) {
      return { status: "retryable_failure", reason: "start_failed" };
    }

    return mapStartResult(startResult.data);
  } catch {
    return { status: "retryable_failure", reason: "unexpected_error" };
  }
}

/**
 * Chamado após o salvamento bem-sucedido do onboarding. Nunca lança: a rota
 * principal deve continuar funcionando mesmo se a concessão falhar.
 */
export async function maybeCompleteOnboardingAndStartTrial(
  storeId: string,
): Promise<TrialOfferResult> {
  return runTrialOffer(storeId);
}

/**
 * Retry dedicado: repete somente conclusão/inscrição. Não salva onboarding,
 * não chama logo/perfil/assinatura e não invoca provider. Como ambos os passos
 * são RPCs idempotentes por loja, repetir a chamada não duplica enrollment nem
 * crédito.
 */
export async function retryTrialOfferEnrollment(
  storeId: string,
): Promise<TrialOfferResult> {
  return runTrialOffer(storeId);
}
