import { describe, it, expect } from "vitest";
import { computeHealthState } from "../health";

describe("computeHealthState", () => {
  it("returns healthy when all metrics are within thresholds", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("healthy");
  });

  it("returns attention when average cost exceeds threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.3,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("attention");
  });

  it("returns pause when average cost exceeds pause threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.6,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });

  it("returns attention when average duration exceeds threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.1,
      avgDuration: 120000,
      refundRate: 5,
    });
    expect(result).toBe("attention");
  });

  it("returns pause when average duration exceeds pause threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 2,
      avgCost: 0.1,
      avgDuration: 200000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });

  it("returns attention when success rate is below healthy threshold", () => {
    const result = computeHealthState({
      successRate: 75,
      errorRate: 2,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("attention");
  });

  it("returns pause when success rate is below pause threshold", () => {
    const result = computeHealthState({
      successRate: 65,
      errorRate: 2,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });

  it("returns attention when error rate exceeds threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 7,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("attention");
  });

  it("returns pause when error rate exceeds pause threshold", () => {
    const result = computeHealthState({
      successRate: 95,
      errorRate: 12,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });

  it("returns worst state when multiple metrics in different zones", () => {
    const result = computeHealthState({
      successRate: 75,
      errorRate: 12,
      avgCost: 0.1,
      avgDuration: 30000,
      refundRate: 5,
    });
    expect(result).toBe("pause");
  });
});
