import {
  TRIAL_DURATION_DAYS,
  TRIAL_INSTALLMENT_DAYS,
} from "./constants";

export type TrialOfferStatus =
  | "unknown"
  | "not_started"
  | "active"
  | "expiring_soon"
  | "exhausted"
  | "expired"
  | "legacy_demo"
  | "none";

export interface TrialOfferEnrollmentView {
  id: string;
  startedAt: string;
  expiresAt: string;
  grantedTotal: number;
  lastGrantedSeq: number;
}

export interface TrialOfferStatusInput {
  enrollment: TrialOfferEnrollmentView | null;
  demoBalance: number;
  demoExpiresAt: string | null;
  hasLegacyDemo?: boolean;
  /**
   * Sinal autoritativo de elegibilidade ao teste, decidido pelo servidor.
   * Ausência de inscrição NÃO é prova de elegibilidade: contas legadas que
   * nunca participaram do teste não devem receber promessa de benefício.
   * Quando omitido, o status é tratado como "unknown" (fail-closed).
   */
  eligibility?: "eligible" | "unknown";
}

export interface NextTrialInstallment {
  seq: number;
  dueAt: string;
}

export function getTrialOfferStatus(
  input: TrialOfferStatusInput,
  now: Date = new Date(),
): TrialOfferStatus {
  const enrollment = input.enrollment;
  if (!enrollment) {
    if (input.hasLegacyDemo) return "legacy_demo";
    if (input.demoBalance > 0 || input.demoExpiresAt) return "active";
    // Fail-closed: sem sinal autoritativo de elegibilidade não anunciamos o teste.
    return input.eligibility === "eligible" ? "not_started" : "unknown";
  }

  const expiresAt = new Date(enrollment.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
    return "expired";
  }

  if (input.demoBalance <= 0) {
    return "exhausted";
  }

  if (expiresAt - now.getTime() <= 24 * 60 * 60 * 1000) {
    return "expiring_soon";
  }

  return "active";
}

export function getNextTrialInstallment(
  enrollment: TrialOfferEnrollmentView | null,
  now: Date = new Date(),
): NextTrialInstallment | null {
  if (!enrollment) return null;

  const expiresAt = new Date(enrollment.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || now.getTime() >= expiresAt) return null;

  const nextSeq = enrollment.lastGrantedSeq + 1;
  if (nextSeq < 0 || nextSeq >= TRIAL_INSTALLMENT_DAYS.length) return null;

  const startedAt = new Date(enrollment.startedAt).getTime();
  if (!Number.isFinite(startedAt)) return null;

  const dueAt = new Date(
    startedAt + TRIAL_INSTALLMENT_DAYS[nextSeq] * 24 * 60 * 60 * 1000,
  );
  if (dueAt.getTime() >= expiresAt) return null;

  // O cron é diário: a parcela fica elegível no dia, mas pode ser creditada
  // na execução seguinte. O retorno serve para exibir a próxima parcela.
  return { seq: nextSeq, dueAt: dueAt.toISOString() };
}

export function getTrialOfferDurationMs(): number {
  return TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * O teste pode estar encerrado, mas um estorno pode ter aberto uma graça de
 * 24h. O status do teste continua "expired"; a graça é exibida à parte.
 */
export function isTrialOfferRefundGrace(
  input: TrialOfferStatusInput,
  now: Date = new Date(),
): boolean {
  if (!input.enrollment) return false;
  const expiresAt = new Date(input.enrollment.expiresAt).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt > now.getTime()) return false;
  if (input.demoBalance <= 0) return false;
  const demoExpiresAt = input.demoExpiresAt
    ? new Date(input.demoExpiresAt).getTime()
    : NaN;
  return Number.isFinite(demoExpiresAt) && demoExpiresAt > now.getTime();
}
