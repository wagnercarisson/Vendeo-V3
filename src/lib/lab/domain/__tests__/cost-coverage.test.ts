import { describe, it, expect } from "vitest";

import { deriveCostCoverage } from "../cost-coverage";
import type { CostResolution } from "@/lib/ai-cost/types";

/**
 * F48.1 (D8/DV-1) — cobertura derivada dos campos REAIS de `CostResolution`.
 */

function cost(overrides: Partial<CostResolution>): CostResolution {
  return { estimatedCostUsd: 0.05, costSource: "pricing_table", ...overrides };
}

describe("deriveCostCoverage — complete | partial | missing", () => {
  it("costSource not_available → missing", () => {
    expect(deriveCostCoverage(cost({ costSource: "not_available" }))).toBe("missing");
  });

  it("estimatedCostUsd null → missing", () => {
    expect(deriveCostCoverage(cost({ estimatedCostUsd: null }))).toBe("missing");
  });

  it("manual_unknown → partial", () => {
    expect(deriveCostCoverage(cost({ costSource: "manual_unknown" }))).toBe("partial");
  });

  it("fallback_static → partial", () => {
    expect(deriveCostCoverage(cost({ costSource: "fallback_static" }))).toBe("partial");
  });

  it("pricing_table com os dois componentes e sem nota → complete", () => {
    expect(
      deriveCostCoverage(
        cost({
          costSource: "pricing_table",
          textComponentUsd: 0.0121,
          imageToolComponentUsd: 0.03,
        }),
      ),
    ).toBe("complete");
  });

  it("pricing_table com apenas imageToolComponentUsd → partial", () => {
    expect(
      deriveCostCoverage(cost({ costSource: "pricing_table", imageToolComponentUsd: 0.03 })),
    ).toBe("partial");
  });

  it("pricing_table com apenas textComponentUsd → partial", () => {
    expect(
      deriveCostCoverage(cost({ costSource: "pricing_table", textComponentUsd: 0.0121 })),
    ).toBe("partial");
  });

  it("pricing_table com costEstimationNote → partial", () => {
    expect(
      deriveCostCoverage(
        cost({
          costSource: "pricing_table",
          textComponentUsd: 0.0121,
          imageToolComponentUsd: 0.03,
          costEstimationNote: "provisional_image_tool_unit_cost_until_provider_reconciliation",
        }),
      ),
    ).toBe("partial");
  });

  it("costEstimationNote vazia/só espaços não rebaixa para partial", () => {
    expect(
      deriveCostCoverage(
        cost({
          costSource: "pricing_table",
          textComponentUsd: 0.0121,
          imageToolComponentUsd: 0.03,
          costEstimationNote: "   ",
        }),
      ),
    ).toBe("complete");
  });

  it("provider_reported → complete", () => {
    expect(
      deriveCostCoverage(
        cost({ costSource: "provider_reported", providerReportedCostUsd: 0.05 }),
      ),
    ).toBe("complete");
  });

  it("provider_reported sem valor estimado → missing (indisponível vence)", () => {
    expect(
      deriveCostCoverage(cost({ costSource: "provider_reported", estimatedCostUsd: null })),
    ).toBe("missing");
  });
});
