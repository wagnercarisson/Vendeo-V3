import { describe, it, expect } from "vitest";

import { DISPLAY_USD_DECIMALS, formatUsdDisplay } from "../display-format";

/**
 * F48.2.1 — arredondamento de exibição de valores monetários.
 *
 * A UI exibe 2 casas (ex.: `US$ 2.81`, `US$ 8.42`); os cálculos internos
 * (estimativa/teto/saldo) permanecem com 6 casas em `estimate.ts`.
 */
describe("display-format — valores monetários arredondados para exibição", () => {
  it("usa 2 casas decimais na exibição", () => {
    expect(DISPLAY_USD_DECIMALS).toBe(2);
  });

  it("arredonda os tetos do orçamento para 2 casas", () => {
    // Teto inicial 2.34 × 1.2 = 2.808 e pior caso 7.02 × 1.2 = 8.424.
    expect(formatUsdDisplay(2.808)).toBe("US$ 2.81");
    expect(formatUsdDisplay(8.424)).toBe("US$ 8.42");
  });

  it("arredonda custos por run para 2 casas", () => {
    expect(formatUsdDisplay(0.0412)).toBe("US$ 0.04");
    expect(formatUsdDisplay(0.0518)).toBe("US$ 0.05");
    expect(formatUsdDisplay(0)).toBe("US$ 0.00");
  });
});
