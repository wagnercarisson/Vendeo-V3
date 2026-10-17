// @vitest-environment node
import { describe, expect, it } from "vitest";

import { classifyPreservation } from "../pilot/spend-preservation";

describe("F56.2b2c — guarda de preservação das provas", () => {
  it("ok quando o acumulado atual = esperado (snapshot + fixtures) e bloqueio = esperado", () => {
    expect(
      classifyPreservation({
        currentSpentUsd: 1.75,
        expectedSpentUsd: 1.75,
        currentBlockedReason: null,
        expectedBlockedReason: null,
      }),
    ).toEqual({ ok: true });
  });

  it("detecta concorrência externa (acumulado diferente do esperado)", () => {
    expect(
      classifyPreservation({
        currentSpentUsd: 2.05,
        expectedSpentUsd: 1.75,
        currentBlockedReason: null,
        expectedBlockedReason: null,
      }),
    ).toEqual({ ok: false, reason: "spent_divergence" });
  });

  it("detecta bloqueio inesperado", () => {
    expect(
      classifyPreservation({
        currentSpentUsd: 1.75,
        expectedSpentUsd: 1.75,
        currentBlockedReason: "mark_unknown_failed:timeout",
        expectedBlockedReason: null,
      }),
    ).toEqual({ ok: false, reason: "blocked_divergence" });
  });

  it("trata valores não finitos", () => {
    expect(
      classifyPreservation({
        currentSpentUsd: Number.NaN,
        expectedSpentUsd: 1.75,
        currentBlockedReason: null,
        expectedBlockedReason: null,
      }),
    ).toEqual({ ok: false, reason: "spent_not_finite" });
  });
});
