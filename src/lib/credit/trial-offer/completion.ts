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

export interface TrialOfferResult {
  status: TrialOfferStatus;
  reason?: string;
  enrollment?: {
    id: string;
    startedAt: string;
    expiresAt: string;
    grantedTotal: number;
    lastGrantedSeq: number;
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
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

    return {
      status,
      enrollment: id
        ? { id, startedAt, expiresAt, grantedTotal, lastGrantedSeq }
        : undefined,
    };
  }

  if (status === "offer_disabled" || status === "expired_window") {
    return { status, reason: String(record.reason ?? status) };
  }

  return {
    status: "not_eligible",
    reason: String(record.reason ?? status ?? "not_eligible"),
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
      return { status: "not_eligible", reason: String(record.reason ?? status) };
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
 * não chama logo/perfil/assinatura e não invoca provider.
 */
export async function retryTrialOfferEnrollment(
  storeId: string,
): Promise<TrialOfferResult> {
  return runTrialOffer(storeId);
}
