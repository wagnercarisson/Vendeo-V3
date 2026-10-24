import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

function read(relative: string): string {
  return readFileSync(path.join(ROOT, relative), "utf8");
}

// Contrato ESTÁTICO: complementa, sem substituir, as provas comportamentais
// de approve-route, realign-route e retry-route (Plano 47.2-05).
describe("F47.2 — contrato estático de regressão do perfil frente à oferta", () => {
  it("falha/realinhamento de perfil não escreve estado de oferta", () => {
    const realign = read("src/app/api/store/[id]/brand-profile/realign/route.ts");
    expect(realign).not.toContain("trial_offer");
    expect(realign).not.toContain("credit_balances");
    expect(realign).not.toContain("started_at");
    expect(realign).not.toContain("expires_at");
  });

  it("troca de assinatura não altera datas de enrollment", () => {
    const approve = read("src/app/api/store/[id]/visual-signature/approve/route.ts");
    expect(approve).not.toContain("trial_offer_enrollments");
    expect(approve).not.toContain("started_at");
    expect(approve).not.toContain("expires_at");
  });

  it("derivação de perfil não toca tabelas financeiras", () => {
    const source = read("src/lib/visual-signature/brand-profile-state.ts");
    expect(source).not.toMatch(/credit_|trial_offer|individual_launch_at/);
  });
});
