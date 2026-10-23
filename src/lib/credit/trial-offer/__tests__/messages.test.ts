import { describe, it, expect } from "vitest";
import { buildOnboardingSuccessMessage } from "../messages";

describe("buildOnboardingSuccessMessage (WR-02)", () => {
  it("informa benefícios ativados quando onboardingGranted é true", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "approved",
      onboardingGranted: true,
      trialOffer: { status: "started" },
    });
    expect(message).toContain("benefícios de boas-vindas foram ativados");
  });

  it("informa benefícios ativados quando a oferta já existe (existing)", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "approved",
      onboardingGranted: false,
      trialOffer: { status: "existing" },
    });
    expect(message).toContain("benefícios de boas-vindas foram ativados");
  });

  it("approved sem ativação promete ativação condicionada ao onboarding, não créditos liberados", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "approved",
      onboardingGranted: false,
      trialOffer: { status: "not_ready" },
    });
    expect(message).toContain("será ativada quando o onboarding for concluído");
    expect(message).not.toContain("liberados");
  });

  it("review sem ativação usa a mensagem condicional", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "review",
      onboardingGranted: false,
      trialOffer: { status: "not_ready" },
    });
    expect(message).toContain("oferta de teste de 28 dias");
    expect(message).not.toContain("liberados");
  });

  it("reject preserva mensagens específicas de CNPJ inativo", () => {
    expect(buildOnboardingSuccessMessage({ decision: "reject", reasons: ["cnpj_baixada"] }))
      .toContain("situação cadastral inativa");
    expect(buildOnboardingSuccessMessage({ decision: "reject", reasons: ["cnpj_nula"] }))
      .toContain("situação cadastral inativa");
  });

  it("reject por benefício já usado mantém a mensagem de uso confirmado", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "reject",
      reasons: ["beneficiary_already_used"],
    });
    expect(message).toContain("já foi utilizado para este CNPJ");
  });

  it("reject por raiz já usada mantém a mensagem de filial", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "reject",
      reasons: ["root_already_used"],
    });
    expect(message).toContain("Loja criada como filial");
  });

  it("prior_benefit_ambiguous exibe verificação pendente sem afirmar uso indevido", () => {
    const message = buildOnboardingSuccessMessage({
      decision: "review",
      reasons: ["prior_benefit_ambiguous"],
      onboardingGranted: false,
      trialOffer: { status: "not_ready" },
    });
    expect(message).toContain("verificação cadastral");
    expect(message).toContain("pendente");
    expect(message).not.toContain("já foi utilizado");
  });

  it("preserva a mensagem anterior em defer/unavailable", () => {
    const fallback = "Loja criada. Não foi possível verificar os dados cadastrais agora.";
    const message = buildOnboardingSuccessMessage({
      decision: "defer",
      reasons: ["api_unavailable"],
      onboardingGranted: false,
      trialOffer: { status: "not_ready" },
      fallbackMessage: fallback,
    });
    expect(message).toBe(fallback);
  });
});
