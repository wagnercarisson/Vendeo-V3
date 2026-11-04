// @vitest-environment node
import { describe, expect, it } from "vitest";

import { evaluateProofCall } from "../cost/proof-call-outcome";

const BASE = {
  requestedSize: "1152x2048",
  returnedWidth: 1152,
  returnedHeight: 2048,
  providerReportedUsd: null,
  calculatedFromUsageUsd: null,
  estimatedUsd: 0.11,
} as const;

describe("F59 — avaliação da chamada da prova", () => {
  it("aprova dimensão correta com custo real e cobra o maior valor", () => {
    expect(
      evaluateProofCall({
        ...BASE,
        providerReportedUsd: 0.09,
        calculatedFromUsageUsd: 0.11,
      }),
    ).toEqual({
      outcome: "succeeded",
      dimensionMatches: true,
      costVerified: true,
      chargedUsd: 0.11,
      stop: false,
    });
  });

  it("reprova e para quando a dimensão devolvida é divergente", () => {
    const result = evaluateProofCall({
      ...BASE,
      returnedWidth: 1024,
      returnedHeight: 1024,
      providerReportedUsd: 0.09,
    });
    expect(result.outcome).toBe("dimension_mismatch");
    expect(result.dimensionMatches).toBe(false);
    expect(result.stop).toBe(true);
    expect(result.chargedUsd).toBe(0.11);
  });

  it("reprova dimensão ausente/indecodificável", () => {
    const result = evaluateProofCall({
      ...BASE,
      returnedWidth: null,
      returnedHeight: null,
    });
    expect(result.outcome).toBe("dimension_mismatch");
    expect(result.stop).toBe(true);
  });

  it("exige reconciliação e para quando nenhum custo real foi apurado", () => {
    const result = evaluateProofCall(BASE);
    expect(result.outcome).toBe("cost_unverified");
    expect(result.costVerified).toBe(false);
    expect(result.stop).toBe(true);
    expect(result.chargedUsd).toBe(0.11);
  });

  it("custo reportado zero ainda conta como custo apurado", () => {
    const result = evaluateProofCall({
      ...BASE,
      providerReportedUsd: 0,
    });
    expect(result.outcome).toBe("succeeded");
    expect(result.costVerified).toBe(true);
    expect(result.chargedUsd).toBe(0.11);
  });

  it("custo calculado zero ainda conta como custo apurado", () => {
    const result = evaluateProofCall({
      ...BASE,
      calculatedFromUsageUsd: 0,
    });
    expect(result.outcome).toBe("succeeded");
    expect(result.costVerified).toBe(true);
  });

  it("controle 1024×1024 aceita somente a dimensão de controle", () => {
    expect(
      evaluateProofCall({
        ...BASE,
        requestedSize: "1024x1024",
        returnedWidth: 1024,
        returnedHeight: 1024,
        providerReportedUsd: 0.04,
      }).outcome,
    ).toBe("succeeded");
    expect(
      evaluateProofCall({
        ...BASE,
        requestedSize: "1024x1024",
        returnedWidth: 1152,
        returnedHeight: 2048,
        providerReportedUsd: 0.04,
      }).outcome,
    ).toBe("dimension_mismatch");
  });

  it("tamanho solicitado desconhecido falha fechado", () => {
    const result = evaluateProofCall({
      ...BASE,
      requestedSize: "1152x2047",
      providerReportedUsd: 0.09,
    });
    expect(result.outcome).toBe("dimension_mismatch");
    expect(result.stop).toBe(true);
  });
});
