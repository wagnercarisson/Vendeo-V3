export const CREDIT_TYPE_LABELS: Record<string, string> = {
  bonus_onboarding: "Bônus de Boas-Vindas",
  bonus_monthly: "Bônus Mensal",
  admin_grant: "Concessão Administrativa",
  purchase: "Compra",
  deduction: "Geração",
  refund: "Estorno",
  adjustment: "Ajuste",
};

export const CREDIT_TYPE_BADGE: Record<string, "ready" | "error"> = {
  bonus_onboarding: "ready",
  bonus_monthly: "ready",
  admin_grant: "ready",
  purchase: "ready",
  deduction: "error",
  refund: "ready",
  adjustment: "ready",
};
