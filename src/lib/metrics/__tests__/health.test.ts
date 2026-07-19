import { describe, it, expect } from "vitest";
import { computeHealthState } from "../health";

describe("computeHealthState", () => {
  it("returns healthy when all metrics are within thresholds", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.01,
      avgDuration: 10000,
      refundRate: 5,
    });
    expect(result).toBe("healthy");
  });

  it("returns attention when one metric is in attention zone", () => {
    const result = computeHealthState({
      successRate: 75,
      errorRate: 2,
      avgCost: 0.01,
      avgDuration: 10000,
      refundRate: 5,
    });
    expect(result).toBe("attention");
  });

  it("returns pause when one metric is in pause zone", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.06,
      avgDuration: 10000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });

  it("returns worst state when multiple metrics in different zones", () => {
    const result = computeHealthState({
      successRate: 75,
      errorRate: 12,
      avgCost: 0.01,
      avgDuration: 10000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });
});
