import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

describe("F47.2 — não interferência com a oferta F50.4/F50.2", () => {
  it("geração preserva débito/estorno e a chamada existente de onboarding", () => {
    const source = read("src/app/api/store/[id]/visual-signature/generate-without-logo/route.ts");
    expect(source).toContain("maybeCompleteOnboardingAndStartTrial");
    expect(source).toContain("reserveCredit");
    expect(source).toContain("refundCredit");
    expect(source).toContain("trialOffer");
  });

  it("aprovação, realinhamento e logo não chamam helpers de oferta/crédito", () => {
    for (const file of [
      "src/app/api/store/[id]/visual-signature/approve/route.ts",
      "src/app/api/store/[id]/brand-profile/realign/route.ts",
      "src/app/api/store/[id]/logo/retry-brand-director/route.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("maybeCompleteOnboardingAndStartTrial");
      expect(source).not.toContain("reserveCredit");
      expect(source).not.toContain("refundCredit");
      expect(source).not.toContain("trial_offer_enrollments");
      expect(source).not.toContain("trial_offer_settings");
    }
  });

  it("nenhuma rota de assinatura/perfil grava individual_launch_at", () => {
    for (const file of [
      "src/app/api/store/[id]/visual-signature/approve/route.ts",
      "src/app/api/store/[id]/brand-profile/realign/route.ts",
      "src/app/api/store/[id]/brand-profile/infer/route.ts",
      "src/app/api/store/[id]/brand-profile/route.ts",
      "src/app/api/store/[id]/logo/route.ts",
      "src/app/api/store/[id]/logo/retry-brand-director/route.ts",
    ]) {
      expect(read(file)).not.toContain("individual_launch_at");
    }
  });

  it("logo pode concluir onboarding uma única vez, sem gravar datas manualmente", () => {
    const source = read("src/app/api/store/[id]/logo/route.ts");
    expect(source).toContain("maybeCompleteOnboardingAndStartTrial");
    expect(source).not.toContain("trial_offer_enrollments");
    expect(source).not.toContain("individual_launch_at");
  });

  it("perfil atual/anterior não importa crédito nem oferta", () => {
    for (const file of [
      "src/lib/visual-signature/brand-profile-state.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("trial-offer");
      expect(source).not.toContain("CreditService");
      expect(source).not.toContain("individual_launch_at");
    }
  });

  it("publicação/ativação da Assinatura Visual não altera coortes ou créditos", () => {
    const source = read("src/app/api/admin/visual-signature-model-config/route.ts");
    expect(source).not.toContain("trial_offer");
    expect(source).not.toContain("credit_balances");
    expect(source).not.toContain("individual_launch_at");
  });
});
