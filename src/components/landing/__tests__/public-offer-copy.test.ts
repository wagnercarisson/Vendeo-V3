import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PUBLIC_ACCESS_COPY, PUBLIC_OFFER_COPY } from "../public-offer-copy";

/**
 * Contrato da fonte única. Os textos aprovados são literais; qualquer mudança
 * passa por aqui e é refletida por home e `/floriculturas` sem cópia manual.
 */
describe("public-offer-copy — textos aprovados", () => {
  it("expõe exatamente a comunicação aprovada da oferta", () => {
    expect(PUBLIC_OFFER_COPY).toEqual({
      heading: "Teste gratuitamente.",
      summary: "28 dias gratuitos e até 20 créditos.",
      complement: "Sem cartão de crédito. Oferta para novas contas elegíveis.",
      detailsLabel: "Como funciona o teste gratuito?",
      conditions: {
        start:
          "O período de 28 dias começa após concluir o cadastro e a configuração inicial da sua loja.",
        installments:
          "Você recebe 5 créditos iniciais. Mais 5 são liberados a partir dos dias 7, 14 e 21, no processamento diário, até o máximo de 20 créditos no período.",
        accumulation:
          "Os créditos acumulam, inclusive as parcelas liberadas durante sua ausência, e os créditos gratuitos restantes vencem ao final do período.",
      },
      closedDetailsNote: "Solicitar acesso não inicia o período do teste.",
    });
  });

  it("expõe exatamente a comunicação aprovada do acesso", () => {
    expect(PUBLIC_ACCESS_COPY).toEqual({
      google: "Continuar com Google",
      email: "Continuar com email",
      closedCta: "Solicitar acesso gratuito",
      closedSupport: "Solicite seu convite para experimentar o Vendeo.",
      institutional: "Conheça o Vendeo",
    });
  });

  it("não contém regra de negócio, leitura de ambiente ou rede", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/landing/public-offer-copy.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/process\.env|fetch\(|supabase|trial-offer/);
  });
});

/**
 * Guarda estática: os arquivos públicos alterados não voltam a conter os
 * literais antigos. `/signup`, `/login` e o formulário de solicitação estão fora
 * desta rodada (D6) e não entram na lista.
 */
describe("guarda contra literais antigos", () => {
  const files = [
    "src/components/landing/offer-section.tsx",
    "src/components/landing/offer-card.tsx",
    "src/components/landing/acquisition-cta.tsx",
    "src/components/landing/floriculturas/access-cta-group.tsx",
    "src/app/(marketing)/floriculturas/page.tsx",
    "src/app/page.tsx",
  ];

  const forbidden = [
    "Solicitar acesso free",
    "Experimente o Vendeo em sua loja",
    "Como funcionam os créditos do teste gratuito?",
    "No beta fechado, solicitar acesso",
  ];

  it.each(files)("%s não repete os textos antigos", (file) => {
    const source = readFileSync(join(process.cwd(), file), "utf8");
    forbidden.forEach((literal) => {
      expect(source).not.toContain(literal);
    });
  });
});
