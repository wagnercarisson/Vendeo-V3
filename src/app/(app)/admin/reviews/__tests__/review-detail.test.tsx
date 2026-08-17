// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ReviewDetail } from "../review-detail";

const storeFixture = {
  name: "Minha Loja",
  city: "São Paulo",
  state: "SP",
  segment: "moda-calcados-acessorios",
  cnpj_official_data: {
    razao_social: "MINHA LOJA LTDA",
    nome_fantasia: "Minha Loja",
    cidade: "São Paulo",
    uf: "SP",
    cnae_principal: "4781-4/00",
    cnae_descricao: "Comércio varejista de artigos do vestuário e acessórios",
    situacao_cadastral: "ATIVA",
  },
};

describe("ReviewDetail (D11 — informado × oficial)", () => {
  it("Teste 49: mostra razão social, nome fantasia e similaridade %", () => {
    render(<ReviewDetail store={storeFixture} />);
    const detail = screen.getByText("Dados informados × oficiais").closest("div");

    // Razão social (oficial)
    expect(within(detail as HTMLElement).getByText("MINHA LOJA LTDA")).toBeInTheDocument();
    // Nome fantasia (oficial) — aparece também como nome informado
    expect(within(detail as HTMLElement).getAllByText("Minha Loja").length).toBeGreaterThanOrEqual(1);
    // Similaridade % (nome informado vs razão social / fantasia) — deve ser alta
    expect(within(detail as HTMLElement).getByText(/\d+%/)).toBeInTheDocument();
  });

  it("Teste 50: mostra CNAE principal + descrição e situação cadastral original", () => {
    render(<ReviewDetail store={storeFixture} />);
    const detail = screen.getByText("Dados informados × oficiais").closest("div");

    // CNAE principal + descrição
    expect(within(detail as HTMLElement).getByText(/4781-4\/00/)).toBeInTheDocument();
    expect(
      within(detail as HTMLElement).getByText(/Comércio varejista de artigos do vestuário/),
    ).toBeInTheDocument();
    // Situação cadastral original
    expect(within(detail as HTMLElement).getByText("ATIVA")).toBeInTheDocument();
  });

  it("Teste 50b: mostra cidade/UF informada × oficial", () => {
    render(<ReviewDetail store={storeFixture} />);
    const detail = screen.getByText("Dados informados × oficiais").closest("div");
    expect(within(detail as HTMLElement).getAllByText("São Paulo / SP").length).toBeGreaterThanOrEqual(1);
  });

  it("Teste 49b: mostra histórico de raiz quando disponível", () => {
    const history = [
      { benefit_type: "onboarding", cycle: null, created_at: "2026-08-01T00:00:00Z", reason: null },
    ];
    render(<ReviewDetail store={storeFixture} rootHistory={history} />);
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });
});