import type { TrialOfferResult } from "./completion";

/**
 * F50.4 (WR-02) — mensagem de sucesso do onboarding derivada do resultado
 * REAL da oferta, não de uma promessa fixa de créditos.
 *
 * Regras:
 * - `onboardingGranted === true` ou `trialOffer.status` em `started`/`existing`
 *   → benefícios ativados.
 * - `approved`/`review` sem ativação → a oferta de 28 dias será ativada quando
 *   o onboarding for concluído.
 * - `reject` → mensagens específicas por motivo (CNPJ inativo, benefício já
 *   usado, raiz já usada, ambiguidade).
 * - Qualquer outro caso preserva a mensagem definida antes da oferta
 *   (`not_found`, `unavailable`, `unsupported_format`).
 */
export interface OnboardingSuccessMessageInput {
  decision: string;
  reasons?: readonly string[];
  onboardingGranted?: boolean;
  trialOffer?: Pick<TrialOfferResult, "status"> | null;
  /** Mensagem já definida por ramos anteriores à oferta. */
  fallbackMessage?: string;
}

const BENEFITS_ACTIVATED_MESSAGE =
  "Loja criada com sucesso! Seus benefícios de boas-vindas foram ativados.";

const TRIAL_CONDITIONAL_MESSAGE =
  "Loja criada. A oferta de teste de 28 dias será ativada quando o onboarding for concluído.";

const PRIOR_BENEFIT_AMBIGUOUS_MESSAGE =
  "Loja criada. A verificação cadastral do benefício anterior está pendente. Nenhum crédito foi liberado ainda.";

export function buildOnboardingSuccessMessage(
  input: OnboardingSuccessMessageInput,
): string {
  const reasons = input.reasons ?? [];
  const activated =
    input.onboardingGranted === true ||
    input.trialOffer?.status === "started" ||
    input.trialOffer?.status === "existing";

  if (activated) return BENEFITS_ACTIVATED_MESSAGE;

  // Benefício anterior ambíguo nunca afirma uso indevido — é verificação pendente.
  if (reasons.includes("prior_benefit_ambiguous")) {
    return PRIOR_BENEFIT_AMBIGUOUS_MESSAGE;
  }

  if (input.decision === "reject") {
    if (reasons.includes("cnpj_baixada") || reasons.includes("cnpj_nula")) {
      return "Loja criada. Este CNPJ está com situação cadastral inativa.";
    }
    if (reasons.includes("beneficiary_already_used")) {
      return "Loja criada. O benefício de boas-vindas já foi utilizado para este CNPJ.";
    }
    if (reasons.includes("root_already_used")) {
      return "Loja criada como filial. Esta empresa já utilizou o benefício de boas-vindas.";
    }
    return input.fallbackMessage ?? "Loja criada.";
  }

  if (input.decision === "approved" || input.decision === "review") {
    return TRIAL_CONDITIONAL_MESSAGE;
  }

  return input.fallbackMessage ?? "Loja criada.";
}
