import { describe, it, expect } from "vitest";
import { tabBlockReasonText } from "../reason-text";

describe("tabBlockReasonText — copy específico por motivo (F36/D16)", () => {
  it("needs_basic_data cita nome e segmento da loja", () => {
    expect(tabBlockReasonText("posicionamento", "needs_basic_data")).toBe(
      "Informe o nome e o segmento da loja para liberar Posicionamento.",
    );
  });

  it("needs_legal_acceptance cita o aceite legal", () => {
    expect(tabBlockReasonText("posicionamento", "needs_legal_acceptance")).toBe(
      "Aceite os Termos de Uso e a Política de Uso Aceitável para liberar Posicionamento.",
    );
  });

  it("needs_tone_of_voice cita o tom de voz e usa o label custom (mobile)", () => {
    expect(
      tabBlockReasonText("direcao-visual", "needs_tone_of_voice", "Visual"),
    ).toBe("Defina o tom de voz para liberar Visual.");
  });

  it("needs_store_created usa copy genérico de salvar a loja", () => {
    expect(tabBlockReasonText("direcao-visual", "needs_store_created")).toBe(
      "Salve os dados básicos da loja para liberar esta etapa.",
    );
  });

  it("fiscal_pending usa copy de pendência fiscal", () => {
    expect(tabBlockReasonText("posicionamento", "fiscal_pending")).toContain(
      "Cadastro fiscal pendente",
    );
  });

  it("reason indefinido → fallback genérico com o label da aba", () => {
    expect(tabBlockReasonText("dados", undefined)).toBe(
      "Complete esta etapa para liberar Dados.",
    );
  });
});
